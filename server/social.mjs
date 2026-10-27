import {createHash,randomUUID} from 'node:crypto';
import {addNotificationReceipt} from './notification-delivery.mjs';

// A amizade exige aprovação; a participação em grupos não libera localização.
export function ensureSocialSchema(db){
 db.exec(`CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,requester_id TEXT NOT NULL,recipient_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,responded_at INTEGER,
  UNIQUE(requester_id,recipient_id)
 );
 CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient ON friend_requests(recipient_id,status);
 CREATE TABLE IF NOT EXISTS friend_groups (
  id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#8957e5',invite_hash TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL
 );
 CREATE TABLE IF NOT EXISTS friend_group_members (
  group_id TEXT NOT NULL,user_id TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'member',joined_at INTEGER NOT NULL,
  PRIMARY KEY(group_id,user_id)
 );
 CREATE INDEX IF NOT EXISTS idx_friend_group_members_user ON friend_group_members(user_id,group_id);
 CREATE TABLE IF NOT EXISTS group_alerts(id TEXT PRIMARY KEY,group_id TEXT NOT NULL,sender_id TEXT NOT NULL,code TEXT NOT NULL,event_id TEXT,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_group_alerts_group ON group_alerts(group_id,created_at);`);
}

const sha256=s=>createHash('sha256').update(s).digest('hex');
const validColor=s=>/^#[0-9a-fA-F]{6}$/.test(s);
const verifiedId=s=>typeof s==='string'&&s.length>0&&s.length<=100;
const httpError=(status,error)=>Object.assign(new Error(error),{status});
const groupAlerts={
 palco:'Bora pro palco!',bar:'Bora pro bar!',encontro:'Me encontrem aqui!',agua:'Vou pegar água',
 banheiro:'Estou no banheiro',onde:'Onde vocês estão?',entrada:'Estou indo pra entrada',
 bem:'Está tudo bem comigo',mal:'Estou passando mal, preciso de ajuda!',embora:'Estou indo embora',
 roubo:'Fui roubado, preciso de ajuda!'
};

