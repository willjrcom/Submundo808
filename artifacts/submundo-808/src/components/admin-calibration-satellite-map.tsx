import {useEffect,useRef,useState} from 'react';
import {ExternalLink,MapPin,Satellite} from 'lucide-react';
import {distanceMeters} from './map-location-utils';
import {CORNER_KEYS,type CornerKey} from './map-calibration-geometry';
import {googleMapsLink,googleSatelliteEmbedUrl,mapPreviewPosition,parseManualCoordinate,type ManualValues} from './map-calibration-manual';

type LatLng={lat:number;lng:number};
type MapKind='satellite'|'roadmap';
type MapsApi=any;
const POINT_ORDER:CornerKey[]=['tl','tr','br','bl'];
const positionsFromValues=(values:ManualValues):Partial<Record<CornerKey,LatLng>>=>{
 const positions:Partial<Record<CornerKey,LatLng>>={};
 for(const key of CORNER_KEYS){
  const lat=parseManualCoordinate(values[key].lat,90),lng=parseManualCoordinate(values[key].lng,180);
  if(lat!==null&&lng!==null)positions[key]={lat,lng};
 }
 return positions;
};
let mapsPromise:Promise<MapsApi>|null=null;
function loadMaps(key:string):Promise<MapsApi>{
 const existing=(window as Window&{google?:{maps:MapsApi}}).google?.maps;
 if(existing?.Map)return Promise.resolve(existing);
 if(!mapsPromise){
  mapsPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&v=quarterly';
   script.async=true;script.dataset.calibrationGoogleMaps='true';
   script.onload=()=>{
    const result=(window as Window&{google?:{maps:MapsApi}}).google?.maps;
    if(result?.Map)resolve(result);
    else reject(new Error('O Google Maps não foi inicializado.'));
   };
   script.onerror=()=>reject(new Error('Não foi possível carregar o Google Maps.'));
   document.head.appendChild(script);
  }).catch(e=>{mapsPromise=null;throw e;});
 }
 return mapsPromise;
}
function midpoint(a:LatLng,b:LatLng):LatLng{
 return {lat:(a.lat+b.lat)/2,lng:(a.lng+b.lng)/2};
}
function coord(event:{latLng?:{lat:()=>number;lng:()=>number}}):LatLng|null{
 const point=event.latLng;
 if(!point)return null;
 const lat=point.lat(),lng=point.lng();
 return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
}
const markerIcon=(maps:MapsApi,selected:boolean)=>({
 path:maps.SymbolPath.CIRCLE,
 fillColor:'#c4ff40',fillOpacity:1,
 strokeColor:selected?'#fff':'#1a1023',strokeOpacity:1,strokeWeight:selected?4:3,
 scale:selected?18:15
});

