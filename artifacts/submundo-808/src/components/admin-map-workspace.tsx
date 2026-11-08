import {useCallback,useEffect,useRef,useState} from 'react';
import PageLoading from './page-loading';
import {readMapDraft,persistMapDraft,removeMapDraft} from './map-edit-draft';
import AdminManualCalibration from './admin-manual-calibration';
import AdminCalibrationOverview from './admin-calibration-overview';
import {emptyManualValues,manualValuesFromGps,type ManualValues,type ManualCalibrationResult} from './map-calibration-manual';
import {displayLabel} from './display-label';
import useMinimumLoading from './use-minimum-loading';
import {
 ArrowLeft,Plus,Save,Trash2,Move,MapPin,Pencil,Maximize2,Undo2,Redo2,CheckCircle2,
 Eye,MousePointer2,Square,RotateCcw,Info,Group,Unplug,Blend,ChevronDown,Grid3X3,X,AlertTriangle
} from 'lucide-react';
import {freeAreaPosition,sharesBorder,limit,type Edge} from './map-layout-geometry';
import {areaPath,visibleAreas,rootAreaId,canGroup,groupWith,ungroup,isGrouped,groupMembers,moveAreaGroup,outerResizeHandles,resizeOuterGroupEdge,type AreaGeometry,type CurveSide,type CurveDirection} from './map-area-shapes';
import {DEFAULT_MAP_FRAME,normalizeMapFrame,moveMapFrame,resizeMapFrame,mapFrameAspect,type MapFrame,type FrameHandle} from './map-frame-geometry';
import {anchorMarker,anchorMarkerInRoom,associateMarkerWithRoom,bindMarkerToRoom,freeMarker,normalizeMarker,moveMarkerInRooms,moveRoomMarkers,roomContainingPoint,closestRoomEdge,changeMarkerType,closestMapEdge,markerIconStyle,MAP_SIDES,type MapSide,type MarkerAnchor} from './map-marker-geometry';
import useMapLabels from './use-map-labels';
import MapPointIconSelect from './map-point-icon-select';
import {pointIconFor} from './map-point-icons';
import {gpsToMap,distanceMeters,type MapCorners} from './map-location-utils';
import {GPS_CAPTURE_MS,MAP_MARGIN_METERS,CORNER_KEYS,measuredCorners,allCorners,applyMeasuredCorner,summarizeGpsSamples,cornersGeometryValid,type CornerKey,type CalibrationGps} from './map-calibration-geometry';

