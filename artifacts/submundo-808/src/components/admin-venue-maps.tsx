import {useState,type FormEvent} from 'react';
import {Map,Plus,Pencil,Trash2,X,CalendarDays} from 'lucide-react';
import {displayLabel} from './display-label';

type Venue={id:string;name:string};
type MapItem={id:string;name:string;venue_id?:string};
type EventItem={id:string;venue_id?:string;map_ids?:string[]};

async function adminRequest(route:string,payload:object){
 const response=await fetch('/api/admin/'+route,{method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'Não foi possível salvar o mapa.');
 return result;
}
export default function AdminVenueMaps({
 venue,maps,events,onOpen,onChanged,onDelete
}:{
 venue:Venue;maps:MapItem[];events:EventItem[];
 onOpen:(mapId:string)=>void;onChanged:()=>Promise<void>;onDelete:(map:MapItem)=>void;
}){
 const [creating,setCreating]=useState(false),[newName,setNewName]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const ownMaps=maps.filter(map=>map.venue_id===venue.id).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 async function create(event:FormEvent){
  event.preventDefault();
  const name=newName.trim();if(!name)return;
  setBusy(true);setError('');
  try{
   const result=await adminRequest('maps',{name,venue_id:venue.id});
   await onChanged();
   setNewName('');setCreating(false);
   onOpen(result.id);
  }catch(error){setError(error instanceof Error?error.message:'Erro ao criar mapa.');}
  finally{setBusy(false);}
 }
 return <section aria-label={'Mapas do estabelecimento '+venue.name} className="space-y-4 rounded-2xl border border-[#c4ff40]/20 bg-white/[.035] p-4 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h3 className="flex items-center gap-2 text-lg font-black"><Map size={20} className="text-[#c4ff40]"/> Plantas do local</h3>
    <p className="mt-1 text-xs text-white/55">{ownMaps.length} {ownMaps.length===1?'mapa cadastrado':'mapas cadastrados'} neste estabelecimento</p>
   </div>
   <button type="button" onClick={()=>{setCreating(v=>!v);setError('');}}
    className="inline-flex items-center gap-2 rounded-xl bg-[#c4ff40] px-3 py-2.5 text-xs font-bold text-black">
    {creating?<X size={15}/>:<Plus size={15}/>} {creating?'Cancelar':'Novo mapa'}
   </button>
  </div>
  {creating&&<form onSubmit={event=>void create(event)} className="space-y-3 rounded-xl border border-[#c4ff40]/20 bg-[#c4ff40]/[.05] p-4">
   <label className="block space-y-1 text-xs text-white/65">Nome do novo mapa
    <input autoFocus required maxLength={100} className="w-full rounded-xl border border-white/20 bg-[#241b2c] px-3 py-3 text-sm text-white"
     placeholder="Ex.: Planta principal, Área externa" value={newName} onChange={event=>setNewName(event.target.value)}/>
   </label>
   <p className="text-xs text-white/50">O mapa inicia com ambientes e pontos editáveis.</p>
   <button disabled={busy||!newName.trim()} type="submit" className="rounded-xl bg-[#c4ff40] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">Criar e abrir editor</button>
  </form>}
  {ownMaps.length===0?<div className="rounded-xl border border-dashed border-white/20 p-6 text-center">
   <Map className="mx-auto text-white/35"/><p className="mt-2 text-sm font-semibold">Nenhum mapa cadastrado</p>
   <p className="mt-1 text-xs text-white/50">Crie uma planta para organizar os ambientes, pontos de apoio e entradas deste estabelecimento.</p>
  </div>:<div className="space-y-2">
   {ownMaps.map(map=>{
    const usages=events.filter(event=>event.map_ids?.includes(map.id)).length;
    return <div key={map.id} className="rounded-xl border border-white/10 bg-[#110d17]/70 p-3">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
       <p className="break-words text-sm font-bold">{displayLabel(map.name)}</p>
       <p className="mt-1 flex items-center gap-1 text-xs text-white/50"><CalendarDays size={12}/>{usages} {usages===1?'evento vinculado':'eventos vinculados'}</p>
      </div>
      <div className="flex items-center gap-2">
       <button type="button" onClick={()=>onOpen(map.id)} aria-label={'Editar planta '+map.name} title="Editar planta" className="inline-flex items-center justify-center rounded-lg border border-[#c4ff40]/40 p-3 text-[#c4ff40]"><Pencil size={18}/></button>
       <button type="button" onClick={()=>onDelete(map)} aria-label={'Excluir planta '+map.name} title={usages?'Remova este mapa dos eventos antes de excluir':'Excluir planta'} className="inline-flex items-center justify-center rounded-lg border border-red-400/40 p-3 text-red-300"><Trash2 size={18}/></button>
      </div>
     </div>
    </div>;
   })}
  </div>}
  {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
 </section>;
}
