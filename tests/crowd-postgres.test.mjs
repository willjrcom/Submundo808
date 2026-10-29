import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgresSync} from '../server/postgres-sync.mjs';
import {ensureCrowdSchema,readCrowdLive,crowdPublicView,sampleCrowdHistory,readCrowdHistory} from '../server/crowd-analytics.mjs';

test('PostgreSQL: consentimento é OFF por padrão, leituras agregadas e histórico persistem', {skip:!process.env.PG_TEST_DATABASE_URL},()=>{
 const db=new PostgresSync(process.env.PG_TEST_DATABASE_URL);
 const now=Date.now(),e='crowd-postgres-preview';
 try{
  db.exec(`CREATE TABLE IF NOT EXISTS location_preferences(
   user_id TEXT PRIMARY KEY,gps_enabled INTEGER NOT NULL DEFAULT 0,
   share_enabled INTEGER NOT NULL DEFAULT 0,share_event_id TEXT,share_expires_at INTEGER,
   updated_at INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS live_locations(user_id TEXT PRIMARY KEY,lat REAL NOT NULL,
   lng REAL NOT NULL,accuracy REAL NOT NULL,updated_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,name TEXT NOT NULL,location_sharing_enabled INTEGER NOT NULL DEFAULT 1);
   CREATE TABLE IF NOT EXISTS venue_maps(id TEXT PRIMARY KEY,name TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS map_areas(id TEXT PRIMARY KEY,map_id TEXT NOT NULL,name TEXT NOT NULL,
   x REAL,y REAL,width REAL,height REAL,gps_json TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS event_maps(event_id TEXT NOT NULL,map_id TEXT NOT NULL,PRIMARY KEY(event_id,map_id));`);
  ensureCrowdSchema(db);ensureCrowdSchema(db);
  db.prepare('INSERT INTO events(id,name,location_sharing_enabled) VALUES(?,?,?)').run(e,'Teste PostgreSQL',1);
  db.prepare('INSERT INTO venue_maps(id,name) VALUES(?,?)').run('pg-map','Área teste');
  db.prepare('INSERT INTO event_maps(event_id,map_id) VALUES(?,?)').run(e,'pg-map');
  const calibration={mode:'manual',tl:{lat:-23,lng:-47},tr:{lat:-23,lng:-46.999},bl:{lat:-23.001,lng:-47},br:{lat:-23.001,lng:-46.999}};
  db.prepare('INSERT INTO map_areas VALUES(?,?,?,?,?,?,?,?)').run('pg-pista','pg-map','Pista',0,0,100,100,JSON.stringify(calibration));
  for(let i=0;i<6;i++){
   db.prepare('INSERT INTO location_preferences(user_id,gps_enabled,share_enabled,share_event_id,share_expires_at,analytics_enabled,analytics_event_id,updated_at) VALUES(?,?,?,?,?,?,?,?)')
    .run('pg-user-'+i,1,1,e,now+600_000,i<5?1:0,i<5?e:null,now);
   db.prepare('INSERT INTO live_locations VALUES(?,?,?,?,?)').run('pg-user-'+i,-23.0005,-46.9995,5,now);
  }
  const reading=crowdPublicView(readCrowdLive(db,e,now));
  assert.equal(reading.participants,5);
  assert.equal(reading.maps[0].areas[0].count,5);
  assert.equal(db.prepare('SELECT analytics_enabled FROM location_preferences WHERE user_id=?').get('pg-user-5').analytics_enabled,0);
  assert.equal(sampleCrowdHistory(db,now),1);
  const history=readCrowdHistory(db,e,now+3000);
  assert.equal(history.snapshotCount,1);
  assert.equal(history.hotspots[0].peak,5);
  assert.equal(history.series[0].participants,5);
 }finally{db.close();}
});
