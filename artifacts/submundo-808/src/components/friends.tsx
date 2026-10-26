import FriendQR from './friend-qr';
import { useEffect, useRef, useState } from 'react';
import { CameraOff, ScanLine, UserPlus, Users, X, RefreshCw, Link2 } from 'lucide-react';
import PageLoading from './page-loading';
import useMinimumLoading from './use-minimum-loading';
type Friend={id:string;name:string};
async function api(route:string, payload?:object){const res=await fetch('/api/friends'+route,{method:payload?'POST':'GET',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:payload?JSON.stringify(payload):undefined});const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error||'Falha na operação.'),{status:res.status});return data;}
function parseToken(raw:string){try{const url=new URL(raw);return url.searchParams.get('invite')||'';}catch{return raw.trim();}}
export default function Friends(){
  const [friends,setFriends]=useState<Friend[]>([]);const [access,setAccess]=useState<'loading'|'guest'|'authenticated'|'error'>('loading');const [showMyQR,setShowMyQR]=useState(false);const [scan,setScan]=useState(false);const [link,setLink]=useState(new URLSearchParams(window.location.search).get('invite')||'');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [status,setStatus]=useState('');
  const video=useRef<HTMLVideoElement>(null);const stream=useRef<MediaStream|null>(null);const scanning=useRef(false);const locked=useRef(false);
  async function load(){
    try{
      const data=await api('');
      setFriends(data.friends||[]);setAccess('authenticated');setError('');
    }catch(e){
      if((e as {status?:number}).status===401)setAccess('guest');
      else {setAccess('error');setError(e instanceof Error?e.message:'Não foi possível carregar os amigos.');}
    }
  }
  useEffect(()=>{void load();return()=>{stream.current?.getTracks().forEach(t=>t.stop());scanning.current=false;};},[]);
  function stop(){scanning.current=false;locked.current=false;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setScan(false);}
  async function add(value:string){const token=parseToken(value);if(!/^[a-f0-9]{64}$/.test(token)){setError('QR Code ou link inválido.');return;}setBusy(true);setError('');try{const data=await api('/add',{token});stop();setLink('');window.history.replaceState({},'',window.location.pathname);setStatus(data.friend.name+' foi adicionado(a) aos seus amigos!');await load();}catch(e){setError(e instanceof Error?e.message:'Erro ao adicionar amigo.');}finally{setBusy(false);locked.current=false;}}
  function logCameraFailure(err:unknown,stage:string){
    const exception=err as {name?:string;message?:string;constraint?:string};
    const displayMode=window.matchMedia('(display-mode: standalone)').matches?'standalone':window.matchMedia('(display-mode: fullscreen)').matches?'fullscreen':'browser';
    const payload={page:window.location.pathname,component:'friends-camera',code:'camera_access_error',errorType:exception?.name||'Error',diagnostic:[stage,displayMode,window.isSecureContext?'secure':'insecure',exception?.constraint||'none',String(exception?.message||'').slice(0,110)].join(' | ')};
    console.error('[Submundo808] Camera failure',payload);
    void fetch('/api/client-errors',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)}).catch(()=>{});
  }
  async function start(){
    if(scanning.current)return;
    setError('');setStatus('');
    if(!navigator.mediaDevices?.getUserMedia){setError('A câmera exige HTTPS e um navegador compatível. Use o link do convite como alternativa.');return;}
    scanning.current=true;
    let cameraStage='getUserMedia';
    try{
      let media:MediaStream;
      try{
        media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
      }catch(e){
        // Retry without constraints only if the requested device settings are unsupported.
        if((e as DOMException)?.name!=='OverconstrainedError')throw e;
        cameraStage='getUserMedia-fallback';
        media=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
      }
      if(!scanning.current){media.getTracks().forEach(t=>t.stop());return;}
      stream.current=media;
      setScan(true);
      // React must mount the video after setScan before srcObject can be assigned.
      let element:HTMLVideoElement|null=null;
      for(let i=0;i<30&&scanning.current;i++){
        element=video.current;
        if(element)break;
        await new Promise<void>(resolve=>window.setTimeout(resolve,50));
      }
      if(!element){throw Error('Não foi possível iniciar a visualização da câmera.');}
      cameraStage='video-playback';
      element.srcObject=media;
      await element.play();
      cameraStage='qr-decoder';
      const Detector=(window as unknown as {BarcodeDetector?:new (options:{formats:string[]})=>{detect:(source:HTMLVideoElement)=>Promise<Array<{rawValue:string}>>}}).BarcodeDetector;
      let detector:InstanceType<NonNullable<typeof Detector>>|null=null;
      try{if(Detector)detector=new Detector({formats:['qr_code']});}catch{}
      type JsQr=(pixels:Uint8ClampedArray,width:number,height:number,options?:object)=>{data:string}|null;
      let jsQR=(window as unknown as {jsQR?:JsQr}).jsQR;
      // Android implementations may expose BarcodeDetector but fail at runtime.
      // Always prepare the canvas fallback rather than trusting API presence.
      if(!jsQR){
        try{
          await new Promise<void>((resolve,reject)=>{
            const script=document.createElement('script');
            script.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
            script.onload=()=>resolve();script.onerror=()=>reject(Error('Falha ao carregar leitor QR'));
            document.head.appendChild(script);
          });
          jsQR=(window as unknown as {jsQR?:JsQr}).jsQR;
        }catch{if(!detector)throw Error('Não foi possível carregar o leitor QR. Cole o link do convite.');}
      }
      const canvas=document.createElement('canvas');
      const context=canvas.getContext('2d',{willReadFrequently:true});
      while(scanning.current){
        try{
          let value='';
          if(detector){try{const found=await detector.detect(element);value=found[0]?.rawValue||'';}catch{detector=null;}}
          if(!value&&jsQR&&context&&element.readyState>=2&&element.videoWidth>0){
            const max=720,ratio=Math.min(1,max/Math.max(element.videoWidth,element.videoHeight));
            canvas.width=Math.round(element.videoWidth*ratio);canvas.height=Math.round(element.videoHeight*ratio);
            context.drawImage(element,0,0,canvas.width,canvas.height);
            const pixels=context.getImageData(0,0,canvas.width,canvas.height);
            value=jsQR(pixels.data,canvas.width,canvas.height,{inversionAttempts:'attemptBoth'})?.data||'';
          }
          if(value&&!locked.current){
            if(!/^[a-f0-9]{64}$/.test(parseToken(value))){setError('O QR detectado não é um convite do Submundo 808.');}
            else{locked.current=true;await add(value);break;}
          }
        }catch{}
        await new Promise<void>(resolve=>window.setTimeout(resolve,250));
      }
    }catch(e){
      logCameraFailure(e,cameraStage);
      stop();
      const exception=e as DOMException;
      if(exception?.name==='NotAllowedError'||exception?.name==='PermissionDeniedError'||/permission denied|not allowed|permissão negada/i.test(exception?.message||'')){
        setError('Acesso à câmera bloqueado para este aplicativo. Abra as configurações do Android → Apps → Submundo 808 (ou Chrome) → Permissões → Câmera e selecione Permitir. Se continuar bloqueado, verifique também as permissões do site no Chrome. Depois, volte e tente novamente.');
      }else if(exception?.name==='NotFoundError'||exception?.name==='DevicesNotFoundError'){
        setError('Nenhuma câmera foi encontrada no dispositivo. Você também pode adicionar um amigo pelo link de convite.');
      }else if(exception?.name==='NotReadableError'||exception?.name==='TrackStartError'){
        setError('A câmera está ocupada ou indisponível. Feche outros aplicativos que estejam usando a câmera e tente novamente.');
      }else if(exception?.name==='OverconstrainedError'){
        setError('A câmera não atende às configurações solicitadas. Tente novamente ou use o link do convite.');
      }else{
        setError(exception?.message||'Não foi possível abrir a câmera. Confira as permissões do aplicativo.');
      }
    }
  }
  const showLoading=useMinimumLoading(access==='loading');
  if(showLoading)return <PageLoading label="Carregando amigos" description="Verificando seu acesso e preparando sua lista de amigos."/>;
  if(access==='error')return <div role="alert" className="rounded-2xl border border-red-400/25 bg-red-400/5 p-6 text-center"><p className="font-bold text-red-200">Não foi possível carregar seus amigos.</p><p className="mt-2 text-xs text-red-200/70">{error}</p><button onClick={()=>{setAccess('loading');void load();}} className="mt-4 rounded-xl bg-[#c4ff40] px-4 py-2 text-sm font-bold text-black">Tentar novamente</button></div>;
  return <div>
    <div className="mb-5"><p className="mb-2 text-[11px] font-bold uppercase tracking-[.24em] text-[#c4ff40]">Sua galera</p><h2 className="font-display text-2xl font-black uppercase">Amigos</h2></div>
    {access==='guest'?<div className="rounded-2xl border border-white/10 p-6 text-center"><Users className="mx-auto mb-3 text-[#c4ff40]"/><p className="font-bold">Entre na sua conta para adicionar amigos</p><p className="mt-2 text-sm text-white/50">Faça login na aba Perfil.</p></div>:<>
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[.04] p-5">
        <h3 className="mb-2 flex items-center gap-2 font-bold"><UserPlus className="text-[#c4ff40]" size={19}/> Novo amigo</h3>
        <p className="mb-4 text-xs text-white/55">Escaneie o QR Code de outra pessoa ou cole o link de convite.</p>
        <button type="button" onClick={()=>setShowMyQR(v=>!v)} className="mb-4 w-full rounded-xl border border-[#c4ff40]/40 px-4 py-3 text-sm font-bold text-[#c4ff40]">{showMyQR?'Ocultar meu QR Code':'Ver meu QR Code'}</button>
        {showMyQR&&<div className="mb-4"><FriendQR/></div>}
        {!scan?<button onClick={()=>void start()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c4ff40] px-4 py-3.5 text-sm font-black text-black"><ScanLine size={19}/> Adicionar amigo</button>:<><video ref={video} autoPlay muted playsInline className="aspect-square w-full rounded-xl bg-black object-cover"/><button onClick={stop} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm"><CameraOff size={17}/> Fechar câmera</button></>}
        <div className="mt-5 border-t border-white/10 pt-4"><label className="mb-2 block text-xs font-bold text-white/70"><Link2 size={14} className="mr-1 inline"/> Ou cole o link recebido</label><div className="flex gap-2"><input value={link} onChange={e=>setLink(e.target.value)} placeholder="Link do amigo" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-3 text-xs outline-none focus:border-[#c4ff40]"/><button disabled={busy||!link.trim()} onClick={()=>void add(link)} className="rounded-xl bg-[#c4ff40] px-4 text-xs font-black text-black disabled:opacity-40">Adicionar</button></div></div>
        {error&&<p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}{status&&<p role="status" className="mt-3 text-xs text-[#c4ff40]">{status}</p>}
      </div>
      <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-sm font-bold uppercase">Minha lista</h3><button onClick={()=>void load()} aria-label="Atualizar lista" className="flex items-center gap-1 text-xs text-white/55"><RefreshCw size={14}/> {friends.length} amigos</button></div>
      {friends.length===0?<div className="rounded-2xl border border-white/10 p-8 text-center"><Users className="mx-auto mb-3 text-[#c4ff40]" size={34}/><p className="font-bold">Nenhum amigo ainda</p><p className="mt-2 text-sm text-white/50">Escaneie um QR Code para começar.</p></div>:<div className="space-y-3">{friends.map(f=><div key={f.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c4ff40]/15 font-black text-[#c4ff40]">{f.name.slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{f.name}</p><p className="text-xs text-white/45">Amigo</p></div><button aria-label={'Remover '+f.name} onClick={async()=>{if(!window.confirm('Remover '+f.name+' dos amigos?'))return;try{await api('/remove',{id:f.id});await load();}catch(e){setError(String(e));}}} className="p-2 text-white/45"><X size={18}/></button></div>)}</div>}
    </>}
  </div>;
}
