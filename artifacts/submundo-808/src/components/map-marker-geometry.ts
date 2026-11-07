export type MapSide='top'|'right'|'bottom'|'left';
export type MarkerAnchor={side:MapSide;offset:number;scope?:'map'|'area'};
export type PositionedMarker={type:string;x:number;y:number;anchor?:MarkerAnchor;area_id?:string;from_area_id?:string;to_area_id?:string};
export type MarkerRoom={id:string;x:number;y:number;width:number;height:number;geometry?:{shape?:string;groupId?:string|null}};
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
 const offset=clamp(marker.anchor?.offset??(side==='top'||side==='bottom'?marker.x:marker.y));
 return {...marker,...positionOnEdge(side,offset),anchor:{side,offset,scope:'map' as const},area_id:undefined};
}
export function freeMarker<T extends PositionedMarker>(marker:T):T{
 return {...marker,anchor:undefined};
}
export function normalizeMarker<T extends PositionedMarker>(marker:T):T{
 if(marker.anchor?.scope==='area')return marker;
 if(marker.type==='entrada'){
  const side=marker.anchor&&MAP_SIDES.includes(marker.anchor.side)?marker.anchor.side:closestMapEdge(marker.x,marker.y).side;
  return anchorMarker(marker,side);
 }
 if(marker.anchor&&MAP_SIDES.includes(marker.anchor.side)){
  const anchor={side:marker.anchor.side,offset:clamp(marker.anchor.offset)};
  return {...marker,...positionOnEdge(anchor.side,anchor.offset),anchor:{...anchor,scope:'map' as const},area_id:undefined};
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
 if(type==='entrada'&&marker.anchor?.scope==='area'&&marker.area_id)return next;
 if(type==='entrada')return anchorMarker(next,marker.anchor?.side||closestMapEdge(marker.x,marker.y).side);
 if(marker.type==='entrada')return freeMarker(next);
 return next;
}

/**
 * Marker x/y describes the CENTRE of the icon. A point anchored at x=0,
 * x=100, y=0 or y=100 therefore straddles that map border equally.
 * The label is drawn separately and must never affect this geometry.
 */
export function markerIconStyle(marker:Pick<PositionedMarker,'x'|'y'>,size:number){
 return {
  position:'absolute' as const,
  left:marker.x+'%',
  top:marker.y+'%',
  // Scale icon footprint in the UI only; leave the saved marker dimensions intact.
  width:`calc(${size}px * var(--submundo-map-marker-scale, 1))`,
  height:`calc(${size}px * var(--submundo-map-marker-scale, 1))`,
  transform:'translate(-50%, -50%)',
  transformOrigin:'center center'
 };
}

const percent=(n:number)=>Math.max(0,Math.min(100,n));
const isWithinRoom=(room:MarkerRoom,x:number,y:number)=>{
 if(room.width<=0||room.height<=0)return false;
 const px=(x-room.x)/room.width,py=(y-room.y)/room.height;
 if(room.geometry?.shape==='ellipse')return (px-.5)**2/.25+(py-.5)**2/.25<=1.00001;
 return px>=-0.00001&&px<=1.00001&&py>=-0.00001&&py<=1.00001;
};

/** In overlapping rooms, prefer the smallest footprint. Hidden grouped members remain owners. */
export function roomContainingPoint<A extends MarkerRoom>(rooms:A[],x:number,y:number):A|undefined{
 return rooms.filter(room=>isWithinRoom(room,x,y)).sort((a,b)=>a.width*a.height-b.width*b.height)[0];
}

export function closestRoomEdge(room:MarkerRoom,x:number,y:number):MarkerAnchor{
 const options=[
  {side:'top' as const,distance:Math.abs(y-room.y),offset:percent((x-room.x)/room.width*100)},
  {side:'right' as const,distance:Math.abs(x-room.x-room.width),offset:percent((y-room.y)/room.height*100)},
  {side:'bottom' as const,distance:Math.abs(y-room.y-room.height),offset:percent((x-room.x)/room.width*100)},
  {side:'left' as const,distance:Math.abs(x-room.x),offset:percent((y-room.y)/room.height*100)}
 ];
 options.sort((a,b)=>a.distance-b.distance);
 return {side:options[0].side,offset:options[0].offset,scope:'area'};
}

/** All coordinates remain map percentages; an area anchor measures offset along its own edge. */
export function positionOnRoomEdge(room:MarkerRoom,side:MapSide,offset:number){
 const f=percent(offset)/100;
 let x=room.x+(side==='left'?0:side==='right'?room.width:room.width*f);
 let y=room.y+(side==='top'?0:side==='bottom'?room.height:room.height*f);
 if(room.geometry?.shape==='ellipse'){
  const centerX=room.x+room.width/2,centerY=room.y+room.height/2;
  const dx=(x-centerX)/(room.width/2),dy=(y-centerY)/(room.height/2);
  const length=Math.hypot(dx,dy)||1;
  x=centerX+(dx/length)*room.width/2;
  y=centerY+(dy/length)*room.height/2;
 }
 return {x,y};
}

export function anchorMarkerInRoom<T extends PositionedMarker>(marker:T,room:MarkerRoom,side:MapSide,offset?:number):T{
 const current=marker.anchor?.scope==='area'&&marker.area_id===room.id?marker.anchor.offset:undefined;
 const projected=side==='top'||side==='bottom'
  ?percent((marker.x-room.x)/room.width*100)
  :percent((marker.y-room.y)/room.height*100);
 const next=percent(offset??current??projected);
 return {...marker,...positionOnRoomEdge(room,side,next),area_id:room.id,anchor:{side,offset:next,scope:'area'}} as T;
}

export function bindMarkerToRoom<T extends PositionedMarker>(marker:T,room:MarkerRoom):T{
 if(marker.anchor){
  const side=marker.anchor.scope==='area'?marker.anchor.side:closestRoomEdge(room,marker.x,marker.y).side;
  return anchorMarkerInRoom(marker,room,side,marker.anchor.scope==='area'?marker.anchor.offset:undefined);
 }
 const x=isWithinRoom(room,marker.x,marker.y)?marker.x:room.x+room.width/2;
 const y=isWithinRoom(room,marker.x,marker.y)?marker.y:room.y+room.height/2;
 return {...marker,x,y,area_id:room.id} as T;
}

/** Legacy free points inside rooms acquire a room link; map-edge anchors remain backward compatible. */
export function associateMarkerWithRoom<T extends PositionedMarker>(marker:T,rooms:MarkerRoom[]):T{
 if(marker.type==='passagem'||marker.type==='entrada'||marker.anchor?.scope==='map')return marker;
 if(marker.area_id&&rooms.some(r=>r.id===marker.area_id))return marker;
 if(marker.anchor?.scope==='area')return {...marker,anchor:undefined,area_id:undefined} as T;
 const owner=roomContainingPoint(rooms,marker.x,marker.y);
 return owner?{...marker,area_id:owner.id} as T:marker;
}

export function moveMarkerInRooms<T extends PositionedMarker>(marker:T,x:number,y:number,rooms:MarkerRoom[]):T{
 if(marker.anchor?.scope==='area'){
  const room=rooms.find(r=>r.id===marker.area_id);
  if(!room)return {...marker,anchor:undefined,area_id:undefined} as T;
  const offset=marker.anchor.side==='top'||marker.anchor.side==='bottom'
   ?percent((x-room.x)/room.width*100):percent((y-room.y)/room.height*100);
  return anchorMarkerInRoom(marker,room,marker.anchor.side,offset);
 }
 const moved=moveMarker(marker,x,y);
 if(marker.anchor||marker.type==='passagem')return moved;
 const owner=roomContainingPoint(rooms,moved.x,moved.y);
 return {...moved,area_id:owner?.id} as T;
}

function sharedBorder(a:MarkerRoom,b:MarkerRoom){
 const eps=.05;
 const lowY=Math.max(a.y,b.y),highY=Math.min(a.y+a.height,b.y+b.height);
 const lowX=Math.max(a.x,b.x),highX=Math.min(a.x+a.width,b.x+b.width);
 if(highY-lowY>eps&&Math.abs(a.x+a.width-b.x)<eps)return {axis:'y' as const,at:b.x,lo:lowY,hi:highY};
 if(highY-lowY>eps&&Math.abs(b.x+b.width-a.x)<eps)return {axis:'y' as const,at:a.x,lo:lowY,hi:highY};
 if(highX-lowX>eps&&Math.abs(a.y+a.height-b.y)<eps)return {axis:'x' as const,at:b.y,lo:lowX,hi:highX};
 if(highX-lowX>eps&&Math.abs(b.y+b.height-a.y)<eps)return {axis:'x' as const,at:a.y,lo:lowX,hi:highX};
 return null;
}

/** Moving/resizing a room or entire group carries its markers, including shared passages. */
export function moveRoomMarkers<T extends PositionedMarker>(
 markers:T[],oldRooms:MarkerRoom[],newRooms:MarkerRoom[]
):T[]{
 const oldById=new Map(oldRooms.map(r=>[r.id,r]));
 const newById=new Map(newRooms.map(r=>[r.id,r]));
 return markers.map(marker=>{
  if(marker.type==='passagem'&&marker.from_area_id&&marker.to_area_id){
   const oldA=oldById.get(marker.from_area_id),oldB=oldById.get(marker.to_area_id);
   const newA=newById.get(marker.from_area_id),newB=newById.get(marker.to_area_id);
   if(!oldA||!oldB||!newA||!newB)return marker;
   const before=sharedBorder(oldA,oldB),after=sharedBorder(newA,newB);
   if(!before||!after)return marker;
   const along=before.axis==='x'?marker.x:marker.y;
   const ratio=percent((along-before.lo)/(before.hi-before.lo)*100)/100;
   const newAlong=after.lo+ratio*(after.hi-after.lo);
   return {...marker,x:after.axis==='x'?newAlong:after.at,y:after.axis==='y'?newAlong:after.at} as T;
  }
  const old=marker.area_id?oldById.get(marker.area_id):undefined;
  const next=marker.area_id?newById.get(marker.area_id):undefined;
  if(!old||!next||old.x===next.x&&old.y===next.y&&old.width===next.width&&old.height===next.height&&old.geometry?.shape===next.geometry?.shape)return marker;
  if(marker.anchor?.scope==='area')return anchorMarkerInRoom(marker,next,marker.anchor.side,marker.anchor.offset);
  return {...marker,x:next.x+(marker.x-old.x)/old.width*next.width,
   y:next.y+(marker.y-old.y)/old.height*next.height} as T;
 });
}
