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
// Moving a connected floorplan translates the entire touching group. This keeps
// its borders joined; internal partitions are changed only by resizeShared().
export function moveArea<T extends MapRect>(areas:T[],id:string,x:number,y:number,snap=true):T[]{
 const selected=areas.find(a=>a.id===id);if(!selected)return areas;
 const ids=new Set([id]);let changed=true;
 while(changed){changed=false;for(const a of areas)if(!ids.has(a.id)&&areas.some(b=>ids.has(b.id)&&sharesBorder(a,b))){ids.add(a.id);changed=true;}}
 const group=areas.filter(a=>ids.has(a.id)),outside=areas.filter(a=>!ids.has(a.id));
 const minX=Math.min(...group.map(a=>a.x)),maxX=Math.max(...group.map(a=>a.x+a.width));
 const minY=Math.min(...group.map(a=>a.y)),maxY=Math.max(...group.map(a=>a.y+a.height));
 let dx=limit(x-selected.x,-minX,100-maxX),dy=limit(y-selected.y,-minY,100-maxY);
 if(snap&&outside.length){
  const xDeltas:number[]=[],yDeltas:number[]=[];
  for(const a of group)for(const b of outside){
   if(overlap(a.y+dy,a.y+a.height+dy,b.y,b.y+b.height)>EPS)
    xDeltas.push((b.x+b.width)-(a.x+dx),b.x-(a.x+a.width+dx));
   if(overlap(a.x+dx,a.x+a.width+dx,b.x,b.x+b.width)>EPS)
    yDeltas.push((b.y+b.height)-(a.y+dy),b.y-(a.y+a.height+dy));
  }
  const closest=(deltas:number[])=>deltas.filter(d=>Math.abs(d)<=2).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
  const sx=closest(xDeltas),sy=closest(yDeltas);
  if(sx!==undefined)dx=limit(dx+sx,-minX,100-maxX);
  if(sy!==undefined)dy=limit(dy+sy,-minY,100-maxY);
 }
 const candidate=areas.map(a=>ids.has(a.id)?{...a,x:a.x+dx,y:a.y+dy}:a);
 for(let i=0;i<candidate.length;i++)for(let j=i+1;j<candidate.length;j++){
  if(!intersects(areas[i],areas[j])&&intersects(candidate[i],candidate[j]))return areas;
 }
 return candidate;
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
