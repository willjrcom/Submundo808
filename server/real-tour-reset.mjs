import {ensureRealTourDemo} from './real-tour-seed.mjs';

// A destructive reset is performed ONE TIME per database, only when the
// operator explicitly sets AUTO_SEED_DEMO=true. Leaving the variable enabled
// across Docker restarts must never destroy edits made after the first reset.
export const REAL_TOUR_RESET_KEY='meaple808-clean-initialization-v1';

// Never truncate user/social/notification tables. Preserve all profiles,
// friendships, group memberships, group alerts, notification history/receipts,
// push subscriptions and the push queue.
const EVENT_TABLES=[
 'event_reviews',
 'event_participants',
 'event_products',
 'event_maps',
 'map_markers',
 'map_areas',
 'venue_maps',
 'events',
 'products',
 'venues'
];

function resetOldEvents(db,{defaultEventPreferences}={}){
 const removed={};
 for(const table of EVENT_TABLES){
  removed[table]=db.prepare('SELECT COUNT(*) AS total FROM '+table).get()?.total||0;
  db.exec('DELETE FROM '+table);
 }
 // A shared event was selected by this participant, not a friend-group setting.
 // Revoke only event-scoped live sharing, without losing friendships or accounts.
 db.prepare('DELETE FROM live_locations WHERE user_id IN (SELECT user_id FROM location_preferences WHERE share_event_id IS NOT NULL)').run();
 db.prepare('UPDATE location_preferences SET gps_enabled=0,share_enabled=0,share_expires_at=NULL,share_event_id=NULL,share_with_groups=0,updated_at=? WHERE share_event_id IS NOT NULL').run(Date.now());

 // Keep notification records and receipts intact. Prevent pending messages
 // relating to deleted events from firing after the reset.
 db.prepare("UPDATE notifications SET status='cancelled',scheduled_at=NULL WHERE event_id IS NOT NULL AND status IN ('draft','pending','scheduled')").run();

 // Global event policies are part of the old events configuration.
 if(defaultEventPreferences){
  db.prepare('DELETE FROM event_general_settings').run();
  const p=defaultEventPreferences;
  db.prepare('INSERT INTO event_general_settings(id,minimum_age,entry_rules,accepted_documents,cancellation_policy) VALUES(1,?,?,?,?)').run(p.minimum_age,p.entry_rules,p.accepted_documents,p.cancellation_policy);
 }
 // Forget old demonstration catalog markers only, preserving unrelated prefs.
 db.prepare("DELETE FROM app_settings WHERE key IN ('default_demo_event_id','poc_showcase_v2_created','real_tour_v1_archived_legacy_examples') OR key LIKE 'meaple808-demo-assets-v1:%'").run();
 return removed;
}

export function initializeRealTourDemo(db,{defaultEventPreferences}={}){
 db.exec('CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const alreadyReset=!!db.prepare('SELECT 1 FROM app_settings WHERE key=?').get(REAL_TOUR_RESET_KEY);
 if(alreadyReset)return {resetPerformed:false,removed:{},...ensureRealTourDemo(db)};

 // Reset and new catalog are a single transaction: either all real events,
 // venues, maps, menus exist, or ALL old data stays as it was.
 db.exec('BEGIN');
 try{
  const removed=resetOldEvents(db,{defaultEventPreferences});
  const tour=ensureRealTourDemo(db,{inTransaction:true});
  db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?)').run(REAL_TOUR_RESET_KEY,String(Date.now()));
  db.exec('COMMIT');
  return {resetPerformed:true,removed,...tour};
 }catch(error){db.exec('ROLLBACK');throw error;}
}
