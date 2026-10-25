import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {
 SHARING_MODES,SHARING_TIME_ZONE,LOCATION_FRESH_MS,
 eventEndTimestamp,resolveSharingExpiry,expireLocationShares
} from '../server/location-sharing.mjs';

const HOUR=3600000;
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`
 CREATE TABLE events(id TEXT PRIMARY KEY,ends_at TEXT NOT NULL);
 CREATE TABLE location_preferences(
 user_id TEXT PRIMARY KEY,gps_enabled INTEGER NOT NULL DEFAULT 0,
 share_enabled INTEGER NOT NULL DEFAULT 0,share_mode TEXT NOT NULL DEFAULT 'event',
 share_expires_at INTEGER,share_event_id TEXT,updated_at INTEGER NOT NULL DEFAULT 0
 );
 CREATE TABLE live_locations(user_id TEXT PRIMARY KEY,lat REAL,lng REAL,accuracy REAL,updated_at INTEGER NOT NULL);
 `);
 db.prepare('INSERT INTO events VALUES(?,?)').run('festival','2026-11-02T02:30');
 return db;
}
const NOW=Date.parse('2026-11-01T23:00:00Z');
test('os três prazos são opções válidas e o fim da festa é padrão',()=>{
 assert.deepEqual([...SHARING_MODES],['event','4h','1h']);
 assert.equal(SHARING_TIME_ZONE,'America/Sao_Paulo');
});
test('1 hora e 4 horas sempre expiram em horário absoluto do servidor',()=>{
 const db=fixture();
 try{
  assert.deepEqual(resolveSharingExpiry(db,{mode:'1h',now:NOW}),{mode:'1h',eventId:null,expiresAt:NOW+HOUR});
  assert.deepEqual(resolveSharingExpiry(db,{mode:'4h',now:NOW}),{mode:'4h',eventId:null,expiresAt:NOW+4*HOUR});
 }finally{db.close();}
});
test('fim da festa respeita horário local de São Paulo, mesmo se o servidor estiver em UTC',()=>{
 const db=fixture();
 try{
  assert.equal(eventEndTimestamp('2026-11-02T02:30'),Date.parse('2026-11-02T05:30:00Z'));
  const end=resolveSharingExpiry(db,{mode:'event',eventId:'festival',now:NOW});
  assert.equal(end.expiresAt,Date.parse('2026-11-02T05:30:00Z'));
  assert.equal(end.eventId,'festival');
 }finally{db.close();}
});
test('ISO com timezone explícito preserva o instante',()=>{
 assert.equal(eventEndTimestamp('2026-11-02T02:30:00-03:00'),Date.parse('2026-11-02T05:30:00Z'));
 assert.equal(eventEndTimestamp('2026-11-02T05:30:00Z'),Date.parse('2026-11-02T05:30:00Z'));
});
test('fim inexistente, evento encerrado e data inválida não são aceitos',()=>{
 const db=fixture();
 try{
  assert.throws(()=>resolveSharingExpiry(db,{mode:'event',eventId:'missing',now:NOW}),/não encontrado/);
  assert.throws(()=>resolveSharingExpiry(db,{mode:'event',eventId:'festival',now:Date.parse('2026-11-03T00:00:00Z')}),/terminou/);
  assert.throws(()=>resolveSharingExpiry(db,{mode:'wrong',now:NOW}),/válido/);
  assert.equal(eventEndTimestamp('2026-02-30T22:00'),null);
  db.prepare('UPDATE events SET ends_at=? WHERE id=?').run('','festival');
  assert.throws(()=>resolveSharingExpiry(db,{mode:'event',eventId:'festival',now:NOW}),/Defina/);
 }finally{db.close();}
});
test('duração até fim do evento não pode ser ilimitada',()=>{
 const db=fixture();
 try{
  db.prepare('UPDATE events SET ends_at=?').run('2027-02-01T22:00');
  assert.throws(()=>resolveSharingExpiry(db,{mode:'event',eventId:'festival',now:NOW}),/30 dias/);
 }finally{db.close();}
});
test('expiração revoga compartilhamento e apaga localização automaticamente',()=>{
 const db=fixture();
 try{
  db.prepare('INSERT INTO location_preferences VALUES(?,?,?,?,?,?,?)').run('expired',1,1,'1h',NOW-1,null,NOW-1);
  db.prepare('INSERT INTO live_locations VALUES(?,?,?,?,?)').run('expired',-23.55,-46.63,10,NOW-1000);
  expireLocationShares(db,NOW);
  const prefs=db.prepare('SELECT * FROM location_preferences WHERE user_id=?').get('expired');
  assert.equal(prefs.share_enabled,0);
  assert.equal(prefs.gps_enabled,0);
  assert.equal(prefs.share_mode,'1h');
  assert.equal(db.prepare('SELECT 1 FROM live_locations WHERE user_id=?').get('expired'),undefined);
 }finally{db.close();}
});
test('usuário ativo continua visível, mas uma posição com mais de 90 segundos expira',()=>{
 const db=fixture();
 try{
  db.prepare('INSERT INTO location_preferences VALUES(?,?,?,?,?,?,?)').run('active',1,1,'4h',NOW+4*HOUR,null,NOW);
  db.prepare('INSERT INTO live_locations VALUES(?,?,?,?,?)').run('active',-23.55,-46.63,6,NOW-2000);
  db.prepare('INSERT INTO location_preferences VALUES(?,?,?,?,?,?,?)').run('stale',1,1,'event',NOW+HOUR,'festival',NOW);
  db.prepare('INSERT INTO live_locations VALUES(?,?,?,?,?)').run('stale',-23.55,-46.63,6,NOW-LOCATION_FRESH_MS-1);
  expireLocationShares(db,NOW);
  assert.ok(db.prepare('SELECT 1 FROM live_locations WHERE user_id=?').get('active'));
  assert.equal(db.prepare('SELECT 1 FROM live_locations WHERE user_id=?').get('stale'),undefined);
  assert.equal(db.prepare('SELECT share_enabled FROM location_preferences WHERE user_id=?').get('active').share_enabled,1);
 }finally{db.close();}
});
test('sessões legadas sem expiração são encerradas com segurança',()=>{
 const db=fixture();
 try{
  db.prepare('INSERT INTO location_preferences VALUES(?,?,?,?,?,?,?)').run('legacy',1,1,'event',null,null,NOW);
  db.prepare('INSERT INTO live_locations VALUES(?,?,?,?,?)').run('legacy',-23.55,-46.63,6,NOW);
  expireLocationShares(db,NOW);
  assert.equal(db.prepare('SELECT share_enabled FROM location_preferences WHERE user_id=?').get('legacy').share_enabled,0);
  assert.equal(db.prepare('SELECT 1 FROM live_locations WHERE user_id=?').get('legacy'),undefined);
 }finally{db.close();}
});
