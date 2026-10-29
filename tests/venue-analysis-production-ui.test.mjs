import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAdminRoute,adminRoutePath} from '../artifacts/submundo-808/src/components/admin-route.ts';
const file=name=>readFileSync(new URL('../artifacts/submundo-808/src/components/'+name,import.meta.url),'utf8');
const shell=file('admin-shell.tsx'),crowd=file('admin-crowd.tsx');

test('estabelecimento tem aba Eventos e análise individual por evento',()=>{
 const route=parseAdminRoute('/venues/venue-1/events/event-9/analysis');
 assert.deepEqual(route,{section:'Estabelecimentos',id:'venue-1',creating:false,eventId:'event-9'});
 assert.equal(adminRoutePath(route),'/venues/venue-1/events/event-9/analysis');
 assert.match(shell,/Eventos deste estabelecimento/);
 assert.match(shell,/Ver análise/);
 assert.match(shell,/Ver exemplo/);
 assert.doesNotMatch(shell,/Análise de público<\/button>|venueTab==='occupancy'/);
 assert.doesNotMatch(shell,/\{name:'Inteligência',Icon:BarChart3\}/);
});
test('a análise só mostra histórico por hora e mapa de calor',()=>{
 assert.match(crowd,/crowd-hourly\?event_id=/);
 assert.match(crowd,/Mapa de calor/);
 assert.match(crowd,/Participantes ativos detectados/);
 assert.doesNotMatch(crowd,/Simular sem GPS|Ferramentas de simulação|navigator\.geolocation|setInterval|Concentração ao vivo|Usar meu GPS/);
 assert.match(crowd,/Exemplo ilustrativo de como será a análise/);
});
