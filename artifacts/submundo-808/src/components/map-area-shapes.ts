import {intersects,moveArea,snapMoveTranslation,sharesBorder,resizeShared,limit,type MapRect,type Edge} from './map-layout-geometry.ts';

export type AreaShape='rect'|'ellipse';
export type CurveSide='top'|'right'|'bottom'|'left';
export type CurveDirection='in'|'out';
export type AreaCurve={side:CurveSide;direction:CurveDirection;depth:number};
export type AreaGeometry={shape?:AreaShape;curve?:AreaCurve|null;curves?:Partial<Record<CurveSide,AreaCurve>>;groupId?:string|null};
export type GeometricArea=MapRect&{geometry?:AreaGeometry};
const EPS=0.001;
const snap=(n:number)=>Math.round(n*10000)/10000;
const eq=(a:number,b:number)=>Math.abs(a-b)<EPS;
const key=(x:number,y:number)=>snap(x)+','+snap(y);
const geometryOf=(a:GeometricArea)=>a.geometry||{};
export const rootAreaId=(a:GeometricArea)=>geometryOf(a).groupId||a.id;
export const visibleAreas=<T extends GeometricArea>(areas:T[])=>areas.filter(a=>!geometryOf(a).groupId);
export const groupMembers=<T extends GeometricArea>(areas:T[],rootId:string)=>areas.filter(a=>a.id===rootId||geometryOf(a).groupId===rootId);
export const isGrouped=(areas:GeometricArea[],rootId:string)=>areas.some(a=>geometryOf(a).groupId===rootId);
export const canGroup=(areas:GeometricArea[],rootId:string,childId:string)=>{
 const root=areas.find(a=>a.id===rootId),child=areas.find(a=>a.id===childId);
 if(!root||!child||root.id===child.id||geometryOf(root).groupId||geometryOf(child).groupId)return false;
 const existing=groupMembers(areas,rootId),joining=groupMembers(areas,childId);
 if([...existing,...joining].some(a=>geometryOf(a).shape==='ellipse'))return false;
 return existing.some(a=>joining.some(b=>touchingForStorage(a,b)));
};
export function groupWith<T extends GeometricArea>(areas:T[],rootId:string,childId:string):T[]{
 if(!canGroup(areas,rootId,childId))return areas;
 const joining=new Set(groupMembers(areas,childId).map(a=>a.id));
 return areas.map(a=>joining.has(a.id)?{...a,geometry:{...geometryOf(a),groupId:rootId}}:a);
}
export function ungroup<T extends GeometricArea>(areas:T[],rootId:string):T[]{
 return areas.map(a=>geometryOf(a).groupId===rootId?{...a,geometry:{...geometryOf(a),groupId:null}}:a);
}
export function moveAreaGroup<T extends GeometricArea>(areas:T[],rootId:string,x:number,y:number,snapEdges=true):T[]{
 const members=groupMembers(areas,rootId),root=areas.find(a=>a.id===rootId);
 if(!root||!members.length)return areas;
 if(members.length===1)return moveArea(areas,rootId,x,y,snapEdges);
 const others=areas.filter(a=>!members.some(m=>m.id===a.id));
 const lowX=Math.min(...members.map(a=>a.x)),lowY=Math.min(...members.map(a=>a.y));
 const highX=Math.max(...members.map(a=>a.x+a.width)),highY=Math.max(...members.map(a=>a.y+a.height));
 const desiredX=limit(x-root.x,-35-lowX,135-highX);
 const desiredY=limit(y-root.y,-35-lowY,135-highY);
 const snapped=snapEdges?snapMoveTranslation(members,others,desiredX,desiredY):{dx:desiredX,dy:desiredY};
 const dx=limit(snapped.dx,-35-lowX,135-highX);
 const dy=limit(snapped.dy,-35-lowY,135-highY);
 const moved=members.map(a=>({...a,x:snap(a.x+dx),y:snap(a.y+dy)}));
 if(moved.some(a=>a.x< -35-EPS||a.y< -35-EPS||a.x+a.width>135+EPS||a.y+a.height>135+EPS||others.some(b=>intersects(a,b))))return areas;
 return areas.map(a=>moved.find(m=>m.id===a.id)||a);
}

/** A joined side is not a resize handle. Keep the original rectangles independent. */
export type OuterResizeHandle={areaId:string;edge:Edge;x:number;y:number};
const outerSides:Edge[]=['left','right','top','bottom'];
const hasSpan=(a:number,b:number,c:number,d:number)=>Math.min(b,d)-Math.max(a,c)>EPS;
function siblingCoversSide(a:GeometricArea,b:GeometricArea,side:Edge){
 if(side==='left'||side==='right'){
  const x=side==='left'?a.x:a.x+a.width;
  return b.x<=x+EPS&&b.x+b.width>=x-EPS&&hasSpan(a.y,a.y+a.height,b.y,b.y+b.height);
 }
 const y=side==='top'?a.y:a.y+a.height;
 return b.y<=y+EPS&&b.y+b.height>=y-EPS&&hasSpan(a.x,a.x+a.width,b.x,b.x+b.width);
}
/** Expose only full external edges of each saved piece, including grouped children.
 * A partially shared edge remains locked: resizing it as a whole would move
 * the internal seam and break an adjacent rectangle.
 */
