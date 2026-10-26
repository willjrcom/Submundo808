// Catálogo de demonstração da POC. Criado UMA vez por banco, sem duplicar
// no reinício e sem sobrescrever edições ou exclusões posteriores do admin.
// Mapas geográficos NÃO são calibrados automaticamente sem GPS real.
import {seedDemoProducts,DEMO_PRODUCTS} from './demo-products.mjs';

export const SHOWCASE_KEY='poc_showcase_v2_created';
const makeId=(kind,slug)=>'poc-v2-'+kind+'-'+slug;
const place=(name,kind,x,y,width,height,color)=>({name,kind,x,y,width,height,color,icon:kind});
const point=(name,type,x,y,side)=>({
 name,type,x,y,shape:'square',size:42,color:'#C4FF40',
 ...(side?{anchor:{side,offset:side==='top'||side==='bottom'?x:y}}:{})
});
const VENUES=[
 {slug:'terraco',name:'Terraço 808',address:'Local a divulgar',city:'São Paulo'},
 {slug:'armazem',name:'Armazém Aurora 808',address:'Local a divulgar',city:'São Paulo'}
];
const EVENTS=[
 {
  slug:'neon',title:'SUBMUNDO 808 — Neon District',venue:'original',
  mapName:'Neon District · Arena principal',offset:2,start:'21:00',end:'04:00',
  description:'Uma noite de graves intensos, luzes neon e sets de house e techno.',
  djs:['NØX','LUNA BASS','MAYA VOLT','KAYO 808','VEXX','SUBZERO'],
  areas:[place('Área VIP','vip',0,0,100,38,'#9747FF'),place('Pista','pista',0,38,100,62,'#3B82F6')],
  markers:[point('Palco','palco',50,0,'top'),point('Entrada principal','entrada',50,100,'bottom'),point('Bar principal','bar',10,51),point('Banheiros','banheiro',90,51),point('Bar de cerveja','bar',20,78),point('Saída de emergência','saida',95,89,'right')]
 },
 {
  slug:'bass',title:'SUBMUNDO 808 — Bass Warehouse',venue:'armazem',
  mapName:'Bass Warehouse · Galpão central',offset:2,start:'22:00',end:'05:00',
  description:'Bass music, drum and bass e beats acelerados em um galpão de múltiplos ambientes.',
  djs:['BASS RITUAL','VEXX','BEATNIK','NOIR','KAYO 808','VOID'],
  areas:[place('Pista','pista',0,0,72,100,'#3B82F6'),place('Área VIP','vip',72,0,28,60,'#9747FF'),place('Lounge','descanso',72,60,28,40,'#00BDD6')],
  markers:[point('Palco','palco',0,42,'left'),point('Entrada lateral','entrada',100,80,'right'),point('Bar principal','bar',30,80),point('Banheiros','banheiro',87,70),point('Ponto médico','posto-medico',85,25),point('Food trucks','alimentacao',55,92)]
 },
 {
  slug:'sunset',title:'SUBMUNDO 808 — Sunset Sessions',venue:'terraco',
  mapName:'Sunset Sessions · Terraço e lounge',offset:9,start:'17:00',end:'01:00',
  description:'Fim de tarde com melodic house, pista aberta e um lounge para descansar.',
  djs:['SOLAR','AMBER','LUNA BASS','AURA','JUNO','MAYA VOLT'],
  areas:[place('Pista aberta','pista',0,0,100,65,'#3B82F6'),place('Lounge','descanso',0,65,52,35,'#00BDD6'),place('Área VIP','vip',52,65,48,35,'#9747FF')],
  markers:[point('Palco sunset','palco',50,12),point('Entrada','entrada',10,100,'bottom'),point('Bar do terraço','bar',85,48),point('Banheiros','banheiro',90,89),point('Bar de cerveja','bar',20,88),point('Alimentação','alimentacao',43,93)]
 },
 {
  slug:'after',title:'SUBMUNDO 808 — After Hours',venue:'armazem',
  mapName:'After Hours · Pista e backstage',offset:16,start:'23:00',end:'07:00',
  description:'Uma madrugada de techno underground, com backstage e múltiplos pontos de apoio.',
  djs:['DARK MIND','NØX','RAVEN','NOIR','VOID','SUBZERO'],
  areas:[place('Backstage','backstage',0,0,30,40,'#EAB308'),place('Lounge','descanso',0,40,30,60,'#00BDD6'),place('Pista','pista',30,0,70,100,'#3B82F6')],
  markers:[point('Palco','palco',100,45,'right'),point('Entrada','entrada',0,75,'left'),point('Bar','bar',53,75),point('Banheiros','banheiro',20,60),point('Posto médico','posto-medico',78,15),point('Saída','saida',95,100,'bottom')]
 },
 {
  slug:'underground',title:'SUBMUNDO 808 — Underground Festival',venue:'terraco',
  mapName:'Underground Festival · Duas pistas',offset:23,start:'20:00',end:'06:00',
  description:'Duas pistas, área VIP e bares temáticos para uma noite de música eletrônica.',
  djs:['LUNA BASS','RAVEN','KAYO 808','AMBER','DARK MIND','NØX'],
  areas:[place('Pista principal','pista',0,0,75,66,'#3B82F6'),place('Área VIP','vip',75,0,25,66,'#9747FF'),place('Pista alternativa','principal',0,66,100,34,'#FF456C')],
  markers:[point('Palco principal','palco',37,4),point('Palco alternativo','palco',45,79),point('Entrada','entrada',50,100,'bottom'),point('Banheiros','banheiro',90,53),point('Bar principal','bar',13,39),point('Bar VIP','bar',88,22),point('Food trucks','alimentacao',80,84),point('Saída','saida',100,93,'right')]
 }
];
export const SHOWCASE_EVENTS=EVENTS.map(e=>({slug:e.slug,name:e.title,dayOffset:e.offset,venue:e.venue,mapName:e.mapName}));
function saoPauloBaseDate(now){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
 const values=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
 return Date.UTC(values.year,values.month-1,values.day);
}
function dateAt(base,offset,time){
 const d=new Date(base+offset*86_400_000);
 return d.toISOString().slice(0,10)+'T'+time;
}
function buildLineup(event,base){
 const startHour=Number(event.start.slice(0,2));
 return event.djs.map((name,index)=>{
  const h=startHour+index;
  const hour=h%24,day=event.offset+Math.floor(h/24);
  const nextHour=(h+1)%24,nextDay=event.offset+Math.floor((h+1)/24);
  return {
   nome:name,instagram:'',
   inicio:dateAt(base,day,String(hour).padStart(2,'0')+':00'),
   fim:dateAt(base,nextDay,String(nextHour).padStart(2,'0')+':00')
  };
 });
}
export function ensureDemoShowcase(db,{now=Date.now(),baseEventId=null}={}){
 db.exec('CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const existing=db.prepare('SELECT value FROM app_settings WHERE key=?').get(SHOWCASE_KEY);
 if(existing)return {created:false,eventsAdded:0,venuesAdded:0,mapsAdded:0,itemsPerMenu:DEMO_PRODUCTS.length,eventIds:EVENTS.map(e=>makeId('event',e.slug))};
 const baseEvent=baseEventId?db.prepare('SELECT venue_id FROM events WHERE id=?').get(baseEventId):null;
 const baseVenueId=baseEvent?.venue_id||makeId('venue','original');
 const baseDate=saoPauloBaseDate(now);
 const venueIds={original:baseVenueId,terraco:makeId('venue','terraco'),armazem:makeId('venue','armazem')};
 db.exec('BEGIN');
 try{
  const venueStmt=db.prepare('INSERT INTO venues(id,name,address,city,created_at) VALUES(?,?,?,?,?)');
  let venuesAdded=0,eventsAdded=0,mapsAdded=0;
  if(!baseEvent&&!db.prepare('SELECT id FROM venues WHERE id=?').get(baseVenueId)){
   venueStmt.run(baseVenueId,'Espaço Submundo','Local a divulgar','São Paulo',now);venuesAdded++;
  }
  for(const v of VENUES){
   const id=venueIds[v.slug];
   if(!db.prepare('SELECT id FROM venues WHERE id=?').get(id)){
    venueStmt.run(id,v.name,v.address,v.city,now);venuesAdded++;
   }
  }
  const areaStmt=db.prepare('INSERT INTO map_areas(id,map_id,name,kind,x,y,width,height,color,icon,description) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  for(const e of EVENTS){
   const eventId=makeId('event',e.slug),mapId=makeId('map',e.slug);
   if(!db.prepare('SELECT id FROM venue_maps WHERE id=?').get(mapId)){
    db.prepare('INSERT INTO venue_maps(id,venue_id,name,created_at) VALUES(?,?,?,?)').run(mapId,venueIds[e.venue],e.mapName,now);
    for(let i=0;i<e.areas.length;i++){
     const area=e.areas[i];
     areaStmt.run(makeId('area',e.slug+'-'+i),mapId,area.name,area.kind,area.x,area.y,area.width,area.height,area.color,area.icon,'');
    }
    db.prepare('INSERT INTO map_markers(map_id,markers_json) VALUES(?,?)')
     .run(mapId,JSON.stringify(e.markers.map((m,i)=>({...m,id:makeId('marker',e.slug+'-'+i)}))));
    mapsAdded++;
   }
   if(!db.prepare('SELECT id FROM events WHERE id=?').get(eventId)){
    const finish=e.end<=e.start?e.offset+1:e.offset;
    db.prepare('INSERT INTO events(id,venue_id,name,description,starts_at,ends_at,site_url,tickets_url,instagram_url,lineup_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .run(eventId,venueIds[e.venue],e.title,e.description,dateAt(baseDate,e.offset,e.start),dateAt(baseDate,finish,e.end),'','','',JSON.stringify(buildLineup(e,baseDate)),now);
    eventsAdded++;
   }
   db.prepare('INSERT OR IGNORE INTO event_maps(event_id,map_id) VALUES(?,?)').run(eventId,mapId);
   const catalog=seedDemoProducts(db,eventId,now);
   if(eventsAdded>0&&catalog.productsLinked===DEMO_PRODUCTS.length){
    // Variação visual de preço por festa, sem alterar o catálogo global.
    const amount=EVENTS.indexOf(e)*100;
    if(amount)db.prepare('UPDATE event_products SET price_cents=(SELECT COALESCE(ep.price_cents,p.default_price_cents)+? FROM products p JOIN event_products ep ON ep.product_id=p.id WHERE ep.event_id=? AND p.id=event_products.product_id) WHERE event_id=?').run(amount,eventId,eventId);
   }
  }
  db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?)').run(SHOWCASE_KEY,JSON.stringify({createdAt:now,version:2}));
  db.exec('COMMIT');
  return {created:true,eventsAdded,venuesAdded,mapsAdded,itemsPerMenu:DEMO_PRODUCTS.length,eventIds:EVENTS.map(e=>makeId('event',e.slug))};
 }catch(error){db.exec('ROLLBACK');throw error;}
}
