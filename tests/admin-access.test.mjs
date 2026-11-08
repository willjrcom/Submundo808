import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {adminRole,ensureAdminAccessSchema,handleAdminAccess} from '../server/admin-access.mjs';

function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,created_at INTEGER NOT NULL)');
 db.exec('CREATE TABLE admin_users(user_id TEXT PRIMARY KEY,created_at INTEGER NOT NULL)');
 db.exec('CREATE TABLE resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL)');
 const insert=(id,name,email,password='hashed:ok')=>db.prepare('INSERT INTO users(id,name,email,password,created_at) VALUES(?,?,?,?,?)').run(id,name,email,password,Date.now());
 insert('root','Administrador inicial','root@exemplo.com');
 insert('staff','Administrador operacional','staff@exemplo.com');
 insert('normal','Participante normal','normal@exemplo.com');
 db.prepare('INSERT INTO admin_users(user_id,created_at) VALUES(?,?)').run('root',Date.now());
 db.prepare('INSERT INTO admin_users(user_id,created_at) VALUES(?,?)').run('staff',Date.now());
 ensureAdminAccessSchema(db);
 const opts={db,passwordHash:pass=>'hashed:'+pass,validPassword:(pass,stored)=>stored==='hashed:'+pass,baseUrl:'https://submundo.example'};
 const call=(actor,key='admins',method='GET',data={},query='')=>handleAdminAccess({...opts,actor:{id:actor},key,method,data,url:new URL('https://submundo.example/api/admin/'+key+query)});
 return {db,call,insert};
}

test('migração preserva administradores existentes sem atribuir propriedade automaticamente',()=>{
 const {db,call}=setup();
 assert.equal(adminRole(db,'root'),'admin');
 assert.equal(adminRole(db,'staff'),'admin');
 assert.equal(adminRole(db,'normal'),null);
 assert.deepEqual(db.prepare('SELECT name FROM pragma_table_info(?)').all('admin_users').map(row=>row.name).filter(n=>['role','granted_by'].includes(n)),['role','granted_by']);
 return call('root').then(res=>{
  assert.equal(res.status,200);
  assert.equal(res.body.ownerCount,0);
  assert.equal(res.body.items.length,2);
  assert.ok(res.body.items.every(item=>!('password' in item)));
  db.close();
 });
});

test('bootstrap exige senha do admin existente e só pode ocorrer uma vez',async()=>{
 const {db,call}=setup();
 assert.equal((await call('normal')).status,403);
 assert.equal((await call('staff','admins','POST',{action:'create',email:'new@exemplo.com',name:'Outro'})).status,403);
 assert.equal((await call('root','admins','POST',{action:'bootstrap',password:'errada'})).status,403);
 assert.equal((await call('root','admins','POST',{action:'bootstrap',password:'ok'})).status,200);
 assert.equal(adminRole(db,'root'),'owner');
 assert.equal((await call('staff','admins','POST',{action:'bootstrap',password:'ok'})).status,409);
 assert.equal(adminRole(db,'staff'),'admin');
 const log=(await call('root','admins-audit')).body.items;
 assert.equal(log[0].action,'bootstrap');
 db.close();
});

test('proprietário promove contas existentes e altera os níveis sem trocar a senha',async()=>{
 const {db,call}=setup();
 await call('root','admins','POST',{action:'bootstrap',password:'ok'});
 const initial=db.prepare('SELECT password FROM users WHERE id=?').get('normal').password;
 const created=await call('root','admins','POST',{action:'create',email:'NORMAL@exemplo.com',role:'admin'});
 assert.equal(created.status,201);
 assert.equal(created.body.newAccount,false);
 assert.equal(created.body.tempPassword,undefined);
 assert.equal(adminRole(db,'normal'),'admin');
 assert.equal(db.prepare('SELECT password FROM users WHERE id=?').get('normal').password,initial);
 assert.equal((await call('root','admins','POST',{action:'create',email:'normal@exemplo.com'})).status,409);
 const updated=await call('root','admins','POST',{action:'update',id:'normal',name:'Gestora de acesso',role:'owner'});
 assert.equal(updated.status,200);
 assert.equal(updated.body.item.role,'owner');
 assert.equal(db.prepare('SELECT name FROM users WHERE id=?').get('normal').name,'Gestora de acesso');
 assert.equal((await call('root','admins','POST',{action:'update',id:'root',name:'Root',role:'admin'})).status,200);
 assert.equal((await call('normal','admins','POST',{action:'revoke',id:'normal'})).status,409,'last remaining owner cannot be revoked');
 const reverted=await call('normal','admins','POST',{action:'update',id:'normal',name:'Gestora',role:'admin'});
 assert.equal(reverted.status,409,'last owner cannot be demoted');
 db.close();
});

