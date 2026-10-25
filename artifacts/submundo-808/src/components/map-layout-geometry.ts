// Geometry is expressed in percentages of the map. A surrounding editing pasteboard
// allows items to temporarily sit outside the published map (0..100).
// Keeping the logic independent of React makes shared-border behavior testable.
export type MapRect = {id:string;x:number;y:number;width:number;height:number};
export type Edge = 'left'|'right'|'top'|'bottom';
const EPS=0.15;
const MIN=3;
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
export function resizeShared<T extends MapRect>(areas:T[],id:string,edge:Edge,delta:number):T[]{
 const selected=areas.find(a=>a.id===id);
 if(!selected||!Number.isFinite(delta)||!delta)return areas;
 const neighbors=areas.filter(b=>b.id!==id&&(
 edge==='right'?Math.abs(selected.x+selected.width-b.x)<EPS&&overlap(selected.y,selected.y+selected.height,b.y,b.y+b.height)>EPS:
 edge==='left'?Math.abs(b.x+b.width-selected.x)<EPS&&overlap(selected.y,selected.y+selected.height,b.y,b.y+b.height)>EPS:
 edge==='bottom'?Math.abs(selected.y+selected.height-b.y)<EPS&&overlap(selected.x,selected.x+selected.width,b.x,b.x+b.width)>EPS:
 Math.abs(b.y+b.height-selected.y)<EPS&&overlap(selected.x,selected.x+selected.width,b.x,b.x+b.width)>EPS
 ));
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
export function moveArea<T extends MapRect>(areas:T[],id:string,x:number,y:number,snap=true):T[]{
 const selected=areas.find(a=>a.id===id);if(!selected)return areas;
 let px=limit(x,PASTEBOARD_MIN,PASTEBOARD_MAX-selected.width);
 let py=limit(y,PASTEBOARD_MIN,PASTEBOARD_MAX-selected.height);
 if(snap){
  const xCandidates=[0,100-selected.width];
  const yCandidates=[0,100-selected.height];
  for(const other of areas){
   if(other.id===id)continue;
   if(overlap(py,py+selected.height,other.y,other.y+other.height)>EPS){
    xCandidates.push(other.x+other.width,other.x-selected.width);
   }
   if(overlap(px,px+selected.width,other.x,other.x+other.width)>EPS){
    yCandidates.push(other.y+other.height,other.y-selected.height);
   }
  }
  const nearest=(value:number,candidates:number[])=>candidates
    .filter(v=>v>=PASTEBOARD_MIN&&v<=PASTEBOARD_MAX)
    .sort((a,b)=>Math.abs(value-a)-Math.abs(value-b))[0];
  const snapX=nearest(px,xCandidates),snapY=nearest(py,yCandidates);
  if(snapX!==undefined&&Math.abs(snapX-px)<=1.5)px=snapX;
  if(snapY!==undefined&&Math.abs(snapY-py)<=1.5)py=snapY;
 }
 return areas.map(a=>a.id===id?{...a,x:px,y:py}:a);
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
