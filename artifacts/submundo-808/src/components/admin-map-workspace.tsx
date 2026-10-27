import {useCallback,useEffect,useRef,useState} from 'react';
import PageLoading from './page-loading';
import {displayLabel} from './display-label';
import useMinimumLoading from './use-minimum-loading';
import {
 ArrowLeft,Plus,Save,Trash2,Move,MapPin,Pencil,Maximize2,Undo2,Redo2,
 Eye,MousePointer2,Square,RotateCcw,Info,Warehouse,Users,Music2,Crown,
 Utensils,Ticket,DoorOpen,Bath,Wine,Sofa,Stethoscope,Flag,Grid3X3
} from 'lucide-react';
import {freeAreaPosition,moveArea,resizeShared,sharesBorder,limit,type Edge} from './map-layout-geometry';
import {DEFAULT_MAP_FRAME,normalizeMapFrame,moveMapFrame,resizeMapFrame,mapFrameAspect,type MapFrame,type FrameHandle} from './map-frame-geometry';
import {anchorMarker,freeMarker,normalizeMarker,moveMarker,changeMarkerType,closestMapEdge,markerIconStyle,MAP_SIDES,type MapSide,type MarkerAnchor} from './map-marker-geometry';
import useMapLabels from './use-map-labels';
import {gpsToMap,distanceMeters,type MapCorners} from './map-location-utils';

