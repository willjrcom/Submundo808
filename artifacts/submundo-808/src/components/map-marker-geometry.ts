export type MapSide='top'|'right'|'bottom'|'left';
export type MarkerAnchor={side:MapSide;offset:number};
export type PositionedMarker={type:string;x:number;y:number;anchor?:MarkerAnchor};
export const MAP_SIDES:MapSide[]=['top','right','bottom','left'];
const clamp=(v:number)=>Math.max(0,Math.min(100,v));
export function positionOnEdge(side:MapSide,offset:number){
 const t=clamp(offset);
 switch(side){
  case 'top':return {x:t,y:0};
  case 'bottom':return {x:t,y:100};
  case 'left':return {x:0,y:t};
  case 'right':return {x:100,y:t};
 }
}
export function closestMapEdge(x:number,y:number):MarkerAnchor{
 const options=[
  {side:'top' as const,distance:Math.abs(y),offset:x},
  {side:'right' as const,distance:Math.abs(100-x),offset:y},
  {side:'bottom' as const,distance:Math.abs(100-y),offset:x},
  {side:'left' as const,distance:Math.abs(x),offset:y}
 ];
 options.sort((a,b)=>a.distance-b.distance);
 return {side:options[0].side,offset:clamp(options[0].offset)};
}
export function anchorMarker<T extends PositionedMarker>(marker:T,side:MapSide):T{
 const offset=clamp(side==='top'||side==='bottom'?marker.x:marker.y);
 return {...marker,...positionOnEdge(side,offset),anchor:{side,offset}};
}
export function freeMarker<T extends PositionedMarker>(marker:T):T{
 return {...marker,anchor:undefined};
}
export function normalizeMarker<T extends PositionedMarker>(marker:T):T{
 if(marker.type==='entrada'){
  const side=marker.anchor&&MAP_SIDES.includes(marker.anchor.side)?marker.anchor.side:closestMapEdge(marker.x,marker.y).side;
  return anchorMarker(marker,side);
 }
 if(marker.anchor&&MAP_SIDES.includes(marker.anchor.side)){
  const anchor={side:marker.anchor.side,offset:clamp(marker.anchor.offset)};
  return {...marker,...positionOnEdge(anchor.side,anchor.offset),anchor};
 }
 return marker;
}
export function moveMarker<T extends PositionedMarker>(marker:T,x:number,y:number):T{
 if(marker.anchor){
  const side=marker.anchor.side;
  const offset=clamp(side==='top'||side==='bottom'?x:y);
  return {...marker,anchor:{side,offset},...positionOnEdge(side,offset)};
 }
 return {...marker,x:Math.max(-35,Math.min(135,x)),y:Math.max(-35,Math.min(135,y))};
}
export function changeMarkerType<T extends PositionedMarker>(marker:T,type:string):T{
 const next={...marker,type};
 if(type==='entrada')return anchorMarker(next,marker.anchor?.side||closestMapEdge(marker.x,marker.y).side);
 if(marker.type==='entrada')return freeMarker(next);
 return next;
}
