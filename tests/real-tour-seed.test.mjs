import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureRealTourDemo,REAL_808_TOUR} from '../server/real-tour-seed.mjs';
import {TOUR_DEMO_MENU,TOUR_DEMO_MAP_NAME} from '../server/real-tour-assets.mjs';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE venues(id TEXT PRIMARY KEY,name TEXT NOT NULL,address TEXT DEFAULT '',city TEXT DEFAULT '',created_at INTEGER NOT NULL);
 CREATE TABLE events(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT DEFAULT '',starts_at TEXT DEFAULT '',ends_at TEXT DEFAULT '',site_url TEXT DEFAULT '',tickets_url TEXT DEFAULT '',instagram_url TEXT DEFAULT '',lineup_json TEXT DEFAULT '[]',created_at INTEGER NOT NULL,meaple_event_id TEXT NOT NULL DEFAULT '',doors_at TEXT NOT NULL DEFAULT '',is_published INTEGER NOT NULL DEFAULT 0,location_sharing_enabled INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE event_maps(event_id TEXT NOT NULL,map_id TEXT NOT NULL,PRIMARY KEY(event_id,map_id));
 CREATE TABLE venue_maps(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE map_areas(id TEXT PRIMARY KEY,map_id TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,color TEXT,icon TEXT,description TEXT);
 CREATE TABLE map_markers(map_id TEXT PRIMARY KEY,markers_json TEXT NOT NULL DEFAULT '[]');
 CREATE TABLE products(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',category TEXT NOT NULL,default_price_cents INTEGER NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE event_products(event_id TEXT NOT NULL,product_id TEXT NOT NULL,price_cents INTEGER,PRIMARY KEY(event_id,product_id));
 CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 `);
 return db;
}
test('agenda da Meaple inclui oito eventos reais, endereços e datas confirmados',()=>{
 assert.equal(REAL_808_TOUR.length,8);
 assert.deepEqual(REAL_808_TOUR.map(e=>e.date),['2026-10-31','2026-11-06','2026-11-07','2026-11-14','2026-11-19','2026-11-21','2026-11-28','2026-12-12']);
 for(const e of REAL_808_TOUR){assert.ok(e.url.startsWith('https://meaple.com.br/808/'));assert.ok(e.address.includes('Brasil'));assert.ok(e.venue);assert.ok(e.city);assert.match(e.start,/^\d\d:\d\d$/);assert.match(e.end,/^\d\d:\d\d$/);}
});
test('AUTO_SEED_DEMO gera agenda oficial e assets claramente demonstrativos sem inventar horários dos DJs',()=>{
 const db=fixture();try{
  const first=ensureRealTourDemo(db);
  assert.equal(first.eventsAdded,8);assert.equal(first.venuesAdded,8);
  assert.equal(first.mapsAdded,8);
  assert.equal(first.productsLinked,8*TOUR_DEMO_MENU.length);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,8);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_maps').get().n,8);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM venue_maps WHERE name=?').get(TOUR_DEMO_MAP_NAME).n,8);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM map_markers').get().n,8);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM map_areas').get().n,8*3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_products').get().n,8*TOUR_DEMO_MENU.length);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get().n,TOUR_DEMO_MENU.length);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products WHERE description LIKE ?').get('%DEMONSTRAÇÃO%').n,TOUR_DEMO_MENU.length);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM map_areas WHERE description LIKE ?').get('%DEMONSTRAÇÃO%').n,8*3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events WHERE is_published=1 AND location_sharing_enabled=0').get().n,8);
  const events=db.prepare('SELECT * FROM events ORDER BY starts_at').all();
  assert.equal(events[0].starts_at,'2026-10-31T20:00');assert.equal(events[0].ends_at,'2026-11-01T06:00');
  assert.equal(events.at(-1).starts_at,'2026-12-12T16:00');assert.equal(events.at(-1).ends_at,'2026-12-13T05:00');
  const lineup=JSON.parse(events.find(e=>e.name.includes('SOROCABA')).lineup_json);
  assert.ok(lineup.some(dj=>dj.nome==='KENAN E KEL'));
  assert.ok(lineup.every(dj=>!('inicio' in dj)&&!('fim' in dj)));
  const second=ensureRealTourDemo(db);
  assert.equal(second.eventsAdded,0);assert.equal(second.eventsExisting,8);
  assert.equal(second.mapsAdded,0);assert.equal(second.productsLinked,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,8);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_products').get().n,8*TOUR_DEMO_MENU.length);
 }finally{db.close();}
});
test('reinicialização não sobrescreve edições nem recria evento removido manualmente com mesmo link',()=>{
 const db=fixture();try{
  ensureRealTourDemo(db);
  const old=db.prepare('SELECT id,meaple_event_id,tickets_url FROM events ORDER BY starts_at LIMIT 1').get();
  db.prepare('UPDATE events SET name=?,description=?,starts_at=?,is_published=? WHERE id=?').run('Nome personalizado','Descrição própria','2026-10-31T21:30',0,old.id);
  const next=ensureRealTourDemo(db);
  assert.equal(next.eventsAdded,0);
  const current=db.prepare('SELECT * FROM events WHERE id=?').get(old.id);
  assert.equal(current.name,'Nome personalizado');assert.equal(current.starts_at,'2026-10-31T21:30');assert.equal(current.is_published,0);
  db.prepare('DELETE FROM events WHERE id=?').run(old.id);
  db.prepare('INSERT INTO events(id,venue_id,name,tickets_url,meaple_event_id,created_at) VALUES(?,?,?,?,?,?)').run('manual',REAL_808_TOUR[0].id,'Mesmo evento',old.tickets_url,old.meaple_event_id,Date.now());
  const third=ensureRealTourDemo(db);
  assert.equal(third.eventsAdded,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,8);
 }finally{db.close();}
});


test('o seed incrementa os mapas e cardápios de eventos 808 já existentes sem alterar a programação',()=>{
 const db=fixture();
 try{
  ensureRealTourDemo(db);
  const sorocaba=db.prepare('SELECT id FROM events WHERE name LIKE ?').get('%SOROCABA%');
  const eventId=sorocaba.id;
  const mapId=db.prepare('SELECT map_id FROM event_maps WHERE event_id=?').get(eventId).map_id;
  db.prepare('DELETE FROM event_maps WHERE event_id=?').run(eventId);
  db.prepare('DELETE FROM venue_maps WHERE id=?').run(mapId);
  db.prepare('DELETE FROM map_markers WHERE map_id=?').run(mapId);
  db.prepare('DELETE FROM map_areas WHERE map_id=?').run(mapId);
  db.prepare('DELETE FROM event_products WHERE event_id=?').run(eventId);
  db.prepare('DELETE FROM app_settings WHERE key=?').run('meaple808-demo-assets-v1:'+eventId);
  db.prepare('UPDATE events SET description=? WHERE id=?').run('Minha descrição personalizada',eventId);
  const seeded=ensureRealTourDemo(db);
  assert.equal(seeded.eventsAdded,0);
  assert.equal(seeded.mapsAdded,1);
  assert.equal(seeded.productsLinked,TOUR_DEMO_MENU.length);
  assert.equal(db.prepare('SELECT description FROM events WHERE id=?').get(eventId).description,'Minha descrição personalizada');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_maps WHERE event_id=?').get(eventId).n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_products WHERE event_id=?').get(eventId).n,TOUR_DEMO_MENU.length);
 }finally{db.close();}
});
test('assets manuais do evento não são substituídos pelo seed demonstrativo',()=>{
 const db=fixture();
 try{
  const e=REAL_808_TOUR[0];
  const eventId='meaple-808-event-'+e.id,venueId='meaple-808-venue-'+e.id;
  db.prepare('INSERT INTO venues(id,name,address,city,created_at) VALUES(?,?,?,?,?)').run(venueId,e.venue,e.address,e.city,Date.now());
  db.prepare('INSERT INTO events(id,venue_id,name,tickets_url,created_at) VALUES(?,?,?,?,?)').run(eventId,venueId,e.name,e.url,Date.now());
  db.prepare('INSERT INTO venue_maps(id,venue_id,name,created_at) VALUES(?,?,?,?)').run('manual-map',venueId,'Mapa ajustado',Date.now());
  db.prepare('INSERT INTO event_maps(event_id,map_id) VALUES(?,?)').run(eventId,'manual-map');
  db.prepare('INSERT INTO products(id,name,category,default_price_cents,created_at) VALUES(?,?,?,?,?)').run('manual-item','Produto próprio','Bebidas',1200,Date.now());
  db.prepare('INSERT INTO event_products(event_id,product_id) VALUES(?,?)').run(eventId,'manual-item');
  ensureRealTourDemo(db);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_maps WHERE event_id=?').get(eventId).n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_products WHERE event_id=?').get(eventId).n,1);
  assert.equal(db.prepare('SELECT name FROM venue_maps WHERE id=?').get('manual-map').name,'Mapa ajustado');
  assert.equal(db.prepare('SELECT name FROM products WHERE id=?').get('manual-item').name,'Produto próprio');
 }finally{db.close();}
});
