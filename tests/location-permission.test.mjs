import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');

test('GPS usa um único observador contínuo, sem solicitações repetidas a cada 20 segundos',()=>{
 assert.equal((source.match(/geolocation\.watchPosition\(/g)||[]).length,1);
 assert.doesNotMatch(source,/geolocation\.getCurrentPosition\(/);
});
test('nunca reabre prompt de localização ao restaurar compartilhamento sem permissão persistente',()=>{
 assert.match(source,/navigator\.permissions\.query\(\{name:'geolocation'\}\)/);
 assert.match(source,/if\(status\.state==='granted'\)/);
 assert.match(source,/setGpsPermissionRequired\(true\)/);
 assert.match(source,/Permitir localização neste dispositivo/);
});
test('mantém o envio do GPS ativo no servidor apenas se o watch está ativo',()=>{
 assert.match(source,/sharingRef\.current\|\|watch\.current===null/);
 assert.match(source,/Date\.now\(\)-lastGpsFixAt\.current<=90000/);
});
