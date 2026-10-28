import {useEffect,useRef,useState} from 'react';
import {CameraOff,ScanLine} from 'lucide-react';

type BarcodeReader={detect:(source:HTMLVideoElement)=>Promise<Array<{rawValue:string}>>};
type JsQR=(pixels:Uint8ClampedArray,width:number,height:number,options?:object)=>{data:string}|null;
type Props={onDetected:(value:string)=>void;onError:(message:string)=>void};

// Matches the friend QR reader: prefer the native BarcodeDetector and fall back
// to jsQR for iOS/Safari and browsers without native QR detection.
export default function GroupQrScanner({onDetected,onError}:Props){
 const video=useRef<HTMLVideoElement>(null);
 const stream=useRef<MediaStream|null>(null);
 const active=useRef(false);
 const locked=useRef(false);
 const [scanning,setScanning]=useState(false);
 const cancel=()=>{
  active.current=false;
  stream.current?.getTracks().forEach(track=>track.stop());
  stream.current=null;
  if(video.current)video.current.srcObject=null;
  setScanning(false);
 };
 useEffect(()=>()=>{active.current=false;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;},[]);

 const tokenFromQR=(raw:string)=>{
  try{const url=new URL(raw.trim());return url.searchParams.get('group_invite')||'';}
  catch{return raw.trim();}
 };
 const logFailure=(err:unknown,stage:string)=>{
  const e=err as {name?:string;message?:string;constraint?:string};
  const payload={page:window.location.pathname,component:'groups-camera',code:'camera_access_error',errorType:e?.name||'Error',diagnostic:[stage,window.matchMedia('(display-mode: standalone)').matches?'standalone':'browser',window.isSecureContext?'secure':'insecure',e?.constraint||'none',String(e?.message||'').slice(0,110)].join(' | ')};
  console.error('[Submundo808] Group QR camera failure',payload);
  void fetch('/api/client-errors',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>{});
 };
 async function start(){
  if(active.current)return;
  onError('');
  if(!navigator.mediaDevices?.getUserMedia){onError('A câmera exige HTTPS e um navegador compatível. Cole o link do grupo como alternativa.');return;}
  active.current=true;locked.current=false;
  let stage='getUserMedia';
  try{
   let media:MediaStream;
   try{media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});}
   catch(error){
    if((error as DOMException)?.name!=='OverconstrainedError')throw error;
    stage='getUserMedia-fallback';
    media=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
   }
   if(!active.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;setScanning(true);
   // Wait for React to render the video before attaching the camera stream.
   let element:HTMLVideoElement|null=null;
   for(let i=0;i<30&&active.current;i++){
    element=video.current;
    if(element)break;
    await new Promise<void>(resolve=>window.setTimeout(resolve,50));
   }
   if(!element)throw Error('Não foi possível iniciar a visualização da câmera.');
   stage='video-playback';
   element.srcObject=media;await element.play();
   stage='qr-decoder';
   const Native=(window as unknown as {BarcodeDetector?:new(args:{formats:string[]})=>BarcodeReader}).BarcodeDetector;
   let detector:BarcodeReader|null=null;
   try{if(Native)detector=new Native({formats:['qr_code']});}catch{}
   let jsQR=(window as unknown as {jsQR?:JsQR}).jsQR;
   if(!jsQR){
    try{
     await new Promise<void>((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      script.onload=()=>resolve();script.onerror=()=>reject(Error('Falha ao carregar leitor QR'));
      document.head.appendChild(script);
     });
     jsQR=(window as unknown as {jsQR?:JsQR}).jsQR;
    }catch{if(!detector)throw Error('Não foi possível carregar o leitor QR. Cole o link do grupo.');}
   }
   const canvas=document.createElement('canvas');
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   let warned=false;
   while(active.current){
    try{
     let value='';
     if(detector){try{value=(await detector.detect(element))[0]?.rawValue||'';}catch{detector=null;}}
     if(!value&&jsQR&&ctx&&element.readyState>=2&&element.videoWidth>0){
      const scale=Math.min(1,720/Math.max(element.videoWidth,element.videoHeight));
      canvas.width=Math.round(element.videoWidth*scale);canvas.height=Math.round(element.videoHeight*scale);
      ctx.drawImage(element,0,0,canvas.width,canvas.height);
      const image=ctx.getImageData(0,0,canvas.width,canvas.height);
      value=jsQR(image.data,canvas.width,canvas.height,{inversionAttempts:'attemptBoth'})?.data||'';
     }
     if(value&&!locked.current){
      const token=tokenFromQR(value);
      if(!/^[a-f0-9]{64}$/.test(token)){
       if(!warned){onError('Este QR Code não é um convite de grupo do Submundo808.');warned=true;}
      }else{
       locked.current=true;cancel();onError('');onDetected(token);return;
      }
     }
    }catch{}
    await new Promise<void>(resolve=>window.setTimeout(resolve,250));
   }
  }catch(error){
   if(!active.current)return;
   logFailure(error,stage);cancel();
   const e=error as DOMException;
   if(e.name==='NotAllowedError'||e.name==='PermissionDeniedError'){
    onError('Acesso à câmera bloqueado. Libere a câmera nas permissões do Submundo808 ou do navegador e tente novamente.');
   }else if(e.name==='NotFoundError'||e.name==='DevicesNotFoundError'){
    onError('Nenhuma câmera encontrada. Você pode entrar usando o link de convite.');
   }else if(e.name==='NotReadableError'||e.name==='TrackStartError'){
    onError('A câmera está ocupada. Feche outros aplicativos que a estejam usando e tente novamente.');
   }else onError(e.message||'Não foi possível abrir a câmera. Use o link de convite.');
  }
 }
 return <div className="space-y-3">
  {!scanning?<button type="button" onClick={()=>void start()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#c4ff40]/50 px-4 py-3.5 text-sm font-bold text-[#c4ff40]"><ScanLine size={19}/> Escanear QR Code</button>:<>
   <div className="relative overflow-hidden rounded-xl border border-[#c4ff40]/40 bg-black"><video ref={video} autoPlay muted playsInline aria-label="Câmera para escanear o QR Code do grupo" className="aspect-square w-full object-cover"/><div aria-hidden="true" className="pointer-events-none absolute inset-[17%] rounded-lg border-2 border-[#c4ff40]/65"/></div>
   <p className="text-center text-xs text-white/55">Aponte a câmera para o QR Code de convite do grupo.</p>
   <button type="button" onClick={cancel} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm"><CameraOff size={17}/> Fechar câmera</button>
  </>}
 </div>;
}
