import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const path=new URL('../artifacts/submundo-808/src/components/crowd-gps-simulator.ts',import.meta.url);
const source=readFileSync(path,'utf8');
const moduleText=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createGpsSimulation,advanceGpsSimulation,metersFromFakeGps,fakeGpsFromMeters,simulationHotspots,
 SIMULATION_RADIUS_METERS,SIMULATION_STEP_MINUTES,SIMULATION_INTERVAL_MS}=
 await import('data:text/javascript;base64,'+Buffer.from(moduleText).toString('base64'));

const center={lat:-23.501,lng:-47.455};
const zones=[
 {id:'pista',x:0,y:0,width:60,height:90},
 {id:'bar',x:60,y:0,width:40,height:80},
 {id:'corredor',x:40,y:80,width:20,height:20}
];
const approx=(actual,wanted,eps=1e-7)=>assert.ok(Math.abs(actual-wanted)<=eps,
 'Esperado '+wanted+', recebido '+actual);

test('desloca coordenadas GPS por metros em cada direção com ida e volta consistente',()=>{
 const north=fakeGpsFromMeters(center,0,20),south=fakeGpsFromMeters(center,0,-20),
  east=fakeGpsFromMeters(center,20,0),west=fakeGpsFromMeters(center,-20,0);
 approx(metersFromFakeGps(center,north).north,20,1e-5);
 approx(metersFromFakeGps(center,south).north,-20,1e-5);
 approx(metersFromFakeGps(center,east).east,20,1e-5);
 approx(metersFromFakeGps(center,west).east,-20,1e-5);
 assert.equal(SIMULATION_RADIUS_METERS,20);
});

