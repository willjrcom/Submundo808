/**
 * Read-only review report shared by the event and venue dashboards.
 * Counts and averages are calculated over all matching rows, not only
 * the 500 most recent displayed comments.
 */
export function getAdminReviewStats(db,{eventId='',venueId=''}={}){
 if(eventId&&venueId)throw Error('Filtros de avaliação incompatíveis.');
 const join=' FROM event_reviews r JOIN events e ON e.id=r.event_id';
 const where=eventId?' WHERE r.event_id=?':venueId?' WHERE e.venue_id=?':'';
 const args=eventId?[eventId]:venueId?[venueId]:[];
 const items=db.prepare('SELECT r.event_id,r.rating,r.tags_json,r.comment,r.updated_at,e.name AS event_name'+join+where+' ORDER BY r.updated_at DESC LIMIT 500')
  .all(...args).map(row=>({
   event_id:row.event_id,event_name:row.event_name,rating:row.rating,
   comment:row.comment,updated_at:row.updated_at,
   tags:JSON.parse(row.tags_json||'[]')
  }));
 const aggregate=db.prepare('SELECT COUNT(*) AS count,AVG(r.rating) AS average'+join+where).get(...args);
 return {items,summary:{count:Number(aggregate.count||0),average:aggregate.average===null?null:Number(aggregate.average)}};
}
