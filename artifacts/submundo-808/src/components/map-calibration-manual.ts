import {distanceMeters,type GpsFix} from './map-location-utils';
import {CORNER_KEYS,MAP_MARGIN_METERS,allCorners,cornersGeometryValid,expandMeasuredCorners,measuredCorners,type CalibrationGps,type CornerKey,type MeasuredCorners} from './map-calibration-geometry';

export type ManualPoint={lat:string;lng:string};
export type ManualValues=Record<CornerKey,ManualPoint>;
export type ManualPointMode='3'|'4';
export const CORNER_LABELS:Record<CornerKey,string>={
 tl:'Superior esquerdo',tr:'Superior direito',br:'Inferior direito',bl:'Inferior esquerdo'
};
export function emptyManualValues():ManualValues{
 return {tl:{lat:'',lng:''},tr:{lat:'',lng:''},br:{lat:'',lng:''},bl:{lat:'',lng:''}};
}
export function manualValuesFromGps(gps:CalibrationGps|undefined):ManualValues{
 const points=measuredCorners(gps),values=emptyManualValues();
 for(const key of CORNER_KEYS){
  const point=points[key];
  if(point)values[key]={lat:String(point.lat),lng:String(point.lng)};
 }
 return values;
}
export function parseManualCoordinate(text:string,max:number):number|null{
 const cleaned=text.trim().replace(',','.');
 if(!cleaned||!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned))return null;
 const value=Number(cleaned);
 return Number.isFinite(value)&&Math.abs(value)<=max?value:null;
}
export type ManualCalibrationResult={
 ok:true;
 gps:CalibrationGps;
 raw:Record<CornerKey,GpsFix>;
 derived:boolean;
 width:number;
 height:number;
}|{ok:false;error:string};
export function buildManualCalibration(values:ManualValues,mode:ManualPointMode):ManualCalibrationResult{
 const points:MeasuredCorners={};
 const required:CornerKey[]=mode==='3'?['tl','tr','bl']:CORNER_KEYS;
 for(const key of required){
  const lat=parseManualCoordinate(values[key].lat,90);
  const lng=parseManualCoordinate(values[key].lng,180);
  if(lat===null||lng===null)return {ok:false,error:'Informe latitude e longitude válidas para o canto '+CORNER_LABELS[key]+'.'};
  // Accuracy is unknown for manually supplied map points, not GPS precision.
  points[key]={lat,lng,accuracy:0};
 }
 if(mode==='3'){
  const tl=points.tl!,tr=points.tr!,bl=points.bl!;
  const br={lat:tr.lat+bl.lat-tl.lat,lng:tr.lng+bl.lng-tl.lng,accuracy:0};
  if(Math.abs(br.lat)>90||Math.abs(br.lng)>180)return {ok:false,error:'O quarto canto estimado está fora dos limites geográficos.'};
  points.br=br;
 }
 if(!allCorners(points)||!cornersGeometryValid(points))
  return {ok:false,error:'Os pontos estão invertidos, cruzados ou muito próximos. Confira os cantos da planta.'};
 const expanded=expandMeasuredCorners(points);
 if(!expanded)return {ok:false,error:'Não foi possível aplicar a margem externa. Revise as coordenadas.'};
 return {
  ok:true,derived:mode==='3',raw:points,
  gps:{...expanded,rawCorners:points,mode:'manual',origin:'coordinates',marginMeters:MAP_MARGIN_METERS},
  width:(distanceMeters(points.tl,points.tr)+distanceMeters(points.bl,points.br))/2,
  height:(distanceMeters(points.tl,points.bl)+distanceMeters(points.tr,points.br))/2
 };
}
export function mapPreviewPosition(values:ManualValues,existing:CalibrationGps|undefined):{lat:number;lng:number}|null{
 const coords=CORNER_KEYS.map(k=>({
  lat:parseManualCoordinate(values[k].lat,90),lng:parseManualCoordinate(values[k].lng,180)
 })).filter((p):p is {lat:number;lng:number}=>p.lat!==null&&p.lng!==null);
 if(coords.length){
  return {lat:coords.reduce((v,p)=>v+p.lat,0)/coords.length,lng:coords.reduce((v,p)=>v+p.lng,0)/coords.length};
 }
 const saved=measuredCorners(existing),first=CORNER_KEYS.map(k=>saved[k]).find(Boolean);
 return first?{lat:first.lat,lng:first.lng}:null;
}
export function googleSatelliteEmbedUrl(position:{lat:number;lng:number}|null,fallbackName:string):string{
 const query=position?position.lat.toFixed(7)+','+position.lng.toFixed(7):fallbackName.trim()||'Brasil';
 return 'https://maps.google.com/maps?q='+encodeURIComponent(query)+'&t=k&z=19&output=embed';
}
export function googleMapsLink(position:{lat:number;lng:number}|null,fallbackName:string):string{
 const query=position?position.lat.toFixed(7)+','+position.lng.toFixed(7):fallbackName.trim()||'Brasil';
 return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
}
