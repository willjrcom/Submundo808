import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {
 ensureCrowdSchema,readCrowdLive,crowdPublicView,readCrowdHistory,sampleCrowdHistory,
 gpsToPercent,CROWD_BUCKET_MS,CROWD_MIN_GROUP
} from '../server/crowd-analytics.mjs';

const NOW=Date.parse('2026-11-07T23:00:00Z');
const GPS={mode:'manual',tl:{lat:-23,lng:-47},tr:{lat:-23,lng:-46.999},
 bl:{lat:-23.001,lng:-47},br:{lat:-23.001,lng:-46.999}};

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`
 CREATE TABLE location_preferences(user_id TEXT PRIMARY KEY,gps_enabled INTEGER NOT NULL DEFAULT 0,
  share_enabled INTEGER NOT NULL DEFAULT 0,share_event_id TEXT,share_expires_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE live_locations(user_id TEXT PRIMARY KEY,lat REAL NOT NULL,lng REAL NOT NULL,
  accuracy REAL NOT NULL,updated_at INTEGER NOT NULL);
 CREATE TABLE events(id TEXT PRIMARY KEY,name TEXT NOT NULL,location_sharing_enabled INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE venue_maps(id TEXT PRIMARY KEY,name TEXT NOT NULL);
 CREATE TABLE map_areas(id TEXT PRIMARY KEY,map_id TEXT NOT NULL,name TEXT NOT NULL,
  x REAL,y REAL,width REAL,height REAL,gps_json TEXT NOT NULL);
 CREATE TABLE event_maps(event_id TEXT NOT NULL,map_id TEXT NOT NULL,PRIMARY KEY(event_id,map_id));
 `);
 ensureCrowdSchema(db);
 db.prepare('INSERT INTO events VALUES(?,?,?)').run('event-1','Festa teste',1);
 db.prepare('INSERT INTO events VALUES(?,?,?)').run('event-2','Outra festa',1);
 db.prepare('INSERT INTO venue_maps VALUES(?,?)').run('map-1','Área principal');
 db.prepare('INSERT INTO event_maps VALUES(?,?)').run('event-1','map-1');
 db.prepare('INSERT INTO map_areas VALUES(?,?,?,?,?,?,?,?)').run('pista','map-1','Pista',0,0,50,100,JSON.stringify(GPS));
 db.prepare('INSERT INTO map_areas VALUES(?,?,?,?,?,?,?,?)').run('bar','map-1','Bar',50,0,50,100,'{}');
 return db;
}
function insertPerson(db,id,{x=.25,y=.5,accuracy=4,consent=true,share=true,event='event-1',updatedAt=NOW}={}){
 const lat=GPS.tl.lat+(GPS.bl.lat-GPS.tl.lat)*y;
 const lng=GPS.tl.lng+(GPS.tr.lng-GPS.tl.lng)*x;
 db.prepare(`INSERT INTO location_preferences(user_id,gps_enabled,share_enabled,share_event_id,share_expires_at,analytics_enabled,analytics_event_id,updated_at)
 VALUES(?,?,?,?,?,?,?,?)`).run(id,1,share?1:0,event,NOW+100_000,consent?1:0,consent?event:null,NOW);
 db.prepare('INSERT INTO live_locations VALUES(?,?,?,?,?)').run(id,lat,lng,accuracy,updatedAt);
}
test('consentimento é explicitamente desligado para usuários existentes e esquema é idempotente',()=>{
 const db=fixture();
 try{
  insertPerson(db,'anterior',{consent:false});
  ensureCrowdSchema(db);
  assert.equal(db.prepare('SELECT analytics_enabled FROM location_preferences WHERE user_id=?').get('anterior').analytics_enabled,0);
  assert.equal(readCrowdLive(db,'event-1',NOW).raw.total,0);
 }finally{db.close();}
});

test('identifica ambientes calibrados sem contar duas vezes e respeita evento, consentimento e validade',()=>{
 const db=fixture();
 try{
  for(let i=0;i<7;i++)insertPerson(db,'p'+i,{x:i%2?.75:.25});
  insertPerson(db,'unconsented',{consent:false});
  insertPerson(db,'wrong-event',{event:'event-2'});
  insertPerson(db,'outdated',{updatedAt:NOW-95_000});
  insertPerson(db,'expired',{share:false});
  insertPerson(db,'bad-gps',{accuracy:30});
  const raw=readCrowdLive(db,'event-1',NOW);
  assert.equal(raw.raw.total,8); // 7 valid and one inaccurate, never other events
  assert.equal(raw.raw.placed,7);
  assert.equal(raw.raw.unclassified,1);
  const m=raw.maps[0];
  assert.equal(m.calibrated,true);
  assert.equal(m.areas.find(a=>a.id==='pista').count,4);
  assert.equal(m.areas.find(a=>a.id==='bar').count,3);
  const publicResult=crowdPublicView(raw);
  assert.equal(publicResult.participants,8);
  assert.equal(publicResult.classified,7);
  assert.equal(publicResult.unclassified,null);
  assert.equal(publicResult.maps[0].areas.find(a=>a.id==='pista').count,null);
  assert.ok(!JSON.stringify(publicResult).includes('user_id'));
  assert.ok(!JSON.stringify(publicResult).includes('lat'));
  assert.ok(!JSON.stringify(publicResult).includes('lng'));
 }finally{db.close();}
});

