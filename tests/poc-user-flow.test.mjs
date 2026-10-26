import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const base=new URL('../artifacts/submundo-808/src/components/',import.meta.url);
const map=readFileSync(new URL('venue-map.tsx',base),'utf8');
const home=readFileSync(new URL('public-events.tsx',base),'utf8');
const menu=readFileSync(new URL('event-menu.tsx',base),'utf8');
const admin=readFileSync(new URL('admin-shell.tsx',base),'utf8');
const server=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');
const catalog=readFileSync(new URL('../server/demo-products.mjs',import.meta.url),'utf8');

test('bootstrap and admin generator both include five extra event scenarios',()=>{
 assert.match(server,/const showcase=ensureDemoShowcase\(db,\{baseEventId:initial\.id\}\)/);
 assert.match(server,/const showcase=ensureDemoShowcase\(db,\{baseEventId:result\.id\}\)/);
 assert.match(server,/AUTO_SEED_DEMO!=='false'/);
 assert.match(admin,/Gerar \/ conferir todos os cenários/);
});
test('home cards show venue, date, DJs and per-event map count',()=>{
 assert.match(home,/\{displayLabel\(e\.venue\.name\)\}/);
 assert.match(home,/\{e\.lineup\.length\} DJs/);
 assert.match(home,/\{e\.map_ids\.length\}/);
 assert.match(home,/onSelectEvent\(id\)/);
});
test('event choice in Home governs both the map and its menu prices',()=>{
 assert.match(map,/setSelectedMap\(filtered\[0\]\?\.id\|\|''\)/);
 assert.match(map,/event\.map_ids\?\.includes\(m\.id\)/);
 assert.doesNotMatch(map,/aria-label="Escolher evento do mapa"/);
 assert.match(menu,/event_id='\+encodeURIComponent\(activeEventId\)/);
 assert.doesNotMatch(menu,/aria-label="Evento do cardápio"/);
});
test('location starts as one button then exposes duration and explicit confirmation',()=>{
 assert.match(map,/useState\(false\);/);
 assert.match(map,/!locationSetupOpen&&<button/);
 assert.match(map,/else setLocationSetupOpen\(true\)/);
 assert.match(map,/\{locationSetupOpen&&!sharing&&<div/);
 assert.match(map,/Até o fim da festa/);
 assert.match(map,/Por 4 horas/);
 assert.match(map,/Por 1 hora/);
 assert.match(map,/Confirmar e ativar/);
 assert.match(map,/onClick=\{startSharing\}/);
 assert.match(map,/startInitialGps\(navigator\.geolocation/);
});
test('map is rendered before secondary geolocation status and calibration notice',()=>{
 const mapPosition=map.indexOf('Mapa do evento');
 const ownPosition=map.indexOf('Sua posição</div>');
 assert.ok(mapPosition<ownPosition);
 assert.ok(map.indexOf('data?.markers.map')<ownPosition);
 assert.ok(map.indexOf('Localização aproximada. Os cantos')>ownPosition);
});
test('product catalog has meaningful descriptions instead of mock placeholders',()=>{
 assert.match(catalog,/description:'Água mineral gelada de 500 ml'/);
 assert.match(catalog,/description:'Drink especial da noite'/);
 assert.match(catalog,/upgradeDescription\.run/);
});
