import {CalendarDays,Clock3,MapPin,Map as MapIcon,Music2,Pencil,ExternalLink,Ticket} from 'lucide-react';
import {displayLabel} from './display-label';

type Dj={nome:string;inicio?:string;fim?:string};
type Venue={id:string;name:string;city?:string;address?:string;cover_image?:string;logo_image?:string};
type EventItem={id:string;name:string;venue_id?:string;description?:string;starts_at?:string;ends_at?:string;doors_at?:string;is_published?:number;cover_image?:string;map_ids?:string[];lineup?:Dj[];tickets_url?:string;site_url?:string;services?:string;location_sharing_enabled?:number;};
type EventMap={id:string;name:string;venue_id?:string};
type Props={event:EventItem;venues:Venue[];maps:EventMap[];onEdit:()=>void;onOpenMap:(id:string,venueId:string)=>void;onOpenVenue:(id:string)=>void;onOpenAnalytics:(venueId:string,eventId:string)=>void};
const formatted=(value?:string)=>{
 if(!value)return 'A definir';
 const date=new Date(value);
 return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
};
const safeLink=(value?:string)=>value&&/^https?:\/\//i.test(value)?value:'';

export default function AdminEventDashboard({event,venues,maps,onEdit,onOpenMap,onOpenVenue,onOpenAnalytics}:Props){
 const venue=venues.find(v=>v.id===event.venue_id);
 const linkedMaps=maps.filter(m=>event.map_ids?.includes(m.id));
 const djs=Array.isArray(event.lineup)?event.lineup:[];
 return <div className="mt-6 space-y-6">
  <section className="overflow-hidden rounded-3xl border border-white/15 bg-[#17121d]">
   <div className="relative flex h-44 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_70%_25%,#57345e,transparent_55%),linear-gradient(125deg,#16101e,#2d182c)] sm:h-64">
    {event.cover_image?<img src={event.cover_image} alt={'Capa de '+event.name} className="h-full w-full object-cover"/>:<Music2 size={66} className="text-[#c4ff40]/40"/>}
    <div className="absolute inset-0 bg-gradient-to-t from-[#17121d] via-transparent to-transparent"/>
    <button type="button" onClick={onEdit} className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-[#c4ff40] bg-[#100c17]/90 px-4 py-2.5 text-sm font-bold text-[#c4ff40] shadow-lg"><Pencil size={16}/> Editar</button>
    <span className={'absolute bottom-3 left-4 rounded-full px-3 py-1.5 text-xs font-bold '+(event.is_published?'bg-[#c4ff40] text-black':'border border-white/25 bg-black/65 text-white')}>{event.is_published?'Publicado':'Rascunho'}</span>
   </div>
   <div className="space-y-4 px-4 py-5 sm:px-6">
    <h3 className="text-xl font-black sm:text-2xl">{displayLabel(event.name)}</h3>
    {event.description&&<p className="max-w-3xl whitespace-pre-line text-sm text-white/65">{event.description}</p>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
     <div className="rounded-xl border border-white/10 bg-white/[.035] p-3"><CalendarDays size={17} className="text-[#c4ff40]"/><p className="mt-2 text-xs text-white/55">Início</p><p className="mt-1 text-xs font-bold">{formatted(event.starts_at)}</p></div>
     <div className="rounded-xl border border-white/10 bg-white/[.035] p-3"><Clock3 size={17} className="text-[#c4ff40]"/><p className="mt-2 text-xs text-white/55">Término</p><p className="mt-1 text-xs font-bold">{formatted(event.ends_at)}</p></div>
     <div className="rounded-xl border border-white/10 bg-white/[.035] p-3"><Music2 size={17} className="text-[#c4ff40]"/><p className="mt-2 text-xs text-white/55">DJs</p><p className="mt-1 text-lg font-black">{djs.length}</p></div>
     <div className="rounded-xl border border-white/10 bg-white/[.035] p-3"><MapIcon size={17} className="text-[#c4ff40]"/><p className="mt-2 text-xs text-white/55">Plantas</p><p className="mt-1 text-lg font-black">{linkedMaps.length}</p></div>
    </div>
   </div>
  </section>
  <div className="grid gap-5 lg:grid-cols-2">
   <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5">
    <h3 className="flex items-center gap-2 font-bold"><MapPin size={18} className="text-[#c4ff40]"/> Local e horários</h3>
    <button type="button" disabled={!venue} onClick={()=>venue&&onOpenVenue(venue.id)} className="block text-left text-sm font-semibold text-[#c4ff40] disabled:text-white/55">{venue?displayLabel(venue.name):'Estabelecimento não encontrado'}</button>
    {venue?.city&&<p className="text-sm text-white/55">{venue.city}</p>}
    {event.doors_at&&<p className="text-xs text-white/65">Abertura dos portões: {formatted(event.doors_at)}</p>}
    <p className="text-xs text-white/55">Localização compartilhada: {Number(event.location_sharing_enabled)===1?'permitida':'desativada'}</p>
    {safeLink(event.tickets_url)&&<a href={safeLink(event.tickets_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white"><Ticket size={14}/> Ingressos <ExternalLink size={12}/></a>}
   </section>
   <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5">
    <h3 className="flex items-center gap-2 font-bold"><Music2 size={18} className="text-[#c4ff40]"/> Programação</h3>
    {djs.length?<div className="grid grid-cols-2 gap-2">{djs.slice(0,6).map((dj,i)=><div key={i} className="rounded-xl border border-white/10 bg-[#18131e] p-3"><p className="truncate text-sm font-bold">{dj.nome||'DJ a confirmar'}</p><p className="mt-1 text-xs text-white/50">{dj.inicio?formatted(dj.inicio):'Horário a definir'}</p></div>)}</div>:<p className="text-sm text-white/55">Line-up em breve.</p>}
    {djs.length>6&&<p className="text-xs text-white/55">+ {djs.length-6} DJs cadastrados</p>}
   </section>
  </div>
  <section className="space-y-3">
   <h3 className="flex items-center gap-2 text-lg font-black"><MapIcon size={20} className="text-[#c4ff40]"/> Plantas vinculadas</h3>
   {linkedMaps.length?<div className="flex flex-wrap gap-3">
    {linkedMaps.map(map=><button key={map.id} type="button" onClick={()=>map.venue_id&&onOpenMap(map.id,map.venue_id)} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[.035] px-4 py-3 text-sm font-semibold transition hover:border-[#c4ff40]"><MapIcon size={16} className="text-[#c4ff40]"/>{displayLabel(map.name)}</button>)}
   </div>:<p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/55">Nenhuma planta vinculada ao evento.</p>}
   {venue&&<button type="button" onClick={()=>onOpenAnalytics(venue.id,event.id)} className="text-sm font-bold text-[#c4ff40]">Ver inteligência do evento</button>}
  </section>
  {event.services&&<section className="rounded-xl border border-white/10 bg-white/[.035] p-4"><p className="mb-2 text-sm font-bold">Serviços extras</p><p className="whitespace-pre-line text-sm text-white/65">{event.services}</p></section>}
 </div>;
}
