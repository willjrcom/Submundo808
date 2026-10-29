import {distanceMeters,type GpsFix,type MapCorners} from './map-location-utils';

export type CornerKey='tl'|'tr'|'bl'|'br';
export const CORNER_KEYS:CornerKey[]=['tl','tr','bl','br'];
export const MAP_MARGIN_METERS=5;
export const GPS_CAPTURE_MS=8000;
export type MeasuredCorners=Partial<Record<CornerKey,GpsFix>>;
export type CalibrationGps=MeasuredCorners&{
 mode?:'manual'|'demo-auto';rawCorners?:MeasuredCorners;marginMeters?:number;
 spacingMeters?:number;accuracyMeters?:number;
};
type Vec={x:number;y:number};
const DEGREE_METERS=111320;
const median=(a:number[])=>{const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;};
export function measuredCorners(gps:CalibrationGps|undefined):MeasuredCorners{
 if(!gps||gps.mode==='demo-auto')return {};
 const source=gps.rawCorners||gps;
 return Object.fromEntries(CORNER_KEYS.filter(k=>source[k]).map(k=>[k,source[k]])) as MeasuredCorners;
}
export function allCorners(c:MeasuredCorners):c is Record<CornerKey,GpsFix>{
 return CORNER_KEYS.every(k=>!!c[k]&&Number.isFinite(c[k]!.lat)&&Number.isFinite(c[k]!.lng));
}
/** Median fix after removing invalid, inaccurate and spatially distant samples. */
export function summarizeGpsSamples(samples:GpsFix[]){
 const valid=samples.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng)&&
  Math.abs(s.lat)<=90&&Math.abs(s.lng)<=180&&Number.isFinite(s.accuracy)&&
  s.accuracy>=0&&s.accuracy<=50);
 if(!valid.length)return null;
 const seed={lat:median(valid.map(s=>s.lat)),lng:median(valid.map(s=>s.lng))};
 const retained=valid.filter(s=>distanceMeters(seed,s)<=Math.max(10,s.accuracy*1.5));
 if(!retained.length)return null;
 const point={lat:median(retained.map(s=>s.lat)),lng:median(retained.map(s=>s.lng)),
  accuracy:median(retained.map(s=>s.accuracy))};
 const spread=Math.max(0,...retained.map(s=>distanceMeters(point,s)));
 return {point,total:samples.length,accepted:retained.length,
  spreadMeters:spread,reliable:retained.length>=2&&point.accuracy<=15&&spread<=15};
}
export function cornersGeometryValid(c:MeasuredCorners){
 if(!allCorners(c))return false;
 const lat=(c.tl.lat+c.tr.lat+c.bl.lat+c.br.lat)/4;
 const cos=Math.cos(lat*Math.PI/180);
 const o=c.tl;
 const xy=(p:GpsFix)=>({x:(p.lng-o.lng)*DEGREE_METERS*cos,y:(o.lat-p.lat)*DEGREE_METERS});
 const p=[c.tl,c.tr,c.br,c.bl].map(xy);
 const edges=p.map((a,i)=>{const b=p[(i+1)%4];return{x:b.x-a.x,y:b.y-a.y};});
 const crosses=edges.map((v,i)=>v.x*edges[(i+1)%4].y-v.y*edges[(i+1)%4].x);
 return edges.every(v=>Math.hypot(v.x,v.y)>1)&&crosses.every(n=>n>1)||edges.every(v=>Math.hypot(v.x,v.y)>1)&&crosses.every(n=>n< -1);
}
/** Offset each corner along the OUTWARD physical edges of a rotated map. */
export function expandMeasuredCorners(c:MeasuredCorners,meters=MAP_MARGIN_METERS):Record<CornerKey,GpsFix>|null{
 if(!allCorners(c)||!cornersGeometryValid(c)||!Number.isFinite(meters)||meters<0||meters>30)return null;
 const latitude=(c.tl.lat+c.tr.lat+c.bl.lat+c.br.lat)/4,cos=Math.cos(latitude*Math.PI/180);
 const origin=c.tl;
 const local=(p:GpsFix):Vec=>({x:(p.lng-origin.lng)*DEGREE_METERS*cos,y:(origin.lat-p.lat)*DEGREE_METERS});
 const geodetic=(v:Vec,accuracy:number):GpsFix=>({
  lat:origin.lat-v.y/DEGREE_METERS,
  lng:origin.lng+v.x/(DEGREE_METERS*cos),accuracy
 });
 const p={tl:local(c.tl),tr:local(c.tr),bl:local(c.bl),br:local(c.br)};
 const unit=(a:Vec,b:Vec):Vec=>{const x=b.x-a.x,y=b.y-a.y,d=Math.hypot(x,y);return{x:x/d,y:y/d};};
 const top=unit(p.tl,p.tr),bottom=unit(p.bl,p.br);
 const left=unit(p.tl,p.bl),right=unit(p.tr,p.br);
 const offset=(key:CornerKey,h:Vec,v:Vec,signH:number,signV:number)=>
  geodetic({x:p[key].x+meters*(signH*h.x+signV*v.x),
    y:p[key].y+meters*(signH*h.y+signV*v.y)},c[key].accuracy);
 const expanded={
  tl:offset('tl',top,left,-1,-1),
  tr:offset('tr',top,right,1,-1),
  bl:offset('bl',bottom,left,-1,1),
  br:offset('br',bottom,right,1,1)
 };
 return cornersGeometryValid(expanded)?expanded:null;
}
export function applyMeasuredCorner(gps:CalibrationGps|undefined,key:CornerKey,fix:GpsFix):CalibrationGps{
 const raw={...measuredCorners(gps),[key]:fix};
 const expanded=expandMeasuredCorners(raw);
 // Do not mix old expanded corners with a new partial/manual calibration.
 return {...raw,mode:'manual',...(expanded?{...expanded,rawCorners:raw,marginMeters:MAP_MARGIN_METERS}:{})};
}
export function mapPercentToGps(x:number,y:number,b:MapCorners){
 const u=x/100,v=y/100;
 // Bilinear interpolation: mirrors gpsToMap() for rotated/non-square venues.
 const lat=b.tl.lat*(1-u)*(1-v)+b.tr.lat*u*(1-v)+b.bl.lat*(1-u)*v+b.br.lat*u*v;
 const lng=b.tl.lng*(1-u)*(1-v)+b.tr.lng*u*(1-v)+b.bl.lng*(1-u)*v+b.br.lng*u*v;
 return {lat,lng};
}
