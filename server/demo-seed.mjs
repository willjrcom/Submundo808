import {randomUUID} from 'node:crypto';
import {seedDemoProducts} from './demo-products.mjs';
import {DEMO_MARKERS,applyDemoCalibration} from './demo-geolocation.mjs';

export const DEMO_EVENT_NAME='SUBMUNDO 808 — Edição Demo';
export const DEMO_MAP_NAME='Pista principal — DEMO';
const DEMO_KEY='default_demo_event_id';

function dateForInput(d){
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
  +'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function futureLineup(now){
 const start=new Date(now+7*86400000);
 start.setHours(21,0,0,0);
 const slots=['DJ NØX','LUNA BASS','KAYO 808','VEXX','MAYA VOLT','DJ SUB 808'];
 return {
  start,
  lineup:slots.map((nome,i)=>({
   nome,instagram:'dj_demo_'+(i+1),
   inicio:dateForInput(new Date(start.getTime()+i*55*60000)),
   fim:dateForInput(new Date(start.getTime()+(i+1)*55*60000))
  }))
 };
}
// Chamada tanto na inicialização quanto pelo botão do administrador.
// Transacional, idempotente e sem substituir edições manuais dos registros.
// GPS só é gerado quando a própria pessoa fornecer a localização explicitamente.
export function ensureDemoData(db,{location=null,now=Date.now()}={}){
 db.exec('CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const saved=db.prepare('SELECT value FROM app_settings WHERE key=?').get(DEMO_KEY)?.value;
 const existing=(saved?db.prepare('SELECT id FROM events WHERE id=?').get(saved):null)
   ||db.prepare('SELECT id FROM events WHERE name=? ORDER BY created_at LIMIT 1').get(DEMO_EVENT_NAME);
 db.exec('BEGIN');
 try{
  if(existing){
   const products=seedDemoProducts(db,existing.id,now);
   db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(DEMO_KEY,existing.id);
   const map=db.prepare('SELECT vm.id FROM event_maps em JOIN venue_maps vm ON vm.id=em.map_id WHERE em.event_id=? ORDER BY CASE WHEN vm.name=? THEN 0 ELSE 1 END, vm.created_at LIMIT 1').get(existing.id,DEMO_MAP_NAME);
   const gps=map?applyDemoCalibration(db,map.id,location,now):{gpsStatus:'no-demo-map',markersRepositioned:false};
   db.exec('COMMIT');
   return {id:existing.id,created:false,...products,...gps};
  }
  const venueId=randomUUID(),mapId=randomUUID(),eventId=randomUUID();
  const {start,lineup}=futureLineup(now);
  db.prepare('INSERT INTO venues(id,name,address,city,created_at) VALUES(?,?,?,?,?)')
   .run(venueId,'Espaço Submundo — DEMO','Endereço fictício para testes','São Paulo',now);
  db.prepare('INSERT INTO venue_maps(id,venue_id,name,created_at) VALUES(?,?,?,?)')
   .run(mapId,venueId,DEMO_MAP_NAME,now);
  db.prepare('INSERT INTO map_areas(id,map_id,name,kind,x,y,width,height) VALUES(?,?,?,?,?,?,?,?)')
   .run(randomUUID(),mapId,'Pista principal','principal',8,10,75,75);
  db.prepare('INSERT INTO map_markers(map_id,markers_json) VALUES(?,?)')
   .run(mapId,JSON.stringify(DEMO_MARKERS.map(marker=>({...marker,id:randomUUID()}))));
  db.prepare('INSERT INTO events(id,venue_id,name,description,starts_at,ends_at,site_url,tickets_url,instagram_url,lineup_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
   .run(eventId,venueId,DEMO_EVENT_NAME,
    'Evento demonstrativo completo para testar a experiência do participante. DJs, local e horários são fictícios.',
    dateForInput(start),dateForInput(new Date(start.getTime()+6*55*60000)),
    '','','',JSON.stringify(lineup),now);
  db.prepare('INSERT INTO event_maps(event_id,map_id) VALUES(?,?)').run(eventId,mapId);
  db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?)').run(DEMO_KEY,eventId);
  const products=seedDemoProducts(db,eventId,now);
  const gps=applyDemoCalibration(db,mapId,location,now);
  db.exec('COMMIT');
  return {id:eventId,venue_id:venueId,map_id:mapId,created:true,...products,...gps};
 }catch(error){
  db.exec('ROLLBACK');
  throw error;
 }
}
