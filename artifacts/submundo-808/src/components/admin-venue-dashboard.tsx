import {Building2,CalendarDays,MapPin,Pencil,ArrowUpRight,Music2,ExternalLink} from 'lucide-react';
import {displayLabel} from './display-label';
import AdminVenueMaps from './admin-venue-maps';

type Venue={id:string;name:string;city?:string;street?:string;neighborhood?:string;address?:string;address_url?:string;services?:string;cover_image?:string;logo_image?:string};
type VenueMap={id:string;name:string;venue_id?:string};
type VenueEvent={id:string;name:string;venue_id?:string;map_ids?:string[];starts_at?:string;is_published?:number;cover_image?:string;lineup?:unknown[]};
type Props={venue:Venue;maps:VenueMap[];events:VenueEvent[];onEdit:()=>void;onOpenMap:(id:string)=>void;onOpenEvent:(id:string)=>void;onViewAnalytics:(id:string)=>void;onChanged:()=>Promise<void>};
const formatDate=(value?:string)=>{
 if(!value)return 'Data a definir';
 const parsed=new Date(value);
 return Number.isNaN(parsed.getTime())?value:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(parsed);
};

export default function AdminVenueDashboard({venue,maps,events,onEdit,onOpenMap,onOpenEvent,onViewAnalytics,onChanged}:Props){
 const relatedMaps=maps.filter(m=>m.venue_id===venue.id);
 const relatedEvents=events.filter(e=>e.venue_id===venue.id).sort((a,b)=>(b.starts_at||'').localeCompare(a.starts_at||''));
 return <div className="mt-6 space-y-7">
  <section className="overflow-hidden rounded-3xl border border-white/15 bg-[#18121f]">
   <div className="relative h-44 overflow-hidden bg-[radial-gradient(circle_at_80%_20%,#53406f,transparent_55%),linear-gradient(120deg,#15111d,#2e1b32)] sm:h-60">
    {venue.cover_image?<img className="h-full w-full object-cover" src={venue.cover_image} alt={'Foto do estabelecimento '+venue.name}/>:<div className="flex h-full items-center justify-center text-[#c4ff40]/35"><Building2 size={65}/></div>}
    <div className="absolute inset-0 bg-gradient-to-t from-[#18121f] via-transparent to-transparent"/>
    <button type="button" onClick={onEdit} className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-[#c4ff40] bg-[#110d18]/90 px-4 py-2.5 text-sm font-bold text-[#c4ff40] shadow-lg"><Pencil size={16}/> Editar</button>
   </div>
   <div className="relative px-4 pb-5 pt-3 sm:px-6">
    <div className="flex items-end gap-3">
     <div className="-mt-10 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#c4ff40] bg-[#0c0912] text-3xl font-black text-[#c4ff40] shadow-xl sm:h-24 sm:w-24">
      {venue.logo_image?<img src={venue.logo_image} alt={'Logo de '+venue.name} className="h-full w-full object-cover"/>:venue.name.slice(0,1).toUpperCase()}
     </div>
     <div className="min-w-0 pb-1"><h3 className="truncate text-xl font-black sm:text-2xl">{displayLabel(venue.name)}</h3><p className="mt-1 flex items-center gap-1 text-sm text-white/60"><MapPin size={15} className="shrink-0 text-[#c4ff40]"/>{venue.city||'Cidade não informada'}</p></div>
    </div>
    {(venue.street||venue.address||venue.neighborhood)&&<p className="mt-4 text-sm text-white/65">{[venue.street||venue.address,venue.neighborhood].filter(Boolean).join(' · ')}</p>}
    {venue.services&&<p className="mt-3 line-clamp-2 text-sm text-white/55">{venue.services}</p>}
    {venue.address_url&&/^https?:\/\//.test(venue.address_url)&&<a href={venue.address_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#c4ff40]"><ExternalLink size={14}/> Ver localização</a>}
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
     <div className="rounded-xl border border-white/10 bg-white/[.035] p-3"><p className="text-xs text-white/55">Plantas</p><p className="mt-1 text-xl font-black text-[#c4ff40]">{relatedMaps.length}</p></div>
     <div className="rounded-xl border border-white/10 bg-white/[.035] p-3"><p className="text-xs text-white/55">Eventos</p><p className="mt-1 text-xl font-black text-[#c4ff40]">{relatedEvents.length}</p></div>
     <div className="col-span-2 rounded-xl border border-white/10 bg-white/[.035] p-3 sm:col-span-1"><p className="text-xs text-white/55">DJs cadastrados</p><p className="mt-1 text-xl font-black text-[#c4ff40]">{relatedEvents.reduce((total,event)=>total+(event.lineup?.length||0),0)}</p></div>
    </div>
   </div>
  </section>
  <AdminVenueMaps venue={venue} maps={maps} events={events} onOpen={onOpenMap} onChanged={onChanged}/>
  <section className="space-y-4">
   <div><h3 className="flex items-center gap-2 text-lg font-black"><CalendarDays size={20} className="text-[#c4ff40]"/> Eventos do local</h3><p className="mt-1 text-xs text-white/55">Eventos associados a este estabelecimento.</p></div>
   {relatedEvents.length?<div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3" aria-label="Carrossel de eventos do estabelecimento">
    {relatedEvents.map(event=><article key={event.id} className="w-[min(76vw,18rem)] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/15 bg-[#18121e] sm:w-72">
     <button type="button" onClick={()=>onOpenEvent(event.id)} aria-label={'Abrir evento '+event.name} className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_80%_20%,#53406f,transparent_60%),#191020]">
      {event.cover_image?<img src={event.cover_image} alt="" className="h-full w-full object-cover"/>:<Music2 size={36} className="text-[#c4ff40]/60"/>}
      <span className={'absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold '+(event.is_published?'bg-[#c4ff40] text-black':'bg-black/80 text-white/80')}>{event.is_published?'Publicado':'Rascunho'}</span>
      <span className="absolute bottom-2 right-2 rounded-lg border border-white/15 bg-[#100d18]/90 p-1.5 text-[#c4ff40]"><ArrowUpRight size={15}/></span>
     </button>
     <div className="space-y-2 p-3"><p className="truncate text-sm font-bold">{displayLabel(event.name)}</p><p className="text-xs text-white/55">{formatDate(event.starts_at)} · {event.map_ids?.length||0} planta(s)</p>
      <div className="flex flex-wrap gap-2 pt-1">
       <button type="button" onClick={()=>onOpenEvent(event.id)} className="rounded-lg border border-[#c4ff40]/40 px-3 py-2 text-xs font-semibold text-[#c4ff40]">Ver evento</button>
       <button type="button" onClick={()=>onViewAnalytics(event.id)} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold">Inteligência</button>
      </div>
     </div>
    </article>)}
   </div>:<p className="rounded-xl border border-dashed border-white/20 p-5 text-sm text-white/60">Nenhum evento vinculado ao estabelecimento.</p>}
  </section>
 </div>;
}
