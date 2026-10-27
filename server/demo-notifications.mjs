// Modelos de notificações exclusivamente demonstrativos. Nunca são disparados aqui.
// A chave em app_settings impede recriação após exclusão ou personalização pelo admin.
const SEED_KEY='demo_notification_templates_v1';
const TEMPLATES=[
 {suffix:'promo',kind:'promo',title:'Bebida em dobro 🍹',body:'Exemplo: aproveite a promoção de bebida em dobro nos bares participantes.',target:'point'},
 {suffix:'info',kind:'info',title:'Informações do evento 📍',body:'Confira no mapa a localização da entrada, dos banheiros e dos pontos de apoio.',target:'map'},
 {suffix:'lineup',kind:'lineup',title:'Confira a programação 🎧',body:'Veja os DJs e os horários das apresentações na programação do evento.',target:'lineup'},
 {suffix:'survey',kind:'survey',title:'Conte como foi sua experiência ⭐',body:'Depois do evento, compartilhe sua avaliação e ajude a melhorar a próxima edição.',target:'survey'}
];
function getDemoBarPoint(db,eventId){
 const rows=db.prepare('SELECT mm.markers_json FROM event_maps em JOIN map_markers mm ON mm.map_id=em.map_id WHERE em.event_id=?').all(eventId);
 for(const row of rows){
  try{const marker=JSON.parse(row.markers_json||'[]').find(p=>p.name==='Bar principal'&&p.type==='bar');if(marker?.id)return marker.id;}catch{}
 }
 return '';
}
export function ensureDemoNotifications(db,{eventId}={}){
 db.exec('CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const existingSeed=db.prepare('SELECT 1 FROM app_settings WHERE key=?').get(SEED_KEY);
 if(existingSeed){
  const model=db.prepare("SELECT n.id,n.event_id FROM notifications n WHERE n.id=? AND n.status='draft' AND n.target_kind='menu' AND n.target_id='' AND n.title=? AND n.body=?").get('demo-notification-template-promo',TEMPLATES[0].title,TEMPLATES[0].body);
  if(!model)return {created:false,count:0};
  const pointId=getDemoBarPoint(db,model.event_id);
  if(pointId){db.prepare("UPDATE notifications SET target_kind='point',target_id=? WHERE id=? AND status='draft' AND target_kind='menu'").run(pointId,model.id);return {created:false,count:0,updated:1};}
  return {created:false,count:0};
 }
 const event=db.prepare('SELECT id FROM events WHERE id=?').get('poc-v2-event-neon')
   ||(eventId?db.prepare('SELECT id FROM events WHERE id=?').get(eventId):null);
 if(!event)return {created:false,count:0,reason:'no-demo-event'};
 const promoPointId=getDemoBarPoint(db,event.id);
 const insert=db.prepare("INSERT OR IGNORE INTO notifications(id,event_id,title,body,kind,target_kind,target_id,audience,status,scheduled_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
 let count=0;
 db.exec('BEGIN');
 try{
  for(const [index,item] of TEMPLATES.entries()){
   count+=insert.run('demo-notification-template-'+item.suffix,event.id,item.title,item.body,item.kind,item.target==='point'&&!promoPointId?'map':item.target,item.target==='point'?promoPointId:'','event','draft',null,'system',Date.now()+index).changes;
  }
  db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?)').run(SEED_KEY,JSON.stringify({createdAt:Date.now(),count}));
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 return {created:true,count};
}
