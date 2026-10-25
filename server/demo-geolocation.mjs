// Calibração GEOGRÁFICA APROXIMADA usada apenas no evento demonstrativo.
// Um único GPS não mede os cantos reais: supomos mapa orientado ao norte,
// área de 50 m × 40 m e uma grade de referência de 10 metros.
export const DEMO_WIDTH_METERS=50;
export const DEMO_HEIGHT_METERS=40;
export const DEMO_SPACING_METERS=10;
const METERS_PER_DEGREE_LAT=111_320;

export const DEMO_MARKERS=[
  {name:'Bar principal',type:'bar',x:40,y:37.5,shape:'square',size:42},
  {name:'Banheiros',type:'banheiro',x:60,y:37.5,shape:'square',size:42},
  {name:'Palco',type:'palco',x:40,y:62.5,shape:'square',size:42},
  {name:'Entrada',type:'entrada',x:60,y:62.5,shape:'square',size:42}
];

// Coordenadas originais do primeiro seed. Só reorganizamos as posições se
// ainda forem exatamente as padrão, preservando customizações do administrador.
const ORIGINAL_DEMO_MARKERS=[
  {name:'Bar principal',type:'bar',x:20,y:25},
  {name:'Banheiros',type:'banheiro',x:78,y:30},
  {name:'Palco',type:'palco',x:45,y:12},
  {name:'Entrada',type:'entrada',x:45,y:90}
];

export function validateDemoLocation(location){
  if(location==null)return null;
  if(typeof location!=='object'||Array.isArray(location))throw Error('Localização inválida.');
  const {latitude,longitude,accuracy}=location;
  if(![latitude,longitude,accuracy].every(n=>typeof n==='number'&&Number.isFinite(n))||
    Math.abs(latitude)>85||Math.abs(longitude)>180||accuracy<0||accuracy>10000){
    throw Error('Coordenadas GPS inválidas ou precisão indisponível.');
  }
  return {latitude,longitude,accuracy};
}

export function buildDemoBounds(location,now=Date.now()){
  const pos=validateDemoLocation(location);
  if(!pos)throw Error('GPS obrigatório para calibração automática.');
  const {latitude,longitude,accuracy}=pos;
  const metersPerDegreeLongitude=METERS_PER_DEGREE_LAT*Math.cos(latitude*Math.PI/180);
  const geo=(east,north)=>{
    const lat=latitude+north/METERS_PER_DEGREE_LAT;
    const lng=longitude+east/metersPerDegreeLongitude;
    if(Math.abs(lat)>90||Math.abs(lng)>180)throw Error('Região incompatível com a calibração automática.');
    return {lat:Number(lat.toFixed(9)),lng:Number(lng.toFixed(9)),accuracy};
  };
  const halfW=DEMO_WIDTH_METERS/2,halfH=DEMO_HEIGHT_METERS/2;
  return {
    tl:geo(-halfW,halfH),tr:geo(halfW,halfH),
    br:geo(halfW,-halfH),bl:geo(-halfW,-halfH),
    mode:'demo-auto',
    spacingMeters:DEMO_SPACING_METERS,
    widthMeters:DEMO_WIDTH_METERS,
    heightMeters:DEMO_HEIGHT_METERS,
    accuracyMeters:accuracy,
    generatedAt:now
  };
}
const hasCorner=gps=>['tl','tr','br','bl'].some(k=>gps?.[k]);
// A calibração manual, inclusive quando só há um dos quatro cantos,
// tem prioridade sobre qualquer nova geração automática.
export function applyDemoCalibration(db,mapId,location,now=Date.now()){
  if(!location)return {gpsStatus:'not-requested',markersRepositioned:false};
  const areas=db.prepare('SELECT id,gps_json FROM map_areas WHERE map_id=? ORDER BY rowid').all(mapId);
  if(!areas.length)return {gpsStatus:'no-areas',markersRepositioned:false};
  const parsed=areas.map(row=>({...row,gps:JSON.parse(row.gps_json||'{}')}));
  if(parsed.some(row=>row.gps?.mode==='manual'||(hasCorner(row.gps)&&row.gps?.mode!=='demo-auto'))){
    return {gpsStatus:'manual-preserved',markersRepositioned:false};
  }
  const anchor=parsed.find(row=>row.gps?.mode==='demo-auto')||parsed[0];
  const bounds=buildDemoBounds(location,now);
  db.prepare('UPDATE map_areas SET gps_json=? WHERE id=?').run(JSON.stringify(bounds),anchor.id);
  let markersRepositioned=false;
  const raw=db.prepare('SELECT markers_json FROM map_markers WHERE map_id=?').get(mapId);
  if(raw){
    const markers=JSON.parse(raw.markers_json);
    const matching=markers.length===ORIGINAL_DEMO_MARKERS.length&&ORIGINAL_DEMO_MARKERS.every(original=>markers.some(m=>
      m.name===original.name&&m.type===original.type&&m.x===original.x&&m.y===original.y
    ));
    if(matching){
      const repositioned=markers.map(marker=>{
        const target=DEMO_MARKERS.find(p=>p.name===marker.name&&p.type===marker.type);
        return target?{...marker,x:target.x,y:target.y,shape:'square',size:42}:marker;
      });
      db.prepare('UPDATE map_markers SET markers_json=? WHERE map_id=?').run(JSON.stringify(repositioned),mapId);
      markersRepositioned=true;
    }
  }
  return {gpsStatus:'auto-calibrated',markersRepositioned,gpsAccuracy:location.accuracy,spacingMeters:DEMO_SPACING_METERS,widthMeters:DEMO_WIDTH_METERS,heightMeters:DEMO_HEIGHT_METERS};
}
