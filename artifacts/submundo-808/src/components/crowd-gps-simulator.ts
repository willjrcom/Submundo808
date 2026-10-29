/**
 * Simulação exclusivamente local: posição GPS serve de centro temporário a
 * uma área virtual de 40 × 40 metros (20 m em cada direção).
 * Nenhuma amostra é enviada à API ou persistida em localStorage.
 */
export const SIMULATION_RADIUS_METERS=20;
export const SIMULATION_STEP_MINUTES=5;
export const SIMULATION_INTERVAL_MS=3000;
const METERS_LAT=111_320;

export type SimulationOrigin={lat:number;lng:number};
export type SimulationZone={id:string;x:number;y:number;width:number;height:number};
export type SimulatedVisitor={id:number;lat:number;lng:number;x:number;y:number;active:boolean};
export type SimulationSnapshot={
 step:number;participants:number;classified:number;unclassified:number;
 zones:Record<string,number>;
};
export type CrowdGpsSimulation={
 origin:SimulationOrigin;seed:number;mapId:string;tick:number;
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
function positionFromPercent(origin:SimulationOrigin,x:number,y:number){
 return fakeGpsFromMeters(origin,(x/100*2-1)*SIMULATION_RADIUS_METERS,(1-y/100*2)*SIMULATION_RADIUS_METERS);
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
export function createGpsSimulation(origin:SimulationOrigin,zones:SimulationZone[],mapId:string,count=140,seed=Date.now()):CrowdGpsSimulation{
 if(!Number.isFinite(origin.lat)||!Number.isFinite(origin.lng)||
  Math.abs(origin.lat)>89||Math.abs(origin.lng)>180)throw Error('Posição GPS inválida para simulação.');
 if(!mapId)throw Error('Escolha um mapa para simular.');
 const rand=pseudoRandom(seed);
 const number=clamp(Math.round(count),20,300);
 const people:SimulatedVisitor[]=[];
 for(let i=0;i<number;i++){
  const target=zones.length?zones[Math.floor(Math.pow(rand(),1.4)*zones.length)]:null;
  // Concentração maior dentro dos ambientes, com parte do público circulando.
  const x=target&&rand()<.88?clamp(target.x+target.width*(.12+.76*rand()),.1,99.9):rand()*100;
  const y=target&&rand()<.88?clamp(target.y+target.height*(.12+.76*rand()),.1,99.9):rand()*100;
  const gps=positionFromPercent(origin,x,y);
  people.push({id:i,lat:gps.lat,lng:gps.lng,x,y,active:rand()>.08});
 }
 const sim={origin:{...origin},mapId,seed,tick:0,people,history:[] as SimulationSnapshot[]};
 return {...sim,history:[countSnapshot(people,zones,0)]};
}
export function advanceGpsSimulation(sim:CrowdGpsSimulation,zones:SimulationZone[]):CrowdGpsSimulation{
 const tick=sim.tick+1;
 const rand=pseudoRandom((sim.seed+Math.imul(tick,2971215073))>>>0);
 const people=sim.people.map(visitor=>{
  // Cerca de 1–3 metros por ciclo, com circulação dinâmica entre ambientes.
  const x=clamp(visitor.x+(rand()-.5)*12,.1,99.9);
  const y=clamp(visitor.y+(rand()-.5)*12,.1,99.9);
  const gps=positionFromPercent(sim.origin,x,y);
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
