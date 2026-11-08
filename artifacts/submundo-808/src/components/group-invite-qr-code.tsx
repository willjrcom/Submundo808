import {useMemo} from 'react';
import qrcode from 'qrcode-generator';

/** A local SVG matrix: no external image, network, canvas, or remote QR provider. */
export default function GroupInviteQRCode({link,size=220}:{link:string;size?:number}){
 const {viewSize,d}=useMemo(()=>{
  const qr=qrcode(0,'M');
  qr.addData(link);
  qr.make();
  const modules=qr.getModuleCount(),margin=4;
  const pieces:string[]=[];
  for(let y=0;y<modules;y++){
   for(let x=0;x<modules;x++){
    if(qr.isDark(y,x))pieces.push('M'+(x+margin)+' '+(y+margin)+'h1v1h-1z');
   }
  }
  return {viewSize:modules+margin*2,d:pieces.join('')};
 },[link]);
 return <svg role="img" aria-label="QR Code para entrar no grupo" xmlns="http://www.w3.org/2000/svg"
  viewBox={'0 0 '+viewSize+' '+viewSize} width={size} height={size}
  shapeRendering="crispEdges" className="block max-w-full" style={{backgroundColor:'#ffffff'}}>
  <title>QR Code de convite do grupo</title>
  <rect width={viewSize} height={viewSize} fill="#ffffff"/>
  <path d={d} fill="#000000"/>
 </svg>;
}
