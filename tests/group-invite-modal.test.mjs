import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../artifacts/submundo-808/src/components/friend-groups.tsx',import.meta.url),'utf8');
test('Convidar exibe modal com cabeçalho, sem card fixo',()=>{
 assert.match(src,/setInviteModalOpen\(true\)/);
 assert.match(src,/\{inviteModalOpen&&<div className="fixed inset-0/);
 assert.match(src,/role="dialog" aria-modal="true" aria-labelledby="group-invite-title"/);
 assert.match(src,/id="group-invite-title"/);
 assert.match(src,/Convide sua galera/);
 assert.doesNotMatch(src,/Use o botão acima para gerar o link ou QR Code do grupo/);
 assert.match(src,/onClick=\{closeInviteModal\}/);
 assert.match(src,/e\.target===e\.currentTarget\)closeInviteModal\(\)/);
});
test('Modal mantém convite copiável, compartilhamento, QR Code e mensagens dentro do modal',()=>{
 assert.match(src,/window\.location\.origin\+'\/groups\?group_invite='/);
 assert.match(src,/aria-label="Link do grupo" readOnly value=\{inviteLink\}/);
 assert.match(src,/onClick=\{\(\)=>void copy\(\)\}/);
 assert.match(src,/onClick=\{\(\)=>void share\(\)\}/);
 assert.match(src,/aria-expanded=\{qrOpen\}/);
 assert.match(src,/alt="QR Code para entrar no grupo"/);
 assert.match(src,/setCopied\(true\)/);
 assert.match(src,/Gerando link de convite/);
 assert.match(src,/Tentar novamente/);
 assert.match(src,/Entrar no grupo não ativa o compartilhamento de localização/);
});
test('O modal é responsivo e respeita a área de navegação do celular',()=>{
 assert.match(src,/max-h-\[90dvh\] w-full max-w-md/);
 assert.match(src,/pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
 assert.match(src,/min-h-0 space-y-4 overflow-y-auto overscroll-contain/);
});
