import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAdminRoute,adminRoutePath} from '../artifacts/submundo-808/src/components/admin-route.ts';

const read=(path)=>readFileSync(new URL('../artifacts/submundo-808/src/components/'+path,import.meta.url),'utf8');
const shell=read('admin-shell.tsx'),crowd=read('admin-crowd.tsx'),map=read('venue-map.tsx');

test('análise de público pertence ao estabelecimento e pode ser aberta diretamente por URL',()=>{
 const route=parseAdminRoute('/venues/local-123/analytics');
 assert.deepEqual(route,{section:'Estabelecimentos',id:'local-123',creating:false,analytics:true});
 assert.equal(adminRoutePath(route),'/venues/local-123/analytics');
 assert.equal(adminRoutePath(parseAdminRoute('/estabelecimentos/local-123/analytics')),'/venues/local-123/analytics');
 assert.deepEqual(parseAdminRoute('/venues/local-123/maps/plant-4'),{section:'Estabelecimentos',id:'local-123',creating:false,mapId:'plant-4'});
});

test('não há link global Inteligência, mas existem as três abas internas de estabelecimento',()=>{
 assert.doesNotMatch(shell,/\{name:'Inteligência',Icon:/);
 assert.match(shell,/Análise de público<\/button>/);
 assert.match(shell,/setVenueTab\('crowd'\)/);
 assert.match(shell,/onOpenReports=\{eventId=>/);
 assert.match(shell,/associated\.venue_id/);
 assert.match(shell,/analytics:true/);
 assert.match(shell,/venueId=\{editing\.id\}/);
 assert.match(shell,/venueMapIds=\{maps\.filter\(m=>m\.venue_id===editing\.id\)/);
 assert.match(shell,/window\.history\.replaceState\(\{\},'',path\);setCurrentPath\(path\);setRoute\(next\)/);
});

test('a análise só lista eventos do estabelecimento e usa a planta selecionada para os ambientes',()=>{
 assert.match(crowd,/events\.filter\(e=>!venueId\|\|e\.venue_id===venueId\)/);
 assert.match(crowd,/\(live\?\.maps\|\|\[\]\)\.filter\(map=>!venueMapIds\|\|venueMapIds\.includes\(map\.id\)\)/);
 assert.match(crowd,/const chosenMap=maps\.find\(m=>m\.id===selectedMapId\)\|\|maps\[0\]/);
 assert.match(crowd,/const topZone=chosenMap\?\.areas\.filter/);
 assert.match(crowd,/\(chosenMap\?\.areas\|\|\[\]\)\.filter/);
 assert.match(crowd,/history\?\.hotspots\|\|\[\]\)\.filter\(zone=>!chosenMap\|\|zone\.mapId===chosenMap\.id\)/);
 assert.match(crowd,/Apenas pessoas que autorizaram a localização para análise/);
});

test('dados reais são exibidos por padrão; controles de simulação ficam em card separado e fechado',()=>{
 assert.match(crowd,/const \[simulationToolsOpen,setSimulationToolsOpen\]=useState\(false\)/);
 assert.match(crowd,/Ferramentas de simulação/);
 assert.match(crowd,/simulationToolsOpen&&<div/);
 assert.match(crowd,/Somente a apresentação é mockada|No painel normal, nunca injetamos contagens ou mapas inventados/);
 assert.doesNotMatch(crowd,/Ver exemplo fictício/);
 assert.doesNotMatch(crowd,/example\?428|example\?392|example\?36/);
 assert.doesNotMatch(crowd,/Prévia<\/span>/);
 assert.match(crowd,/simulation\?latest\?\.participants:live\?\.participants/);
 assert.match(crowd,/simulation\?latest\?\.classified:selectedMapCount/);
 assert.match(crowd,/Participantes no evento/);
});

test('cliente não recebe banner de demonstração nem falsa navegação GPS a partir de planta gerada',()=>{
 assert.doesNotMatch(map,/Mapa demonstrativo — não representa a planta real do estabelecimento/);
 assert.match(map,/const publicMapName/);
 assert.match(map,/const mapped=location&&bounds&&!mapIsDemo\?gpsToMap/);
 assert.match(map,/const friendMarkers=bounds&&!mapIsDemo\?friends\.map/);
 assert.match(map,/Para utilizar a orientação por GPS nesta planta, o local precisa estar calibrado/);
 assert.match(map,/mapIsDemo\?'A localização nesta planta estará disponível após a calibração GPS do local\.'/);
 assert.match(map,/publicMapName\(data\?\.map\.name\)/);
});
