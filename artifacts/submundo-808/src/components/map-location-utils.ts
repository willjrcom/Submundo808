// Utilitários de GPS em metros, independentes do React.
export type Coordinates={lat:number;lng:number};
export type GpsFix=Coordinates&{accuracy:number};
export type MapCorners={tl:Coordinates;tr:Coordinates;br:Coordinates;bl:Coordinates};
export type Projected={x:number;y:number;inside:boolean};
const METERS_PER_DEGREE=111320;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export function distanceMeters(a:Coordinates,b:Coordinates):number {
 const rad=Math.PI/180;
 return Math.hypot((a.lng-b.lng)*METERS_PER_DEGREE*Math.cos((a.lat+b.lat)/2*rad),
                   (a.lat-b.lat)*METERS_PER_DEGREE);
}
export function stableGps(previous:GpsFix|null,incoming:GpsFix):GpsFix {
 if(!Number.isFinite(incoming.lat)||!Number.isFinite(incoming.lng)||
    !Number.isFinite(incoming.accuracy)||incoming.accuracy<0||
    Math.abs(incoming.lat)>90||Math.abs(incoming.lng)>180)return previous||incoming;
 if(!previous)return incoming;
 const displacement=distanceMeters(previous,incoming);
 // GPS +/-7 m pode variar várias vezes enquanto o aparelho permanece parado.
 // Não deslocamos o avatar por oscilações menores que a margem de precisão.
 const noiseThreshold=clamp(Math.max(previous.accuracy,incoming.accuracy)*1.6,5,18);
 // Uma nova leitura substancialmente mais precisa deve substituir a anterior.
 if(incoming.accuracy<=previous.accuracy*0.48)return incoming;
 if(displacement<=noiseThreshold)return {...previous,accuracy:Math.min(previous.accuracy,incoming.accuracy)};
 if(incoming.accuracy>previous.accuracy*1.8&&displacement<incoming.accuracy*2.5)return previous;
 // Grandes mudanças são suavizadas; movimentos reais continuam aparecendo.
 const blend=clamp((displacement-noiseThreshold)/Math.max(displacement,1),0.25,0.8);
 return {lat:previous.lat+(incoming.lat-previous.lat)*blend,
         lng:previous.lng+(incoming.lng-previous.lng)*blend,
         accuracy:incoming.accuracy};
}
export function gpsToMap(p:Coordinates,b:MapCorners):Projected|null {
 const origin=b.tl,rad=Math.PI/180;
 const scaleX=METERS_PER_DEGREE*Math.cos(origin.lat*rad),scaleY=METERS_PER_DEGREE;
 const xy=(q:Coordinates)=>({x:(q.lng-origin.lng)*scaleX,y:(origin.lat-q.lat)*scaleY});
 const tr=xy(b.tr),bl=xy(b.bl),br=xy(b.br),pt=xy(p);
 // Inversão bilinear para tolerar quadriláteros medidos manualmente.
 let u=.5,v=.5;
 for(let i=0;i<12;i++){
  const fx=tr.x*u+bl.x*v+(br.x-tr.x-bl.x)*u*v-pt.x;
  const fy=tr.y*u+bl.y*v+(br.y-tr.y-bl.y)*u*v-pt.y;
  const ax=tr.x+(br.x-tr.x-bl.x)*v,ay=tr.y+(br.y-tr.y-bl.y)*v;
  const bx=bl.x+(br.x-tr.x-bl.x)*u,by=bl.y+(br.y-tr.y-bl.y)*u;
  const determinant=ax*by-ay*bx;
  if(Math.abs(determinant)<1e-8)return null;
  const du=(fx*by-fy*bx)/determinant,dv=(ax*fy-ay*fx)/determinant;
  u-=du;v-=dv;
  if(Math.abs(du)+Math.abs(dv)<1e-8)break;
 }
 if(!Number.isFinite(u)||!Number.isFinite(v))return null;
 return {x:u*100,y:v*100,inside:u>=0&&u<=1&&v>=0&&v<=1};
}
export function mapSize(b:MapCorners):{width:number;height:number}{
 return {width:(distanceMeters(b.tl,b.tr)+distanceMeters(b.bl,b.br))/2,
         height:(distanceMeters(b.tl,b.bl)+distanceMeters(b.tr,b.br))/2};
}
export function offMapInfo(p:Projected,b:MapCorners){
 const size=mapSize(b);
 // Keep the signed distance from each outside edge. These distances are in
 // meters so the arrow is correct even on a very wide or very tall map.
 const outsideX=(p.x<0?p.x:p.x>100?p.x-100:0)*size.width/100;
 const outsideY=(p.y<0?p.y:p.y>100?p.y-100:0)*size.height/100;
 const outsideMeters=Math.hypot(outsideX,outsideY);
 const vertical=outsideY<0?'acima':outsideY>0?'abaixo':'';
 const horizontal=outsideX<0?'à esquerda':outsideX>0?'à direita':'';
 const direction=[vertical,horizontal].filter(Boolean).join(' e ')||'perto do limite';
 // ArrowUp points north before rotation; rotate clockwise toward the
 // actual position OUTSIDE the map (not back toward the center).
 const angleDegrees=(Math.atan2(outsideX,-outsideY)*180/Math.PI+360)%360;
 // Inset the marker to keep the entire 36px circle visible on mobile.
 return {
  outsideMeters,
  edgeX:clamp(p.x,7,93),
  edgeY:clamp(p.y,7,93),
  direction,
  angleDegrees
 };
}
export function formatMapDistance(meters:number):string{
 if(!Number.isFinite(meters)||meters<0)return 'distância indisponível';
 return meters>=1000
  ?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(meters/1000)+' km'
  :Math.round(meters)+' m';
}
