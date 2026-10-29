/**
 * Simulação exclusivamente local: posição GPS serve de centro temporário a
 * uma área virtual de 40 × 40 metros (20 m em cada direção).
 * Nenhuma amostra é enviada à API nem persistida em armazenamento local.
 */
export const SIMULATION_RADIUS_METERS=20;
export const SIMULATION_STEP_MINUTES=5;
export const SIMULATION_INTERVAL_MS=3000;
const METERS_LAT=111_320;

export type SimulationOrigin={lat:number;lng:number};
export type SimulationZone={id:string;x:number;y:number;width:number;height:number};
export type SimulationPoint={x:number;y:number};
export type SimulationOptions={center?:SimulationPoint;source?:'gps'|'virtual'};
export type SimulatedVisitor={id:number;lat:number;lng:number;x:number;y:number;active:boolean};
export type SimulationSnapshot={
 step:number;participants:number;classified:number;unclassified:number;
 zones:Record<string,number>;
};
export type CrowdGpsSimulation={
 origin:SimulationOrigin;seed:number;mapId:string;tick:number;
 center:SimulationPoint;source:'gps'|'virtual';
 people:SimulatedVisitor[];history:SimulationSnapshot[];
};
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

function pseudoRandom(seed:number){
 let n=seed>>>0;
 return ()=>{
  n=(Math.imul(n,1664525)+1013904223)>>>0;
  return n/4294967296;
 };
}

/** Conversão local em metros, suficiente para o pequeno raio da simulação. */
export function fakeGpsFromMeters(origin:SimulationOrigin,east:number,north:number):SimulationOrigin {
 const latitude=origin.lat+north/METERS_LAT;
 const longitude=origin.lng+east/(METERS_LAT*Math.max(0.01,Math.cos(origin.lat*Math.PI/180)));
 return {lat:latitude,lng:longitude};
}

export function metersFromFakeGps(origin:SimulationOrigin,position:SimulationOrigin){
 return {east:(position.lng-origin.lng)*METERS_LAT*Math.cos(origin.lat*Math.PI/180),
  north:(position.lat-origin.lat)*METERS_LAT};
}
function positionFromPercent(origin:SimulationOrigin,x:number,y:number,center:SimulationPoint){
 // 50% da planta corresponde aos 20 m da simulação. Não é uma escala
 // geográfica da planta original: trata-se de um mapa esquemático de teste.
 return fakeGpsFromMeters(origin,(x-center.x)/50*SIMULATION_RADIUS_METERS,
  (center.y-y)/50*SIMULATION_RADIUS_METERS);
}
export function simulationWindow(center:SimulationPoint){
 return {minX:clamp(center.x-50,.1,99.9),maxX:clamp(center.x+50,.1,99.9),
  minY:clamp(center.y-50,.1,99.9),maxY:clamp(center.y+50,.1,99.9)};
}
function classify(point:{x:number;y:number},areas:SimulationZone[]){
 // Ambientes sobrepostos: escolher o menor evita dupla contagem.
 let selected:SimulationZone|null=null;
 for(const area of areas){
  if(point.x>=area.x&&point.x<area.x+area.width&&point.y>=area.y&&point.y<area.y+area.height){
   if(!selected||area.width*area.height<selected.width*selected.height)selected=area;
  }
 }
 return selected?.id||null;
}
function countSnapshot(people:SimulatedVisitor[],zones:SimulationZone[],step:number):SimulationSnapshot{
 const counts:Object=Object.create(null);
 for(const zone of zones)(counts as Record<string,number>)[zone.id]=0;
 let participants=0,classified=0;
 for(const person of people){
  if(!person.active)continue;
  participants++;
  const id=classify(person,zones);
  if(id){(counts as Record<string,number>)[id]++;classified++;}
 }
 return {step,participants,classified,unclassified:participants-classified,zones:counts as Record<string,number>};
}
export function createGpsSimulation(origin:SimulationOrigin,zones:SimulationZone[],mapId:string,count=140,seed=Date.now(),options:SimulationOptions={}):CrowdGpsSimulation{
 if(!Number.isFinite(origin.lat)||!Number.isFinite(origin.lng)||
  Math.abs(origin.lat)>89||Math.abs(origin.lng)>180)throw Error('Posição GPS inválida para simulação.');
 if(!mapId)throw Error('Escolha um mapa para simular.');
 const center=options.center||{x:50,y:50};
 if(!Number.isFinite(center.x)||!Number.isFinite(center.y)||
   center.x<0||center.x>100||center.y<0||center.y>100)
  throw Error('Escolha um ponto válido dentro do mapa.');
 const source=options.source||'gps';
 const window=simulationWindow(center);
 const eligible=zones.filter(a=>
  Math.min(window.maxX,a.x+a.width)>Math.max(window.minX,a.x)&&
  Math.min(window.maxY,a.y+a.height)>Math.max(window.minY,a.y));
 const rand=pseudoRandom(seed);
 const number=clamp(Math.round(count),20,300);
 const people:SimulatedVisitor[]=[];
 for(let i=0;i<number;i++){
  const target=eligible.length?eligible[Math.floor(Math.pow(rand(),1.4)*eligible.length)]:null;
  // Concentração por ambiente com circulação na vizinhança do centro escolhido.
  const sample=(min:number,max:number)=>min+(max-min)*rand();
  const within=(start:number,end:number,min:number,max:number)=>
   sample(Math.max(start,min),Math.min(end,max));
  const x=target&&rand()<.88
   ?within(target.x,target.x+target.width,window.minX,window.maxX)
   :sample(window.minX,window.maxX);
  const y=target&&rand()<.88
   ?within(target.y,target.y+target.height,window.minY,window.maxY)
   :sample(window.minY,window.maxY);
  const gps=positionFromPercent(origin,x,y,center);
  people.push({id:i,lat:gps.lat,lng:gps.lng,x,y,active:rand()>.08});
 }
 const sim={origin:{...origin},mapId,seed,tick:0,center:{...center},source,people,history:[] as SimulationSnapshot[]};
 return {...sim,history:[countSnapshot(people,zones,0)]};
}
export function advanceGpsSimulation(sim:CrowdGpsSimulation,zones:SimulationZone[]):CrowdGpsSimulation{
 const tick=sim.tick+1;
 const rand=pseudoRandom((sim.seed+Math.imul(tick,2971215073))>>>0);
 const window=simulationWindow(sim.center);
 const people=sim.people.map(visitor=>{
  // Cerca de 1–3 metros por ciclo, com circulação dinâmica entre ambientes.
  const x=clamp(visitor.x+(rand()-.5)*12,window.minX,window.maxX);
  const y=clamp(visitor.y+(rand()-.5)*12,window.minY,window.maxY);
  const gps=positionFromPercent(sim.origin,x,y,sim.center);
  return {...visitor,x,y,lat:gps.lat,lng:gps.lng,active:rand()>(.04+.16*(1+Math.sin(tick*.38))/2)};
 });
 return {...sim,tick,people,
  history:[...sim.history,countSnapshot(people,zones,tick)].slice(-48)};
}
export function simulationHotspots(sim:CrowdGpsSimulation,zones:SimulationZone[]){
 return zones.map(zone=>{
  const series=sim.history.map(sample=>sample.zones[zone.id]||0);
  return {id:zone.id,average:Math.round(series.reduce((total,value)=>total+value,0)/Math.max(1,series.length)*10)/10,
   peak:Math.max(0,...series),samples:series.length};
 }).sort((a,b)=>b.average-a.average);
}
