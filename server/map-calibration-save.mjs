/** Validates and saves a map's measured GPS corners without publishing unrelated
 * unsaved room positions, markers or map-frame edits.
 * Works with both DatabaseSync (SQLite) and PostgresSync.
 */
const KEYS=['tl','tr','bl','br'];
const DEGREE_METERS=111320;
export const CALIBRATION_MARGIN_METERS=5;

export function prepareMapCalibration(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const corners={};
 for(const key of KEYS){
  const point=raw[key];
  if(!point||typeof point!=='object'||Array.isArray(point)||
     typeof point.lat!=='number'||!Number.isFinite(point.lat)||Math.abs(point.lat)>90||
     typeof point.lng!=='number'||!Number.isFinite(point.lng)||Math.abs(point.lng)>180||
     typeof point.accuracy!=='number'||!Number.isFinite(point.accuracy)||point.accuracy<0||point.accuracy>1000)return null;
  corners[key]={lat:point.lat,lng:point.lng,accuracy:point.accuracy};
 }
 const latitude=KEYS.reduce((n,key)=>n+corners[key].lat,0)/4;
 const cos=Math.cos(latitude*Math.PI/180);
 if(cos<1e-6)return null;
 const origin=corners.tl;
 const local=p=>({x:(p.lng-origin.lng)*DEGREE_METERS*cos,y:(origin.lat-p.lat)*DEGREE_METERS});
 const geographic=(p,accuracy)=>({lat:origin.lat-p.y/DEGREE_METERS,lng:origin.lng+p.x/(DEGREE_METERS*cos),accuracy});
 const validQuadrilateral=points=>{
  const p=['tl','tr','br','bl'].map(k=>local(points[k]));
  const vectors=p.map((a,i)=>({x:p[(i+1)%4].x-a.x,y:p[(i+1)%4].y-a.y}));
  const cross=vectors.map((v,i)=>v.x*vectors[(i+1)%4].y-v.y*vectors[(i+1)%4].x);
  return vectors.every(v=>Math.hypot(v.x,v.y)>1)&&(cross.every(n=>n>1)||cross.every(n=>n< -1));
 };
 if(!validQuadrilateral(corners))return null;
 const p=Object.fromEntries(KEYS.map(key=>[key,local(corners[key])]));
 const unit=(a,b)=>{const x=b.x-a.x,y=b.y-a.y,d=Math.hypot(x,y);return{x:x/d,y:y/d};};
 const top=unit(p.tl,p.tr),bottom=unit(p.bl,p.br);
 const left=unit(p.tl,p.bl),right=unit(p.tr,p.br);
 const offset=(key,h,v,signH,signV)=>geographic({
  x:p[key].x+CALIBRATION_MARGIN_METERS*(signH*h.x+signV*v.x),
  y:p[key].y+CALIBRATION_MARGIN_METERS*(signH*h.y+signV*v.y)
 },corners[key].accuracy);
 const expanded={
  tl:offset('tl',top,left,-1,-1),
  tr:offset('tr',top,right,1,-1),
  bl:offset('bl',bottom,left,-1,1),
  br:offset('br',bottom,right,1,1)
 };
 if(!validQuadrilateral(expanded))return null;
 return {...expanded,rawCorners:corners,mode:'manual',origin:'coordinates',marginMeters:CALIBRATION_MARGIN_METERS};
}

export function saveMapCalibration(db,{mapId,areaId,rawCorners}){
 if(typeof mapId!=='string'||!mapId||mapId.length>100||
    typeof areaId!=='string'||!areaId||areaId.length>100)return {ok:false,status:400,error:'Mapa ou ambiente inválido.'};
 const gps=prepareMapCalibration(rawCorners);
 if(!gps)return {ok:false,status:400,error:'Coordenadas inválidas ou cantos cruzados. Ajuste os quatro pontos no mapa.'};
 if(!db.prepare('SELECT 1 FROM venue_maps WHERE id=?').get(mapId))
  return {ok:false,status:404,error:'Mapa não encontrado.'};
 if(!db.prepare('SELECT 1 FROM map_areas WHERE map_id=? AND id=?').get(mapId,areaId))
  return {ok:false,status:404,error:'Ambiente não encontrado neste mapa. Salve a planta antes de calibrar.'};
 db.exec('BEGIN');
 try{
  // Update only gps_json. Room geometry and marker edits in the browser remain untouched.
  // The reference calibration is stored in a single room, matching save-layout semantics.
  db.prepare("UPDATE map_areas SET gps_json=CASE WHEN id=? THEN ? ELSE '{}' END WHERE map_id=?")
   .run(areaId,JSON.stringify(gps),mapId);
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 return {ok:true,gps};
}
