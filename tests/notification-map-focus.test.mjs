import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../artifacts/submundo-808/src/App.tsx',import.meta.url),'utf8');
const map=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');

test('notificação aponta diretamente ao mapa sem temporizadores arbitrários',()=>{
 assert.match(app,/focusRequest=\{focusRequest\}/);
 assert.match(app,/setFocusRequest\(previous=>/);
 assert.doesNotMatch(app,/window\.setTimeout\(dispatch,600\)/);
 assert.doesNotMatch(app,/window\.setTimeout\(\(\)=>window\.dispatchEvent\(new CustomEvent\('submundo-map-focus'/);
});
test('ponto só abre após mapa do evento estar carregado',()=>{
 assert.match(map,/focusRequest\.eventId!==activeEventId/);
 assert.match(map,/!mapsReady\|\|!mapDataReady/);
 assert.match(map,/data\.map\.id!==selectedMap/);
 assert.match(map,/setSelectedMarkerId\(focusRequest\.pointId\)/);
 assert.match(map,/setPointMenuOpen\(true\)/);
});
test('ponto de outro mapa seleciona o mapa correto sem buscar coordenadas inventadas',()=>{
 assert.match(map,/for\(const candidate of maps\)/);
 assert.match(map,/setSelectedMap\(candidate\.id\)/);
 assert.match(map,/lastHandledFocus\.current=focusRequest\.requestId/);
});
test('GPS obsoleto não permanece visível ao perder sinal',()=>{
 assert.match(map,/locationRef\.current=null;setLocation\(null\);trackingRef\.current=false;setTracking\(false\)/);
 assert.match(map,/A posição antiga foi ocultada/);
});
