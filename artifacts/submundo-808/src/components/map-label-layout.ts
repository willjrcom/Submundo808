// Automatic labels only: never mutate persisted room or marker positions.
// Work in rendered pixels so labels do not collide differently on mobile.
type Room={id:string;name:string;x:number;y:number;width:number;height:number};
type Point={x:number;y:number;name:string;size?:number};
type Rect={left:number;top:number;right:number;bottom:number};
const overlap=(a:Rect,b:Rect)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
const rect=(cx:number,cy:number,w:number,h:number):Rect=>({left:cx-w/2,top:cy-h/2,right:cx+w/2,bottom:cy+h/2});
export type RoomLabel={id:string;x:number;y:number};
export function layoutRoomLabels(rooms:Room[],points:Point[],width:number,height:number):RoomLabel[]{
 const w=Math.max(width,240),h=Math.max(height,180);
 const obstructions:Rect[]=points.map(point=>{
  const size=point.size||42;
  const labelWidth=Math.min(140,Math.max(size,point.name.length*6.2+13));
  const cx=point.x*w/100,top=point.y*h/100-size/2;
  return {left:cx-labelWidth/2-5,right:cx+labelWidth/2+5,top:top-5,bottom:top+size+31};
 });
 const chosen:RoomLabel[]=[];
 for(const room of rooms){
  const left=room.x*w/100,top=room.y*h/100,roomW=room.width*w/100,roomH=room.height*h/100;
  const labelW=Math.min(Math.max(44,room.name.length*7.1+25),Math.max(44,roomW-8));
  const labelH=24;
  const horizontal=[left+labelW/2+7,left+roomW-labelW/2-7,left+roomW/2];
  const vertical=[top+labelH/2+8,top+roomH-labelH/2-8,top+roomH/2];
  let best={score:Infinity,x:left+roomW/2,y:top+roomH/2};
  const candidates=[
   [0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]
  ];
  for(let i=0;i<candidates.length;i++){
   const [xi,yi]=candidates[i];
   const cx=horizontal[xi],cy=vertical[yi];
   const box=rect(cx,cy,labelW,labelH);
   const inside=Math.max(0,left+4-box.left)+Math.max(0,box.right-(left+roomW-4))
    +Math.max(0,top+4-box.top)+Math.max(0,box.bottom-(top+roomH-4));
   const obstructionPenalty=obstructions.reduce((sum,obs)=>sum+overlap(box,obs),0);
   const score=obstructionPenalty*100+inside*1000+i;
   if(score<best.score)best={score,x:cx,y:cy};
  }
  const label={id:room.id,x:best.x/w*100,y:best.y/h*100};
  chosen.push(label);
  obstructions.push(rect(best.x,best.y,labelW+6,labelH+6));
 }
 return chosen;
}

export type PointLabel={index:number;x:number;y:number;visible:boolean};
// Labels are independent overlays; neither marker geometry nor saved coordinates change.
export function layoutPointLabels(rooms:Room[],points:Point[],width:number,height:number):PointLabel[]{
 const w=Math.max(width,160),h=Math.max(height,160);
 const occupied:Rect[]=[];
 // All icons take precedence over labels.
 for(const p of points){const size=p.size||42;occupied.push(rect(p.x*w/100,p.y*h/100,size+6,size+6));}
 for(const label of layoutRoomLabels(rooms,points,w,h)){
  const room=rooms.find(r=>r.id===label.id);if(!room)continue;
  occupied.push(rect(label.x*w/100,label.y*h/100,Math.min(150,room.name.length*7+30),25));
 }
 return points.map((point,index)=>{
  const px=point.x*w/100,py=point.y*h/100,size=point.size||42;
  const labelW=Math.min(116,Math.max(40,point.name.length*5.7+14)),labelH=22;
  const margin=size/2+labelH/2+6;
  const dx=size/2+labelW/2+6;
  const positions:[[number,number],...Array<[number,number]>]=[
   [px,py-margin],[px,py+margin],[px+dx,py],[px-dx,py],
   [px+dx,py-margin],[px-dx,py-margin],[px+dx,py+margin],[px-dx,py+margin]
  ];
  let best:{score:number;x:number;y:number}|null=null;
  for(const [cx,cy] of positions){
   const b=rect(cx,cy,labelW,labelH);
   const outside=Math.max(0,4-b.left)+Math.max(0,b.right-(w-4))+Math.max(0,4-b.top)+Math.max(0,b.bottom-(h-4));
   const collisions=occupied.reduce((total,o)=>total+overlap(b,o),0);
   const score=collisions*1000+outside*1000+Math.hypot(cx-px,cy-py)*.001;
   if(!best||score<best.score)best={score,x:cx,y:cy};
  }
  if(!best)return {index,x:point.x,y:point.y,visible:false};
  // Hide labels that cannot be placed without collisions; icons remain accessible.
  const visible=best.score<100;
  if(visible)occupied.push(rect(best.x,best.y,labelW+5,labelH+5));
  return {index,x:best.x/w*100,y:best.y/h*100,visible};
 });
}
