import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('artifacts/submundo-808/src/components/group-invite-cache.ts');
const translated=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const originalLocal=globalThis.localStorage,originalWindow=globalThis.window;
const storage=new Map();
globalThis.localStorage={
 getItem:key=>storage.get(key)??null,
 setItem:(key,value)=>storage.set(key,value),
 removeItem:key=>storage.delete(key)
};
globalThis.window={location:{origin:'https://submundo.menudevendas.com.br'}};
const invites=await import('data:text/javascript;base64,'+Buffer.from(translated).toString('base64'));
const token='a'.repeat(64);

test('convite emitido online é recuperado offline sem consultar o backend',()=>{
 storage.clear();
 invites.cacheGroupInvite('g1','Grupo da festa',token,1000);
 assert.equal(invites.getCachedGroupInvites(1001).length,1);
 assert.equal(invites.getCachedGroupInvites(1001)[0].token,token);
 assert.equal(invites.groupInviteUrl(token),'https://submundo.menudevendas.com.br/groups?group_invite='+token);
 assert.equal(invites.findCachedGroupInvite('g1')?.token,undefined); // 30-day limit prevents stale tokens
});

test('QR Code salvo é disponibilizado durante 30 dias e excluído ao sair do grupo ou conta',()=>{
 storage.clear();
 const now=Date.now();
 invites.cacheGroupInvite('g1','Grupo A',token,now);
 assert.equal(invites.findCachedGroupInvite('g1')?.token,token);
 assert.equal(invites.getCachedGroupInvites(now+29*24*60*60*1000).length,1);
 assert.equal(invites.getCachedGroupInvites(now+30*24*60*60*1000).length,0);
 invites.cacheGroupInvite('g1','Grupo A',token,now);
 invites.removeCachedGroupInvite('g1');
 assert.equal(invites.findCachedGroupInvite('g1'),undefined);
 invites.cacheGroupInvite('g1','Grupo A',token,now);
 invites.clearCachedGroupInvites();
 assert.equal(invites.getCachedGroupInvites().length,0);
});

test('token inválido não é persistido, reemissão do mesmo grupo substitui o antigo',()=>{
 storage.clear();
 const now=Date.now();
 invites.cacheGroupInvite('g1','Grupo','not-a-token',now);
 assert.equal(invites.getCachedGroupInvites().length,0);
 invites.cacheGroupInvite('g1','Grupo A','a'.repeat(64),now);
 invites.cacheGroupInvite('g1','Grupo A','b'.repeat(64),now);
 assert.equal(invites.getCachedGroupInvites().length,1);
 assert.equal(invites.findCachedGroupInvite('g1').token,'b'.repeat(64));
});

test('QR tem matriz local legível com margem de silêncio, sem imagens de terceiros',()=>{
 const pkgRequire=createRequire(new URL('../artifacts/submundo-808/package.json',import.meta.url));
 const qrcode=pkgRequire('qrcode-generator');
 const qr=qrcode(0,'M');
 qr.addData(invites.groupInviteUrl(token));
 qr.make();
 const count=qr.getModuleCount();
 assert.ok(count>21&&count<=177,'Matriz QR deve ter versão QR padrão');
 assert.equal(typeof qr.isDark(0,0),'boolean');
 const component=read('artifacts/submundo-808/src/components/group-invite-qr-code.tsx');
 assert.match(component,/import qrcode from 'qrcode-generator'/);
 assert.match(component,/qr\.addData\(link\)/);
 assert.match(component,/qr\.make\(\)/);
 assert.match(component,/qr\.isDark\(y,x\)/);
 assert.match(component,/margin=4/);
 assert.match(component,/role="img"/);
 assert.match(component,/<svg/);
 assert.doesNotMatch(component,/https?:\/\//);
});

test('modal e recuperação offline usam convite salvo; URLs autenticadas continuam fora do Service Worker',()=>{
 const group=read('artifacts/submundo-808/src/components/friend-groups.tsx');
 const friends=read('artifacts/submundo-808/src/components/friends.tsx');
 const offline=read('artifacts/submundo-808/src/components/offline-group-invites.tsx');
 const account=read('artifacts/submundo-808/src/components/account.tsx');
 const sw=read('artifacts/submundo-808/public/sw.js');
 assert.match(group,/findCachedGroupInvite\(selected\.id\)/);
 assert.match(group,/cacheGroupInvite\(selected\.id,selected\.name,j\.token\)/);
 assert.match(group,/if\(!navigator\.onLine\)/);
 assert.match(group,/<GroupInviteQRCode link=\{inviteLink\}/);
 assert.doesNotMatch(group,/api\.qrserver\.com/);
 assert.match(friends,/access==='error'&&!navigator\.onLine/);
 assert.match(friends,/<OfflineGroupInvites\/>/);
 assert.match(offline,/getCachedGroupInvites\(\)/);
 assert.match(offline,/<GroupInviteQRCode link=\{link\}/);
 assert.match(account,/await request\('logout',\{\}\);clearCachedGroupInvites\(\)/);
 assert.match(sw,/if\(!isPublicApi\(url\)\)return/);
 assert.doesNotMatch(sw,/group-invite-cache|group_invite/);
});

test.after(()=>{
 if(originalLocal===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalLocal;
 if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
});
