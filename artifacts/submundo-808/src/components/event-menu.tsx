import {useEffect,useState} from 'react';
import PageLoading from './page-loading';
import useMinimumLoading from './use-minimum-loading';
type Product={id:string;name:string;description:string;category:string;effective_price_cents:number};
const money=(c:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
export default function EventMenu(){
 const [items,setItems]=useState<Product[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let live=true;async function load(){try{const events=await fetch('/api/public/events').then(r=>r.json());const event=events.items?.find((e:{id:string})=>e.id===localStorage.getItem('submundo-event-id'))||events.items?.[0];if(!event){if(live)setItems([]);return;}const response=await fetch('/api/public/menu?event_id='+encodeURIComponent(event.id));if(!response.ok)throw Error('Não foi possível carregar o cardápio.');const data=await response.json();if(live)setItems(data.items||[]);}catch(e){if(live)setError(e instanceof Error?e.message:'Erro ao carregar cardápio.');}finally{if(live)setLoading(false);}}void load();return()=>{live=false;};},[]);
 const showLoading=useMinimumLoading(loading);
 if(showLoading)return <PageLoading label="Carregando cardápio" description="Preparando os produtos e preços da festa."/>;
 const categories=[...new Set(items.map(x=>x.category))];
 return <section className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-widest text-[#c4ff40]">Cardápio oficial</p><h1 className="mt-2 text-3xl font-black uppercase">Produtos e preços</h1></div>{error?<p role="alert" className="text-sm text-red-300">{error}</p>:!items.length?<p className="rounded-2xl border border-white/10 p-5 text-sm text-white/60">Ainda não há produtos cadastrados para esta festa.</p>:categories.map(category=><div key={category}><h2 className="mb-3 font-bold uppercase">{category}</h2><div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/5">{items.filter(p=>p.category===category).map(p=><div key={p.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-semibold">{p.name}</p>{p.description&&<p className="mt-1 text-xs text-white/50">{p.description}</p>}</div><span className="shrink-0 font-bold text-[#c4ff40]">{money(p.effective_price_cents)}</span></div>)}</div></div>)}</section>;
}
