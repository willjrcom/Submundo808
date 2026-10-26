import {useEffect,useState} from 'react';
import PageLoading from './page-loading';
import useMinimumLoading from './use-minimum-loading';
import {displayLabel} from './display-label';
import {CalendarDays,ArrowLeft} from 'lucide-react';

type Product={id:string;name:string;description:string;category:string;effective_price_cents:number};
type EventItem={id:string;name:string};
const money=(c:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);

export default function EventMenu({activeEventId,onChooseEvent}:{activeEventId:string;onChooseEvent:()=>void}){
 const [items,setItems]=useState<Product[]>([]);
 const [loadedEventId,setLoadedEventId]=useState('');
 const [eventName,setEventName]=useState('');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!activeEventId){
   setItems([]);setLoadedEventId('');setEventName('');setLoading(false);setError('');
   return;
  }
  let active=true;
  setLoading(true);setError('');
  fetch('/api/public/menu?event_id='+encodeURIComponent(activeEventId))
   .then(async response=>{
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Não foi possível carregar o cardápio.');
    return result;
   })
   .then(result=>{if(active){setItems(result.items||[]);setLoadedEventId(activeEventId);}})
   .catch(err=>{if(active){setItems([]);setError(err instanceof Error?err.message:'Erro ao carregar cardápio.');setLoadedEventId(activeEventId);}})
   .finally(()=>{if(active)setLoading(false);});
  fetch('/api/public/events').then(r=>r.ok?r.json():null)
   .then(result=>{if(active){const chosen=(result?.items||[] as EventItem[]).find((item:EventItem)=>item.id===activeEventId);setEventName(chosen?.name||'');}})
   .catch(()=>{});
  return()=>{active=false;};
 },[activeEventId]);
 const showLoading=useMinimumLoading(!!activeEventId&&(loading||loadedEventId!==activeEventId));
 if(!activeEventId)return <section className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-6">
  <CalendarDays className="text-[#c4ff40]"/>
  <h1 className="text-2xl font-black uppercase">Cardápio</h1>
  <p className="text-sm text-white/65">Escolha uma festa na aba Início para ver os produtos e preços do evento.</p>
  <button type="button" onClick={onChooseEvent} className="rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-bold text-black">Escolher evento</button>
 </section>;
 const categories=[...new Set(items.map(p=>p.category))];
 return <section className="space-y-5">
  <div>
   <p className="text-xs font-bold uppercase tracking-widest text-[#c4ff40]">Cardápio do evento</p>
   <h1 className="mt-2 text-3xl font-black uppercase">Produtos e preços</h1>
   <p className="mt-2 text-sm font-semibold text-white/70">{displayLabel(eventName)||'Evento selecionado'}</p>
  </div>
  {showLoading?<PageLoading compact label="Carregando produtos" description="Preparando o cardápio deste evento."/>
   :error?<div className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-5" role="status"><p className="text-sm text-white/70">Este evento não está disponível. Escolha outro para consultar o cardápio.</p><button type="button" onClick={onChooseEvent} className="inline-flex items-center gap-2 rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-bold text-black"><CalendarDays size={17}/> Escolher outro evento</button></div>
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
  <button type="button" onClick={onChooseEvent} className="inline-flex items-center gap-2 text-xs text-white/60 underline underline-offset-4"><ArrowLeft size={14}/> Escolher outro evento</button>
 </section>;
}
