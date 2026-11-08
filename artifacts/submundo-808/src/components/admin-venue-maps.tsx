import {useEffect,useState,type FormEvent} from 'react';
import {Map,Plus,Pencil,X,CalendarDays,ArrowUpRight} from 'lucide-react';
import {displayLabel} from './display-label';
import {AdminMapThumbnail,useAdminMapAreas} from './admin-map-thumbnail';

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
 venue,maps,events,onOpen,onChanged
}:{
 venue:Venue;maps:MapItem[];events:EventItem[];
 onOpen:(mapId:string)=>void;onChanged:()=>Promise<void>;
}){
 const [creating,setCreating]=useState(false),[newName,setNewName]=useState(''),[confirmDiscard,setConfirmDiscard]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const areas=useAdminMapAreas(maps);
 function requestClose(){if(busy)return;if(newName.trim()){setConfirmDiscard(true);return;}setCreating(false);setError('');}
 function discardDraft(){setConfirmDiscard(false);setCreating(false);setNewName('');setError('');}
 useEffect(()=>{
  if(!creating)return;
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key!=='Escape')return;
   event.preventDefault();
   if(confirmDiscard){setConfirmDiscard(false);return;}
   if(!busy){if(newName.trim())setConfirmDiscard(true);else setCreating(false);}
  };
  window.addEventListener('keydown',onKeyDown);
  return()=>window.removeEventListener('keydown',onKeyDown);
 },[creating,confirmDiscard,busy,newName]);
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
   <button type="button" onClick={()=>{setNewName('');setError('');setCreating(true);}} aria-haspopup="dialog" aria-expanded={creating}
    className="inline-flex items-center gap-2 rounded-xl bg-[#c4ff40] px-3 py-2.5 text-xs font-bold text-black"><Plus size={15}/> Novo mapa</button>
  </div>
  {creating&&<div role="presentation" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 sm:p-6" onMouseDown={event=>{if(event.target===event.currentTarget)requestClose();}}>
    <form role="dialog" aria-modal="true" aria-labelledby="create-map-title" onSubmit={event=>void create(event)} className="w-full max-w-md space-y-4 rounded-2xl border border-[#c4ff40]/35 bg-[#191320] p-4 shadow-2xl sm:p-6">
     <div className="flex items-center justify-between gap-3"><h4 id="create-map-title" className="text-lg font-black">Novo mapa</h4><button type="button" aria-label="Fechar novo mapa" disabled={busy} onClick={requestClose} className="rounded-lg border border-white/20 p-2"><X size={18}/></button></div>
     <p className="text-sm text-white/60">Crie uma planta para este estabelecimento. Depois você poderá adicionar ambientes, pontos e calibrar a localização.</p>
     <label className="block space-y-2 text-sm font-semibold text-white/75">Nome da planta
      <input autoFocus required maxLength={100} className="w-full rounded-xl border border-white/20 bg-[#241b2c] px-3 py-3 text-sm text-white"
       placeholder="Ex.: Planta principal, Área externa" value={newName} onChange={event=>setNewName(event.target.value)}/>
     </label>
     {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
     <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={requestClose} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm">Cancelar</button>
      <button disabled={busy||!newName.trim()} type="submit" className="rounded-xl bg-[#c4ff40] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">{busy?'Criando...':'Criar e abrir editor'}</button>
     </div>
    </form>
    {confirmDiscard&&<div role="presentation" className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4">
     <div role="alertdialog" aria-modal="true" aria-label="Descartar novo mapa?" className="w-full max-w-sm space-y-4 rounded-2xl border border-amber-400/35 bg-[#211729] p-5 shadow-2xl">
      <h4 className="text-lg font-bold">Descartar novo mapa?</h4>
      <p className="text-sm text-white/65">O nome digitado ainda não foi salvo. Se sair, ele será perdido.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" autoFocus onClick={()=>setConfirmDiscard(false)} className="rounded-lg border border-white/20 px-4 py-2">Continuar editando</button><button type="button" onClick={discardDraft} className="rounded-lg border border-amber-400/40 px-4 py-2 font-bold text-amber-200">Descartar</button></div>
     </div>
    </div>}
   </div>}
  {ownMaps.length===0?<div className="rounded-xl border border-dashed border-white/20 p-6 text-center">
   <Map className="mx-auto text-white/35"/><p className="mt-2 text-sm font-semibold">Nenhum mapa cadastrado</p>
   <p className="mt-1 text-xs text-white/50">Crie uma planta para organizar os ambientes, pontos de apoio e entradas deste estabelecimento.</p>
  </div>:<div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3" aria-label="Carrossel de plantas do local">
   {ownMaps.map(map=>{
    const usages=events.filter(event=>event.map_ids?.includes(map.id)).length;
    const rooms=areas.filter(area=>area.map_id===map.id);
    return <article key={map.id} className="w-[min(76vw,17rem)] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/15 bg-[#110d17]/90 sm:w-64">
     <button type="button" onClick={()=>onOpen(map.id)} aria-label={'Abrir planta '+map.name} className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-[linear-gradient(#ffffff0a_1px,transparent_1px),linear-gradient(90deg,#ffffff0a_1px,transparent_1px),linear-gradient(135deg,#0f111b,#27203a)] [background-size:17px_17px,17px_17px,auto]">
      <AdminMapThumbnail areas={rooms}/>
      <span className="absolute bottom-2 right-2 rounded-lg border border-white/15 bg-[#100d18]/90 p-1.5 text-[#c4ff40]"><ArrowUpRight size={15}/></span>
     </button>
     <div className="space-y-2 p-3">
      <p className="truncate text-sm font-bold">{displayLabel(map.name)}</p>
      <p className="text-xs text-white/50">{rooms.length} ambientes · {usages} eventos vinculados</p>
      <button type="button" onClick={()=>onOpen(map.id)} aria-label={'Editar planta '+map.name} className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4ff40]/30 px-3 py-2 text-xs font-bold text-[#c4ff40]"><Pencil size={13}/> Abrir editor</button>
     </div>
    </article>;
   })}
  </div>}
 </section>;
}
