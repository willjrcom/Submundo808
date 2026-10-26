import {useEffect,useState} from 'react';
import PageLoading from './page-loading';
import {displayLabel,displayDescription,displayAddress} from './display-label';
import useMinimumLoading from './use-minimum-loading';
import {ArrowLeft,CalendarDays,Clock3,MapPin,Music2,ExternalLink,Ticket,Instagram,ChevronRight} from 'lucide-react';
import {eventProgramPath} from './active-event';

type DJ={nome:string;instagram?:string;inicio?:string;fim?:string};
type EventItem={id:string;name:string;description:string;starts_at:string;ends_at:string;site_url:string;tickets_url:string;instagram_url:string;venue:{name:string;address:string;city:string};map_ids:string[];lineup:DJ[]};

const date=(value:string)=>{
 if(!value)return 'A definir';
 const d=new Date(value);
 return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
};
const hour=(value?:string)=>{
 if(!value)return 'A definir';
 const d=new Date(value);
 return Number.isNaN(d.getTime())?value.slice(-5):new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(d);
};
const link=(value:string)=>!value?'':/^https?:\/\//i.test(value)?value:'https://'+value.replace(/^@/,'');
function changeUrl(pathname:string){
 if(window.location.pathname!==pathname)window.history.pushState({tab:'inicio'},'',pathname);
 window.dispatchEvent(new Event('submundo-navigation'));
}
export default function PublicEvents({activeEventId,onSelectEvent,onClearEvent}:{activeEventId:string;onSelectEvent:(id:string)=>void;onClearEvent:()=>void}){
 const [events,setEvents]=useState<EventItem[]>([]);
 const selected=activeEventId;
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
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
    <div className="min-w-0">
     <p className="text-lg font-black uppercase">{displayLabel(e.name)}</p>
     <p className="mt-2 flex items-center gap-2 text-sm text-white/70"><CalendarDays size={15} className="shrink-0 text-[#c4ff40]"/>{date(e.starts_at)}</p>
     <p className="mt-2 flex items-center gap-2 text-xs text-white/60"><MapPin size={15} className="shrink-0"/>{displayLabel(e.venue.name)} · {e.venue.city}</p>
     <p className="mt-2 flex items-center gap-2 text-xs text-white/50"><Music2 size={15} className="shrink-0"/>{e.lineup.length} DJs · {e.map_ids.length} {e.map_ids.length===1?'mapa':'mapas'}</p>
     <p className="mt-3 text-sm font-bold text-[#c4ff40]">Ver programação</p>
    </div>
    <ChevronRight size={23} className="shrink-0 text-[#c4ff40] transition group-hover:translate-x-1"/>
   </button>)}
  </section>
 </div>;

 return <div className="space-y-6">
  <nav aria-label="Navegação da programação">
   <button type="button" onClick={backToAgenda} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-[#c4ff40]"><ArrowLeft size={17}/> Trocar evento</button>
  </nav>
  <div>
   <p className="text-xs font-bold uppercase tracking-[.2em] text-[#c4ff40]">Programação do evento</p>
   <h1 className="mt-2 text-3xl font-black uppercase">{displayLabel(event.name)}</h1>
  </div>
  <section className="relative overflow-hidden rounded-3xl border border-[#c4ff40]/25 bg-[radial-gradient(circle_at_85%_15%,#51235d,transparent_50%),linear-gradient(145deg,#211129,#0b090f)] p-6">
   <div className="space-y-3 text-sm">
    <p className="flex items-start gap-3"><CalendarDays size={18} className="shrink-0 text-[#c4ff40]"/><span>{date(event.starts_at)}{event.ends_at?' — '+date(event.ends_at):''}</span></p>
    <p className="flex items-start gap-3"><MapPin size={18} className="shrink-0 text-[#c4ff40]"/><span>{displayLabel(event.venue.name)}{displayAddress(event.venue.address)?', '+displayAddress(event.venue.address):''}{event.venue.city?' · '+event.venue.city:''}</span></p>
   </div>
   {displayDescription(event.description)&&<p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/65">{displayDescription(event.description)}</p>}
   {(event.tickets_url||event.site_url||event.instagram_url)&&<div className="mt-5 flex flex-wrap gap-2">
    {event.tickets_url&&<a href={link(event.tickets_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-[#c4ff40] px-4 py-3 text-xs font-black text-black"><Ticket size={16}/> Ingressos</a>}
    {event.site_url&&<a href={link(event.site_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-xs"><ExternalLink size={15}/> Site oficial</a>}
    {event.instagram_url&&<a href={link(event.instagram_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-xs"><Instagram size={15}/> Instagram</a>}
   </div>}
  </section>
  <section>
   <div className="mb-4"><p className="text-xs font-bold uppercase tracking-widest text-[#c4ff40]">Programação</p><h2 className="mt-1 text-2xl font-black uppercase">Lineup</h2></div>
   {event.lineup.length?<div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
    {event.lineup.map((dj,i)=><div key={i} className="flex gap-4 border-b border-white/10 p-4 last:border-0">
     <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#c4ff40]/10 font-black text-[#c4ff40]">{dj.nome?.charAt(0)||<Music2/>}</div>
     <div className="min-w-0 flex-1"><p className="font-bold">{dj.nome}</p><p className="mt-1 flex items-center gap-1 text-xs text-white/50"><Clock3 size={13}/>{hour(dj.inicio)} — {hour(dj.fim)}</p>
      {dj.instagram&&<a href={dj.instagram.startsWith('http')?dj.instagram:'https://instagram.com/'+dj.instagram.replace(/^@/,'')} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-[#c4ff40]"><Instagram size={13}/> {dj.instagram}</a>}
     </div>
    </div>)}
   </div>:<p className="rounded-2xl border border-white/10 p-5 text-sm text-white/50">Programação ainda não cadastrada.</p>}
  </section>
 </div>;
}
