import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureSocialSchema,handleSocialApi} from '../server/social.mjs';
import {ensurePushQueueSchema} from '../server/notification-delivery.mjs';
import {readFileSync} from 'node:fs';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`
 CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL,avatar_data TEXT NOT NULL DEFAULT '');
 CREATE TABLE friendships(user_a TEXT NOT NULL,user_b TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_a,user_b));
 CREATE TABLE friend_invites(user_id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL);
 CREATE TABLE push_subscriptions(user_id TEXT,endpoint TEXT,subscription_json TEXT);
 CREATE TABLE notifications(id TEXT PRIMARY KEY,event_id TEXT,title TEXT,body TEXT,kind TEXT,target_kind TEXT,target_id TEXT,audience TEXT,status TEXT,scheduled_at INTEGER,created_by TEXT,created_at INTEGER,sent_at INTEGER);
 CREATE TABLE notification_receipts(notification_id TEXT,user_id TEXT,read_at INTEGER,PRIMARY KEY(notification_id,user_id));
 `);
 ensureSocialSchema(db);ensurePushQueueSchema(db);
 db.prepare('INSERT INTO users(id,name) VALUES(?,?)').run('ana','Ana Souza');
 db.prepare('INSERT INTO users(id,name) VALUES(?,?)').run('bruno','Bruno Lima');
 db.prepare('INSERT INTO users(id,name) VALUES(?,?)').run('carla','Carla Lopes');
 return db;
}
async function call(db,acting,route,method='GET',payload={}){
 const res={};
 const handled=await handleSocialApi({db,req:{method,acting,payload},res,url:new URL(route,'http://localhost'),
  getUser:r=>db.prepare('SELECT id,name FROM users WHERE id=?').get(r.acting),readBody:async r=>r.payload,json:(r,status,data)=>{r.status=status;r.data=data;},friendSecret:'ci-test-secret',drainPushQueue:async()=>{}});
 assert.equal(handled,true);
 return res;
}
test('amizade só é criada depois de confirmação via notificação, com prevenção de solicitação duplicada',async()=>{
 const db=fixture();try{
  const searched=await call(db,'ana','/api/friends/search?q=brun');
  assert.equal(searched.status,200);
  assert.equal(searched.data.results[0].name,'Bruno Lima');
  const sent=await call(db,'ana','/api/friends/request','POST',{userId:'bruno'});
  assert.equal(sent.status,200);assert.equal(sent.data.status,'pending');
  const repeat=await call(db,'ana','/api/friends/request','POST',{userId:'bruno'});
  assert.equal(repeat.data.status,'pending');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM friendships').get().n,0);
  const received=await call(db,'bruno','/api/friends/requests');
  assert.equal(received.data.received.length,1);
  const accepted=await call(db,'bruno','/api/friends/respond','POST',{id:received.data.received[0].id,action:'accept'});
  assert.equal(accepted.status,200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM friendships').get().n,1);
  const friends=await call(db,'ana','/api/friends');
  assert.equal(friends.data.friends[0].name,'Bruno Lima');
  const replay=await call(db,'bruno','/api/friends/respond','POST',{id:received.data.received[0].id,action:'accept'});
  assert.equal(replay.status,409);
 }finally{db.close();}
});
test('recusa não cria amizade; usuário não aceita solicitação de terceiro',async()=>{
 const db=fixture();try{
  await call(db,'ana','/api/friends/request','POST',{userId:'bruno'});
  const received=(await call(db,'bruno','/api/friends/requests')).data.received[0];
  assert.equal((await call(db,'carla','/api/friends/respond','POST',{id:received.id,action:'accept'})).status,404);
  assert.equal((await call(db,'bruno','/api/friends/respond','POST',{id:received.id,action:'reject'})).status,200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM friendships').get().n,0);
 }finally{db.close();}
});
test('criar, convidar e entrar em grupo exige link; membros permanecem independentes das amizades',async()=>{
 const db=fixture();try{
  const created=await call(db,'ana','/api/groups/create','POST',{name:'Galera do Rolê',description:'Música',color:'#8957e5'});
  assert.equal(created.status,201);
  const g=created.data.group;
  const invited=await call(db,'ana','/api/groups/invite','POST',{id:g.id});
  assert.equal(invited.status,200);
  const preview=await call(db,'bruno','/api/groups/preview?token='+invited.data.token);
  assert.equal(preview.data.group.name,'Galera do Rolê');
  assert.equal(preview.data.group.avatars,undefined);
  const joined=await call(db,'bruno','/api/groups/join','POST',{token:invited.data.token});
  assert.equal(joined.status,200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM friendships').get().n,0);
  const detail=await call(db,'ana','/api/groups/detail?id='+g.id);
  assert.equal(detail.data.group.members.length,2);
  assert.equal((await call(db,'carla','/api/groups/detail?id='+g.id)).status,404);
  const left=await call(db,'bruno','/api/groups/leave','POST',{id:g.id});
  assert.equal(left.status,200);
  assert.equal((await call(db,'ana','/api/groups/detail?id='+g.id)).data.group.memberCount,1);
 }finally{db.close();}
});
test('somente o administrador remove membros, mas todo membro pode sair',async()=>{
 const db=fixture();try{
  const g=(await call(db,'ana','/api/groups/create','POST',{name:'Grupo Um'})).data.group;
  const token=(await call(db,'ana','/api/groups/invite','POST',{id:g.id})).data.token;
  await call(db,'bruno','/api/groups/join','POST',{token});
  await call(db,'carla','/api/groups/join','POST',{token});
  assert.equal((await call(db,'bruno','/api/groups/remove','POST',{id:g.id,userId:'carla'})).status,403);
  assert.equal((await call(db,'ana','/api/groups/remove','POST',{id:g.id,userId:'carla'})).status,200);
  assert.equal((await call(db,'ana','/api/groups/detail?id='+g.id)).data.group.memberCount,2);
 }finally{db.close();}
});
test('fotos ou iniciais e visualização por grupos exigem consentimento explícito',()=>{
 const avatar=readFileSync(new URL('../artifacts/submundo-808/src/components/social-avatar.tsx',import.meta.url),'utf8');
 const frontend=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');
 const notifications=readFileSync(new URL('../artifacts/submundo-808/src/components/notification-center.tsx',import.meta.url),'utf8');
 assert.match(avatar,/parts\[0\]\?\.\[0\]/);
 assert.match(avatar,/parts\[1\]\?\.\[0\]/);
 assert.match(frontend,/Compartilhar também com meus grupos/);
 assert.match(backend,/p.share_with_groups=1/);
 assert.match(notifications,/Aceitar amizade/);
 assert.match(notifications,/Recusar/);
});


test('edição de grupo respeita permissão definida exclusivamente pelo administrador',async()=>{
 const db=fixture();try{
  const created=await call(db,'ana','/api/groups/create','POST',{name:'Galera'});
  const id=created.data.group.id;
  const token=(await call(db,'ana','/api/groups/invite','POST',{id})).data.token;
  await call(db,'bruno','/api/groups/join','POST',{token});
  const request={id,name:'Novo nome',description:'Nova descrição',color:'#8957e5',icon:'music',editPolicy:'everyone'};
  assert.equal((await call(db,'bruno','/api/groups/edit','POST',request)).status,403);
  assert.equal((await call(db,'ana','/api/groups/edit','POST',request)).status,200);
  const updated=await call(db,'bruno','/api/groups/edit','POST',{...request,name:'Editado por Bruno',editPolicy:'admin'});
  assert.equal(updated.status,200);
  assert.equal(updated.data.group.name,'Editado por Bruno');
  assert.equal(updated.data.group.editPolicy,'everyone');
  assert.equal((await call(db,'bruno','/api/groups/delete','POST',{id,confirmation:'EXCLUIR'})).status,403);
 }finally{db.close();}
});


test('amigos podem ser convidados por nome ao grupo, mas entrada depende de aceite',async()=>{
 const db=fixture();try{
  const group=(await call(db,'ana','/api/groups/create','POST',{name:'Nova galera'})).data.group;
  const searched=await call(db,'ana','/api/groups/friends?q=bruno');
  assert.equal(searched.status,200);assert.equal(searched.data.friends.length,0);
  await call(db,'ana','/api/friends/request','POST',{userId:'bruno'});
  const friendRequest=(await call(db,'bruno','/api/friends/requests')).data.received[0];
  await call(db,'bruno','/api/friends/respond','POST',{id:friendRequest.id,action:'accept'});
  const found=await call(db,'ana','/api/groups/friends?q=bru');
  assert.equal(found.status,200);assert.equal(found.data.friends[0].name,'Bruno Lima');
  const disallowed=await call(db,'carla','/api/groups/invite-friends','POST',{id:group.id,friendIds:['bruno']});
  assert.equal(disallowed.status,404);
  const sent=await call(db,'ana','/api/groups/invite-friends','POST',{id:group.id,friendIds:['bruno','carla']});
  assert.equal(sent.status,200);assert.deepEqual(sent.data.invited,['bruno']);assert.deepEqual(sent.data.skipped,['carla']);
  assert.equal((await call(db,'ana','/api/groups/detail?id='+group.id)).data.group.memberCount,1);
  const invitation=db.prepare('SELECT * FROM friend_group_invitations WHERE recipient_id=?').get('bruno');
  assert.equal((await call(db,'carla','/api/groups/invitation/respond','POST',{id:invitation.id,action:'accept'})).status,404);
  assert.equal((await call(db,'bruno','/api/groups/invitation/respond','POST',{id:invitation.id,action:'accept'})).status,200);
  assert.equal((await call(db,'bruno','/api/groups/invitation/respond','POST',{id:invitation.id,action:'accept'})).status,409);
  const detail=(await call(db,'ana','/api/groups/detail?id='+group.id)).data.group;
  assert.equal(detail.memberCount,2);
  assert.equal(detail.members.find(m=>m.id==='bruno').relation,'friends');
  assert.equal((await call(db,'bruno','/api/groups/invite-friends','POST',{id:group.id,friendIds:['ana']})).status,403);
 }finally{db.close();}
});


test('proprietário promove e rebaixa administradores, e admins gerenciam somente integrantes comuns',async()=>{
 const db=fixture();try{
  const g=(await call(db,'ana','/api/groups/create','POST',{name:'Galera especial'})).data.group;
  const token=(await call(db,'ana','/api/groups/invite','POST',{id:g.id})).data.token;
  await call(db,'bruno','/api/groups/join','POST',{token});
  await call(db,'carla','/api/groups/join','POST',{token});
  assert.equal((await call(db,'bruno','/api/groups/role','POST',{id:g.id,userId:'carla',role:'admin'})).status,403);
  assert.equal((await call(db,'ana','/api/groups/role','POST',{id:g.id,userId:'ana',role:'member'})).status,400);
  assert.equal((await call(db,'ana','/api/groups/role','POST',{id:g.id,userId:'bruno',role:'admin'})).status,200);
  const detail=(await call(db,'bruno','/api/groups/detail?id='+g.id)).data.group;
  assert.equal(detail.role,'admin');
  assert.equal(detail.members.find(p=>p.id==='bruno').role,'admin');
  assert.equal((await call(db,'bruno','/api/groups/edit','POST',{id:g.id,name:'Galera nova',description:'Atualizada',color:'#14b87a',icon:'fire',editPolicy:'everyone'})).status,200);
  assert.equal((await call(db,'ana','/api/groups/detail?id='+g.id)).data.group.editPolicy,'admin');
  assert.equal((await call(db,'bruno','/api/groups/delete','POST',{id:g.id,confirmation:'EXCLUIR'})).status,403);
  assert.equal((await call(db,'bruno','/api/groups/remove','POST',{id:g.id,userId:'ana'})).status,403);
  assert.equal((await call(db,'bruno','/api/groups/remove','POST',{id:g.id,userId:'carla'})).status,200);
  assert.equal((await call(db,'ana','/api/groups/role','POST',{id:g.id,userId:'bruno',role:'member'})).status,200);
  assert.equal((await call(db,'bruno','/api/groups/edit','POST',{id:g.id,name:'Sem acesso',description:'',color:'#14b87a',icon:'users'})).status,403);
 }finally{db.close();}
});

test('grupo guarda foto otimizada e rejeita arquivos enormes ou de formato incorreto',async()=>{
 const db=fixture();try{
  const g=(await call(db,'ana','/api/groups/create','POST',{name:'Com foto'})).data.group;
  const data=Buffer.alloc(24);data.write('RIFF',0);data.write('WEBP',8);data.write('VP8 ',12);
  const photo='data:image/webp;base64,'+data.toString('base64');
  const saved=await call(db,'ana','/api/groups/edit','POST',{id:g.id,name:'Com foto',description:'',color:'#8957e5',icon:'users',photo});
  assert.equal(saved.status,200);assert.equal(saved.data.group.photo,photo);
  assert.equal((await call(db,'ana','/api/groups')).data.groups[0].photo,photo);
  assert.equal((await call(db,'ana','/api/groups/edit','POST',{id:g.id,name:'Com foto',description:'',color:'#8957e5',icon:'users',photo:'data:image/svg+xml;base64,AAA'})).status,400);
  assert.equal((await call(db,'ana','/api/groups/edit','POST',{id:g.id,name:'Com foto',description:'',color:'#8957e5',icon:'users',photo:'data:image/webp;base64,'+'A'.repeat(170000)})).status,400);
  const cleared=await call(db,'ana','/api/groups/edit','POST',{id:g.id,name:'Sem foto',description:'',color:'#8957e5',icon:'heart',photo:''});
  assert.equal(cleared.status,200);assert.equal(cleared.data.group.photo,'');assert.equal(cleared.data.group.icon,'heart');
  assert.equal((await call(db,'ana','/api/groups/create','POST',{name:'Foto nova',photo})).status,201);
 }finally{db.close();}
});
