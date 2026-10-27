import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureRealTourDemo,REAL_808_TOUR} from '../server/real-tour-seed.mjs';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE venues(id TEXT PRIMARY KEY,name TEXT NOT NULL,address TEXT DEFAULT '',city TEXT DEFAULT '',created_at INTEGER NOT NULL);
 CREATE TABLE events(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT DEFAULT '',starts_at TEXT DEFAULT '',ends_at TEXT DEFAULT '',site_url TEXT DEFAULT '',tickets_url TEXT DEFAULT '',instagram_url TEXT DEFAULT '',lineup_json TEXT DEFAULT '[]',created_at INTEGER NOT NULL,meaple_event_id TEXT NOT NULL DEFAULT '',doors_at TEXT NOT NULL DEFAULT '',is_published INTEGER NOT NULL DEFAULT 0,location_sharing_enabled INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE event_maps(event_id TEXT NOT NULL,map_id TEXT NOT NULL,PRIMARY KEY(event_id,map_id));`);
 return db;
}
test('agenda da Meaple inclui oito eventos reais, endereços e datas confirmados',()=>{
 assert.equal(REAL_808_TOUR.length,8);
 assert.deepEqual(REAL_808_TOUR.map(e=>e.date),['2026-10-31','2026-11-06','2026-11-07','2026-11-14','2026-11-19','2026-11-21','2026-11-28','2026-12-12']);
 for(const e of REAL_808_TOUR){assert.ok(e.url.startsWith('https://meaple.com.br/808/'));assert.ok(e.address.includes('Brasil'));assert.ok(e.venue);assert.ok(e.city);assert.match(e.start,/^\d\d:\d\d$/);assert.match(e.end,/^\d\d:\d\d$/);}
});
test('AUTO_SEED_DEMO gera agenda oficial idempotente e jamais inventa mapas nem horas individuais dos DJs',()=>{
 const db=fixture();try{
  const first=ensureRealTourDemo(db);
  assert.equal(first.eventsAdded,8);assert.equal(first.venuesAdded,8);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,8);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_maps').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events WHERE is_published=1 AND location_sharing_enabled=0').get().n,8);
  const events=db.prepare('SELECT * FROM events ORDER BY starts_at').all();
  assert.equal(events[0].starts_at,'2026-10-31T20:00');assert.equal(events[0].ends_at,'2026-11-01T06:00');
  assert.equal(events.at(-1).starts_at,'2026-12-12T16:00');assert.equal(events.at(-1).ends_at,'2026-12-13T05:00');
  const lineup=JSON.parse(events.find(e=>e.name.includes('SOROCABA')).lineup_json);
  assert.ok(lineup.some(dj=>dj.nome==='KENAN E KEL'));
  assert.ok(lineup.every(dj=>!('inicio' in dj)&&!('fim' in dj)));
  const second=ensureRealTourDemo(db);
  assert.equal(second.eventsAdded,0);assert.equal(second.eventsExisting,8);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,8);
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


test('ao trocar do catálogo fictício para o real, arquiva exemplos intactos só uma vez',()=>{
 const db=fixture();try{
  db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  db.prepare('INSERT INTO events(id,venue_id,name,tickets_url,created_at,is_published) VALUES(?,?,?,?,?,1)').run('old-demo','old-venue','SUBMUNDO 808 — Edição Demo','',Date.now());
  db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?)').run('default_demo_event_id','old-demo');
  db.prepare('INSERT INTO events(id,venue_id,name,tickets_url,created_at,is_published) VALUES(?,?,?,?,?,1)').run('poc-v2-event-neon','old-venue','SUBMUNDO 808 — Neon District','',Date.now());
  db.prepare('INSERT INTO events(id,venue_id,name,tickets_url,created_at,is_published) VALUES(?,?,?,?,?,1)').run('poc-v2-event-bass','old-venue','Evento alterado manualmente','',Date.now());
  const result=ensureRealTourDemo(db);
  assert.equal(result.legacyArchived,2);
  assert.equal(db.prepare('SELECT is_published FROM events WHERE id=?').get('old-demo').is_published,0);
  assert.equal(db.prepare('SELECT is_published FROM events WHERE id=?').get('poc-v2-event-neon').is_published,0);
  assert.equal(db.prepare('SELECT is_published FROM events WHERE id=?').get('poc-v2-event-bass').is_published,1);
  db.prepare('UPDATE events SET is_published=1 WHERE id=?').run('old-demo');
  const again=ensureRealTourDemo(db);
  assert.equal(again.legacyArchived,0);
  assert.equal(db.prepare('SELECT is_published FROM events WHERE id=?').get('old-demo').is_published,1);
 }finally{db.close();}
});
