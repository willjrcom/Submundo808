// Map boundary is stored in percentages of the editor pasteboard (not the
// room coordinates). Changing this frame never mutates rooms or POIs.
export type MapFrame={x:number;y:number;width:number;height:number};
export type FrameHandle='left'|'right'|'top'|'bottom'|'tl'|'tr'|'bl'|'br';
export const DEFAULT_MAP_FRAME:MapFrame={x:22,y:22,width:56,height:56};
export const MIN_FRAME_SIZE=18;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function validMapFrame(frame:MapFrame):boolean{
 return !!frame&&[frame.x,frame.y,frame.width,frame.height].every(Number.isFinite)
  &&frame.x>=0&&frame.y>=0&&frame.width>=MIN_FRAME_SIZE&&frame.height>=MIN_FRAME_SIZE
  &&frame.x+frame.width<=100.00001&&frame.y+frame.height<=100.00001;
}
export function normalizeMapFrame(value:unknown):MapFrame{
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  const candidate=value as MapFrame;
  if(validMapFrame(candidate))return {x:candidate.x,y:candidate.y,width:candidate.width,height:candidate.height};
 }
 return {...DEFAULT_MAP_FRAME};
}
export function moveMapFrame(frame:MapFrame,dx:number,dy:number):MapFrame{
 if(![dx,dy].every(Number.isFinite))return frame;
 return {...frame,x:clamp(frame.x+dx,0,100-frame.width),y:clamp(frame.y+dy,0,100-frame.height)};
}
export function resizeMapFrame(frame:MapFrame,handle:FrameHandle,dx:number,dy:number):MapFrame{
 if(!validMapFrame(frame)||![dx,dy].every(Number.isFinite))return frame;
 const left=handle==='left'||handle==='tl'||handle==='bl';
 const right=handle==='right'||handle==='tr'||handle==='br';
 const top=handle==='top'||handle==='tl'||handle==='tr';
 const bottom=handle==='bottom'||handle==='bl'||handle==='br';
 let x1=frame.x,x2=frame.x+frame.width,y1=frame.y,y2=frame.y+frame.height;
 if(left)x1=clamp(x1+dx,0,x2-MIN_FRAME_SIZE);
 if(right)x2=clamp(x2+dx,x1+MIN_FRAME_SIZE,100);
 if(top)y1=clamp(y1+dy,0,y2-MIN_FRAME_SIZE);
 if(bottom)y2=clamp(y2+dy,y1+MIN_FRAME_SIZE,100);
 return {x:x1,y:y1,width:x2-x1,height:y2-y1};
}
// Public map contains the frame only (not the pasteboard). Changing its shape
// changes the rendered aspect, but all room/marker relative coordinates stay put.
export function mapFrameAspect(frame:MapFrame):number{
 return 4/3*frame.width/frame.height;
}
