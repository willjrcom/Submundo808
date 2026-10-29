/**
 * Keep the additional event fields in sync with the edit form.
 * The event endpoint also accepts partial updates from older clients:
 * omitted fields retain their stored values; an explicit empty string clears them.
 * This function runs within the caller's transaction.
 */
export function updateEventExtras(db,id,payload={}){
 const current=db.prepare('SELECT doors_at,cover_image,services FROM events WHERE id=?').get(id);
 if(!current)throw new Error('Evento não encontrado.');
 const fields={
  doors_at:String(payload.doors_at ?? current.doors_at ?? '').slice(0,20),
  cover_image:String(payload.cover_image ?? current.cover_image ?? '').slice(0,160000),
  services:String(payload.services ?? current.services ?? '').slice(0,2000)
 };
 db.prepare('UPDATE events SET doors_at=?,cover_image=?,services=? WHERE id=?').run(fields.doors_at,fields.cover_image,fields.services,id);
 return fields;
}
