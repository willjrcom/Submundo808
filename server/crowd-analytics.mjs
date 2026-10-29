// Painel experimental de concentração: aproveita somente o GPS efêmero que já
// foi autorizado para amigos E consentido separadamente para estatísticas.
// Nenhum identificador individual ou trajeto é salvo nos snapshots.
import {LOCATION_FRESH_MS} from './location-sharing.mjs';

export const CROWD_BUCKET_MS=5*60_000;
export const CROWD_MIN_GROUP=5;
export const CROWD_GRID_DIVISIONS=8;
export const CROWD_RETENTION_MS=30*24*60*60_000;
const MAX_ACCURACY_METERS=25;
const METERS_PER_DEGREE=111320;
const REDACTED=null;

export function ensureCrowdSchema(db){
 db.exec(`CREATE TABLE IF NOT EXISTS event_crowd_snapshots(
  event_id TEXT NOT NULL,map_id TEXT NOT NULL,area_id TEXT NOT NULL,
  bucket_at INTEGER NOT NULL,people_count INTEGER NOT NULL,
  PRIMARY KEY(event_id,map_id,area_id,bucket_at)
 );
 CREATE INDEX IF NOT EXISTS idx_crowd_snapshots_event_time ON event_crowd_snapshots(event_id,bucket_at);`);
 db.exec(`CREATE TABLE IF NOT EXISTS event_crowd_cells(
  event_id TEXT NOT NULL,map_id TEXT NOT NULL,cell_x INTEGER NOT NULL,cell_y INTEGER NOT NULL,
  bucket_at INTEGER NOT NULL,people_count INTEGER NOT NULL,
  PRIMARY KEY(event_id,map_id,cell_x,cell_y,bucket_at)
 );
 CREATE INDEX IF NOT EXISTS idx_crowd_cells_event_map_time ON event_crowd_cells(event_id,map_id,bucket_at);`);
 // Consent is OFF for all existing users. Existing friend sharing never grants it.
 if(!db.prepare('PRAGMA table_info(location_preferences)').all().some(c=>c.name==='analytics_enabled'))
  db.exec('ALTER TABLE location_preferences ADD COLUMN analytics_enabled INTEGER NOT NULL DEFAULT 0');
 if(!db.prepare('PRAGMA table_info(location_preferences)').all().some(c=>c.name==='analytics_event_id'))
  db.exec('ALTER TABLE location_preferences ADD COLUMN analytics_event_id TEXT');
}

function cornersOf(gps){
 if(!gps||gps.mode==='demo-auto'||!['tl','tr','bl','br'].every(k=>
  gps[k]&&Number.isFinite(gps[k].lat)&&Number.isFinite(gps[k].lng)))return null;
 return gps;
}
const meters=(a,b)=>Math.hypot((a.lng-b.lng)*METERS_PER_DEGREE*Math.cos((a.lat+b.lat)*Math.PI/360),(a.lat-b.lat)*METERS_PER_DEGREE);

// Inverse bilinear projection compatible with the participant map. Never
// interpret uncalibrated/demo maps as physical crowd measurements.
export function gpsToPercent(p,c){
 const origin=c.tl;
 const scaleX=METERS_PER_DEGREE*Math.cos(origin.lat*Math.PI/180);
 const xy=q=>({x:(q.lng-origin.lng)*scaleX,y:(origin.lat-q.lat)*METERS_PER_DEGREE});
 const tr=xy(c.tr),bl=xy(c.bl),br=xy(c.br),pt=xy(p);
 let u=.5,v=.5;
 for(let i=0;i<12;i++){
  const fx=tr.x*u+bl.x*v+(br.x-tr.x-bl.x)*u*v-pt.x;
  const fy=tr.y*u+bl.y*v+(br.y-tr.y-bl.y)*u*v-pt.y;
  const ax=tr.x+(br.x-tr.x-bl.x)*v,ay=tr.y+(br.y-tr.y-bl.y)*v;
  const bx=bl.x+(br.x-tr.x-bl.x)*u,by=bl.y+(br.y-tr.y-bl.y)*u;
  const det=ax*by-ay*bx;
  if(Math.abs(det)<1e-8)return null;
  const du=(fx*by-fy*bx)/det,dv=(ax*fy-ay*fx)/det;
  u-=du;v-=dv;
  if(Math.abs(du)+Math.abs(dv)<1e-8)break;
 }
 if(!Number.isFinite(u)||!Number.isFinite(v))return null;
 return {x:u*100,y:v*100,inside:u>=0&&u<=1&&v>=0&&v<=1,
  widthMeters:(meters(c.tl,c.tr)+meters(c.bl,c.br))/2,
  heightMeters:(meters(c.tl,c.bl)+meters(c.tr,c.br))/2};
}

