import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {matchesSearch} from './search-normalize.mjs';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export class AdminAccessError extends Error{
 constructor(status,message){super(message);this.status=status;}
}
const invalid=(message)=>{throw new AdminAccessError(400,message);};
const conflict=(message)=>{throw new AdminAccessError(409,message);};
const forbidden=()=>{throw new AdminAccessError(403,'Apenas proprietários podem gerenciar administradores.');};
const roleOk=role=>role==='owner'||role==='admin';
const emailOf=value=>String(value??'').trim().toLowerCase();
const nameOf=value=>String(value??'').trim();

export function ensureAdminAccessSchema(db){
 const columns=db.prepare('PRAGMA table_info(admin_users)').all().map(row=>row.name);
 if(!columns.includes('role'))db.exec("ALTER TABLE admin_users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('owner','admin'))");
 if(!columns.includes('granted_by'))db.exec('ALTER TABLE admin_users ADD COLUMN granted_by TEXT');
 db.exec('CREATE TABLE IF NOT EXISTS admin_access_audit (id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,target_user_id TEXT NOT NULL,action TEXT NOT NULL,old_role TEXT,new_role TEXT,created_at INTEGER NOT NULL)');
}
export function adminRole(db,userId){
 if(!userId)return null;
 const row=db.prepare('SELECT role FROM admin_users WHERE user_id=?').get(userId);
 return row&&roleOk(row.role)?row.role:null;
}
const ownerCount=db=>Number(db.prepare("SELECT COUNT(*) AS n FROM admin_users WHERE role='owner'").get().n);
const firstAdminId=db=>db.prepare('SELECT user_id FROM admin_users ORDER BY created_at ASC,user_id ASC LIMIT 1').get()?.user_id;
const canBootstrap=(db,actor)=>ownerCount(db)===0&&adminRole(db,actor?.id)==='admin'&&firstAdminId(db)===actor.id;
const transaction=(db,cb)=>{
 db.exec('BEGIN IMMEDIATE');
 try{const result=cb();db.exec('COMMIT');return result;}
 catch(error){db.exec('ROLLBACK');throw error;}
};
function audit(db,actorId,targetId,action,oldRole,newRole){
 db.prepare('INSERT INTO admin_access_audit(id,actor_id,target_user_id,action,old_role,new_role,created_at) VALUES(?,?,?,?,?,?,?)')
  .run(randomUUID(),actorId,targetId,action,oldRole,newRole,Date.now());
}
const getAdmin=(db,id)=>db.prepare(
 'SELECT a.user_id AS id,u.name,u.email,a.role,a.created_at,a.granted_by FROM admin_users a JOIN users u ON u.id=a.user_id WHERE a.user_id=?'
).get(id);
const requireOwner=(db,actor)=>{if(adminRole(db,actor.id)!=='owner')forbidden();};

