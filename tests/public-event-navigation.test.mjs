import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../artifacts/submundo-808/src/',import.meta.url);
const app=readFileSync(new URL('App.tsx',root),'utf8');
const home=readFileSync(new URL('components/public-events.tsx',root),'utf8');
const menu=readFileSync(new URL('components/event-menu.tsx',root),'utf8');
const map=readFileSync(new URL('components/venue-map.tsx',root),'utf8');
const selection=readFileSync(new URL('components/active-event.ts',root),'utf8');
const backend=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');

test('uma única barra inferior exibe as cinco abas',()=>{
 for(const tab of ["id: 'inicio'","id: 'mapa'","id: 'cardapio'","id: 'amigos'","id: 'perfil'"])assert.ok(app.includes(tab));
 assert.match(app,/tabs\.map\(\(\{id,title,Icon\}\)/);
 assert.equal((app.match(/<nav aria-label="Navegação principal"/g)||[]).length,1);
});
test('Início, Mapa e Cardápio recebem exatamente o mesmo evento ativo',()=>{
 assert.match(app,/<PublicEvents activeEventId=\{activeEventId\}/);
 assert.match(app,/<VenueMap activeEventId=\{activeEventId\}/);
 assert.match(app,/<EventMenu activeEventId=\{activeEventId\}/);
 assert.match(map,/function VenueMap\(\{activeEventId,onChooseEvent,focusRequest\}/);
 assert.match(menu,/function EventMenu\(\{activeEventId,onChooseEvent\}/);
 assert.doesNotMatch(menu,/aria-label="Evento do cardápio"/);
 assert.doesNotMatch(map,/aria-label="Escolher evento do mapa"/);
});
test('Amigos e Perfil continuam acessíveis independentemente do evento',()=>{
 assert.match(app,/<Friends\/>/);
 assert.match(app,/<Account\/>/);
 assert.doesNotMatch(app,/<Friends activeEventId/);
 assert.doesNotMatch(app,/<Account activeEventId/);
});
test('a Home apresenta a agenda antes da seleção e a programação depois',()=>{
 assert.match(home,/if\(!event\)return/);
 assert.match(home,/onSelectEvent\(id\)/);
 assert.match(home,/Trocar evento/);
 assert.match(home,/onClearEvent\(\)/);
 assert.match(home,/eventProgramPath\(id\)/);
});
test('a seleção continua no aparelho e pode ser alterada pela agenda',()=>{
 assert.match(selection,/ACTIVE_EVENT_KEY='submundo-event-id'/);
 assert.match(selection,/localStorage\.setItem\(ACTIVE_EVENT_KEY,id\)/);
 assert.match(selection,/localStorage\.removeItem\(ACTIVE_EVENT_KEY\)/);
 assert.match(app,/window\.addEventListener\(ACTIVE_EVENT_CHANGED,sync\)/);
 assert.match(app,/window\.addEventListener\('storage',onStorage\)/);
 assert.match(app,/saveActiveEventId\(eventFromLink\)/);
});
test('mapa nunca escolhe automaticamente a primeira festa ao não haver evento ativo',()=>{
 assert.match(map,/if\(!activeEventId\)\{/);
 assert.match(map,/\},\[activeEventId\]\);/);
 assert.match(map,/events\.items\|\|\[\]\)\.find\(\(e:EventChoice\)=>e\.id===activeEventId\)/);
 assert.match(map,/Escolha uma festa na aba Início/);
 assert.match(menu,/Escolha uma festa na aba Início/);
});
test('cardápio consulta apenas o preço de produtos do evento ativo',()=>{
 assert.match(menu,/fetch\('\/api\/public\/menu\?event_id='\+encodeURIComponent\(activeEventId\)\)/);
 assert.match(menu,/loadedEventId!==activeEventId/);
});
test('modo demo carrega a agenda real 808 e mantém o modo fictício apenas sob opt-in legado',()=>{
 assert.match(backend,/AUTO_SEED_DEMO!=='false'/);
 assert.match(backend,/ensureRealTourDemo\(db\)/);
 assert.match(backend,/AUTO_SEED_LEGACY==='true'/);
});


test('convite abre direto o CTA de entrada e lista de participantes sob demanda',()=>{
 const groups=readFileSync(new URL('components/friend-groups.tsx',root),'utf8');
 const social=readFileSync(new URL('../server/social.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(groups,/>Ver grupo<\/button>/);
 assert.match(groups,/linkedInvite\?0:220/);
 assert.match(groups,/preview\.joined\?'Abrir grupo':'Entrar no grupo'/);
 assert.match(groups,/Ver participantes/);
 assert.match(social,/includeMembers=url\.searchParams\.get\('members'\)==='1'/);
});
test('barra inferior compensa espaço nativo do navegador iOS sem subir os ícones do PWA',()=>{
 const css=readFileSync(new URL('index.css',root),'utf8');
 assert.match(app,/submundo-bottom-nav fixed/);
 assert.match(css,/@media \(display-mode: browser\)/);
 assert.match(css,/--submundo-browser-bleed:/);
 assert.match(css,/bottom: calc\(0px - var\(--submundo-browser-bleed\)\)/);
 assert.match(css,/padding-bottom: calc\(var\(--submundo-bottom-inset\) \+ var\(--submundo-browser-bleed\)\)/);
});


test('entrada em grupo permite escanear QR Code pela câmera e mantém link manual',()=>{
 const groups=readFileSync(new URL('components/friend-groups.tsx',root),'utf8');
 const scanner=readFileSync(new URL('components/group-qr-scanner.tsx',root),'utf8');
 assert.match(groups,/import GroupQrScanner from '\.\/group-qr-scanner'/);
 assert.match(groups,/<GroupQrScanner onDetected=\{token=>/);
 assert.match(groups,/setJoinLink\(token\)/);
 assert.match(groups,/OU COLE O LINK/);
 assert.match(groups,/placeholder="Link do grupo"/);
 assert.match(groups,/groupApi\('\/preview\?token='/);
 assert.match(groups,/groupApi\('\/join',\{token:inviteToken\(joinLink\)\}\)/);
 assert.match(scanner,/getUserMedia\(\{video:/);
 assert.match(scanner,/BarcodeDetector/);
 assert.match(scanner,/jsqr@1\.4\.0/);
 assert.match(scanner,/get\('group_invite'\)/);
 assert.match(scanner,/\^\[a-f0-9\]\{64\}\$/);
 assert.match(scanner,/getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);
 assert.match(scanner,/Escanear QR Code/);
 assert.match(scanner,/Fechar câmera/);
});


test('evento sem atrações exibe Line-up em breve e não exibe horas inventadas',()=>{
 assert.match(home,/Line-up em breve/);
 assert.match(home,/event\.lineup\.length\?/);
 assert.match(home,/\(dj\.inicio\|\|dj\.fim\)\&\&<p/);
});
test('mapa e cardápio demonstrativos são sinalizados para o público',()=>{
 assert.match(map,/Mapa demonstrativo — não representa a planta real/);
 assert.match(menu,/Cardápio demonstrativo: itens, preços e disponibilidade são fictícios/);
});
