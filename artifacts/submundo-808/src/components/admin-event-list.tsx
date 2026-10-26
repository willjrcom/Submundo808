import {useState} from 'react';
import {CalendarDays,Clock3,Map as MapIcon,MapPin,Music2,Plus,Search,Pencil,Trash2,X} from 'lucide-react';
import {displayLabel} from './display-label';
import {filterAdminEvents,groupAdminEvents,eventStatus,availableEventMonths,type EventPeriod,type EventRecord} from './admin-event-filters';

type Venue={id:string;name:string};
type EventItem=EventRecord&{venue_id?:string;starts_at?:string;ends_at?:string};
const datetime=(text?:string)=>{if(!text)return 'Horário a definir';const d=new Date(text);return Number.isNaN(d.getTime())?text:new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(d);};
const dateHeading=(day:string)=>{
 if(day==='no-date')return 'Sem data definida';
 const d=new Date(day+'T12:00:00');
 return new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(d);
};
const monthHeading=(month:string)=>{
 const d=new Date(month+'-01T12:00:00');
 return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(d);
};
const statusText={live:'Acontecendo',upcoming:'Próximo',past:'Encerrado',undated:'Sem data'};
const periodChoices:{value:EventPeriod;label:string}[]=[
 {value:'upcoming',label:'Próximos'},
 {value:'today',label:'Hoje'},
 {value:'past',label:'Encerrados'},
 {value:'all',label:'Todos'}
];
const selectClass='w-full rounded-xl border border-white/15 bg-[#241b2c] px-3 py-2.5 text-sm text-white';
export default function AdminEventList({events,venues,onCreate,onEdit,onDelete}:{
 events:EventItem[];venues:Venue[];
 onCreate:()=>void;onEdit:(event:EventItem)=>void;onDelete:(event:EventItem)=>void;
}){
 const [period,setPeriod]=useState<EventPeriod>('upcoming');
 const [search,setSearch]=useState(''),[venueId,setVenueId]=useState(''),[month,setMonth]=useState('');
 const now=new Date();
 const filtered=filterAdminEvents(events,{period,search,venueId,month},venues,now);
 const groups=groupAdminEvents(filtered);
 const months=availableEventMonths(events);
 const venueById=new Map(venues.map(v=>[v.id,v.name]));
 const hasFilters=period!=='upcoming'||!!search||!!venueId||!!month;
 return <section className="mt-7 space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-xs text-white/55">{filtered.length} de {events.length} eventos</p><p className="mt-1 text-sm text-white/70">Agenda organizada por data e estabelecimento.</p></div>
   <button onClick={onCreate} className="inline-flex items-center gap-2 rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-bold text-black"><Plus size={16}/> Criar evento</button>
  </div>
  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.035] p-4">
   <div className="flex flex-wrap gap-2" aria-label="Filtrar eventos por período">
    {periodChoices.map(choice=><button key={choice.value} onClick={()=>setPeriod(choice.value)} aria-pressed={period===choice.value}
     className={'rounded-lg border px-3 py-2 text-xs font-semibold '+(period===choice.value?'border-[#c4ff40] bg-[#c4ff40]/15 text-[#c4ff40]':'border-white/15 text-white/65')}>{choice.label}</button>)}
   </div>
   <label className="relative block">
    <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45"/>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar evento ou estabelecimento" aria-label="Buscar eventos" className={selectClass+' pl-10'}/>
   </label>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="block space-y-1 text-xs text-white/55">Estabelecimento
     <select value={venueId} onChange={e=>setVenueId(e.target.value)} className={selectClass}>
      <option value="">Todos os estabelecimentos</option>
      {venues.map(venue=><option key={venue.id} value={venue.id}>{displayLabel(venue.name)}</option>)}
     </select>
    </label>
    <label className="block space-y-1 text-xs text-white/55">Mês
     <select value={month} onChange={e=>setMonth(e.target.value)} className={selectClass}>
      <option value="">Todos os meses</option>
      {months.map(value=><option key={value} value={value}>{monthHeading(value)}</option>)}
     </select>
    </label>
   </div>
  </div>
  {!filtered.length?<div className="rounded-2xl border border-dashed border-white/15 p-7 text-center">
   <CalendarDays className="mx-auto text-white/35"/>
   <p className="mt-3 font-bold">{events.length?'Nenhum evento corresponde aos filtros':'Nenhum evento cadastrado'}</p>
   <p className="mt-1 text-sm text-white/55">Tente outro período, nome ou estabelecimento.</p>
   {hasFilters&&<button type="button" onClick={()=>{setPeriod('all');setSearch('');setVenueId('');setMonth('');}}
    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-xs"><X size={14}/> Limpar filtros</button>}
  </div>:<div className="space-y-6">
   {groups.map(group=><section key={group.day} aria-label={dateHeading(group.day)} className="space-y-2">
    <h3 className="flex items-center gap-2 border-b border-white/10 pb-2 text-sm font-bold capitalize text-[#c4ff40]"><CalendarDays size={16}/>{dateHeading(group.day)} <span className="text-xs font-normal text-white/50">({group.items.length})</span></h3>
    <div className="space-y-2">
     {group.items.map(event=>{
      const status=eventStatus(event,now);
      const when=event.starts_at?datetime(event.starts_at)+(event.ends_at?' – '+datetime(event.ends_at):''):'Horário a definir';
      return <article key={event.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[.035] p-4 sm:flex-row sm:items-center sm:justify-between">
       <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
         <h4 className="break-words text-sm font-bold">{displayLabel(event.name)}</h4>
         {status==='live'&&<span className="rounded-full bg-[#c4ff40]/15 px-2 py-0.5 text-[10px] font-bold text-[#c4ff40]">{statusText[status]}</span>}
         {status!=='live'&&<span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/55">{statusText[status]}</span>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
         <span className="inline-flex items-center gap-1"><Clock3 size={13}/>{when}</span>
         <span className="inline-flex items-center gap-1"><MapPin size={13}/>{displayLabel(venueById.get(event.venue_id||'')||'Estabelecimento não encontrado')}</span>
         <span className="inline-flex items-center gap-1"><MapIcon size={13}/>{event.map_ids?.length||0} mapa(s)</span>
         <span className="inline-flex items-center gap-1"><Music2 size={13}/>{event.lineup?.length||0} DJs</span>
        </div>
       </div>
       <div className="flex shrink-0 gap-2">
        <button onClick={()=>onEdit(event)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/20 px-3 py-2.5 text-xs font-bold sm:flex-none"><Pencil size={13}/> Editar</button>
        <button onClick={()=>onDelete(event)} aria-label={'Excluir '+event.name} className="rounded-lg border border-red-400/35 px-3 py-2.5 text-xs text-red-300"><Trash2 size={14}/></button>
       </div>
      </article>;
     })}
    </div>
   </section>)}
  </div>}
 </section>;
}
