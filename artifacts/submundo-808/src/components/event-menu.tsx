import {useEffect,useState} from 'react';
import PageLoading from './page-loading';
import useMinimumLoading from './use-minimum-loading';
import {displayLabel} from './display-label';
import {CalendarDays,ChevronDown} from 'lucide-react';

type Product={id:string;name:string;description:string;category:string;effective_price_cents:number};
type EventItem={id:string;name:string;starts_at:string};
const money=(c:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);

export default function EventMenu(){
 const [events,setEvents]=useState<EventItem[]>([]);
 const [eventId,setEventId]=useState('');
 const [items,setItems]=useState<Product[]>([]);
 const [loadedEventId,setLoadedEventId]=useState('');
 const [loadingEvents,setLoadingEvents]=useState(true);
 const [loadingMenu,setLoadingMenu]=useState(false);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  fetch('/api/public/events').then(async response=>{
   if(!response.ok)throw Error('Não foi possível carregar os eventos.');
   return response.json();
  }).then(result=>{
   if(!active)return;
   const available:EventItem[]=result.items||[];
   setEvents(available);
   const saved=localStorage.getItem('submundo-event-id');
   // Sem evento escolhido, começamos pelo primeiro disponível. O seletor
   // permanece visível para trocar de festa a qualquer momento.
   setEventId(available.find(e=>e.id===saved)?.id||available[0]?.id||'');
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Erro ao carregar eventos.');})
   .finally(()=>{if(active)setLoadingEvents(false);});
  return()=>{active=false;};
 },[]);

 useEffect(()=>{
  if(!eventId){setItems([]);setLoadedEventId('');setLoadingMenu(false);return;}
  let active=true;
  setLoadingMenu(true);setError('');
  fetch('/api/public/menu?event_id='+encodeURIComponent(eventId))
   .then(async response=>{
    if(!response.ok)throw Error('Não foi possível carregar o cardápio.');
    return response.json();
   })
   .then(result=>{if(active){setItems(result.items||[]);setLoadedEventId(eventId);}})
   .catch(e=>{if(active){setItems([]);setLoadedEventId(eventId);setError(e instanceof Error?e.message:'Erro ao carregar cardápio.');}})
   .finally(()=>{if(active)setLoadingMenu(false);});
  return()=>{active=false;};
 },[eventId]);

 useEffect(()=>{
  const sync=()=>{
   const stored=localStorage.getItem('submundo-event-id');
   if(stored&&events.some(e=>e.id===stored))setEventId(stored);
  };
  window.addEventListener('submundo-event-selected',sync);
  return()=>window.removeEventListener('submundo-event-selected',sync);
 },[events]);

 function chooseEvent(id:string){
  setLoadingMenu(true);
  setEventId(id);
  localStorage.setItem('submundo-event-id',id);
  window.dispatchEvent(new Event('submundo-event-selected'));
 }
 const showLoading=useMinimumLoading(loadingEvents);
 const showMenuLoading=useMinimumLoading(loadingEvents||loadingMenu|| (!!eventId&&loadedEventId!==eventId));
 if(showLoading)return <PageLoading label="Carregando cardápio" description="Buscando os eventos e produtos disponíveis."/>;
 const categories=[...new Set(items.map(p=>p.category))];
 return <section className="space-y-5">
  <div><p className="text-xs font-bold uppercase tracking-widest text-[#c4ff40]">Cardápio</p><h1 className="mt-2 text-3xl font-black uppercase">Produtos e preços</h1></div>
  {events.length>0&&<label className="block rounded-2xl border border-[#c4ff40]/25 bg-[#c4ff40]/[.06] p-4">
   <span className="mb-2 flex items-center gap-2 text-sm font-bold text-[#c4ff40]"><CalendarDays size={17}/> Escolha o evento</span>
   <span className="relative block">
    <select value={eventId} onChange={e=>chooseEvent(e.target.value)} className="w-full appearance-none rounded-xl border border-white/20 bg-[#211829] px-4 py-3 pr-10 text-sm font-semibold text-white focus:border-[#c4ff40] focus:outline-none" aria-label="Evento do cardápio">
     {events.map(event=><option key={event.id} value={event.id}>{displayLabel(event.name)}</option>)}
    </select>
    <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#c4ff40]"/>
   </span>
  </label>}
  {!events.length?<p className="rounded-2xl border border-white/10 p-5 text-sm text-white/60">{error||'Nenhum evento disponível no momento.'}</p>
   :showMenuLoading?<PageLoading compact label="Carregando produtos" description="Preparando o cardápio do evento selecionado."/>
   :error?<p role="alert" className="rounded-2xl border border-red-400/25 p-5 text-sm text-red-300">{error}</p>
   :!items.length?<p className="rounded-2xl border border-white/10 p-5 text-sm text-white/60">Ainda não há produtos cadastrados para este evento.</p>
   :categories.map(category=><div key={category}>
    <h2 className="mb-3 font-bold uppercase">{category}</h2>
    <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
     {items.filter(p=>p.category===category).map(p=><div key={p.id} className="flex items-center justify-between gap-4 p-4">
      <div><p className="font-semibold">{p.name}</p>{p.description&&<p className="mt-1 text-xs text-white/50">{p.description}</p>}</div>
      <span className="shrink-0 font-bold text-[#c4ff40]">{money(p.effective_price_cents)}</span>
     </div>)}
    </div>
   </div>)}
 </section>;
}
