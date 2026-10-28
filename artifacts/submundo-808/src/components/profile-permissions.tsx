import {useEffect,useState} from 'react';
import {Bell,MapPin,Camera,CheckCircle2,Download,Share,Smartphone,X,ExternalLink} from 'lucide-react';
import {isIosDevice,isPwaInstalled,requiresIosInstallationForPush} from './pwa-installation';
type State='granted'|'denied'|'prompt'|'unsupported';
/** Apenas permissões ainda solicitáveis justificam exibir a introdução automaticamente. */
export async function hasPendingAppPermissions():Promise<boolean>{
 if(typeof navigator==='undefined'||typeof window==='undefined')return false;
 const queries:[string,string][]=[['location','geolocation'],['camera','camera']];
 for(const [key,name] of queries){
  if(key==='location'&&!navigator.geolocation)continue;
  if(key==='camera'&&!navigator.mediaDevices?.getUserMedia)continue;
  if(!navigator.permissions?.query)continue;
  try{const state=(await navigator.permissions.query({name:name as PermissionName})).state;if(state==='prompt')return true;}catch{}
 }
 if('Notification'in window&&Notification.permission==='default')return true;
 if(requiresIosInstallationForPush())return true;
 return false;
}
export default function ProfilePermissions({onClose}:{onClose?:()=>void}){
 const [statuses,setStatuses]=useState<Record<string,State>>({location:'prompt',notifications:'prompt',camera:'prompt'});
 const [message,setMessage]=useState(''),[busy,setBusy]=useState('');
 const [pushRegistered,setPushRegistered]=useState(false);
 const [installed,setInstalled]=useState(isPwaInstalled);
 const [installPrompt,setInstallPrompt]=useState<Event|null>(null);
 const [tutorialOpen,setTutorialOpen]=useState(false);
 const ios=isIosDevice();
 const needsIosInstall=ios&&!installed;
 useEffect(()=>{
  const prompt=(e:Event)=>{e.preventDefault();setInstallPrompt(e);};
  const installedHandler=()=>{setInstalled(true);setInstallPrompt(null);setTutorialOpen(false);};
  const refresh=()=>{setInstalled(isPwaInstalled());};
  const onVisible=()=>{if(document.visibilityState==='visible')refresh();};
  window.addEventListener('beforeinstallprompt',prompt);
  window.addEventListener('appinstalled',installedHandler);
  window.addEventListener('focus',refresh);
  window.addEventListener('pageshow',refresh);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{
   window.removeEventListener('beforeinstallprompt',prompt);
   window.removeEventListener('appinstalled',installedHandler);
   window.removeEventListener('focus',refresh);
   window.removeEventListener('pageshow',refresh);
   document.removeEventListener('visibilitychange',onVisible);
  };
 },[]);
 async function installApp(){
  setMessage('');
  if(ios){setTutorialOpen(true);return;}
  if(installPrompt){const event=installPrompt as Event&{prompt:()=>Promise<void>;userChoice?:Promise<{outcome:string}>};try{await event.prompt();if(event.userChoice){const result=await event.userChoice;if(result.outcome==='accepted')setMessage('Instalação iniciada. Abra o app instalado para ativar notificações.');else setMessage('Instalação cancelada.');}setInstallPrompt(null);}catch{setMessage('Use a opção Instalar aplicativo no menu do navegador.');}return;}
  setMessage('No Chrome ou Edge: abra o menu ⋮ e escolha Instalar aplicativo ou Adicionar à tela inicial. Se não aparecer, confira se está em HTTPS.');
 }

 const update=(key:string,state:State)=>setStatuses(v=>({...v,[key]:state}));
 useEffect(()=>{
  let alive=true;
  const check=async()=>{
   if(!('geolocation'in navigator))update('location','unsupported');
   if(!('Notification'in window))update('notifications','unsupported');else update('notifications',Notification.permission as State);
   if('serviceWorker'in navigator&&'PushManager'in window){try{const registration=await navigator.serviceWorker.ready;const subscription=await registration.pushManager.getSubscription();if(alive)setPushRegistered(!!subscription);}catch{}}
   if(!navigator.mediaDevices?.getUserMedia)update('camera','unsupported');
   if(navigator.permissions?.query)for(const [key,name] of [['location','geolocation'],['camera','camera']] as const){
    try{const status=await navigator.permissions.query({name:name as PermissionName});if(alive)update(key,status.state as State);}catch{}
   }
  };void check();return()=>{alive=false;};
 },[]);
 async function askLocation(){
  setBusy('location');setMessage('');
  try{if(!navigator.geolocation)throw Error('Localização indisponível neste navegador.');
   await new Promise<void>((resolve,reject)=>navigator.geolocation.getCurrentPosition(()=>resolve(),reject,{enableHighAccuracy:true,timeout:18000,maximumAge:0}));
   update('location','granted');setMessage('Localização autorizada. O compartilhamento com amigos permanece desativado até você escolher ativá-lo.');
  }catch(e){const denied=typeof e==='object'&&e!==null&&'code'in e&&(e as {code:number}).code===1;if(denied)update('location','denied');setMessage(denied?'O navegador bloqueou o acesso à localização. Se não aparecer a solicitação, abra as configurações deste site no navegador, permita Localização e volte ao aplicativo.':'Localização: '+(e instanceof Error?e.message:'Não foi possível obter a posição.'));}finally{setBusy('');}
 }
 async function askNotification(){
  if(requiresIosInstallationForPush()){
   setMessage('Instale o Submundo808 pela opção Compartilhar do Safari e abra o aplicativo pela Tela de Início antes de ativar as notificações.');
   setTutorialOpen(true);
   return;
  }
  setBusy('notifications');setMessage('');
  try{
   if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))throw Error('Push indisponível neste navegador. No iPhone, instale o aplicativo na Tela de Início.');
   const response=await fetch('/api/push/config',{credentials:'same-origin'}),config=await response.json();
   if(!config.enabled)throw Error('O servidor ainda não tem as chaves VAPID configuradas.');
   const permission=await Notification.requestPermission();update('notifications',permission as State);
   if(permission!=='granted')throw Error('Notificações não foram autorizadas.');
   const registration=await navigator.serviceWorker.ready;
   const key=atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(config.publicKey.length/4)*4,'='));
   const bytes=Uint8Array.from(key,c=>c.charCodeAt(0));
   const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
   const res=await fetch('/api/push/subscribe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:subscription.toJSON()})});
   const j=await res.json();if(!res.ok)throw Error(j.error||'Não foi possível registrar o dispositivo.');
   setPushRegistered(true);setMessage('Notificações push ativadas neste dispositivo.');
  }catch(e){setMessage('Notificações: '+(e instanceof Error?e.message:'Não foi possível ativar.'));}finally{setBusy('');}
 }
 async function askCamera(){
  setBusy('camera');setMessage('');
  try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Câmera indisponível.');
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
   stream.getTracks().forEach(t=>t.stop());update('camera','granted');setMessage('Câmera autorizada para ler QR Codes de amigos.');
  }catch(e){setMessage('Câmera: '+(e instanceof Error?e.message:'Não foi possível solicitar.'));}finally{setBusy('');}
 }
 const rows=[{key:'location',title:'Localização',description:'Sua posição no mapa. Compartilhar com amigos é uma escolha separada.',Icon:MapPin,run:askLocation},{key:'notifications',title:'Notificações',description:'Promoções, avisos e convites para avaliar eventos.',Icon:Bell,run:askNotification},{key:'camera',title:'Câmera',description:'Leitura de QR Code para adicionar amigos.',Icon:Camera,run:askCamera}];
 const label:Record<State,string>={granted:'Permitida',denied:'Bloqueada',prompt:'Não solicitada',unsupported:'Indisponível'};
 return <div className="space-y-4">
  <p className="text-sm text-white/60">Configure os recursos do celular. Permissões já concedidas aparecem como ativadas.</p>
  <div className="flex min-h-[92px] flex-wrap items-center gap-3 rounded-xl border border-[#c4ff40]/25 bg-[#c4ff40]/[.055] p-3">
   <Smartphone className="shrink-0 text-[#c4ff40]" size={22}/>
   <div className="min-w-0 flex-1">
    <p className="font-semibold">Instalar aplicativo</p>
    <p className="text-xs text-white/60">{installed?'Submundo808 já está aberto como aplicativo instalado.':ios?'No iPhone, abra no Safari e use Compartilhar → Adicionar à Tela de Início. A instalação é necessária para liberar as notificações push.':'Adicione o Submundo808 à tela inicial para acesso mais rápido.'}</p>
    <p className="mt-1 text-[11px] text-white/45">{installed?'Instalado':needsIosInstall?'Necessário para notificações':'Opcional'}</p>
   </div>
   {installed?<span className="inline-flex items-center gap-1.5 rounded-full border border-[#c4ff40]/35 bg-[#c4ff40]/10 px-3 py-2 text-xs font-bold text-[#c4ff40]"><CheckCircle2 size={16}/> Instalado</span>:<button type="button" onClick={()=>void installApp()} className="rounded-xl border border-[#c4ff40]/40 px-3 py-2 text-xs font-bold text-[#c4ff40]"><Download size={15} className="mr-1 inline"/>{ios?'Ver tutorial':'Instalar'}</button>}
  </div>
  {rows.map(({key,title,description,Icon,run})=>{
   const status=statuses[key]||'prompt';
   const locked=key==='notifications'&&needsIosInstall;
   const ready=!locked&&status==='granted'&&(key!=='notifications'||pushRegistered);
   const permissionGranted=status==='granted';
   const unsupported=status==='unsupported';
   return <div key={key} className="flex min-h-[92px] flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] p-3">
    <Icon className="shrink-0 text-[#c4ff40]" size={22}/>
    <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="text-xs text-white/55">{description}</p><p className="mt-1 text-[11px] text-white/45">{locked?'Disponível após instalar o app no iPhone':permissionGranted&&key==='notifications'&&!pushRegistered?'Autorizada no navegador · ativar push neste dispositivo':label[status]}</p></div>
    <div className="flex min-w-[98px] justify-end">
     {locked?<button type="button" disabled aria-label="Notificações bloqueadas até instalar o aplicativo" className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/35 opacity-70">Instale o app</button>:ready?<span aria-label={title+' autorizada'} className="inline-flex items-center gap-1.5 rounded-full border border-[#c4ff40]/35 bg-[#c4ff40]/10 px-3 py-2 text-xs font-bold text-[#c4ff40]"><CheckCircle2 size={17}/> Ativada</span>:unsupported?<span className="text-right text-xs text-white/45">Indisponível</span>:<button type="button" disabled={!!busy} onClick={()=>void run()} className="rounded-xl border border-[#c4ff40]/40 px-3 py-2 text-xs font-bold text-[#c4ff40] disabled:opacity-50">{busy===key?'Aguarde...':permissionGranted&&key==='notifications'?'Ativar push':status==='denied'?'Ativar permissão':'Ativar'}</button>}
    </div>
   </div>;
  })}
  {message&&<p role="status" className="rounded-xl bg-white/5 p-3 text-sm text-white/75">{message}</p>}
  <p className="text-xs text-white/45">Se uma permissão foi bloqueada, ajuste-a nas configurações do navegador ou do dispositivo. O aplicativo não pode autorizar permissões automaticamente.</p>
  {onClose&&<button type="button" onClick={onClose} className="w-full rounded-xl bg-[#c4ff40] p-3 text-sm font-bold text-black">Concluir</button>}
  {tutorialOpen&&<div role="presentation" onClick={e=>{if(e.target===e.currentTarget)setTutorialOpen(false);}} className="fixed inset-0 z-[160] flex items-center justify-center bg-black/90 p-3">
   <section role="dialog" aria-modal="true" aria-label="Como instalar o Submundo808 no iPhone" className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-[#c4ff40]/35 bg-[#211729] p-5 shadow-2xl">
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black">Instalar no iPhone</h3><p className="mt-1 text-xs text-white/55">Instale o Submundo808 na Tela de Início para liberar as notificações.</p></div><button type="button" aria-label="Fechar tutorial" onClick={()=>setTutorialOpen(false)} className="rounded-lg p-2 text-white/75"><X size={21}/></button></div>
    <div className="space-y-3">
     <div className="flex items-start gap-3 rounded-xl bg-white/[.04] p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c4ff40] text-xs font-black text-black">1</span><div><p className="font-bold">Abra no Safari</p><p className="text-xs leading-relaxed text-white/60">Se recebeu o link pelo WhatsApp ou outro aplicativo, abra o site no Safari primeiro.</p></div><ExternalLink className="shrink-0 text-[#c4ff40]" size={19}/></div>
     <div className="flex items-start gap-3 rounded-xl bg-white/[.04] p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c4ff40] text-xs font-black text-black">2</span><div><p className="font-bold">Toque em Compartilhar</p><p className="text-xs leading-relaxed text-white/60">No Safari, procure o botão Compartilhar (quadrado com uma seta para cima). Em seguida, escolha <strong>Adicionar à Tela de Início</strong>.</p></div><Share className="shrink-0 text-[#c4ff40]" size={20}/></div>
     <div className="flex items-start gap-3 rounded-xl bg-white/[.04] p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c4ff40] text-xs font-black text-black">3</span><div><p className="font-bold">Toque em Adicionar</p><p className="text-xs leading-relaxed text-white/60">Abra o Submundo808 pelo novo ícone na Tela de Início. Depois, volte em Permissões e ative as notificações.</p></div><CheckCircle2 className="shrink-0 text-[#c4ff40]" size={20}/></div>
    </div>
    <p className="rounded-xl border border-[#c4ff40]/20 bg-[#c4ff40]/5 p-3 text-xs text-white/65">A instalação não pode ser iniciada automaticamente no iPhone. É necessário confirmar pelo menu Compartilhar do Safari.</p>
    <button type="button" onClick={()=>setTutorialOpen(false)} className="w-full rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-black text-black">Entendi</button>
   </section>
  </div>}
 </div>;
}