export async function handleAdminAccess({
 db,actor,key,method,url,data={},passwordHash,sendInvite=null,
 mailConfigured=false,baseUrl=''
}){
 try{
  if(!adminRole(db,actor?.id))forbidden();
  if(key==='admins'&&method==='GET'){
   const items=db.prepare('SELECT a.user_id AS id,u.name,u.email,a.role,a.created_at,a.granted_by FROM admin_users a JOIN users u ON u.id=a.user_id ORDER BY a.created_at ASC,a.user_id ASC').all();
   return {status:200,body:{items,role:adminRole(db,actor.id),ownerCount:ownerCount(db),bootstrapEligible:canBootstrap(db,actor)}};
  }
  if(key==='admins-audit'&&method==='GET'){
   requireOwner(db,actor);
   const items=db.prepare(
    'SELECT l.id,l.actor_id,l.target_user_id,l.action,l.old_role,l.new_role,l.created_at,actor.name AS actor_name,target.name AS target_name FROM admin_access_audit l LEFT JOIN users actor ON actor.id=l.actor_id LEFT JOIN users target ON target.id=l.target_user_id ORDER BY l.created_at DESC,l.id DESC LIMIT 100'
   ).all();
   return {status:200,body:{items}};
  }
  if(key==='admins-search'&&method==='GET'){
   requireOwner(db,actor);
   const q=String(url?.searchParams.get('q')||'').trim();
   if(q.length<2||q.length>80)return {status:200,body:{items:[]}};
   const items=db.prepare("SELECT u.id,u.name,u.email FROM users u LEFT JOIN admin_users a ON a.user_id=u.id WHERE a.user_id IS NULL ORDER BY u.name").all()
    .filter(item=>matchesSearch([item.name,item.email],q)).slice(0,15);
   return {status:200,body:{items}};
  }
  if(key!=='admins'||method!=='POST')return {status:405,body:{error:'Operação não permitida.'}};
  const action=String(data?.action||'');
  if(action==='bootstrap'){
   if(adminRole(db,actor.id)!=='admin')forbidden();
   transaction(db,()=>{
    if(ownerCount(db)!==0)conflict('O proprietário já foi definido.');
    if(firstAdminId(db)!==actor.id)forbidden();
    const updated=db.prepare("UPDATE admin_users SET role='owner',granted_by=? WHERE user_id=? AND role='admin'").run(actor.id,actor.id);
    if(updated.changes!==1)conflict('Não foi possível concluir a atribuição do primeiro proprietário.');
    audit(db,actor.id,actor.id,'bootstrap','admin','owner');
   });
   return {status:200,body:{ok:true,role:'owner'}};
  }
  requireOwner(db,actor);
  if(action==='create'){
   const email=emailOf(data.email),name=nameOf(data.name),role=data.role||'admin';
   if(!EMAIL.test(email)||email.length>254)invalid('Informe um e-mail válido.');
   if(!roleOk(role))invalid('Nível de acesso inválido.');
   const existing=db.prepare('SELECT id,name,email FROM users WHERE email=?').get(email);
   if(existing&&adminRole(db,existing.id))conflict('Esta conta já é administradora.');
   if(!existing&&(name.length<2||name.length>60))invalid('Informe um nome de 2 a 60 caracteres para criar a conta.');
   const generatedPassword=existing?null:randomBytes(24).toString('base64url');
   const userId=existing?.id||randomUUID();
   const inviteToken=!existing&&mailConfigured?randomBytes(32).toString('hex'):null;
   transaction(db,()=>{
    if(!existing){
     db.prepare('INSERT INTO users(id,name,email,password,created_at) VALUES(?,?,?,?,?)')
      .run(userId,name,email,passwordHash(generatedPassword),Date.now());
    }
    db.prepare('INSERT INTO admin_users(user_id,created_at,role,granted_by) VALUES(?,?,?,?)')
     .run(userId,Date.now(),role,actor.id);
    audit(db,actor.id,userId,'grant',null,role);
    if(inviteToken){
     const tokenHash=createHash('sha256').update(inviteToken).digest('hex');
     db.prepare('INSERT INTO resets(token_hash,user_id,expires_at) VALUES(?,?,?)')
      .run(tokenHash,userId,Date.now()+30*60_000);
    }
   });
   let emailSent=false;
   if(inviteToken&&sendInvite){
    try{
     const link=String(baseUrl).replace(/\/$/,'')+'/reset-password?reset='+encodeURIComponent(inviteToken);
     await sendInvite(email,link);
     emailSent=true;
    }catch{
     const tokenHash=createHash('sha256').update(inviteToken).digest('hex');
     db.prepare('DELETE FROM resets WHERE token_hash=?').run(tokenHash);
    }
   }
   return {status:201,body:{ok:true,item:getAdmin(db,userId),newAccount:!existing,
    tempPassword:generatedPassword||undefined,emailSent}};
  }
  if(action==='update'||action==='revoke'){
   const id=String(data.id||'');
   if(!id||id.length>128)invalid('Administrador inválido.');
   const item=getAdmin(db,id);
   if(!item)throw new AdminAccessError(404,'Administrador não encontrado.');
   if(action==='revoke'){
    transaction(db,()=>{
     if(item.role==='owner'&&ownerCount(db)<=1)conflict('Não é possível remover o último proprietário.');
     db.prepare('DELETE FROM admin_users WHERE user_id=?').run(id);
     audit(db,actor.id,id,'revoke',item.role,null);
    });
    return {status:200,body:{ok:true}};
   }
   const role=String(data.role||''),name=nameOf(data.name);
   if(!roleOk(role))invalid('Nível de acesso inválido.');
   if(name.length<2||name.length>60)invalid('O nome deve ter entre 2 e 60 caracteres.');
   transaction(db,()=>{
    if(item.role==='owner'&&role!=='owner'&&ownerCount(db)<=1)conflict('Não é possível rebaixar o último proprietário.');
    db.prepare('UPDATE users SET name=? WHERE id=?').run(name,id);
    db.prepare('UPDATE admin_users SET role=? WHERE user_id=?').run(role,id);
    audit(db,actor.id,id,'update',item.role,role);
   });
   return {status:200,body:{ok:true,item:getAdmin(db,id)}};
  }
  return {status:400,body:{error:'Ação administrativa inválida.'}};
 }catch(error){
  if(error instanceof AdminAccessError)return {status:error.status,body:{error:error.message}};
  // Do not leak SQL, password hashes or infrastructure details in HTTP errors.
  throw error;
 }
}
