import {useEffect,useState} from 'react';
import PageLoading from './page-loading';
import {displayLabel,displayDescription,displayAddress} from './display-label';
import useMinimumLoading from './use-minimum-loading';
import {ArrowLeft,CalendarDays,Clock3,MapPin,Music2,ExternalLink,Ticket,Instagram,ChevronRight,Radio,CheckCircle2} from 'lucide-react';
import {getDJTimeline,type ScheduledDJ} from './dj-schedule';
import {eventProgramPath} from './active-event';

type DJ=ScheduledDJ;
type EventItem={id:string;name:string;description:string;starts_at:string;ends_at:string;site_url:string;tickets_url:string;instagram_url:string;doors_at?:string;cover_image?:string;services?:string;venue:{name:string;address:string;city:string;services?:string};map_ids:string[];lineup:DJ[]};

const date=(value:string)=>{
 if(!value)return 'A definir';
 const d=new Date(value);
 return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
};
const link=(value:string)=>!value?'':/^https?:\/\//i.test(value)?value:'https://'+value.replace(/^@/,'');
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
 const [copiedAddress,setCopiedAddress]=useState(false);
 const [copiedContact,setCopiedContact]=useState(false);
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
 const currentlyPlaying=timeline.find(slot=>slot.status==='live');
 const nextDJ=timeline.find(slot=>slot.status==='next');
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

 return <div className="space-y-6">
  <nav aria-label="Navegação da programação">
   <button type="button" onClick={backToAgenda} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-[#c4ff40]"><ArrowLeft size={17}/> Trocar evento</button>
  </nav>
  <div>
   <p className="text-xs font-bold uppercase tracking-[.2em] text-[#c4ff40]">Programação do evento</p>
   <h1 className="mt-2 text-3xl font-black uppercase">{displayLabel(event.name)}</h1>
  </div>
  {event.cover_image&&<img src={event.cover_image} alt={'Capa de '+event.name} className="aspect-video w-full rounded-2xl border border-white/10 object-cover"/>}
  <section className="relative overflow-hidden rounded-3xl border border-[#c4ff40]/25 bg-[radial-gradient(circle_at_85%_15%,#51235d,transparent_50%),linear-gradient(145deg,#211129,#0b090f)] p-6">
   <div className="space-y-3 text-sm">
    {event.doors_at&&<p className="flex items-start gap-3"><Clock3 size={18} className="shrink-0 text-[#c4ff40]"/><span>Abertura dos portões: {date(event.doors_at)}</span></p>}
    <p className="flex items-start gap-3"><CalendarDays size={18} className="shrink-0 text-[#c4ff40]"/><span>{date(event.starts_at)}{event.ends_at?' — '+date(event.ends_at):''}</span></p>
    <button type="button" title="Clique para copiar o endereço" aria-label="Copiar endereço do evento" onClick={async()=>{const address=[event.venue.name,event.venue.address,event.venue.city].filter(Boolean).join(', ');try{await navigator.clipboard.writeText(address);setCopiedAddress(true);window.setTimeout(()=>setCopiedAddress(false),2200);}catch{setCopiedAddress(false);setError('Não foi possível copiar o endereço.');}}} className="flex w-full items-start gap-3 rounded-lg text-left transition hover:text-[#c4ff40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4ff40]"><MapPin size={18} className="shrink-0 text-[#c4ff40]"/><span className="flex-1">{displayLabel(event.venue.name)}{displayAddress(event.venue.address)?', '+displayAddress(event.venue.address):''}{event.venue.city?' · '+event.venue.city:''}</span><span className="shrink-0 text-[11px] font-bold text-[#c4ff40]">{copiedAddress?'✓ Copiado!':'Copiar'}</span></button>
   </div>
   {displayDescription(event.description)&&<p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/65">{displayDescription(event.description)}</p>}
   <div className="mt-4 flex flex-wrap gap-2"><a href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([event.venue.name,event.venue.address,event.venue.city].filter(Boolean).join(', '))} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold">Abrir no Maps</a>{typeof navigator.share==='function'&&<button type="button" onClick={()=>void navigator.share({title:event.name,url:window.location.href}).catch(()=>{})} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold">Compartilhar evento</button>}</div>
   {(event.tickets_url||event.site_url||event.instagram_url)&&<div className="mt-5 flex flex-wrap gap-2">
    {event.tickets_url&&<a href={link(event.tickets_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-[#c4ff40] px-4 py-3 text-xs font-black text-black"><Ticket size={16}/> Ingressos</a>}
    {event.site_url&&<a href={link(event.site_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-xs"><ExternalLink size={15}/> Site oficial</a>}
    {event.instagram_url&&<a href={link(event.instagram_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-xs"><Instagram size={15}/> Instagram</a>}
   </div>}
  </section>
  <section aria-label="Programação dos DJs">
   <div className="mb-4"><p className="text-xs font-bold uppercase tracking-widest text-[#c4ff40]">Programação</p><h2 className="mt-1 text-2xl font-black uppercase">Line-up</h2></div>
   {currentlyPlaying&&<article aria-label="DJ tocando agora" aria-live="polite" className="mb-4 overflow-hidden rounded-2xl border-2 border-[#c4ff40]/70 bg-[radial-gradient(circle_at_90%_10%,#4b5430,transparent_60%),linear-gradient(135deg,#24152d,#171320)] p-5 shadow-[0_0_32px_#c4ff4015]">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-[#c4ff40] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-black"><Radio size={14} className="animate-pulse"/> Tocando agora</span><span className="text-[11px] text-white/55">Conforme horário programado</span></div>
    <h3 className="mt-4 text-2xl font-black uppercase text-white">{displayLabel(currentlyPlaying.dj.nome)}</h3>
    <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#c4ff40]"><Clock3 size={16}/>{currentlyPlaying.timeLabel}</p>
    <div role="progressbar" aria-label={'Progresso previsto da apresentação de '+currentlyPlaying.dj.nome} aria-valuemin={0} aria-valuemax={100} aria-valuenow={currentlyPlaying.progress} className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#c4ff40] transition-[width] duration-500" style={{width:currentlyPlaying.progress+'%'}}/></div>
    <p className="mt-2 text-right text-[11px] text-white/55">{currentlyPlaying.progress}% do horário previsto</p>
   </article>}
   {!currentlyPlaying&&nextDJ&&<div aria-label="Próximo DJ" className="mb-4 flex items-center gap-3 rounded-xl border border-[#c4ff40]/25 bg-[#c4ff40]/[.055] px-4 py-3">
    <Music2 size={21} className="shrink-0 text-[#c4ff40]"/><div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase tracking-wider text-[#c4ff40]">Próximo DJ</p><p className="truncate text-base font-bold">{displayLabel(nextDJ.dj.nome)}</p><p className="mt-1 text-xs text-white/55">{nextDJ.timeLabel}</p></div>
   </div>}
   {timeline.length?<div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
    {timeline.map(slot=>{
     const dj=slot.dj,live=slot.status==='live';
     return <div key={slot.index} aria-label={live?'Apresentação atual: '+dj.nome:undefined} className={'flex gap-3 border-b p-4 last:border-b-0 '+(live?'border-[#c4ff40]/40 bg-[#c4ff40]/[.095]':'border-white/10')}>
      <div className={'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-black '+(live?'bg-[#c4ff40] text-black':slot.status==='finished'?'bg-white/5 text-white/40':'bg-[#c4ff40]/10 text-[#c4ff40]')}>{dj.nome?.charAt(0)||<Music2/>}</div>
      <div className="min-w-0 flex-1">
       <div className="flex flex-wrap items-center gap-2">
        <p className={'font-bold '+(live?'text-[#c4ff40]':slot.status==='finished'?'text-white/55':'text-white')}>{displayLabel(dj.nome)}</p>
        {live&&<span className="rounded-full bg-[#c4ff40] px-2 py-0.5 text-[10px] font-black text-black">Tocando agora</span>}
        {slot.status==='next'&&<span className="rounded-full border border-[#c4ff40]/40 px-2 py-0.5 text-[10px] font-bold text-[#c4ff40]">Em seguida</span>}
        {slot.status==='finished'&&<span className="inline-flex items-center gap-1 text-[10px] text-white/40"><CheckCircle2 size={12}/> Encerrado</span>}
       </div>
       <p className={'mt-1 flex items-center gap-1 text-xs '+(live?'font-semibold text-[#c4ff40]':'text-white/55')}><Clock3 size={13}/>{slot.timeLabel}</p>
       <div className="mt-3 flex flex-wrap gap-2">
        {dj.instagram&&<a href={dj.instagram.startsWith('https://')?dj.instagram:'https://www.instagram.com/'+dj.instagram.replace(/^@/,'')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-[#c4ff40]"><Instagram size={15}/> Instagram</a>}
        <a href={dj.spotify?.startsWith('https://open.spotify.com/')?dj.spotify:'https://open.spotify.com/search/'+encodeURIComponent(dj.nome)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-[#c4ff40]"><Music2 size={15}/> {dj.spotify?.startsWith('https://open.spotify.com/')&&!dj.spotify.includes('/search/')?'Ouvir no Spotify':'Buscar DJ no Spotify'}</a>
       </div>
      </div>
     </div>;
    })}
   </div>:<div className="flex items-center gap-3 rounded-2xl border border-[#c4ff40]/20 bg-[#c4ff40]/5 p-5 text-sm font-semibold text-[#c4ff40]"><Music2 size={20}/> Line-up em breve</div>}
   <p className="mt-3 text-[11px] leading-relaxed text-white/45">Os destaques acompanham os horários cadastrados para o evento e o relógio do aparelho, inclusive offline. Não são uma confirmação de início real da apresentação.</p>
  </section>
   {general?.contact_phone&&<section className="space-y-3 rounded-xl border border-white/10 bg-white/[.035] p-4"><h3 className="font-bold text-[#c4ff40]">Contato oficial</h3><p className="text-sm font-semibold">{general.contact_name||'Submundo 808'}</p><p className="text-xs text-white/60">{general.contact_phone.replace(/^(\d{2})(\d{5})(\d{4})$/,'($1) $2-$3')}</p><div className="flex flex-wrap gap-2"><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(general.contact_phone||'');setCopiedContact(true);window.setTimeout(()=>setCopiedContact(false),2200);}catch{setError('Não foi possível copiar o contato.');}}} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold">{copiedContact?'✓ Copiado!':'Copiar número'}</button><a href={'tel:+55'+general.contact_phone} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold">Ligar</a><a href={'https://wa.me/55'+general.contact_phone} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#c4ff40]/40 px-3 py-2 text-xs font-semibold text-[#c4ff40]">Chamar no WhatsApp</a></div></section>}
   {(event.services||event.venue.services||general)&&<section className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4"><h3 className="font-bold text-[#c4ff40]">Informações importantes</h3>{general&&<p className="text-sm">Classificação etária: {general.minimum_age===0?'Livre':general.minimum_age+' anos'}</p>}{([['Regras de entrada',general?.entry_rules],['Documentos aceitos',general?.accepted_documents],['Política de cancelamento',general?.cancellation_policy],['Serviços do local',event.venue.services],['Serviços do evento',event.services]] as const).filter(([,value])=>!!value).map(([title,value])=><div key={title}><h4 className="text-xs font-bold text-white/85">{title}</h4><p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-white/60">{value}</p></div>)}</section>}
 </div>;
}
