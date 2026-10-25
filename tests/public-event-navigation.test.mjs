import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../artifacts/submundo-808/src/',import.meta.url);
const app=readFileSync(new URL('App.tsx',root),'utf8');
const home=readFileSync(new URL('components/public-events.tsx',root),'utf8');
const menu=readFileSync(new URL('components/event-menu.tsx',root),'utf8');
const map=readFileSync(new URL('components/venue-map.tsx',root),'utf8');
const backend=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');

test('a aba Cardápio permanece visível mesmo sem evento selecionado',()=>{
 assert.match(app,/\{tabs\.map\(\(\{id,title,Icon\}\)/);
 assert.match(app,/tab === 'cardapio' && <EventMenu\/>/);
 assert.doesNotMatch(app,/tab === 'cardapio' && eventSelected/);
});
test('programação é uma rota com URL própria e botão de retorno à agenda',()=>{
 assert.match(app,/if\(segment==='programacao'\)return 'inicio'/);
 assert.match(home,/changeUrl\('\/programacao\/'\+encodeURIComponent\(id\)\)/);
 assert.match(home,/Voltar à agenda/);
 assert.match(home,/if\(!event\)return/);
});
test('atualizar, voltar e avançar sincroniza a programação com a URL',()=>{
 assert.match(home,/useState\(eventFromUrl\)/);
 assert.match(home,/window\.addEventListener\('popstate',sync\)/);
 assert.match(home,/window\.addEventListener\('submundo-navigation',sync\)/);
});
test('Cardápio possui seleção independente e consulta os preços por evento',()=>{
 assert.match(menu,/aria-label="Evento do cardápio"/);
 assert.match(menu,/fetch\('\/api\/public\/menu\?event_id='\+encodeURIComponent\(eventId\)\)/);
 assert.match(menu,/localStorage\.setItem\('submundo-event-id',id\)/);
 assert.match(menu,/submundo-event-selected/);
});
test('trocar evento no cardápio atualiza o mapa se ele já estiver montado',()=>{
 assert.match(map,/window\.addEventListener\('submundo-event-selected',refresh\)/);
 assert.match(map,/\},\[eventRevision\]\);/);
});
test('os dados de exemplo são criados no boot por padrão e podem ser desativados',()=>{
 assert.match(backend,/if\(process\.env\.AUTO_SEED_DEMO!=='false'\)/);
 assert.match(backend,/const initial=ensureDemoData\(db\)/);
 assert.match(backend,/const result=ensureDemoData\(db,\{location\}\)/);
});
