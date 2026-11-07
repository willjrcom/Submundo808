import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {getAdminReviewStats} from '../server/review-summary.mjs';
const file=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('venue report aggregates only reviews from its own events; event report is narrower',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE events(id TEXT PRIMARY KEY,name TEXT,venue_id TEXT); CREATE TABLE event_reviews(event_id TEXT,user_id TEXT,rating INTEGER,tags_json TEXT,comment TEXT,updated_at INTEGER)');
  db.prepare('INSERT INTO events VALUES(?,?,?)').run('e1','Festa A','v1');
  db.prepare('INSERT INTO events VALUES(?,?,?)').run('e2','Festa B','v1');
  db.prepare('INSERT INTO events VALUES(?,?,?)').run('e3','Festa C','v2');
  const ins=db.prepare('INSERT INTO event_reviews VALUES(?,?,?,?,?,?)');
  ins.run('e1','u1',5,'["Som bom"]','Ótima',10);
  ins.run('e1','u2',3,'[]','Regular',20);
  ins.run('e2','u3',4,'["Equipe"]','Boa',30);
  ins.run('e3','u4',1,'[]','Ruim',40);
  const venue=getAdminReviewStats(db,{venueId:'v1'});
  assert.equal(venue.summary.count,3);
  assert.equal(venue.summary.average,4);
  assert.equal(venue.items.length,3);
  assert.ok(venue.items.every(x=>x.event_id!=='e3'));
  const event=getAdminReviewStats(db,{eventId:'e1'});
  assert.equal(event.summary.count,2);
  assert.equal(event.summary.average,4);
  assert.deepEqual(event.items.map(x=>x.event_id),['e1','e1']);
  assert.equal(getAdminReviewStats(db,{venueId:'missing'}).summary.count,0);
  assert.throws(()=>getAdminReviewStats(db,{eventId:'e1',venueId:'v1'}));
 }finally{db.close();}
});
test('both dashboards display scoped review summaries and API accepts venue filtering',()=>{
 const event=file('artifacts/submundo-808/src/components/admin-event-dashboard.tsx');
 const venue=file('artifacts/submundo-808/src/components/admin-venue-dashboard.tsx');
 const ui=file('artifacts/submundo-808/src/components/admin-dashboard-reviews.tsx');
 const server=file('server/index.mjs');
 assert.match(event,/<AdminDashboardReviews eventId=\{event.id\}\/>/);
 assert.match(venue,/<AdminDashboardReviews venueId=\{venue.id\}\/>/);
 assert.match(ui,/event_id='\+encodeURIComponent\(eventId\)/);
 assert.match(ui,/venue_id='\+encodeURIComponent\(venueId\|\|''\)/);
 assert.match(server,/getAdminReviewStats\(db,\{eventId,venueId\}\)/);
});
