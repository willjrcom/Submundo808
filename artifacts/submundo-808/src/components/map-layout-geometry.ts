// Geometry is expressed in percentages of the map. A surrounding editing pasteboard
// allows items to temporarily sit outside the published map (0..100).
// Keeping the logic independent of React makes shared-border behavior testable.
export type MapRect = {id:string;x:number;y:number;width:number;height:number};
export type Edge = 'left'|'right'|'top'|'bottom';
const EPS=0.15;
const MIN=3;
// Distância magnética (em pontos percentuais), aplicada somente a bordas próximas.
const SNAP_DISTANCE=2.5;
export const PASTEBOARD_MIN=-35;
export const PASTEBOARD_MAX=135;
export const limit=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const overlap=(a:number,b:number,c:number,d:number)=>Math.min(b,d)-Math.max(a,c);
export const intersects=(a:MapRect,b:MapRect)=>overlap(a.x,a.x+a.width,b.x,b.x+b.width)>EPS&&overlap(a.y,a.y+a.height,b.y,b.y+b.height)>EPS;
export function sharesBorder(a:MapRect,b:MapRect){
 const vertical=overlap(a.y,a.y+a.height,b.y,b.y+b.height)>EPS&&(Math.abs(a.x+a.width-b.x)<EPS||Math.abs(b.x+b.width-a.x)<EPS);
 const horizontal=overlap(a.x,a.x+a.width,b.x,b.x+b.width)>EPS&&(Math.abs(a.y+a.height-b.y)<EPS||Math.abs(b.y+b.height-a.y)<EPS);
 return vertical||horizontal;
}
function valid(a:MapRect){return a.x>=PASTEBOARD_MIN-EPS&&a.y>=PASTEBOARD_MIN-EPS&&a.width>=MIN-EPS&&a.height>=MIN-EPS&&a.x+a.width<=PASTEBOARD_MAX+EPS&&a.y+a.height<=PASTEBOARD_MAX+EPS;}
// Dragging a shared edge adjusts the adjacent rectangles in the same operation,
// so a resize does not create a gap or overlap at the shared partition.
export function resizeShared<T extends MapRect>(areas:T[],id:string,edge:Edge,delta:number,snap=false):T[]{
 const selected=areas.find(a=>a.id===id);
 if(!selected||!Number.isFinite(delta)||!delta)return areas;
 const neighbors=areas.filter(b=>b.id!==id&&(
 edge==='right'?Math.abs(selected.x+selected.width-b.x)<EPS&&overlap(selected.y,selected.y+selected.height,b.y,b.y+b.height)>EPS:
 edge==='left'?Math.abs(b.x+b.width-selected.x)<EPS&&overlap(selected.y,selected.y+selected.height,b.y,b.y+b.height)>EPS:
 edge==='bottom'?Math.abs(selected.y+selected.height-b.y)<EPS&&overlap(selected.x,selected.x+selected.width,b.x,b.x+b.width)>EPS:
 Math.abs(b.y+b.height-selected.y)<EPS&&overlap(selected.x,selected.x+selected.width,b.x,b.x+b.width)>EPS
 ));
 // Snap the dragged edge to the OTHER rooms or any of the four outer
 // boundaries (0% / 100%). Never snap to its own original shared partition:
 // the adjacent room moves in the same operation.
 if(snap){
  const vertical=edge==='left'||edge==='right';
  const edgeNow=vertical?(edge==='left'?selected.x:selected.x+selected.width):(edge==='top'?selected.y:selected.y+selected.height);
  const target=edgeNow+delta;
  const candidates=[0,100];
  for(const other of areas){
   // Exclude only the rooms actually moved with this shared partition.
   if(other.id===id||neighbors.some(n=>n.id===other.id))continue;
   const start=vertical?selected.y:selected.x;
   const end=vertical?selected.y+selected.height:selected.x+selected.width;
   const otherStart=vertical?other.y:other.x;
   const otherEnd=vertical?other.y+other.height:other.x+other.width;
   // Adjacent rooms can share a PERPENDICULAR border, without overlap along
   // the dimension being resized. Their aligned bottoms/tops (or left/right)
   // must still be eligible for snapping.
   const relevant=overlap(start,end,otherStart,otherEnd)>EPS||
    Math.abs(end-otherStart)<=SNAP_DISTANCE||
    Math.abs(otherEnd-start)<=SNAP_DISTANCE;
   if(!relevant)continue;
   if(vertical)candidates.push(other.x,other.x+other.width);
   else candidates.push(other.y,other.y+other.height);
  }
  const nearest=candidates.filter(pos=>Math.abs(pos-target)<=SNAP_DISTANCE)
   .sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];
  if(nearest!==undefined)delta=nearest-edgeNow;
 }
 const result=areas.map(a=>{
  if(a.id===id){
   if(edge==='right')return {...a,width:a.width+delta};
   if(edge==='left')return {...a,x:a.x+delta,width:a.width-delta};
   if(edge==='bottom')return {...a,height:a.height+delta};
   return {...a,y:a.y+delta,height:a.height-delta};
  }
  if(!neighbors.some(b=>b.id===a.id))return a;
  if(edge==='right')return {...a,x:a.x+delta,width:a.width-delta};
  if(edge==='left')return {...a,width:a.width+delta};
  if(edge==='bottom')return {...a,y:a.y+delta,height:a.height-delta};
  return {...a,height:a.height+delta};
 });
 if(result.some(a=>!valid(a)))return areas;
 // Prevent new collisions; tolerate any overlaps already present in legacy maps.
 for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++){
  if(!intersects(areas[i],areas[j])&&intersects(result[i],result[j]))return areas;
 }
 return result;
}
// An environment is moved independently: it can be parked in the pasteboard,
// then dropped against the edge of another environment. Snapping is optional.
/**
 * Return one magnetic translation for every member of a moving group.
 * Room edges (including top/bottom alignment) and map edges share the same
 * threshold as the resize tool. The checkbox controls this whole operation.
 */