export function outerResizeHandles<T extends GeometricArea>(areas:T[],rootId:string):OuterResizeHandle[]{
 const root=areas.find(a=>a.id===rootId);
 if(!root||root.geometry?.groupId)return [];
 const members=groupMembers(areas,rootId);
 return members.flatMap(room=>outerSides
  .filter(edge=>!members.some(sibling=>sibling.id!==room.id&&siblingCoversSide(room,sibling,edge)))
  .map(edge=>({
   areaId:room.id,edge,
   x:edge==='left'?room.x:edge==='right'?room.x+room.width:room.x+room.width/2,
   y:edge==='top'?room.y:edge==='bottom'?room.y+room.height:room.y+room.height/2
  })));
}
// Match the persistence validator (server/map-area-geometry.mjs) so the UI
// never accepts an edit that the API would reject as a disconnected group.
function touchingForStorage(a:GeometricArea,b:GeometricArea){
 const x=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
 const y=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
 const epsilon=.06;
 return (x>epsilon&&y>epsilon)||(Math.abs(x)<epsilon&&y>epsilon)||(Math.abs(y)<epsilon&&x>epsilon);
}
function groupsRemainConnected(areas:GeometricArea[]){
 for(const root of visibleAreas(areas)){
  const members=groupMembers(areas,root.id);
  if(members.length<=1)continue;
  const reached=new Set([root.id]);let changed=true;
  while(changed){
   changed=false;
   for(const item of members){
    if(reached.has(item.id))continue;
    if(members.some(other=>reached.has(other.id)&&touchingForStorage(item,other))){
     reached.add(item.id);changed=true;
    }
   }
  }
  if(reached.size!==members.length)return false;
 }
 return true;
}
/** Resize the selected rectangular piece without allowing hidden internal seams to move.
 * Validate after snapping and after any changes to adjacent independent rooms.
 */
export function resizeOuterGroupEdge<T extends GeometricArea>(areas:T[],rootId:string,partId:string,edge:Edge,delta:number,snapEdges=true):T[]{
 if(!outerResizeHandles(areas,rootId).some(h=>h.areaId===partId&&h.edge===edge))return areas;
 const next=resizeShared(areas,partId,edge,delta,snapEdges);
 return groupsRemainConnected(next)?next:areas;
}

