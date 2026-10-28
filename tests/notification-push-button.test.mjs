import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../artifacts/submundo-808/src/components/notification-center.tsx',import.meta.url),'utf8');

test('a central verifica a assinatura real antes de oferecer ativação do push',()=>{
 assert.match(source,/Notification\.permission!=='granted'/);
 assert.match(source,/registration\.pushManager\.getSubscription\(\)/);
 assert.match(source,/setPushState\(subscription\?'enabled':'disabled'\)/);
 assert.match(source,/pushState==='disabled'&&<button/);
 assert.doesNotMatch(source,/<button onClick=\{\(\)=>void enablePush\(\)\}[^>]*>Ativar notificações neste celular<\/button>\{pushStatus/);
});
test('o estado do botão é atualizado após ativar ou voltar ao aplicativo',()=>{
 assert.match(source,/setPushState\('enabled'\)/);
 assert.match(source,/setPushState\('disabled'\)/);
 assert.match(source,/visibilitychange/);
 assert.match(source,/window\.addEventListener\('focus',checkPush\)/);
});