test('simulação inicial cria pessoas virtuais a 20m ou menos do usuário, sem divulgar GPS ao servidor',()=>{
 const simulation=createGpsSimulation(center,zones,'mapa-pista',140,123456);
 assert.equal(simulation.people.length,140);
 assert.equal(simulation.mapId,'mapa-pista');
 assert.equal(simulation.tick,0);
 assert.equal(simulation.history.length,1);
 assert.equal(simulation.history[0].classified+simulation.history[0].unclassified,simulation.history[0].participants);
 for(const person of simulation.people){
  const offset=metersFromFakeGps(center,person);
  assert.ok(Math.abs(offset.east)<=20.001,'latitude/longitude fora do raio leste/oeste');
  assert.ok(Math.abs(offset.north)<=20.001,'latitude/longitude fora do raio norte/sul');
  assert.ok(person.x>=0&&person.x<=100);
  assert.ok(person.y>=0&&person.y<=100);
 }
 assert.doesNotMatch(source,/\bfetch\s*\(|\blocalStorage\s*\.|\bsessionStorage\s*\.|\bsendBeacon\s*\(/);
});

test('movimentação altera posições e registros a cada etapa sem sair dos limites GPS',()=>{
 let current=createGpsSimulation(center,zones,'mapa-pista',120,234567);
 const start=current;
 for(let i=0;i<16;i++)current=advanceGpsSimulation(current,zones);
 assert.equal(current.tick,16);
 assert.equal(current.history.length,17);
 assert.ok(current.people.some((p,i)=>p.lat!==start.people[i].lat||p.lng!==start.people[i].lng));
 for(const person of current.people){
  const {east,north}=metersFromFakeGps(center,person);
  assert.ok(Math.abs(east)<=20.001);
  assert.ok(Math.abs(north)<=20.001);
 }
 for(const h of current.history){
  assert.equal(h.participants,h.classified+h.unclassified);
  assert.equal(h.classified,Object.values(h.zones).reduce((a,b)=>a+b,0));
 }
 const report=simulationHotspots(current,zones);
 assert.equal(report.length,3);
 assert.ok(report[0].average>=report[1].average);
 assert.ok(report[0].peak<=120);
 assert.equal(SIMULATION_STEP_MINUTES,5);
 assert.equal(SIMULATION_INTERVAL_MS,3000);
});

test('dados mockados pertencem somente ao navegador, não são misturados aos dados reais da API',()=>{
 const component=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-crowd.tsx',import.meta.url),'utf8');
 assert.match(component,/navigator\.geolocation\.getCurrentPosition\(/);
 assert.match(component,/startSimulationAt\(\{lat:position\.coords\.latitude,lng:position\.coords\.longitude\},'gps'\)/);
 assert.match(component,/SIMULAÇÃO ATIVA/);
 assert.match(component,/setSimulation\(null\)/);
 assert.match(component,/Nenhuma posição é enviada ao servidor/);
 assert.match(component,/simulation\?simulation\.history\.map\(/);
 assert.match(component,/simulation\.people\.filter\(person=>person\.active\)/);
 assert.doesNotMatch(component,/fetch\(['"]\/api\/location\/update/);
});

test('não permite posição GPS inválida nem mapa sem nome',()=>{
 assert.throws(()=>createGpsSimulation({lat:91,lng:0},zones,'abc'),/inválida/);
 assert.throws(()=>createGpsSimulation(center,zones,''),/mapa/);
});


test('fallback gera as mesmas movimentações sem GPS e com coordenadas manuais',()=>{
 const virtual={lat:0,lng:0};
 const fictitious=createGpsSimulation(virtual,zones,'mapa-pista',50,123);
 const manual=createGpsSimulation({lat:-23.5,lng:-47.45},zones,'mapa-pista',50,123);
 assert.equal(fictitious.people.length,50);
 assert.equal(manual.people.length,50);
 // O deslocamento virtual permanece até 20 metros do centro definido,
 // independentemente de o navegador ter acesso ao GPS.
 for(const p of fictitious.people){
  const {east,north}=metersFromFakeGps(virtual,p);
  assert.ok(Math.abs(east)<=20.001&&Math.abs(north)<=20.001);
 }
 assert.deepEqual(fictitious.history[0],manual.history[0]);
 const moving=advanceGpsSimulation(fictitious,zones);
 assert.equal(moving.tick,1);
 assert.ok(moving.people.some((p,i)=>p.x!==fictitious.people[i].x));
});

test('dashboard oferece fallback de um toque, centro manual e tratamento de timeout',()=>{
 const admin=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-crowd.tsx',import.meta.url),'utf8');
 assert.match(admin,/function startVirtualSimulation\(\)/);
 assert.match(admin,/startSimulationAt\(\{lat:0,lng:0\},'virtual'\)/);
 assert.match(admin,/function startManualSimulation\(\)/);
 assert.match(admin,/startSimulationAt\(\{lat:latitude,lng:longitude\},'manual'\)/);
 assert.match(admin,/Simular sem GPS/);
 assert.match(admin,/Coordenadas manuais/);
 assert.match(admin,/Simular neste ponto/);
 assert.match(admin,/error\.code===3\?'O GPS demorou para responder/);
 assert.match(admin,/timeout:10000,maximumAge:60000/);
 assert.match(admin,/aria-label=\{'Centro '/);
 assert.match(admin,/SIMULAÇÃO ATIVA/);
 assert.match(admin,/setSimulation\(result\)/);
 assert.doesNotMatch(admin,/fetch\(['"]\/api\/location\/update/);
});

test('menu administrativo não comprime o mapa nas telas mobile e tablet',()=>{
 const admin=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-shell.tsx',import.meta.url),'utf8');
 const crowd=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-crowd.tsx',import.meta.url),'utf8');
 assert.match(admin,/mobileMenuOpen,setMobileMenuOpen/);
 assert.match(admin,/aria-label="Abrir menu administrativo"/);
 assert.match(admin,/role="dialog" aria-modal="true" aria-label="Navegação administrativa"/);
 assert.match(admin,/setMobileMenuOpen\(false\)/);
 assert.match(admin,/className="hidden shrink-0 border-r border-white\/10/);
 assert.match(admin,/xl:flex xl:min-h-dvh xl:w-64/);
 assert.match(admin,/min-w-0 max-w-6xl p-3 pb-8/);
 assert.match(crowd,/xl:grid-cols-\[minmax\(0,1\.3fr\)_minmax\(0,\.7fr\)\]/);
 assert.match(crowd,/min-w-0 basis-full/);
});
