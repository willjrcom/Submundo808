import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureEventUsageSchema,recordEventUsage,readEventUsage,brazilianDay,pruneEventUsage} from '../server/event-usage.mjs';

const id1 = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';
const now = Date.parse('2026-11-09T21:15:00-03:00');
const secret = 'test-secret';
function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE events(id TEXT PRIMARY KEY,name TEXT,is_published INTEGER,starts_at TEXT);" +
    "INSERT INTO events VALUES('e1','Festa principal',1,'2026-11-09T20:00');" +
    "INSERT INTO events VALUES('e2','Outro evento',1,'2026-11-09T20:00');" +
    "INSERT INTO events VALUES('draft','Rascunho',0,'2026-11-09T20:00');" +
    'CREATE TABLE event_participants(event_id TEXT,user_id TEXT);');
  ensureEventUsageSchema(db,now);
  const record = (eventId,visitorId,feature,time=now,userId=null) =>
    recordEventUsage(db,{eventId,visitorId,feature},{now:time,userId,secret});
  return {db,record};
}
test('conta usuários únicos sem multiplicar heartbeats e registra uso por funcionalidade',()=>{
  const {db,record}=setup();
  assert.equal(record('e1',id1,'programacao').status,202);
  record('e1',id1,'heartbeat');
  record('e1',id1,'heartbeat');
  record('e1',id1,'mapa');
  record('e1',id2,'cardapio');
  record('e2',id2,'mapa');
  const result=readEventUsage(db,{eventId:'e1',day:'2026-11-09',now}).body;
  assert.equal(result.uniqueVisitors,2);
  assert.equal(result.activeNow,2);
  assert.equal(result.interactions,3);
  assert.equal(result.features.reduce((sum,f)=>sum+f.hits,0),3);
  assert.equal(result.hours[0].visitors,2);
  assert.equal(result.events.find(e=>e.id==='e2').visitors,1);
  db.close();
});
test('vinculados não são presença física e autenticação deduplica por conta',()=>{
  const {db,record}=setup();
  db.prepare('INSERT INTO event_participants VALUES(?,?)').run('e1','u1');
  record('e1',id1,'mapa',now,'u1');
  record('e1',id2,'cardapio',now,'u1');
  const result=readEventUsage(db,{eventId:'e1',day:'2026-11-09',now}).body;
  assert.equal(result.uniqueVisitors,1);
  assert.equal(result.interactions,2);
  assert.equal(result.linkedUsers,1);
  db.close();
});
test('rejeita envio inválido, não publicado e data impossível',()=>{
  const {db,record}=setup();
  assert.equal(record('draft',id1,'mapa').status,404);
  assert.equal(record('e1','invalido','mapa').status,400);
  assert.equal(record('e1',id1,'senha').status,400);
  assert.equal(readEventUsage(db,{day:'2026-02-31'}).status,400);
  assert.equal(readEventUsage(db,{eventId:'nao-existe'}).status,404);
  db.close();
});
test('dia local Brasil e retenção de 90 dias',()=>{
  const {db,record}=setup();
  assert.equal(brazilianDay(Date.parse('2026-11-10T01:00:00Z')),'2026-11-09');
  record('e1',id1,'mapa',now-91*86400000);
  record('e1',id2,'mapa',now);
  pruneEventUsage(db,now);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_usage_buckets').get().n,1);
  db.close();
});
