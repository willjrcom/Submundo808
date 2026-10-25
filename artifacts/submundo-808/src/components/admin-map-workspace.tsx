import {useEffect,useRef,useState} from 'react';
import PageLoading from './page-loading';
import useMinimumLoading from './use-minimum-loading';
import {
 ArrowLeft,Plus,Save,Trash2,Move,MapPin,Pencil,Maximize2,Undo2,Redo2,
 Eye,MousePointer2,Square,RotateCcw,Info,Warehouse,Users,Music2,Crown,
 Utensils,Ticket,DoorOpen,Bath,Wine,Sofa,Stethoscope,Flag,Grid3X3
} from 'lucide-react';
import {freeAreaPosition,moveArea,resizeShared,sharesBorder,limit,type Edge} from './map-layout-geometry';

type GPS={lat:number;lng:number;accuracy:number};
type GPSData=Partial<Record<'tl'|'tr'|'br'|'bl',GPS>> & {mode?:'manual'|'demo-auto';spacingMeters?:number;accuracyMeters?:number};
type Area={id:string;name:string;map_id:string;kind:string;x:number;y:number;width:number;height:number;gps:GPSData;description?:string;color?:string;icon?:string};
type Marker={id:string;name:string;type:string;x:number;y:number;description?:string;color?:string;shape?:'square'|'circle';size?:number};
type MapItem={id:string;name:string;venue_id:string};
type Snapshot={areas:Area[];markers:Marker[]};
type Drag={id:string;kind:'area'|'marker'|'resize';edge?:Edge;startX:number;startY:number;offsetX:number;offsetY:number;snapshot:Snapshot;changed?:boolean};
const input='w-full rounded-xl border border-white/15 bg-[#1b1624] px-3 py-2.5 text-sm text-white outline-none focus:border-[#c4ff40]';
const button='inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-semibold transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-35';
const colors=['#9747FF','#3B82F6','#00BDD6','#A3E635','#FF9F43','#FF456C','#EAB308'];
const types=['principal','pista','palco','vip','backstage','recepcao','entrada','descanso','cozinha','alimentacao','bar','banheiro','saida','posto-medico','outro'];
const typeNames:Record<string,string>={principal:'Área principal',backstage:'Backstage',pista:'Pista',palco:'Palco',vip:'Área VIP',recepcao:'Recepção',entrada:'Entrada',descanso:'Área de descanso',cozinha:'Cozinha',alimentacao:'Alimentação',bar:'Bar',banheiro:'Banheiro',saida:'Saída','posto-medico':'Posto médico',outro:'Outro'};
const iconFor=(type:string)=>{
 const icons:Record<string,typeof MapPin>={principal:Music2,backstage:Warehouse,pista:Music2,palco:Warehouse,vip:Crown,recepcao:Users,entrada:DoorOpen,descanso:Sofa,cozinha:Utensils,alimentacao:Utensils,bar:Wine,banheiro:Bath,saida:Flag,'posto-medico':Stethoscope,outro:MapPin};
 return icons[type]||MapPin;
};
const areaColor=(a:Area)=>/^#[0-9a-fA-F]{6}$/.test(a.color||'')?a.color!:'#9747FF';
const pointColor=(p:Marker)=>/^#[0-9a-fA-F]{6}$/.test(p.color||'')?p.color!:'#C4FF40';
async function api(route:string,payload?:object){
 const r=await fetch('/api/admin/'+route,{method:payload?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});
 const j=await r.json();if(!r.ok)throw Error(j.error||'Erro ao carregar o mapa');return j;
}
export default function AdminMapWorkspace({map,onBack}:{map:MapItem;onBack:()=>void}){
 const [areas,setAreas]=useState<Area[]>([]),[markers,setMarkers]=useState<Marker[]>([]);
 const [selected,setSelected]=useState(''),[editLayout,setEditLayout]=useState(false),[resizeId,setResizeId]=useState<string|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[initialLoadError,setInitialLoadError]=useState(false),[saving,setSaving]=useState(false),[dirty,setDirty]=useState(false);
 const [calibrationOpen,setCalibrationOpen]=useState(false);const [calibrationBusy,setCalibrationBusy]=useState(false);const [calibrationPosition,setCalibrationPosition]=useState<GPS|null>(null);
 const calibrationArea=areas.find(a=>(['tl','tr','br','bl'] as const).some(k=>a.gps?.[k]))||areas[0];
 const calibrationKeys=['tl','tr','bl','br'] as const;
 const calibrationLabels=['Superior esquerdo','Superior direito','Inferior esquerdo','Inferior direito'];
 const [history,setHistory]=useState<Snapshot[]>([]),[future,setFuture]=useState<Snapshot[]>([]),[snap,setSnap]=useState(true);
 const canvas=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null);
 const active=areas.find(a=>a.id===selected);
 const selectedMarker=markers.find(m=>m.id===selected);
 const editing=editLayout;
 const areasOutside=areas.filter(a=>a.x<0||a.y<0||a.x+a.width>100||a.y+a.height>100).length;
 const markersOutside=markers.filter(m=>m.x<0||m.y<0||m.x>100||m.y>100).length;
 useEffect(()=>{
  let alive=true;setLoading(true);setInitialLoadError(false);
  Promise.all([api('areas'),api('markers?map_id='+encodeURIComponent(map.id))]).then(([a,m])=>{
   if(!alive)return;setAreas(a.items.filter((x:Area)=>x.map_id===map.id));setMarkers(m.items);setDirty(false);setHistory([]);setFuture([]);
  }).catch(e=>{if(alive){setError(String(e));setInitialLoadError(true);}}).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[map.id]);
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(!dirty)return;e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 function checkpoint(){setHistory(v=>[...v.slice(-39),{areas,markers}]);setFuture([]);setDirty(true);setNotice('');}
 function undo(){if(!history.length)return;const previous=history[history.length-1];setFuture(v=>[...v,{areas,markers}]);setHistory(v=>v.slice(0,-1));setAreas(previous.areas);setMarkers(previous.markers);setDirty(true);setResizeId(null);}
 function redo(){if(!future.length)return;const next=future[future.length-1];setHistory(v=>[...v,{areas,markers}]);setFuture(v=>v.slice(0,-1));setAreas(next.areas);setMarkers(next.markers);setDirty(true);setResizeId(null);}
 function updateArea(patch:Partial<Area>){if(!active)return;checkpoint();setAreas(v=>v.map(a=>a.id===active.id?{...a,...patch}:a));}
 function updateMarker(patch:Partial<Marker>){if(!selectedMarker)return;checkpoint();setMarkers(v=>v.map(m=>m.id===selectedMarker.id?{...m,...patch}:m));}
 function createArea(){
  const p=freeAreaPosition(areas);
  if(!p){setError('Não há espaço livre para um novo ambiente. Ajuste as divisórias antes de adicionar.');return;}
  checkpoint();setError('');
  const id=crypto.randomUUID();
  setAreas(v=>[...v,{id,map_id:map.id,name:'Novo ambiente',kind:'outro',...p,gps:{},icon:'outro',color:'#9747FF',description:''}]);
  setSelected(id);setEditLayout(true);setResizeId(id);setNotice('Novo ambiente criado. Arraste suas bordas e depois salve o mapa.');
 }
 function createMarker(){
  checkpoint();const id=crypto.randomUUID();
  const x=active?active.x+active.width/2:50,y=active?active.y+active.height/2:50;
  setMarkers(v=>[...v,{id,name:'Novo ponto',type:'outro',x,y,shape:'square',size:42,color:'#C4FF40',description:''}]);
  setSelected(id);setEditLayout(true);setResizeId(null);setNotice('Arraste o ponto para posicionar. Salve o mapa ao terminar.');
 }
 function removeSelected(){
  if(!active&&!selectedMarker)return;
  if(!window.confirm('Remover '+(active?.name||selectedMarker?.name)+'? A exclusão será aplicada ao salvar o mapa.'))return;
  checkpoint();
  if(active)setAreas(v=>v.filter(a=>a.id!==active.id));
  else setMarkers(v=>v.filter(m=>m.id!==selectedMarker?.id));
  setSelected('');setResizeId(null);
 }
 function coord(e:React.PointerEvent){
  const rect=canvas.current?.getBoundingClientRect();if(!rect||!rect.width||!rect.height)return null;
  return {x:(e.clientX-rect.left)/rect.width*100,y:(e.clientY-rect.top)/rect.height*100};
 }
 function startDrag(e:React.PointerEvent,id:string,kind:Drag['kind'],edge?:Edge){
  e.stopPropagation();setSelected(id);
  if(!editing)return;
  if(kind==='area'&&resizeId!==id)setResizeId(null);
  const p=coord(e);if(!p)return;
  const item=kind==='marker'?markers.find(m=>m.id===id):areas.find(a=>a.id===id);if(!item)return;
  e.preventDefault();
  drag.current={id,kind,edge,startX:p.x,startY:p.y,offsetX:p.x-item.x,offsetY:p.y-item.y,snapshot:{areas,markers}};
  canvas.current?.setPointerCapture(e.pointerId);
 }
 function move(e:React.PointerEvent){
  const d=drag.current;if(!d)return;
  const p=coord(e);if(!p)return;
  if(!d.changed){
   if(Math.abs(p.x-d.startX)+Math.abs(p.y-d.startY)<.3)return;
   checkpoint();d.changed=true;
  }
  if(d.kind==='marker')setMarkers(d.snapshot.markers.map(m=>m.id===d.id?{...m,x:limit(p.x-d.offsetX,-35,135),y:limit(p.y-d.offsetY,-35,135)}:m));
  else if(d.kind==='resize'&&d.edge){
   const delta=d.edge==='left'||d.edge==='right'?p.x-d.startX:p.y-d.startY;
   setAreas(resizeShared(d.snapshot.areas,d.id,d.edge,delta));
  }else{
   setAreas(moveArea(d.snapshot.areas,d.id,p.x-d.offsetX,p.y-d.offsetY,snap));
  }
 }
 function endDrag(e:React.PointerEvent){
  if(drag.current){drag.current=null;if(canvas.current?.hasPointerCapture(e.pointerId))canvas.current.releasePointerCapture(e.pointerId);}
 }
 async function save(){
  if(saving)return;setSaving(true);setError('');
  try{
   await api('save-layout',{map_id:map.id,areas,markers});
   setDirty(false);setHistory([]);setFuture([]);setNotice('Mapa salvo com sucesso. Ambientes e pontos publicados para os participantes.');setEditLayout(false);setResizeId(null);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar o mapa.');}
  finally{setSaving(false);}
 }
 async function capture(corner:string){
  if(!calibrationArea){setError('Crie um ambiente antes de calibrar o mapa.');return;}
  if(!navigator.geolocation){setError('GPS indisponível neste navegador.');return;}
  setCalibrationBusy(true);setError('');
  navigator.geolocation.getCurrentPosition(p=>{
   const point={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy};
   checkpoint();setCalibrationPosition(point);
   setAreas(v=>v.map(a=>{
    if(a.id!==calibrationArea.id)return {...a,gps:{}};
    // Nunca misturar cantos gerados automaticamente com cantos medidos.
    const previous=a.gps?.mode==='demo-auto'?{}:a.gps;
    return {...a,gps:{...previous,[corner]:point,mode:'manual' as const}};
   }));
   setNotice('Ponto registrado (precisão ±'+Math.round(point.accuracy)+' m). Salve o mapa para publicar.');
   setCalibrationBusy(false);
  },e=>{setError('Não foi possível calibrar: '+e.message);setCalibrationBusy(false);},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
 }
 async function discard(){
  if(!window.confirm('Descartar alterações não salvas?'))return;
  setLoading(true);setError('');
  try{
   const [a,m]=await Promise.all([api('areas'),api('markers?map_id='+encodeURIComponent(map.id))]);
   setAreas(a.items.filter((x:Area)=>x.map_id===map.id));setMarkers(m.items);
   setDirty(false);setHistory([]);setFuture([]);setResizeId(null);setSelected('');setEditLayout(false);setNotice('Alterações descartadas.');
  }catch(e){setError(String(e));}finally{setLoading(false);}
 }
 function back(){if(dirty&&!window.confirm('Há alterações não salvas. Sair e descartar essas alterações?'))return;onBack();}
 function activateResize(){
  if(!active)return;setEditLayout(true);setResizeId(id=>id===active.id?null:active.id);
 }
 const colorInput=(value:string,apply:(color:string)=>void)=><div className="flex flex-wrap items-center gap-2">{colors.map(c=><button key={c} type="button" aria-label={'Cor '+c} onClick={()=>apply(c)} className={'h-7 w-7 rounded-full border-2 '+(value.toLowerCase()===c.toLowerCase()?'border-white ring-2 ring-white/30':'border-transparent')} style={{backgroundColor:c}}/>)}<input aria-label="Escolher cor personalizada" type="color" value={/^#[0-9a-fA-F]{6}$/.test(value)?value:'#9747FF'} onChange={e=>apply(e.target.value)} className="h-8 w-9 cursor-pointer bg-transparent"/></div>;
 const showLoading=useMinimumLoading(loading);
 if(showLoading)return <div className="space-y-4"><button onClick={back} className="flex items-center gap-2 text-sm text-white/60"><ArrowLeft size={16}/> Voltar aos mapas</button><PageLoading label="Carregando editor de mapas" description="Carregando ambientes, pontos e calibração antes de abrir o editor."/></div>;
 if(initialLoadError)return <div role="alert" className="rounded-2xl border border-red-400/25 bg-red-400/5 p-6 text-center"><p className="font-bold text-red-200">Não foi possível carregar o mapa.</p><p className="mt-2 text-sm text-white/60">{error}</p><button onClick={()=>window.location.reload()} className="mt-4 rounded-xl bg-[#c4ff40] px-4 py-2 font-bold text-black">Tentar novamente</button><button onClick={back} className="ml-3 rounded-xl border border-white/15 px-4 py-2 text-white">Voltar</button></div>;
 return <div className="space-y-5">
  <button onClick={back} className="flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft size={16}/> Voltar aos mapas</button>
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-xs uppercase tracking-widest text-[#c4ff40]">Editor do mapa</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">{map.name}</h2><p className="mt-1 text-xs text-white/50">{dirty?'● Alterações não salvas':'Mapa salvo'} · {editing?'Modo edição ativo':'Modo de visualização'} · Área externa disponível para organizar</p></div>
   <div className="flex flex-wrap gap-2"><button disabled={!dirty||saving} onClick={()=>void discard()} className={button}>Descartar</button><button disabled={saving||loading||!dirty} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-black text-black disabled:opacity-40"><Save size={16}/>{saving?'Salvando...':'Salvar mapa'}</button></div>
  </div>
  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] p-2">
   <button onClick={()=>{setEditLayout(v=>!v);setResizeId(null);}} aria-pressed={editing} className={button+' '+(editing?'border-[#c4ff40] bg-[#c4ff40]/15 text-[#c4ff40]':'')}><Pencil size={16}/>{editing?'Concluir edição':'Editar layout'}</button>
   <button onClick={createArea} className={button}><Plus size={16}/> Ambiente</button>
   <button onClick={createMarker} className={button}><MapPin size={16}/> Ponto</button><button onClick={()=>setCalibrationOpen(true)} className={button+" border-[#c4ff40]/50 text-[#c4ff40]"}><MapPin size={16}/> Calibrar mapa</button>
   <button disabled={!history.length} onClick={undo} title="Desfazer" aria-label="Desfazer" className={button}><Undo2 size={17}/></button>
   <button disabled={!future.length} onClick={redo} title="Refazer" aria-label="Refazer" className={button}><Redo2 size={17}/></button>
   <label className="ml-auto flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-white/65"><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)} className="accent-[#c4ff40]"/> Encaixar bordas</label>
  </div>
  <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
   <div className="min-w-0 space-y-3">
    {loading?<p className="rounded-xl border border-white/10 p-6 text-white/60">Carregando ambientes...</p>:<div
      className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-xl border border-white/20 bg-[#0f0d16]"
      style={{backgroundImage:'linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px)',backgroundSize:'4% 4%'}}
     ><div
     ref={canvas} onPointerMove={move} onPointerUp={endDrag} onPointerCancel={endDrag}
     className={'absolute left-[22%] top-[22%] h-[56%] w-[56%] border-2 border-dashed border-[#c4ff40]/30 bg-[#23132e]/40 '+(editing?'touch-none':'')}
     style={{backgroundImage:'linear-gradient(#ffffff12 1px,transparent 1px),linear-gradient(90deg,#ffffff12 1px,transparent 1px)',backgroundSize:'10% 10%',touchAction:editing?'none':'auto'}}
     onPointerDown={e=>{if(e.target===e.currentTarget){setSelected('');setResizeId(null);}}}
    ><span className="pointer-events-none absolute -top-5 left-0 text-[10px] font-bold text-[#c4ff40]/60">Área do mapa</span>
     {areas.map(a=>{
      const Icon=iconFor(a.icon||a.kind);const color=areaColor(a);const chosen=selected===a.id;
      return <div key={a.id} onPointerDown={e=>startDrag(e,a.id,'area')} onClick={e=>{e.stopPropagation();setSelected(a.id);}} title={a.description||a.name}
       className={'absolute flex min-h-0 flex-col items-center justify-center border-2 px-1 py-1 text-center '+(editing&&resizeId!==a.id?'cursor-move':'cursor-pointer')+(chosen?' z-[2]':' z-0')}
       style={{left:a.x+'%',top:a.y+'%',width:a.width+'%',height:a.height+'%',borderColor:chosen?'#c4ff40':color,backgroundColor:color+'33'}}>
       <Icon size={Math.max(13,Math.min(27,a.width/2+9))} style={{color}} className="pointer-events-none mb-1 shrink-0"/>
       <span className="pointer-events-none max-w-full overflow-hidden text-ellipsis text-[10px] font-black leading-tight sm:text-xs">{a.name}</span>
       {chosen&&!editing&&<button type="button" aria-label={'Redimensionar '+a.name} title="Redimensionar este ambiente"
        onPointerDown={e=>e.stopPropagation()}
        onClick={e=>{e.stopPropagation();setSelected(a.id);setEditLayout(true);setResizeId(a.id);}}
        className="absolute right-1 top-1 z-30 rounded-md border border-[#c4ff40]/60 bg-[#17101e] p-1.5 text-[#c4ff40] shadow-lg"><Maximize2 size={12}/></button>}
       {chosen&&editing&&resizeId===a.id&&(['left','right','top','bottom'] as const).map(edge=><button key={edge} type="button" aria-label={'Redimensionar borda '+edge}
        onPointerDown={e=>startDrag(e,a.id,'resize',edge)}
        className={'absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#17101e] bg-[#c4ff40] shadow-[0_0_0_1px_white] '+((edge==='left'||edge==='right')?'cursor-ew-resize':'cursor-ns-resize')}
        style={{left:edge==='left'?'0%':edge==='right'?'100%':'50%',top:edge==='top'?'0%':edge==='bottom'?'100%':'50%'}}/>)}
      </div>;
     })}
     {markers.map(m=>{
      const Icon=iconFor(m.type);const color=pointColor(m),size=limit(m.size||42,24,72),chosen=selected===m.id;
      return <button key={m.id} type="button" onPointerDown={e=>startDrag(e,m.id,'marker')} onClick={e=>{e.stopPropagation();setSelected(m.id);setResizeId(null);}}
       title={m.description||m.name}
       className={'absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center '+(editing?'cursor-move':'cursor-pointer')}
       style={{left:m.x+'%',top:m.y+'%'}}>
       <span className={'flex items-center justify-center border-2 shadow-lg '+(m.shape==='circle'?'rounded-full':'rounded-lg')+(chosen?' ring-2 ring-white/80':'')} style={{width:size,height:size,color,borderColor:color,backgroundColor:'#15101be8'}}><Icon size={Math.max(15,size*.5)}/></span>
       <span className="max-w-24 rounded bg-black/90 px-1.5 py-0.5 text-[10px] font-bold leading-tight">{m.name}</span>
      </button>;
     })}
    </div></div>}
    {(areasOutside>0||markersOutside>0)&&<p role="status" className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">{areasOutside} ambiente(s) e {markersOutside} ponto(s) na área externa. Podem ficar total ou parcialmente ocultos para participantes até serem reposicionados dentro do mapa.</p>}
    <div className="flex items-start gap-2 text-xs text-white/55"><Info size={15} className="mt-0.5 shrink-0 text-[#c4ff40]"/><p>{editing?'Arraste qualquer ambiente, inclusive para a área externa ao quadro, e depois encaixe novamente. Selecione o ambiente e clique em Redimensionar; bordas em comum alteram os dois ambientes.':'Selecione qualquer ambiente, inclusive os já salvos. Use Editar layout ou os botões do painel lateral para movê-lo ou redimensioná-lo.'}</p></div>
    <div className="grid gap-3 md:grid-cols-2">
     <div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Grid3X3 size={16} className="text-[#c4ff40]"/> Ambientes ({areas.length})</h3><div className="flex flex-wrap gap-2">{areas.map(a=><button key={a.id} onClick={()=>{setSelected(a.id);setResizeId(null);}} className={'rounded-lg border px-2.5 py-1.5 text-xs '+(selected===a.id?'border-[#c4ff40] text-[#c4ff40]':'border-white/15 text-white/70')}><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{backgroundColor:areaColor(a)}}/>{a.name}</button>)}{areas.length===0&&<p className="text-xs text-white/45">Nenhum ambiente cadastrado.</p>}</div></div>
     <div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><MapPin size={16} className="text-[#c4ff40]"/> Pontos ({markers.length})</h3><div className="flex flex-wrap gap-2">{markers.map(m=><button key={m.id} onClick={()=>{setSelected(m.id);setResizeId(null);}} className={'rounded-lg border px-2.5 py-1.5 text-xs '+(selected===m.id?'border-[#c4ff40] text-[#c4ff40]':'border-white/15 text-white/70')}>{m.name}</button>)}{markers.length===0&&<p className="text-xs text-white/45">Nenhum ponto cadastrado.</p>}</div></div>
    </div>
   </div>
   <aside className="min-w-0 space-y-4 self-start rounded-xl border border-white/10 bg-[#16111e] p-4">
    <div className="flex items-center justify-between gap-2"><h3 className="font-black">Editar item</h3>{(active||selectedMarker)&&<button onClick={removeSelected} aria-label="Excluir item" className="rounded-lg border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10"><Trash2 size={16}/></button>}</div>
    {active?<div className="space-y-4">
     <div className="flex items-center gap-2 rounded-xl border border-white/10 p-3"><span className="h-5 w-5 rounded" style={{backgroundColor:areaColor(active)}}/><div><p className="text-sm font-bold">{active.name}</p><p className="text-[11px] text-white/50">Ambiente · bordas compartilhadas</p></div></div>
     <label className="block space-y-1 text-xs text-white/65">Nome<input className={input} value={active.name} maxLength={100} onChange={e=>updateArea({name:e.target.value})}/></label>
     <label className="block space-y-1 text-xs text-white/65">Tipo e ícone<select className={input} value={active.icon||active.kind} onChange={e=>updateArea({kind:e.target.value,icon:e.target.value})}>{types.map(t=><option key={t} value={t}>{typeNames[t]}</option>)}</select></label>
     <div className="space-y-2 text-xs text-white/65">Cor{colorInput(areaColor(active),color=>updateArea({color}))}</div>
     <label className="block space-y-1 text-xs text-white/65">Descrição (opcional)<textarea className={input+' min-h-24 resize-y'} maxLength={500} value={active.description||''} onChange={e=>updateArea({description:e.target.value})} placeholder="Descreva este ambiente..."/></label>
     <div className="space-y-2 rounded-xl border border-[#c4ff40]/20 bg-[#c4ff40]/5 p-3">
      <p className="text-xs font-bold text-[#c4ff40]">Posição e tamanho</p>
      <button onClick={()=>{setEditLayout(true);setResizeId(null);}} aria-pressed={editing&&resizeId!==active.id} className={'w-full '+button+' '+(editing&&resizeId!==active.id?'border-[#c4ff40] bg-[#c4ff40]/15 text-[#c4ff40]':'')}><Move size={16}/> Mover este ambiente</button>
      <button onClick={activateResize} aria-pressed={resizeId===active.id&&editing} className={'w-full '+button+' '+(resizeId===active.id&&editing?'border-[#c4ff40] bg-[#c4ff40]/15 text-[#c4ff40]':'')}><Maximize2 size={16}/>{resizeId===active.id&&editing?'Concluir redimensionamento':'Redimensionar este ambiente'}</button>
      <p className="text-[11px] leading-relaxed text-white/50">Use esses botões a qualquer momento, mesmo depois de salvar. Arraste para fora do quadro enquanto reorganiza o mapa.</p>
     </div>
     <p className="text-[11px] text-white/45">Ao redimensionar uma borda compartilhada, o vizinho acompanha o ajuste. Arrastar o interior move somente o ambiente selecionado.</p>
     {areas.some(a=>a.id!==active.id&&sharesBorder(a,active))&&<p className="text-[11px] text-[#c4ff40]">Este ambiente compartilha bordas com outros.</p>}

    </div>:selectedMarker?<div className="space-y-4">
     <div className="flex items-center gap-2 rounded-xl border border-white/10 p-3"><MapPin size={21} style={{color:pointColor(selectedMarker)}}/><div><p className="text-sm font-bold">{selectedMarker.name}</p><p className="text-[11px] text-white/50">Ponto · sobreposto aos ambientes</p></div></div>
     <label className="block space-y-1 text-xs text-white/65">Nome<input className={input} maxLength={100} value={selectedMarker.name} onChange={e=>updateMarker({name:e.target.value})}/></label>
     <label className="block space-y-1 text-xs text-white/65">Ícone<select className={input} value={selectedMarker.type} onChange={e=>updateMarker({type:e.target.value})}>{types.map(t=><option key={t} value={t}>{typeNames[t]}</option>)}</select></label>
     <div className="space-y-2 text-xs text-white/65">Formato<div className="grid grid-cols-2 gap-2"><button onClick={()=>updateMarker({shape:'square'})} className={button+' '+(selectedMarker.shape!=='circle'?'border-[#c4ff40] text-[#c4ff40]':'')}><Square size={16}/> Quadrado</button><button onClick={()=>updateMarker({shape:'circle'})} className={button+' '+(selectedMarker.shape==='circle'?'border-[#c4ff40] text-[#c4ff40]':'')}><span className="h-4 w-4 rounded-full border-2 border-current"/> Redondo</button></div></div>
     <div className="space-y-2 text-xs text-white/65">Cor{colorInput(pointColor(selectedMarker),color=>updateMarker({color}))}</div>
     <label className="block space-y-2 text-xs text-white/65">Tamanho do ícone <span className="float-right">{selectedMarker.size||42}px</span><input aria-label="Tamanho do ponto" type="range" min="24" max="72" step="2" value={selectedMarker.size||42} onChange={e=>updateMarker({size:Number(e.target.value)})} className="w-full accent-[#c4ff40]"/></label>
     <label className="block space-y-1 text-xs text-white/65">Descrição (opcional)<textarea className={input+' min-h-24 resize-y'} maxLength={500} value={selectedMarker.description||''} onChange={e=>updateMarker({description:e.target.value})} placeholder="Informações úteis sobre este ponto..."/></label>
     {!editing&&<button onClick={()=>setEditLayout(true)} className={'w-full '+button}><Move size={16}/> Habilitar movimentação</button>}
    </div>:<div className="space-y-3 py-6 text-center text-sm text-white/50"><MousePointer2 size={28} className="mx-auto text-[#c4ff40]"/><p>Selecione um ambiente ou um ponto no mapa para editar nome, ícone, cor e descrição.</p><p className="text-xs">Pontos são independentes e ficam por cima dos ambientes.</p></div>}
   </aside>
  </div>
  {calibrationOpen&&<div role="dialog" aria-modal="true" aria-label="Calibrar mapa" className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/85 p-3"><div className="w-full max-w-xl space-y-4 rounded-2xl border border-[#c4ff40]/40 bg-[#17111d] p-4 shadow-2xl">
   <div className="flex items-center justify-between"><h3 className="text-lg font-black">Calibrar mapa inteiro</h3><button className={button} onClick={()=>setCalibrationOpen(false)}>Fechar</button></div>
   <p className="text-xs text-white/65">Vá fisicamente a cada canto do espaço. Toque em Registrar ponto para capturar seu GPS. Os quatro cantos são do mapa completo, não dos ambientes.</p>{calibrationArea?.gps?.mode==='demo-auto'&&<p role="status" className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">Calibração automática de demonstração ativa (grade estimada de {calibrationArea.gps.spacingMeters||10} m). Os quatro cantos foram calculados a partir de uma única leitura e não medidos no local. Ao registrar o primeiro canto manual, os quatro pontos estimados serão descartados para evitar misturar referências.</p>}
   <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/20 bg-[#0e0c14]" style={{backgroundImage:'linear-gradient(#ffffff12 1px,transparent 1px),linear-gradient(90deg,#ffffff12 1px,transparent 1px)',backgroundSize:'10% 10%'}}>
    {areas.map(a=><div key={a.id} className="absolute border-2 p-1 text-center text-[10px]" style={{left:a.x+'%',top:a.y+'%',width:a.width+'%',height:a.height+'%',borderColor:areaColor(a),backgroundColor:areaColor(a)+'22'}}>{a.name}</div>)}
    {([['tl','top-1 left-1'],['tr','top-1 right-1'],['bl','bottom-1 left-1'],['br','bottom-1 right-1']] as const).map(([key,pos],i)=><div key={key} className={'absolute z-10 rounded-full border px-2 py-1 text-xs font-bold '+pos+' '+(calibrationArea?.gps?.[key]?'border-[#c4ff40] bg-[#c4ff40] text-black':'border-purple-400 bg-[#21132d] text-white')}>{calibrationArea?.gps?.[key]?'✓':i+1}</div>)}
    {calibrationPosition&&<div className="absolute bottom-1/2 left-1/2 rounded bg-blue-500 px-2 py-1 text-[10px] font-bold">GPS capturado ±{Math.round(calibrationPosition.accuracy)} m</div>}
   </div>
   <div className="grid grid-cols-2 gap-2">{calibrationKeys.map((key,i)=><button key={key} disabled={calibrationBusy||!calibrationArea} onClick={()=>void capture(key)} className={button+' flex-col text-xs '+(calibrationArea?.gps?.[key]?'border-[#c4ff40] text-[#c4ff40]':'')}><span>{calibrationArea?.gps?.[key]?'✓ ':'○ '}{calibrationLabels[i]}</span><span className="text-[10px] opacity-65">{calibrationArea?.gps?.[key]?'Recalibrar · ±'+Math.round(calibrationArea.gps[key]?.accuracy??0)+' m':'Registrar ponto'}</span></button>)}</div>
   <p className="text-xs text-white/60">{calibrationKeys.filter(k=>calibrationArea?.gps?.[k]).length}/4 pontos calibrados. Após salvar, a localização será projetada usando esses quatro pontos. Confira sua posição na aba Mapa.</p>
   {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
   <button disabled={saving||dirty===false||!calibrationKeys.every(k=>calibrationArea?.gps?.[k])} onClick={async()=>{await save();setCalibrationOpen(false);}} className="w-full rounded-xl bg-[#c4ff40] p-3 font-bold text-black disabled:opacity-40">Salvar calibração global</button>
  </div></div>}
  {notice&&<p role="status" className="rounded-xl border border-[#c4ff40]/20 bg-[#c4ff40]/5 p-3 text-sm text-[#c4ff40]">{notice}</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
 </div>;
}