type GPS={lat:number;lng:number;accuracy:number};
type GPSData=CalibrationGps;
type Area={id:string;name:string;map_id:string;kind:string;x:number;y:number;width:number;height:number;gps:GPSData;geometry?:AreaGeometry;description?:string;color?:string;icon?:string};
type Marker={id:string;name:string;type:string;icon?:string;x:number;y:number;area_id?:string;anchor?:MarkerAnchor;description?:string;color?:string;shape?:'square'|'circle';size?:number;opens_at?:string;closes_at?:string;categories?:string[];from_area_id?:string;to_area_id?:string;access_type?:string};
type MapItem={id:string;name:string;venue_id:string};
type Snapshot={areas:Area[];markers:Marker[];frame:MapFrame};
type Drag={id:string;kind:'area'|'marker'|'resize'|'frame-move'|'frame-resize';edge?:Edge;frameHandle?:FrameHandle;startX:number;startY:number;offsetX:number;offsetY:number;snapshot:Snapshot;changed?:boolean};
const input='w-full rounded-xl border border-white/15 bg-[#1b1624] px-3 py-2.5 text-sm text-white outline-none focus:border-[#c4ff40]';
const button='inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-semibold transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-35';
const colors=['#9747FF','#3B82F6','#00BDD6','#A3E635','#FF9F43','#FF456C','#EAB308'];
const types=['principal','pista','palco','vip','backstage','recepcao','entrada','descanso','cozinha','alimentacao','bar','banheiro','saida','posto-medico','passagem','outro'];
const typeNames:Record<string,string>={principal:'Área principal',backstage:'Backstage',pista:'Pista',palco:'Palco',vip:'Área VIP',recepcao:'Recepção',entrada:'Entrada',descanso:'Área de descanso',cozinha:'Cozinha',alimentacao:'Alimentação',bar:'Bar',banheiro:'Banheiro',saida:'Saída','posto-medico':'Posto médico',passagem:'Passagem entre ambientes',outro:'Outro'};
const areaColor=(a:Area)=>/^#[0-9a-fA-F]{6}$/.test(a.color||'')?a.color!:'#9747FF';
const pointColor=(p:Marker)=>/^#[0-9a-fA-F]{6}$/.test(p.color||'')?p.color!:'#C4FF40';
async function api(route:string,payload?:object){
 const r=await fetch('/api/admin/'+route,{method:payload?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});
 const j=await r.json().catch(()=>null);
 if(!r.ok)throw Error(j?.error||'Erro HTTP '+r.status+' ao '+(payload?'salvar':'carregar')+' o mapa.');
 if(!j)throw Error('O servidor retornou uma resposta inválida ao '+(payload?'salvar':'carregar')+' o mapa.');
 return j;
}
// Locate overlapping shared edges without introducing gaps in the stored room layout.
function sharedEdges(areas:Area[]){
 const edges:{a:Area;b:Area;x:number;y:number;vertical:boolean;start:number;end:number}[]=[];
 for(let i=0;i<areas.length;i++)for(let j=i+1;j<areas.length;j++){
  const a=areas[i],b=areas[j],eps=.05;
  const y1=Math.max(a.y,b.y),y2=Math.min(a.y+a.height,b.y+b.height);
  const x1=Math.max(a.x,b.x),x2=Math.min(a.x+a.width,b.x+b.width);
  if(rootAreaId(a)===rootAreaId(b))continue;
  if(y2-y1>=8&&(Math.abs(a.x+a.width-b.x)<eps||Math.abs(b.x+b.width-a.x)<eps))
   edges.push({a,b,x:Math.abs(a.x+a.width-b.x)<eps?b.x:a.x,y:(y1+y2)/2,vertical:true,start:y1,end:y2});
  if(x2-x1>=8&&(Math.abs(a.y+a.height-b.y)<eps||Math.abs(b.y+b.height-a.y)<eps))
   edges.push({a,b,x:(x1+x2)/2,y:Math.abs(a.y+a.height-b.y)<eps?b.y:a.y,vertical:false,start:x1,end:x2});
 }
 return edges;
}
function editableAreaGeometry(area:Area):AreaGeometry{
 const geometry=area.geometry||{},legacy=geometry.curve;
 return {...geometry,shape:geometry.shape||'rect',curve:null,
  curves:{...(legacy?{[legacy.side]:legacy}:{}),...(geometry.curves||{})}};
}
export default function AdminMapWorkspace({map,onBack}:{map:MapItem;onBack:()=>void}){
 const [mapName,setMapName]=useState(map.name),[nameSaving,setNameSaving]=useState(false),[renameOpen,setRenameOpen]=useState(false);
 const [areas,setAreas]=useState<Area[]>([]),[markers,setMarkers]=useState<Marker[]>([]);
 const [catalogCategories,setCatalogCategories]=useState<string[]>([]);
 const [frame,setFrame]=useState<MapFrame>({...DEFAULT_MAP_FRAME}),[frameEditing,setFrameEditing]=useState(false);
 const [selected,setSelected]=useState(''),[editLayout,setEditLayout]=useState(false),[resizeId,setResizeId]=useState<string|null>(null);
 const [groupOpen,setGroupOpen]=useState(false),[groupChoice,setGroupChoice]=useState(''),[curveOpen,setCurveOpen]=useState(false),[editMenuOpen,setEditMenuOpen]=useState(false);
 const [hoveredPassageEdge,setHoveredPassageEdge]=useState<string|null>(null);
 const [curvePartId,setCurvePartId]=useState('');
 const [curveDrafts,setCurveDrafts]=useState<Record<string,AreaGeometry>>({});
 const [formatSide,setFormatSide]=useState<CurveSide>('top');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[initialLoadError,setInitialLoadError]=useState(false),[saving,setSaving]=useState(false),[dirty,setDirty]=useState(false);
 const [draftUnavailable,setDraftUnavailable]=useState(false);
 const draftReady=useRef(false),editRevision=useRef(0);
 const [calibrationChoiceOpen,setCalibrationChoiceOpen]=useState(false);
 const [calibrationOverviewOpen,setCalibrationOverviewOpen]=useState(false);
 const [manualCalibrationOpen,setManualCalibrationOpen]=useState(false);
 const [manualValues,setManualValues]=useState<ManualValues>(emptyManualValues);
 const [calibrationOpen,setCalibrationOpen]=useState(false);const [calibrationBusy,setCalibrationBusy]=useState(false);const [calibrationPosition,setCalibrationPosition]=useState<GPS|null>(null);
 const [gpsLive,setGpsLive]=useState<GPS|null>(null),[gpsStatus,setGpsStatus]=useState(''),[expectedWidth,setExpectedWidth]=useState(''),[expectedLength,setExpectedLength]=useState(''),[walkPoints,setWalkPoints]=useState<GPS[]>([]),[walkTesting,setWalkTesting]=useState(false),[showCalibrationConfirm,setShowCalibrationConfirm]=useState(false);
 const gpsWatch=useRef<number|null>(null),walkActive=useRef(false);
 const captureWatch=useRef<number|null>(null),captureTimer=useRef<number|null>(null),captureProgressTimer=useRef<number|null>(null);
 const captureSamples=useRef<GPS[]>([]);
 const [captureReview,setCaptureReview]=useState<{corner:CornerKey;phase:'collecting'|'review';elapsed:number;result:ReturnType<typeof summarizeGpsSamples>;message:string}|null>(null);
 const [pendingDelete,setPendingDelete]=useState<{id:string;name:string;kind:'area'|'marker'}|null>(null);
 const [pendingDiscardAction,setPendingDiscardAction]=useState<'discard'|'leave'|null>(null);
 const calibrationArea=areas.find(a=>(['tl','tr','br','bl'] as const).some(k=>a.gps?.[k]))||areas[0];
 const calibrationKeys=CORNER_KEYS;
 const calibrationLabels=['Superior esquerdo','Superior direito','Inferior esquerdo','Inferior direito'];
 const corners=calibrationArea?.gps;
 const ready=!!(corners?.tl&&corners?.tr&&corners?.bl&&corners?.br);
 const rawCorners=measuredCorners(corners);
 const distances=allCorners(rawCorners)?{
  top:distanceMeters(rawCorners.tl,rawCorners.tr),bottom:distanceMeters(rawCorners.bl,rawCorners.br),
  left:distanceMeters(rawCorners.tl,rawCorners.bl),right:distanceMeters(rawCorners.tr,rawCorners.br)
 }:null;
 const averageWidth=distances?(distances.top+distances.bottom)/2:0;
 const averageLength=distances?(distances.left+distances.right)/2:0;
 const geo=(p:GPS)=>({x:p.lng*111320*Math.cos(p.lat*Math.PI/180),y:-p.lat*111320});
 const cross=(a:GPS,b:GPS,c:GPS)=>{const x=geo(a),y=geo(b),z=geo(c);return(y.x-x.x)*(z.y-x.y)-(y.y-x.y)*(z.x-x.x);};
 const geometryValid=allCorners(rawCorners)&&cornersGeometryValid(rawCorners);
 const calibrationComplete=geometryValid&&corners?.mode!=='demo-auto';
 const accuracyMax=ready?Math.max(...CORNER_KEYS.map(k=>rawCorners[k]?.accuracy||999)):0;
 const accuracyReasonable=ready&&Math.min(averageWidth,averageLength)>accuracyMax*2;
 const widthExpected=Number(expectedWidth.replace(',','.')),lengthExpected=Number(expectedLength.replace(',','.'));
 const expectationsValid=widthExpected>0&&lengthExpected>0&&Number.isFinite(widthExpected)&&Number.isFinite(lengthExpected);
 const relativeError=(measured:number,expected:number)=>Math.abs(measured-expected)/expected;
 const measurementsMatch=!!(expectationsValid&&distances&&relativeError(averageWidth,widthExpected)<=.25&&relativeError(averageLength,lengthExpected)<=.25);
 const qualityOK=geometryValid&&accuracyReasonable&&measurementsMatch;
 const projectedLive=ready&&gpsLive?gpsToMap(gpsLive,corners as MapCorners):null;
 const projectedWalk=ready?walkPoints.map(p=>gpsToMap(p,corners as MapCorners)).filter((x):x is NonNullable<typeof x>=>!!x):[];
 
 const [history,setHistory]=useState<Snapshot[]>([]),[future,setFuture]=useState<Snapshot[]>([]),[snap,setSnap]=useState(true);
 const [snapGuide,setSnapGuide]=useState<{x?:number;y?:number}|null>(null);
 const canvas=useRef<HTMLDivElement>(null),pasteboard=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null);
 const pointerStartedOnEmptyGrid=useRef(false);
 const editMenuRef=useRef<HTMLDivElement>(null);
 const skipClickAfterDrag=useRef(false);
 const {labels:roomLabels,pointLabels,setMapElement}=useMapLabels(areas,markers);
 const setCanvasRef=useCallback((element:HTMLDivElement|null)=>{canvas.current=element;setMapElement(element);},[setMapElement]);
 const active=areas.find(a=>a.id===selected);
 const selectedMarker=markers.find(m=>m.id===selected);
 const editing=editLayout;
 const passages=sharedEdges(areas);
 const visibleRooms=visibleAreas(areas);
 const grouped=isGrouped(areas,active?.id||'');
 const deleteTarget=pendingDelete?.kind==='area'?areas.find(a=>a.id===pendingDelete.id):undefined;
 const deleteGrouped=!!deleteTarget&&(!!deleteTarget.geometry?.groupId||isGrouped(areas,deleteTarget.id));
 const deleteLinkedPoints=deleteTarget?markers.filter(m=>m.area_id===deleteTarget.id||m.from_area_id===deleteTarget.id||m.to_area_id===deleteTarget.id):[];
 const deleteBlocked=deleteGrouped||deleteLinkedPoints.length>0;
 const groupCandidates=active?visibleRooms.filter(a=>a.id!==active.id&&canGroup(areas,active.id,a.id)):[];
 const curveParts=active?groupMembers(areas,active.id):[];
 const curveHandles=active?outerResizeHandles(areas,active.id):[];
 const curveTarget=curveParts.find(a=>a.id===curvePartId);
 const curveDraft=curveTarget?(curveDrafts[curveTarget.id]||editableAreaGeometry(curveTarget)):null;
 const freeCurveSides=curveHandles.filter(h=>h.areaId===curvePartId).map(h=>h.edge as CurveSide);
 // Preview changes to all the selected group's parts, leaving the original intact.
 const previewAreas=curveOpen&&active
  ?areas.map(a=>curveDrafts[a.id]?{...a,geometry:curveDrafts[a.id]}:a)
  :areas;
 const areasOutside=areas.filter(a=>a.x<0||a.y<0||a.x+a.width>100||a.y+a.height>100).length;
 const markersOutside=markers.filter(m=>m.x<0||m.y<0||m.x>100||m.y>100).length;
 useEffect(()=>{
  let alive=true;draftReady.current=false;setLoading(true);setInitialLoadError(false);
  Promise.all([api('areas'),api('markers?map_id='+encodeURIComponent(map.id)),api('maps'),api('products')]).then(([a,m,maps,products])=>{
   if(!alive)return;
   const roomAreas:Area[]=a.items.filter((x:Area)=>x.map_id===map.id);
   setAreas(roomAreas);setGroupOpen(false);setCurveOpen(false);
   setMarkers(m.items.map(normalizeMarker).map((point:Marker)=>associateMarkerWithRoom(point,roomAreas)));
   setFrame(normalizeMapFrame(maps.items.find((item:MapItem)=>item.id===map.id)?.frame));
   setCatalogCategories([...new Set((products.items as {category:string}[]).map(p=>p.category.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')));
   const recovered=readMapDraft<Area,Marker,MapFrame>(map.id);
   if(recovered){
    setAreas(recovered.areas);
    setMarkers(recovered.markers.map(normalizeMarker).map(point=>associateMarkerWithRoom(point,recovered.areas)));
    setFrame(normalizeMapFrame(recovered.frame));
    setNotice('Rascunho não salvo recuperado neste navegador. Confira o mapa e clique em Salvar mapa quando estiver pronto.');
   }
   setFrameEditing(false);setDirty(!!recovered);setHistory([]);setFuture([]);
   draftReady.current=true;
  }).catch(e=>{
   if(!alive)return;
   const recovered=readMapDraft<Area,Marker,MapFrame>(map.id);
   if(recovered){
    setAreas(recovered.areas);
    setMarkers(recovered.markers.map(normalizeMarker).map(point=>associateMarkerWithRoom(point,recovered.areas)));
    setFrame(normalizeMapFrame(recovered.frame));
    setDirty(true);
    setError('O servidor não respondeu, mas o rascunho local foi recuperado. Suas alterações permanecem neste navegador. Tente salvar novamente quando a conexão voltar.');
    draftReady.current=true;
   }else{setError(String(e));setInitialLoadError(true);}
  }).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[map.id]);
 // Keep the latest committed editor state even if an unexpected React render fails.
 useEffect(()=>{
  if(!draftReady.current||loading||!dirty)return;
  const ok=persistMapDraft(map.id,{areas,markers,frame});
  setDraftUnavailable(!ok);
 },[map.id,areas,markers,frame,dirty,loading]);
 useEffect(()=>{if(!calibrationOpen){stopCaptureWatch();setCaptureReview(null);setCalibrationBusy(false);}},[calibrationOpen]);
 useEffect(()=>()=>stopCaptureWatch(),[]);
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
 // Close the small Edit menu when tapping anywhere outside, without discarding the selected room.
 useEffect(()=>{
  if(!editMenuOpen)return;
  const outside=(event:PointerEvent)=>{
   if(event.target instanceof Node&&!editMenuRef.current?.contains(event.target))setEditMenuOpen(false);
  };
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[editMenuOpen]);
 useEffect(()=>{
  const onKeyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&editMenuOpen){event.preventDefault();setEditMenuOpen(false);return;}
   if(event.key==='Escape'&&pendingDiscardAction){event.preventDefault();event.stopPropagation();if(!loading&&!saving)setPendingDiscardAction(null);return;}
   if(event.key==='Escape'&&pendingDelete){event.preventDefault();event.stopPropagation();setPendingDelete(null);return;}
   if(event.key==='Escape'&&manualCalibrationOpen){event.preventDefault();event.stopPropagation();setManualCalibrationOpen(false);return;}
   if(event.key==='Escape'&&calibrationChoiceOpen){event.preventDefault();event.stopPropagation();setCalibrationChoiceOpen(false);return;}
   if(event.key==='Escape'&&calibrationOverviewOpen){event.preventDefault();event.stopPropagation();setCalibrationOverviewOpen(false);return;}
   if(event.key==='Escape'&&calibrationOpen){
    event.preventDefault();event.stopPropagation();
    if(captureReview)cancelCapture();else setCalibrationOpen(false);
    return;
   }
   if(pendingDelete||pendingDiscardAction)return;
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
 },[editMenuOpen,calibrationOpen,manualCalibrationOpen,calibrationChoiceOpen,calibrationOverviewOpen,captureReview,pendingDelete,pendingDiscardAction,loading,saving,history,future,areas,markers,frame]);

 function checkpoint(){editRevision.current+=1;setHistory(v=>[...v.slice(-39),{areas,markers,frame}]);setFuture([]);setDirty(true);setNotice('');}
 function undo(){if(!history.length)return;editRevision.current+=1;const previous=history[history.length-1];setFuture(v=>[...v,{areas,markers,frame}]);setHistory(v=>v.slice(0,-1));setAreas(previous.areas);setMarkers(previous.markers);setFrame(previous.frame);setDirty(true);setResizeId(null);}
 function redo(){if(!future.length)return;editRevision.current+=1;const next=future[future.length-1];setHistory(v=>[...v,{areas,markers,frame}]);setFuture(v=>v.slice(0,-1));setAreas(next.areas);setMarkers(next.markers);setFrame(next.frame);setDirty(true);setResizeId(null);}
 function updateArea(patch:Partial<Area>){
  if(!active)return;checkpoint();
  const updated=areas.map(a=>a.id===active.id?{...a,...patch}:a);
  setAreas(updated);setMarkers(moveRoomMarkers(markers,areas,updated));
 }
 function updateMarker(patch:Partial<Marker>){if(!selectedMarker)return;checkpoint();setMarkers(v=>v.map(m=>m.id===selectedMarker.id?{...m,...patch}:m));}
 function createArea(){
  // O ambiente começa maior sem sobrepor ambientes já cadastrados.
  const p=freeAreaPosition(areas,30,24);
  if(!p){setError('Não há espaço livre para um novo ambiente. Ajuste as divisórias antes de adicionar.');return;}
  checkpoint();setError('');
  const id=crypto.randomUUID();
  setAreas(v=>[...v,{id,map_id:map.id,name:'Novo ambiente',kind:'outro',...p,gps:{},geometry:{shape:'rect'},icon:'outro',color:'#9747FF',description:''}]);
  setSelected(id);setEditLayout(true);setFrameEditing(false);setResizeId(id);setNotice('Ambiente selecionado. Arraste o interior para mover ou as alças para redimensionar.');
 }
 function confirmGroup(){
  if(!active||!groupChoice||!canGroup(areas,active.id,groupChoice)){setError('Escolha um ambiente ou grupo retangular conectado ao ambiente selecionado.');return;}
  checkpoint();setAreas(groupWith(areas,active.id,groupChoice));setGroupOpen(false);setGroupChoice('');setCurveOpen(false);setResizeId(active.id);setEditLayout(true);
  setNotice('Ambientes agrupados em uma única silhueta, sem divisória interna. Salve o mapa para publicar.');
 }
 function detachGroup(){
  if(!active||!isGrouped(areas,active.id))return;
  checkpoint();setAreas(ungroup(areas,active.id));setGroupOpen(false);setGroupChoice('');setCurveOpen(false);setResizeId(active.id);setEditLayout(true);
  setNotice('Ambientes desagrupados. As partes originais foram preservadas.');
 }
 function openCurveEditor(){
  if(!active)return;
  const first=curveParts.find(part=>curveHandles.some(h=>h.areaId===part.id))||active;
  const sides=curveHandles.filter(h=>h.areaId===first.id).map(h=>h.edge as CurveSide);
  const preferred=first.geometry?.curve?.side;
  setCurvePartId(first.id);setCurveDrafts({});
  setFormatSide(preferred&&sides.includes(preferred)?preferred:sides[0]||'top');
  setGroupOpen(false);setEditMenuOpen(false);setCurveOpen(true);
 }
 function chooseCurvePart(id:string){
  if(!curveParts.some(part=>part.id===id))return;
  const sides=curveHandles.filter(h=>h.areaId===id).map(h=>h.edge as CurveSide);
  if(!sides.length)return;
  setCurvePartId(id);
  setFormatSide(sides.includes(formatSide)?formatSide:sides[0]);
 }
 function updateCurve(patch:Partial<NonNullable<AreaGeometry['curve']>>){
  if(!curveTarget||!freeCurveSides.includes(formatSide))return;
  setCurveDrafts(drafts=>{
   const current=drafts[curvePartId]||editableAreaGeometry(curveTarget);
   const curves={...(current.curves||{})};
   const next={side:formatSide,direction:'in' as CurveDirection,depth:20,...curves[formatSide],...patch};
   if(next.depth<=0)delete curves[formatSide];
   else curves[formatSide]=next;
   return {...drafts,[curvePartId]:{...current,curves,curve:null}};
  });
 }
 function setCurveShape(shape:'rect'|'ellipse'){
  if(!curveTarget||(grouped&&shape==='ellipse'))return;
  setCurveDrafts(drafts=>({...drafts,[curvePartId]:{
   ...(drafts[curvePartId]||editableAreaGeometry(curveTarget)),shape
  }}));
 }
 function applyCurve(){
  if(!active)return;
  const updated=areas.map(a=>{
   const draft=curveDrafts[a.id];
   if(!draft)return a;
   const geometry={...a.geometry,...draft,shape:grouped?'rect':draft.shape,curve:null};
   return JSON.stringify(a.geometry)===JSON.stringify(geometry)?a:{...a,geometry};
  });
  if(updated.some((a,i)=>a!==areas[i])){
   checkpoint();setAreas(updated);setMarkers(moveRoomMarkers(markers,areas,updated));
  }
  setCurveOpen(false);setCurveDrafts({});setCurvePartId('');
 }
 function cancelCurve(){setCurveOpen(false);setCurveDrafts({});setCurvePartId('');}
 function createPassage(a:Area,b:Area,x:number,y:number){
  checkpoint();const id=crypto.randomUUID();
  setMarkers(v=>[...v,{id,name:'Passagem '+a.name+' / '+b.name,type:'passagem',x,y,from_area_id:a.id,to_area_id:b.id,access_type:'livre',shape:'square',size:30,color:'#C4FF40',description:''}]);
  setSelected(id);setEditLayout(true);setResizeId(null);setFrameEditing(false);setNotice('Passagem criada sobre a divisão. Ajuste o tipo de acesso e salve o mapa.');
 }
 function createMarker(){
  checkpoint();const id=crypto.randomUUID();
  const x=active?active.x+active.width/2:50,y=active?active.y+active.height/2:50;
  const owner=active||roomContainingPoint(areas,x,y);
  setMarkers(v=>[...v,{id,name:'Novo ponto',type:'outro',x,y,area_id:owner?.id,shape:'square',size:42,color:'#C4FF40',description:''}]);
  setSelected(id);setEditLayout(true);setFrameEditing(false);setResizeId(null);setNotice('Ponto criado. Arraste para reposicionar.');
 }
 function removeSelected(){
  const item=active?{id:active.id,name:active.name,kind:'area' as const}:selectedMarker?{id:selectedMarker.id,name:selectedMarker.name,kind:'marker' as const}:null;
  if(item){setError('');setEditMenuOpen(false);setPendingDelete(item);}
 }
 function confirmDelete(){
  if(!pendingDelete)return;
  const item=pendingDelete;
  if((item.kind==='area'&&!areas.some(a=>a.id===item.id))||(item.kind==='marker'&&!markers.some(m=>m.id===item.id))){setPendingDelete(null);return;}
  // Never remove a room while grouped or referenced by points/passages.
  // Keep this guard at mutation time as well as in the confirmation modal.
  if(item.kind==='area'&&deleteBlocked)return;
  checkpoint();
  if(item.kind==='area')setAreas(v=>v.filter(a=>a.id!==item.id));
  else setMarkers(v=>v.filter(m=>m.id!==item.id));
  setSelected('');setResizeId(null);setGroupOpen(false);setCurveOpen(false);setPendingDelete(null);
  setNotice('Item removido do editor. Salve o mapa para confirmar a exclusão.');
 }
 function coord(e:React.PointerEvent){
  const rect=canvas.current?.getBoundingClientRect();if(!rect||!rect.width||!rect.height)return null;
  return {x:(e.clientX-rect.left)/rect.width*100,y:(e.clientY-rect.top)/rect.height*100};
 }
 // Detect hover on the shared edge itself without placing an invisible hit target over points.
 function trackPassageHover(e:React.PointerEvent){
  if(e.pointerType!=='mouse'||drag.current||frameEditing){setHoveredPassageEdge(null);return;}
  const rect=canvas.current?.getBoundingClientRect(),p=coord(e);
  if(!rect||!p){setHoveredPassageEdge(null);return;}
  const hovered=passages.find(edge=>{
   const distance=edge.vertical?Math.abs(p.x-edge.x)*rect.width/100:Math.abs(p.y-edge.y)*rect.height/100;
   const along=edge.vertical?p.y:p.x;
   return distance<=9&&along>=edge.start&&along<=edge.end;
  });
  setHoveredPassageEdge(hovered?hovered.a.id+':'+hovered.b.id:null);
 }
 function trackEmptyGridPointerStart(e:React.PointerEvent<HTMLDivElement>){
  // Inspect the original pointer target during capture, before an area/point
  // may capture the pointer and retarget the eventual click to the backdrop.
  pointerStartedOnEmptyGrid.current=e.target===pasteboard.current||e.target===canvas.current;
 }
 function deselectOnEmptyGridClick(e:React.MouseEvent<HTMLDivElement>){
  // Only an actual click on empty Cartesian grid may clear selection. A click
  // on a room, marker, passage, resize handle, or floating menu must not.
  if(!pointerStartedOnEmptyGrid.current||frameEditing)return;
  if(e.target!==pasteboard.current&&e.target!==canvas.current)return;
  pointerStartedOnEmptyGrid.current=false;
  setSelected('');setResizeId(null);setEditLayout(false);
  setGroupOpen(false);setGroupChoice('');setCurveOpen(false);setEditMenuOpen(false);
 }
 function toggleSelection(id:string){
  const selecting=selected!==id;
  setSelected(selected===id?'':id);
  setEditLayout(selecting);setFrameEditing(false);
  setResizeId(selecting&&areas.some(a=>a.id===id)?id:null);
  setGroupOpen(false);setGroupChoice('');setCurveOpen(false);setEditMenuOpen(false);
 }
 function startDrag(e:React.PointerEvent,id:string,kind:Drag['kind'],edge?:Edge){
  e.stopPropagation();
  // First tap selects on click, not during pointerdown (avoids DOM retargeting on mobile).
  skipClickAfterDrag.current=false;
  if(kind==='resize'){
   const part=areas.find(a=>a.id===id);
   if(!part||!edge||rootAreaId(part)!==selected||resizeId!==selected)return;
   // Prevent any direct drag of the hidden junction between grouped pieces.
   if(!outerResizeHandles(areas,selected).some(h=>h.areaId===id&&h.edge===edge))return;
  }else if(selected!==id)return;
  if(!editing)return;
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
   if(m.type!=='passagem'||!m.from_area_id||!m.to_area_id)return moveMarkerInRooms(m,x,y,d.snapshot.areas);
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
   const part=d.snapshot.areas.find(a=>a.id===d.id);
   const updated=part?resizeOuterGroupEdge(d.snapshot.areas,rootAreaId(part),d.id,d.edge,delta,snap):d.snapshot.areas;
   setAreas(updated);setMarkers(moveRoomMarkers(d.snapshot.markers,d.snapshot.areas,updated));
  }else{
   const updated=moveAreaGroup(d.snapshot.areas,d.id,p.x-d.offsetX,p.y-d.offsetY,snap);
   if(snap){
    const moving=groupMembers(updated,d.id);
    const others=updated.filter(a=>!moving.some(m=>m.id===a.id));
    const targetsX=[0,100,...others.flatMap(a=>[a.x,a.x+a.width])];
    const targetsY=[0,100,...others.flatMap(a=>[a.y,a.y+a.height])];
    const edgeX=moving.flatMap(a=>[a.x,a.x+a.width]).find(x=>targetsX.some(target=>Math.abs(x-target)<.01));
    const edgeY=moving.flatMap(a=>[a.y,a.y+a.height]).find(y=>targetsY.some(target=>Math.abs(y-target)<.01));
    setSnapGuide(edgeX!==undefined||edgeY!==undefined?{x:edgeX,y:edgeY}:null);
   }else setSnapGuide(null);
   setAreas(updated);setMarkers(moveRoomMarkers(d.snapshot.markers,d.snapshot.areas,updated));
  }
 }
 function endDrag(e:React.PointerEvent){
  const previous=drag.current;
  if(!previous)return;
  drag.current=null;setSnapGuide(null);
  if(pasteboard.current?.hasPointerCapture(e.pointerId))pasteboard.current.releasePointerCapture(e.pointerId);
  if(previous.kind==='area'||previous.kind==='marker'){
   // Pointer capture may retarget a tap's click to the parent. Toggle on pointerup
   // only when nothing moved, and ignore a synthetic click if it still arrives.
   skipClickAfterDrag.current=true;
   if(e.type==='pointerup'&&!previous.changed)toggleSelection(previous.id);
  }
 }
 async function save(){
  if(saving)return false;
  const revisionAtStart=editRevision.current;
  setSaving(true);setError('');
  try{
   await api('save-layout',{map_id:map.id,areas,markers,frame});
   if(editRevision.current===revisionAtStart){
    removeMapDraft(map.id);
    setDirty(false);setHistory([]);setFuture([]);
    setNotice('Mapa salvo com sucesso. Ambientes, pontos e área externa publicados.');
   }else{
    setDirty(true);
    setNotice('A versão enviada foi salva, mas você fez novas alterações durante o envio. Clique em Salvar mapa novamente.');
   }
   setEditLayout(!!selected);setFrameEditing(false);setResizeId(areas.some(a=>a.id===selected)?selected:null);
   return true;
  }catch(e){
   setError((e instanceof Error?e.message:'Não foi possível salvar o mapa.')+' As alterações continuam no editor e no rascunho local; não foram descartadas.');
   return false;
  }finally{setSaving(false);}
 }
 function chooseCalibrationMode(){
  setError('');setCalibrationChoiceOpen(true);
 }
 function openCalibrationOverview(){
  if(!calibrationComplete){chooseCalibrationMode();return;}
  setError('');setCalibrationOverviewOpen(true);
 }
 function recalibrateMap(){
  setCalibrationOverviewOpen(false);
  chooseCalibrationMode();
 }
 function startManualCalibration(){
  if(!calibrationArea){setError('Crie um ambiente antes de calibrar a planta.');return;}
  setManualValues(manualValuesFromGps(corners));
  setCalibrationChoiceOpen(false);setManualCalibrationOpen(true);
 }
 function startGpsCalibration(){
  if(!calibrationArea){setError('Crie um ambiente antes de calibrar a planta.');return;}
  setCalibrationChoiceOpen(false);setCalibrationOpen(true);
 }
 async function confirmManualCalibration(result:Extract<ManualCalibrationResult,{ok:true}>):Promise<void>{
  if(!calibrationArea)throw Error('Crie e salve um ambiente antes de calibrar a planta.');
  const areaId=calibrationArea.id;
  // The endpoint persists only gps_json, never unsaved rooms, markers or map frame.
  const saved=await api('save-calibration',{map_id:map.id,area_id:areaId,raw_corners:result.raw});
  if(!saved.gps)throw Error('O servidor não confirmou as coordenadas salvas.');
  const gps=saved.gps as GPSData;
  const applySavedGps=(items:Area[])=>items.map(a=>({...a,gps:a.id===areaId?gps:{}}));
  setAreas(previous=>applySavedGps(previous));
  // GPS is now persisted: undo/redo of other draft changes must keep it intact.
  setHistory(previous=>previous.map(snapshot=>({...snapshot,areas:applySavedGps(snapshot.areas)})));
  setFuture(previous=>previous.map(snapshot=>({...snapshot,areas:applySavedGps(snapshot.areas)})));
  setManualCalibrationOpen(false);
  setError('');
  setNotice(dirty
   ?'Calibração salva no servidor. As outras alterações da planta continuam pendentes em Salvar mapa.'
   :'Calibração salva com sucesso. Não é necessário clicar em Salvar mapa novamente.');
 }
 function requestCalibrationSave(){
  if(!ready){setError('Registre os quatro cantos antes de salvar.');return;}
  if(!geometryValid){setError('Os cantos parecem invertidos ou cruzados. Confira os quatro pontos.');return;}
  setShowCalibrationConfirm(true);
 }
 function stopCaptureWatch(){
  if(captureWatch.current!==null){navigator.geolocation?.clearWatch(captureWatch.current);captureWatch.current=null;}
  if(captureTimer.current!==null){window.clearTimeout(captureTimer.current);captureTimer.current=null;}
  if(captureProgressTimer.current!==null){window.clearInterval(captureProgressTimer.current);captureProgressTimer.current=null;}
 }
 function cancelCapture(){
  stopCaptureWatch();captureSamples.current=[];setCaptureReview(null);setCalibrationBusy(false);
 }
 function capture(corner:CornerKey){
  if(!calibrationArea){setError('Crie um ambiente antes de calibrar o mapa.');return;}
  if(!navigator.geolocation){setError('GPS indisponível neste navegador.');return;}
  stopCaptureWatch();setCalibrationBusy(true);setError('');
  captureSamples.current=[];
  const started=Date.now();
  setCaptureReview({corner,phase:'collecting',elapsed:0,result:null,message:''});
  const finish=()=>{
   stopCaptureWatch();
   const result=summarizeGpsSamples(captureSamples.current);
   setCalibrationBusy(false);
   setCaptureReview({corner,phase:'review',elapsed:GPS_CAPTURE_MS,result,
    message:result?(result.reliable?'Leituras estáveis para esta captura.':
     'Precisão baixa ou poucas leituras. Recomendamos mapear novamente se a posição estiver incorreta.')
    :'Nenhuma leitura de GPS válida. Tente novamente em um local com sinal.'});
  };
  captureProgressTimer.current=window.setInterval(()=>{
   setCaptureReview(prev=>prev?.phase==='collecting'?{...prev,elapsed:Math.min(GPS_CAPTURE_MS,Date.now()-started)}:prev);
  },100);
  captureTimer.current=window.setTimeout(finish,GPS_CAPTURE_MS);
  captureWatch.current=navigator.geolocation.watchPosition(p=>{
   captureSamples.current.push({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});
  },e=>{
   if(e.code===1){stopCaptureWatch();setCalibrationBusy(false);
    setCaptureReview({corner,phase:'review',elapsed:GPS_CAPTURE_MS,result:null,
     message:'Permissão de localização negada. Autorize o GPS para calibrar.'});}
   else setGpsStatus('GPS instável: '+e.message+'. Tentando até completar os 8 segundos.');
  },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 }
 function confirmCapturedPoint(){
  const candidate=captureReview?.result?.point,corner=captureReview?.corner;
  if(!candidate||!corner||!calibrationArea)return;
  stopCaptureWatch();checkpoint();setCalibrationPosition(candidate);
  setAreas(v=>v.map(a=>{
   if(a.id!==calibrationArea.id)return {...a,gps:{}};
   return {...a,gps:applyMeasuredCorner(a.gps,corner,candidate)};
  }));
  setNotice('Ponto confirmado (±'+Math.round(candidate.accuracy)+' m). Os limites terão margem externa de 5 m quando os quatro cantos estiverem medidos.');
  setCaptureReview(null);setCalibrationBusy(false);setShowCalibrationConfirm(false);
 }
 async function discard(){
  setLoading(true);setError('');
  try{
   const [a,m,maps]=await Promise.all([api('areas'),api('markers?map_id='+encodeURIComponent(map.id)),api('maps')]);
   const roomAreas:Area[]=a.items.filter((x:Area)=>x.map_id===map.id);
   setAreas(roomAreas);setMarkers(m.items.map(normalizeMarker).map((point:Marker)=>associateMarkerWithRoom(point,roomAreas)));
   setFrame(normalizeMapFrame(maps.items.find((item:MapItem)=>item.id===map.id)?.frame));setFrameEditing(false);
   removeMapDraft(map.id);
   setDirty(false);setHistory([]);setFuture([]);setResizeId(null);setSelected('');setEditLayout(false);setNotice('Alterações descartadas.');
   setPendingDiscardAction(null);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível recuperar a última versão salva do mapa.');}finally{setLoading(false);}
 }
 function requestDiscard(){if(dirty&&!saving)setPendingDiscardAction('discard');}
 function back(){
  if(saving)return;
  if(dirty){setPendingDiscardAction('leave');return;}
  onBack();
 }
 async function confirmDiscardAction(){
  if(!pendingDiscardAction||saving||loading)return;
  if(pendingDiscardAction==='leave'){removeMapDraft(map.id);setPendingDiscardAction(null);onBack();return;}
  await discard();
 }
 const colorInput=(value:string,apply:(color:string)=>void)=><div className="flex flex-wrap items-center gap-2">{colors.map(c=><button key={c} type="button" aria-label={'Cor '+c} onClick={()=>apply(c)} className={'h-7 w-7 rounded-full border-2 '+(value.toLowerCase()===c.toLowerCase()?'border-white ring-2 ring-white/30':'border-transparent')} style={{backgroundColor:c}}/>)}<input aria-label="Escolher cor personalizada" type="color" value={/^#[0-9a-fA-F]{6}$/.test(value)?value:'#9747FF'} onChange={e=>apply(e.target.value)} className="h-8 w-9 cursor-pointer bg-transparent"/></div>;
 const showLoading=useMinimumLoading(loading);
 if(showLoading)return <div className="space-y-4"><button onClick={back} className="flex items-center gap-2 text-sm text-white/60"><ArrowLeft size={16}/> Voltar aos mapas</button><PageLoading label="Carregando editor de mapas" description="Carregando ambientes, pontos e calibração antes de abrir o editor."/></div>;
 if(initialLoadError)return <div role="alert" className="rounded-2xl border border-red-400/25 bg-red-400/5 p-6 text-center"><p className="font-bold text-red-200">Não foi possível carregar o mapa.</p><p className="mt-2 text-sm text-white/60">{error}</p><button onClick={()=>window.location.reload()} className="mt-4 rounded-xl bg-[#c4ff40] px-4 py-2 font-bold text-black">Tentar novamente</button><button onClick={back} className="ml-3 rounded-xl border border-white/15 px-4 py-2 text-white">Voltar</button></div>;
 return <div className="space-y-5">

  <button onClick={back} className="flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft size={16}/> Voltar aos mapas</button>
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-xs uppercase tracking-widest text-[#c4ff40]">Editor do mapa</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">{displayLabel(mapName)}</h2><p className="mt-1 text-xs text-white/50">{curveOpen?'● Prévia de formato não aplicada':dirty?'● Alterações não salvas':'Mapa salvo'} · {editing?'Modo edição ativo':'Modo de visualização'} · Área externa disponível para organizar</p></div>
   <div className="flex flex-wrap gap-2"><button disabled={!dirty||saving} onClick={requestDiscard} className={button}>Descartar</button><button disabled={curveOpen||saving||loading||!dirty} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-black text-black disabled:opacity-40"><Save size={16}/>{saving?'Salvando...':'Salvar mapa'}</button></div>
  </div>
  {draftUnavailable&&dirty&&<p role="alert" className="rounded-xl border border-amber-400/35 bg-amber-400/10 p-3 text-xs text-amber-100">O navegador não permitiu salvar o rascunho local. Evite atualizar a página até conseguir salvar o mapa no servidor.</p>}
  <div className="rounded-xl border border-white/10 bg-white/[.035]">
  <div className="flex flex-wrap items-center gap-2 p-2">
   <button type="button" onClick={()=>setRenameOpen(v=>!v)} aria-expanded={renameOpen} className={button+' '+(renameOpen?'border-[#c4ff40] text-[#c4ff40]':'')}><Pencil size={16}/> Renomear planta</button>
   <button onClick={createArea} className={button}><Plus size={16}/> Ambiente</button>
   <button onClick={createMarker} className={button}><MapPin size={16}/> Ponto</button>
   <button onClick={()=>{setEditLayout(!frameEditing);setFrameEditing(v=>!v);setResizeId(null);setSelected('');setEditMenuOpen(false);setGroupOpen(false);setCurveOpen(false);}} aria-pressed={editing&&frameEditing} className={button+' '+(editing&&frameEditing?'border-[#c4ff40] bg-[#c4ff40]/15 text-[#c4ff40]':'')}><Maximize2 size={16}/>{editing&&frameEditing?'Concluir área do mapa':'Editar área do mapa'}</button>
   <button onClick={openCalibrationOverview} className={button+" border-[#c4ff40]/50 text-[#c4ff40]"}>{calibrationComplete?<CheckCircle2 size={16}/>:<MapPin size={16}/>} {calibrationComplete?'Ver calibração':'Calibrar mapa'}</button>
   <button disabled={!history.length} onClick={undo} title="Desfazer (Ctrl/Cmd+Z)" aria-label="Desfazer" className={button}><Undo2 size={17}/></button>
   <button disabled={!future.length} onClick={redo} title="Refazer (Ctrl/Cmd+Shift+Z)" aria-label="Refazer" className={button}><Redo2 size={17}/></button>
   <label className="ml-auto flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-white/65"><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)} className="accent-[#c4ff40]"/> Encaixar bordas</label>
  </div>
  {groupOpen&&active&&<div role="presentation" className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-3 sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget)setGroupOpen(false);}}><section role="dialog" aria-modal="true" aria-label="Agrupar ambientes" className="w-full max-w-lg max-h-[calc(100dvh-2rem)] space-y-3 overflow-y-auto rounded-2xl border border-[#c4ff40]/40 bg-[#17111e] p-4 shadow-2xl sm:p-6">
   <p className="text-sm font-semibold">Agrupar ao ambiente: <span className="text-[#c4ff40]">{active.name}</span></p>
   <p className="text-xs text-white/60">Escolha outro ambiente ou grupo que encoste em qualquer parte do conjunto. As bordas internas desaparecem; as peças são preservadas ao desagrupar.</p>
   <div className="flex flex-wrap items-end gap-2">
    <label className="min-w-[190px] flex-1 space-y-1 text-xs text-white/65">Ambiente para agrupar
     <select className={input} value={groupChoice} onChange={e=>setGroupChoice(e.target.value)}><option value="">Selecione um ambiente</option>{groupCandidates.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
    </label>
    <button type="button" disabled={!groupChoice} onClick={confirmGroup} className="rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-bold text-black disabled:opacity-40">Agrupar selecionados</button>
    <button type="button" onClick={()=>setGroupOpen(false)} className={button}>Cancelar</button>
   </div>
   {!groupCandidates.length&&<p className="text-xs text-amber-200">Não há outros ambientes ou grupos retangulares conectados. Arraste a nova parte até encostar em uma das bordas do grupo.</p>}
  </section></div>}
  {renameOpen&&  <form onSubmit={async event=>{event.preventDefault();const name=mapName.trim();if(!name||nameSaving)return;setNameSaving(true);setError('');setNotice('');try{await api('edit-map',{id:map.id,venue_id:map.venue_id,name});setNotice('Nome da planta atualizado.');setRenameOpen(false);}catch(e){setError(e instanceof Error?e.message:'Erro ao alterar nome.');}finally{setNameSaving(false);}}} className="flex flex-wrap items-end gap-3 border-t border-white/10 p-3">
   <label className="min-w-0 flex-1 space-y-1 text-xs text-white/60">Nome da planta<input maxLength={100} required value={mapName} onChange={e=>setMapName(e.target.value)} className={input}/></label>
   <button type="submit" disabled={nameSaving||!mapName.trim()||mapName.trim()===map.name&&notice==='Nome da planta atualizado.'} className="rounded-xl bg-[#c4ff40] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">{nameSaving?'Salvando...':'Salvar nome'}</button>
  </form>
  }
  </div>
  <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
   <div className="min-w-0 space-y-3">
    {loading?<p className="rounded-xl border border-white/10 p-6 text-white/60">Carregando ambientes...</p>:<div
      ref={pasteboard} onPointerDownCapture={trackEmptyGridPointerStart} onClick={deselectOnEmptyGridClick} onPointerMove={e=>{move(e);trackPassageHover(e);}} onPointerLeave={()=>setHoveredPassageEdge(null)} onPointerUp={endDrag} onPointerCancel={endDrag}
      className="relative aspect-[4/3] w-full select-none overflow-visible rounded-xl border border-white/20 bg-[#0f0d16]"
      style={{backgroundImage:'linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px)',backgroundSize:'4% 4%'}}
     >
      {active&&!frameEditing&&<div ref={editMenuRef} className="absolute left-1/2 top-2 z-[60] flex w-max max-w-[calc(100%-1rem)] -translate-x-1/2 flex-col items-center gap-1.5" onPointerDown={e=>e.stopPropagation()}>
       <button type="button" aria-label={'Editar ambiente '+active.name} aria-haspopup="menu" aria-expanded={editMenuOpen} onClick={e=>{e.stopPropagation();setEditMenuOpen(v=>!v);}} className={'inline-flex min-h-10 items-center gap-2 rounded-full border border-[#c4ff40] bg-[#17111e] px-4 py-2 text-sm font-bold text-[#c4ff40] shadow-[0_0_15px_#c4ff4030] transition hover:bg-[#c4ff40]/10 '+(editing?'ring-2 ring-[#c4ff40]/35':'')}>
        <Pencil size={16}/> Editar <ChevronDown size={16} className={editMenuOpen?'rotate-180 transition-transform':'transition-transform'}/>
       </button>
       {editMenuOpen&&<div role="menu" aria-label={'Editar '+active.name} className="z-[70] w-52 max-w-full overflow-hidden rounded-2xl border border-[#c4ff40]/45 bg-[#1b1523] p-1.5 text-sm text-white shadow-2xl">
        {grouped&&<button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={e=>{e.stopPropagation();setEditMenuOpen(false);detachGroup();}}><Unplug size={17}/> Desagrupar</button>}
        <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={e=>{e.stopPropagation();setEditMenuOpen(false);setGroupChoice('');setCurveOpen(false);setGroupOpen(true);}}><Group size={17}/> Agrupar</button>
        <button type="button" role="menuitem" title="Editar formato e curvaturas externas" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={e=>{e.stopPropagation();openCurveEditor();}}><Blend size={17}/> Formato</button>
        <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-red-300 hover:bg-red-500/10" onClick={e=>{e.stopPropagation();removeSelected();}}><Trash2 size={17}/> Excluir ambiente</button>
       </div>}
      </div>}
     <div ref={setCanvasRef}
      className={'absolute border-2 border-dashed bg-[#23132e]/40 '+(editing?'touch-none ':'')+(frameEditing?'cursor-move border-[#c4ff40]':'border-[#c4ff40]/30')}
      style={{left:frame.x+'%',top:frame.y+'%',width:frame.width+'%',height:frame.height+'%',backgroundImage:'linear-gradient(#ffffff12 1px,transparent 1px),linear-gradient(90deg,#ffffff12 1px,transparent 1px)',backgroundSize:'10% 10%',touchAction:editing?'none':'auto'}}
      onPointerDown={e=>{if(e.target!==e.currentTarget)return;if(editing&&frameEditing)startFrameDrag(e,'frame-move');}}
      
     ><span className="pointer-events-none absolute -top-5 left-0 text-[10px] font-bold text-[#c4ff40]/80">Área do mapa</span>
      {snapGuide?.x!==undefined&&<span aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-[18] w-px bg-[#c4ff40]/70 shadow-[0_0_5px_#c4ff40]" style={{left:snapGuide.x+'%'}}/>}
      {snapGuide?.y!==undefined&&<span aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-[18] h-px bg-[#c4ff40]/70 shadow-[0_0_5px_#c4ff40]" style={{top:snapGuide.y+'%'}}/>}
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
     {!frameEditing&&passages.map(edge=>{
       const already=markers.some(m=>m.type==='passagem'&&
        ((m.from_area_id===edge.a.id&&m.to_area_id===edge.b.id)||(m.from_area_id===edge.b.id&&m.to_area_id===edge.a.id))&&
        Math.hypot(m.x-edge.x,m.y-edge.y)<7);
       if(already)return null;
       const edgeId=edge.a.id+':'+edge.b.id;
       const related=selected===rootAreaId(edge.a)||selected===rootAreaId(edge.b);
       const visible=related||hoveredPassageEdge===edgeId;
       return <button type="button" key={edgeId}
        title={'Adicionar passagem entre '+edge.a.name+' e '+edge.b.name}
        aria-label={'Adicionar passagem entre '+edge.a.name+' e '+edge.b.name}
        tabIndex={visible?0:-1}
        onPointerDown={e=>e.stopPropagation()}
        onClick={e=>{e.stopPropagation();createPassage(edge.a,edge.b,edge.x,edge.y);setHoveredPassageEdge(null);}}
        className={'absolute z-[25] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full transition-opacity duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4ff40] '+
         (visible?'pointer-events-auto opacity-100':'pointer-events-none opacity-0')}
        style={{left:edge.x+'%',top:edge.y+'%'}}>
        <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full border border-[#c4ff40]/80 bg-[#17111e] text-[#c4ff40] shadow-md transition-transform hover:scale-110"><Plus size={14} strokeWidth={2.5}/></span>
       </button>;
      })}
      <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Silhuetas dos ambientes">
      {visibleRooms.map(a=>{
       const color=areaColor(a),chosen=selected===a.id;
       return <path key={a.id} d={areaPath(previewAreas,a.id)} fill={color+'33'} stroke={chosen?'#c4ff40':color} strokeWidth={chosen?0.7:0.45}
        vectorEffect="non-scaling-stroke" role="button" aria-pressed={chosen} tabIndex={frameEditing?-1:0}
        aria-label={'Selecionar ambiente '+a.name+(isGrouped(areas,a.id)?' agrupado':'')}
        onPointerDown={e=>startDrag(e,a.id,'area')}
        onClick={e=>{e.stopPropagation();e.currentTarget.blur();if(skipClickAfterDrag.current){skipClickAfterDrag.current=false;return;}toggleSelection(a.id);}}
        onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleSelection(a.id);}}}
        style={{pointerEvents:frameEditing?'none':'visiblePainted',cursor:editing&&chosen?'move':'pointer',outline:'none'}}/>;
      })}
     </svg>
     {visibleRooms.map(a=>{
      if(selected!==a.id||frameEditing||!editing||resizeId!==a.id)return null;
      return outerResizeHandles(areas,a.id).map(handle=>{
       const part=areas.find(room=>room.id===handle.areaId);
       return <button key={'resize-'+handle.areaId+'-'+handle.edge} type="button"
        aria-label={'Redimensionar borda externa '+handle.edge+' de '+(part?.name||a.name)}
        title={'Redimensionar a borda externa de '+(part?.name||a.name)}
        onPointerDown={e=>startDrag(e,handle.areaId,'resize',handle.edge)}
        className={'absolute z-30 h-4 w-4 touch-none -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#17101e] bg-[#c4ff40] shadow-[0_0_0_1px_white] '+((handle.edge==='left'||handle.edge==='right')?'cursor-ew-resize':'cursor-ns-resize')}
        style={{left:handle.x+'%',top:handle.y+'%'}}/>;
      });
     })}
     {roomLabels.map(label=>{
       const room=areas.find(area=>area.id===label.id);
       if(!room)return null;
       const Icon=pointIconFor(room.kind,room.icon);
       return <div key={'label-'+label.id}
        className="pointer-events-none absolute z-[5] flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-md border border-white/15 bg-[#100d18]/90 px-2 py-1 text-center text-[11px] font-bold text-white shadow-sm"
        style={{left:label.x+'%',top:label.y+'%',maxWidth:Math.max(room.width,10)+'%'}}>
        <Icon size={13} className="shrink-0" style={{color:areaColor(room)}}/>
        <span className="truncate">{room.name}</span>
       </div>;
      })}
      {markers.map(m=>{
      const Icon=pointIconFor(m.type,m.icon);const color=pointColor(m),size=limit(m.size||42,24,72),chosen=selected===m.id;
      return <button key={m.id} type="button" onPointerDown={e=>startDrag(e,m.id,'marker')} onClick={e=>{e.stopPropagation();if(skipClickAfterDrag.current){skipClickAfterDrag.current=false;return;}toggleSelection(m.id);}}
       title={m.description||m.name}
       className={'z-10 text-center '+(frameEditing?'pointer-events-none ':'')+(editing?'cursor-move':'cursor-pointer')}
       style={markerIconStyle(m,size)}>
       <span className={'flex h-full w-full items-center justify-center border-2 shadow-lg '+(m.shape==='circle'?'rounded-full':'rounded-lg')+(chosen?' ring-2 ring-white/80':'')} style={{color,borderColor:color,backgroundColor:'#15101be8'}}><Icon size={Math.max(15,size*.5)} style={{width:'52%',height:'52%'}}/></span>

      </button>;
     })}
     {pointLabels.filter(label=>label.visible).map(label=>{const m=markers[label.index];if(!m)return null;return <span key={'point-label-'+m.id} className="pointer-events-none absolute z-[19] max-w-[116px] -translate-x-1/2 -translate-y-1/2 truncate whitespace-nowrap rounded border border-white/10 bg-black/90 px-1.5 py-1 text-center text-[10px] font-bold text-white" style={{left:label.x+'%',top:label.y+'%'}}>{m.name}</span>;})}
    </div></div>}
    {(areasOutside>0||markersOutside>0)&&<p role="status" className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">{areasOutside} ambiente(s) e {markersOutside} ponto(s) na área externa. Podem ficar total ou parcialmente ocultos para participantes até serem reposicionados dentro do mapa.</p>}
    <div className="flex items-start gap-2 text-xs text-white/55"><Info size={15} className="mt-0.5 shrink-0 text-[#c4ff40]"/><p>{'Clique uma vez para selecionar. Arraste o interior para mover e as alças externas para redimensionar cada parte do grupo. O menu Editar contém Agrupar e Formato. Clique na área vazia do plano cartesiano para desselecionar.'}</p></div>
    <div className="grid gap-3 md:grid-cols-2">
     <div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Grid3X3 size={16} className="text-[#c4ff40]"/> Ambientes ({visibleRooms.length})</h3><div className="flex flex-wrap gap-2">{visibleRooms.map(a=><button key={a.id} onClick={()=>toggleSelection(a.id)} className={'rounded-lg border px-2.5 py-1.5 text-xs '+(selected===a.id?'border-[#c4ff40] text-[#c4ff40]':'border-white/15 text-white/70')}><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{backgroundColor:areaColor(a)}}/>{a.name}{isGrouped(areas,a.id)?' · '+groupMembers(areas,a.id).length+' partes':''}</button>)}{areas.length===0&&<p className="text-xs text-white/45">Nenhum ambiente cadastrado.</p>}</div></div>
     <div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><MapPin size={16} className="text-[#c4ff40]"/> Pontos ({markers.length})</h3><div className="flex flex-wrap gap-2">{markers.map(m=><button key={m.id} onClick={()=>toggleSelection(m.id)} className={'rounded-lg border px-2.5 py-1.5 text-xs '+(selected===m.id?'border-[#c4ff40] text-[#c4ff40]':'border-white/15 text-white/70')}>{m.name}</button>)}{markers.length===0&&<p className="text-xs text-white/45">Nenhum ponto cadastrado.</p>}</div></div>
    </div>
   </div>
   <aside className="min-w-0 space-y-4 self-start rounded-xl border border-white/10 bg-[#16111e] p-4">
    <div className="flex items-center justify-between gap-2"><h3 className="font-black">{curveOpen&&active?'Formato · '+active.name:frameEditing?'Editar área do mapa':'Editar item'}</h3><div className="flex items-center gap-2">{curveOpen&&active&&<button type="button" onClick={cancelCurve} aria-label="Cancelar edição do formato" className={button}><X size={16}/></button>}{(active||selectedMarker)&&<button type="button" onClick={removeSelected} aria-label="Excluir item" className="rounded-lg border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10"><Trash2 size={16}/></button>}</div></div>
    {curveOpen&&active?<section aria-label="Controles de curvatura" className="space-y-3">
     <p role="status" className="text-xs text-[#c4ff40]">Prévia em tempo real no mapa ao lado. As alterações só são aplicadas ao confirmar.</p>
   <div className="grid grid-cols-2 gap-2" role="group" aria-label="Escolher formato do ambiente">
    <button type="button" aria-pressed={curveDraft?.shape!=='ellipse'} onClick={()=>setCurveShape('rect')}
     className={button+' '+(curveDraft?.shape!=='ellipse'?'border-[#c4ff40] text-[#c4ff40]':'')}><Square size={16}/> Retangular</button>
    <button type="button" disabled={grouped} title={grouped?'O formato oval exige desagrupar os ambientes':'Alterar para oval ou redondo'} aria-pressed={curveDraft?.shape==='ellipse'} onClick={()=>setCurveShape('ellipse')}
     className={button+' '+(curveDraft?.shape==='ellipse'?'border-[#c4ff40] text-[#c4ff40]':'')}><span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current"/> Oval / redondo</button>
   </div>
   {grouped&&<p role="note" className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-100">Não é possível curvar lados que já foram agrupados. Escolha uma parte e uma borda externa livre. O formato oval só está disponível após desagrupar.</p>}
    {grouped&&<label className="block space-y-1 text-xs text-white/65">Parte do grupo
     <select aria-label="Parte do grupo para curvar" className={input} value={curvePartId} onChange={e=>chooseCurvePart(e.target.value)}>
      {curveParts.map((part,index)=><option key={part.id} value={part.id} disabled={!curveHandles.some(handle=>handle.areaId===part.id)}>{part.name} · parte {index+1}{!curveHandles.some(handle=>handle.areaId===part.id)?' (sem bordas livres)':''}</option>)}
     </select>
    </label>}
    <p className="text-xs leading-relaxed text-white/55">{grouped?'A curvatura altera apenas a parte selecionada e mantém as divisórias internas protegidas.':'Selecione uma borda para curvar individualmente. No modo oval, cada lado pode ficar mais aberto ou fechado. O círculo depende das proporções do ambiente.'}</p>
   <div className="grid gap-3">
    <label className="space-y-1 text-xs text-white/65">Borda
     <select aria-label="Borda para curvar" className={input} value={formatSide} onChange={e=>setFormatSide(e.target.value as CurveSide)}>
      <option value="top" disabled={!freeCurveSides.includes('top')}>Superior{grouped&&!freeCurveSides.includes('top')?' · agrupada':''}</option>
       <option value="right" disabled={!freeCurveSides.includes('right')}>Direita{grouped&&!freeCurveSides.includes('right')?' · agrupada':''}</option>
       <option value="bottom" disabled={!freeCurveSides.includes('bottom')}>Inferior{grouped&&!freeCurveSides.includes('bottom')?' · agrupada':''}</option>
       <option value="left" disabled={!freeCurveSides.includes('left')}>Esquerda{grouped&&!freeCurveSides.includes('left')?' · agrupada':''}</option>
     </select>
    </label>
    <label className="space-y-1 text-xs text-white/65">Direção
     <select aria-label="Direção da curvatura" className={input} value={curveDraft?.curves?.[formatSide]?.direction||'in'} onChange={e=>updateCurve({direction:e.target.value as CurveDirection})}>
      <option value="in">Para dentro</option><option value="out">Para fora</option>
     </select>
    </label>
    <label className="space-y-1 text-xs text-white/65">Intensidade: {curveDraft?.curves?.[formatSide]?.depth||0}%
     <input aria-label="Intensidade da curvatura" type="range" min="0" max="40" step="1" value={curveDraft?.curves?.[formatSide]?.depth||0}
      onChange={e=>updateCurve({depth:Number(e.target.value)})} className="mt-3 w-full accent-[#c4ff40]"/>
    </label>
   </div>
   <div className="flex flex-wrap gap-2 text-[11px] text-white/60">{(['top','right','bottom','left'] as const).map(side=><span key={side} className={'rounded-full border px-2 py-1 '+(curveDraft?.curves?.[side]?'border-[#c4ff40]/40 text-[#c4ff40]':'border-white/10')}>{({top:'Superior',right:'Direita',bottom:'Inferior',left:'Esquerda'} as const)[side]}: {curveDraft?.curves?.[side]?.depth||0}%</span>)}</div>
   <div className="grid grid-cols-2 gap-2">
    <button type="button" onClick={()=>updateCurve({depth:0})} className={button+' col-span-2 text-xs'}>Remover curva desta borda</button>
    <button type="button" onClick={cancelCurve} className={button+" text-xs"}>Cancelar</button>
    <button type="button" onClick={applyCurve} className="rounded-xl bg-[#c4ff40] px-3 py-2.5 text-xs font-black text-black">Aplicar</button>
   </div>
   <p className="text-[11px] text-white/45">O mapa continua visível durante os ajustes. Clique em Salvar mapa para publicar.</p>
    </section>:frameEditing?<div className="space-y-4 text-sm">
     <p className="rounded-xl border border-[#c4ff40]/20 bg-[#c4ff40]/5 p-3 text-white/80">Arraste a área pelo fundo ou pelo botão Mover área. Use as oito alças para redimensionar.</p>
     <p className="text-xs text-white/55">Ambientes e pontos mantêm suas posições relativas, mesmo fora da área do mapa.</p>
     <div className="rounded-xl border border-white/10 p-3 text-xs text-white/60">Tamanho: {Math.round(frame.width)}% × {Math.round(frame.height)}% do espaço de edição</div>
     <button className={'w-full '+button} onClick={()=>setFrameEditing(false)}>Concluir edição da área</button>
     <p className="text-xs text-amber-200/80">Depois de alterar o tamanho físico do mapa, confira a calibração GPS.</p>
    </div>:active?<div className="space-y-4">
     <div className="flex items-center gap-2 rounded-xl border border-white/10 p-3"><span className="h-5 w-5 rounded" style={{backgroundColor:areaColor(active)}}/><div><p className="text-sm font-bold">{active.name}</p><p className="text-[11px] text-white/50">Ambiente · {grouped?groupMembers(areas,active.id).length+' partes agrupadas':'bordas compartilhadas'}</p></div></div>
     <div className="space-y-2 text-xs text-white/65">
      <p>Formato do ambiente</p>
      <p className="text-white/70">{active.geometry?.shape==='ellipse'?'Oval / redondo':'Retangular'} · {new Set([...Object.keys(active.geometry?.curves||{}),...(active.geometry?.curve?[active.geometry.curve.side]:[])]).size} borda(s) curvas</p>
      <button type="button" onClick={openCurveEditor} className={button+' w-full justify-center'}><Blend size={15}/> Editar formato</button>
      {grouped&&<p className="text-[11px] text-white/50">Você pode curvar as bordas externas livres de cada parte. Bordas internas ficam protegidas.</p>}
     </div>
     <label className="block space-y-1 text-xs text-white/65">Nome<input className={input} value={active.name} maxLength={100} onChange={e=>updateArea({name:e.target.value})}/></label>
     <label className="block space-y-1 text-xs text-white/65">Tipo e ícone<select className={input} value={active.icon||active.kind} onChange={e=>updateArea({kind:e.target.value,icon:e.target.value})}>{types.map(t=><option key={t} value={t}>{typeNames[t]}</option>)}</select></label>
     <div className="space-y-2 text-xs text-white/65">Cor{colorInput(areaColor(active),color=>updateArea({color}))}</div>
     <label className="block space-y-1 text-xs text-white/65">Descrição (opcional)<textarea className={input+' min-h-24 resize-y'} maxLength={500} value={active.description||''} onChange={e=>updateArea({description:e.target.value})} placeholder="Descreva este ambiente..."/></label>

     <p className="text-[11px] text-white/45">{grouped?'Arraste o grupo pelo interior para mover todas as peças. Redimensione cada retângulo pelas alças de suas bordas externas; bordas compartilhadas ficam protegidas.':'Ao redimensionar uma borda compartilhada, o vizinho acompanha o ajuste. Arrastar o interior move somente o ambiente selecionado.'}</p>
     {areas.some(a=>a.id!==active.id&&sharesBorder(a,active))&&<p className="text-[11px] text-[#c4ff40]">Este ambiente compartilha bordas com outros.</p>}

    </div> :selectedMarker?<div className="space-y-4">
     <div className="flex items-center gap-2 rounded-xl border border-white/10 p-3"><MapPin size={21} style={{color:pointColor(selectedMarker)}}/><div><p className="text-sm font-bold">{selectedMarker.name}</p><p className="text-[11px] text-white/50">Ponto · {selectedMarker.area_id?'vinculado ao ambiente':'livre no mapa'}</p></div></div>
     {selectedMarker.type==='passagem'&&<div className="space-y-2 rounded-xl border border-[#c4ff40]/20 p-3 text-xs"><p className="font-semibold text-[#c4ff40]">Passagem entre ambientes</p><p className="text-white/55">A passagem só pode deslizar ao longo da divisória compartilhada, sem sair para dentro dos ambientes.</p><p className="text-white/60">{areas.find(a=>a.id===selectedMarker.from_area_id)?.name||'Ambiente A'} ↔ {areas.find(a=>a.id===selectedMarker.to_area_id)?.name||'Ambiente B'}</p><label className="block space-y-1">Tipo de acesso<select className={input} value={selectedMarker.access_type||'livre'} onChange={e=>updateMarker({access_type:e.target.value})}><option value="livre">Livre</option><option value="vip">VIP / Controlado</option><option value="saida">Somente saída</option><option value="staff">Equipe / Staff</option></select></label></div>}
     <label className="block space-y-1 text-xs text-white/65">Nome<input className={input} maxLength={100} value={selectedMarker.name} onChange={e=>updateMarker({name:e.target.value})}/></label>
     <label className="block space-y-1 text-xs text-white/65">Tipo do ponto<select aria-label="Tipo do ponto" className={input} value={selectedMarker.type} onChange={e=>updateMarker(changeMarkerType(selectedMarker,e.target.value))}>{types.map(t=><option key={t} value={t}>{typeNames[t]}</option>)}</select></label>
     <MapPointIconSelect key={selectedMarker.id} type={selectedMarker.type} icon={selectedMarker.icon} onChange={icon=>updateMarker({icon})}/>
     <div className="space-y-2 rounded-xl border border-[#c4ff40]/20 bg-[#c4ff40]/5 p-3 text-xs">
       <p className="font-bold text-[#c4ff40]">Posicionamento</p>
       {selectedMarker.type!=='passagem'&&<label className="block space-y-1 font-semibold text-white/70">Vinculado ao ambiente
        <select className={input} value={selectedMarker.area_id||''} onChange={e=>{
         const room=areas.find(a=>a.id===e.target.value);
         if(room)updateMarker(bindMarkerToRoom(selectedMarker,room));
         else updateMarker({...selectedMarker,area_id:undefined,anchor:selectedMarker.anchor?.scope==='area'?undefined:selectedMarker.anchor});
        }}>
         <option value="">Sem vínculo (mapa inteiro)</option>
         {areas.map(room=><option key={room.id} value={room.id}>{room.name}{room.geometry?.groupId?' (agrupado)':''}</option>)}
        </select>
       </label>}
       {selectedMarker.type!=='passagem'&&<div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={selectedMarker.type==='entrada'} aria-pressed={!selectedMarker.anchor}
         onClick={()=>updateMarker(freeMarker(selectedMarker))}
         className={button+' '+(!selectedMarker.anchor?'border-[#c4ff40] text-[#c4ff40]':'')}>Ponto livre</button>
        <button type="button" aria-pressed={!!selectedMarker.anchor} onClick={()=>{
         const room=areas.find(a=>a.id===selectedMarker.area_id);
         const side=room?selectedMarker.anchor?.scope==='area'?selectedMarker.anchor.side:closestRoomEdge(room,selectedMarker.x,selectedMarker.y).side
          :selectedMarker.anchor?.side||closestMapEdge(selectedMarker.x,selectedMarker.y).side;
         updateMarker(room?anchorMarkerInRoom(selectedMarker,room,side):anchorMarker(selectedMarker,side));
        }} className={button+' '+(selectedMarker.anchor?'border-[#c4ff40] text-[#c4ff40]':'')}>Na borda</button>
       </div>}
       {selectedMarker.anchor&&<label className="block space-y-1">
        Lateral {selectedMarker.anchor.scope==='area'?'do ambiente':'do mapa'}
        <select className={input} value={selectedMarker.anchor.side} onChange={e=>{
         const side=e.target.value as MapSide;
         const room=areas.find(a=>a.id===selectedMarker.area_id);
         updateMarker(room&&selectedMarker.anchor?.scope==='area'
          ?anchorMarkerInRoom(selectedMarker,room,side,selectedMarker.anchor.offset)
          :anchorMarker(selectedMarker,side));
        }}>
         {MAP_SIDES.map(side=><option key={side} value={side}>{{top:'Superior',right:'Direita',bottom:'Inferior',left:'Esquerda'}[side]}</option>)}
        </select>
       </label>}
       <p className="leading-relaxed text-white/55">
        {selectedMarker.type==='passagem'
         ?'Passagens pertencem a dois ambientes e acompanham a divisória compartilhada.'
         :selectedMarker.area_id
         ?'Ao mover ou redimensionar o ambiente, este ponto acompanha. A opção Na borda usa a borda do ambiente.'
         :'Sem vínculo, o ponto mantém suas coordenadas. A opção Na borda usa o limite externo do mapa.'}
       </p>
      </div>
      <div className="space-y-2 text-xs text-white/65">Formato<div className="grid grid-cols-2 gap-2"><button onClick={()=>updateMarker({shape:'square'})} className={button+' '+(selectedMarker.shape!=='circle'?'border-[#c4ff40] text-[#c4ff40]':'')}><Square size={16}/> Quadrado</button><button onClick={()=>updateMarker({shape:'circle'})} className={button+' '+(selectedMarker.shape==='circle'?'border-[#c4ff40] text-[#c4ff40]':'')}><span className="h-4 w-4 rounded-full border-2 border-current"/> Redondo</button></div></div>
     <div className="space-y-2 text-xs text-white/65">Cor{colorInput(pointColor(selectedMarker),color=>updateMarker({color}))}</div>
     <label className="block space-y-2 text-xs text-white/65">Tamanho do ícone <span className="float-right">{selectedMarker.size||42}px</span><input aria-label="Tamanho do ponto" type="range" min="24" max="72" step="2" value={selectedMarker.size||42} onChange={e=>updateMarker({size:Number(e.target.value)})} className="w-full accent-[#c4ff40]"/></label>
     <label className="block space-y-1 text-xs text-white/65">Descrição (opcional)<textarea className={input+' min-h-24 resize-y'} maxLength={500} value={selectedMarker.description||''} onChange={e=>updateMarker({description:e.target.value})} placeholder="Informações úteis sobre este ponto..."/></label>
     <div className="space-y-2 rounded-xl border border-white/10 p-3"><p className="text-xs font-bold text-[#c4ff40]">Funcionamento (opcional)</p><p className="text-[11px] text-white/50">Sem horário, funciona durante todo o evento. O fechamento pode ocorrer após a meia-noite.</p><div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs">Abre<input type="time" className={input} value={selectedMarker.opens_at||''} onChange={e=>updateMarker({opens_at:e.target.value})}/></label><label className="space-y-1 text-xs">Fecha<input type="time" className={input} value={selectedMarker.closes_at||''} onChange={e=>updateMarker({closes_at:e.target.value})}/></label></div><button type="button" className="text-xs underline text-white/60" onClick={()=>updateMarker({opens_at:'',closes_at:''})}>Remover horários</button></div>
     {['bar','alimentacao','cozinha'].includes(selectedMarker.type)&&<div className="space-y-2 rounded-xl border border-white/10 p-3"><p className="text-xs font-bold text-[#c4ff40]">Categorias vendidas neste ponto</p><p className="text-[11px] text-white/50">Selecione as categorias cadastradas no catálogo. Elas serão cruzadas com os produtos do evento.</p>{catalogCategories.length||(selectedMarker.categories||[]).length?<div className="space-y-2">{[...new Set([...catalogCategories,...(selectedMarker.categories||[])])].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(category=><label key={category} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={(selectedMarker.categories||[]).includes(category)} onChange={e=>updateMarker({categories:e.target.checked?[...(selectedMarker.categories||[]),category]:(selectedMarker.categories||[]).filter(c=>c!==category)})}/>{category}{!catalogCategories.includes(category)&&<span className="text-amber-200/80">(não está mais no catálogo)</span>}</label>)}</div>:<p className="text-xs text-amber-200">Cadastre categorias de produtos antes de vinculá-las.</p>}</div>}
    </div>:<div className="space-y-3 py-6 text-center text-sm text-white/50"><MousePointer2 size={28} className="mx-auto text-[#c4ff40]"/><p>Selecione um ambiente ou um ponto no mapa para editar nome, ícone, cor e descrição.</p><p className="text-xs">Pontos vinculados acompanham o ambiente; pontos sem vínculo permanecem no mapa.</p></div>}
   </aside>
  </div>
  {pendingDiscardAction&&<div role="presentation" onMouseDown={event=>{if(!loading&&!saving&&event.target===event.currentTarget)setPendingDiscardAction(null);}} className="fixed inset-0 z-[115] flex items-center justify-center bg-black/85 p-4">
    <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-discard-title" aria-describedby="confirm-discard-description" className="w-full max-w-md rounded-2xl border border-white/20 bg-[#211729] p-5 shadow-2xl sm:p-6">
     <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/35 bg-amber-400/10 text-amber-200"><Undo2 size={23}/></div>
     <h3 id="confirm-discard-title" className="text-xl font-black">{pendingDiscardAction==='leave'?'Sair sem salvar o mapa?':'Descartar alterações do mapa?'}</h3>
     <p id="confirm-discard-description" className="mt-3 text-sm leading-relaxed text-white/70">{pendingDiscardAction==='leave'?'Você fez alterações no mapa que ainda não foram salvas. Ao sair, elas serão perdidas.':'O mapa voltará à última versão salva. Ambientes, pontos e posições ainda não salvos serão perdidos.'}</p>
     {error&&<p role="alert" className="mt-3 rounded-xl border border-red-400/35 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
     <div className="mt-6 grid grid-cols-2 gap-3">
      <button type="button" autoFocus disabled={saving||loading} onClick={()=>{setPendingDiscardAction(null);setError('');}} className="rounded-xl border border-white/20 px-3 py-3 text-sm font-semibold disabled:opacity-40">Continuar editando</button>
      <button type="button" disabled={saving||loading} onClick={()=>void confirmDiscardAction()} className="rounded-xl bg-amber-500 px-3 py-3 text-sm font-black text-black disabled:opacity-40">{loading?'Aguarde...':pendingDiscardAction==='leave'?'Sair sem salvar':'Descartar alterações'}</button>
     </div>
    </div>
   </div>}
  {pendingDelete&&<div role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setPendingDelete(null);}} className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-3 sm:p-4">
    <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-remove-title" aria-describedby="confirm-remove-description" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#191320] p-5 shadow-2xl sm:p-6">
     <div className={'mb-4 flex h-12 w-12 items-center justify-center rounded-xl border '+(deleteBlocked?'border-amber-400/30 bg-amber-400/10 text-amber-300':'border-red-400/30 bg-red-400/10 text-red-300')}>{deleteBlocked?<AlertTriangle size={22}/>:<Trash2 size={22}/>}</div>
     <h3 id="confirm-remove-title" className="text-xl font-black text-white">{deleteBlocked?'Não é possível excluir este ambiente':`Excluir ${pendingDelete.kind==='area'?'ambiente':'ponto'}?`}</h3>
     {deleteBlocked?<div id="confirm-remove-description" className="mt-3 space-y-4 text-sm leading-relaxed text-white/70">
      <p>O ambiente <strong className="break-words text-white">{pendingDelete.name}</strong> ainda possui dependências. Para preservar a planta e seus pontos, resolva os itens abaixo antes de excluí-lo.</p>
      {deleteGrouped&&<section className="space-y-1.5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
       <h4 className="font-bold text-amber-200">Ambiente agrupado</h4>
       <p>Este ambiente faz parte de um conjunto de ambientes agrupados. Excluí-lo agora poderia deixar partes do grupo inconsistentes.</p>
       <p><strong className="text-white">Como resolver:</strong> Desagrupe o ambiente antes de excluí-lo. Selecione o ambiente no mapa, abra <strong className="text-white">Editar</strong> e escolha <strong className="text-white">Desagrupar</strong>.</p>
      </section>}
      {deleteLinkedPoints.length>0&&<section className="space-y-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
       <h4 className="font-bold text-amber-200">{deleteLinkedPoints.length} {deleteLinkedPoints.length===1?'ponto ou passagem vinculado':'pontos ou passagens vinculados'}</h4>
       <p>Estes itens dependem deste ambiente para definir sua posição ou passagem. Não serão apagados ou desvinculados automaticamente:</p>
       <ul className="max-h-32 list-disc space-y-1 overflow-y-auto pl-5 text-white/85">{deleteLinkedPoints.map(m=><li key={m.id} className="break-words">{m.name} <span className="text-white/50">({m.type==='passagem'?'passagem':'ponto'})</span></li>)}</ul>
       <p><strong className="text-white">Como resolver:</strong> Na lista <strong className="text-white">Pontos</strong>, selecione e exclua cada ponto ou passagem listado acima. Depois, selecione novamente o ambiente e tente excluí-lo.</p>
      </section>}
      <p className="text-xs text-white/55">Quando todas as dependências forem resolvidas, a exclusão será liberada. Clique em <strong>Salvar mapa</strong> para publicar as alterações.</p>
     </div>:<p id="confirm-remove-description" className="mt-3 break-words text-sm leading-relaxed text-white/65">Deseja remover <strong className="text-white">{pendingDelete.name}</strong>? A exclusão só será aplicada ao servidor quando você clicar em <strong className="text-white">Salvar mapa</strong>.</p>}
     <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button type="button" autoFocus onClick={()=>setPendingDelete(null)} className={button+' w-full sm:w-auto'}>{deleteBlocked?'Entendi':'Cancelar'}</button>
      {!deleteBlocked&&<button type="button" onClick={confirmDelete} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-2.5 text-sm font-bold text-red-200 transition hover:bg-red-500/25 sm:w-auto"><Trash2 size={16}/> Excluir item</button>}
     </div>
    </div>
   </div>}
  {calibrationChoiceOpen&&<div role="presentation" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-3" onMouseDown={e=>{if(e.target===e.currentTarget)setCalibrationChoiceOpen(false);}}>
   <section role="dialog" aria-modal="true" aria-label="Escolher modo de calibração" className="w-full max-w-xl space-y-4 rounded-2xl border border-[#c4ff40]/40 bg-[#17111e] p-4 shadow-2xl sm:p-6">
    <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-lg font-black"><MapPin className="text-[#c4ff40]" size={21}/> Calibrar mapa</h3><button type="button" onClick={()=>setCalibrationChoiceOpen(false)} aria-label="Fechar escolha de calibração" className={button}><X size={17}/></button></div>
    <p className="text-sm text-white/65">Escolha como posicionar geograficamente os quatro cantos da planta. A calibração anterior permanece intacta até você aplicar a nova. A aplicação já salva as coordenadas no servidor.</p>
    <div className="space-y-3">
     <button type="button" disabled={!calibrationArea} onClick={startGpsCalibration} className="flex min-h-24 w-full items-center gap-4 rounded-xl border border-white/15 bg-white/[.035] p-4 text-left transition hover:border-[#c4ff40]/60 disabled:opacity-40"><MapPin size={26} className="shrink-0 text-[#c4ff40]"/><span><strong className="block text-sm">Calibrar usando GPS</strong><span className="mt-1 block text-xs text-white/55">Vá até cada canto com o celular e registre sua posição. Utiliza a medição existente.</span></span></button>
     <button type="button" disabled={!calibrationArea} onClick={startManualCalibration} className="flex min-h-24 w-full items-center gap-4 rounded-xl border border-[#c4ff40]/45 bg-[#c4ff40]/5 p-4 text-left transition hover:border-[#c4ff40] disabled:opacity-40"><Grid3X3 size={26} className="shrink-0 text-[#c4ff40]"/><span><strong className="block text-sm">Ajustar pelo mapa</strong><span className="mt-1 block text-xs text-white/55">Posicione os quatro pontos no satélite. A edição numérica fica disponível como opção discreta dentro da tela.</span></span></button>
    </div>
    {!calibrationArea&&<p role="alert" className="text-xs text-amber-200">Crie ao menos um ambiente antes de calibrar a planta.</p>}
    <p className="text-xs text-white/50">Os dois métodos utilizam a mesma calibração do mapa e preservam a margem externa de 5 m.</p>
   </section>
  </div>}
  {calibrationOverviewOpen&&calibrationComplete&&<AdminCalibrationOverview
   mapName={mapName} gps={corners} areas={areas}
   hasUnsavedChanges={dirty}
   onClose={()=>setCalibrationOverviewOpen(false)}
   onRecalibrate={recalibrateMap}/>}
  {manualCalibrationOpen&&<AdminManualCalibration mapName={mapName}
    values={manualValues}
    onChange={(key,field,value)=>setManualValues(previous=>({...previous,[key]:{...previous[key],[field]:value}}))}
    onClose={()=>setManualCalibrationOpen(false)}
    onApply={confirmManualCalibration}/>}
  {calibrationOpen&&<div role="dialog" aria-modal="true" aria-label="Calibrar mapa" onMouseDown={e=>{if(e.target===e.currentTarget)setCalibrationOpen(false);}} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3"><div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl space-y-4 overflow-y-auto overscroll-contain rounded-2xl border border-[#c4ff40]/40 bg-[#17111d] p-4 shadow-2xl">
   <div className="sticky -top-4 z-30 flex items-center justify-between gap-2 border-b border-white/10 bg-[#17111d] py-2"><h3 className="text-lg font-black">Calibração por GPS</h3><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={calibrationBusy||!!captureReview} onClick={()=>{setCalibrationOpen(false);setCalibrationChoiceOpen(true);}}>Voltar aos métodos</button><button type="button" autoFocus aria-label="Fechar calibração" className={button} onClick={()=>setCalibrationOpen(false)}>Fechar <span aria-hidden="true">×</span></button></div></div>
   <p className="text-xs text-white/65">Fique dentro do espaço, perto do canto correspondente, e toque diretamente no símbolo + do mapa. Aguarde 8 segundos parado; confirme ou repita a captura. A margem de 5 metros para fora será aplicada automaticamente quando os quatro cantos estiverem medidos.</p>{calibrationArea?.gps?.mode==='demo-auto'&&<p role="status" className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">Calibração GPS aproximada ativa (grade estimada de {calibrationArea.gps.spacingMeters||10} m). Os quatro cantos foram calculados a partir de uma única leitura e não medidos no local. Ao registrar o primeiro canto manual, os quatro pontos estimados serão descartados para evitar misturar referências.</p>}
   <div className="relative overflow-hidden rounded-xl border border-white/20 bg-[#0e0c14]" style={{aspectRatio:mapFrameAspect(frame),backgroundImage:'linear-gradient(#ffffff12 1px,transparent 1px),linear-gradient(90deg,#ffffff12 1px,transparent 1px)',backgroundSize:'10% 10%'}}>
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Prévia dos ambientes calibrados">
     {visibleRooms.map(a=><path key={a.id} d={areaPath(previewAreas,a.id)} fill={areaColor(a)+'22'} stroke={areaColor(a)} strokeWidth={0.45} vectorEffect="non-scaling-stroke" fillRule="evenodd"><title>{a.name}</title></path>)}
    </svg>
    {visibleRooms.map(a=><span key={'cal-label-'+a.id} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded bg-[#100d18]/85 px-1 py-0.5 text-[10px] text-white" style={{left:a.x+a.width/2+'%',top:a.y+a.height/2+'%'}}>{a.name}</span>)}
    {([['tl','top-2 left-2'],['tr','top-2 right-2'],['bl','bottom-2 left-2'],['br','bottom-2 right-2']] as const).map(([key,pos],i)=>{
     const measured=!!rawCorners[key];
     return <button key={key} type="button" title={calibrationLabels[i]+(measured?' · mapear novamente':' · capturar ponto')}
      aria-label={(measured?'Recalibrar ':'Calibrar ')+calibrationLabels[i]}
      disabled={calibrationBusy||!calibrationArea} onClick={()=>capture(key)}
      className={'absolute z-40 flex h-11 w-11 items-center justify-center rounded-full border-2 text-xl font-black shadow-[0_2px_12px_#000b] transition disabled:opacity-40 '+pos+' '+(measured?'border-[#c4ff40] bg-[#c4ff40] text-black':'border-white/80 bg-[#5b2787] text-white hover:bg-[#7433ae]')}>{measured?'✓':'+'}</button>;
    })}
    {ready&&corners?.marginMeters===MAP_MARGIN_METERS&&allCorners(rawCorners)&&CORNER_KEYS.map(key=>{
     const original=gpsToMap(rawCorners[key],corners as MapCorners);
     return original?<span key={'raw-'+key} aria-label={'Ponto medido '+key} title={'Ponto medido antes da margem de 5 m ('+key+')'} className="pointer-events-none absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-amber-400 shadow-[0_0_5px_#fbbf24]" style={{left:original.x+'%',top:original.y+'%'}}/>:null;
    })}
    {ready&&projectedWalk.length>1&&<svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={projectedWalk.map(p=>p.x+','+p.y).join(' ')} fill="none" stroke="#60a5fa" strokeWidth=".7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    {projectedLive&&<div aria-label="Sua localização atual" title={'Precisão GPS ±'+Math.round(gpsLive?.accuracy||0)+' m'} className="pointer-events-none absolute z-30 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-blue-500 shadow-[0_0_0_7px_#3b82f633]" style={{left:Math.max(0,Math.min(100,projectedLive.x))+'%',top:Math.max(0,Math.min(100,projectedLive.y))+'%'}}/>}
    {!ready&&gpsLive&&<div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-blue-700 px-2 py-1 text-[10px] font-bold">GPS ativo · marque os cantos para projetar sua posição</div>}
   </div>
   <p className="text-center text-xs text-white/55">{calibrationKeys.filter(k=>rawCorners[k]).length}/4 cantos medidos. Roxo (+): pendente · verde (✓): confirmado; amarelo: GPS originalmente medido. Toque no canto novamente para refazer.</p>
   <div role="status" className="rounded-xl border border-blue-400/25 bg-blue-500/10 p-3 text-xs text-blue-100">{gpsStatus}{gpsLive&&<> · {gpsLive.lat.toFixed(6)}, {gpsLive.lng.toFixed(6)}</>}</div>
   <section className="space-y-3 rounded-xl border border-white/15 p-3">
    <h4 className="font-bold">Medidas e validação</h4>
    <p className="text-xs text-white/60">Digite as dimensões reais aproximadas (trena, distância conhecida ou referência confiável). A estimativa do GPS pode ter erro maior do que o ambiente.</p>
    <div className="grid grid-cols-2 gap-2"><label className="text-xs">Largura esperada (m)<input className={input} type="number" inputMode="decimal" min="0.1" step="0.1" value={expectedWidth} onChange={e=>setExpectedWidth(e.target.value)} placeholder="Ex.: 10"/></label><label className="text-xs">Comprimento esperado (m)<input className={input} type="number" inputMode="decimal" min="0.1" step="0.1" value={expectedLength} onChange={e=>setExpectedLength(e.target.value)} placeholder="Ex.: 50"/></label></div>
    <div className="grid grid-cols-2 gap-2 text-xs">{([['tl','tr','Superior'],['bl','br','Inferior'],['tl','bl','Esquerda'],['tr','br','Direita']] as const).map(([a,b,label])=><p key={label} className="rounded-lg bg-white/5 p-2">{label}: <strong>{corners?.[a]&&corners?.[b]?distanceMeters(rawCorners[a]!,rawCorners[b]!).toFixed(1)+' m':'Aguardando pontos'}</strong></p>)}</div>
    {ready&&<div className="space-y-1 text-xs"><p className={geometryValid?'text-green-300':'text-red-300'}>{geometryValid?'✓ Quatro cantos formam um quadrilátero consistente':'✕ Possível inversão de cantos ou geometria cruzada'}</p><p className={accuracyReasonable?'text-green-300':'text-amber-300'}>{accuracyReasonable?'✓ Precisão compatível com a menor dimensão':'⚠ Precisão GPS insuficiente para confirmar os lados desse espaço (pior leitura ±'+Math.round(accuracyMax)+' m)'}</p><p className={!expectationsValid?'text-amber-300':measurementsMatch?'text-green-300':'text-amber-300'}>{!expectationsValid?'Informe as distâncias esperadas para comparar.':measurementsMatch?'✓ Dimensões aproximadas compatíveis (tolerância de 25%)':'⚠ Distância calculada diferente da esperada — calibre novamente ou confira as medidas.'}</p><p className="text-white/60">Estimado pelo GPS: {averageWidth.toFixed(1)} m de largura × {averageLength.toFixed(1)} m de comprimento.</p></div>}
   </section>
   {ready&&<p className="rounded-lg border border-[#c4ff40]/30 bg-[#c4ff40]/5 p-3 text-xs text-[#c4ff40]">{corners?.marginMeters===MAP_MARGIN_METERS?'Margem externa de 5 m aplicada em cada borda, de acordo com a orientação da planta.':'Calibração anterior preservada sem alterar os limites. Ao refazer um canto, aplicaremos a margem externa de 5 m a partir das medidas.'} As dimensões acima consideram os pontos medidos, antes da margem.</p>}
   {ready&&<div className="space-y-2 rounded-xl border border-white/15 p-3"><h4 className="font-bold">Teste de caminhada</h4><p className="text-xs text-white/60">Ande em linha reta em um trecho conhecido. O caminho azul revela desvios e oscilações. O teste não corrige automaticamente o GPS.</p><button className={button} onClick={()=>{if(walkActive.current){walkActive.current=false;setWalkTesting(false);}else{setWalkPoints([]);walkActive.current=true;setWalkTesting(true);}}}>{walkTesting?'Encerrar teste':'Iniciar caminhada'}</button><p className="text-xs text-white/50">{walkPoints.length} leituras registradas nesta sessão.</p></div>}
    <p className="text-xs text-white/60">{calibrationKeys.filter(k=>calibrationArea?.gps?.[k]).length}/4 pontos calibrados. Após salvar, a localização será projetada usando esses quatro pontos. Confira sua posição na aba Mapa.</p>
   {showCalibrationConfirm&&<div className="rounded-xl border-2 border-[#c4ff40]/60 bg-[#251d30] p-4 space-y-3"><h4 className="font-bold">Confirmação final da calibração</h4><p className="text-sm">Você espera aproximadamente <strong>{expectedWidth||'?'} m de largura</strong> e <strong>{expectedLength||'?'} m de comprimento</strong>. O GPS estimou <strong>{averageWidth.toFixed(1)} m × {averageLength.toFixed(1)} m</strong>.</p><p className="text-xs">{qualityOK?'Geometria e dimensões compatíveis com as tolerâncias do teste. Confirme também, presencialmente, que esquerda/direita e frente/fundo não foram invertidos.':'A calibração apresenta inconsistência ou precisão insuficiente. Refaça os cantos antes de publicar.'}</p><p className="text-xs text-amber-200">O GPS do telefone não pode garantir 100% de precisão nem detectar um espelhamento completo da planta.</p><div className="flex gap-2"><button className={button} onClick={()=>setShowCalibrationConfirm(false)}>Voltar</button><button className={button+' border-[#c4ff40] text-[#c4ff40]'} disabled={!qualityOK||saving} onClick={async()=>{if(await save()){setShowCalibrationConfirm(false);setCalibrationOpen(false);}}}>Confirmar orientação e salvar</button></div></div>}
   {captureReview&&<div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/85 p-3" role="dialog" aria-modal="true" aria-label="Coletar posição GPS">
    <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[#c4ff40]/45 bg-[#21192a] p-5 shadow-2xl">
     <div className="flex items-center justify-between gap-3"><h4 className="text-base font-black">{calibrationLabels[calibrationKeys.indexOf(captureReview.corner)]}</h4><span className="text-xs text-white/60">Medição de GPS</span></div>
     {captureReview.phase==='collecting'?<>
       <p className="text-sm text-white/75">Mantenha o celular parado enquanto analisamos a oscilação da localização.</p>
       <div className="h-3 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progresso da captura GPS" aria-valuenow={captureReview.elapsed} aria-valuemin={0} aria-valuemax={GPS_CAPTURE_MS}>
        <div className="h-full rounded-full bg-[#c4ff40] transition-[width] duration-100" style={{width:(captureReview.elapsed/GPS_CAPTURE_MS*100)+'%'}}/>
       </div>
       <div className="flex justify-between text-xs text-white/60"><span>{Math.ceil((GPS_CAPTURE_MS-captureReview.elapsed)/1000)} segundos restantes</span><span>{captureSamples.current.length} leituras recebidas</span></div>
       <button type="button" className={button+' w-full'} onClick={cancelCapture}>Cancelar captura</button>
      </>:<>
       <div className="h-3 rounded-full bg-[#c4ff40]" role="progressbar" aria-label="Captura GPS concluída" aria-valuenow={GPS_CAPTURE_MS} aria-valuemin={0} aria-valuemax={GPS_CAPTURE_MS}/>
       <p className="text-sm font-semibold">{captureReview.result?'Captura concluída':'Não foi possível concluir a medição'}</p>
       {captureReview.result&&<div className="space-y-1 rounded-xl bg-white/5 p-3 text-xs text-white/70">
        <p>Posição estimada: {captureReview.result.point.lat.toFixed(6)}, {captureReview.result.point.lng.toFixed(6)}</p>
        <p>Precisão informada: ±{Math.round(captureReview.result.point.accuracy)} m</p>
        <p>Leituras aproveitadas: {captureReview.result.accepted} de {captureReview.result.total}</p>
        <p>Oscilação da amostra: até {captureReview.result.spreadMeters.toFixed(1)} m</p>
       </div>}
       <p role="status" className={'text-xs '+(captureReview.result?.reliable?'text-green-300':'text-amber-200')}>{captureReview.message}</p>
       <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={()=>capture(captureReview.corner)} className={button}>Mapear novamente</button>
        <button type="button" disabled={!captureReview.result} onClick={confirmCapturedPoint} className="rounded-xl bg-[#c4ff40] px-3 py-2.5 text-sm font-bold text-black disabled:opacity-35">Confirmar ponto</button>
       </div>
       <button type="button" onClick={cancelCapture} className="w-full py-2 text-xs text-white/60">Cancelar</button>
      </>}
    </div>
   </div>}
   {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
   <button disabled={saving||dirty===false||!ready||!!captureReview} onClick={requestCalibrationSave} className="w-full rounded-xl bg-[#c4ff40] p-3 font-bold text-black disabled:opacity-40">Salvar calibração global</button>
  </div></div>}
  {notice&&<p role="status" className="rounded-xl border border-[#c4ff40]/20 bg-[#c4ff40]/5 p-3 text-sm text-[#c4ff40]">{notice}</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
 </div>;
}