export function snapMoveTranslation<T extends MapRect>(moving:T[],others:T[],dx:number,dy:number){
 if(!moving.length)return {dx,dy};
 const xCandidates:number[]=[],yCandidates:number[]=[];
 const near=SNAP_DISTANCE*2;
 for(const room of moving){
  const x=room.x+dx,y=room.y+dy,w=room.width,h=room.height;
  xCandidates.push(-w-room.x, -room.x, 100-w-room.x, 100-room.x);
  yCandidates.push(-h-room.y, -room.y, 100-h-room.y, 100-room.y);
  for(const other of others){
   const ox=other.x,oy=other.y,ow=other.width,oh=other.height;
   const yOverlap=overlap(y,y+h,oy,oy+oh)>EPS;
   const xOverlap=overlap(x,x+w,ox,ox+ow)>EPS;
   const yAdjacent=Math.abs(y+h-oy)<=near||Math.abs(oy+oh-y)<=near;
   const xAdjacent=Math.abs(x+w-ox)<=near||Math.abs(ox+ow-x)<=near;
   // Edge-to-edge contacts between adjacent environments.
   if(yOverlap||yAdjacent){
    xCandidates.push(ox-w-room.x,ox+ow-room.x);
   }
   if(xOverlap||xAdjacent){
    yCandidates.push(oy-h-room.y,oy+oh-room.y);
   }
   // Parallel edges may align, even when two rooms merely touch on
   // the perpendicular axis (e.g. two rooms with matching bottom edges).
   if(xOverlap||xAdjacent){
    yCandidates.push(oy-room.y,oy+oh-h-room.y);
   }
   if(yOverlap||yAdjacent){
    xCandidates.push(ox-room.x,ox+ow-w-room.x);
   }
  }
 }
 const best=(target:number,candidates:number[])=>{
  const next=candidates.filter(v=>Number.isFinite(v)&&Math.abs(v-target)<=SNAP_DISTANCE)
   .sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];
  return next===undefined?target:next;
 };
 return {dx:best(dx,xCandidates),dy:best(dy,yCandidates)};
}
export function moveArea<T extends MapRect>(areas:T[],id:string,x:number,y:number,snap=true):T[]{
 const selected=areas.find(a=>a.id===id);
 if(!selected)return areas;
 let dx=limit(x,PASTEBOARD_MIN,PASTEBOARD_MAX-selected.width)-selected.x;
 let dy=limit(y,PASTEBOARD_MIN,PASTEBOARD_MAX-selected.height)-selected.y;
 if(snap){
  const result=snapMoveTranslation([selected],areas.filter(a=>a.id!==id),dx,dy);
  dx=limit(selected.x+result.dx,PASTEBOARD_MIN,PASTEBOARD_MAX-selected.width)-selected.x;
  dy=limit(selected.y+result.dy,PASTEBOARD_MIN,PASTEBOARD_MAX-selected.height)-selected.y;
 }
 return areas.map(a=>a.id===id?{...a,x:selected.x+dx,y:selected.y+dy}:a);
}
export function freeAreaPosition<T extends MapRect>(areas:T[],width=22,height=18){
 if(!areas.length)return {x:8,y:8,width,height};
 const candidates=areas.flatMap(a=>[
  {x:a.x+a.width,y:a.y},{x:a.x-width,y:a.y},
  {x:a.x,y:a.y+a.height},{x:a.x,y:a.y-height}
 ]);
 for(let y=PASTEBOARD_MIN;y<=PASTEBOARD_MAX-height;y+=3)for(let x=PASTEBOARD_MIN;x<=PASTEBOARD_MAX-width;x+=3)candidates.push({x,y});
 for(const c of candidates){
  if(c.x<PASTEBOARD_MIN||c.y<PASTEBOARD_MIN||c.x+width>PASTEBOARD_MAX||c.y+height>PASTEBOARD_MAX)continue;
  if(!areas.some(a=>intersects({...c,width,height,id:'new'},a)))return {...c,width,height};
 }
 return null;
}
