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
