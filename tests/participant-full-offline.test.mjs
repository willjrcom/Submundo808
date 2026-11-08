import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const src=read('artifacts/submundo-808/src/components/offline-private-data.ts');
const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const originalStorage=globalThis.localStorage;
const originalNavigator=globalThis.navigator;
const originalFetch=globalThis.fetch;
const storage=new Map();
globalThis.localStorage={
 getItem:key=>storage.get(key)??null,
 setItem:(key,val)=>storage.set(key,String(val)),
 removeItem:key=>storage.delete(key)
};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
const offline=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

const meA={user:{id:'a-1',name:'Participante A',email:'a@example.com',phone:'551599998888',avatar:''}};
const meB={user:{id:'b-2',name:'Participante B',email:'b@example.com',avatar:''}};
const friendsA={friends:[{id:'f-1',name:'Amigo um'},{id:'f-2',name:'Amigo dois'}]};
const groupsA={groups:[{id:'g-one',name:'Meu grupo',color:'#c4ff40',memberCount:2,avatars:[]}]};
const detailA={group:{id:'g-one',name:'Meu grupo',members:[{id:'a-1',name:'Participante A',role:'owner',relation:'self'}],role:'owner',memberCount:1}};
const ticketsA={events:[{event_id:'e-1',name:'Festa',tickets:[{id:'t-1',name:'Entrada',qrCodeDataUrl:'data:image/png;base64,QUJD',usedAt:null}]}]};

