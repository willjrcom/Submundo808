import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureEventUsageSchema,recordEventUsage,readEventUsage,brazilianDay,pruneEventUsage} from '../server/event-usage.mjs';

const id1 = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';
const id3 = '33333333-3333-4333-8333-333333333333';
const session1 = '44444444-4444-4444-8444-444444444444';
const session2 = '55555555-5555-4555-8555-555555555555';
const now = Date.parse('2026-11-09T21:15:00-03:00');
const secret = 'test-secret';
function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE events(id TEXT PRIMARY KEY,name TEXT,is_published INTEGER,starts_at TEXT,ends_at TEXT);" +
    "INSERT INTO events VALUES('e1','Festa principal',1,'2026-11-09T20:00','2026-11-10T06:00');" +
    "INSERT INTO events VALUES('e2','Outro evento',1,'2026-11-09T20:00','2026-11-10T06:00');" +
    "INSERT INTO events VALUES('draft','Rascunho',0,'2026-11-09T20:00','2026-11-10T06:00');" +
    'CREATE TABLE event_participants(event_id TEXT,user_id TEXT);');
  ensureEventUsageSchema(db,now);
  const record = (eventId,visitorId,feature,time=now,userId=null,sessionId=visitorId) =>
    recordEventUsage(db,{eventId,visitorId,sessionId,feature},{now:time,userId,secret});
  return {db,record};
}

test('usuários distintos, sessões e funcionalidades não multiplicam heartbeats',()=>{
  const {db,record}=setup();
  record('e1',id1,'programacao',now-120000);
  record('e1',id1,'heartbeat',now-60000);
  record('e1',id1,'mapa',now);
  record('e1',id2,'cardapio',now);
  const result=readEventUsage(db,{eventId:'e1',day:'2026-11-09',now}).body;
  assert.equal(result.uniqueVisitors,2);
  assert.equal(result.appOpens,2);
  assert.equal(result.activeNow,2);
  assert.equal(result.interactions,3);
  assert.equal(result.avgSessionSeconds,60);
  assert.equal(result.features.reduce((sum,f)=>sum+f.hits,0),3);
  assert.equal(result.timeline.reduce((sum,row)=>sum+row.opens,0),2);
  assert.equal(result.timelineUnit,'hour');
  db.close();
});

test('contas autenticadas são deduplicadas em dispositivos distintos',()=>{
  const {db,record}=setup();
  db.prepare('INSERT INTO event_participants VALUES(?,?)').run('e1','u1');
  record('e1',id1,'mapa',now,'u1',session1);
  record('e1',id2,'cardapio',now,'u1',session2);
  const result=readEventUsage(db,{eventId:'e1',day:'2026-11-09',now}).body;
  assert.equal(result.uniqueVisitors,1);
  assert.equal(result.appOpens,2);
  assert.equal(result.interactions,2);
  assert.equal(result.linkedUsers,1);
  db.close();
});

test('uma sessão ao alternar de evento conta uma vez no total e uma vez por evento',()=>{
  const {db,record}=setup();
  record('e1',id1,'programacao',now,null,session1);
  record('e2',id1,'mapa',now,null,session1);
  assert.equal(readEventUsage(db,{day:'2026-11-09',now}).body.appOpens,1);
  assert.equal(readEventUsage(db,{eventId:'e1',day:'2026-11-09',now}).body.appOpens,1);
  assert.equal(readEventUsage(db,{eventId:'e2',day:'2026-11-09',now}).body.appOpens,1);
  db.close();
});

test('pausa no plano de fundo não soma tempo oculto à duração da sessão',()=>{
  const {db,record}=setup();
  record('e1',id1,'programacao',now-600000,null,session1);
  record('e1',id1,'pause',now-580000,null,session1); // 20 s visíveis
  record('e1',id1,'heartbeat',now-100000,null,session1); // Reabriu: 0 s adicionais
  record('e1',id1,'heartbeat',now-40000,null,session1); // 60 s visíveis
  const result=readEventUsage(db,{eventId:'e1',day:'2026-11-09',now}).body;
  assert.equal(result.appOpens,1);
  assert.equal(result.avgSessionSeconds,80);
  assert.equal(result.interactions,1);
  db.close();
});

test('retorno usa coorte do intervalo anterior, não o número de sessões',()=>{
  const {db,record}=setup();
  const yesterday=now-86400000;
  record('e1',id1,'mapa',yesterday,null,session1);
  record('e1',id2,'cardapio',yesterday);
  record('e1',id1,'programacao',now,null,session2);
  const result=readEventUsage(db,{eventId:'e1',day:'2026-11-09',now}).body;
  assert.equal(result.previousPeriodVisitors,2);
  assert.equal(result.returningVisitors,1);
  assert.equal(result.retentionPercent,50);
  assert.equal(result.appOpens,1);
  db.close();
});

test('sete e trinta dias usam faixas diárias no horário de Brasília',()=>{
  const {db,record}=setup();
  record('e1',id1,'mapa',now);
  record('e1',id2,'mapa',now-6*86400000);
  const seven=readEventUsage(db,{eventId:'e1',period:'7d',now}).body;
  assert.equal(seven.timelineUnit,'day');
  assert.equal(seven.timeline.length,7);
  assert.equal(seven.uniqueVisitors,2);
  assert.equal(readEventUsage(db,{period:'30d',now}).body.timeline.length,30);
  assert.equal(brazilianDay(Date.parse('2026-11-10T01:00:00Z')),'2026-11-09');
  db.close();
});

test('rejeita parâmetros e eventos inválidos, aceita faixa personalizada',()=>{
  const {db,record}=setup();
  assert.equal(record('draft',id1,'mapa').status,404);
  assert.equal(record('e1','invalido','mapa').status,400);
  assert.equal(record('e1',id1,'senha').status,400);
  assert.equal(recordEventUsage(db,{eventId:'e1',visitorId:id1,sessionId:'bad',feature:'mapa'},{secret,now}).status,400);
  assert.equal(readEventUsage(db,{day:'2026-02-31',now}).status,400);
  assert.equal(readEventUsage(db,{eventId:'nao-existe',now}).status,404);
  assert.equal(readEventUsage(db,{period:'custom',from:'2026-11-10',to:'2026-11-09',now}).status,400);
  assert.equal(readEventUsage(db,{period:'custom',from:'2026-01-01',to:'2026-11-09',now}).status,400);
  const valid=readEventUsage(db,{period:'custom',from:'2026-11-08',to:'2026-11-09',now});
  assert.equal(valid.status,200);
  assert.equal(valid.body.timeline.length,2);
  db.close();
});

test('retém no máximo noventa dias de eventos e sessões',()=>{
  const {db,record}=setup();
  record('e1',id1,'mapa',now-91*86400000);
  record('e1',id2,'mapa',now);
  pruneEventUsage(db,now);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_usage_buckets').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_usage_sessions').get().n,1);
  db.close();
});