export async function handleSocialApi({db,req,res,url,getUser,readBody,json,friendSecret,drainPushQueue}){
 const pathname=url.pathname;
 const route=pathname.startsWith('/api/groups/')||pathname==='/api/groups'||[
  '/api/friends','/api/friends/add','/api/friends/search','/api/friends/request','/api/friends/respond','/api/friends/requests'
 ].includes(pathname);
 if(!route)return false;
 const user=getUser(req);
 if(!user){json(res,401,{error:'Entre na sua conta.'});return true;}
 const method=req.method;
 const reject=(status,error)=>{json(res,status,{error});return true;};
 const socialNotification=(recipientId,{title,body,targetId,targetKind='friend_request',kind='friend_request'})=>{
  const id=randomUUID(),now=Date.now();
  db.prepare("INSERT INTO notifications(id,event_id,title,body,kind,target_kind,target_id,audience,status,scheduled_at,created_by,created_at,sent_at) VALUES(?,NULL,?,?,?,?,?,'test','sent',NULL,?,?,?)")
   .run(id,title,body,kind,targetKind,targetId,user.id,now,now);
  addNotificationReceipt(db,id,recipientId,now);
  void drainPushQueue();
 };
 const alreadyFriends=(id)=>{
  const [a,b]=[user.id,id].sort();
  return !!db.prepare('SELECT 1 FROM friendships WHERE user_a=? AND user_b=?').get(a,b);
 };
 const sendRequest=(recipientId)=>{
  if(!verifiedId(recipientId)||recipientId===user.id)throw httpError(400,'Selecione outra pessoa.');
  const person=db.prepare('SELECT id,name,avatar_data AS avatar FROM users WHERE id=?').get(recipientId);
  if(!person)throw httpError(404,'Pessoa não encontrada.');
  if(alreadyFriends(recipientId))return {status:'friends',person};
  const reciprocal=db.prepare("SELECT 1 FROM friend_requests WHERE requester_id=? AND recipient_id=? AND status='pending'").get(recipientId,user.id);
  if(reciprocal)throw httpError(409,'Você já recebeu uma solicitação dessa pessoa. Responda nas notificações.');
  let existing=db.prepare('SELECT id,status,created_at FROM friend_requests WHERE requester_id=? AND recipient_id=?').get(user.id,recipientId);
  if(existing?.status==='pending')return {status:'pending',person};
  // Evitar repetição de convites imediatamente após uma recusa.
  if(existing?.status==='rejected'&&Date.now()-existing.created_at<7*86400000)throw httpError(409,'Solicitação recusada recentemente. Aguarde antes de enviar outra.');
  const now=Date.now(),id=randomUUID();
  if(existing)db.prepare("UPDATE friend_requests SET id=?,status='pending',created_at=?,responded_at=NULL WHERE requester_id=? AND recipient_id=?").run(id,now,user.id,recipientId);
  else db.prepare("INSERT INTO friend_requests(id,requester_id,recipient_id,status,created_at) VALUES(?,?,?,'pending',?)").run(id,user.id,recipientId,now);
  socialNotification(recipientId,{title:'Nova solicitação de amizade',body:user.name+' quer adicionar você aos amigos.',targetId:id});
  return {status:'pending',person};
 };
 const groupRow=id=>db.prepare('SELECT * FROM friend_groups WHERE id=?').get(id);
 const member=(id,uid=user.id)=>db.prepare('SELECT role FROM friend_group_members WHERE group_id=? AND user_id=?').get(id,uid);
 const groupSummary=g=>{
  const count=db.prepare('SELECT COUNT(*) AS n FROM friend_group_members WHERE group_id=?').get(g.id).n;
  const avatars=db.prepare('SELECT u.id,u.name,u.avatar_data AS avatar FROM friend_group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=? ORDER BY gm.joined_at LIMIT 5').all(g.id);
  return {id:g.id,name:g.name,description:g.description,color:g.color,ownerId:g.owner_id,memberCount:count,avatars};
 };
 try{
  if(pathname==='/api/friends'&&method==='GET'){
   const friends=db.prepare('SELECT u.id,u.name,u.avatar_data AS avatar FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_a=? THEN f.user_b ELSE f.user_a END WHERE f.user_a=? OR f.user_b=? ORDER BY u.name').all(user.id,user.id,user.id);
   json(res,200,{friends});return true;
  }
  if(pathname==='/api/friends/search'&&method==='GET'){
   const q=String(url.searchParams.get('q')||'').trim().toLocaleLowerCase('pt-BR');
   if(q.length<2)return reject(400,'Digite pelo menos duas letras para pesquisar.');
   const pattern='%'+q.slice(0,70).replace(/[\\%_]/g,c=>'\\'+c)+'%';
   const people=db.prepare("SELECT id,name,avatar_data AS avatar FROM users WHERE id<>? AND lower(name) LIKE ? ESCAPE '\\' ORDER BY name LIMIT 20").all(user.id,pattern);
   const results=people.map(person=>{
    const outgoing=db.prepare("SELECT status FROM friend_requests WHERE requester_id=? AND recipient_id=?").get(user.id,person.id);
    const incoming=db.prepare("SELECT status FROM friend_requests WHERE requester_id=? AND recipient_id=?").get(person.id,user.id);
    return {...person,relation:alreadyFriends(person.id)?'friends':outgoing?.status==='pending'?'sent':incoming?.status==='pending'?'received':'none'};
   });
   json(res,200,{results});return true;
  }
  if(pathname==='/api/friends/add'&&method==='POST'){
   const payload=await readBody(req);let token=String(payload.token||'');
   try{if(token.includes('://'))token=new URL(token).searchParams.get('invite')||'';}catch{}
   if(!/^[a-f0-9]{64}$/.test(token))return reject(400,'QR Code ou link inválido.');
   const invite=db.prepare('SELECT user_id FROM friend_invites WHERE token_hash=?').get(sha256(token));
   if(!invite)return reject(404,'Convite não encontrado.');
   json(res,200,sendRequest(invite.user_id));return true;
  }
  if(pathname==='/api/friends/request'&&method==='POST'){
   const payload=await readBody(req);
   json(res,200,sendRequest(payload.userId));return true;
  }
  if(pathname==='/api/friends/requests'&&method==='GET'){
   const received=db.prepare("SELECT r.id,r.created_at AS createdAt,u.id AS userId,u.name,u.avatar_data AS avatar FROM friend_requests r JOIN users u ON u.id=r.requester_id WHERE r.recipient_id=? AND r.status='pending' ORDER BY r.created_at DESC").all(user.id);
   json(res,200,{received});return true;
  }
  if(pathname==='/api/friends/respond'&&method==='POST'){
   const payload=await readBody(req),id=payload.id,action=payload.action;
   if(!verifiedId(id)||!['accept','reject'].includes(action))return reject(400,'Solicitação inválida.');
   const request=db.prepare('SELECT * FROM friend_requests WHERE id=? AND recipient_id=?').get(id,user.id);
   if(!request)return reject(404,'Solicitação não encontrada.');
   if(request.status!=='pending')return reject(409,'Essa solicitação já foi respondida.');
   db.exec('BEGIN');
   try{
    db.prepare('UPDATE friend_requests SET status=?,responded_at=? WHERE id=?').run(action==='accept'?'accepted':'rejected',Date.now(),id);
    if(action==='accept'){
     const [a,b]=[user.id,request.requester_id].sort();
     db.prepare('INSERT OR IGNORE INTO friendships(user_a,user_b,created_at) VALUES(?,?,?)').run(a,b,Date.now());
    }
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   if(action==='accept')socialNotification(request.requester_id,{title:'Solicitação aceita',body:user.name+' aceitou sua solicitação de amizade.',targetId:user.id,kind:'friend_accepted',targetKind:'friends'});
   json(res,200,{ok:true,status:action==='accept'?'accepted':'rejected'});return true;
  }
  if(pathname==='/api/groups'&&method==='GET'){
   const groups=db.prepare('SELECT g.* FROM friend_groups g JOIN friend_group_members gm ON gm.group_id=g.id WHERE gm.user_id=? ORDER BY g.created_at DESC').all(user.id).map(groupSummary);
   json(res,200,{groups});return true;
  }
  if(pathname==='/api/groups/alerts'&&method==='GET'){
   const id=String(url.searchParams.get('id')||'');
   if(!groupRow(id)||!member(id))return reject(404,'Grupo não encontrado.');
   const alerts=db.prepare('SELECT a.id,a.code,a.created_at AS "createdAt",a.event_id AS "eventId",u.id AS "senderId",u.name AS "senderName",u.avatar_data AS avatar FROM group_alerts a JOIN users u ON u.id=a.sender_id WHERE a.group_id=? ORDER BY a.created_at DESC LIMIT 100').all(id).map(a=>({...a,message:groupAlerts[a.code]||'Aviso'}));
   json(res,200,{alerts});return true;
  }
  if(pathname==='/api/groups/alert'&&method==='POST'){
   const p=await readBody(req),id=String(p.id||''),code=String(p.code||'');
   if(!groupRow(id)||!member(id))return reject(404,'Grupo não encontrado.');
   if(!Object.hasOwn(groupAlerts,code))return reject(400,'Aviso inválido.');
   const now=Date.now();
   const last=db.prepare('SELECT created_at FROM group_alerts WHERE group_id=? AND sender_id=? ORDER BY created_at DESC LIMIT 1').get(id,user.id);
   if(last&&now-last.created_at<60000)return reject(429,'Aguarde 60 segundos antes de enviar outro aviso.');
   const eventId=typeof p.eventId==='string'&&p.eventId.length<=100&&db.prepare('SELECT 1 FROM events WHERE id=? AND is_published=1').get(p.eventId)?p.eventId:null;
   const alertId=randomUUID();
   db.prepare('INSERT INTO group_alerts(id,group_id,sender_id,code,event_id,created_at) VALUES(?,?,?,?,?,?)').run(alertId,id,user.id,code,eventId,now);
   const recipients=db.prepare('SELECT user_id FROM friend_group_members WHERE group_id=? AND user_id<>?').all(id,user.id);
   for(const recipient of recipients){
    socialNotification(recipient.user_id,{title:code==='mal'||code==='roubo'?'Atenção! Aviso da galera':'Aviso do grupo',body:user.name+': '+groupAlerts[code],targetId:id,targetKind:'group_alert',kind:code==='mal'||code==='roubo'?'group_urgent':'group_alert'});
   }
   json(res,201,{ok:true,id:alertId,recipients:recipients.length});return true;
  }
  if(pathname==='/api/groups/create'&&method==='POST'){
   const p=await readBody(req),name=String(p.name||'').trim(),description=String(p.description||'').trim(),color=String(p.color||'#8957e5');
   if(name.length<2||name.length>60||description.length>250||!validColor(color))return reject(400,'Informe um nome válido (2 a 60 caracteres), descrição curta e cor válida.');
   const total=db.prepare('SELECT COUNT(*) AS n FROM friend_group_members WHERE user_id=?').get(user.id).n;
   if(total>=40)return reject(409,'Você atingiu o limite de grupos.');
   const id=randomUUID(),now=Date.now(),token=sha256('group-v1:'+id+':'+friendSecret);
   db.exec('BEGIN');
   try{
    db.prepare('INSERT INTO friend_groups(id,owner_id,name,description,color,invite_hash,created_at) VALUES(?,?,?,?,?,?,?)').run(id,user.id,name,description,color,sha256(token),now);
    db.prepare("INSERT INTO friend_group_members(group_id,user_id,role,joined_at) VALUES(?,?,'owner',?)").run(id,user.id,now);
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   json(res,201,{group:groupSummary(groupRow(id))});return true;
  }
  if(pathname==='/api/groups/detail'&&method==='GET'){
   const id=String(url.searchParams.get('id')||''),group=groupRow(id);
   if(!group||!member(id))return reject(404,'Grupo não encontrado.');
   const members=db.prepare('SELECT u.id,u.name,u.avatar_data AS avatar,gm.role FROM friend_group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=? ORDER BY gm.joined_at').all(id);
   json(res,200,{group:{...groupSummary(group),members,role:member(id).role}});return true;
  }
  if(pathname==='/api/groups/invite'&&method==='POST'){
   const p=await readBody(req),g=groupRow(String(p.id||''));
   if(!g||!member(g.id))return reject(404,'Grupo não encontrado.');
   const token=sha256('group-v1:'+g.id+':'+friendSecret);
   json(res,200,{token});return true;
  }
  if(pathname==='/api/groups/preview'&&method==='GET'){
   const token=String(url.searchParams.get('token')||'');
   if(!/^[a-f0-9]{64}$/.test(token))return reject(400,'Link de convite inválido.');
   const g=db.prepare('SELECT * FROM friend_groups WHERE invite_hash=?').get(sha256(token));
   if(!g)return reject(404,'Convite expirado ou grupo removido.');
   const {id,name,description,color,memberCount}=groupSummary(g);
   json(res,200,{group:{id,name,description,color,memberCount,joined:!!member(g.id)}});return true;
  }
  if(pathname==='/api/groups/join'&&method==='POST'){
   const p=await readBody(req);let token=String(p.token||'');
   try{if(token.includes('://'))token=new URL(token).searchParams.get('group_invite')||'';}catch{}
   if(!/^[a-f0-9]{64}$/.test(token))return reject(400,'Link de convite inválido.');
   const g=db.prepare('SELECT * FROM friend_groups WHERE invite_hash=?').get(sha256(token));
   if(!g)return reject(404,'Grupo não encontrado.');
   if(member(g.id))return json(res,200,{ok:true,joined:true,id:g.id});
   const count=db.prepare('SELECT COUNT(*) AS n FROM friend_group_members WHERE group_id=?').get(g.id).n;
   if(count>=50)return reject(409,'O grupo atingiu o limite de 50 pessoas.');
   const mine=db.prepare('SELECT COUNT(*) AS n FROM friend_group_members WHERE user_id=?').get(user.id).n;
   if(mine>=40)return reject(409,'Você atingiu o limite de 40 grupos.');
   db.prepare("INSERT INTO friend_group_members(group_id,user_id,role,joined_at) VALUES(?,?,'member',?)").run(g.id,user.id,Date.now());
   json(res,200,{ok:true,joined:true,id:g.id});return true;
  }
  if(pathname==='/api/groups/leave'&&method==='POST'){
   const p=await readBody(req),id=String(p.id||''),g=groupRow(id);
   if(!g||!member(id))return reject(404,'Grupo não encontrado.');
   const others=db.prepare('SELECT user_id FROM friend_group_members WHERE group_id=? AND user_id<>? ORDER BY joined_at').all(id,user.id);
   if(g.owner_id===user.id&&others.length){
    if(!verifiedId(p.successorId)||!others.some(m=>m.user_id===p.successorId))return reject(400,'Escolha um integrante válido para ser o próximo administrador.');
   }
   if(others.length===0&&p.confirmation!=='EXCLUIR')return reject(400,'Digite EXCLUIR para encerrar o último grupo.');
   db.exec('BEGIN');
   try{
    if(!others.length){
     db.prepare('DELETE FROM group_alerts WHERE group_id=?').run(id);
    db.prepare('DELETE FROM friend_group_members WHERE group_id=?').run(id);
     db.prepare('DELETE FROM friend_groups WHERE id=?').run(id);
    }else{
     if(g.owner_id===user.id){
      db.prepare('UPDATE friend_groups SET owner_id=? WHERE id=?').run(p.successorId,id);
      db.prepare("UPDATE friend_group_members SET role='owner' WHERE group_id=? AND user_id=?").run(id,p.successorId);
     }
     db.prepare('DELETE FROM friend_group_members WHERE group_id=? AND user_id=?').run(id,user.id);
    }
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   json(res,200,{ok:true,deleted:others.length===0});return true;
  }
  if(pathname==='/api/groups/delete'&&method==='POST'){
   const p=await readBody(req),id=String(p.id||''),g=groupRow(id);
   if(!g)return reject(404,'Grupo não encontrado.');
   if(g.owner_id!==user.id)return reject(403,'Somente o administrador pode excluir o grupo.');
   if(p.confirmation!=='EXCLUIR')return reject(400,'Digite EXCLUIR para confirmar.');
   db.exec('BEGIN');
   try{
    db.prepare('DELETE FROM group_alerts WHERE group_id=?').run(id);
    db.prepare('DELETE FROM friend_group_members WHERE group_id=?').run(id);
    db.prepare('DELETE FROM friend_groups WHERE id=?').run(id);
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   json(res,200,{ok:true,deleted:true});return true;
  }
  if(pathname==='/api/groups/remove'&&method==='POST'){
   const p=await readBody(req),id=String(p.id||''),g=groupRow(id);
   if(!g||g.owner_id!==user.id)return reject(403,'Apenas o administrador do grupo pode remover integrantes.');
   if(!verifiedId(p.userId)||p.userId===user.id)return reject(400,'Selecione outro integrante.');
   db.prepare('DELETE FROM friend_group_members WHERE group_id=? AND user_id=?').run(id,p.userId);
   json(res,200,{ok:true});return true;
  }
  return reject(404,'Operação de amigos ou grupos não encontrada.');
 }catch(e){
  if(e?.status)return reject(e.status,e.message);
  throw e;
 }
}
