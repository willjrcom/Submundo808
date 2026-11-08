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
 assert.match(friends,/Você foi convidado para um grupo/);
 assert.match(friends,/invitePreview\.name/);
 assert.match(friends,/\/api\/public\/group-invite\?token=/);
 assert.match(friends,/Você será adicionado ao grupo automaticamente após o login/);
 assert.match(friends,/<Account onUser=\{user=>\{if\(user\)\{/);
 assert.match(groups,/useState\(\(\)=>captureGroupInviteFromUrl\(\)\)/);
 assert.match(groups,/if\(getPendingGroupInvite\(\)\)\{setLinkedInvite\(true\);setMode\('join'\)/);
 assert.match(groups,/clearPendingGroupInvite\(\);setLinkedInvite\(false\)/);
 assert.match(groups,/groupApi\('\/join',\{token:inviteToken\(joinLink\)\}\)/);
});
test('link de convite entra automaticamente após login; QR manual exige confirmação',()=>{
 const groups=read('artifacts/submundo-808/src/components/friend-groups.tsx');
 const sw=read('artifacts/submundo-808/public/sw.js');
 assert.match(groups,/attemptedAutoJoin=useRef\(''\)/);
 assert.match(groups,/if\(mode!=='join'\|\|!linkedInvite\)return/);
 assert.match(groups,/attemptedAutoJoin\.current===token/);
 assert.match(groups,/attemptedAutoJoin\.current=token;\s*void join\(\)/);
 assert.match(groups,/linkedInvite&&error&&<button/);
 assert.match(groups,/!linkedInvite&&<button type="button" disabled=\{busy\} onClick=\{\(\)=>preview\.joined\?void open\(preview\.id\):void join\(\)\}/);
 assert.match(groups,/window\.history\.replaceState\(\{\},'','\/groups'\)/);
 // Convites e dados privados não devem ser armazenados pelo service worker.
 assert.match(sw,/if\(!isPublicApi\(url\)\)return/);
 assert.match(sw,/allowedPublic=new Set\(\['events','maps','map-detail','menu','branding','event-settings'\]\)/);
});
test.after(()=>{if(originalLocal===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalLocal;});

test('login começa pelas três opções e usa a cor dinâmica da marca para e-mail',()=>{
 const account=read('artifacts/submundo-808/src/components/account.tsx');
 const accent=read('artifacts/submundo-808/src/theme-accent.ts');
 const boot=read('artifacts/submundo-808/src/main.tsx');
 assert.match(account,/const \[emailLoginOpen,setEmailLoginOpen\]=useState\(false\)/);
 assert.match(account,/mode==='login'&&!emailLoginOpen\?/);
 assert.match(account,/Continuar com e-mail/);
 assert.match(account,/Continuar com Google/);
 assert.match(account,/Continuar com Meaple/);
 assert.match(account,/className=\{btn\+' flex min-h-12 items-center justify-center gap-2'\}/);
 assert.match(account,/Outras formas de entrar/);
 assert.match(account,/getPendingGroupInvite\(\)\?'\/groups':'\/profile'/);
 assert.match(accent,/--submundo-accent/);
 assert.match(accent,/bg-\[#c4ff40\]/);
 assert.match(boot,/void loadAccentColor\(\)/);
});
