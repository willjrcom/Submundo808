import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const shell=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-shell.tsx',import.meta.url),'utf8');
const venueMaps=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-venue-maps.tsx',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-venue-dashboard.tsx',import.meta.url),'utf8');
const eventList=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-event-list.tsx',import.meta.url),'utf8');

test('main administrative menu has no standalone Maps and Ambientes tab',()=>{
 assert.doesNotMatch(shell,/\{name:'Mapas e ambientes',Icon:Map\}/);
 assert.match(shell,/\{name:'Estabelecimentos',Icon:Building2\}/);
 assert.match(shell,/\{name:'Eventos',Icon:CalendarDays\}/);
});
test('venue dashboard owns its maps and opens editor via nested route',()=>{
 assert.match(shell,/<AdminVenueDashboard venue=\{editing\}/);
 assert.match(shell,/onOpenMap=\{openMap\}/);
 assert.match(shell,/mapId\}\)/);
 assert.match(shell,/openedMap\?<AdminMapWorkspace/);
 assert.match(dashboard,/AdminVenueMaps venue=\{venue\}/);
 assert.match(venueMaps,/maps\.filter\(map=>map\.venue_id===venue\.id\)/);
});
test('creating maps always ties them to the venue and opens the editor',()=>{
 assert.match(venueMaps,/adminRequest\('maps',\{name,venue_id:venue\.id\}\)/);
 assert.match(venueMaps,/onOpen\(result\.id\)/);
 assert.match(venueMaps,/events\.filter\(event=>event\.map_ids\?\.includes\(map\.id\)\)/);
 assert.match(venueMaps,/aria-label="Carrossel de plantas do local"/);
});
test('legacy links redirect to the matching venue and map',()=>{
 assert.match(shell,/section!=='Mapas e ambientes'\|\|!listsLoaded/);
 assert.match(shell,/window\.history\.replaceState\(\{\},'',path\)/);
 assert.match(shell,/mapId:map\.id/);
});
test('event listing presents date, status, search, month and venue filters',()=>{
 assert.match(shell,/<AdminEventList events=\{events\} venues=\{venues\}/);
 assert.match(eventList,/groupAdminEvents\(filtered\)/);
 assert.match(eventList,/Acontecendo/);
 assert.match(eventList,/Buscar evento ou estabelecimento/);
 assert.match(eventList,/Todos os estabelecimentos/);
 assert.match(eventList,/Todos os meses/);
 assert.match(eventList,/Criar evento/);
});
