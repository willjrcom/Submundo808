// Geometry is expressed as percentages of the canvas (0..100).
// Keeping the logic independent of React makes shared-border behavior testable.
export type MapRect = {id:string;x:number;y:number;width:number;height:number};
export type Edge = 'left'|'right'|'top'|'bottom';
const EPS=0.15;
const MIN=3;
export const limit=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const overlap=(a:number,b:number,c:number,d:number)=>Math.min(b,d)-Math.max(a,c);
export const intersects=(a:MapRect,b:MapRect)=>overlap(a.x,a.x+a.width,b.x,b.x+b.width)>EPS&&overlap(a.y,a.y+a.height,b.y,b.y+b.height)>EPS;
export function sharesBorder(a:MapRect,b:MapRect){
 const vertical=overlap(a.y,a.y+a.height,b.y,b.y+b.height)>EPS&&(Math.abs(a.x+a.width-b.x)<EPS||Math.abs(b.x+b.width-a.x)<EPS);
 const horizontal=overlap(a.x,a.x+a.width,b.x,b.x+b.width)>EPS&&(Math.abs(a.y+a.height-b.y)<EPS||Math.abs(b.y+b.height-a.y)<EPS);
 return vertical||horizontal;
}
function valid(a:MapRect){return a.x>=-EPS&&a.y>=-EPS&&a.width>=MIN-EPS&&a.height>=MIN-EPS&&a.x+a.width<=100+EPS&&a.y+a.height<=100+EPS;}
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
export function moveArea<T extends MapRect>(areas:T[],id:string,x:number,y:number,snap=true):T[]{
 const selected=areas.find(a=>a.id===id);if(!selected)return areas;
 let px=limit(x,0,100-selected.width),py=limit(y,0,100-selected.height);
 if(snap){
  const sx:number[]=[];const sy:number[]=[];
  for(const other of areas){
   if(other.id===id)continue;
   if(overlap(py,py+selected.height,other.y,other.y+other.height)>EPS){
    sx.push(other.x+other.width,other.x-selected.width);
   }
   if(overlap(px,px+selected.width,other.x,other.x+other.width)>EPS){
    sy.push(other.y+other.height,other.y-selected.height);
   }
  }
  const nearest=(v:number,values:number[])=>values.reduce((best,n)=>Math.abs(n-v)<Math.abs(best-v)?n:best,v);
  const nx=nearest(px,sx);if(Math.abs(nx-px)<=2)px=limit(nx,0,100-selected.width);
  const ny=nearest(py,sy);if(Math.abs(ny-py)<=2)py=limit(ny,0,100-selected.height);
 }
 const candidate={...selected,x:px,y:py};
 if(areas.some(a=>a.id!==id&&intersects(candidate,a)))return areas;
 return areas.map(a=>a.id===id?candidate:a);
}
export function freeAreaPosition<T extends MapRect>(areas:T[],width=22,height=18){
 if(!areas.length)return {x:8,y:8,width,height};
 const candidates=areas.flatMap(a=>[
  {x:a.x+a.width,y:a.y},{x:a.x-width,y:a.y},
  {x:a.x,y:a.y+a.height},{x:a.x,y:a.y-height}
 ]);
 for(let y=0;y<=100-height;y+=2)for(let x=0;x<=100-width;x+=2)candidates.push({x,y});
 for(const c of candidates){
  if(c.x<0||c.y<0||c.x+width>100||c.y+height>100)continue;
  if(!areas.some(a=>intersects({...c,width,height,id:'new'},a)))return {...c,width,height};
 }
 return null;
}