test('grupo mínimo de cinco protege contagens pequenas e não revela posições',()=>{
 const db=fixture();
 try{
  for(let i=0;i<5;i++)insertPerson(db,'consenting-'+i);
  const view=crowdPublicView(readCrowdLive(db,'event-1',NOW));
  assert.equal(view.maps[0].areas.find(a=>a.id==='pista').count,5);
  assert.equal(view.participants,5);
  assert.equal(CROWD_MIN_GROUP,5);
  assert.equal(crowdPublicView(readCrowdLive(db,'event-2',NOW)).participants,0);
 }finally{db.close();}
});

test('desconsidera planta demonstrativa e GPS próximo demais da divisória',()=>{
 const db=fixture();
 try{
  insertPerson(db,'boundary',{x:.499,y:.5,accuracy:7});
  let reading=readCrowdLive(db,'event-1',NOW);
  assert.equal(reading.raw.total,1);
  assert.equal(reading.raw.placed,0);
  db.prepare('UPDATE map_areas SET gps_json=? WHERE id=?').run(JSON.stringify({...GPS,mode:'demo-auto'}),'pista');
  reading=readCrowdLive(db,'event-1',NOW);
  assert.equal(reading.maps[0].calibrated,false);
  assert.equal(reading.raw.placed,0);
 }finally{db.close();}
});

test('agrega snapshots por janela de cinco minutos e preserva somente métricas, sem identidade',()=>{
 const db=fixture();
 try{
  for(let i=0;i<6;i++)insertPerson(db,'user-'+i);
  const first=sampleCrowdHistory(db,NOW);
  assert.equal(first,1);
  assert.equal(sampleCrowdHistory(db,NOW+1000),1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM event_crowd_snapshots WHERE event_id='event-1'").get().n,4);
  assert.equal(db.prepare("SELECT people_count FROM event_crowd_snapshots WHERE area_id='__total__'").get().people_count,6);
  const history=readCrowdHistory(db,'event-1',NOW+10_000,'24h');
  assert.equal(history.snapshotCount,1);
  assert.equal(history.series.length,1);
  assert.equal(history.series[0].participants,6);
  assert.equal(history.hotspots[0].name,'Pista');
  assert.equal(history.hotspots[0].peak,6);
  const scoped=readCrowdHistory(db,'event-1',NOW+10_000,'24h','map-1');
  assert.equal(scoped.mapId,'map-1');
  assert.equal(scoped.snapshotCount,1);
  assert.equal(scoped.series[0].participants,6);
  assert.equal(scoped.hotspots[0].mapId,'map-1');
  assert.throws(()=>readCrowdHistory(db,'event-1',NOW,'24h','map-unknown'),/Planta não vinculada/);
  const columns=db.prepare('PRAGMA table_info(event_crowd_snapshots)').all().map(c=>c.name);
  assert.deepEqual(columns,['event_id','map_id','area_id','bucket_at','people_count']);
  assert.ok(!columns.includes('user_id'));
  assert.ok(!columns.includes('lat'));
  assert.equal(CROWD_BUCKET_MS,300_000);
 }finally{db.close();}
});

test('histórico é separado por evento e expira após 30 dias',()=>{
 const db=fixture();
 try{
  for(let i=0;i<5;i++)insertPerson(db,'u'+i);
  sampleCrowdHistory(db,NOW);
  assert.equal(readCrowdHistory(db,'event-2',NOW,'24h').snapshotCount,0);
  sampleCrowdHistory(db,NOW+31*24*60*60_000);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM event_crowd_snapshots').get().n,0);
  assert.throws(()=>readCrowdHistory(db,'event-1',NOW,'invalid'),/Período inválido/);
 }finally{db.close();}
});

test('rotas exigem admin e a localização do participante exige consentimento separado',()=>{
 const index=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');
 const map=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');
 assert.match(index,/if\(!isAdmin\(user\)\)return json\(res,403/);
 assert.match(index,/key==='crowd-live'\|\|key==='crowd-history'/);
 assert.match(index,/b\.analyticsEnabled===true/);
 assert.match(index,/analytics_event_id/);
 assert.match(map,/Contribuir com estatísticas anônimas da festa \(opcional\)/);
 assert.match(map,/analytics-consent/);
 assert.match(map,/Revogar/);
});
