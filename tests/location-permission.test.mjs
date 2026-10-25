import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');

test('GPS usa um único observador contínuo, sem solicitações repetidas a cada 20 segundos',()=>{
 assert.equal((source.match(/geolocation\.watchPosition\(/g)||[]).length,1);
 assert.doesNotMatch(source,/geolocation\.getCurrentPosition\(/);
});
test('permissão salva no servidor não é confundida com GPS autorizado no Android',()=>{
 assert.match(source,/navigator\.permissions\.query\(\{name:'geolocation'\}\)/);
 assert.match(source,/if\(status\.state==='granted'\)/);
 assert.match(source,/setGpsPermissionRequired\(true\)/);
 assert.match(source,/const gpsActive=sharing&&tracking&&!!location&&!gpsPermissionRequired/);
 assert.match(source,/gpsActive\?stopSharing\(\):startSharing\(\)/);
});
test('não exibe dois botões para autorizar a mesma localização',()=>{
 assert.match(source,/gpsActive\?'Desativar localização':'Ativar localização'/);
 assert.doesNotMatch(source,/Permitir localização neste dispositivo/);
 assert.doesNotMatch(source,/Permitir localização<\/button>/);
 assert.match(source,/sharing&&!gpsActive&&!gpsStarting/);
});
test('uma permissão em andamento não é cancelada pela consulta tardia ao navegador',()=>{
 assert.match(source,/status\.state==='prompt'&&\(watch\.current!==null\|\|gpsActivatingRef\.current\)\)return/);
 assert.match(source,/if\(watch\.current!==null\)return;/);
});
test('não anuncia GPS ativo antes de receber coordenadas reais',()=>{
 assert.match(source,/setGpsStarting\(true\)/);
 assert.match(source,/setGpsStarting\(false\)/);
 assert.match(source,/setTracking\(true\);trackingRef\.current=true/);
 assert.doesNotMatch(source,/watch\.current=navigator\.geolocation\.watchPosition[\s\S]*?setTracking\(true\);trackingRef\.current=true/);
});
test('mantém o envio do GPS ativo no servidor apenas se o watch está ativo',()=>{
 assert.match(source,/sharingRef\.current\|\|watch\.current===null\|\|gpsActivatingRef\.current\|\|!trackingRef\.current\|\|!locationRef\.current/);
 assert.match(source,/Date\.now\(\)-lastGpsFixAt\.current<=90000/);
});

test('a primeira solicitação do Android começa imediatamente no clique do usuário',()=>{
 assert.match(source,/const startSharing=\(\)=>\{/);
 assert.match(source,/startInitialGps\(navigator\.geolocation/);
 assert.match(source,/gpsInitialCancel\.current=startInitialGps/);
 assert.match(source,/Cancelar busca de localização/);
});
