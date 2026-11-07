import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {hasSubmittedReview,insertReviewOnce} from '../server/review-once.mjs';

test('participant can evaluate an event only once, without updating the first answer',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE event_reviews(event_id TEXT NOT NULL,user_id TEXT NOT NULL,rating INTEGER,tags_json TEXT,comment TEXT,created_at INTEGER,updated_at INTEGER,PRIMARY KEY(event_id,user_id))');
  const values={eventId:'show1',userId:'user1',rating:5,tags:['Ótimo'],comment:'Primeira',now:123};
  assert.equal(hasSubmittedReview(db,{eventId:'show1',userId:'user1'}),false);
  assert.equal(insertReviewOnce(db,values),true);
  assert.equal(hasSubmittedReview(db,{eventId:'show1',userId:'user1'}),true);
  assert.equal(hasSubmittedReview(db,{eventId:'show1',userId:'user2'}),false);
  assert.equal(insertReviewOnce(db,{...values,rating:1,comment:'Alteração',now:456}),false);
  assert.deepEqual({...db.prepare('SELECT rating,comment,created_at,updated_at FROM event_reviews WHERE event_id=? AND user_id=?').get('show1','user1')},{rating:5,comment:'Primeira',created_at:123,updated_at:123});
  assert.equal(insertReviewOnce(db,{...values,userId:'user2'}),true);
  assert.equal(insertReviewOnce(db,{...values,eventId:'show2'}),true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_reviews').get().n,3);
 }finally{db.close();}
});
test('API returns conflict for a second evaluation instead of upserting',()=>{
 const api=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');
 const review=readFileSync(new URL('../server/review-once.mjs',import.meta.url),'utf8');
 assert.match(api,/if\(!inserted\)return json\(res,409,/);
 assert.match(review,/ON CONFLICT\(event_id,user_id\) DO NOTHING/);
 assert.doesNotMatch(review,/ON CONFLICT\(event_id,user_id\) DO UPDATE/);
});
