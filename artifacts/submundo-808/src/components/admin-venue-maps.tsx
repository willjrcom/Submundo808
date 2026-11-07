import {useEffect,useState,type FormEvent} from 'react';
import {Map,Plus,Pencil,X,CalendarDays,ArrowUpRight} from 'lucide-react';
import {displayLabel} from './display-label';

type Venue={id:string;name:string};
type MapItem={id:string;name:string;venue_id?:string};
type EventItem={id:string;venue_id?:string;map_ids?:string[]};
type AreaPreview={id:string;map_id:string;x:number;y:number;width:number;height:number;color?:string;geometry?:{shape?:string}};

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
 const [creating,setCreating]=useState(false),[newName,setNewName]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [areas,setAreas]=useState<AreaPreview[]>([]);
 useEffect(()=>{
  let active=true;
  void fetch('/api/admin/areas',{credentials:'same-origin'})
   .then(async response=>{if(!response.ok)throw Error('Mapas indisponíveis');return response.json();})
   .then(data=>{if(active)setAreas(data.items||[]);})
   .catch(()=>{});
  return()=>{active=false;};
 },[maps]);
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
  </div>:<div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3" aria-label="Carrossel de plantas do local">
   {ownMaps.map(map=>{
    const usages=events.filter(event=>event.map_ids?.includes(map.id)).length;
    const rooms=areas.filter(area=>area.map_id===map.id);
    return <article key={map.id} className="w-[min(76vw,17rem)] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/15 bg-[#110d17]/90 sm:w-64">
     <button type="button" onClick={()=>onOpen(map.id)} aria-label={'Abrir planta '+map.name} className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-[linear-gradient(#ffffff0a_1px,transparent_1px),linear-gradient(90deg,#ffffff0a_1px,transparent_1px),linear-gradient(135deg,#0f111b,#27203a)] [background-size:17px_17px,17px_17px,auto]">
      {rooms.length?<svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full p-4">
       {rooms.map(area=>area.geometry?.shape==='ellipse'
        ?<ellipse key={area.id} cx={area.x+area.width/2} cy={area.y+area.height/2} rx={area.width/2} ry={area.height/2} fill={area.color||'#474d9c'} fillOpacity={.35} stroke="#c4ff40" strokeWidth={.75}/>
        :<rect key={area.id} x={area.x} y={area.y} width={area.width} height={area.height} rx="1" fill={area.color||'#474d9c'} fillOpacity={.35} stroke="#c4ff40" strokeWidth={.75}/>)}
      </svg>:<Map size={39} className="text-[#c4ff40]/70"/>}
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
  {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
 </section>;
}