export default function AdminCalibrationSatelliteMap({
 mapName,values,selected,onSelect,onMove,opacity,showOutline,showMeasures,mapKind
}:{
 mapName:string;values:ManualValues;selected:CornerKey;
 onSelect:(key:CornerKey)=>void;onMove:(key:CornerKey,lat:number,lng:number)=>void;
 opacity:number;showOutline:boolean;showMeasures:boolean;mapKind:MapKind;
}){
 const elementRef=useRef<HTMLDivElement>(null);
 const stateRef=useRef<{
  maps:MapsApi;map:any;markers:Partial<Record<CornerKey,any>>;
  polygon:any;topLine:any;dimensionMarkers:any[];listeners:any[];
 }|null>(null);
 const selectedRef=useRef(selected),moveRef=useRef(onMove),selectRef=useRef(onSelect);
 selectedRef.current=selected;moveRef.current=onMove;selectRef.current=onSelect;
 const [status,setStatus]=useState<'loading'|'ready'|'missing-key'|'error'>('loading');
 const [error,setError]=useState('');
 const positions=positionsFromValues(values);
 const center=mapPreviewPosition(values,undefined);
 const googleLink=googleMapsLink(center,mapName);

 useEffect(()=>{
  let mounted=true;
  void (async()=>{
   try{
    const response=await fetch('/api/admin/map-config',{credentials:'same-origin'});
    if(!response.ok)throw new Error('Não foi possível obter a configuração do mapa.');
    const config=await response.json();
    const key=typeof config.googleMapsBrowserKey==='string'?config.googleMapsBrowserKey.trim():'';
    if(!key){if(mounted)setStatus('missing-key');return;}
    const maps=await loadMaps(key);
    if(!mounted||!elementRef.current)return;
    const initial=positionsFromValues(values);
    const activePoints=POINT_ORDER.map(k=>initial[k]).filter((p):p is LatLng=>!!p);
    const center=activePoints.length?
     {lat:activePoints.reduce((sum,p)=>sum+p.lat,0)/activePoints.length,
      lng:activePoints.reduce((sum,p)=>sum+p.lng,0)/activePoints.length}:
     {lat:-14.235,lng:-51.9253};
    const map=new maps.Map(elementRef.current,{
     center,zoom:activePoints.length?18:4,mapTypeId:'satellite',
     backgroundColor:'#14101a',
     mapTypeControl:false,streetViewControl:false,fullscreenControl:true,
     zoomControl:true,scaleControl:true,rotateControl:false,
     clickableIcons:false,gestureHandling:'greedy'
    });
    const polygon=new maps.Polygon({
     map,paths:[],strokeColor:'#c4ff40',strokeWeight:2.5,
     strokeOpacity:1,fillColor:'#9747ff',fillOpacity:.25,clickable:false
    });
    const topLine=new maps.Polyline({map,path:[],strokeColor:'#c4ff40',
     strokeWeight:3,icons:[{icon:{path:maps.SymbolPath.FORWARD_CLOSED_ARROW,scale:3,strokeColor:'#c4ff40',fillColor:'#c4ff40',fillOpacity:1},offset:'100%'}]});
    const markers:Partial<Record<CornerKey,any>>={};
    const listeners:any[]=[];
    for(const [i,k] of POINT_ORDER.entries()){
     const marker=new maps.Marker({
      map,position:initial[k]||undefined,visible:!!initial[k],draggable:true,
      title:'Ponto '+(i+1)+' · arraste para ajustar',
      label:{text:String(i+1),color:'#151018',fontSize:'13px',fontWeight:'800'},
      icon:markerIcon(maps,selectedRef.current===k),
      zIndex:selectedRef.current===k?200:100
     });
     markers[k]=marker;
     listeners.push(marker.addListener('click',()=>selectRef.current(k)));
     listeners.push(marker.addListener('dragstart',()=>selectRef.current(k)));
     listeners.push(marker.addListener('dragend',(event:any)=>{
      const pos=coord(event);
      if(pos)moveRef.current(k,pos.lat,pos.lng);
     }));
    }
    listeners.push(map.addListener('click',(event:any)=>{
     const pos=coord(event);
     if(pos)moveRef.current(selectedRef.current,pos.lat,pos.lng);
    }));
    stateRef.current={maps,map,markers,polygon,topLine,dimensionMarkers:[],listeners};
    if(activePoints.length>1){
     const bounds=new maps.LatLngBounds();
     for(const p of activePoints)bounds.extend(p);
     map.fitBounds(bounds,55);
    }
    if(mounted)setStatus('ready');
   }catch(e){
    if(mounted){setStatus('error');setError(e instanceof Error?e.message:'Não foi possível carregar o satélite.');}
   }
  })();
  return()=>{
   mounted=false;
   const state=stateRef.current;
   if(state){
    for(const event of state.listeners)event.remove();
    for(const marker of Object.values(state.markers))marker?.setMap(null);
    for(const label of state.dimensionMarkers)label.setMap(null);
    state.polygon.setMap(null);state.topLine.setMap(null);
    stateRef.current=null;
   }
  };
  // Do not destroy map state on each drag or input update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 useEffect(()=>{
  const s=stateRef.current;if(!s)return;
  s.map.setMapTypeId(mapKind);
  const raw=positionsFromValues(values);
  for(const key of POINT_ORDER){
   const marker=s.markers[key];if(!marker)continue;
   const pos=raw[key];
   marker.setVisible(!!pos);
   if(pos)marker.setPosition(pos);
   marker.setIcon(markerIcon(s.maps,selected===key));
   marker.setZIndex(selected===key?200:100);
  }
  const complete=POINT_ORDER.every(key=>!!raw[key]);
  s.polygon.setOptions({
   paths:complete?POINT_ORDER.map(key=>raw[key]):[],
   visible:complete&&showOutline,
   fillOpacity:(opacity/100)*.48
  });
  if(complete){
   const topMid=midpoint(raw.tl!,raw.tr!),baseMid=midpoint(raw.bl!,raw.br!);
   const arrowStart={lat:baseMid.lat*.2+topMid.lat*.8,lng:baseMid.lng*.2+topMid.lng*.8};
   s.topLine.setPath([arrowStart,topMid]);
   s.topLine.setVisible(showOutline);
  }else{s.topLine.setPath([]);}
  for(const label of s.dimensionMarkers)label.setMap(null);
  s.dimensionMarkers=[];
  if(complete&&showMeasures){
   for(let i=0;i<POINT_ORDER.length;i++){
    const a=raw[POINT_ORDER[i]]!,b=raw[POINT_ORDER[(i+1)%4]]!;
    const meters=distanceMeters({...a,accuracy:0},{...b,accuracy:0});
    const label=new s.maps.Marker({
     map:s.map,position:midpoint(a,b),clickable:false,
     zIndex:20,
     icon:{path:s.maps.SymbolPath.CIRCLE,scale:0,strokeOpacity:0,fillOpacity:0},
     label:{text:meters.toLocaleString('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1})+' m',
      color:'#c4ff40',fontWeight:'800',fontSize:'12px'}
    });
    s.dimensionMarkers.push(label);
   }
  }
 },[values,selected,opacity,showOutline,showMeasures,mapKind,status]);

 const errorBox=status==='missing-key'||status==='error';
 return <div className="relative min-h-[300px] overflow-hidden rounded-xl border border-white/15 bg-[#110e17]">
  <div ref={elementRef} aria-label="Mapa de satélite interativo para ajustar quatro pontos da planta" className={'h-[340px] w-full sm:h-[440px] lg:h-[485px] '+(errorBox?'hidden':'')}/>
  {status==='loading'&&<div role="status" className="absolute inset-0 flex items-center justify-center bg-[#110e17] p-5 text-center text-sm text-white/70">Carregando mapa interativo...</div>}
  {errorBox&&<div className="space-y-3 p-3">
   <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100">
    {status==='missing-key'?
     'O ajuste por arraste no Google Maps precisa de uma chave de navegador configurada no servidor (GOOGLE_MAPS_BROWSER_API_KEY). Use a edição por coordenadas até a ativação.':
     error}
   </div>
   <div className="flex items-center justify-between text-xs font-semibold"><span className="flex items-center gap-2"><Satellite size={16} className="text-[#c4ff40]"/> Satélite Google Maps · somente consulta</span><a href={googleLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#c4ff40]">Abrir Maps <ExternalLink size={12}/></a></div>
   <iframe loading="lazy" title="Referência de satélite do Google Maps (não arrastável)" src={googleSatelliteEmbedUrl(center,mapName)} referrerPolicy="no-referrer-when-downgrade" className="h-[300px] w-full rounded-lg border-0 sm:h-[400px]"/>
  </div>}
  {status==='ready'&&<div className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-white/20 bg-[#17111e]/90 px-2 py-1 text-[10px] font-semibold text-white/85">Ponto {POINT_ORDER.indexOf(selected)+1} selecionado · toque no satélite ou arraste o marcador</div>}
  {status==='ready'&&<a href={googleLink} target="_blank" rel="noopener noreferrer" className="absolute left-2 top-2 flex items-center gap-1 rounded-lg border border-white/20 bg-[#17111e]/90 px-2.5 py-2 text-xs font-semibold text-[#c4ff40]"><MapPin size={13}/> Abrir no Maps <ExternalLink size={12}/></a>}
 </div>;
}