test('revogação retira acesso imediatamente mas mantém a conta e registra auditoria',async()=>{
 const {db,call}=setup();
 await call('root','admins','POST',{action:'bootstrap',password:'ok'});
 assert.equal((await call('root','admins','POST',{action:'revoke',id:'root'})).status,409);
 assert.equal((await call('root','admins','POST',{action:'revoke',id:'staff'})).status,200);
 assert.equal(adminRole(db,'staff'),null);
 assert.ok(db.prepare('SELECT id FROM users WHERE id=?').get('staff'));
 assert.equal((await call('staff')).status,403);
 const log=(await call('root','admins-audit')).body.items;
 assert.ok(log.some(item=>item.action==='revoke'&&item.target_user_id==='staff'));
 db.close();
});

test('cria conta com senha provisória única e envia convite opcional por e-mail',async()=>{
 const {db,call}=setup();
 await call('root','admins','POST',{action:'bootstrap',password:'ok'});
 const created=await call('root','admins','POST',{action:'create',email:'novo@exemplo.com',name:'Novo gestor',role:'admin'});
 assert.equal(created.status,201);
 assert.equal(created.body.newAccount,true);
 assert.equal(created.body.emailSent,false);
 assert.ok(created.body.tempPassword.length>=20);
 assert.equal(adminRole(db,created.body.item.id),'admin');
 assert.ok(!JSON.stringify((await call('root','admins-audit')).body).includes(created.body.tempPassword));
 const bad=await call('root','admins','POST',{action:'create',email:'invalido',name:'N'});
 assert.equal(bad.status,400);
 const missing=await call('root','admins','POST',{action:'update',id:'inexistente',name:'Nada',role:'admin'});
 assert.equal(missing.status,404);
 db.close();
});

test('consulta candidatos e protege o histórico, aceita convite com token de uso único',async()=>{
 const {db,call}=setup();
 await call('root','admins','POST',{action:'bootstrap',password:'ok'});
 assert.equal((await call('staff','admins-audit')).status,403);
 assert.equal((await call('staff','admins-search','GET',{},'?q=normal')).status,403);
 const found=await call('root','admins-search','GET',{},'?q=normal');
 assert.equal(found.status,200);
 assert.equal(found.body.items[0].id,'normal');
 assert.ok(!('password' in found.body.items[0]));
 let email='',link='';
 const opts={db,actor:{id:'root'},key:'admins',method:'POST',
  passwordHash:pass=>'hashed:'+pass,validPassword:(pass,stored)=>stored==='hashed:'+pass,
  mailConfigured:true,baseUrl:'https://submundo.example',
  sendInvite:async(to,url)=>{email=to;link=url;}};
 const created=await handleAdminAccess({...opts,data:{action:'create',email:'convite@exemplo.com',name:'Convidado'}});
 assert.equal(created.status,201);
 assert.equal(created.body.emailSent,true);
 assert.equal(email,'convite@exemplo.com');
 const token=new URL(link).searchParams.get('reset');
 assert.match(token,/^[a-f0-9]{64}$/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM resets').get().n,1);
 assert.ok(!JSON.stringify((await call('root','admins-audit')).body).includes(token));
 db.close();
});