type GPS={lat:number;lng:number;accuracy:number};
type GPSData=Partial<Record<'tl'|'tr'|'br'|'bl',GPS>> & {mode?:'manual'|'demo-auto';spacingMeters?:number;accuracyMeters?:number};
type Area={id:string;name:string;map_id:string;kind:string;x:number;y:number;width:number;height:number;gps:GPSData;description?:string;color?:string;icon?:string};
type Marker={id:string;name:string;type:string;x:number;y:number;anchor?:MarkerAnchor;description?:string;color?:string;shape?:'square'|'circle';size?:number;opens_at?:string;closes_at?:string;categories?:string[];from_area_id?:string;to_area_id?:string;access_type?:string};
type MapItem={id:string;name:string;venue_id:string};
type Snapshot={areas:Area[];markers:Marker[];frame:MapFrame};
type Drag={id:string;kind:'area'|'marker'|'resize'|'frame-move'|'frame-resize';edge?:Edge;frameHandle?:FrameHandle;startX:number;startY:number;offsetX:number;offsetY:number;snapshot:Snapshot;changed?:boolean};
const input='w-full rounded-xl border border-white/15 bg-[#1b1624] px-3 py-2.5 text-sm text-white outline-none focus:border-[#c4ff40]';
const button='inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-semibold transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-35';
const colors=['#9747FF','#3B82F6','#00BDD6','#A3E635','#FF9F43','#FF456C','#EAB308'];
const types=['principal','pista','palco','vip','backstage','recepcao','entrada','descanso','cozinha','alimentacao','bar','banheiro','saida','posto-medico','passagem','outro'];
const typeNames:Record<string,string>={principal:'Área principal',backstage:'Backstage',pista:'Pista',palco:'Palco',vip:'Área VIP',recepcao:'Recepção',entrada:'Entrada',descanso:'Área de descanso',cozinha:'Cozinha',alimentacao:'Alimentação',bar:'Bar',banheiro:'Banheiro',saida:'Saída','posto-medico':'Posto médico',passagem:'Passagem entre ambientes',outro:'Outro'};
const iconFor=(type:string)=>{
 const icons:Record<string,typeof MapPin>={principal:Music2,backstage:Warehouse,pista:Music2,palco:Warehouse,vip:Crown,recepcao:Users,entrada:DoorOpen,descanso:Sofa,cozinha:Utensils,alimentacao:Utensils,bar:Wine,banheiro:Bath,saida:Flag,'posto-medico':Stethoscope,passagem:DoorOpen,outro:MapPin};
 return icons[type]||MapPin;
};
const areaColor=(a:Area)=>/^#[0-9a-fA-F]{6}$/.test(a.color||'')?a.color!:'#9747FF';
const pointColor=(p:Marker)=>/^#[0-9a-fA-F]{6}$/.test(p.color||'')?p.color!:'#C4FF40';
async function api(route:string,payload?:object){
 const r=await fetch('/api/admin/'+route,{method:payload?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});
 const j=await r.json();if(!r.ok)throw Error(j.error||'Erro ao carregar o mapa');return j;
}
// Locate overlapping shared edges without introducing gaps in the stored room layout.
function sharedEdges(areas:Area[]){
 const edges:{a:Area;b:Area;x:number;y:number;vertical:boolean}[]=[];
 for(let i=0;i<areas.length;i++)for(let j=i+1;j<areas.length;j++){
  const a=areas[i],b=areas[j],eps=.05;
  const y1=Math.max(a.y,b.y),y2=Math.min(a.y+a.height,b.y+b.height);
  const x1=Math.max(a.x,b.x),x2=Math.min(a.x+a.width,b.x+b.width);
  if(y2-y1>=8&&(Math.abs(a.x+a.width-b.x)<eps||Math.abs(b.x+b.width-a.x)<eps))
   edges.push({a,b,x:Math.abs(a.x+a.width-b.x)<eps?b.x:a.x,y:(y1+y2)/2,vertical:true});
  if(x2-x1>=8&&(Math.abs(a.y+a.height-b.y)<eps||Math.abs(b.y+b.height-a.y)<eps))
   edges.push({a,b,x:(x1+x2)/2,y:Math.abs(a.y+a.height-b.y)<eps?b.y:a.y,vertical:false});
 }
 return edges;
}
export default function AdminMapWorkspace({map,onBack}:{map:MapItem;onBack:()=>void}){
 const [mapName,setMapName]=useState(map.name),[nameSaving,setNameSaving]=useState(false),[renameOpen,setRenameOpen]=useState(false);
 const [areas,setAreas]=useState<Area[]>([]),[markers,setMarkers]=useState<Marker[]>([]);
 const [catalogCategories,setCatalogCategories]=useState<string[]>([]);
 const [frame,setFrame]=useState<MapFrame>({...DEFAULT_MAP_FRAME}),[frameEditing,setFrameEditing]=useState(false);
 const [selected,setSelected]=useState(''),[editLayout,setEditLayout]=useState(false),[resizeId,setResizeId]=useState<string|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[initialLoadError,setInitialLoadError]=useState(false),[saving,setSaving]=useState(false),[dirty,setDirty]=useState(false);
 const [calibrationOpen,setCalibrationOpen]=useState(false);const [calibrationBusy,setCalibrationBusy]=useState(false);const [calibrationPosition,setCalibrationPosition]=useState<GPS|null>(null);
 const [gpsLive,setGpsLive]=useState<GPS|null>(null),[gpsStatus,setGpsStatus]=useState(''),[expectedWidth,setExpectedWidth]=useState(''),[expectedLength,setExpectedLength]=useState(''),[walkPoints,setWalkPoints]=useState<GPS[]>([]),[walkTesting,setWalkTesting]=useState(false),[showCalibrationConfirm,setShowCalibrationConfirm]=useState(false);
 const gpsWatch=useRef<number|null>(null),walkActive=useRef(false);
 const [pendingDelete,setPendingDelete]=useState<{id:string;name:string;kind:'area'|'marker'}|null>(null);
 const calibrationArea=areas.find(a=>(['tl','tr','br','bl'] as const).some(k=>a.gps?.[k]))||areas[0];
 const calibrationKeys=['tl','tr','bl','br'] as const;
 const calibrationLabels=['Superior esquerdo','Superior direito','Inferior esquerdo','Inferior direito'];
 const corners=calibrationArea?.gps;
 const ready=!!(corners?.tl&&corners?.tr&&corners?.bl&&corners?.br);
 const distances=ready?{
  top:distanceMeters(corners!.tl!,corners!.tr!),bottom:distanceMeters(corners!.bl!,corners!.br!),
  left:distanceMeters(corners!.tl!,corners!.bl!),right:distanceMeters(corners!.tr!,corners!.br!)
 }:null;
 const averageWidth=distances?(distances.top+distances.bottom)/2:0;
 const averageLength=distances?(distances.left+distances.right)/2:0;
 const geo=(p:GPS)=>({x:p.lng*111320*Math.cos(p.lat*Math.PI/180),y:-p.lat*111320});
 const cross=(a:GPS,b:GPS,c:GPS)=>{const x=geo(a),y=geo(b),z=geo(c);return(y.x-x.x)*(z.y-x.y)-(y.y-x.y)*(z.x-x.x);};
 const geometryValid=!!(ready&&corners&&
  cross(corners.tl!,corners.tr!,corners.br!)*cross(corners.tr!,corners.br!,corners.bl!)>0&&
  cross(corners.tr!,corners.br!,corners.bl!)*cross(corners.br!,corners.bl!,corners.tl!)>0&&
  cross(corners.br!,corners.bl!,corners.tl!)*cross(corners.bl!,corners.tl!,corners.tr!)>0);
 const accuracyMax=ready?Math.max(...(['tl','tr','bl','br'] as const).map(k=>corners?.[k]?.accuracy||999)):0;
 const accuracyReasonable=ready&&Math.min(averageWidth,averageLength)>accuracyMax*2;
 const widthExpected=Number(expectedWidth.replace(',','.')),lengthExpected=Number(expectedLength.replace(',','.'));
 const expectationsValid=widthExpected>0&&lengthExpected>0&&Number.isFinite(widthExpected)&&Number.isFinite(lengthExpected);
 const relativeError=(measured:number,expected:number)=>Math.abs(measured-expected)/expected;
 const measurementsMatch=!!(expectationsValid&&distances&&relativeError(averageWidth,widthExpected)<=.25&&relativeError(averageLength,lengthExpected)<=.25);
 const qualityOK=geometryValid&&accuracyReasonable&&measurementsMatch;
 const projectedLive=ready&&gpsLive?gpsToMap(gpsLive,corners as MapCorners):null;
 const projectedWalk=ready?walkPoints.map(p=>gpsToMap(p,corners as MapCorners)).filter((x):x is NonNullable<typeof x>=>!!x):[];
 
 const [history,setHistory]=useState<Snapshot[]>([]),[future,setFuture]=useState<Snapshot[]>([]),[snap,setSnap]=useState(true);
 const canvas=useRef<HTMLDivElement>(null),pasteboard=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null);
 const {labels:roomLabels,pointLabels,setMapElement}=useMapLabels(areas,markers);
 const setCanvasRef=useCallback((element:HTMLDivElement|null)=>{canvas.current=element;setMapElement(element);},[setMapElement]);
 const active=areas.find(a=>a.id===selected);
 const selectedMarker=markers.find(m=>m.id===selected);
 const editing=editLayout;
 const passages=sharedEdges(areas);
 const areasOutside=areas.filter(a=>a.x<0||a.y<0||a.x+a.width>100||a.y+a.height>100).length;
 const markersOutside=markers.filter(m=>m.x<0||m.y<0||m.x>100||m.y>100).length;
 useEffect(()=>{
  let alive=true;setLoading(true);setInitialLoadError(false);
  Promise.all([api('areas'),api('markers?map_id='+encodeURIComponent(map.id)),api('maps'),api('products')]).then(([a,m,maps,products])=>{
   if(!alive)return;setAreas(a.items.filter((x:Area)=>x.map_id===map.id));setMarkers(m.items.map(normalizeMarker));
   setFrame(normalizeMapFrame(maps.items.find((item:MapItem)=>item.id===map.id)?.frame));
   setCatalogCategories([...new Set((products.items as {category:string}[]).map(p=>p.category.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')));
   setFrameEditing(false);setDirty(false);setHistory([]);setFuture([]);
  }).catch(e=>{if(alive){setError(String(e));setInitialLoadError(true);}}).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[map.id]);
 useEffect(()=>{
  if(!calibrationOpen){if(gpsWatch.current!==null){navigator.geolocation.clearWatch(gpsWatch.current);gpsWatch.current=null;}walkActive.current=false;setWalkTesting(false);return;}
  if(!navigator.geolocation){setGpsStatus('Este dispositivo não disponibiliza GPS.');return;}
  setGpsStatus('Aguardando GPS. Permita a localização quando solicitado.');
  gpsWatch.current=navigator.geolocation.watchPosition(
   p=>{const fix={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy};
    setGpsLive(fix);setGpsStatus('Localização atualizada · precisão ±'+Math.round(fix.accuracy)+' m');
    if(walkActive.current)setWalkPoints(v=>[...v.slice(-399),fix]);},
   e=>setGpsStatus('Não foi possível acompanhar sua localização: '+e.message),
   {enableHighAccuracy:true,maximumAge:0,timeout:20000});
  return()=>{if(gpsWatch.current!==null)navigator.geolocation.clearWatch(gpsWatch.current);gpsWatch.current=null;walkActive.current=false;};
 },[calibrationOpen]);
 
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(!dirty)return;e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 useEffect(()=>{
  const onKeyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&pendingDelete){event.preventDefault();event.stopPropagation();setPendingDelete(null);return;}
   if(event.key==='Escape'&&calibrationOpen){
    event.preventDefault();event.stopPropagation();setCalibrationOpen(false);return;
   }
   if(pendingDelete)return;
   if(!(event.ctrlKey||event.metaKey)||event.altKey||drag.current)return;
   const target=event.target as HTMLElement|null;
   if(target?.closest('input,textarea,select,[contenteditable="true"]'))return;
   const key=event.key.toLowerCase();
   const doUndo=key==='z'&&!event.shiftKey;
   const doRedo=(key==='z'&&event.shiftKey)||key==='y';
   if(doUndo&&history.length){event.preventDefault();undo();}
   else if(doRedo&&future.length){event.preventDefault();redo();}
  };
  window.addEventListener('keydown',onKeyboard);
  return()=>window.removeEventListener('keydown',onKeyboard);
 },[calibrationOpen,pendingDelete,history,future,areas,markers,frame]);

 function checkpoint(){setHistory(v=>[...v.slice(-39),{areas,markers,frame}]);setFuture([]);setDirty(true);setNotice('');}
 function undo(){if(!history.length)return;const previous=history[history.length-1];setFuture(v=>[...v,{areas,markers,frame}]);setHistory(v=>v.slice(0,-1));setAreas(previous.areas);setMarkers(previous.markers);setFrame(previous.frame);setDirty(true);setResizeId(null);}
 function redo(){if(!future.length)return;const next=future[future.length-1];setHistory(v=>[...v,{areas,markers,frame}]);setFuture(v=>v.slice(0,-1));setAreas(next.areas);setMarkers(next.markers);setFrame(next.frame);setDirty(true);setResizeId(null);}
 function updateArea(patch:Partial<Area>){if(!active)return;checkpoint();setAreas(v=>v.map(a=>a.id===active.id?{...a,...patch}:a));}
 function updateMarker(patch:Partial<Marker>){if(!selectedMarker)return;checkpoint();setMarkers(v=>v.map(m=>m.id===selectedMarker.id?{...m,...patch}:m));}
 function createArea(){
  const p=freeAreaPosition(areas);
  if(!p){setError('Não há espaço livre para um novo ambiente. Ajuste as divisórias antes de adicionar.');return;}
  checkpoint();setError('');
  const id=crypto.randomUUID();
  setAreas(v=>[...v,{id,map_id:map.id,name:'Novo ambiente',kind:'outro',...p,gps:{},icon:'outro',color:'#9747FF',description:''}]);
  setSelected(id);setEditLayout(false);setFrameEditing(false);setResizeId(null);setNotice('Selecione Mover ou Redimensionar para ajustar o ambiente.');
 }
 function createPassage(a:Area,b:Area,x:number,y:number){
  checkpoint();const id=crypto.randomUUID();
  setMarkers(v=>[...v,{id,name:'Passagem '+a.name+' / '+b.name,type:'passagem',x,y,from_area_id:a.id,to_area_id:b.id,access_type:'livre',shape:'square',size:30,color:'#C4FF40',description:''}]);
  setSelected(id);setEditLayout(false);setResizeId(null);setFrameEditing(false);setNotice('Passagem criada sobre a divisão. Ajuste o tipo de acesso e salve o mapa.');
 }
 function createMarker(){
  checkpoint();const id=crypto.randomUUID();
  const x=active?active.x+active.width/2:50,y=active?active.y+active.height/2:50;
  setMarkers(v=>[...v,{id,name:'Novo ponto',type:'outro',x,y,shape:'square',size:42,color:'#C4FF40',description:''}]);
  setSelected(id);setEditLayout(false);setFrameEditing(false);setResizeId(null);setNotice('Ponto criado. Ative a movimentação antes de arrastar.');
 }
 function removeSelected(){
  const item=active?{id:active.id,name:active.name,kind:'area' as const}:selectedMarker?{id:selectedMarker.id,name:selectedMarker.name,kind:'marker' as const}:null;
  if(item)setPendingDelete(item);
 }
 function confirmDelete(){
  if(!pendingDelete)return;
  const item=pendingDelete;
  if((item.kind==='area'&&!areas.some(a=>a.id===item.id))||(item.kind==='marker'&&!markers.some(m=>m.id===item.id))){setPendingDelete(null);return;}
  checkpoint();
  if(item.kind==='area')setAreas(v=>v.filter(a=>a.id!==item.id));
  else setMarkers(v=>v.filter(m=>m.id!==item.id));
  setSelected('');setResizeId(null);setPendingDelete(null);
  setNotice('Item removido do editor. Salve o mapa para confirmar a exclusão.');
 }
 function coord(e:React.PointerEvent){
  const rect=canvas.current?.getBoundingClientRect();if(!rect||!rect.width||!rect.height)return null;
  return {x:(e.clientX-rect.left)/rect.width*100,y:(e.clientY-rect.top)/rect.height*100};
 }
 function startDrag(e:React.PointerEvent,id:string,kind:Drag['kind'],edge?:Edge){
  e.stopPropagation();if(selected!==id){setSelected(id);setEditLayout(false);setResizeId(null);return;}
  if(!editing)return;
  if(kind==='area'&&resizeId===id)return;
  if(kind==='resize'&&resizeId!==id)return;
  const p=coord(e);if(!p||frameEditing)return;
  const item=kind==='marker'?markers.find(m=>m.id===id):areas.find(a=>a.id===id);if(!item)return;
  e.preventDefault();
  drag.current={id,kind,edge,startX:p.x,startY:p.y,offsetX:p.x-item.x,offsetY:p.y-item.y,snapshot:{areas,markers,frame}};
  pasteboard.current?.setPointerCapture(e.pointerId);
 }
 function pasteboardCoord(e:React.PointerEvent){
  const rect=pasteboard.current?.getBoundingClientRect();if(!rect?.width||!rect.height)return null;
  return {x:(e.clientX-rect.left)/rect.width*100,y:(e.clientY-rect.top)/rect.height*100};
 }
 function startFrameDrag(e:React.PointerEvent,kind:'frame-move'|'frame-resize',handle?:FrameHandle){
  e.stopPropagation();
  if(!editing||!frameEditing)return;
  const p=pasteboardCoord(e);if(!p)return;
  e.preventDefault();setSelected('');setResizeId(null);
  drag.current={id:'map-frame',kind,frameHandle:handle,startX:p.x,startY:p.y,offsetX:0,offsetY:0,snapshot:{areas,markers,frame}};
  pasteboard.current?.setPointerCapture(e.pointerId);
 }
 function move(e:React.PointerEvent){
  const d=drag.current;if(!d)return;
  const p=d.kind==='frame-move'||d.kind==='frame-resize'?pasteboardCoord(e):coord(e);if(!p)return;
  if(!d.changed){
   if(Math.abs(p.x-d.startX)+Math.abs(p.y-d.startY)<.3)return;
   checkpoint();d.changed=true;
  }
  if(d.kind==='frame-move')setFrame(moveMapFrame(d.snapshot.frame,p.x-d.startX,p.y-d.startY));
  else if(d.kind==='frame-resize'&&d.frameHandle)setFrame(resizeMapFrame(d.snapshot.frame,d.frameHandle,p.x-d.startX,p.y-d.startY));
  else if(d.kind==='marker')setMarkers(d.snapshot.markers.map(m=>{
   if(m.id!==d.id)return m;
   const x=p.x-d.offsetX,y=p.y-d.offsetY;
   if(m.type!=='passagem'||!m.from_area_id||!m.to_area_id)return moveMarker(m,x,y);
   const a=d.snapshot.areas.find(area=>area.id===m.from_area_id);
   const b=d.snapshot.areas.find(area=>area.id===m.to_area_id);
   if(!a||!b)return m; // Never release a passage into free movement.
   const margin=.05;
   const horizontal=Math.abs(a.y+a.height-b.y)<margin||Math.abs(b.y+b.height-a.y)<margin;
   const vertical=Math.abs(a.x+a.width-b.x)<margin||Math.abs(b.x+b.width-a.x)<margin;
   if(horizontal){
    const low=Math.max(a.x,b.x),high=Math.min(a.x+a.width,b.x+b.width);
    if(high<=low)return m;
    return {...m,x:Math.max(low,Math.min(high,x)),y:Math.abs(a.y+a.height-b.y)<margin?b.y:a.y};
   }
   if(vertical){
    const low=Math.max(a.y,b.y),high=Math.min(a.y+a.height,b.y+b.height);
    if(high<=low)return m;
    return {...m,x:Math.abs(a.x+a.width-b.x)<margin?b.x:a.x,y:Math.max(low,Math.min(high,y))};
   }
   return m;
  }));
  else if(d.kind==='resize'&&d.edge){
   const delta=d.edge==='left'||d.edge==='right'?p.x-d.startX:p.y-d.startY;
   setAreas(resizeShared(d.snapshot.areas,d.id,d.edge,delta,snap));
  }else{
   setAreas(moveArea(d.snapshot.areas,d.id,p.x-d.offsetX,p.y-d.offsetY,snap));
  }
 }
 function endDrag(e:React.PointerEvent){
  if(drag.current){drag.current=null;if(pasteboard.current?.hasPointerCapture(e.pointerId))pasteboard.current.releasePointerCapture(e.pointerId);}
 }
 async function save(){
  if(saving)return;setSaving(true);setError('');
  try{
   await api('save-layout',{map_id:map.id,areas,markers,frame});
   setDirty(false);setHistory([]);setFuture([]);setNotice('Mapa salvo com sucesso. Ambientes, pontos e área externa publicados.');setEditLayout(false);setFrameEditing(false);setResizeId(null);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar o mapa.');}
  finally{setSaving(false);}
 }
 function requestCalibrationSave(){
  if(!ready){setError('Registre os quatro cantos antes de salvar.');return;}
  setShowCalibrationConfirm(true);
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
   const [a,m,maps]=await Promise.all([api('areas'),api('markers?map_id='+encodeURIComponent(map.id)),api('maps')]);
   setAreas(a.items.filter((x:Area)=>x.map_id===map.id));setMarkers(m.items.map(normalizeMarker));
   setFrame(normalizeMapFrame(maps.items.find((item:MapItem)=>item.id===map.id)?.frame));setFrameEditing(false);
   setDirty(false);setHistory([]);setFuture([]);setResizeId(null);setSelected('');setEditLayout(false);setNotice('Alterações descartadas.');
  }catch(e){setError(String(e));}finally{setLoading(false);}
 }
 function back(){if(dirty&&!window.confirm('Há alterações não salvas. Sair e descartar essas alterações?'))return;onBack();}
 function activateResize(){
  if(!active)return;setFrameEditing(false);if(editing&&resizeId===active.id){setEditLayout(false);setResizeId(null);}else{setEditLayout(true);setResizeId(active.id);}
 }
 const colorInput=(value:string,apply:(color:string)=>void)=><div className="flex flex-wrap items-center gap-2">{colors.map(c=><button key={c} type="button" aria-label={'Cor '+c} onClick={()=>apply(c)} className={'h-7 w-7 rounded-full border-2 '+(value.toLowerCase()===c.toLowerCase()?'border-white ring-2 ring-white/30':'border-transparent')} style={{backgroundColor:c}}/>)}<input aria-label="Escolher cor personalizada" type="color" value={/^#[0-9a-fA-F]{6}$/.test(value)?value:'#9747FF'} onChange={e=>apply(e.target.value)} className="h-8 w-9 cursor-pointer bg-transparent"/></div>;
 const showLoading=useMinimumLoading(loading);
 if(showLoading)return <div className="space-y-4"><button onClick={back} className="flex items-center gap-2 text-sm text-white/60"><ArrowLeft size={16}/> Voltar aos mapas</button><PageLoading label="Carregando editor de mapas" description="Carregando ambientes, pontos e calibração antes de abrir o editor."/></div>;
 if(initialLoadError)return <div role="alert" className="rounded-2xl border border-red-400/25 bg-red-400/5 p-6 text-center"><p className="font-bold text-red-200">Não foi possível carregar o mapa.</p><p className="mt-2 text-sm text-white/60">{error}</p><button onClick={()=>window.location.reload()} className="mt-4 rounded-xl bg-[#c4ff40] px-4 py-2 font-bold text-black">Tentar novamente</button><button onClick={back} className="ml-3 rounded-xl border border-white/15 px-4 py-2 text-white">Voltar</button></div>;
 return <div className="space-y-5">

  <button onClick={back} className="flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft size={16}/> Voltar aos mapas</button>
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-xs uppercase tracking-widest text-[#c4ff40]">Editor do mapa</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">{displayLabel(mapName)}</h2><p className="mt-1 text-xs text-white/50">{dirty?'● Alterações não salvas':'Mapa salvo'} · {editing?'Modo edição ativo':'Modo de visualização'} · Área externa disponível para organizar</p></div>
   <div className="flex flex-wrap gap-2"><button disabled={!dirty||saving} onClick={()=>void discard()} className={button}>Descartar</button><button disabled={saving||loading||!dirty} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-black text-black disabled:opacity-40"><Save size={16}/>{saving?'Salvando...':'Salvar mapa'}</button></div>
  </div>
  <div className="rounded-xl border border-white/10 bg-white/[.035]">
  <div className="flex flex-wrap items-center gap-2 p-2">
   <button type="button" onClick={()=>setRenameOpen(v=>!v)} aria-expanded={renameOpen} className={button+' '+(renameOpen?'border-[#c4ff40] text-[#c4ff40]':'')}><Pencil size={16}/> Renomear planta</button>
   <button onClick={createArea} className={button}><Plus size={16}/> Ambiente</button>
   <button onClick={createMarker} className={button}><MapPin size={16}/> Ponto</button>
   <button onClick={()=>{setEditLayout(!frameEditing);setFrameEditing(v=>!v);setResizeId(null);setSelected('');}} aria-pressed={editing&&frameEditing} className={button+' '+(editing&&frameEditing?'border-[#c4ff40] bg-[#c4ff40]/15 text-[#c4ff40]':'')}><Maximize2 size={16}/>{editing&&frameEditing?'Concluir área do mapa':'Editar área do mapa'}</button>
   <button onClick={()=>setCalibrationOpen(true)} className={button+" border-[#c4ff40]/50 text-[#c4ff40]"}><MapPin size={16}/> Calibrar mapa</button>
   <button disabled={!history.length} onClick={undo} title="Desfazer (Ctrl/Cmd+Z)" aria-label="Desfazer" className={button}><Undo2 size={17}/></button>
   <button disabled={!future.length} onClick={redo} title="Refazer (Ctrl/Cmd+Shift+Z)" aria-label="Refazer" className={button}><Redo2 size={17}/></button>
   <label className="ml-auto flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-white/65"><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)} className="accent-[#c4ff40]"/> Encaixar bordas</label>
  </div>
  {renameOpen&&  <form onSubmit={async event=>{event.preventDefault();const name=mapName.trim();if(!name||nameSaving)return;setNameSaving(true);setError('');setNotice('');try{await api('edit-map',{id:map.id,venue_id:map.venue_id,name});setNotice('Nome da planta atualizado.');setRenameOpen(false);}catch(e){setError(e instanceof Error?e.message:'Erro ao alterar nome.');}finally{setNameSaving(false);}}} className="flex flex-wrap items-end gap-3 border-t border-white/10 p-3">
   <label className="min-w-0 flex-1 space-y-1 text-xs text-white/60">Nome da planta<input maxLength={100} required value={mapName} onChange={e=>setMapName(e.target.value)} className={input}/></label>
   <button type="submit" disabled={nameSaving||!mapName.trim()||mapName.trim()===map.name&&notice==='Nome da planta atualizado.'} className="rounded-xl bg-[#c4ff40] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">{nameSaving?'Salvando...':'Salvar nome'}</button>
  </form>
  }
  </div>
  <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
   <div className="min-w-0 space-y-3">
    {loading?<p className="rounded-xl border border-white/10 p-6 text-white/60">Carregando ambientes...</p>:<div
      ref={pasteboard} onPointerMove={move} onPointerUp={endDrag} onPointerCancel={endDrag}
      className="relative aspect-[4/3] w-full select-none overflow-visible rounded-xl border border-white/20 bg-[#0f0d16]"
      style={{backgroundImage:'linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px)',backgroundSize:'4% 4%'}}
     >
      {active&&!frameEditing&&<div className="absolute right-3 top-3 z-[60] flex max-w-[calc(100%-24px)] flex-wrap gap-2 rounded-xl border border-[#c4ff40]/30 bg-[#17111e]/95 p-2 shadow-xl backdrop-blur">
       <button type="button" title="Mover ambiente selecionado" aria-label="Mover ambiente selecionado" aria-pressed={editing&&resizeId!==active.id} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();if(editing&&resizeId!==active.id){setEditLayout(false);setResizeId(null);}else{setEditLayout(true);setResizeId(null);}}} className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold '+(editing&&resizeId!==active.id?'border-[#c4ff40] bg-[#c4ff40]/15 text-[#c4ff40]':'border-white/20 text-white')}><Move size={15}/> {editing&&resizeId!==active.id?'Concluir':'Mover'}</button>
       <button type="button" title="Redimensionar ambiente selecionado" aria-label="Redimensionar ambiente selecionado" aria-pressed={editing&&resizeId===active.id} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();activateResize();}} className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold '+(editing&&resizeId===active.id?'border-[#c4ff40] bg-[#c4ff40]/15 text-[#c4ff40]':'border-white/20 text-white')}><Maximize2 size={15}/> {editing&&resizeId===active.id?'Concluir':'Redimensionar'}</button>
      </div>}
      {selectedMarker&&!frameEditing&&<div className="absolute right-3 top-3 z-[60] flex max-w-[calc(100%-24px)] flex-wrap items-center gap-2 rounded-xl border border-[#c4ff40]/30 bg-[#17111e]/95 p-2 shadow-xl backdrop-blur">
       <span className="max-w-28 truncate text-xs text-white/75">{selectedMarker.name}</span>
       <button type="button" title="Mover ponto selecionado" aria-label={editing?'Concluir movimentação do ponto':'Mover ponto selecionado'} aria-pressed={editing} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setEditLayout(v=>!v);setResizeId(null);}} className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold '+(editing?'border-[#c4ff40] bg-[#c4ff40]/15 text-[#c4ff40]':'border-white/20 text-white')}><Move size={15}/>{editing?'Concluir':'Mover'}</button>
      </div>}
     <div ref={setCanvasRef}
      className={'absolute border-2 border-dashed bg-[#23132e]/40 '+(editing?'touch-none ':'')+(frameEditing?'cursor-move border-[#c4ff40]':'border-[#c4ff40]/30')}
      style={{left:frame.x+'%',top:frame.y+'%',width:frame.width+'%',height:frame.height+'%',backgroundImage:'linear-gradient(#ffffff12 1px,transparent 1px),linear-gradient(90deg,#ffffff12 1px,transparent 1px)',backgroundSize:'10% 10%',touchAction:editing?'none':'auto'}}
      onPointerDown={e=>{if(e.target!==e.currentTarget)return;if(editing&&frameEditing)startFrameDrag(e,'frame-move');else{setSelected('');setResizeId(null);setEditLayout(false);}}}
     ><span className="pointer-events-none absolute -top-5 left-0 text-[10px] font-bold text-[#c4ff40]/80">Área do mapa</span>
      {editing&&frameEditing&&<>
       <button type="button" onPointerDown={e=>startFrameDrag(e,'frame-move')} className="absolute left-2 top-2 z-40 flex touch-none items-center gap-1 rounded-lg border border-[#c4ff40]/50 bg-[#191321] px-2 py-1 text-[11px] font-bold text-[#c4ff40]"><Move size={13}/> Mover área</button>
       {([
        ['tl','0%','0%'],['top','50%','0%'],['tr','100%','0%'],
        ['left','0%','50%'],['right','100%','50%'],
        ['bl','0%','100%'],['bottom','50%','100%'],['br','100%','100%']
       ] as const).map(([handle,left,top])=><button key={handle} type="button"
        aria-label={'Redimensionar limite '+handle} title={'Redimensionar limite '+handle}
        onPointerDown={e=>startFrameDrag(e,'frame-resize',handle)}
        className={'absolute z-50 h-4 w-4 touch-none -translate-x-1/2 -translate-y-1/2 rounded border-2 border-[#17101e] bg-[#c4ff40] shadow-[0_0_0_1px_white] '+(handle==='left'||handle==='right'?'cursor-ew-resize':handle==='top'||handle==='bottom'?'cursor-ns-resize':handle==='tl'||handle==='br'?'cursor-nwse-resize':'cursor-nesw-resize')}
        style={{left,top}}/>)}
      </>}
     {!frameEditing&&passages.map(edge=>{const already=markers.some(m=>m.type==='passagem'&&((m.from_area_id===edge.a.id&&m.to_area_id===edge.b.id)||(m.from_area_id===edge.b.id&&m.to_area_id===edge.a.id))&&Math.hypot(m.x-edge.x,m.y-edge.y)<7);return already?null:<button type="button" key={edge.a.id+'-'+edge.b.id} title={'Adicionar passagem entre '+edge.a.name+' e '+edge.b.name} aria-label={'Adicionar passagem entre '+edge.a.name+' e '+edge.b.name} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();createPassage(edge.a,edge.b,edge.x,edge.y);}} className="group absolute z-[25] flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full border border-[#c4ff40]/65 bg-[#17111e]/95 text-lg font-semibold text-[#c4ff40] opacity-75 shadow-lg transition hover:scale-110 hover:opacity-100 focus:opacity-100 sm:opacity-30 sm:hover:opacity-100" style={{left:edge.x+'%',top:edge.y+'%'}}><Plus size={18}/></button>})}
     {areas.map(a=>{
      const Icon=iconFor(a.icon||a.kind);const color=areaColor(a);const chosen=selected===a.id;
      return <div key={a.id} onPointerDown={e=>startDrag(e,a.id,'area')} onClick={e=>{e.stopPropagation();if(selected!==a.id){setEditLayout(false);setResizeId(null);}setSelected(a.id);}} title={a.description||a.name}
       className={'absolute flex min-h-0 flex-col items-center justify-center border-2 px-1 py-1 text-center '+(frameEditing?'pointer-events-none ':'')+(editing&&resizeId!==a.id?'cursor-move':'cursor-pointer')+(chosen?' z-[2]':' z-0')}
       style={{left:a.x+'%',top:a.y+'%',width:a.width+'%',height:a.height+'%',borderColor:chosen?'#c4ff40':color,backgroundColor:color+'33'}}>
       <span className="sr-only">{a.name}</span>
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
     {roomLabels.map(label=>{
       const room=areas.find(area=>area.id===label.id);
       if(!room)return null;
       const Icon=iconFor(room.icon||room.kind);
       return <div key={'label-'+label.id}
        className="pointer-events-none absolute z-[5] flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-md border border-white/15 bg-[#100d18]/90 px-2 py-1 text-center text-[11px] font-bold text-white shadow-sm"
        style={{left:label.x+'%',top:label.y+'%',maxWidth:Math.max(room.width,10)+'%'}}>
        <Icon size={13} className="shrink-0" style={{color:areaColor(room)}}/>
        <span className="truncate">{room.name}</span>
       </div>;
      })}
      {markers.map(m=>{
      const Icon=iconFor(m.type);const color=pointColor(m),size=limit(m.size||42,24,72),chosen=selected===m.id;
      return <button key={m.id} type="button" onPointerDown={e=>startDrag(e,m.id,'marker')} onClick={e=>{e.stopPropagation();if(selected!==m.id)setEditLayout(false);setSelected(m.id);setResizeId(null);}}
       title={m.description||m.name}
       className={'z-10 text-center '+(frameEditing?'pointer-events-none ':'')+(editing?'cursor-move':'cursor-pointer')}
       style={markerIconStyle(m,size)}>
       <span className={'flex h-full w-full items-center justify-center border-2 shadow-lg '+(m.shape==='circle'?'rounded-full':'rounded-lg')+(chosen?' ring-2 ring-white/80':'')} style={{color,borderColor:color,backgroundColor:'#15101be8'}}><Icon size={Math.max(15,size*.5)}/></span>

      </button>;
     })}
     {pointLabels.filter(label=>label.visible).map(label=>{const m=markers[label.index];if(!m)return null;return <span key={'point-label-'+m.id} className="pointer-events-none absolute z-[19] max-w-[116px] -translate-x-1/2 -translate-y-1/2 truncate whitespace-nowrap rounded border border-white/10 bg-black/90 px-1.5 py-1 text-center text-[10px] font-bold text-white" style={{left:label.x+'%',top:label.y+'%'}}>{m.name}</span>;})}
    </div></div>}
    {(areasOutside>0||markersOutside>0)&&<p role="status" className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">{areasOutside} ambiente(s) e {markersOutside} ponto(s) na área externa. Podem ficar total ou parcialmente ocultos para participantes até serem reposicionados dentro do mapa.</p>}
    <div className="flex items-start gap-2 text-xs text-white/55"><Info size={15} className="mt-0.5 shrink-0 text-[#c4ff40]"/><p>{editing?'Arraste qualquer ambiente, inclusive para a área externa ao quadro, e depois encaixe novamente. Selecione o ambiente e clique em Redimensionar; bordas em comum alteram os dois ambientes.':'Selecione qualquer ambiente, inclusive os já salvos. Use Editar layout ou os botões do painel lateral para movê-lo ou redimensioná-lo.'}</p></div>
    <div className="grid gap-3 md:grid-cols-2">
     <div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Grid3X3 size={16} className="text-[#c4ff40]"/> Ambientes ({areas.length})</h3><div className="flex flex-wrap gap-2">{areas.map(a=><button key={a.id} onClick={()=>{setSelected(a.id);setResizeId(null);setEditLayout(false);setFrameEditing(false);}} className={'rounded-lg border px-2.5 py-1.5 text-xs '+(selected===a.id?'border-[#c4ff40] text-[#c4ff40]':'border-white/15 text-white/70')}><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{backgroundColor:areaColor(a)}}/>{a.name}</button>)}{areas.length===0&&<p className="text-xs text-white/45">Nenhum ambiente cadastrado.</p>}</div></div>
     <div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><MapPin size={16} className="text-[#c4ff40]"/> Pontos ({markers.length})</h3><div className="flex flex-wrap gap-2">{markers.map(m=><button key={m.id} onClick={()=>{setSelected(m.id);setResizeId(null);setEditLayout(false);setFrameEditing(false);}} className={'rounded-lg border px-2.5 py-1.5 text-xs '+(selected===m.id?'border-[#c4ff40] text-[#c4ff40]':'border-white/15 text-white/70')}>{m.name}</button>)}{markers.length===0&&<p className="text-xs text-white/45">Nenhum ponto cadastrado.</p>}</div></div>
    </div>
   </div>
   <aside className="min-w-0 space-y-4 self-start rounded-xl border border-white/10 bg-[#16111e] p-4">
    <div className="flex items-center justify-between gap-2"><h3 className="font-black">{frameEditing?'Editar área do mapa':'Editar item'}</h3>{(active||selectedMarker)&&<button onClick={removeSelected} aria-label="Excluir item" className="rounded-lg border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10"><Trash2 size={16}/></button>}</div>
    {frameEditing?<div className="space-y-4 text-sm">
     <p className="rounded-xl border border-[#c4ff40]/20 bg-[#c4ff40]/5 p-3 text-white/80">Arraste a área pelo fundo ou pelo botão Mover área. Use as oito alças para redimensionar.</p>
     <p className="text-xs text-white/55">Ambientes e pontos mantêm suas posições relativas, mesmo fora da área do mapa.</p>
     <div className="rounded-xl border border-white/10 p-3 text-xs text-white/60">Tamanho: {Math.round(frame.width)}% × {Math.round(frame.height)}% do espaço de edição</div>
     <button className={'w-full '+button} onClick={()=>setFrameEditing(false)}>Concluir edição da área</button>
     <p className="text-xs text-amber-200/80">Depois de alterar o tamanho físico do mapa, confira a calibração GPS.</p>
    </div>:active?<div className="space-y-4">
     <div className="flex items-center gap-2 rounded-xl border border-white/10 p-3"><span className="h-5 w-5 rounded" style={{backgroundColor:areaColor(active)}}/><div><p className="text-sm font-bold">{active.name}</p><p className="text-[11px] text-white/50">Ambiente · bordas compartilhadas</p></div></div>
     <label className="block space-y-1 text-xs text-white/65">Nome<input className={input} value={active.name} maxLength={100} onChange={e=>updateArea({name:e.target.value})}/></label>
     <label className="block space-y-1 text-xs text-white/65">Tipo e ícone<select className={input} value={active.icon||active.kind} onChange={e=>updateArea({kind:e.target.value,icon:e.target.value})}>{types.map(t=><option key={t} value={t}>{typeNames[t]}</option>)}</select></label>
     <div className="space-y-2 text-xs text-white/65">Cor{colorInput(areaColor(active),color=>updateArea({color}))}</div>
     <label className="block space-y-1 text-xs text-white/65">Descrição (opcional)<textarea className={input+' min-h-24 resize-y'} maxLength={500} value={active.description||''} onChange={e=>updateArea({description:e.target.value})} placeholder="Descreva este ambiente..."/></label>

     <p className="text-[11px] text-white/45">Ao redimensionar uma borda compartilhada, o vizinho acompanha o ajuste. Arrastar o interior move somente o ambiente selecionado.</p>
     {areas.some(a=>a.id!==active.id&&sharesBorder(a,active))&&<p className="text-[11px] text-[#c4ff40]">Este ambiente compartilha bordas com outros.</p>}

    </div> :selectedMarker?<div className="space-y-4">
     <div className="flex items-center gap-2 rounded-xl border border-white/10 p-3"><MapPin size={21} style={{color:pointColor(selectedMarker)}}/><div><p className="text-sm font-bold">{selectedMarker.name}</p><p className="text-[11px] text-white/50">Ponto · sobreposto aos ambientes</p></div></div>
     {selectedMarker.type==='passagem'&&<div className="space-y-2 rounded-xl border border-[#c4ff40]/20 p-3 text-xs"><p className="font-semibold text-[#c4ff40]">Passagem entre ambientes</p><p className="text-white/55">A passagem só pode deslizar ao longo da divisória compartilhada, sem sair para dentro dos ambientes.</p><p className="text-white/60">{areas.find(a=>a.id===selectedMarker.from_area_id)?.name||'Ambiente A'} ↔ {areas.find(a=>a.id===selectedMarker.to_area_id)?.name||'Ambiente B'}</p><label className="block space-y-1">Tipo de acesso<select className={input} value={selectedMarker.access_type||'livre'} onChange={e=>updateMarker({access_type:e.target.value})}><option value="livre">Livre</option><option value="vip">VIP / Controlado</option><option value="saida">Somente saída</option><option value="staff">Equipe / Staff</option></select></label></div>}
     <label className="block space-y-1 text-xs text-white/65">Nome<input className={input} maxLength={100} value={selectedMarker.name} onChange={e=>updateMarker({name:e.target.value})}/></label>
     <label className="block space-y-1 text-xs text-white/65">Ícone<select className={input} value={selectedMarker.type} onChange={e=>updateMarker(changeMarkerType(selectedMarker,e.target.value))}>{types.map(t=><option key={t} value={t}>{typeNames[t]}</option>)}</select></label>
     <div className="space-y-2 rounded-xl border border-[#c4ff40]/20 bg-[#c4ff40]/5 p-3 text-xs">
       <p className="font-bold text-[#c4ff40]">Posicionamento</p>
       <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={selectedMarker.type==='entrada'} aria-pressed={!selectedMarker.anchor} onClick={()=>updateMarker(freeMarker(selectedMarker))} className={button+' '+(!selectedMarker.anchor?'border-[#c4ff40] text-[#c4ff40]':'')}>Ponto livre</button>
        <button type="button" aria-pressed={!!selectedMarker.anchor} onClick={()=>updateMarker(anchorMarker(selectedMarker,selectedMarker.anchor?.side||closestMapEdge(selectedMarker.x,selectedMarker.y).side))} className={button+' '+(selectedMarker.anchor?'border-[#c4ff40] text-[#c4ff40]':'')}>Na borda</button>
       </div>
       {selectedMarker.anchor&&<label className="block space-y-1">Lateral do mapa
        <select className={input} value={selectedMarker.anchor.side} onChange={e=>updateMarker(anchorMarker(selectedMarker,e.target.value as MapSide))}>
         {MAP_SIDES.map(side=><option key={side} value={side}>{{top:'Superior',right:'Direita',bottom:'Inferior',left:'Esquerda'}[side]}</option>)}
        </select>
       </label>}
       <p className="leading-relaxed text-white/55">{selectedMarker.type==='entrada'?'Entradas precisam ficar em uma borda. Você pode cadastrar várias entradas.':selectedMarker.anchor?'O ícone fica centralizado na linha, metade para dentro e metade para fora. Arraste ao longo da borda.':'Deixe o ponto livre ou fixe-o em qualquer lateral.'}</p>
      </div>
      <div className="space-y-2 text-xs text-white/65">Formato<div className="grid grid-cols-2 gap-2"><button onClick={()=>updateMarker({shape:'square'})} className={button+' '+(selectedMarker.shape!=='circle'?'border-[#c4ff40] text-[#c4ff40]':'')}><Square size={16}/> Quadrado</button><button onClick={()=>updateMarker({shape:'circle'})} className={button+' '+(selectedMarker.shape==='circle'?'border-[#c4ff40] text-[#c4ff40]':'')}><span className="h-4 w-4 rounded-full border-2 border-current"/> Redondo</button></div></div>
     <div className="space-y-2 text-xs text-white/65">Cor{colorInput(pointColor(selectedMarker),color=>updateMarker({color}))}</div>
     <label className="block space-y-2 text-xs text-white/65">Tamanho do ícone <span className="float-right">{selectedMarker.size||42}px</span><input aria-label="Tamanho do ponto" type="range" min="24" max="72" step="2" value={selectedMarker.size||42} onChange={e=>updateMarker({size:Number(e.target.value)})} className="w-full accent-[#c4ff40]"/></label>
     <label className="block space-y-1 text-xs text-white/65">Descrição (opcional)<textarea className={input+' min-h-24 resize-y'} maxLength={500} value={selectedMarker.description||''} onChange={e=>updateMarker({description:e.target.value})} placeholder="Informações úteis sobre este ponto..."/></label>
     <div className="space-y-2 rounded-xl border border-white/10 p-3"><p className="text-xs font-bold text-[#c4ff40]">Funcionamento (opcional)</p><p className="text-[11px] text-white/50">Sem horário, funciona durante todo o evento. O fechamento pode ocorrer após a meia-noite.</p><div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs">Abre<input type="time" className={input} value={selectedMarker.opens_at||''} onChange={e=>updateMarker({opens_at:e.target.value})}/></label><label className="space-y-1 text-xs">Fecha<input type="time" className={input} value={selectedMarker.closes_at||''} onChange={e=>updateMarker({closes_at:e.target.value})}/></label></div><button type="button" className="text-xs underline text-white/60" onClick={()=>updateMarker({opens_at:'',closes_at:''})}>Remover horários</button></div>
     {['bar','alimentacao','cozinha'].includes(selectedMarker.type)&&<div className="space-y-2 rounded-xl border border-white/10 p-3"><p className="text-xs font-bold text-[#c4ff40]">Categorias vendidas neste ponto</p><p className="text-[11px] text-white/50">Selecione as categorias cadastradas no catálogo. Elas serão cruzadas com os produtos do evento.</p>{catalogCategories.length?<div className="space-y-2">{catalogCategories.map(category=><label key={category} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={(selectedMarker.categories||[]).includes(category)} onChange={e=>updateMarker({categories:e.target.checked?[...(selectedMarker.categories||[]),category]:(selectedMarker.categories||[]).filter(c=>c!==category)})}/>{category}</label>)}</div>:<p className="text-xs text-amber-200">Cadastre categorias de produtos antes de vinculá-las.</p>}</div>}
    </div>:<div className="space-y-3 py-6 text-center text-sm text-white/50"><MousePointer2 size={28} className="mx-auto text-[#c4ff40]"/><p>Selecione um ambiente ou um ponto no mapa para editar nome, ícone, cor e descrição.</p><p className="text-xs">Pontos são independentes e ficam por cima dos ambientes.</p></div>}
   </aside>
  </div>
  {pendingDelete&&<div role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setPendingDelete(null);}} className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4">
    <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-remove-title" aria-describedby="confirm-remove-description" className="w-full max-w-md rounded-2xl border border-white/15 bg-[#191320] p-5 shadow-2xl sm:p-6">
     <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-400/30 bg-red-400/10 text-red-300"><Trash2 size={22}/></div>
     <h3 id="confirm-remove-title" className="text-xl font-black text-white">Excluir {pendingDelete.kind==='area'?'ambiente':'ponto'}?</h3>
     <p id="confirm-remove-description" className="mt-3 break-words text-sm leading-relaxed text-white/65">Deseja remover <strong className="text-white">{pendingDelete.name}</strong>? A exclusão só será aplicada ao servidor quando você clicar em <strong className="text-white">Salvar mapa</strong>.</p>
     <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button type="button" autoFocus onClick={()=>setPendingDelete(null)} className={button+' w-full sm:w-auto'}>Cancelar</button>
      <button type="button" onClick={confirmDelete} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-2.5 text-sm font-bold text-red-200 transition hover:bg-red-500/25 sm:w-auto"><Trash2 size={16}/> Excluir item</button>
     </div>
    </div>
   </div>}
  {calibrationOpen&&<div role="dialog" aria-modal="true" aria-label="Calibrar mapa" onMouseDown={e=>{if(e.target===e.currentTarget)setCalibrationOpen(false);}} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3"><div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl space-y-4 overflow-y-auto overscroll-contain rounded-2xl border border-[#c4ff40]/40 bg-[#17111d] p-4 shadow-2xl">
   <div className="sticky -top-4 z-30 flex items-center justify-between gap-2 border-b border-white/10 bg-[#17111d] py-2"><h3 className="text-lg font-black">Calibrar mapa inteiro</h3><button type="button" autoFocus aria-label="Fechar calibração" className={button} onClick={()=>setCalibrationOpen(false)}>Fechar <span aria-hidden="true">×</span></button></div>
   <p className="text-xs text-white/65">Vá fisicamente a cada canto do espaço. Toque em Registrar ponto para capturar seu GPS. Os quatro cantos são do mapa completo, não dos ambientes.</p>{calibrationArea?.gps?.mode==='demo-auto'&&<p role="status" className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">Calibração GPS aproximada ativa (grade estimada de {calibrationArea.gps.spacingMeters||10} m). Os quatro cantos foram calculados a partir de uma única leitura e não medidos no local. Ao registrar o primeiro canto manual, os quatro pontos estimados serão descartados para evitar misturar referências.</p>}
   <div className="relative overflow-hidden rounded-xl border border-white/20 bg-[#0e0c14]" style={{aspectRatio:mapFrameAspect(frame),backgroundImage:'linear-gradient(#ffffff12 1px,transparent 1px),linear-gradient(90deg,#ffffff12 1px,transparent 1px)',backgroundSize:'10% 10%'}}>
    {areas.map(a=><div key={a.id} className="absolute border-2 p-1 text-center text-[10px]" style={{left:a.x+'%',top:a.y+'%',width:a.width+'%',height:a.height+'%',borderColor:areaColor(a),backgroundColor:areaColor(a)+'22'}}>{a.name}</div>)}
    {([['tl','top-1 left-1'],['tr','top-1 right-1'],['bl','bottom-1 left-1'],['br','bottom-1 right-1']] as const).map(([key,pos],i)=><div key={key} className={'absolute z-10 rounded-full border px-2 py-1 text-xs font-bold '+pos+' '+(calibrationArea?.gps?.[key]?'border-[#c4ff40] bg-[#c4ff40] text-black':'border-purple-400 bg-[#21132d] text-white')}>{calibrationArea?.gps?.[key]?'✓':i+1}</div>)}
    {ready&&projectedWalk.length>1&&<svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={projectedWalk.map(p=>p.x+','+p.y).join(' ')} fill="none" stroke="#60a5fa" strokeWidth=".7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    {projectedLive&&<div aria-label="Sua localização atual" title={'Precisão GPS ±'+Math.round(gpsLive?.accuracy||0)+' m'} className="pointer-events-none absolute z-30 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-blue-500 shadow-[0_0_0_7px_#3b82f633]" style={{left:Math.max(0,Math.min(100,projectedLive.x))+'%',top:Math.max(0,Math.min(100,projectedLive.y))+'%'}}/>}
    {!ready&&gpsLive&&<div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-blue-700 px-2 py-1 text-[10px] font-bold">GPS ativo · marque os cantos para projetar sua posição</div>}
   </div>
   <div className="grid grid-cols-2 gap-2">{calibrationKeys.map((key,i)=><button key={key} disabled={calibrationBusy||!calibrationArea} onClick={()=>void capture(key)} className={button+' flex-col text-xs '+(calibrationArea?.gps?.[key]?'border-[#c4ff40] text-[#c4ff40]':'')}><span>{calibrationArea?.gps?.[key]?'✓ ':'○ '}{calibrationLabels[i]}</span><span className="text-[10px] opacity-65">{calibrationArea?.gps?.[key]?'Recalibrar · ±'+Math.round(calibrationArea.gps[key]?.accuracy??0)+' m':'Registrar ponto'}</span></button>)}</div>
   <div role="status" className="rounded-xl border border-blue-400/25 bg-blue-500/10 p-3 text-xs text-blue-100">{gpsStatus}{gpsLive&&<> · {gpsLive.lat.toFixed(6)}, {gpsLive.lng.toFixed(6)}</>}</div>
   <section className="space-y-3 rounded-xl border border-white/15 p-3">
    <h4 className="font-bold">Medidas e validação</h4>
    <p className="text-xs text-white/60">Digite as dimensões reais aproximadas (trena, distância conhecida ou referência confiável). A estimativa do GPS pode ter erro maior do que o ambiente.</p>
    <div className="grid grid-cols-2 gap-2"><label className="text-xs">Largura esperada (m)<input className={input} type="number" inputMode="decimal" min="0.1" step="0.1" value={expectedWidth} onChange={e=>setExpectedWidth(e.target.value)} placeholder="Ex.: 10"/></label><label className="text-xs">Comprimento esperado (m)<input className={input} type="number" inputMode="decimal" min="0.1" step="0.1" value={expectedLength} onChange={e=>setExpectedLength(e.target.value)} placeholder="Ex.: 50"/></label></div>
    <div className="grid grid-cols-2 gap-2 text-xs">{([['tl','tr','Superior'],['bl','br','Inferior'],['tl','bl','Esquerda'],['tr','br','Direita']] as const).map(([a,b,label])=><p key={label} className="rounded-lg bg-white/5 p-2">{label}: <strong>{corners?.[a]&&corners?.[b]?distanceMeters(corners[a],corners[b]).toFixed(1)+' m':'Aguardando pontos'}</strong></p>)}</div>
    {ready&&<div className="space-y-1 text-xs"><p className={geometryValid?'text-green-300':'text-red-300'}>{geometryValid?'✓ Quatro cantos formam um quadrilátero consistente':'✕ Possível inversão de cantos ou geometria cruzada'}</p><p className={accuracyReasonable?'text-green-300':'text-amber-300'}>{accuracyReasonable?'✓ Precisão compatível com a menor dimensão':'⚠ Precisão GPS insuficiente para confirmar os lados desse espaço (pior leitura ±'+Math.round(accuracyMax)+' m)'}</p><p className={!expectationsValid?'text-amber-300':measurementsMatch?'text-green-300':'text-amber-300'}>{!expectationsValid?'Informe as distâncias esperadas para comparar.':measurementsMatch?'✓ Dimensões aproximadas compatíveis (tolerância de 25%)':'⚠ Distância calculada diferente da esperada — calibre novamente ou confira as medidas.'}</p><p className="text-white/60">Estimado pelo GPS: {averageWidth.toFixed(1)} m de largura × {averageLength.toFixed(1)} m de comprimento.</p></div>}
   </section>
   {ready&&<div className="space-y-2 rounded-xl border border-white/15 p-3"><h4 className="font-bold">Teste de caminhada</h4><p className="text-xs text-white/60">Ande em linha reta em um trecho conhecido. O caminho azul revela desvios e oscilações. O teste não corrige automaticamente o GPS.</p><button className={button} onClick={()=>{if(walkActive.current){walkActive.current=false;setWalkTesting(false);}else{setWalkPoints([]);walkActive.current=true;setWalkTesting(true);}}}>{walkTesting?'Encerrar teste':'Iniciar caminhada'}</button><p className="text-xs text-white/50">{walkPoints.length} leituras registradas nesta sessão.</p></div>}
    <p className="text-xs text-white/60">{calibrationKeys.filter(k=>calibrationArea?.gps?.[k]).length}/4 pontos calibrados. Após salvar, a localização será projetada usando esses quatro pontos. Confira sua posição na aba Mapa.</p>
   {showCalibrationConfirm&&<div className="rounded-xl border-2 border-[#c4ff40]/60 bg-[#251d30] p-4 space-y-3"><h4 className="font-bold">Confirmação final da calibração</h4><p className="text-sm">Você espera aproximadamente <strong>{expectedWidth||'?'} m de largura</strong> e <strong>{expectedLength||'?'} m de comprimento</strong>. O GPS estimou <strong>{averageWidth.toFixed(1)} m × {averageLength.toFixed(1)} m</strong>.</p><p className="text-xs">{qualityOK?'Geometria e dimensões compatíveis com as tolerâncias do teste. Confirme também, presencialmente, que esquerda/direita e frente/fundo não foram invertidos.':'A calibração apresenta inconsistência ou precisão insuficiente. Refaça os cantos antes de publicar.'}</p><p className="text-xs text-amber-200">O GPS do telefone não pode garantir 100% de precisão nem detectar um espelhamento completo da planta.</p><div className="flex gap-2"><button className={button} onClick={()=>setShowCalibrationConfirm(false)}>Voltar</button><button className={button+' border-[#c4ff40] text-[#c4ff40]'} disabled={!qualityOK||saving} onClick={async()=>{await save();setShowCalibrationConfirm(false);setCalibrationOpen(false);}}>Confirmar orientação e salvar</button></div></div>}
   {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
   <button disabled={saving||dirty===false||!ready} onClick={requestCalibrationSave} className="w-full rounded-xl bg-[#c4ff40] p-3 font-bold text-black disabled:opacity-40">Salvar calibração global</button>
  </div></div>}
  {notice&&<p role="status" className="rounded-xl border border-[#c4ff40]/20 bg-[#c4ff40]/5 p-3 text-sm text-[#c4ff40]">{notice}</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
 </div>;
}
