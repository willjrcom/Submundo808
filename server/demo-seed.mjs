import {randomUUID} from 'node:crypto';
import {seedDemoProducts} from './demo-products.mjs';
import {DEMO_MARKERS,applyDemoCalibration} from './demo-geolocation.mjs';
import {insertDefaultMapAreas} from './default-map-layout.mjs';

export const DEMO_EVENT_NAME='SUBMUNDO 808 — Edição Demo';
export const DEMO_MAP_NAME='Pista principal — DEMO';
const DEMO_KEY='default_demo_event_id';

// Migra somente mapas automáticos NÃO editados: layouts personalizados,
// marcadores extras e qualquer calibração manual ficam preservados.
const PREVIOUS_POINT_LAYOUTS=[
 {'Bar principal':[40,37.5],'Banheiros':[60,37.5],'Palco':[40,62.5],'Entrada':[60,62.5]},
 {'Bar principal':[20,25],'Banheiros':[78,30],'Palco':[45,12],'Entrada':[45,90]}
];
export function updateUntouchedDemoLayout(db,mapId){
 const row=db.prepare('SELECT markers_json FROM map_markers WHERE map_id=?').get(mapId);
 if(!row)return false;
 let markers;
 try{markers=JSON.parse(row.markers_json);}catch{return false;}
 if(!Array.isArray(markers)||markers.length!==4)return false;
 const matches=PREVIOUS_POINT_LAYOUTS.some(layout=>markers.every(m=>{
  const coords=layout[m.name];
  return coords&&m.x===coords[0]&&m.y===coords[1]&&
   m.type===(m.name==='Banheiros'?'banheiro':m.name==='Palco'?'palco':m.name==='Entrada'?'entrada':'bar');
 }));
 if(!matches||new Set(markers.map(m=>m.name)).size!==4)return false;
 const areas=db.prepare('SELECT id,name,x,y,width,height,gps_json FROM map_areas WHERE map_id=?').all(mapId);
 if(areas.some(a=>{
  const gps=JSON.parse(a.gps_json||'{}');
  return gps.mode==='manual'||['tl','tr','bl','br'].some(k=>gps[k]&&gps.mode!=='demo-auto');
 }))return false;
 const updated=DEMO_MARKERS.map(template=>{
  const old=markers.find(marker=>marker.name===template.name);
  return old?{...old,x:template.x,y:template.y,shape:'square',size:42}:{...template,id:randomUUID()};
 });
 db.prepare('UPDATE map_markers SET markers_json=? WHERE map_id=?').run(JSON.stringify(updated),mapId);
 // Ajusta apenas a sala original e intocada para a metade superior da planta.
 const defaultArea=areas.find(a=>a.name==='Pista principal'&&a.x===8&&a.y===10&&a.width===75&&a.height===75);
 if(defaultArea)db.prepare('UPDATE map_areas SET x=0,y=0,width=100,height=55 WHERE id=?').run(defaultArea.id);
 return true;
}

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
   nome,...demoSocial(nome),
   inicio:dateForInput(new Date(start.getTime()+i*55*60000)),
   fim:dateForInput(new Date(start.getTime()+(i+1)*55*60000))
  }))
 };
}
// Chamada tanto na inicialização quanto pelo botão do administrador.
// Transacional, idempotente e sem substituir edições manuais dos registros.
// GPS só é gerado quando a própria pessoa fornecer a localização explicitamente.
function demoSocial(name){return {instagram:'https://www.instagram.com/explore/',spotify:'https://open.spotify.com/search/'+encodeURIComponent(name)};}
function updateDemoLineup(db,id){
 const row=db.prepare('SELECT lineup_json FROM events WHERE id=?').get(id);if(!row)return false;
 let items;try{items=JSON.parse(row.lineup_json||'[]');}catch{return false;}
 if(!Array.isArray(items))return false;
 let changed=false;
 for(const dj of items){if(!dj?.nome)continue;const links=demoSocial(dj.nome);if(!dj.spotify){dj.spotify=links.spotify;changed=true;}if(!dj.instagram||/^dj_demo_\d+$/.test(dj.instagram)){dj.instagram=links.instagram;changed=true;}}
 if(changed)db.prepare('UPDATE events SET lineup_json=? WHERE id=?').run(JSON.stringify(items),id);
 return changed;
}
export function ensureDemoData(db,{location=null,now=Date.now()}={}){
 db.exec('CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const saved=db.prepare('SELECT value FROM app_settings WHERE key=?').get(DEMO_KEY)?.value;
 const existing=(saved?db.prepare('SELECT id FROM events WHERE id=?').get(saved):null)
   ||db.prepare('SELECT id FROM events WHERE name=? ORDER BY created_at LIMIT 1').get(DEMO_EVENT_NAME);
 db.exec('BEGIN');
 try{
  if(existing){
   const products=seedDemoProducts(db,existing.id,now);
   updateDemoLineup(db,existing.id);
   db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(DEMO_KEY,existing.id);
   const map=db.prepare('SELECT vm.id FROM event_maps em JOIN venue_maps vm ON vm.id=em.map_id WHERE em.event_id=? ORDER BY CASE WHEN vm.name=? THEN 0 ELSE 1 END, vm.created_at LIMIT 1').get(existing.id,DEMO_MAP_NAME);
   const layoutUpdated=map?updateUntouchedDemoLayout(db,map.id):false;
   const gps=map?applyDemoCalibration(db,map.id,location,now):{gpsStatus:'no-demo-map',markersRepositioned:false};
   db.exec('COMMIT');
   return {id:existing.id,created:false,layoutUpdated,...products,...gps};
  }
  const venueId=randomUUID(),mapId=randomUUID(),eventId=randomUUID();
  const {start,lineup}=futureLineup(now);
  db.prepare('INSERT INTO venues(id,name,address,city,created_at) VALUES(?,?,?,?,?)')
   .run(venueId,'Espaço Submundo — DEMO','Endereço fictício para testes','São Paulo',now);
  db.prepare('INSERT INTO venue_maps(id,venue_id,name,created_at) VALUES(?,?,?,?)')
   .run(mapId,venueId,DEMO_MAP_NAME,now);
  insertDefaultMapAreas(db,mapId,randomUUID);
  db.prepare('INSERT INTO map_markers(map_id,markers_json) VALUES(?,?)')
   .run(mapId,JSON.stringify(DEMO_MARKERS.map(marker=>({...marker,id:randomUUID()}))));
  db.prepare('INSERT INTO events(id,venue_id,name,description,starts_at,ends_at,site_url,tickets_url,instagram_url,lineup_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
   .run(eventId,venueId,DEMO_EVENT_NAME,
    'Evento demonstrativo completo para testar a experiência do participante. DJs, local e horários são fictícios.',
    dateForInput(start),dateForInput(new Date(start.getTime()+6*55*60000)),
    '','','',JSON.stringify(lineup),now);
  db.prepare('INSERT INTO event_maps(event_id,map_id) VALUES(?,?)').run(eventId,mapId);
  db.prepare('UPDATE events SET is_published=1 WHERE id=?').run(eventId);
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