export function redactSmallCount(count){
 return count===0?0:count>=CROWD_MIN_GROUP?count:REDACTED;
}

function eventMaps(db,eventId){
 const rows=db.prepare(`SELECT m.id AS map_id,m.name AS map_name,a.id AS area_id,a.name AS area_name,
 a.x,a.y,a.width,a.height,a.gps_json
 FROM event_maps em JOIN venue_maps m ON m.id=em.map_id
 LEFT JOIN map_areas a ON a.map_id=m.id
 WHERE em.event_id=? ORDER BY m.name,a.name`).all(eventId);
 const maps=new Map();
 for(const row of rows){
  if(!maps.has(row.map_id))maps.set(row.map_id,{id:row.map_id,name:row.map_name,areas:[],calibrated:false,corners:null});
  if(!row.area_id)continue;
  const map=maps.get(row.map_id);
  let gps=null;
  try{gps=cornersOf(JSON.parse(row.gps_json||'{}'));}catch{}
  if(gps&&!map.corners){map.corners=gps;map.calibrated=true;}
  map.areas.push({id:row.area_id,name:row.area_name,x:Number(row.x),y:Number(row.y),
   width:Number(row.width),height:Number(row.height),count:0});
 }
 return [...maps.values()];
}

export function readCrowdLive(db,eventId,now=Date.now()){
 const event=db.prepare('SELECT id,name,location_sharing_enabled FROM events WHERE id=?').get(eventId);
 if(!event)throw Object.assign(Error('Evento não encontrado.'),{status:404});
 const maps=eventMaps(db,eventId);
 const people=db.prepare(`SELECT l.lat,l.lng,l.accuracy
  FROM live_locations l JOIN location_preferences p ON p.user_id=l.user_id
  WHERE p.analytics_enabled=1 AND p.analytics_event_id=?
   AND p.share_enabled=1 AND p.gps_enabled=1 AND p.share_event_id=?
   AND p.share_expires_at>? AND l.updated_at>?`)
  .all(eventId,eventId,now,now-LOCATION_FRESH_MS);
 let placed=0;
 const cellTotals=new Map();
 if(event.location_sharing_enabled){
  for(const person of people){
   const accuracy=Number(person.accuracy);
   if(!Number.isFinite(accuracy)||accuracy<0||accuracy>MAX_ACCURACY_METERS)continue;
   let best=null;
   for(const map of maps){
    if(!map.calibrated)continue;
    const p=gpsToPercent(person,map.corners);
    if(!p?.inside||p.widthMeters<=0||p.heightMeters<=0)continue;
    // GPS uncertainty must fit inside the chosen area; points near a border
    // remain unclassified instead of being assigned to the wrong room.
    const padX=100*accuracy/p.widthMeters,padY=100*accuracy/p.heightMeters;
    for(const area of map.areas){
     if(p.x>=area.x+padX&&p.x<=area.x+area.width-padX&&
        p.y>=area.y+padY&&p.y<=area.y+area.height-padY){
       const size=area.width*area.height;
       if(!best||size<best.size)best={area,size,map,position:p};
     }
    }
   }
   if(best){
    best.area.count++;placed++;
    // One device is assigned to one coarse map cell per snapshot; never store its coordinates.
    const x=Math.max(0,Math.min(CROWD_GRID_DIVISIONS-1,Math.floor(best.position.x*CROWD_GRID_DIVISIONS/100)));
    const y=Math.max(0,Math.min(CROWD_GRID_DIVISIONS-1,Math.floor(best.position.y*CROWD_GRID_DIVISIONS/100)));
    const key=best.map.id+':'+x+':'+y;
    const entry=cellTotals.get(key)||{mapId:best.map.id,x,y,count:0};
    entry.count++;cellTotals.set(key,entry);
   }
  }
 }
 const total=event.location_sharing_enabled?people.length:0;
 return {event:{id:event.id,name:event.name},updatedAt:now,minimumGroup:CROWD_MIN_GROUP,
  raw:{total,placed,unclassified:total-placed},
  maps,cells:[...cellTotals.values()]};
}

