import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');

test('the participant gets a blue arrow only when their GPS projects outside the map',()=>{
 assert.match(source,/const myOutside=mapped&&bounds&&!mapped\.inside\?offMapInfo\(mapped,bounds\):null/);
 assert.match(source,/\{myOutside&&<div\s*role="img"/);
 assert.match(source,/bg-blue-500/);
 assert.match(source,/myOutside\.angleDegrees/);
 assert.match(source,/ArrowUp size=\{22\}/);
});
test('the map says which side of the festival the participant is on',()=>{
 assert.match(source,/Você está fora do mapa,/);
 assert.match(source,/myOutside\?\.direction/);
 assert.match(source,/formatMapDistance\(distanceToVenue\|\|0\)/);
 assert.match(source,/aria-live="polite"/);
});
test('the indicator stays visible on short or narrow maps',()=>{
 assert.match(source,/left:'clamp\(20px,/);
 assert.match(source,/top:'clamp\(20px,/);
 assert.match(source,/calc\(100% - 20px\)/);
});
test('existing blue in-map dot and friend positions are preserved',()=>{
 assert.match(source,/\{mapped\?\.inside&&<div aria-label="Sua localização aproximada"/);
 assert.match(source,/\{visibleFriends\.map\(f=>/);
 assert.match(source,/\{outsideFriends\.map\(f=>/);
 assert.match(source,/f\.edge!\.angleDegrees/);
});
test('without GPS or calibration, no invented position appears',()=>{
 assert.match(source,/!bounds\?'Aguardando calibração do mapa\.'/);
 assert.match(source,/!mapped\?'Não foi possível calcular sua posição/);
 assert.match(source,/const mapped=location&&bounds\?gpsToMap\(location,bounds\):null/);
});
