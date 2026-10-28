import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=(filename)=>readFileSync(new URL('../artifacts/submundo-808/src/components/'+filename,import.meta.url),'utf8');
const permissions=src('profile-permissions.tsx');
const center=src('notification-center.tsx');
const platform=src('pwa-installation.ts');

test('iPhone/iPad detecta instalação via Safari standalone ou display-mode PWA',()=>{
 assert.match(platform,/iPhone\|iPad\|iPod/);
 assert.match(platform,/navigator\.platform==='MacIntel'&&navigator\.maxTouchPoints>1/);
 assert.match(platform,/display-mode: standalone/);
 assert.match(platform,/\.standalone===true/);
 assert.match(platform,/isIosDevice\(\)&&!isPwaInstalled\(\)/);
});

test('linha instalar aplicativo oferece tutorial via Compartilhar do Safari',()=>{
 assert.match(permissions,/>Instalar aplicativo</);
 assert.match(permissions,/const \[tutorialOpen,setTutorialOpen\]=useState\(false\)/);
 assert.match(permissions,/if\(ios\)\{setTutorialOpen\(true\);return;\}/);
 assert.match(permissions,/role="dialog" aria-modal="true" aria-label="Como instalar o Submundo808 no iPhone"/);
 assert.match(permissions,/Abra no Safari/);
 assert.match(permissions,/Toque em Compartilhar/);
 assert.match(permissions,/Adicionar à Tela de Início/);
 assert.match(permissions,/Toque em Adicionar/);
 assert.match(permissions,/WhatsApp/);
 assert.match(permissions,/Ver tutorial/);
 assert.match(permissions,/installed\?<span/);
});

test('ativar push no iPhone exige instalação e não pode ser ignorado no clique',()=>{
 assert.match(permissions,/const needsIosInstall=ios&&!installed/);
 assert.match(permissions,/key==='notifications'&&needsIosInstall/);
 assert.match(permissions,/locked\?<button type="button" disabled/);
 assert.match(permissions,/if\(requiresIosInstallationForPush\(\)\)\{/);
 assert.match(permissions,/setTutorialOpen\(true\)/);
 assert.match(permissions,/window\.addEventListener\('focus',refresh\)/);
 assert.match(permissions,/document\.addEventListener\('visibilitychange',onVisible\)/);
});

test('central de notificações também bloqueia push fora do PWA iOS',()=>{
 assert.match(center,/requiresIosInstallationForPush/);
 assert.match(center,/if\(requiresIosInstallationForPush\(\)\)\{/);
 assert.match(center,/setPushState\('needs-install'\)/);
 assert.match(center,/pushState==='needs-install'&&<p/);
 assert.match(center,/pushState==='disabled'&&<button onClick=\{\(\)=>void enablePush\(\)\}/);
 assert.match(center,/Perfil → Permissões/);
});

test('bloqueio é destacado em vermelho e não se confunde com autorização verde',()=>{
 assert.match(permissions,/const denied=status==='denied'&&!locked/);
 assert.match(permissions,/denied\?'border-rose-400\/55 bg-rose-500\/\[\.09\]'/);
 assert.match(permissions,/denied\?<AlertTriangle aria-label="Permissão bloqueada"/);
 assert.match(permissions,/Acesso negado\. Libere nas configurações/);
 assert.match(permissions,/denied\?<button type="button" disabled=\{!!busy\} onClick=\{\(\)=>explainBlockedPermission\(key\)\}/);
 assert.match(permissions,/Como liberar/);
 assert.match(permissions,/ready\?<span aria-label=\{title\+' autorizada'\}/);
 assert.match(permissions,/denied\|\|warningMessage\?'border-rose-400\/55 bg-rose-500\/15/);
 assert.doesNotMatch(permissions,/status==='denied'\?'Ativar permissão'/);
});

test('mensagens de permissão ficam no próprio card, não no rodapé do modal',()=>{
 assert.match(permissions,/const \[message,setMessage\]=useState\(''\),\[messageKey,setMessageKey\]/);
 assert.match(permissions,/const setNotice=\(key:/);
 assert.match(permissions,/setNotice\('location',denied\?/);
 assert.match(permissions,/setNotice\('notifications','Notificações: '/);
 assert.match(permissions,/setNotice\('camera','Câmera: '/);
 assert.match(permissions,/setNotice\(key as 'location'\|'notifications'\|'camera'/);
 assert.match(permissions,/messageKey===key&&message/);
 assert.match(permissions,/\(denied\|\|\(messageKey===key&&message\)\)&&<div role=/);
 assert.match(permissions,/text-rose-100/);
 assert.match(permissions,/Acesso bloqueado\. Para liberar, toque em Como liberar/);
 assert.match(permissions,/messageKey==='installation'&&message/);
 assert.doesNotMatch(permissions,/\{message&&<p role=\{warningMessage/);
});
