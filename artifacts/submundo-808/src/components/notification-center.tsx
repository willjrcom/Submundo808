import {useEffect,useState} from 'react';
import {Bell,Star,X} from 'lucide-react';
type Item={id:string;eventId:string;title:string;body:string;kind:string;targetKind:string;targetId:string;sentAt:number;readAt:number|null};
type Review={eventId:string;rating:number;tags:string[];comment:string};
const choices=['Som incrível','Line-up excelente','Energia da festa','Bebidas boas','Atendimento rápido','Boa organização','Filas demoradas','Bebidas caras','Som ruim','Banheiros ruins'];
export default function NotificationCenter({onClose,onNavigate}:{onClose:()=>void;onNavigate:(kind:string,eventId:string,pointId:string)=>void}){
 const [pushStatus,setPushStatus]=useState('');
 async function disablePush(){
  try{
   const registration=await navigator.serviceWorker.ready;
   const sub=await registration.pushManager.getSubscription();
   if(!sub){setPushStatus('Não há assinatura ativa neste aparelho.');return;}
   await fetch('/api/push/unsubscribe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});
   await sub.unsubscribe();
   setPushStatus('Notificações push desativadas neste dispositivo.');
  }catch(e){setPushStatus(e instanceof Error?e.message:String(e));}
 }

 async function enablePush(){
  try{
   if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('Push não é suportado neste navegador. No iPhone, instale o PWA na Tela de Início.');
   const config=await fetch('/api/push/config').then(r=>r.json());
   if(!config.enabled)throw Error('O servidor ainda não tem as chaves VAPID configuradas.');
   const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Permissão de notificações não concedida.');
   const registration=await navigator.serviceWorker.ready;
   const key=config.publicKey.replace(/-/g,'+').replace(/_/g,'/');
   const raw=atob(key.padEnd(Math.ceil(key.length/4)*4,'='));
   const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
   const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
   const response=await fetch('/api/push/subscribe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:subscription.toJSON()})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Erro ao registrar o dispositivo.');
   setPushStatus('Notificações ativadas neste dispositivo.');
  }catch(e){setPushStatus(e instanceof Error?e.message:String(e));}
 }
 const [items,setItems]=useState<Item[]>([]),[error,setError]=useState(''),[reviewEvent,setReviewEvent]=useState(()=>{const params=new URLSearchParams(window.location.search);const m=window.location.pathname.match(/^\/(?:schedule|programacao)\/([^/]+)$/);return params.get('review')==='1'&&m?decodeURIComponent(m[1]):'';}),[rating,setRating]=useState(0),[tags,setTags]=useState<string[]>([]),[comment,setComment]=useState(''),[busy,setBusy]=useState(false),[submitted,setSubmitted]=useState(false);
 async function load(){try{const r=await fetch('/api/notifications',{credentials:'same-origin'}),j=await r.json();if(!r.ok)throw Error(j.error);setItems(j.items||[]);}catch(e){setError(String(e));}}
 useEffect(()=>{void load();},[]);
 async function open(n:Item){await fetch('/api/notifications/read',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:n.id})}).catch(()=>{});if(n.targetKind==='survey'){setReviewEvent(n.eventId);setSubmitted(false);return;}onNavigate(n.targetKind,n.eventId,n.targetId);}
 async function sendReview(){setBusy(true);setError('');try{const r=await fetch('/api/reviews',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:reviewEvent,rating,tags,comment})}),j=await r.json();if(!r.ok)throw Error(j.error);setSubmitted(true);}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/85 p-3 pt-16 text-white" role="dialog" aria-modal="true" aria-label="Central de notificações"><section className="w-full max-w-lg space-y-4 rounded-2xl border border-white/20 bg-[#191320] p-4 shadow-2xl"><header className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-black"><Bell size={19}/> {reviewEvent?'Avaliar evento':'Notificações'}</h2><button onClick={onClose} aria-label="Fechar"><X/></button></header>{!reviewEvent&&<div className="space-y-2"><button onClick={()=>void enablePush()} className="rounded-xl border border-[#c4ff40]/50 px-3 py-2 text-xs text-[#c4ff40]">Ativar notificações neste celular</button><button onClick={()=>void disablePush()} className="ml-2 rounded-xl border border-white/20 px-3 py-2 text-xs text-white/60">Desativar push</button>{pushStatus&&<p role="status" className="text-xs text-white/70">{pushStatus}</p>}</div>}{reviewEvent?<div className="space-y-4"><p className="text-sm text-white/65">Como foi sua experiência? Você tem até sete dias após o encerramento para avaliar.</p>{submitted?<p role="status" className="rounded-xl bg-green-500/15 p-4 text-green-200">Obrigado! Sua avaliação foi registrada.</p>:<><div className="flex justify-center gap-3">{[1,2,3,4,5].map(n=><button key={n} aria-label={n+' estrelas'} onClick={()=>setRating(n)}><Star size={32} className={n<=rating?'fill-yellow-400 text-yellow-400':'text-white/35'}/></button>)}</div><p className="text-sm">O que você achou da festa? (opcional)</p><div className="flex flex-wrap gap-2">{choices.map(t=><button key={t} onClick={()=>setTags(v=>v.includes(t)?v.filter(x=>x!==t):[...v,t])} className={'rounded-full border px-3 py-2 text-xs '+(tags.includes(t)?'border-[#c4ff40] bg-[#c4ff40] text-black':'border-white/20')}>{t}</button>)}</div><textarea aria-label="Comentário opcional" className="w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm" rows={3} maxLength={2000} placeholder="Mensagem opcional..." value={comment} onChange={e=>setComment(e.target.value)}/><button disabled={!rating||busy} onClick={()=>void sendReview()} className="w-full rounded-xl bg-[#c4ff40] p-3 font-bold text-black disabled:opacity-40">Enviar avaliação</button></>}<button onClick={()=>setReviewEvent('')} className="text-sm text-white/60">Voltar às notificações</button></div>:<div className="space-y-2">{items.length===0&&<p className="text-sm text-white/55">Nenhuma notificação por enquanto. Entre na sua conta para receber avisos dos seus eventos.</p>}{items.map(n=><button key={n.id} onClick={()=>void open(n)} className={'w-full rounded-xl border p-3 text-left '+(!n.readAt?'border-[#c4ff40]/40 bg-[#c4ff40]/5':'border-white/10')}><p className="font-semibold">{n.title}</p><p className="text-sm text-white/65">{n.body}</p><p className="mt-1 text-xs text-white/40">{new Date(n.sentAt).toLocaleString('pt-BR')}</p></button>)}</div>}{error&&<p role="alert" className="text-sm text-red-300">{error}</p>}</section></div>;
}
