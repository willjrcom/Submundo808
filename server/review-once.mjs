/**
 * A review is immutable after its first submission.
 * The (event_id,user_id) primary key also makes concurrent submissions safe.
 */
export function hasSubmittedReview(db,{eventId,userId}){
 return !!db.prepare('SELECT 1 FROM event_reviews WHERE event_id=? AND user_id=? LIMIT 1').get(eventId,userId);
}
export function insertReviewOnce(db,{eventId,userId,rating,tags,comment,now=Date.now()}){
 const result=db.prepare(
  'INSERT INTO event_reviews(event_id,user_id,rating,tags_json,comment,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(event_id,user_id) DO NOTHING'
 ).run(eventId,userId,rating,JSON.stringify(tags),comment,now,now);
 return result.changes===1;
}
