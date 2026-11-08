import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bell,MapPin,Camera,CheckCircle2,Download,Share,Smartphone,X,ExternalLink,AlertTriangle} from 'lucide-react';
import {isIosDevice,isPwaInstalled,requiresIosInstallationForPush,isIosEmbeddedBrowser,getDeferredInstallPrompt,clearDeferredInstallPrompt} from './pwa-installation';
import {permissionFailure,requestGpsPosition,requestCameraAccess,registerPush,requestNativeInstallation} from './permission-flows.mjs';
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
 const [message,setMessage]=useState(''),[messageKey,setMessageKey]=useState<'installation'|'location'|'notifications'|'camera'|null>(null),[noticeTone,setNoticeTone]=useState<'info'|'success'|'error'>('info'),[busy,setBusy]=useState('');
 const setNotice=(key:'installation'|'location'|'notifications'|'camera',text:string,tone:'info'|'success'|'error'='info')=>{setMessageKey(key);setMessage(text);setNoticeTone(tone);};
 const clearNotice=()=>{setMessage('');setMessageKey(null);setNoticeTone('info');};
 const [pushRegistered,setPushRegistered]=useState(false);
 const [installed,setInstalled]=useState(isPwaInstalled);
 const [installPrompt,setInstallPrompt]=useState<Event|null>(getDeferredInstallPrompt);
 const [tutorialOpen,setTutorialOpen]=useState(false);
 const tutorialCloseRef=useRef<HTMLButtonElement|null>(null);
 const [locationActive,setLocationActive]=useState(false);
 const [locationBusy,setLocationBusy]=useState(false),[locationLoading,setLocationLoading]=useState(true);
 const [locationMessage,setLocationMessage]=useState(''),[locationError,setLocationError]=useState('');
 const ios=isIosDevice();
 const needsIosInstall=ios&&!installed;
 const embeddedIos=isIosEmbeddedBrowser();
 useEffect(()=>{
  if(!tutorialOpen)return;
  const previousFocus=document.activeElement as HTMLElement|null;
  const frame=window.requestAnimationFrame(()=>tutorialCloseRef.current?.focus());
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setTutorialOpen(false);}};
  document.addEventListener('keydown',onKeyDown);
  return()=>{window.cancelAnimationFrame(frame);document.removeEventListener('keydown',onKeyDown);previousFocus?.focus?.();};
 },[tutorialOpen]);
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
 // Só o botão informado no Mapa inicia o compartilhamento e Estatísticas.
 useEffect(()=>{
  let alive=true;
  void fetch('/api/location/preferences',{credentials:'same-origin'})
   .then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível consultar a localização.');return data;})
   .then(data=>{if(alive)setLocationActive(data.shareEnabled===true);})
   .catch(error=>{if(alive)setLocationError(error instanceof Error?error.message:'Falha ao consultar a localização.');})
   .finally(()=>{if(alive)setLocationLoading(false);});
  return()=>{alive=false;};
 },[]);
 async function stopLocationSession(){
  if(locationBusy)return;
  setLocationBusy(true);setLocationError('');setLocationMessage('');
  // Bloqueie novas transmissões mesmo antes de receber resposta do servidor.
  try{localStorage.setItem('submundo-gps-stop-pending','1');}catch{}
  window.dispatchEvent(new Event('submundo-location-stop'));
  setLocationActive(false);
  if(!navigator.onLine){
   setLocationMessage('Localização interrompida neste aparelho. A desativação será sincronizada quando houver internet.');
   setLocationBusy(false);return;
  }
  try{
   const response=await fetch('/api/location/preferences',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({gpsEnabled:false,shareEnabled:false,analyticsEnabled:false,shareWithGroups:false})
   });
   const payload=await response.json().catch(()=>null);
   if(!response.ok)throw Error(payload?.error||'Não foi possível interromper o compartilhamento no servidor.');
   const stopped=await fetch('/api/location/stop',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
   if(!stopped.ok)throw Error('Não foi possível confirmar a remoção da última localização.');
   try{localStorage.removeItem('submundo-gps-stop-pending');}catch{}
   setLocationMessage('Localização e compartilhamento encerrados.');
  }catch(error){setLocationError(error instanceof Error?error.message:'Não foi possível sincronizar a desativação.');}
  finally{setLocationBusy(false);}
 }
 async function installApp(){
  clearNotice();
  if(installed){setNotice('installation','O aplicativo já está instalado. Abra-o pelo ícone na Tela de Início.','success');return;}
  if(ios){
   setTutorialOpen(true);
   setNotice('installation','Abra o tutorial para adicionar o Submundo808 à Tela de Início.');
   return;
  }
  const prompt=(installPrompt||getDeferredInstallPrompt()) as (Event&{prompt:()=>Promise<void>;userChoice?:Promise<{outcome:string}>})|null;
  if(prompt){
   setBusy('installation');
   try{
    const outcome=await requestNativeInstallation(prompt);
    if(outcome==='accepted')setNotice('installation','Instalação solicitada. Aguarde o ícone na Tela de Início e abra o aplicativo.','success');
    else if(outcome==='dismissed')setNotice('installation','Instalação cancelada. Você pode tentar novamente pelo navegador.');
    else setNotice('installation','Confirme a instalação na janela do navegador.');
   }catch(e){setNotice('installation',permissionFailure('installation',e).message,'error');}
   finally{setInstallPrompt(null);clearDeferredInstallPrompt();setBusy('');}
   return;
  }
  setNotice('installation','No Chrome ou Edge, abra o menu ⋮ e escolha Instalar aplicativo ou Adicionar à tela inicial. Se a opção não aparecer, abra o site em HTTPS.');
 }

 const update=(key:string,state:State)=>setStatuses(v=>({...v,[key]:state}));
 useEffect(()=>{
  let alive=true;
  const check=async()=>{
   if(!('geolocation'in navigator))update('location','unsupported');
   if(!('Notification'in window))update('notifications','unsupported');
   else update('notifications',Notification.permission as State);
   if('serviceWorker'in navigator&&'PushManager'in window){
    try{
     const registration=await navigator.serviceWorker.getRegistration();
     const subscription=registration?await registration.pushManager.getSubscription():null;
     if(alive)setPushRegistered(!!subscription);
    }catch{if(alive)setPushRegistered(false);}
   }
   if(!navigator.mediaDevices?.getUserMedia)update('camera','unsupported');
   if(navigator.permissions?.query)for(const [key,name] of [['location','geolocation'],['camera','camera']] as const){
    try{const status=await navigator.permissions.query({name:name as PermissionName});if(alive)update(key,status.state as State);}catch{}
   }
  };
  const onVisible=()=>{if(document.visibilityState==='visible')void check();};
  const onFocus=()=>void check();
  void check();
  window.addEventListener('focus',onFocus);
  window.addEventListener('pageshow',onFocus);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{alive=false;window.removeEventListener('focus',onFocus);window.removeEventListener('pageshow',onFocus);document.removeEventListener('visibilitychange',onVisible);};
 },[]);
 async function askLocation(){
  if(busy)return;
  setBusy('location');clearNotice();
  try{
   await requestGpsPosition(navigator.geolocation);
   update('location','granted');
   setNotice('location','GPS autorizado. Sua posição só será compartilhada quando você tocar em Ativar GPS e compartilhar no Mapa.','success');
  }catch(e){
   const result=permissionFailure('location',e);
   if(result.denied)update('location','denied');
   setNotice('location',result.message,'error');
  }finally{setBusy('');}
 }
 async function askNotification(){
  if(busy)return;
  if(requiresIosInstallationForPush()){
   setNotice('notifications','Para receber notificações, instale o aplicativo pelo Safari e abra-o pelo ícone na Tela de Início.');
   setTutorialOpen(true);
   return;
  }
  setBusy('notifications');clearNotice();
  try{
   await registerPush({
    notification:'Notification'in window?Notification:null,
    serviceWorker:'serviceWorker'in navigator?navigator.serviceWorker:null,
    pushSupported:'PushManager'in window,
    request:fetch
   });
   update('notifications','granted');setPushRegistered(true);
   setNotice('notifications','Notificações push ativadas neste dispositivo.','success');
  }catch(e){
   const result=permissionFailure('notifications',e);
   if(result.denied||('Notification'in window&&Notification.permission==='denied'))update('notifications','denied');
   setPushRegistered(false);
   setNotice('notifications',result.message,'error');
  }finally{setBusy('');}
 }
 async function askCamera(){
  if(busy)return;
  setBusy('camera');clearNotice();
  try{
   await requestCameraAccess(navigator.mediaDevices);
   update('camera','granted');setNotice('camera','Câmera autorizada para leitura de QR Codes de amigos.','success');
  }catch(e){
   const result=permissionFailure('camera',e);
   if(result.denied)update('camera','denied');
   setNotice('camera',result.message,'error');
  }finally{setBusy('');}
 }
 const rows=[{key:'location',title:'Localização',description:'Permite ver sua posição na planta. Para compartilhar com amigos e contribuir para Estatísticas, toque em Ativar GPS e compartilhar no Mapa.',Icon:MapPin,run:askLocation},{key:'notifications',title:'Notificações',description:'Promoções, avisos e convites para avaliar eventos.',Icon:Bell,run:askNotification},{key:'camera',title:'Câmera',description:'Leitura de QR Code para adicionar amigos.',Icon:Camera,run:askCamera}];
 const label:Record<State,string>={granted:'Permitida',denied:'Bloqueada',prompt:'Não solicitada',unsupported:'Indisponível'};
 function explainBlockedPermission(key:string){
  const title=key==='location'?'localização':key==='camera'?'câmera':'notificações';
  const where=installed
   ?'Abra as Configurações do celular, procure o Submundo808 e permita o acesso. Depois, volte ao aplicativo.'
   :'Abra as configurações deste site no navegador e altere a permissão para Permitir. Depois, volte ao Submundo808.';
  setNotice(key as 'location'|'notifications'|'camera','A permissão de '+title+' está bloqueada. '+where+' O aplicativo não consegue remover esse bloqueio sozinho.');
 }
 function explainUnsupportedPermission(key:string){
  const explanation=key==='location'?'GPS indisponível: confira se a localização do aparelho está ativa e abra o site em um navegador atualizado, por HTTPS.'
   :key==='camera'?'Câmera indisponível: atualize o navegador, verifique se há uma câmera conectada e abra o site por HTTPS.'
   :'Notificações indisponíveis: instale o aplicativo na Tela de Início, use um navegador compatível e tente novamente.';
  setNotice(key as 'location'|'notifications'|'camera',explanation,'error');
 }
 const warningMessage=noticeTone==='error';
 const successMessage=noticeTone==='success';
 return <div className="space-y-4">
  <p className="text-sm text-white/60">Configure os recursos do celular. Permissões já concedidas aparecem como ativadas.</p>
  <div className="flex min-h-[92px] flex-wrap items-center gap-3 rounded-xl border border-[#c4ff40]/25 bg-[#c4ff40]/[.055] p-3">
   <Smartphone className="shrink-0 text-[#c4ff40]" size={22}/>
   <div className="min-w-0 flex-1">
    <p className="font-semibold">Instalar aplicativo</p>
    <p className="text-xs text-white/60">{installed?'Submundo808 já está aberto como aplicativo instalado.':ios?'No iPhone, abra no Safari e use Compartilhar → Adicionar à Tela de Início. A instalação é necessária para liberar as notificações push.':'Adicione o Submundo808 à tela inicial para acesso mais rápido.'}</p>
    <p className="mt-1 text-[11px] text-white/45">{installed?'Instalado':needsIosInstall?'Necessário para notificações':'Opcional'}</p>
   </div>
   {installed?<span className="inline-flex items-center gap-1.5 rounded-full border border-[#c4ff40]/35 bg-[#c4ff40]/10 px-3 py-2 text-xs font-bold text-[#c4ff40]"><CheckCircle2 size={16}/> Instalado</span>:<button type="button" onClick={()=>void installApp()} disabled={!!busy} className="rounded-xl border border-[#c4ff40]/40 px-3 py-2 text-xs font-bold text-[#c4ff40]"><Download size={15} className="mr-1 inline"/>{ios?'Ver tutorial':'Instalar'}</button>}
   {messageKey==='installation'&&message&&<p role={warningMessage?'alert':'status'} className={'flex w-full items-start gap-2 rounded-xl border px-3 py-3 text-xs leading-relaxed '+(warningMessage?'border-rose-400/50 bg-rose-500/15 font-semibold text-rose-100':(successMessage?'border-[#c4ff40]/35 bg-[#c4ff40]/[.07] text-[#c4ff40]':'border-white/20 bg-white/5 text-white/80'))}>{warningMessage&&<AlertTriangle size={17} className="shrink-0 text-rose-300"/>}{message}</p>}
  </div>
  {rows.map(({key,title,description,Icon,run})=>{
   const status=statuses[key]||'prompt';
   const locked=key==='notifications'&&needsIosInstall;
   const ready=!locked&&status==='granted'&&(key!=='notifications'||pushRegistered);
   const permissionGranted=status==='granted';
   const denied=status==='denied'&&!locked;
   const unsupported=status==='unsupported';
   return <div key={key} className={'flex min-h-[92px] flex-wrap items-center gap-3 rounded-xl border p-3 '+(denied?'border-rose-400/55 bg-rose-500/[.09]':locked?'border-amber-400/35 bg-amber-400/[.06]':'border-white/10 bg-white/[.035]')}>
    {denied?<AlertTriangle aria-label="Permissão bloqueada" className="shrink-0 text-rose-300" size={22}/>:<Icon className={'shrink-0 '+(locked?'text-amber-300':ready?'text-[#c4ff40]':'text-white/60')} size={22}/>}
    <div className="min-w-0 flex-1">
     <p className="font-semibold">{title}</p>
     <p className="text-xs text-white/55">{description}</p>
     <p className={'mt-1 flex items-center gap-1.5 text-xs font-bold '+(denied?'text-rose-300':locked?'text-amber-300':ready?'text-[#c4ff40]':'text-white/55')}>
      {denied&&<AlertTriangle size={13} aria-hidden="true"/>}
      {locked?'Requer instalação no iPhone':permissionGranted&&key==='notifications'&&!pushRegistered?'Permissão concedida · push ainda inativo':label[status]}
     </p>
     
    </div>
    <div className="flex min-w-[98px] justify-end">
     {locked?<button type="button" onClick={()=>{setTutorialOpen(true);setNotice('notifications','Siga o tutorial de instalação para liberar notificações no iPhone.');}} className="rounded-xl border border-amber-400/35 bg-amber-400/[.07] px-3 py-2 text-xs font-bold text-amber-200">Ver como instalar</button>:ready?<span aria-label={title+' autorizada'} className="inline-flex items-center gap-1.5 rounded-full border border-[#c4ff40]/35 bg-[#c4ff40]/10 px-3 py-2 text-xs font-bold text-[#c4ff40]"><CheckCircle2 size={17}/> Ativada</span>:denied?<button type="button" disabled={!!busy} onClick={()=>explainBlockedPermission(key)} className="rounded-xl border border-rose-400/55 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-200 disabled:opacity-50">Como liberar</button>:unsupported?<button type="button" onClick={()=>explainUnsupportedPermission(key)} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white/70">Como resolver</button>:<button type="button" disabled={!!busy} onClick={()=>void run()} className="rounded-xl border border-white/30 px-3 py-2 text-xs font-bold text-white/85 disabled:opacity-50">{busy===key?'Aguarde...':permissionGranted&&key==='notifications'?'Ativar push':'Ativar'}</button>}
    </div>
    {(denied||(messageKey===key&&message))&&<div role={denied||warningMessage?'alert':'status'} className={'flex w-full items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed '+(denied||warningMessage?'border-rose-400/55 bg-rose-500/15 font-semibold text-rose-100':(successMessage?'border-[#c4ff40]/35 bg-[#c4ff40]/[.07] text-[#c4ff40]':'border-white/15 bg-white/5 text-white/75'))}>
     {(denied||warningMessage)&&<AlertTriangle size={18} className="shrink-0 text-rose-300" aria-hidden="true"/>}
     <span>{messageKey===key&&message?message:denied?'Acesso bloqueado. Para liberar, toque em Como liberar e ajuste a permissão nas configurações do aparelho ou navegador.':''}</span>
    </div>}
   </div>;
  })}
  
  {locationLoading&&<p role="status" className="text-xs text-white/45">Consultando sessão de localização...</p>}
  {locationActive&&<section aria-label="Sessão de localização ativa" className="space-y-2 rounded-xl border border-[#c4ff40]/25 bg-[#c4ff40]/[.05] p-3">
   <p className="font-bold text-[#c4ff40]">Localização ativa</p>
   <p className="text-xs leading-relaxed text-white/65">Sua posição é compartilhada com amigos e contribui para Estatísticas agregadas até o fim da festa. É possível encerrar a sessão a qualquer momento.</p>
   <button type="button" disabled={locationBusy} onClick={()=>void stopLocationSession()} className="rounded-xl border border-amber-400/45 px-3 py-2.5 text-xs font-bold text-amber-200 disabled:opacity-50">{locationBusy?'Encerrando...':'Encerrar localização e compartilhamento'}</button>
  </section>}
  {locationMessage&&<p role="status" className="rounded-lg border border-white/15 p-3 text-xs text-white/70">{locationMessage}</p>}
  {locationError&&<p role="alert" className="rounded-lg border border-rose-400/40 p-3 text-xs text-rose-200">{locationError}</p>}
  <p className="text-xs text-white/45">Se uma permissão foi bloqueada, ajuste-a nas configurações do navegador ou do dispositivo. O aplicativo não pode autorizar permissões automaticamente.</p>
  {onClose&&<button type="button" onClick={onClose} className="w-full rounded-xl bg-[#c4ff40] p-3 text-sm font-bold text-black">Concluir</button>}
  {tutorialOpen&&createPortal(<div role="presentation" onClick={e=>{if(e.target===e.currentTarget)setTutorialOpen(false);}} className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/90 px-3 pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]">
   <section role="dialog" aria-modal="true" aria-label="Como instalar o Submundo808 no iPhone" className="my-auto max-h-[90vh] max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-[#c4ff40]/35 bg-[#211729] p-5 shadow-2xl">
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black">Instalar no iPhone</h3><p className="mt-1 text-xs text-white/55">Instale o Submundo808 na Tela de Início para liberar as notificações.</p></div><button ref={tutorialCloseRef} type="button" aria-label="Fechar tutorial" onClick={()=>setTutorialOpen(false)} className="rounded-lg p-2 text-white/75"><X size={21}/></button></div>
    <div className="space-y-3">
     <div className="flex items-start gap-3 rounded-xl bg-white/[.04] p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c4ff40] text-xs font-black text-black">1</span><div><p className="font-bold">Abra no Safari</p><p className="text-xs leading-relaxed text-white/60">Se recebeu o link pelo WhatsApp, Instagram ou outro aplicativo, use o menu do navegador interno para escolher Abrir no Safari. Depois, siga estes passos.</p></div><ExternalLink className="shrink-0 text-[#c4ff40]" size={19}/></div>
     <div className="flex items-start gap-3 rounded-xl bg-white/[.04] p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c4ff40] text-xs font-black text-black">2</span><div><p className="font-bold">Toque em Compartilhar</p><p className="text-xs leading-relaxed text-white/60">No Safari, procure o botão Compartilhar (quadrado com uma seta para cima). Em seguida, escolha <strong>Adicionar à Tela de Início</strong>.</p></div><Share className="shrink-0 text-[#c4ff40]" size={20}/></div>
     <div className="flex items-start gap-3 rounded-xl bg-white/[.04] p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c4ff40] text-xs font-black text-black">3</span><div><p className="font-bold">Toque em Adicionar</p><p className="text-xs leading-relaxed text-white/60">Abra o Submundo808 pelo novo ícone na Tela de Início. Depois, volte em Permissões e ative as notificações.</p></div><CheckCircle2 className="shrink-0 text-[#c4ff40]" size={20}/></div>
    </div>
    {embeddedIos&&<p role="status" className="rounded-xl border border-amber-400/30 bg-amber-300/10 p-3 text-xs text-amber-100">Você está em um navegador interno. Primeiro use o menu de opções para abrir este link no Safari; o botão Compartilhar pode não aparecer aqui.</p>}
    <p className="rounded-xl border border-[#c4ff40]/20 bg-[#c4ff40]/5 p-3 text-xs text-white/65">A instalação não pode ser iniciada automaticamente no iPhone. É necessário confirmar pelo menu Compartilhar do Safari.</p>
    <button type="button" onClick={()=>setTutorialOpen(false)} className="w-full rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-black text-black">Entendi</button>
   </section>
  </div>,document.body)}
 </div>;
}
