import {useEffect,useState} from 'react';
import {Bell,MapPin,Camera,CheckCircle2} from 'lucide-react';
type State='granted'|'denied'|'prompt'|'unsupported';
export default function ProfilePermissions({onClose}:{onClose?:()=>void}){
 const [statuses,setStatuses]=useState<Record<string,State>>({location:'prompt',notifications:'prompt',camera:'prompt'});
 const [message,setMessage]=useState(''),[busy,setBusy]=useState('');
 const [pushRegistered,setPushRegistered]=useState(false);
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
  }catch(e){setMessage('Localização: '+(e instanceof Error?e.message:'Permissão não concedida.'));}finally{setBusy('');}
 }
 async function askNotification(){
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
 return <div className="space-y-4"><p className="text-sm text-white/60">Ative os recursos que deseja usar. Uma permissão já concedida aparece com um check; não precisa autorizar novamente.</p>
 {rows.map(({key,title,description,Icon,run})=>{
  const status=statuses[key]||'prompt';
  const ready=status==='granted'&&(key!=='notifications'||pushRegistered);
  const permissionGranted=status==='granted';
  const blocked=status==='denied'||status==='unsupported';
  return <div key={key} className="flex min-h-[92px] flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] p-3">
   <Icon className="shrink-0 text-[#c4ff40]" size={22}/>
   <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="text-xs text-white/55">{description}</p><p className="mt-1 text-[11px] text-white/45">{permissionGranted&&key==='notifications'&&!pushRegistered?'Autorizada no navegador · ativar push neste dispositivo':label[status]}</p></div>
   <div className="flex min-w-[98px] justify-end">
    {ready?<span aria-label={title+' autorizada'} className="inline-flex items-center gap-1.5 rounded-full border border-[#c4ff40]/35 bg-[#c4ff40]/10 px-3 py-2 text-xs font-bold text-[#c4ff40]"><CheckCircle2 size={17}/> Ativada</span>:blocked?<span className="text-right text-xs text-white/45">{status==='denied'?'Altere nas configurações':'Indisponível'}</span>:<button type="button" disabled={!!busy} onClick={()=>void run()} className="rounded-xl border border-[#c4ff40]/40 px-3 py-2 text-xs font-bold text-[#c4ff40] disabled:opacity-50">{busy===key?'Aguarde...':permissionGranted&&key==='notifications'?'Ativar push':'Ativar'}</button>}
   </div>
  </div>;
 })}
 {message&&<p role="status" className="rounded-xl bg-white/5 p-3 text-sm text-white/75">{message}</p>}
 <p className="text-xs text-white/45">Se o acesso foi bloqueado permanentemente, altere a permissão nas configurações do navegador ou dispositivo. Não é possível forçar a abertura do aviso novamente.</p>
 {onClose&&<button type="button" onClick={onClose} className="w-full rounded-xl bg-[#c4ff40] p-3 text-sm font-bold text-black">Concluir</button>}
 </div>;
}
