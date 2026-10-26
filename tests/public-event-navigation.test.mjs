import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eventIdFromPath,eventProgramPath} from '../artifacts/submundo-808/src/components/active-event.ts';

const root=new URL('../artifacts/submundo-808/src/',import.meta.url);
const app=readFileSync(new URL('App.tsx',root),'utf8');
const home=readFileSync(new URL('components/public-events.tsx',root),'utf8');
const menu=readFileSync(new URL('components/event-menu.tsx',root),'utf8');
const map=readFileSync(new URL('components/venue-map.tsx',root),'utf8');
const backend=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');

test('the same five participant tabs remain in one bottom navigation bar',()=>{
 assert.match(app,/\{tabs\.map\(\(\{id,title,Icon\}\)/);
 assert.deepEqual(['inicio','mapa','cardapio','amigos','perfil'].map(tab=>app.includes("id: '"+tab+"'")),[true,true,true,true,true]);
 assert.match(app,/\{tab === 'amigos' && <Friends\/>\}/);
 assert.match(app,/\{tab === 'perfil' && <Account\/>\}/);
});
test('active event is centralized across home map and menu',()=>{
 assert.match(app,/useState\(getActiveEventId\)/);
 assert.match(app,/<PublicEvents activeEventId=\{activeEventId\}/);
 assert.match(app,/<VenueMap activeEventId=\{activeEventId\}/);
 assert.match(app,/<EventMenu activeEventId=\{activeEventId\}/);
 assert.match(app,/activeEventId\?eventProgramPath\(activeEventId\):'\/'/);
});
test('homepage lists events when none chosen and opens chosen program',()=>{
 assert.match(home,/const selected=activeEventId/);
 assert.match(home,/onSelectEvent\(id\)/);
 assert.match(home,/changeUrl\(eventProgramPath\(id\)\)/);
 assert.match(home,/if\(!event\)return/);
 assert.match(home,/Trocar evento/);
 assert.match(home,/onClearEvent\(\)/);
});
test('program deep links preserve the event ID and browser history works',()=>{
 assert.equal(eventIdFromPath('/programacao/festa%20noite'),'festa noite');
 assert.equal(eventIdFromPath('/mapa'),'');
 assert.equal(eventProgramPath('festa noite'),'/programacao/festa%20noite');
 assert.match(app,/window\.addEventListener\('popstate',onPop\)/);
 assert.match(app,/window\.addEventListener\('storage',onStorage\)/);
 assert.match(app,/if\(fromPath\)saveActiveEventId\(fromPath\)/);
 assert.match(app,/else if\(window\.location\.pathname==='\/'\)resetActiveEventId\(\)/);
});
test('menu loads prices only for active event and never switches to another on its own',()=>{
 assert.match(menu,/fetch\('\/api\/public\/menu\?event_id='\+encodeURIComponent\(activeEventId\)\)/);
 assert.match(menu,/if\(!activeEventId\)return/);
 assert.match(menu,/onChooseEvent/);
 assert.doesNotMatch(menu,/aria-label="Evento do cardápio"/);
 assert.doesNotMatch(menu,/available\[0\]/);
});
test('map selects only floorplans attached to the active event',()=>{
 assert.match(map,/const event:EventChoice\|undefined=\(events\.items\|\|\[\]\)\.find/);
 assert.match(map,/e\.id===activeEventId/);
 assert.match(map,/event\.map_ids\?\.includes\(m\.id\)/);
 assert.doesNotMatch(map,/aria-label="Escolher evento do mapa"/);
 assert.doesNotMatch(map,/available\[0\]/);
 assert.match(map,/if\(!activeEventId\)return/);
});
test('map and friends position sharing are event-scoped while friends list is global',()=>{
 assert.match(map,/friends\?event_id='\+encodeURIComponent\(eventId\)/);
 assert.match(map,/await savePrefs\(true,true,shareMode,activeEventId\)/);
 assert.match(map,/Compartilhamento encerrado ao trocar de evento/);
 assert.match(backend,/p\.share_event_id=\?/);
 assert.match(backend,/Escolha um evento válido antes de compartilhar/);
});
test('automatic sample events still initialize by default',()=>{
 assert.match(backend,/if\(process\.env\.AUTO_SEED_DEMO!=='false'\)/);
 assert.match(backend,/const initial=ensureDemoData\(db\)/);
 assert.match(backend,/const result=ensureDemoData\(db,\{location\}\)/);
});