const responses=new Map([
 ['/api/auth/me',meA],['/api/friends',friendsA],['/api/groups',groupsA],
 ['/api/groups/detail?id=g-one',detailA],['/api/auth/connections',{providers:['meaple']}],
 ['/api/meaple/tickets',ticketsA]
]);
globalThis.fetch=async(path)=>{
 const url=String(path),body=responses.get(url);
 if(!body)return {ok:false,status:404,json:async()=>({error:'Not found'})};
 return {ok:true,status:200,json:async()=>body};
};
test('sincroniza usuário e recupera Amigos, grupos, detalhes e ingressos offline sem rede',async()=>{
 storage.clear();
 globalThis.navigator.onLine=true;
 await offline.warmParticipantPrivateOffline();
 assert.equal(offline.getOfflineProfile().id,'a-1');
 assert.equal(offline.getCachedFriendCode(),'');
 offline.saveCachedFriendCode('c'.repeat(64));
 globalThis.navigator.onLine=false;
 globalThis.fetch=()=>{throw Error('Network must never be called while offline');};
 assert.deepEqual(await offline.privateParticipantGet('/api/auth/me'),meA);
 assert.deepEqual(await offline.privateParticipantGet('/api/friends'),friendsA);
 assert.deepEqual(await offline.privateParticipantGet('/api/groups'),groupsA);
 assert.deepEqual(await offline.privateParticipantGet('/api/groups/detail?id=g-one'),detailA);
 assert.deepEqual(await offline.privateParticipantGet('/api/auth/connections'),{providers:['meaple']});
 assert.deepEqual(await offline.privateParticipantGet('/api/meaple/tickets'),ticketsA);
 assert.equal(offline.getCachedFriendCode(),'c'.repeat(64));
});
test('rede instável com HTTP 503 mostra dados já sincronizados, sem mascarar um erro de autenticação',async()=>{
 globalThis.navigator.onLine=true;
 globalThis.fetch=async()=>({ok:false,status:503,json:async()=>({error:'Serviço indisponível'})});
 assert.deepEqual(await offline.privateParticipantGet('/api/friends'),friendsA);
 assert.deepEqual(await offline.privateParticipantGet('/api/groups/detail?id=g-one'),detailA);
 assert.deepEqual(await offline.privateParticipantGet('/api/auth/me'),meA);
});
test('não armazena GPS de amigos, sessão ou buscas/convites por token',()=>{
 for(const path of [
  '/api/location/friends','/api/location/positions','/api/groups/preview?token=abc',
  '/api/friends/search?q=person','/api/auth/login','/api/notifications',
  'https://example.com/api/auth/me'
 ])assert.equal(offline.allowedOfflinePrivatePath(path),false,path);
 const raw=storage.get(offline.OFFLINE_PRIVATE_KEY);
 assert.ok(raw);
 for(const secret of ['"accessToken"','"password"','"lat"','"lng"'])
  assert.equal(raw.includes(secret),false,secret);
});
test('a troca de conta não expõe dados da conta anterior nem o QR de amizade',async()=>{
 globalThis.navigator.onLine=true;
 globalThis.fetch=async(path)=>({ok:true,status:200,json:async()=>String(path)==='/api/auth/me'?meB:{friends:[]}});
 await offline.privateParticipantGet('/api/auth/me');
 assert.equal(offline.getOfflineProfile().id,'b-2');
 assert.equal(offline.getCachedFriendCode(),'');
 assert.equal(offline.getOfflinePrivateResponse('/api/friends'),null);
 assert.equal(offline.getOfflinePrivateResponse('/api/groups/detail?id=g-one'),null);
});
test('resposta HTTP 401 é respeitada, não recupera sessão antiga do cache',async()=>{
 globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({error:'Entre na sua conta.'})});
 await assert.rejects(offline.privateParticipantGet('/api/auth/me'),e=>e.status===401);
 assert.equal(offline.getOfflineProfile(),null);
});
test('cópias são eliminadas ao sair da conta e expiram após 30 dias',()=>{
 offline.saveOfflinePrivateResponse('/api/auth/me',meA);
 offline.saveCachedFriendCode('c'.repeat(64));
 assert.equal(offline.getCachedFriendCode(),'c'.repeat(64));
 const snapshot=JSON.parse(storage.get(offline.OFFLINE_PRIVATE_KEY));
 snapshot.updatedAt=Date.now()-offline.OFFLINE_PRIVATE_TTL_MS-1000;
 storage.set(offline.OFFLINE_PRIVATE_KEY,JSON.stringify(snapshot));
 assert.equal(offline.getOfflineProfile(),null);
 offline.saveOfflinePrivateResponse('/api/auth/me',meA);
 offline.clearOfflineParticipantData();
 assert.equal(offline.getOfflineProfile(),null);
 assert.equal(offline.getCachedFriendCode(),'');
});
test('as cinco abas mantêm suas telas habituais e os QR Codes são gerados localmente',()=>{
 const app=read('artifacts/submundo-808/src/App.tsx');
 const friends=read('artifacts/submundo-808/src/components/friends.tsx');
 const groups=read('artifacts/submundo-808/src/components/friend-groups.tsx');
 const account=read('artifacts/submundo-808/src/components/account.tsx');
 const tickets=read('artifacts/submundo-808/src/components/meaple-tickets.tsx');
 const qr=read('artifacts/submundo-808/src/components/friend-qr.tsx');
 const sw=read('artifacts/submundo-808/public/sw.js');
 assert.match(app,/warmParticipantOffline/);
 assert.match(app,/warmParticipantPrivateOffline/);
 assert.match(friends,/privateParticipantGet.*'\/api\/friends'/);
 assert.match(friends,/tab==='groups'\?<><FriendGroups/);
 assert.match(groups,/privateParticipantGet<Record<string,any>>\('\/api\/groups'\+route\)/);
 assert.match(groups,/setSelected\(j\.group\)/);
 assert.match(account,/privateParticipantGet<\{user:User\|null\}>\('\/api\/auth\/me'\)/);
 assert.match(account,/clearOfflineParticipantData\(\)/);
 assert.match(account,/Perfil salvo neste aparelho/);
 assert.match(tickets,/privateParticipantGet<\{events:Event\[\]\}>\('\/api\/meaple\/tickets'\)/);
 assert.match(qr,/<GroupInviteQRCode link=\{link\} size=\{260\}/);
 assert.match(qr,/saveCachedFriendCode\(d\.token\)/);
 assert.doesNotMatch(qr,/api\.qrserver\.com/);
 assert.match(sw,/if\(!isPublicApi\(url\)\)return/);
});
test('um carregamento iniciado antes do logout não restaura dados privados',async()=>{
 storage.clear();
 offline.saveOfflinePrivateResponse('/api/auth/me',meA);
 globalThis.navigator.onLine=true;
 let deliver=()=>{};
 globalThis.fetch=()=>new Promise(resolve=>{deliver=()=>resolve({ok:true,status:200,json:async()=>friendsA});});
 const inFlight=offline.privateParticipantGet('/api/friends');
 offline.clearOfflineParticipantData();
 deliver();
 await inFlight;
 assert.equal(offline.getOfflineProfile(),null);
 assert.equal(offline.getOfflinePrivateResponse('/api/friends'),null);
});
test.after(()=>{
 if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;
 if(originalNavigator===undefined)delete globalThis.navigator;else Object.defineProperty(globalThis,'navigator',{value:originalNavigator,configurable:true});
 if(originalFetch===undefined)delete globalThis.fetch;else globalThis.fetch=originalFetch;
});
