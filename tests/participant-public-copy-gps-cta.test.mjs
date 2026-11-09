import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {displayPublicDescription} from '../artifacts/submundo-808/src/components/display-label.ts';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const menu=read('artifacts/submundo-808/src/components/event-menu.tsx');
const map=read('artifacts/submundo-808/src/components/venue-map.tsx');
const account=read('artifacts/submundo-808/src/components/account.tsx');
const app=read('artifacts/submundo-808/src/App.tsx');

test('avisos persistidos nos produtos não são exibidos como descrições públicas',()=>{
 assert.equal(displayPublicDescription('DEMONSTRAÇÃO: produto, disponibilidade e preço ilustrativos; não é o cardápio oficial.'),'');
 assert.equal(displayPublicDescription('DEMONSTRAÇÃO: posição ilustrativa; NÃO use para localização.'),'');
 assert.equal(displayPublicDescription('DEMO — versão interna'),'');
 assert.equal(displayPublicDescription('Gin, água tônica, limão e gelo.'),'Gin, água tônica, limão e gelo.');
 assert.equal(displayPublicDescription(''),'');
});

test('cardápio não exibe aviso geral e preserva as descrições legítimas',()=>{
 assert.doesNotMatch(menu,/Cardápio demonstrativo|hasDemoProducts/);
 assert.match(menu,/displayPublicDescription\(p.description\)/);
 assert.match(menu,/money\(p.effective_price_cents\)/);
});

test('planta e pontos não expõem avisos internos em nomes ou descrições',()=>{
 assert.match(map,/Planta ilustrativa\/i.test\(name\|\|''\)/);
 assert.match(map,/return 'Planta do local'/);
 assert.ok(map.includes('label.replace(/\\s*\\((?:demo|demonstração|teste)'));
 assert.match(map,/<title>\{displayPublicDescription\(a.description\)\|\|name\}<\/title>/);
 assert.match(map,/title=\{displayPublicDescription\(m.description\)\|\|publicPointName/);
 assert.match(map,/displayPublicDescription\(marker.description\)/);
 assert.match(map,/displayPublicDescription\(p.description\)/);
 assert.match(map,/const mapped=location&&bounds&&!mapIsDemo\?gpsToMap/);
});

test('card de GPS desaparece somente após a primeira leitura válida',()=>{
 assert.match(map,/\{\(!tracking\|\|!location\)&&<div[^\n]+aria-label="Ativar minha localização"/);
 assert.match(map,/setLocation\(next\);setTracking\(true\)/);
 assert.match(map,/disabled=\{gpsSessionChecking\|\|gpsStarting\|\|localGpsEnabled/);
 assert.match(map,/Ativar e compartilhar/);
 assert.doesNotMatch(map,/'Parar GPS'|'Desativar GPS'/);
 assert.match(map,/if\(error.code===1\|\|!locationRef.current\)/);
 assert.match(map,/localGpsWatch.current=null;setLocalGpsEnabled\(false\)/);
});

test('sessão de GPS pode ser encerrada sem atalhos para contas de teste',()=>{
 assert.match(map,/Perfil → Permissões/);
 assert.match(map,/const stopSharing=async\(\)=>/);
 assert.doesNotMatch(account,/Ferramentas de demonstração|Gerar administrador teste|Gerar usuário teste|generateDemo\(/);
 assert.doesNotMatch(app,/Convite demonstrativo criado neste aparelho/);
});
