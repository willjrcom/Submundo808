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
 assert.match(map,/function VenueMap\(\{activeEventId,onChooseEvent\}/);
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
 assert.match(home,/Voltar à agenda/);
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
test('dados de exemplo continuam habilitados por padrão no servidor',()=>{
 assert.match(backend,/AUTO_SEED_DEMO!=='false'/);
 assert.match(backend,/const initial=ensureDemoData\(db\)/);
});
