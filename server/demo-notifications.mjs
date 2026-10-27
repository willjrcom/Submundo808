// Modelos de notificações exclusivamente demonstrativos. Nunca são disparados aqui.
// A chave em app_settings impede recriação após exclusão ou personalização pelo admin.
const SEED_KEY='demo_notification_templates_v1';
const TEMPLATES=[
 {suffix:'promo',kind:'promo',title:'Bebida em dobro 🍹',body:'Exemplo: aproveite a promoção de bebida em dobro nos bares participantes.',target:'menu'},
 {suffix:'info',kind:'info',title:'Informações do evento 📍',body:'Confira no mapa a localização da entrada, dos banheiros e dos pontos de apoio.',target:'map'},
 {suffix:'lineup',kind:'lineup',title:'Confira a programação 🎧',body:'Veja os DJs e os horários das apresentações na programação do evento.',target:'lineup'},
 {suffix:'survey',kind:'survey',title:'Conte como foi sua experiência ⭐',body:'Depois do evento, compartilhe sua avaliação e ajude a melhorar a próxima edição.',target:'survey'}
];
export function ensureDemoNotifications(db,{eventId}={}){
 db.exec('CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 if(db.prepare('SELECT 1 FROM app_settings WHERE key=?').get(SEED_KEY))return {created:false,count:0};
 const event=db.prepare('SELECT id FROM events WHERE id=?').get('poc-v2-event-neon')
   ||(eventId?db.prepare('SELECT id FROM events WHERE id=?').get(eventId):null);
 if(!event)return {created:false,count:0,reason:'no-demo-event'};
 const insert=db.prepare("INSERT OR IGNORE INTO notifications(id,event_id,title,body,kind,target_kind,target_id,audience,status,scheduled_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
 let count=0;
 db.exec('BEGIN');
 try{
  for(const [index,item] of TEMPLATES.entries()){
   count+=insert.run('demo-notification-template-'+item.suffix,event.id,item.title,item.body,item.kind,item.target,'','event','draft',null,'system',Date.now()+index).changes;
  }
  db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?)').run(SEED_KEY,JSON.stringify({createdAt:Date.now(),count}));
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 return {created:true,count};
}
