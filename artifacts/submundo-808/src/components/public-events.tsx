import {useEffect,useState} from 'react';
import PageLoading from './page-loading';
import PublicEventHome from './public-event-home';
import {displayLabel} from './display-label';
import useMinimumLoading from './use-minimum-loading';
import {ArrowLeft,CalendarDays,MapPin,Music2,ChevronRight} from 'lucide-react';
import {getDJTimeline,type ScheduledDJ} from './dj-schedule';
import {eventProgramPath} from './active-event';

type DJ=ScheduledDJ;
type EventItem={id:string;name:string;description:string;starts_at:string;ends_at:string;site_url:string;tickets_url:string;instagram_url:string;doors_at?:string;cover_image?:string;services?:string;venue:{name:string;address:string;city:string;services?:string};map_ids:string[];lineup:DJ[]};

const date=(value:string)=>{
 if(!value)return 'A definir';
 const d=new Date(value);
 return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
};
function changeUrl(pathname:string){
 if(window.location.pathname!==pathname)window.history.pushState({tab:'inicio'},'',pathname);
 window.dispatchEvent(new Event('submundo-navigation'));
}
export default function PublicEvents({activeEventId,onSelectEvent,onClearEvent}:{activeEventId:string;onSelectEvent:(id:string)=>void;onClearEvent:()=>void}){
 const [events,setEvents]=useState<EventItem[]>([]);
 const [general,setGeneral]=useState<{minimum_age:number;entry_rules:string;accepted_documents:string;cancellation_policy:string;contact_name?:string;contact_phone?:string}|null>(null);
 const selected=activeEventId;
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 // Device time updates the stage focus even without internet or a server push.
 const [nowMs,setNowMs]=useState(()=>Date.now());
 useEffect(()=>{
  const refresh=()=>setNowMs(Date.now());
  const timer=window.setInterval(refresh,15000);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',refresh);
  return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 useEffect(()=>{fetch('/api/public/event-settings').then(r=>r.json()).then(j=>setGeneral(j.settings)).catch(()=>{});},[]);
 useEffect(()=>{
  let mounted=true;
  fetch('/api/public/events').then(async response=>{
   if(!response.ok)throw Error('Não foi possível carregar os eventos.');
   return response.json();
  }).then(data=>{if(mounted)setEvents(data.items||[]);})
   .catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Erro ao carregar eventos.');})
   .finally(()=>{if(mounted)setLoading(false);});
  return()=>{mounted=false;};
 },[]);

 function openEvent(id:string){
  onSelectEvent(id);
  changeUrl(eventProgramPath(id));
  window.scrollTo(0,0);
 }
 function backToAgenda(){
  onClearEvent();
  changeUrl('/');
  window.scrollTo(0,0);
 }
 const showLoading=useMinimumLoading(loading);
 if(showLoading)return <PageLoading label="Carregando eventos" description="Buscando a agenda e as programações."/>;
 if(error)return <div role="alert" className="rounded-2xl border border-red-400/30 p-5 text-sm text-red-300">{error}<button onClick={()=>window.location.reload()} className="ml-3 underline">Tentar novamente</button></div>;
 if(!events.length)return <div className="rounded-3xl border border-white/10 bg-white/5 p-7"><CalendarDays className="mb-4 text-[#c4ff40]"/><h1 className="text-2xl font-black">Próximos eventos</h1><p className="mt-3 text-sm text-white/60">Nenhum evento cadastrado ainda. A programação aparecerá aqui quando for publicada.</p></div>;
 const event=events.find(e=>e.id===selected);
 const timeline=event?getDJTimeline(event.lineup,event.starts_at,nowMs):[];
 if(selected&&!event)return <div className="space-y-4"><button onClick={backToAgenda} className="flex items-center gap-2 text-sm text-[#c4ff40]"><ArrowLeft size={17}/> Trocar evento</button><p role="alert" className="rounded-2xl border border-white/15 p-5 text-sm text-white/60">Não encontramos esse evento. Selecione outro na agenda.</p></div>;

 // Agenda para escolher a festa; com uma seleção ativa, esta aba mostra sua programação.
 if(!event)return <div className="space-y-6">
  <section>
   <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-[#c4ff40]">Agenda Submundo 808</p>
   <h1 className="text-3xl font-black uppercase">Escolha seu evento</h1>
   <p className="mt-3 text-sm text-white/55">Confira a programação de cada evento.</p>
  </section>
  <section aria-label="Eventos disponíveis" className="grid gap-3">
   {events.map(e=><button key={e.id} type="button" onClick={()=>openEvent(e.id)} className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-white/15 bg-white/[.045] p-5 text-left transition hover:border-[#c4ff40]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4ff40]">
    <div className="min-w-0 flex-1">
     {e.cover_image&&<img src={e.cover_image} alt="" className="mb-3 aspect-video w-full rounded-lg object-cover"/>}
     <p className="text-lg font-black uppercase">{displayLabel(e.name)}</p>
     <p className="mt-2 flex items-center gap-2 text-sm text-white/70"><CalendarDays size={15} className="shrink-0 text-[#c4ff40]"/>{date(e.starts_at)}</p>
     <p className="mt-2 flex items-center gap-2 text-xs text-white/60"><MapPin size={15} className="shrink-0"/>{displayLabel(e.venue.name)} · {e.venue.city}</p>
     <p className="mt-2 flex items-center gap-2 text-xs text-white/50"><Music2 size={15} className="shrink-0"/>{[e.lineup.length>0?e.lineup.length+' DJs':'Line-up em breve',e.map_ids.length>0?e.map_ids.length+' '+(e.map_ids.length===1?'mapa':'mapas'):''].filter(Boolean).join(' · ')}</p>
     <p className="mt-3 text-sm font-bold text-[#c4ff40]">Ver programação</p>
    </div>
    <ChevronRight size={23} className="shrink-0 text-[#c4ff40] transition group-hover:translate-x-1"/>
   </button>)}
  </section>

 </div>;

 return <PublicEventHome key={event.id} event={event} general={general} timeline={timeline} nowMs={nowMs} onBack={backToAgenda}/>;
}
