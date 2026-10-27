import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensurePushQueueSchema,addNotificationReceipt,notificationTransaction,publishDueNotificationReceipts,processPendingPushes,notificationTargetUrl} from '../server/notification-delivery.mjs';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE users(id TEXT PRIMARY KEY); CREATE TABLE event_participants(event_id TEXT,user_id TEXT); CREATE TABLE event_reviews(event_id TEXT,user_id TEXT); CREATE TABLE push_subscriptions(user_id TEXT,endpoint TEXT PRIMARY KEY,subscription_json TEXT); CREATE TABLE notification_receipts(notification_id TEXT,user_id TEXT,read_at INTEGER,PRIMARY KEY(notification_id,user_id)); CREATE TABLE notifications(id TEXT PRIMARY KEY,event_id TEXT,title TEXT,body TEXT,kind TEXT,target_kind TEXT,target_id TEXT,audience TEXT,status TEXT,scheduled_at INTEGER,created_at INTEGER,sent_at INTEGER)");
 ensurePushQueueSchema(db);
 return db;
}
function addNotification(db,{id='n1',kind='promo',status='scheduled',scheduledAt=2000,audience='event',targetKind='point'}={}){
 db.prepare('INSERT INTO notifications(id,event_id,title,body,kind,target_kind,target_id,audience,status,scheduled_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,'event-1','Aviso','Mensagem',kind,targetKind,'bar-1',audience,status,scheduledAt,1000);
}
function subscribe(db,id){
 db.prepare('INSERT INTO users(id) VALUES(?)').run(id);
 db.prepare('INSERT INTO event_participants(event_id,user_id) VALUES(?,?)').run('event-1',id);
 db.prepare('INSERT INTO push_subscriptions(user_id,endpoint,subscription_json) VALUES(?,?,?)').run(id,'https://push.test/'+id,JSON.stringify({endpoint:'https://push.test/'+id,keys:{auth:'auth',p256dh:'key'}}));
}
const total=(db,table)=>db.prepare('SELECT COUNT(*) AS c FROM '+table).get().c;
const state=db=>db.prepare('SELECT status,attempts,next_attempt_at,last_error FROM notification_push_queue LIMIT 1').get();

test('agendamento respeita o horário e publica inbox e push uma única vez',()=>{
 const db=fixture();
 try{
  subscribe(db,'u1');subscribe(db,'u2');addNotification(db);
  assert.equal(publishDueNotificationReceipts(db,1999),0);
  assert.equal(total(db,'notification_receipts'),0);
  assert.equal(publishDueNotificationReceipts(db,2000),1);
  assert.equal(publishDueNotificationReceipts(db,2001),0);
  assert.equal(total(db,'notification_receipts'),2);
  assert.equal(total(db,'notification_push_queue'),2);
  assert.equal(db.prepare("SELECT status FROM notifications WHERE id='n1'").get().status,'sent');
 }finally{db.close();}
});

test('cancelamento não gera mensagens nem entradas na fila',()=>{
 const db=fixture();
 try{
  subscribe(db,'u1');addNotification(db,{status:'cancelled'});
  assert.equal(publishDueNotificationReceipts(db,3000),0);
  assert.equal(total(db,'notification_receipts'),0);
  assert.equal(total(db,'notification_push_queue'),0);
 }finally{db.close();}
});

test('pesquisa automática não convida novamente quem já avaliou',()=>{
 const db=fixture();
 try{
  subscribe(db,'u1');subscribe(db,'u2');addNotification(db,{kind:'survey',status:'pending'});
  db.prepare('INSERT INTO event_reviews(event_id,user_id) VALUES(?,?)').run('event-1','u1');
  publishDueNotificationReceipts(db,3000);
  assert.deepEqual(db.prepare('SELECT user_id FROM notification_receipts').all().map(x=>x.user_id),['u2']);
  assert.equal(total(db,'notification_push_queue'),1);
 }finally{db.close();}
});

test('aceitação do serviço push é registrada e não repetida',async()=>{
 const db=fixture();
 try{
  subscribe(db,'u1');addNotification(db,{status:'pending'});publishDueNotificationReceipts(db,1000);
  let calls=0;
  const send=async(sub,payload,options)=>{calls++;assert.match(sub.endpoint,/push.test/);assert.equal(JSON.parse(payload).url,'/map?event=event-1&point=bar-1');assert.equal(options.TTL,3600);};
  const stats=await processPendingPushes(db,send,{now:()=>1000});
  assert.equal(stats.accepted,1);
  assert.equal(state(db).status,'accepted');
  await processPendingPushes(db,send,{now:()=>1001});
  assert.equal(calls,1);
 }finally{db.close();}
});

test('falha transitória recebe backoff e reenvio, sem segundo recibo',async()=>{
 const db=fixture();
 try{
  subscribe(db,'u1');addNotification(db,{status:'pending'});publishDueNotificationReceipts(db,1000);
  let calls=0;
  const send=async()=>{calls++;if(calls===1)throw Object.assign(new Error('temporário'),{statusCode:503});};
  const first=await processPendingPushes(db,send,{now:()=>1000});
  assert.equal(first.retried,1);
  assert.equal(state(db).next_attempt_at,16000);
  await processPendingPushes(db,send,{now:()=>15999});
  assert.equal(calls,1);
  await processPendingPushes(db,send,{now:()=>16000});
  assert.equal(calls,2);
  assert.equal(state(db).status,'accepted');
  assert.equal(total(db,'notification_receipts'),1);
 }finally{db.close();}
});

test('assinatura expirada HTTP 410 é removida e não repetida',async()=>{
 const db=fixture();
 try{
  subscribe(db,'u1');addNotification(db,{status:'pending'});publishDueNotificationReceipts(db,1000);
  await processPendingPushes(db,async()=>{throw {statusCode:410};},{now:()=>1000});
  assert.equal(state(db).status,'expired');
  assert.equal(total(db,'push_subscriptions'),0);
 }finally{db.close();}
});

test('fila recupera tentativa interrompida após lease vencer',async()=>{
 const db=fixture();
 try{
  subscribe(db,'u1');addNotification(db,{status:'pending'});publishDueNotificationReceipts(db,1000);
  db.prepare("UPDATE notification_push_queue SET status='processing',lease_until=2000").run();
  let calls=0;
  await processPendingPushes(db,async()=>{calls++;},{now:()=>1999});
  assert.equal(calls,0);
  await processPendingPushes(db,async()=>{calls++;},{now:()=>2000});
  assert.equal(calls,1);
  assert.equal(state(db).status,'accepted');
 }finally{db.close();}
});

test('aviso permanece na caixa de entrada mesmo sem dispositivo assinado',()=>{
 const db=fixture();
 try{
  db.prepare('INSERT INTO users(id) VALUES(?)').run('u1');
  db.prepare('INSERT INTO event_participants(event_id,user_id) VALUES(?,?)').run('event-1','u1');
  addNotification(db,{status:'pending'});
  publishDueNotificationReceipts(db,1000);
  assert.equal(total(db,'notification_receipts'),1);
  assert.equal(total(db,'notification_push_queue'),0);
 }finally{db.close();}
});

test('envio de teste enfileira apenas o administrador explicitamente selecionado',()=>{
 const db=fixture();
 try{
  subscribe(db,'admin');subscribe(db,'guest');addNotification(db,{status:'sent',audience:'test'});
  notificationTransaction(db,()=>addNotificationReceipt(db,'n1','admin',1000));
  assert.deepEqual(db.prepare('SELECT user_id FROM notification_receipts').all().map(x=>x.user_id),['admin']);
  assert.equal(total(db,'notification_push_queue'),1);
 }finally{db.close();}
});

test('redirecionamentos de push preservam evento, mapa, cardápio e pesquisa',()=>{
 assert.equal(notificationTargetUrl({target_kind:'point',event_id:'a',target_id:'x'}),'/map?event=a&point=x');
 assert.equal(notificationTargetUrl({target_kind:'menu',event_id:'a'}),'/menu?event=a');
 assert.equal(notificationTargetUrl({target_kind:'map',event_id:'a'}),'/map?event=a');
 assert.equal(notificationTargetUrl({target_kind:'survey',event_id:'a'}),'/schedule/a?review=1');
});