type Pt={x:number;y:number};
type Segment={from:Pt;to:Pt};
const onSegment=(from:Pt,to:Pt,area:GeometricArea,side:CurveSide)=>{
 if(side==='top')return eq(from.y,area.y)&&eq(to.y,area.y)&&Math.min(from.x,to.x)>=area.x-EPS&&Math.max(from.x,to.x)<=area.x+area.width+EPS;
 if(side==='bottom')return eq(from.y,area.y+area.height)&&eq(to.y,area.y+area.height)&&Math.min(from.x,to.x)>=area.x-EPS&&Math.max(from.x,to.x)<=area.x+area.width+EPS;
 if(side==='left')return eq(from.x,area.x)&&eq(to.x,area.x)&&Math.min(from.y,to.y)>=area.y-EPS&&Math.max(from.y,to.y)<=area.y+area.height+EPS;
 return eq(from.x,area.x+area.width)&&eq(to.x,area.x+area.width)&&Math.min(from.y,to.y)>=area.y-EPS&&Math.max(from.y,to.y)<=area.y+area.height+EPS;
};
const point=(p:Pt)=>snap(p.x)+' '+snap(p.y);
const SIDES:CurveSide[]=['top','right','bottom','left'];
function curveAt(area:GeometricArea,side:CurveSide){
 const geometry=geometryOf(area);
 return geometry.curves?.[side]||(geometry.curve?.side===side?geometry.curve:null);
}
function curveFor(from:Pt,to:Pt,areas:GeometricArea[]){
 return areas.find(a=>SIDES.some(side=>curveAt(a,side)&&onSegment(from,to,a,side)));
}
function drawSegment(from:Pt,to:Pt,areas:GeometricArea[]){
 const area=curveFor(from,to,areas);
 const side=area&&SIDES.find(s=>onSegment(from,to,area,s)&&curveAt(area,s));
 const curve=area&&side?curveAt(area,side):null;
 if(!area||!curve||curve.depth<=0)return 'L'+point(to);
 const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy);
 if(len<EPS)return '';
 const depth=Math.min(Math.min(area.width,area.height)*curve.depth/100,len/3);
 const sign=curve.direction==='in'?1:-1;
 const center={x:(from.x+to.x)/2-sign*(dy/len)*depth*2,y:(from.y+to.y)/2+sign*(dx/len)*depth*2};
 return 'Q'+point(center)+' '+point(to);
}
function ellipsePath(a:GeometricArea){
 const midX=a.x+a.width/2,midY=a.y+a.height/2,rx=a.width/2,ry=a.height/2;
 if(!SIDES.some(side=>curveAt(a,side)))
  return 'M'+point({x:midX+rx,y:midY})+' A'+snap(rx)+' '+snap(ry)+' 0 1 0 '+point({x:midX-rx,y:midY})+' A'+snap(rx)+' '+snap(ry)+' 0 1 0 '+point({x:midX+rx,y:midY})+' Z';
 // Four smooth elliptical quadrants, with independent radial offsets per side.
 const radius=(side:CurveSide)=>{
  const selected=curveAt(a,side);
  return 1+(selected?(selected.direction==='out'?1:-1)*selected.depth*.007:0);
 };
 const top={x:midX,y:midY-ry*radius('top')};
 const right={x:midX+rx*radius('right'),y:midY};
 const bottom={x:midX,y:midY+ry*radius('bottom')};
 const left={x:midX-rx*radius('left'),y:midY};
 const k=.5522847498;
 return 'M'+point(top)+
  ' C'+point({x:top.x+k*rx,y:top.y})+' '+point({x:right.x,y:right.y-k*ry})+' '+point(right)+
  ' C'+point({x:right.x,y:right.y+k*ry})+' '+point({x:bottom.x+k*rx,y:bottom.y})+' '+point(bottom)+
  ' C'+point({x:bottom.x-k*rx,y:bottom.y})+' '+point({x:left.x,y:left.y+k*ry})+' '+point(left)+
  ' C'+point({x:left.x,y:left.y-k*ry})+' '+point({x:top.x-k*rx,y:top.y})+' '+point(top)+' Z';
}
function unionPath(areas:GeometricArea[]){
 const xs=[...new Set(areas.flatMap(a=>[snap(a.x),snap(a.x+a.width)]))].sort((a,b)=>a-b);
 const ys=[...new Set(areas.flatMap(a=>[snap(a.y),snap(a.y+a.height)]))].sort((a,b)=>a-b);
 const inside=(i:number,j:number)=>{
  if(i<0||j<0||i>=xs.length-1||j>=ys.length-1)return false;
  const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
  return areas.some(a=>x>a.x-EPS&&x<a.x+a.width+EPS&&y>a.y-EPS&&y<a.y+a.height+EPS);
 };
 const edges:Segment[]=[];
 for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
  if(!inside(i,j))continue;
  const x=xs[i],right=xs[i+1],y=ys[j],bottom=ys[j+1];
  if(!inside(i,j-1))edges.push({from:{x,y},to:{x:right,y}});
  if(!inside(i+1,j))edges.push({from:{x:right,y},to:{x:right,y:bottom}});
  if(!inside(i,j+1))edges.push({from:{x:right,y:bottom},to:{x,y:bottom}});
  if(!inside(i-1,j))edges.push({from:{x,y:bottom},to:{x,y}});
 }
 const starts=new Map<string,number[]>();
 edges.forEach((e,i)=>{const k=key(e.from.x,e.from.y);starts.set(k,[...(starts.get(k)||[]),i]);});
 const used=new Set<number>(),paths:string[]=[];
 for(let i=0;i<edges.length;i++){
  if(used.has(i))continue;
  const loop:Segment[]=[];let cursor=i;
  while(!used.has(cursor)){
   used.add(cursor);const edge=edges[cursor];loop.push(edge);
   const next=(starts.get(key(edge.to.x,edge.to.y))||[]).find(candidate=>!used.has(candidate));
   if(next===undefined)break;cursor=next;
  }
  if(!loop.length)continue;
  // Mesclar segmentos contíguos colineares, preservando curvas contínuas.
  const merged:Segment[]=[];
  for(const e of loop){
   const last=merged[merged.length-1];
   if(last&&eq(last.to.x,e.from.x)&&eq(last.to.y,e.from.y)&&
      eq((last.to.x-last.from.x)*(e.to.y-e.from.y),(last.to.y-last.from.y)*(e.to.x-e.from.x))&&
      (last.to.x-last.from.x)*(e.to.x-e.from.x)+(last.to.y-last.from.y)*(e.to.y-e.from.y)>0&&
      curveFor(last.from,last.to,areas)?.id===curveFor(e.from,e.to,areas)?.id){
    last.to=e.to;
   }else merged.push({from:e.from,to:e.to});
  }
  paths.push('M'+point(merged[0].from)+' '+merged.map(e=>drawSegment(e.from,e.to,areas)).join(' ')+' Z');
 }
 return paths.join(' ');
}
// Uma única silhueta por ambiente lógico, sem bordas internas entre partes.
export function areaPath(areas:GeometricArea[],rootId:string){
 const members=groupMembers(areas,rootId);
 if(!members.length)return '';
 if(members.length===1&&geometryOf(members[0]).shape==='ellipse')return ellipsePath(members[0]);
 return unionPath(members);
}
