import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureDemoData} from '../server/demo-seed.mjs';
import {ensureDemoShowcase,SHOWCASE_EVENTS} from '../server/demo-showcase.mjs';

const NOW=Date.parse('2026-10-26T12:00:00Z');
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`
 CREATE TABLE venues(id TEXT PRIMARY KEY,name TEXT NOT NULL,address TEXT DEFAULT '',city TEXT DEFAULT '',created_at INTEGER NOT NULL);
 CREATE TABLE venue_maps(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE map_areas(id TEXT PRIMARY KEY,map_id TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,gps_json TEXT DEFAULT '{}',description TEXT DEFAULT '',color TEXT DEFAULT '#9747FF',icon TEXT DEFAULT '');
 CREATE TABLE map_markers(map_id TEXT PRIMARY KEY,markers_json TEXT NOT NULL DEFAULT '[]');
 CREATE TABLE events(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT DEFAULT '',starts_at TEXT DEFAULT '',ends_at TEXT DEFAULT '',site_url TEXT DEFAULT '',tickets_url TEXT DEFAULT '',instagram_url TEXT DEFAULT '',lineup_json TEXT DEFAULT '[]',created_at INTEGER NOT NULL);
 CREATE TABLE event_maps(event_id TEXT NOT NULL,map_id TEXT NOT NULL,PRIMARY KEY(event_id,map_id));
 CREATE TABLE products(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',category TEXT NOT NULL,default_price_cents INTEGER NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE event_products(event_id TEXT NOT NULL,product_id TEXT NOT NULL,price_cents INTEGER,PRIMARY KEY(event_id,product_id));
 `);
 return db;
}
const count=(db,table)=>db.prepare('SELECT COUNT(*) count FROM '+table).get().count;

