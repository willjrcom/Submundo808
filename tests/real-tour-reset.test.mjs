import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initializeRealTourDemo,REAL_TOUR_RESET_KEY} from '../server/real-tour-reset.mjs';
import {ensureSocialSchema} from '../server/social.mjs';
import {TOUR_DEMO_MENU} from '../server/real-tour-assets.mjs';

const prefs={minimum_age:18,entry_rules:'Regras padrão',accepted_documents:'RG',cancellation_policy:'7 dias'};
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`
 CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL);
 CREATE TABLE friendships(user_a TEXT NOT NULL,user_b TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE friend_requests(id TEXT PRIMARY KEY,requester_id TEXT NOT NULL,recipient_id TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE push_subscriptions(user_id TEXT NOT NULL,endpoint TEXT NOT NULL PRIMARY KEY,subscription_json TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE notifications(id TEXT PRIMARY KEY,event_id TEXT,title TEXT,body TEXT,kind TEXT,target_kind TEXT,target_id TEXT,audience TEXT,status TEXT,scheduled_at INTEGER,created_by TEXT,created_at INTEGER,sent_at INTEGER);
 CREATE TABLE notification_receipts(notification_id TEXT NOT NULL,user_id TEXT NOT NULL,read_at INTEGER);
 CREATE TABLE notification_push_queue(notification_id TEXT,user_id TEXT,endpoint TEXT,status TEXT);
 CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE event_general_settings(id INTEGER PRIMARY KEY,minimum_age INTEGER,entry_rules TEXT,accepted_documents TEXT,cancellation_policy TEXT);
 CREATE TABLE venues(id TEXT PRIMARY KEY,name TEXT NOT NULL,address TEXT,city TEXT,created_at INTEGER NOT NULL);
 CREATE TABLE venue_maps(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE map_areas(id TEXT PRIMARY KEY,map_id TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,color TEXT,icon TEXT,description TEXT);
 CREATE TABLE map_markers(map_id TEXT PRIMARY KEY,markers_json TEXT NOT NULL);
 CREATE TABLE events(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT,starts_at TEXT,ends_at TEXT,site_url TEXT,tickets_url TEXT,instagram_url TEXT,lineup_json TEXT DEFAULT '[]',created_at INTEGER NOT NULL,meaple_event_id TEXT DEFAULT '',doors_at TEXT DEFAULT '',is_published INTEGER NOT NULL DEFAULT 1,location_sharing_enabled INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE event_maps(event_id TEXT NOT NULL,map_id TEXT NOT NULL,PRIMARY KEY(event_id,map_id));
 CREATE TABLE products(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT,category TEXT,default_price_cents INTEGER NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE event_products(event_id TEXT NOT NULL,product_id TEXT NOT NULL,price_cents INTEGER,PRIMARY KEY(event_id,product_id));
 CREATE TABLE event_participants(event_id TEXT,user_id TEXT,first_selected_at INTEGER,last_selected_at INTEGER);
 CREATE TABLE event_reviews(event_id TEXT,user_id TEXT,rating INTEGER,tags_json TEXT,comment TEXT,created_at INTEGER,updated_at INTEGER);
 CREATE TABLE location_preferences(user_id TEXT PRIMARY KEY,gps_enabled INTEGER,share_enabled INTEGER,share_expires_at INTEGER,share_event_id TEXT,share_with_groups INTEGER,updated_at INTEGER,analytics_enabled INTEGER NOT NULL DEFAULT 0,analytics_event_id TEXT);
 CREATE TABLE live_locations(user_id TEXT PRIMARY KEY,lat REAL,lng REAL,accuracy REAL,updated_at INTEGER);
 CREATE TABLE event_crowd_snapshots(event_id TEXT,map_id TEXT,area_id TEXT,bucket_at INTEGER,people_count INTEGER);

 `);
 ensureSocialSchema(db);
 db.prepare('INSERT INTO users VALUES(?,?)').run('a','Ana');
 db.prepare('INSERT INTO users VALUES(?,?)').run('b','Bruno');
 db.prepare('INSERT INTO friendships VALUES(?,?,?)').run('a','b',1);
 db.prepare('INSERT INTO friend_requests(id,requester_id,recipient_id,status,created_at) VALUES(?,?,?,?,?)').run('req','a','b','accepted',1);
 db.prepare('INSERT INTO friend_groups(id,owner_id,name,invite_hash,created_at) VALUES(?,?,?,?,?)').run('group','a','Meu grupo','token-hash',1);
 db.prepare('INSERT INTO friend_group_members(group_id,user_id,role,joined_at) VALUES(?,?,?,?)').run('group','a','owner',1);
 db.prepare('INSERT INTO group_alerts(id,group_id,sender_id,code,event_id,created_at) VALUES(?,?,?,?,?,?)').run('alert','group','a','palco','old-event',1);
 db.prepare('INSERT INTO push_subscriptions VALUES(?,?,?,?)').run('a','https://push.invalid/test','{}',1);
 db.prepare('INSERT INTO notification_push_queue VALUES(?,?,?,?)').run('old-note','a','https://push.invalid/test','accepted');
 db.prepare('INSERT INTO notifications(id,event_id,title,body,kind,target_kind,target_id,audience,status,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('old-note','old-event','Antiga','Mensagem','info','event','old-event','event','sent','a',1);
 db.prepare('INSERT INTO notifications(id,event_id,title,body,kind,target_kind,target_id,audience,status,scheduled_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('old-scheduled','old-event','Agendada','Mensagem','info','event','old-event','event','scheduled',Date.now()+30000,'a',1);
 db.prepare('INSERT INTO notification_receipts VALUES(?,?,?)').run('old-note','a',1);
 db.prepare('INSERT INTO app_settings VALUES(?,?)').run('unrelated-setting','keep');
 db.prepare('INSERT INTO app_settings VALUES(?,?)').run('default_demo_event_id','old-event');
 db.prepare('INSERT INTO event_general_settings VALUES(1,?,?,?,?,?)'.replace('?,?,?,?,?','?,?,?,?')).run(21,'Velhas regras','CNH','Sem devolução');
 db.prepare('INSERT INTO venues VALUES(?,?,?,?,?)').run('old-venue','Antigo espaço','Rua antiga','Cidade',1);
 db.prepare('INSERT INTO venue_maps VALUES(?,?,?,?)').run('old-map','old-venue','Mapa antigo',1);
 db.prepare('INSERT INTO map_areas(id,map_id,name,kind,x,y,width,height) VALUES(?,?,?,?,?,?,?,?)').run('old-area','old-map','Pista','pista',0,0,100,100);
 db.prepare('INSERT INTO map_markers VALUES(?,?)').run('old-map','[]');
 db.prepare('INSERT INTO events(id,venue_id,name,created_at) VALUES(?,?,?,?)').run('old-event','old-venue','Festa antiga',1);
 db.prepare('INSERT INTO event_maps VALUES(?,?)').run('old-event','old-map');
 db.prepare('INSERT INTO products(id,name,category,default_price_cents,created_at) VALUES(?,?,?,?,?)').run('old-product','Produto antigo','Bebidas',300,1);
 db.prepare('INSERT INTO event_products VALUES(?,?,?)').run('old-event','old-product',300);
 db.prepare('INSERT INTO event_participants VALUES(?,?,?,?)').run('old-event','a',1,1);
 db.prepare('INSERT INTO event_reviews VALUES(?,?,?,?,?,?,?)').run('old-event','a',5,'[]','Foi legal',1,1);
 db.prepare('INSERT INTO location_preferences(user_id,gps_enabled,share_enabled,share_expires_at,share_event_id,share_with_groups,updated_at,analytics_enabled,analytics_event_id) VALUES(?,?,?,?,?,?,?,?,?)').run('a',1,1,Date.now()+30000,'old-event',1,1,1,'old-event');
 db.prepare('INSERT INTO live_locations VALUES(?,?,?,?,?)').run('a',-23,-47,10,1);
 db.prepare('INSERT INTO event_crowd_snapshots VALUES(?,?,?,?,?)').run('old-event','old-map','old-area',Date.now(),8);
 return db;
}
const count=(db,table)=>db.prepare('SELECT COUNT(*) n FROM '+table).get().n;
test('AUTO_SEED_DEMO limpa o catálogo completo uma vez e recria 8 eventos com mapa e cardápio',()=>{
 const db=fixture();try{
  const result=initializeRealTourDemo(db,{defaultEventPreferences:prefs});
  assert.equal(result.resetPerformed,true);
  assert.equal(result.removed.events,1);
  assert.equal(result.removed.venues,1);
  assert.equal(result.eventsAdded,8);
  assert.equal(count(db,'events'),8);
  assert.equal(count(db,'venues'),8);
  assert.equal(count(db,'venue_maps'),8);
  assert.equal(count(db,'event_maps'),8);
  assert.equal(count(db,'map_markers'),8);
  assert.equal(count(db,'map_areas'),24);
  assert.equal(count(db,'products'),TOUR_DEMO_MENU.length);
  assert.equal(count(db,'event_products'),8*TOUR_DEMO_MENU.length);
  assert.equal(count(db,'event_reviews'),0);
  assert.equal(count(db,'event_crowd_snapshots'),0);
  assert.equal(count(db,'event_participants'),0);
  assert.equal(db.prepare('SELECT 1 FROM events WHERE id=?').get('old-event'),undefined);
  assert.equal(db.prepare('SELECT value FROM app_settings WHERE key=?').get('default_demo_event_id'),undefined);
  assert.equal(db.prepare('SELECT value FROM app_settings WHERE key=?').get('unrelated-setting').value,'keep');
  assert.ok(db.prepare('SELECT value FROM app_settings WHERE key=?').get(REAL_TOUR_RESET_KEY));
  assert.equal(db.prepare('SELECT minimum_age,entry_rules FROM event_general_settings').get().minimum_age,18);
 }finally{db.close();}
});
test('usuários, amigos, grupos, notificações, recibos e push são preservados',()=>{
 const db=fixture();try{
  initializeRealTourDemo(db,{defaultEventPreferences:prefs});
  for(const [table,expected] of Object.entries({users:2,friendships:1,friend_requests:1,friend_groups:1,friend_group_members:1,group_alerts:1,notifications:2,notification_receipts:1,push_subscriptions:1,notification_push_queue:1})){
   assert.equal(count(db,table),expected,table);
  }
  assert.equal(db.prepare('SELECT status FROM notifications WHERE id=?').get('old-note').status,'sent');
  assert.equal(db.prepare('SELECT status FROM notifications WHERE id=?').get('old-scheduled').status,'cancelled');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM live_locations').get().n,0);
  assert.equal(db.prepare('SELECT share_enabled FROM location_preferences WHERE user_id=?').get('a').share_enabled,0);
 }finally{db.close();}
});
test('reiniciar com AUTO_SEED_DEMO ainda ativo não exclui novos eventos nem mudanças manuais',()=>{
 const db=fixture();try{
  initializeRealTourDemo(db,{defaultEventPreferences:prefs});
  db.prepare('INSERT INTO events(id,venue_id,name,created_at) VALUES(?,?,?,?)').run('custom','meaple-808-venue-brasilia-2026-10-31','Evento manual',1);
  db.prepare('UPDATE events SET name=? WHERE id=?').run('Nova descrição','meaple-808-event-brasilia-2026-10-31');
  const next=initializeRealTourDemo(db,{defaultEventPreferences:prefs});
  assert.equal(next.resetPerformed,false);
  assert.equal(next.eventsAdded,0);
  assert.equal(count(db,'events'),9);
  assert.equal(db.prepare('SELECT name FROM events WHERE id=?').get('custom').name,'Evento manual');
  assert.equal(db.prepare('SELECT name FROM events WHERE id=?').get('meaple-808-event-brasilia-2026-10-31').name,'Nova descrição');
 }finally{db.close();}
});
test('falha no seed desfaz a limpeza e preserva o banco original',()=>{
 const db=fixture();try{
  db.exec(`CREATE TRIGGER reject_tour BEFORE INSERT ON events WHEN NEW.id LIKE 'meaple-808-event-%' BEGIN SELECT RAISE(ABORT,'seed rejected'); END;`);
  assert.throws(()=>initializeRealTourDemo(db,{defaultEventPreferences:prefs}),/seed rejected/);
  assert.equal(count(db,'events'),1);
  assert.equal(count(db,'venues'),1);
  assert.equal(count(db,'products'),1);
  assert.equal(count(db,'friend_groups'),1);
  assert.equal(count(db,'notifications'),2);
  assert.equal(db.prepare('SELECT 1 FROM app_settings WHERE key=?').get(REAL_TOUR_RESET_KEY),undefined);
 }finally{db.close();}
});
