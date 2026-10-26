import {useEffect,useState} from 'react';
import PageLoading from './page-loading';
import {displayLabel} from './display-label';
import useMinimumLoading from './use-minimum-loading';
type Product={id:string;name:string;description:string;category:string;default_price_cents:number};
type Event={id:string;name:string};
async function api(key:string,data?:object){const r=await fetch('/api/admin/'+key,{method:data?'POST':'GET',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});const j=await r.json();if(!r.ok)throw Error(j.error||'Erro');return j;}
const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
const input='w-full rounded-xl border border-white/20 bg-[#241b2c] p-3 text-sm';
export default function AdminProducts({events}:{events:Event[]}){
 const [initialReady,setInitialReady]=useState(false),[initialFailed,setInitialFailed]=useState(false);
 const [loadedAssignmentsFor,setLoadedAssignmentsFor]=useState(''),[assignmentError,setAssignmentError]=useState(''),[assignmentReload,setAssignmentReload]=useState(0);
 const [productSearch,setProductSearch]=useState(''),[categoryFilter,setCategoryFilter]=useState(''),[catalogResults,setCatalogResults]=useState<Product[]>([]),[products,setProducts]=useState<Product[]>([]),[editing,setEditing]=useState<string|null>(null),[name,setName]=useState(''),[description,setDescription]=useState(''),[category,setCategory]=useState('Bebidas'),[price,setPrice]=useState('0,00'),[eventId,setEventId]=useState(''),[assigned,setAssigned]=useState<Record<string,{enabled:boolean;price:string}>>({}),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState<Product|null>(null);
 async function refresh(){const r=await api('products');setProducts(r.items);const filtered=await api('products?q='+encodeURIComponent(productSearch)+'&category='+encodeURIComponent(categoryFilter));setCatalogResults(filtered.items);}
 useEffect(()=>{
  let alive=true;
  void api('products').then(result=>{if(alive){setProducts(result.items||[]);setCatalogResults(result.items||[]);}})
   .catch(e=>{if(alive){setInitialFailed(true);setError(e instanceof Error?e.message:'Falha ao carregar produtos.');}})
   .finally(()=>{if(alive)setInitialReady(true);});
  return()=>{alive=false;};
 },[]);
 useEffect(()=>{
  if(!eventId){setAssigned({});setLoadedAssignmentsFor('');setAssignmentError('');return;}
  let active=true;setAssignmentError('');
  fetch('/api/admin/event-products?event_id='+encodeURIComponent(eventId))
   .then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error||'Não foi possível carregar o cardápio do evento.');return body;})
   .then(result=>{
    if(!active)return;
    const next:Record<string,{enabled:boolean;price:string}>={};
    for(const p of result.items||[])next[p.product_id]={enabled:true,price:p.price_cents===null?'':(p.price_cents/100).toFixed(2).replace('.',',')};
    setAssigned(next);setLoadedAssignmentsFor(eventId);
   })
   .catch(e=>{if(active){setAssignmentError(e instanceof Error?e.message:'Falha ao carregar cardápio.');setLoadedAssignmentsFor('');}});
  return()=>{active=false;};
 },[eventId,assignmentReload]);
 useEffect(()=>{let active=true;const controller=new AbortController();const timer=setTimeout(()=>{fetch('/api/admin/products?q='+encodeURIComponent(productSearch)+'&category='+encodeURIComponent(categoryFilter),{credentials:'same-origin',signal:controller.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Falha ao filtrar produtos');return j;}).then(j=>{if(active)setCatalogResults(j.items||[]);}).catch(e=>{if(active&&e.name!=='AbortError')setError(String(e));});},250);return()=>{active=false;controller.abort();clearTimeout(timer);};},[productSearch,categoryFilter,products]);
 function edit(p?:Product){setEditing(p?.id||'new');setName(p?.name||'');setDescription(p?.description||'');setCategory(p?.category||'Bebidas');setPrice(p?(p.default_price_cents/100).toFixed(2).replace('.',','):'0,00');}
 function cents(v:string){const n=Number(v.replace(',','.'));return Number.isFinite(n)&&n>=0?Math.round(n*100):NaN;}
 async function save(){setBusy(true);setError('');try{await api('save-product',{id:editing==='new'?undefined:editing,name,description,category,default_price_cents:cents(price)});await refresh();setEditing(null);setNotice('Produto salvo.');}catch(e){setError(String(e));}finally{setBusy(false);}}
 async function remove(){if(!confirm)return;setBusy(true);try{await api('delete-product',{id:confirm.id});await refresh();setConfirm(null);setNotice('Produto excluído.');}catch(e){setError(String(e));}finally{setBusy(false);}}
 async function saveEvent(){setBusy(true);setError('');try{await api('save-event-products',{event_id:eventId,items:products.filter(p=>assigned[p.id]?.enabled).map(p=>({product_id:p.id,price_cents:assigned[p.id].price.trim()===''?null:cents(assigned[p.id].price)}))});setNotice('Cardápio do evento salvo.');}catch(e){setError(String(e));}finally{setBusy(false);}}
 const categories=[...new Set(products.map(p=>p.category))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const visibleProducts=catalogResults;
 const showInitialLoading=useMinimumLoading(!initialReady);
 const showAssignmentLoading=useMinimumLoading(!!eventId&&loadedAssignmentsFor!==eventId&&!assignmentError);
 if(showInitialLoading)return <PageLoading label="Carregando produtos" description="Buscando o catálogo e os cardápios cadastrados."/>;
 if(initialFailed)return <div role="alert" className="mt-7 rounded-2xl border border-red-400/25 bg-red-400/5 p-6 text-center"><p className="font-bold text-red-200">Não foi possível carregar o catálogo.</p><p className="mt-2 text-xs text-white/60">{error}</p><button onClick={()=>{setInitialReady(false);setInitialFailed(false);setError('');void refresh().catch(e=>{setInitialFailed(true);setError(String(e));}).finally(()=>setInitialReady(true));}} className="mt-4 rounded-xl bg-[#c4ff40] px-4 py-2 text-sm font-bold text-black">Tentar novamente</button></div>;
 return <div className="mt-7 space-y-8"><section className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="flex items-center justify-between"><h3 className="font-bold">Catálogo de produtos</h3><button onClick={()=>edit()} className="rounded-xl bg-[#c4ff40] px-4 py-2 text-sm font-bold text-black">+ Produto</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><input aria-label="Buscar produtos" placeholder="Buscar por nome ou descrição..." className={input} value={productSearch} onChange={e=>setProductSearch(e.target.value)}/><select aria-label="Filtrar produtos por categoria" className={input} value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="">Todas as categorias</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div><p className="mt-2 text-xs text-white/45">{visibleProducts.length} de {products.length} produtos</p>{visibleProducts.length===0&&<p className="mt-3 text-sm text-white/50">Nenhum produto encontrado.</p>}{visibleProducts.map(p=><div key={p.id} className="mt-3 flex items-center justify-between gap-3 border-b border-white/10 py-3"><div><p className="font-semibold">{p.name}</p><p className="text-xs text-white/50">{p.category} · {money(p.default_price_cents)}</p></div><div className="flex gap-2"><button onClick={()=>edit(p)} className="rounded-lg border border-white/20 px-3 py-2 text-xs">Editar</button><button onClick={()=>setConfirm(p)} className="rounded-lg border border-red-400/30 px-3 py-2 text-xs text-red-300">Excluir</button></div></div>)}</section>{error&&<p role="alert" className="text-red-300">{error}</p>}{notice&&<p className="text-[#c4ff40]">{notice}</p>}{editing!==null&&<div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null);}}><section role="dialog" aria-modal="true" aria-label={editing==='new'?'Novo produto':'Editar produto'} className="w-full max-w-lg space-y-4 rounded-2xl border border-[#c4ff40]/25 bg-[#1b1423] p-6 shadow-2xl"><h3 className="text-lg font-bold">{editing==='new'?'Novo produto':'Editar produto'}</h3><input aria-label="Nome" placeholder="Nome do produto" value={name} onChange={e=>setName(e.target.value)} className={input}/><input aria-label="Descrição" placeholder="Descrição" value={description} onChange={e=>setDescription(e.target.value)} className={input}/><input aria-label="Categoria" placeholder="Categoria" value={category} onChange={e=>setCategory(e.target.value)} className={input}/><label className="block text-xs text-white/60">Preço padrão (R$)<input value={price} onChange={e=>setPrice(e.target.value)} inputMode="decimal" className={input}/></label><div className="flex gap-2"><button disabled={busy} onClick={()=>void save()} className="rounded-xl bg-[#c4ff40] px-4 py-2 font-bold text-black">Salvar produto</button><button onClick={()=>setEditing(null)} className="rounded-xl border border-white/20 px-4 py-2">Cancelar</button></div></section></div>}{confirm&&<div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"><div className="w-full max-w-sm rounded-2xl bg-[#241b2c] p-6"><h3 className="font-bold">Excluir {confirm.name}?</h3><p className="mt-2 text-sm text-white/60">O produto será removido também dos cardápios das festas.</p><div className="mt-5 flex gap-2"><button onClick={()=>setConfirm(null)} className="rounded-xl border border-white/20 px-4 py-2">Cancelar</button><button disabled={busy} onClick={()=>void remove()} className="rounded-xl bg-red-500 px-4 py-2 font-bold">Excluir</button></div></div></div>}</div>;
}

export function EventMenuEditor({eventId}:{eventId:string}){
 const [products,setProducts]=useState<Product[]>([]);
 const [selected,setSelected]=useState<Record<string,{price:string}>>({});
 const [category,setCategory]=useState(''),[query,setQuery]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  let active=true;setLoading(true);setError('');setNotice('');
  Promise.all([api('products'),api('event-products?event_id='+encodeURIComponent(eventId))])
   .then(([catalog,menu])=>{if(!active)return;
    setProducts(catalog.items||[]);
    const next:Record<string,{price:string}>={};
    for(const item of menu.items||[])next[item.product_id]={price:item.price_cents===null?'':(item.price_cents/100).toFixed(2).replace('.',',')};
    setSelected(next);
   }).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[eventId]);
 const categories=[...new Set(products.map(p=>p.category))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const visible=products.filter(p=>(!category||p.category===category)&&(!query||[p.name,p.description,p.category].some(x=>x.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))));
 const chosen=Object.keys(selected).length;
 const mark=(id:string,enabled:boolean)=>setSelected(old=>{const next={...old};if(enabled)next[id]=old[id]||{price:''};else delete next[id];return next;});
 const markCategory=(cat:string,enabled:boolean)=>setSelected(old=>{const next={...old};for(const p of products.filter(x=>x.category===cat)){if(enabled)next[p.id]=next[p.id]||{price:''};else delete next[p.id];}return next;});
 async function saveMenu(){
  setBusy(true);setError('');setNotice('');
  try{
   const items=Object.entries(selected).map(([product_id,details])=>{
    const cleaned=details.price.trim();
    if(!cleaned)return {product_id,price_cents:null};
    const parsed=Number(cleaned.replace(',','.'));
    if(!Number.isFinite(parsed)||parsed<0||!/^\d+(?:[,.]\d{1,2})?$/.test(cleaned))throw Error('Informe um preço válido em reais ou deixe vazio para usar o padrão.');
    return {product_id,price_cents:Math.round(parsed*100)};
   });
   await api('save-event-products',{event_id:eventId,items});
   setNotice('Cardápio do evento atualizado.');
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 return <div className="space-y-4">
  <div><h4 className="font-bold">Produtos deste evento</h4><p className="mt-1 text-xs text-white/55">Selecione produtos ou categorias. O catálogo geral não será alterado. Preço especial vazio significa preço padrão.</p></div>
  {loading?<PageLoading compact label="Carregando cardápio" description="Buscando produtos e preços do evento."/>:<>
   <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-[#c4ff40]">{chosen} de {products.length} produtos selecionados</span><div className="flex gap-2"><button type="button" onClick={()=>setSelected(Object.fromEntries(products.map(p=>[p.id,selected[p.id]||{price:''}]))) } className="rounded-lg border border-white/20 px-3 py-2 text-xs">Adicionar todos</button><button type="button" onClick={()=>setSelected({})} className="rounded-lg border border-white/20 px-3 py-2 text-xs">Remover todos</button></div></div>
   <div className="grid gap-2 sm:grid-cols-2"><input aria-label="Buscar produtos do cardápio" className={input} placeholder="Buscar produto..." value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Filtrar categoria do cardápio" className={input} value={category} onChange={e=>setCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map(c=><option value={c} key={c}>{c}</option>)}</select></div>
   <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">{categories.filter(cat=>(!category||cat===category)&&visible.some(p=>p.category===cat)).map(cat=>{
    const entries=visible.filter(p=>p.category===cat);
    const group=products.filter(p=>p.category===cat);
    const allSelected=group.every(p=>!!selected[p.id]);
    return <section key={cat} className="overflow-hidden rounded-xl border border-white/10"><div className="flex flex-wrap items-center justify-between gap-2 bg-white/[.06] px-3 py-3"><p className="text-sm font-bold">{cat}</p><button type="button" className="rounded-lg border border-[#c4ff40]/35 px-3 py-2 text-xs font-bold text-[#c4ff40]" onClick={()=>markCategory(cat,!allSelected)}>{allSelected?'Remover categoria':'Adicionar categoria'}</button></div>
     {entries.map(p=><div key={p.id} className="flex flex-col gap-2 border-t border-white/10 p-3 sm:flex-row sm:items-center"><label className="flex min-w-0 flex-1 items-center gap-3 text-sm"><input type="checkbox" checked={!!selected[p.id]} onChange={e=>mark(p.id,e.target.checked)} className="h-4 w-4 accent-[#c4ff40]"/><span className="min-w-0"><span className="block font-semibold">{p.name}</span><span className="text-xs text-white/50">Padrão: {money(p.default_price_cents)}</span></span></label>{selected[p.id]&&<label className="text-[11px] text-white/60 sm:w-40">Preço especial (R$)<input inputMode="decimal" aria-label={'Preço especial de '+p.name} placeholder="Usar padrão" className={input+' mt-1 !p-2'} value={selected[p.id].price} onChange={e=>setSelected(old=>({...old,[p.id]:{price:e.target.value}}))}/></label>}</div>)}
    </section>;
   })}{!visible.length&&<p className="p-4 text-center text-sm text-white/50">Nenhum produto encontrado.</p>}</div>
   {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}{notice&&<p role="status" className="text-sm text-[#c4ff40]">{notice}</p>}
   <button type="button" disabled={busy} onClick={()=>void saveMenu()} className="w-full rounded-xl bg-[#c4ff40] p-3 text-sm font-bold text-black disabled:opacity-50">{busy?'Salvando...':'Salvar cardápio do evento'}</button>
  </>}
 </div>;
}