test('five extra events across four dates, two simultaneously, three venues and six maps total',()=>{
 const db=fixture();
 try{
  const first=ensureDemoData(db,{now:NOW});
  const extra=ensureDemoShowcase(db,{baseEventId:first.id,now:NOW});
  assert.equal(extra.created,true);
  assert.equal(extra.eventsAdded,5);
  assert.equal(extra.mapsAdded,5);
  assert.equal(extra.venuesAdded,2);
  assert.equal(count(db,'events'),6);
  assert.equal(count(db,'venues'),3);
  assert.equal(count(db,'venue_maps'),6);
  assert.equal(count(db,'event_maps'),6);
  assert.equal(SHOWCASE_EVENTS.length,5);
  const counts=db.prepare("SELECT substr(starts_at,1,10) day,COUNT(*) total FROM events WHERE id LIKE 'poc-v2-event-%' GROUP BY day ORDER BY day").all();
  assert.deepEqual(counts.map(r=>r.total),[2,1,1,1]);
  assert.ok(counts[0].day.startsWith('2026-10-28'));
 }finally{db.close();}
});
test('all event cards have map, schedule, establishment and complete product menu',()=>{
 const db=fixture();
 try{
  const first=ensureDemoData(db,{now:NOW});
  ensureDemoShowcase(db,{baseEventId:first.id,now:NOW});
  assert.equal(count(db,'products'),14);
  assert.equal(count(db,'event_products'),84);
  const records=db.prepare('SELECT e.id,e.venue_id,e.lineup_json,e.starts_at,e.ends_at,(SELECT COUNT(*) FROM event_maps WHERE event_id=e.id) map_count,(SELECT COUNT(*) FROM event_products WHERE event_id=e.id) menu_count FROM events e').all();
  for(const event of records){
   assert.equal(event.map_count,1,event.id);
   assert.equal(event.menu_count,14,event.id);
   assert.equal(JSON.parse(event.lineup_json).length,6,event.id);
   assert.ok(event.starts_at<event.ends_at,event.id);
   assert.ok(db.prepare('SELECT 1 FROM venues WHERE id=?').get(event.venue_id));
  }
  const venueShare=db.prepare('SELECT venue_id,COUNT(*) count FROM events GROUP BY venue_id').all();
  assert.ok(venueShare.some(v=>v.count>=2));
 }finally{db.close();}
});
test('showcase maps have different room plans and realistic point mixes',()=>{
 const db=fixture();
 try{
  const first=ensureDemoData(db,{now:NOW});
  ensureDemoShowcase(db,{baseEventId:first.id,now:NOW});
  const maps=db.prepare("SELECT id FROM venue_maps WHERE id LIKE 'poc-v2-map-%' ORDER BY id").all();
  assert.equal(maps.length,5);
  const signatures=[];
  for(const map of maps){
   const rooms=db.prepare('SELECT name,x,y,width,height FROM map_areas WHERE map_id=?').all(map.id);
   assert.ok(rooms.length>=2&&rooms.length<=4);
   const raw=db.prepare('SELECT markers_json FROM map_markers WHERE map_id=?').get(map.id);
   const markers=JSON.parse(raw.markers_json);
   assert.ok(markers.length>=6);
   assert.ok(markers.some(m=>m.type==='palco'));
   assert.ok(markers.some(m=>m.type==='entrada'));
   for(const marker of markers){
    if(!marker.anchor)continue;
    const {side,offset}=marker.anchor;
    assert.ok(offset>=0&&offset<=100);
    if(side==='top')assert.deepEqual([marker.x,marker.y],[offset,0]);
    if(side==='bottom')assert.deepEqual([marker.x,marker.y],[offset,100]);
    if(side==='left')assert.deepEqual([marker.x,marker.y],[0,offset]);
    if(side==='right')assert.deepEqual([marker.x,marker.y],[100,offset]);
   }
   signatures.push(JSON.stringify(rooms.map(r=>[r.x,r.y,r.width,r.height])));
  }
  assert.equal(new Set(signatures).size,5);
 }finally{db.close();}
});
test('repeated startup never duplicates items or overwrites personalized price and name',()=>{
 const db=fixture();
 try{
  const main=ensureDemoData(db,{now:NOW});
  const first=ensureDemoShowcase(db,{baseEventId:main.id,now:NOW});
  const eventId=first.eventIds[0];
  db.prepare('UPDATE events SET name=? WHERE id=?').run('Evento personalizado',eventId);
  db.prepare('UPDATE event_products SET price_cents=? WHERE event_id=? AND product_id=?').run(9999,eventId,'demo-product-agua-500');
  const again=ensureDemoShowcase(db,{baseEventId:main.id,now:NOW+86400000});
  assert.equal(again.created,false);
  assert.equal(again.eventsAdded,0);
  assert.equal(count(db,'events'),6);
  assert.equal(count(db,'event_products'),84);
  assert.equal(db.prepare('SELECT name FROM events WHERE id=?').get(eventId).name,'Evento personalizado');
  assert.equal(db.prepare('SELECT price_cents FROM event_products WHERE event_id=? AND product_id=?').get(eventId,'demo-product-agua-500').price_cents,9999);
 }finally{db.close();}
});
test('five festival prices differ while global product pricing stays stable',()=>{
 const db=fixture();
 try{
  const main=ensureDemoData(db,{now:NOW});
  const extra=ensureDemoShowcase(db,{baseEventId:main.id,now:NOW});
  const prices=extra.eventIds.map(id=>db.prepare("SELECT price_cents FROM event_products WHERE event_id=? AND product_id='demo-product-agua-500'").get(id).price_cents);
  assert.deepEqual(prices,[600,700,800,900,1000]);
  assert.equal(db.prepare("SELECT default_price_cents FROM products WHERE id='demo-product-agua-500'").get().default_price_cents,700);
 }finally{db.close();}
});
test('fake GPS positions are not invented for any showcase map',()=>{
 const db=fixture();
 try{
  const main=ensureDemoData(db,{now:NOW});
  ensureDemoShowcase(db,{baseEventId:main.id,now:NOW});
  const all=db.prepare("SELECT gps_json FROM map_areas WHERE map_id LIKE 'poc-v2-map-%'").all();
  assert.ok(all.every(a=>!a.gps_json||JSON.stringify(JSON.parse(a.gps_json))==='{}'));
 }finally{db.close();}
});
