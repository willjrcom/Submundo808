import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const src=read('artifacts/submundo-808/src/components/pending-group-invite.ts');
const compiled=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const originalLocal=globalThis.localStorage;
const store=new Map();
globalThis.localStorage={
 getItem:key=>store.get(key)??null,
 setItem:(key,value)=>store.set(key,value),
 removeItem:key=>store.delete(key)
};
const pending=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const token='a'.repeat(64);
test('a valid group invitation remains persisted during login and OAuth',()=>{
 store.clear();
 assert.equal(pending.captureGroupInviteFromUrl('?group_invite='+token),token);
 assert.equal(pending.getPendingGroupInvite(),token);
 assert.equal(pending.getPendingGroupInvite(Date.now()+500),token);
 assert.equal(pending.readGroupInviteToken('https://submundo.example/groups?group_invite='+token),token);
 assert.equal(pending.getPendingGroupInvite(Date.now()+pending.GROUP_INVITE_TTL_MS+100),'');
});
test('invalid tokens are rejected, and successful join or cancellation clears the saved invitation',()=>{
 store.clear();
 assert.equal(pending.savePendingGroupInvite('javascript:alert(1)'),'');
 assert.equal(pending.savePendingGroupInvite('not-a-token'),'');
 assert.equal(pending.savePendingGroupInvite(token),token);
 pending.clearPendingGroupInvite();
 assert.equal(pending.getPendingGroupInvite(),'');
});
test('an invite deep link opens friends, with login/register inside its screen',()=>{
 const app=read('artifacts/submundo-808/src/App.tsx');
 const friends=read('artifacts/submundo-808/src/components/friends.tsx');
 const groups=read('artifacts/submundo-808/src/components/friend-groups.tsx');
 assert.match(app,/captureGroupInviteFromUrl\(window\.location\.search\)/);
 assert.match(app,/getPendingGroupInvite\(\)/);
 assert.match(app,/\/profile','\/login','\/register'/);
 assert.match(friends,/const \[pendingInvite,setPendingInvite\]/);
 assert.match(friends,/Seu convite está guardado neste aparelho/);
 assert.match(friends,/<Account onUser=\{user=>\{if\(user\)\{/);
 assert.match(groups,/useState\(\(\)=>captureGroupInviteFromUrl\(\)\)/);
 assert.match(groups,/if\(getPendingGroupInvite\(\)\)\{setLinkedInvite\(true\);setMode\('join'\)/);
 assert.match(groups,/clearPendingGroupInvite\(\);setLinkedInvite\(false\)/);
 assert.match(groups,/groupApi\('\/join',\{token:inviteToken\(joinLink\)\}\)/);
});
test('do not auto-join or cache authenticated invitations in the service worker',()=>{
 const groups=read('artifacts/submundo-808/src/components/friend-groups.tsx');
 const sw=read('artifacts/submundo-808/public/sw.js');
 assert.match(groups,/onClick=\{\(\)=>preview\.joined\?void open\(preview\.id\):void join\(\)\}/);
 assert.match(sw,/if\(!isPublicApi\(url\)\)return/);
 assert.match(sw,/allowedPublic=new Set\(\['events','maps','map-detail','menu','branding','event-settings'\]\)/);
});
test.after(()=>{if(originalLocal===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalLocal;});
