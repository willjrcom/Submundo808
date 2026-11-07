import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAdminRoute,adminRoutePath} from '../artifacts/submundo-808/src/components/admin-route.ts';
const file=name=>readFileSync(new URL('../artifacts/submundo-808/src/components/'+name,import.meta.url),'utf8');
const shell=file('admin-shell.tsx'),crowd=file('admin-crowd.tsx'),dashboard=file('admin-venue-dashboard.tsx');

test('dashboard do estabelecimento mantém inteligência individual por evento, sem abas',()=>{
 const route=parseAdminRoute('/venues/venue-1/events/event-9/analysis');
 assert.deepEqual(route,{section:'Estabelecimentos',id:'venue-1',creating:false,eventId:'event-9'});
 assert.equal(adminRoutePath(route),'/venues/venue-1/events/event-9/analysis');
 assert.match(shell,/route\.eventId&&selectedVenueEvent/);
 assert.match(shell,/<AdminCrowd key=\{selectedVenueEvent\.id\}/);
 assert.match(shell,/Ver exemplo de inteligência/);
 assert.match(dashboard,/Eventos do local/);
 assert.match(dashboard,/onViewAnalytics\(event\.id\)/);
 assert.doesNotMatch(shell,/venueTab|role="tablist" aria-label="Seções do estabelecimento"/);
 assert.doesNotMatch(shell,/\{name:'Inteligência',Icon:BarChart3\}/);
});
test('a análise só mostra histórico por hora e mapa de calor',()=>{
 assert.match(crowd,/crowd-hourly\?event_id=/);
 assert.match(crowd,/Mapa de calor/);
 assert.match(crowd,/Participantes ativos detectados/);
 assert.doesNotMatch(crowd,/Simular sem GPS|Ferramentas de simulação|navigator\.geolocation|setInterval|Concentração ao vivo|Usar meu GPS/);
 assert.match(crowd,/Exemplo ilustrativo de como será a análise/);
});
