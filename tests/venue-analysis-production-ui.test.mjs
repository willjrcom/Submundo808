import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAdminRoute,adminRoutePath} from '../artifacts/submundo-808/src/components/admin-route.ts';

const file=(name)=>readFileSync(new URL('../artifacts/submundo-808/src/components/'+name,import.meta.url),'utf8');
const shell=file('admin-shell.tsx'),crowd=file('admin-crowd.tsx'),map=file('venue-map.tsx');

test('análise de público pertence a cada estabelecimento, não ao menu geral',()=>{
 const route=parseAdminRoute('/venues/local-123/analytics');
 assert.deepEqual(route,{section:'Estabelecimentos',id:'local-123',creating:false,analytics:true});
 assert.equal(adminRoutePath(route),'/venues/local-123/analytics');
 assert.equal(adminRoutePath(parseAdminRoute('/estabelecimentos/local-123/analytics')),'/venues/local-123/analytics');
 assert.deepEqual(parseAdminRoute('/venues/local-123/maps/map-123'),
  {section:'Estabelecimentos',id:'local-123',creating:false,mapId:'map-123'});
 assert.doesNotMatch(shell,/\{name:'Inteligência',Icon:BarChart3\}/);
 assert.match(shell,/Análise de público<\/button>/);
 assert.match(shell,/venueTab==='occupancy'/);
 assert.match(shell,/analytics:true/);
 assert.match(shell,/venueMaps=\{maps\.filter/);
 assert.match(shell,/window\.location\.pathname\.endsWith\('\/analytics'\)/);
});

test('o dashboard carrega dados reais por padrão, e a simulação fica isolada',()=>{
 assert.match(crowd,/useState\(false\)/);
 assert.match(crowd,/Ferramentas de simulação/);
 assert.match(crowd,/simulationToolsOpen&&<div/);
 assert.match(crowd,/Simular sem GPS/);
 assert.doesNotMatch(crowd,/Ver exemplo fictício|EXEMPLO FICTÍCIO|Prévia/);
 assert.doesNotMatch(crowd,/example\?428|example\?392|example\?36/);
 assert.match(crowd,/simulation\?latest\?\.participants:live\?\.participants/);
 assert.match(crowd,/simulation\?latest\?\.classified:/);
 assert.match(crowd,/sourceMaps=\(live\?\.maps\|\|\[\]\)\.filter\(m=>m\.id===scopedMapId\)/);
 assert.match(crowd,/crowd-history\?event_id=/);
 assert.match(crowd,/map_id=/);
});

test('na vista do cliente não mostramos o banner de demonstração, mas bloqueamos GPS não calibrado',()=>{
 assert.doesNotMatch(map,/Mapa demonstrativo — não representa a planta real/);
 assert.match(map,/const publicMapName/);
 assert.match(map,/const publicPointName/);
 assert.match(map,/const mapped=location&&bounds&&!mapIsDemo\?gpsToMap/);
 assert.match(map,/const friendMarkers=bounds&&!mapIsDemo\?friends\.map/);
 assert.match(map,/Para utilizar a orientação por GPS nesta planta, o local precisa estar calibrado/);
 assert.match(map,/publicMapName\(data\?\.map\.name\)/);
});
