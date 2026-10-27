// Fila de push persistida no mesmo SQLite das notificações.
// "sent" significa publicado na caixa de entrada; "accepted" significa aceito
// pelo serviço Web Push, e NÃO comprova a entrega ao dispositivo.
export const MAX_PUSH_ATTEMPTS=5;
export const PUSH_TTL_MS=60*60*1000;

export function ensurePushQueueSchema(db){
 db.exec("CREATE TABLE IF NOT EXISTS notification_push_queue (notification_id TEXT NOT NULL, user_id TEXT NOT NULL, endpoint TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL, lease_until INTEGER, accepted_at INTEGER, last_error TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(notification_id,endpoint))");
 db.exec("CREATE INDEX IF NOT EXISTS idx_notification_push_queue_due ON notification_push_queue(status,next_attempt_at,lease_until)");
}
export function notificationTransaction(db,task){
 db.exec('BEGIN IMMEDIATE');
 try{const result=task();db.exec('COMMIT');return result;}
 catch(error){db.exec('ROLLBACK');throw error;}
}
export function addNotificationReceipt(db,notificationId,userId,now=Date.now()){
 const added=db.prepare('INSERT OR IGNORE INTO notification_receipts(notification_id,user_id) VALUES(?,?)').run(notificationId,userId);
 if(added.changes){
  const subs=db.prepare('SELECT endpoint FROM push_subscriptions WHERE user_id=?').all(userId);
  const queue=db.prepare("INSERT OR IGNORE INTO notification_push_queue(notification_id,user_id,endpoint,status,next_attempt_at,created_at,updated_at) VALUES(?,?,?,'pending',?,?,?)");
  for(const s of subs)queue.run(notificationId,userId,s.endpoint,now,now,now);
 }
 return Boolean(added.changes);
}
export function publishDueNotificationReceipts(db,now=Date.now()){
 const due=db.prepare("SELECT * FROM notifications WHERE status='pending' OR (status='scheduled' AND scheduled_at<=?) ORDER BY created_at LIMIT 100").all(now);
 let published=0;
 for(const n of due){
  notificationTransaction(db,()=>{
   const marked=db.prepare("UPDATE notifications SET status='sent',sent_at=? WHERE id=? AND (status='pending' OR (status='scheduled' AND scheduled_at<=?))").run(now,n.id,now);
   if(!marked.changes)return;
   const users=n.audience==='all'
    ?db.prepare('SELECT id AS user_id FROM users').all()
    :db.prepare('SELECT user_id FROM event_participants WHERE event_id=?').all(n.event_id);
   const skipReview=db.prepare('SELECT 1 FROM event_reviews WHERE event_id=? AND user_id=?');
   for(const u of users){
    if(n.kind==='survey'&&skipReview.get(n.event_id,u.user_id))continue;
    addNotificationReceipt(db,n.id,u.user_id,now);
   }
   published++;
  });
 }
 return published;
}
export function notificationTargetUrl(n){
 const eventId=encodeURIComponent(n.event_id||'');
 const e=eventId?'?event='+eventId:'';
 if(n.target_kind==='point')return '/map?event='+eventId+'&point='+encodeURIComponent(n.target_id||'');
 if(n.target_kind==='map')return '/map'+e;
 if(n.target_kind==='menu')return '/menu'+e;
 if(n.target_kind==='survey')return '/schedule/'+eventId+'?review=1';
 return eventId?'/schedule/'+eventId:'/';
}
function reasonFor(error){
 const status=Number(error?.statusCode);
 return status?'http_'+status:'network_error';
}
export async function processPendingPushes(db,send,{now=Date.now,batchSize=20,pushConfigured=true}={}){
 const current=now();
 const rows=db.prepare("SELECT q.*,n.title,n.body,n.event_id,n.target_kind,n.target_id,s.subscription_json FROM notification_push_queue q JOIN notifications n ON n.id=q.notification_id LEFT JOIN push_subscriptions s ON s.endpoint=q.endpoint AND s.user_id=q.user_id WHERE (q.status='pending' AND q.next_attempt_at<=?) OR (q.status='processing' AND q.lease_until<=?) ORDER BY q.next_attempt_at LIMIT ?").all(current,current,batchSize);
 const stats={processed:0,accepted:0,retried:0,failed:0,expired:0};
 const finish=db.prepare("UPDATE notification_push_queue SET status=?,lease_until=NULL,accepted_at=?,next_attempt_at=?,last_error=?,updated_at=? WHERE notification_id=? AND endpoint=? AND status='processing'");
 async function processJob(job){
  const ts=now();
  const lease=db.prepare("UPDATE notification_push_queue SET status='processing',attempts=attempts+1,lease_until=?,updated_at=? WHERE notification_id=? AND endpoint=? AND ((status='pending' AND next_attempt_at<=?) OR (status='processing' AND lease_until<=?))").run(ts+120000,ts,job.notification_id,job.endpoint,ts,ts);
  if(!lease.changes)return;
  stats.processed++;
  const attempts=job.attempts+1;
  const complete=(state,reason='',next=0)=>{
   const ok=finish.run(state,state==='accepted'?now():null,next,reason,now(),job.notification_id,job.endpoint);
   if(ok.changes){
    if(state==='accepted')stats.accepted++;
    else if(state==='pending')stats.retried++;
    else if(state==='expired')stats.expired++;
    else stats.failed++;
   }
  };
  if(ts-job.created_at>PUSH_TTL_MS){complete('expired','ttl_expired');return;}
  if(!job.subscription_json){complete('expired','subscription_removed');return;}
  if(!pushConfigured){complete('failed','push_not_configured');return;}
  let subscription;
  try{subscription=JSON.parse(job.subscription_json);}
  catch{complete('failed','subscription_invalid');return;}
  try{
   const payload={title:job.title,body:job.body,tag:job.notification_id,url:notificationTargetUrl(job)};
   await send(subscription,JSON.stringify(payload),{TTL:3600,timeout:10000});
   complete('accepted');
  }catch(error){
   const status=Number(error?.statusCode);
   if(status===404||status===410){
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=? AND subscription_json=?').run(job.endpoint,job.user_id,job.subscription_json);
    complete('expired',reasonFor(error));
   }else if([400,401,403,413].includes(status)||attempts>=MAX_PUSH_ATTEMPTS){
    complete('failed',reasonFor(error));
   }else{
    const backoff=[15000,60000,120000,300000,600000][Math.min(attempts-1,4)];
    complete('pending',reasonFor(error),now()+backoff);
   }
  }
 }
 let cursor=0;
 const workers=Array.from({length:Math.min(10,rows.length)},async()=>{while(cursor<rows.length)await processJob(rows[cursor++]);});
 await Promise.all(workers);
 return stats;
}
