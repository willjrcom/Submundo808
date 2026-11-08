import {useState} from 'react';
import {ArrowLeft,CalendarDays,CheckCircle2,ChevronRight,Clock3,ExternalLink,FileText,Info,Instagram,ListMusic,MapPin,Music2,Phone,Radio,Share2,Star,Ticket} from 'lucide-react';
import {EVENT_TIME_ZONE,parseEventTimestamp,type DJSlot,type ScheduledDJ} from './dj-schedule';
import {displayAddress,displayDescription,displayLabel} from './display-label';

type EventItem={
 id:string;name:string;description:string;starts_at:string;ends_at:string;site_url:string;tickets_url:string;instagram_url:string;
 doors_at?:string;cover_image?:string;services?:string;
 venue:{name:string;address:string;city:string;services?:string};map_ids:string[];lineup:ScheduledDJ[];
};
type General={minimum_age:number;entry_rules:string;accepted_documents:string;cancellation_policy:string;contact_name?:string;contact_phone?:string};
type Section='destaque'|'programacao'|'info';
type Props={event:EventItem;general:General|null;timeline:DJSlot[];nowMs:number;onBack:()=>void};
const tabs:[Section,string,typeof Star][]=[
 ['destaque','Destaque',Star],['programacao','Programação',ListMusic],['info','Info',Info]
];
function date(value:string|undefined):string{
 if(!value)return 'A definir';
 const timestamp=parseEventTimestamp(value);
 return timestamp===null?value:new Intl.DateTimeFormat('pt-BR',{
  timeZone:EVENT_TIME_ZONE,day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'
 }).format(new Date(timestamp));
}
function dateShort(value:string|undefined):string{
 if(!value)return 'A definir';
 const timestamp=parseEventTimestamp(value);
 return timestamp===null?value:new Intl.DateTimeFormat('pt-BR',{
  timeZone:EVENT_TIME_ZONE,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'
 }).format(new Date(timestamp));
}
const safeLink=(value:string)=>!value?'':/^https?:\/\//i.test(value)?value:'https://'+value.replace(/^@/,'');
export default function PublicEventHome({event,general,timeline,nowMs,onBack}:Props){
 const [section,setSection]=useState<Section>('destaque');
 const [copiedContact,setCopiedContact]=useState(false),[error,setError]=useState('');
 const current=timeline.find(slot=>slot.status==='live');
 const next=timeline.find(slot=>slot.status==='next');
 const finishedAt=parseEventTimestamp(event.ends_at);
 const ended=(finishedAt!==null&&nowMs>=finishedAt)||(timeline.length>0&&timeline.every(slot=>slot.status==='finished'));
 const featured=!ended?(current||next):null;
 const fullAddress=[event.venue.name,event.venue.address,event.venue.city].filter(Boolean).join(', ');
 const shortLocation=[event.venue.name,displayAddress(event.venue.address)||event.venue.city].filter(Boolean).join(' · ');
 const mapsUrl=fullAddress?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(fullAddress):'';
 async function copy(value:string){
  try{
   await navigator.clipboard.writeText(value);
   setCopiedContact(true);
   window.setTimeout(()=>setCopiedContact(false),2200);
  }catch{setError('Não foi possível copiar o telefone.');}
 }

 return <div className="space-y-3">
  <header className="relative isolate overflow-hidden rounded-2xl border border-white/15 bg-[#241330]">
   {event.cover_image&&<img src={event.cover_image} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover"/>}
   <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_20%,#702c9073,transparent_65%),linear-gradient(112deg,#100b18f5_8%,#140d20c9_60%,#100b18dd)]"/>
   <div className="relative space-y-2.5 px-4 py-4 sm:px-6 sm:py-5">
    <nav aria-label="Voltar à agenda de eventos" className="flex items-center justify-between gap-2">
     <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#c4ff40]">Evento selecionado</p>
     <button type="button" onClick={onBack} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-[#17121c]/70 px-3 py-2 text-[11px] font-semibold text-[#c4ff40] transition hover:border-[#c4ff40]/45"><ArrowLeft size={14}/> Trocar evento</button>
    </nav>
    <h1 className="max-w-lg break-words font-display text-2xl font-black uppercase leading-[1.08] sm:text-3xl">{displayLabel(event.name)}</h1>
    <div className="space-y-1.5 pt-0.5 text-[11px] font-medium text-white/80 sm:text-xs">
     <p className="flex items-start gap-2"><CalendarDays size={14} className="mt-0.5 shrink-0 text-[#c4ff40]"/><span>{dateShort(event.starts_at)}{event.ends_at?' — '+dateShort(event.ends_at):''}</span></p>
     {mapsUrl&&<a href={mapsUrl} aria-label={'Ver '+fullAddress+' no Google Maps'} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-2 rounded-lg text-left transition-colors hover:text-[#c4ff40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4ff40]"><MapPin size={14} className="mt-0.5 shrink-0 text-[#c4ff40]"/><span className="line-clamp-2 min-w-0 flex-1 leading-snug underline decoration-white/30 underline-offset-2">{shortLocation}</span><ExternalLink size={13} className="mt-0.5 shrink-0 text-[#c4ff40]"/></a>}
    </div>
   </div>
  </header>

  <nav role="tablist" aria-label="Seções do evento" className="grid grid-cols-[1fr_1.35fr_.75fr] gap-1 rounded-xl border border-white/15 bg-[#1b1225]/85 p-1">
   {tabs.map(([id,label,Icon])=><button key={id} type="button" role="tab" id={'home-tab-'+id} aria-controls={'home-panel-'+id} aria-selected={section===id} onClick={()=>setSection(id)} className={'flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 py-2.5 text-[11px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4ff40] sm:gap-2 sm:px-3 sm:text-sm '+(section===id?'bg-[#c4ff40] text-black shadow-[0_4px_20px_#c4ff4025]':'text-white/75 hover:bg-white/10')}><Icon size={16} className="hidden shrink-0 sm:block"/><span className="whitespace-nowrap">{label}</span></button>)}
  </nav>

  {section==='destaque'&&<section role="tabpanel" id="home-panel-destaque" aria-labelledby="home-tab-destaque" className="space-y-3">
   <div className="flex items-center justify-between gap-2">
    <h2 className="flex items-center gap-2 text-base font-black uppercase sm:text-lg"><Radio size={18} className="text-[#c4ff40]"/> Em destaque</h2>
    {event.tickets_url?<a href={safeLink(event.tickets_url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#c4ff40] px-3 py-2 text-xs font-black text-black"><Ticket size={16}/> Ingressos <ExternalLink size={13}/></a>:<span className="text-[10px] text-white/50">Horários programados</span>}
   </div>
   {featured?<article aria-label={current?'DJ tocando agora':'Próximo DJ'} className="overflow-hidden rounded-2xl border border-[#c4ff40]/65 bg-[radial-gradient(circle_at_85%_15%,#54286088,transparent_65%),linear-gradient(135deg,#28162d,#110e19)] p-4 shadow-[0_0_30px_#c4ff4015] sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#c4ff40]">{current?<Radio size={17} className="animate-pulse"/>:<Clock3 size={17}/>} {current?'Tocando agora':'Próxima apresentação'}</span>
     {current&&<span className="rounded-full bg-[#c4ff40] px-3 py-1 text-[10px] font-black uppercase text-black">No horário</span>}
    </div>
    <h3 className="mt-3 break-words font-display text-2xl font-black uppercase leading-tight sm:text-3xl">{displayLabel(featured.dj.nome)}</h3>
    <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white/85"><Clock3 size={17} className="text-[#c4ff40]"/>{featured.timeLabel}</p>
    {current&&<div className="mt-3 space-y-2">
     <div role="progressbar" aria-label={'Progresso previsto da apresentação de '+current.dj.nome} aria-valuemin={0} aria-valuemax={100} aria-valuenow={current.progress} className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#c4ff40] transition-[width] duration-500" style={{width:current.progress+'%'}}/></div>
     <div className="flex items-center justify-between gap-2 text-[11px] text-white/65"><span>{current.progress}% do horário previsto</span><span>{current.endMs!==null?Math.max(0,Math.ceil((current.endMs-nowMs)/60000))+' min restantes':''}</span></div>
    </div>}
    {!current&&featured.startMs!==null&&<p className="mt-2 text-xs text-white/65">Começa em {Math.max(1,Math.ceil((featured.startMs-nowMs)/60000))} min, conforme a programação.</p>}
   </article>:<div className="space-y-1.5 rounded-2xl border border-[#c4ff40]/25 bg-[linear-gradient(130deg,#291634,#100e18)] p-4">
    <Music2 size={22} className="text-[#c4ff40]"/>
    <h3 className="text-lg font-black">{ended?'Programação encerrada':timeline.length?'Horários a confirmar':'Line-up em breve'}</h3>
    <p className="text-sm text-white/65">{ended?'Confira na Programação as atrações deste evento.':timeline.length?'Os DJs estão cadastrados, mas os horários ainda não foram definidos.':'As atrações aparecerão aqui quando forem divulgadas.'}</p>
   </div>}
   {current&&next&&<article className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/[.045] p-4">
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#c4ff40]/10 text-[#c4ff40]"><Music2 size={25}/></span>
    <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-widest text-[#c4ff40]">Próximo DJ</p><p className="mt-1 truncate text-lg font-black">{displayLabel(next.dj.nome)}</p><p className="mt-1 text-xs text-white/60">{next.timeLabel}</p></div>
   </article>}
   <button type="button" onClick={()=>setSection('programacao')} className="flex w-full items-center justify-between rounded-xl border border-white/20 bg-white/[.035] px-4 py-3.5 text-left text-sm font-bold text-white/90"><span className="flex items-center gap-2"><ListMusic size={18} className="text-[#c4ff40]"/> Ver programação completa</span><ChevronRight size={18} className="text-[#c4ff40]"/></button>
   <p className="text-[11px] leading-relaxed text-white/45">O destaque é calculado pelos horários cadastrados e pelo relógio do aparelho, inclusive offline. Não confirma o início real da apresentação.</p>
  </section>}

  {section==='programacao'&&<section role="tabpanel" id="home-panel-programacao" aria-labelledby="home-tab-programacao" className="space-y-4">
   <div><p className="text-[11px] font-black uppercase tracking-[.2em] text-[#c4ff40]">Programação do evento</p><h2 className="mt-1 text-2xl font-black uppercase">Line-up completo</h2><p className="mt-2 text-xs text-white/55">Atrações e horários informados pela organização.</p></div>
   {timeline.length?<div className="space-y-3">
    {timeline.map(slot=>{
     const dj=slot.dj,live=slot.status==='live';
     return <article key={slot.index} aria-label={live?'Apresentação atual: '+dj.nome:undefined} className={'flex gap-3 rounded-2xl border p-4 '+(live?'border-[#c4ff40] bg-[linear-gradient(125deg,#30401555,#231528)] shadow-[0_0_23px_#c4ff4015]':'border-white/15 bg-[#22162c]/70')}>
      <div className={'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-black '+(live?'bg-[#c4ff40] text-black':slot.status==='finished'?'bg-white/5 text-white/35':'bg-[#c4ff40]/10 text-[#c4ff40]')}>{dj.nome?.charAt(0)||<Music2/>}</div>
      <div className="min-w-0 flex-1">
       <div className="flex flex-wrap items-center gap-2">
        <h3 className={'break-words text-base font-black uppercase '+(live?'text-[#c4ff40]':slot.status==='finished'?'text-white/55':'text-white')}>{displayLabel(dj.nome)}</h3>
        {live&&<span className="rounded-full bg-[#c4ff40] px-2 py-0.5 text-[10px] font-black text-black">Tocando agora</span>}
        {slot.status==='next'&&<span className="rounded-full border border-[#c4ff40]/50 px-2 py-0.5 text-[10px] font-bold text-[#c4ff40]">Próximo</span>}
        {slot.status==='finished'&&<span className="inline-flex items-center gap-1 text-[10px] text-white/45"><CheckCircle2 size={12}/> Encerrado</span>}
       </div>
       <p className={'mt-1 flex items-center gap-1.5 text-xs '+(live?'font-bold text-[#c4ff40]':'text-white/65')}><Clock3 size={14}/>{slot.startMs===null?'Horário a definir':slot.timeLabel}</p>
       {live&&<div role="progressbar" aria-label={'Progresso previsto de '+dj.nome} aria-valuemin={0} aria-valuemax={100} aria-valuenow={slot.progress} className="mt-3 h-1 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#c4ff40]" style={{width:slot.progress+'%'}}/></div>}
       <div className="mt-3 flex flex-wrap gap-2">
        {dj.instagram&&<a href={dj.instagram.startsWith('https://')?dj.instagram:'https://www.instagram.com/'+dj.instagram.replace(/^@/,'')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80"><Instagram size={14}/> Instagram</a>}
        <a href={dj.spotify?.startsWith('https://open.spotify.com/')?dj.spotify:'https://open.spotify.com/search/'+encodeURIComponent(dj.nome)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80"><Music2 size={14}/>{dj.spotify?.startsWith('https://open.spotify.com/')&&!dj.spotify.includes('/search/')?'Ouvir no Spotify':'Buscar DJ no Spotify'}</a>
       </div>
      </div>
     </article>;
    })}
   </div>:<div className="flex items-center gap-3 rounded-2xl border border-[#c4ff40]/20 bg-[#c4ff40]/5 p-5 text-sm font-bold text-[#c4ff40]"><Music2 size={20}/> Line-up em breve</div>}
   <p className="text-[11px] leading-relaxed text-white/45">O destaque do DJ atual é baseado na programação prevista, não na confirmação ao vivo do palco.</p>
  </section>}

  {section==='info'&&<section role="tabpanel" id="home-panel-info" aria-labelledby="home-tab-info" className="space-y-3">
   <div><p className="text-[11px] font-black uppercase tracking-[.2em] text-[#c4ff40]">Tudo sobre a festa</p><h2 className="mt-1 text-2xl font-black uppercase">Informações do evento</h2></div>
   <div className="space-y-3">
    {event.doors_at&&<div className="flex gap-3 rounded-2xl border border-white/15 bg-white/[.045] p-4"><Clock3 size={20} className="shrink-0 text-[#c4ff40]"/><div><h3 className="text-xs font-bold">Abertura dos portões</h3><p className="mt-1 text-sm text-white/70">{date(event.doors_at)}</p></div></div>}
    <div className="flex gap-3 rounded-2xl border border-white/15 bg-white/[.045] p-4"><CalendarDays size={20} className="shrink-0 text-[#c4ff40]"/><div><h3 className="text-xs font-bold">Período do evento</h3><p className="mt-1 text-sm text-white/70">{date(event.starts_at)}{event.ends_at?' — '+date(event.ends_at):''}</p></div></div>
    {mapsUrl&&<a href={mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={'Ver '+fullAddress+' no Google Maps'} className="group flex gap-3 rounded-2xl border border-white/15 bg-white/[.045] p-4 transition-colors hover:border-[#c4ff40]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4ff40]">
     <MapPin size={20} className="shrink-0 text-[#c4ff40]"/>
     <span className="min-w-0 flex-1"><span className="block text-xs font-bold">Local · Ver no Maps</span><span className="mt-1 block break-words text-sm text-white/70">{displayLabel(event.venue.name)}{displayAddress(event.venue.address)?', '+displayAddress(event.venue.address):''}{event.venue.city?' · '+event.venue.city:''}</span></span>
     <ExternalLink size={17} className="shrink-0 text-[#c4ff40]"/>
    </a>}
    {displayDescription(event.description)&&<div className="flex gap-3 rounded-2xl border border-white/15 bg-white/[.045] p-4"><FileText size={20} className="shrink-0 text-[#c4ff40]"/><div><h3 className="text-xs font-bold">Sobre o evento</h3><p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-white/70">{displayDescription(event.description)}</p></div></div>}
   </div>
   <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    {event.tickets_url&&<a href={safeLink(event.tickets_url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#c4ff40] p-3 text-center text-xs font-black text-black"><Ticket size={16}/> Ingressos</a>}
    {event.site_url&&<a href={safeLink(event.site_url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 p-3 text-center text-xs font-semibold"><ExternalLink size={16}/> Site oficial</a>}
    {event.instagram_url&&<a href={safeLink(event.instagram_url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 p-3 text-center text-xs font-semibold"><Instagram size={16}/> Instagram</a>}
    {typeof navigator.share==='function'&&<button type="button" onClick={()=>void navigator.share({title:event.name,url:window.location.href}).catch(()=>{})} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 p-3 text-center text-xs font-semibold"><Share2 size={16}/> Compartilhar</button>}
   </div>
   {general?.contact_phone&&<section className="space-y-3 rounded-2xl border border-white/15 bg-white/[.045] p-4">
    <h3 className="flex items-center gap-2 font-bold"><Phone size={17} className="text-[#c4ff40]"/> Contato oficial</h3>
    <p className="text-sm font-semibold">{general.contact_name||'Submundo 808'}</p>
    <p className="text-sm text-white/65">{general.contact_phone.replace(/^(\d{2})(\d{5})(\d{4})$/,'($1) $2-$3')}</p>
    <div className="flex flex-wrap gap-2">
     <button type="button" onClick={()=>void copy(general.contact_phone||'')} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold">{copiedContact?'✓ Copiado!':'Copiar número'}</button>
     <a href={'tel:+55'+general.contact_phone} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold">Ligar</a>
     <a href={'https://wa.me/55'+general.contact_phone} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#c4ff40]/40 px-3 py-2 text-xs font-semibold text-[#c4ff40]">Chamar no WhatsApp</a>
    </div>
   </section>}
   {(event.services||event.venue.services||general)&&<section className="space-y-3 rounded-2xl border border-white/15 bg-[#17111e] p-4">
    <h3 className="font-bold text-[#c4ff40]">Informações importantes</h3>
    {general&&<p className="text-sm">Classificação etária: {general.minimum_age===0?'Livre':general.minimum_age+' anos'}</p>}
    {([['Regras de entrada',general?.entry_rules],['Documentos aceitos',general?.accepted_documents],['Política de cancelamento',general?.cancellation_policy],['Serviços do local',event.venue.services],['Serviços do evento',event.services]] as const).filter(([,value])=>!!value).map(([title,value])=><div key={title}><h4 className="text-xs font-bold text-white/85">{title}</h4><p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-white/60">{value}</p></div>)}
   </section>}
  </section>}
  {error&&<p role="alert" className="rounded-xl border border-red-400/30 p-3 text-xs text-red-300">{error}</p>}
 </div>;
}