export function crowdPublicView(reading){
 const {event,updatedAt,minimumGroup,raw,maps}=reading;
 return {event,updatedAt,minimumGroup,refreshSeconds:30,
  participants:redactSmallCount(raw.total),
  classified:redactSmallCount(raw.placed),
  unclassified:redactSmallCount(raw.unclassified),
  maps:maps.map(map=>({id:map.id,name:map.name,calibrated:map.calibrated,
   areas:map.areas.map(area=>({...area,count:redactSmallCount(area.count)}))}))};
}

export function sampleCrowdHistory(db,now=Date.now()){
 const bucketAt=Math.floor(now/CROWD_BUCKET_MS)*CROWD_BUCKET_MS;
 const events=db.prepare('SELECT id FROM events WHERE location_sharing_enabled=1').all();
 const insert=db.prepare(`INSERT INTO event_crowd_snapshots(event_id,map_id,area_id,bucket_at,people_count)
  VALUES(?,?,?,?,?) ON CONFLICT(event_id,map_id,area_id,bucket_at)
  DO UPDATE SET people_count=excluded.people_count`);
 const insertCell=db.prepare(`INSERT INTO event_crowd_cells(event_id,map_id,cell_x,cell_y,bucket_at,people_count)
  VALUES(?,?,?,?,?,?) ON CONFLICT(event_id,map_id,cell_x,cell_y,bucket_at)
  DO UPDATE SET people_count=excluded.people_count`);
 let sampled=0;
 for(const event of events){
  const live=readCrowdLive(db,event.id,now);
  if(live.raw.total===0)continue; // No empty future-event sampling.
  db.exec('BEGIN');
  try{
   db.prepare('DELETE FROM event_crowd_cells WHERE event_id=? AND bucket_at=?').run(event.id,bucketAt);
   insert.run(event.id,'__event__','__total__',bucketAt,live.raw.total);
   insert.run(event.id,'__event__','__unclassified__',bucketAt,live.raw.unclassified);
   for(const map of live.maps)for(const area of map.areas)
    insert.run(event.id,map.id,area.id,bucketAt,area.count);
   for(const cell of live.cells)insertCell.run(event.id,cell.mapId,cell.x,cell.y,bucketAt,cell.count);
   db.exec('COMMIT');
   sampled++;
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 db.prepare('DELETE FROM event_crowd_snapshots WHERE bucket_at<?').run(now-CROWD_RETENTION_MS);
 db.prepare('DELETE FROM event_crowd_cells WHERE bucket_at<?').run(now-CROWD_RETENTION_MS);
 return sampled;
}

export function readCrowdHistory(db,eventId,now=Date.now(),period='24h',mapId=null){
 if(!['24h','7d','30d'].includes(period))throw Object.assign(Error('Período inválido.'),{status:400});
 const event=db.prepare('SELECT id,name FROM events WHERE id=?').get(eventId);
 if(!event)throw Object.assign(Error('Evento não encontrado.'),{status:404});
 const windowMs={'24h':24*60*60_000,'7d':7*24*60*60_000,'30d':CROWD_RETENTION_MS}[period];
 const maps=eventMaps(db,eventId);
 if(mapId&&!maps.some(m=>m.id===mapId))
  throw Object.assign(Error('Planta não vinculada a este evento.'),{status:404});
 const rows=db.prepare(`SELECT map_id,area_id,bucket_at,people_count FROM event_crowd_snapshots
  WHERE event_id=? AND bucket_at>=? ORDER BY bucket_at`).all(eventId,now-windowMs);
 const totals=new Map();
 const zones=new Map();
 const zoneNames=new Map(maps.flatMap(map=>map.areas.map(a=>[map.id+':'+a.id,{id:a.id,mapId:map.id,name:a.name,mapName:map.name}])));
 for(const row of rows){
  if(mapId&&row.map_id!==mapId)continue;
  const count=Number(row.people_count);
  if(!mapId&&row.map_id==='__event__'&&row.area_id==='__total__'){totals.set(Number(row.bucket_at),count);continue;}
  if(mapId)totals.set(Number(row.bucket_at),(totals.get(Number(row.bucket_at))||0)+count);
  const key=row.map_id+':'+row.area_id;
  if(!zoneNames.has(key))continue;
  const entry=zones.get(key)||{...zoneNames.get(key),sum:0,peak:0,samples:0};
  entry.sum+=count;entry.peak=Math.max(entry.peak,count);entry.samples++;
  zones.set(key,entry);
 }
 const step=period==='24h'?CROWD_BUCKET_MS:60*60_000;
 const combined=new Map();
 for(const [time,count] of totals){
  const bucket=Math.floor(time/step)*step;
  const item=combined.get(bucket)||{sum:0,count:0};
  item.sum+=count;item.count++;
  combined.set(bucket,item);
 }
 const series=[...combined.entries()].sort((a,b)=>a[0]-b[0])
  .map(([at,v])=>({at,participants:redactSmallCount(Math.round(v.sum/v.count))}));
 const hotspots=[...zones.values()].filter(z=>z.peak>=CROWD_MIN_GROUP)
  .map(z=>({id:z.id,mapId:z.mapId,name:z.name,mapName:z.mapName,
   average:Math.round(z.sum/z.samples*10)/10,peak:z.peak,samples:z.samples}))
  .sort((a,b)=>b.average-a.average).slice(0,20);
 return {event,period,mapId,minimumGroup:CROWD_MIN_GROUP,sampleIntervalMinutes:5,
  series,hotspots,snapshotCount:totals.size,lastSnapshotAt:Math.max(0,...totals.keys())||null};
}

/**
 * Historical, hourly occupancy. Counts are the mean active consenting devices
 * per 5-minute snapshot, never a count of unique attendees over the hour.
 * Heat cells are anonymous and redacted when their hourly average is < 5.
 */
export function readCrowdHourly(db,eventId,mapId,now=Date.now()){
 const event=db.prepare('SELECT id,name,starts_at,ends_at FROM events WHERE id=?').get(eventId);
 if(!event)throw Object.assign(Error('Evento não encontrado.'),{status:404});
 const map=eventMaps(db,eventId).find(item=>item.id===mapId);
 if(!map)throw Object.assign(Error('Planta não vinculada a este evento.'),{status:404});
 const since=now-CROWD_RETENTION_MS;
 const totalRows=db.prepare(`SELECT bucket_at,people_count FROM event_crowd_snapshots
  WHERE event_id=? AND map_id='__event__' AND area_id='__total__' AND bucket_at>=?
  ORDER BY bucket_at`).all(eventId,since);
 const cellRows=db.prepare(`SELECT bucket_at,cell_x,cell_y,people_count FROM event_crowd_cells
  WHERE event_id=? AND map_id=? AND bucket_at>=?
  ORDER BY bucket_at`).all(eventId,mapId,since);
 const hours=new Map();
 const ensure=at=>{
  const hour=Math.floor(Number(at)/3600000)*3600000;
  if(!hours.has(hour))hours.set(hour,{at:hour,total:0,samples:0,cells:new Map()});
  return hours.get(hour);
 };
 for(const row of totalRows){
  const hour=ensure(row.bucket_at);
  hour.total+=Number(row.people_count);hour.samples++;
 }
 for(const row of cellRows){
  const hour=ensure(row.bucket_at),key=row.cell_x+':'+row.cell_y;
  const item=hour.cells.get(key)||{x:Number(row.cell_x),y:Number(row.cell_y),sum:0};
  item.sum+=Number(row.people_count);hour.cells.set(key,item);
 }
 return {
  event:{id:event.id,name:event.name,starts_at:event.starts_at,ends_at:event.ends_at},
  map:{id:map.id,name:map.name,calibrated:map.calibrated,
   areas:map.areas.map(({id,name,x,y,width,height})=>({id,name,x,y,width,height}))},
  divisions:CROWD_GRID_DIVISIONS,minimumGroup:CROWD_MIN_GROUP,
  hours:[...hours.values()].sort((a,b)=>a.at-b.at).map(hour=>({
   at:hour.at,participants:redactSmallCount(Math.round(hour.total/Math.max(1,hour.samples))),
   samples:hour.samples,
   cells:[...hour.cells.values()].map(cell=>({
    x:cell.x,y:cell.y,
    count:Math.round(cell.sum/Math.max(1,hour.samples))
   })).filter(cell=>cell.count>=CROWD_MIN_GROUP)
  }))
 };
}
