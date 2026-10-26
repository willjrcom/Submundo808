import {useEffect,useRef,useState} from 'react';
import PageLoading from './page-loading';
import useMinimumLoading from './use-minimum-loading';
import {displayLabel} from './display-label';
import {MapPin,Navigation,ArrowUp,Info,Music2,Warehouse,Crown,Users,DoorOpen,Sofa,Utensils,Wine,Bath,Flag,Stethoscope} from 'lucide-react';
import {gpsToMap,stableGps,offMapInfo,mapSize,formatMapDistance,type GpsFix} from './map-location-utils';
import {startInitialGps,gpsErrorText} from './gps-acquisition';
import {mapFrameAspect,normalizeMapFrame,type MapFrame} from './map-frame-geometry';
import {normalizeMarker,type MarkerAnchor} from './map-marker-geometry';
import useMapLabels from './use-map-labels';
type Geo={lat:number;lng:number};
type Bounds={tl:Geo;tr:Geo;br:Geo;bl:Geo};
type FriendLocation={id:string;name:string;lat:number;lng:number;accuracy:number;updatedAt:number};
type ShareMode='event'|'4h'|'1h';
type EventChoice={id:string;name:string;ends_at:string};
const formatDeadline=(dateValue:number)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(dateValue));
const eventEndLabel=(value:string)=>{
 const match=value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
 return match?match[3]+'/'+match[2]+' às '+match[4]+':'+match[5]:'horário a definir';
};
type Area={id:string;name:string;kind:string;x:number;y:number;width:number;height:number;gps:Partial<Bounds>&{mode?:string;spacingMeters?:number;accuracyMeters?:number};color?:string;icon?:string;description?:string};
type Marker={id:string;name:string;type:string;x:number;y:number;anchor?:MarkerAnchor;shape?:'square'|'circle';size?:number;color?:string;description?:string};
type MapData={map:{id:string;name:string;frame?:MapFrame};areas:Area[];markers:Marker[]};
const EMPTY_AREAS:Area[]=[];
const EMPTY_MARKERS:Marker[]=[];
const mapIcon=(type:string)=>{
 const icons:Record<string,typeof MapPin>={pista:Music2,palco:Warehouse,vip:Crown,recepcao:Users,entrada:DoorOpen,descanso:Sofa,cozinha:Utensils,alimentacao:Utensils,bar:Wine,banheiro:Bath,saida:Flag,'posto-medico':Stethoscope};
 return icons[type]||MapPin;
};
const validColor=(color?:string,fallback='#9747FF')=>color&&/^#[0-9a-fA-F]{6}$/.test(color)?color:fallback;
export default function VenueMap(){
 const [maps,setMaps]=useState<{id:string;name:string}[]>([]);
 const [selectedMap,setSelectedMap]=useState('');
 const [eventChoices,setEventChoices]=useState<EventChoice[]>([]);
 const [selectedEventId,setSelectedEventId]=useState('');
 const [selectedMarkerId,setSelectedMarkerId]=useState<string|null>(null);
 const [data,setData]=useState<MapData|null>(null);
 const {labels:roomLabels,setMapElement}=useMapLabels(data?.areas||EMPTY_AREAS,data?.markers||EMPTY_MARKERS);
 const [mapError,setMapError]=useState('');
 const [mapsReady,setMapsReady]=useState(false),[mapDataReady,setMapDataReady]=useState(false);
 const [eventRevision,setEventRevision]=useState(0);
 useEffect(()=>{
  const refresh=()=>setEventRevision(n=>n+1);
  window.addEventListener('submundo-event-selected',refresh);
  return()=>window.removeEventListener('submundo-event-selected',refresh);
 },[]);
 useEffect(()=>{
  let active=true;
  setMapsReady(false);
  const load=async(url:string)=>{const response=await fetch(url);if(!response.ok)throw Error('Falha ao carregar eventos ou mapas.');return response.json();};
  Promise.all([load('/api/public/events'),load('/api/public/maps')])
   .then(([events,mapsData])=>{
    if(!active)return;
    const available:EventChoice[]=events.items||[];
    setEventChoices(available);
    const event=available.find(e=>e.id===localStorage.getItem('submundo-event-id'))||available[0];
    setSelectedEventId(event?.id||'');
    const filtered=(mapsData.items||[]).filter((m:{id:string})=>event?.map_ids?.includes(m.id));
    setMaps(filtered);setSelectedMap(filtered[0]?.id||'');
   })
   .catch(()=>{if(active)setMapError('Não foi possível carregar os mapas.');})
   .finally(()=>{if(active)setMapsReady(true);});
  return()=>{active=false;};
 },[eventRevision]);
 useEffect(()=>{
  if(!selectedMap){setData(null);setMapDataReady(true);return;}
  let active=true;setData(null);setMapDataReady(false);setMapError('');
  fetch('/api/public/map-detail?map_id='+encodeURIComponent(selectedMap))
   .then(async response=>{if(!response.ok)throw Error('Falha ao carregar mapa');return response.json();})
   .then(result=>{if(active)setData({...result,markers:(result.markers||[]).map(normalizeMarker)});})
   .catch(e=>{if(active)setMapError(e instanceof Error?e.message:'Não foi possível carregar o mapa.');})
   .finally(()=>{if(active)setMapDataReady(true);});
  return()=>{active=false;};
 },[selectedMap]);
 const calibrated=data?.areas.find(a=>['tl','tr','br','bl'].every(k=>a.gps?.[k as keyof Bounds]));
 const bounds=calibrated?.gps as Bounds|undefined;
  const [location,setLocation]=useState<GpsFix|null>(null);
  const locationRef=useRef<GpsFix|null>(null);
  const rawGpsTimestamp=useRef(0);
  const lastGpsFixAt=useRef(0);
  const gpsAttemptId=useRef(0);
  const gpsInitialCancel=useRef<(()=>void)|null>(null);
  const gpsActivatingRef=useRef(false);
  const watchStartupTimeout=useRef<number|null>(null);
  const [geoError,setGeoError]=useState('');
  const [gpsPermissionRequired,setGpsPermissionRequired]=useState(false);
  const [gpsStarting,setGpsStarting]=useState(false);
  const [tracking,setTracking]=useState(false);
  const [sharing,setSharing]=useState(false);
  const [shareMode,setShareMode]=useState<ShareMode>('event');
  const [sharingExpiresAt,setSharingExpiresAt]=useState<number|null>(null);
  const [sharingEventId,setSharingEventId]=useState<string|null>(null);
  const [prefsReady,setPrefsReady]=useState(false);
  const [prefsSaving,setPrefsSaving]=useState(false);
  const [friends,setFriends]=useState<FriendLocation[]>([]);
  const [friendsReady,setFriendsReady]=useState(false);
  const sharingRef=useRef(false);
  const lastSend=useRef(0);
  const sendBusy=useRef(false);
  const shareEpoch=useRef(0);
  const [authRequired,setAuthRequired]=useState(false);
  const [friendError,setFriendError]=useState('');
  const requestLocation=async(route:string,body?:object)=>{const response=await fetch('/api/location/'+route,{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(response.status===401){setAuthRequired(true);throw Error('Entre na sua conta para compartilhar ou ver seus amigos.');}const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Falha na localização.'),{status:response.status});return data;};
  const watch=useRef<number|null>(null);
  const trackingRef=useRef(false);
  const savePrefs=async(gpsEnabled:boolean,shareEnabled:boolean,mode:ShareMode='event',eventId:string|null=null)=>{
   setPrefsSaving(true);
   try{
    const result=await requestLocation('preferences',{gpsEnabled,shareEnabled,mode,eventId});
    setSharingExpiresAt(result.expiresAt||null);
    setSharingEventId(result.eventId||null);
    return result;
   }catch(e){setFriendError(e instanceof Error?e.message:'Falha ao salvar preferências.');throw e;}
   finally{setPrefsSaving(false);}
  };
  useEffect(()=>{
   let alive=true;
   let permissionStatus:PermissionStatus|null=null;
   const checkPermission=async()=>{
    if(!navigator.geolocation||!navigator.permissions?.query){
     // Não abrir um prompt automaticamente em navegadores sem Permissions API.
     if(alive)setGpsPermissionRequired(true);
     return;
    }
    try{
     const status=await navigator.permissions.query({name:'geolocation'});
     if(!alive)return;
     permissionStatus=status;
     const apply=()=>{
      if(!alive||!sharingRef.current)return;
      if(status.state==='granted'){
       setGpsPermissionRequired(false);setGeoError('');
       if(watch.current===null&&!gpsActivatingRef.current)startGps();
      }else{
       // A consulta de permissões pode terminar durante um watchPosition
       // iniciado pelo clique do usuário. Não cancelar essa tentativa.
       if(status.state==='prompt'&&gpsActivatingRef.current)return;
       // Se o Android revogar o GPS, cancela uma aquisição pendente,
       // interrompe o monitoramento e retira a posição ativa do servidor.
       if(status.state==='denied'&&gpsActivatingRef.current){
        gpsAttemptId.current++;gpsActivatingRef.current=false;
        gpsInitialCancel.current?.();gpsInitialCancel.current=null;
       }
       const hadWatch=watch.current!==null;
       setGpsPermissionRequired(true);
       setGpsStarting(false);
       if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null;}
       if(hadWatch&&sharingRef.current)void requestLocation('stop',{}).catch(()=>{});
       setTracking(false);trackingRef.current=false;
       locationRef.current=null;setLocation(null);
       setGeoError(status.state==='denied'?'Localização bloqueada. Altere a permissão nas configurações do site.':'');
      }
     };
     status.onchange=apply;
     apply();
    }catch{
     if(alive)setGpsPermissionRequired(true);
    }
   };
   void requestLocation('preferences').then(p=>{
    if(!alive)return;
    setPrefsReady(true);
    setShareMode(p.mode==='4h'||p.mode==='1h'?p.mode:'event');
    setSharingExpiresAt(p.expiresAt||null);
    setSharingEventId(p.eventId||null);
    if(p.shareEnabled){
     sharingRef.current=true;setSharing(true);
     void checkPermission();
    }
   }).catch(()=>{if(alive)setPrefsReady(true);});
   const refresh=async()=>{
    try{
     const data=await requestLocation('friends');
     if(alive){setFriends(data.friends);setAuthRequired(false);}
    }catch(e){if(alive)setFriendError(e instanceof Error?e.message:'Falha ao carregar amigos.');}
    finally{if(alive)setFriendsReady(true);}
   };
   void refresh();
   const refreshTimer=window.setInterval(()=>void refresh(),10000);
   // Não solicitar a localização novamente: o watchPosition já monitora
   // o GPS, e chamadas adicionais abriam prompts em alguns Androids.
   const heartbeat=window.setInterval(()=>{
    // Não mostrar "GPS sem leituras" enquanto a primeira autorização
    // ou a primeira localização ainda está sendo solicitada.
    if(!sharingRef.current||watch.current===null||gpsActivatingRef.current||!trackingRef.current||!locationRef.current)return;
    if(Date.now()-lastGpsFixAt.current<=90000)sendLatestLocation(true);
    else setGeoError('O GPS parou de atualizar. Confira a localização do aparelho.');
   },20000);
   return()=>{
    alive=false;window.clearInterval(refreshTimer);window.clearInterval(heartbeat);
    if(permissionStatus)permissionStatus.onchange=null;
    gpsAttemptId.current++;
    gpsActivatingRef.current=false;
    gpsInitialCancel.current?.();gpsInitialCancel.current=null;
    if(watchStartupTimeout.current!==null){window.clearTimeout(watchStartupTimeout.current);watchStartupTimeout.current=null;}
    shareEpoch.current++;sharingRef.current=false;
    if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null;}
   };
  },[]);
  const sendLatestLocation=(heartbeat=false)=>{
   const position=locationRef.current;
   if(!sharingRef.current||!trackingRef.current||!position||sendBusy.current)return;
   if(Date.now()-lastSend.current<(heartbeat?15000:10000))return;
   const epoch=shareEpoch.current;
   sendBusy.current=true;
   void requestLocation('update',position).then(()=>{
    if(epoch===shareEpoch.current){lastSend.current=Date.now();setFriendError('');}
   }).catch(e=>{
    if(epoch!==shareEpoch.current)return;
    if((e as {status?:number}).status===410||(e as {status?:number}).status===403){
     endLocalSharing('O prazo de compartilhamento terminou ou foi desativado.');
    }else setFriendError(e instanceof Error?e.message:'Falha ao enviar localização.');
   }).finally(()=>{sendBusy.current=false;});
  };
  const consumeGpsPosition=(p:GeolocationPosition)=>{
   if(p.timestamp<rawGpsTimestamp.current)return;
   rawGpsTimestamp.current=p.timestamp;
   lastGpsFixAt.current=Date.now();
   if(watchStartupTimeout.current!==null){window.clearTimeout(watchStartupTimeout.current);watchStartupTimeout.current=null;}
   setGpsStarting(false);
   setGpsPermissionRequired(false);
   const next=stableGps(locationRef.current,{lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});
   locationRef.current=next;
   setLocation(next);setTracking(true);trackingRef.current=true;setGeoError('');
   sendLatestLocation();
  };
  const startGps=()=>{
   // Monitoramento contínuo começa automaticamente APENAS com permissão concedida
   // ou depois da primeira posição obtida por um clique explícito.
   if(watch.current!==null)return;
   if(!navigator.geolocation){setGpsStarting(false);setGeoError('GPS indisponível neste navegador.');return;}
   if(!locationRef.current)setGpsStarting(true);
   setGeoError('');
   watch.current=navigator.geolocation.watchPosition(consumeGpsPosition,error=>{
    if(watchStartupTimeout.current!==null){window.clearTimeout(watchStartupTimeout.current);watchStartupTimeout.current=null;}
    setGpsStarting(false);
    if(error.code!==1&&locationRef.current){
     // Falhas temporárias após um primeiro GPS válido não descartam o ponto
     // nem interrompem o rastreamento. A próxima leitura limpa o aviso.
     setGeoError('O GPS está demorando para atualizar a posição.');
     return;
    }
    setGpsPermissionRequired(error.code===1);
    setGeoError(gpsErrorText(error));
    setTracking(false);trackingRef.current=false;
    locationRef.current=null;setLocation(null);
    if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null;}
    if(error.code===1&&sharingRef.current)void requestLocation('stop',{}).catch(()=>{});
   },{enableHighAccuracy:true,maximumAge:5000,timeout:18000});
   if(!locationRef.current){
    watchStartupTimeout.current=window.setTimeout(()=>{
     if(watch.current===null||locationRef.current)return;
     navigator.geolocation.clearWatch(watch.current);watch.current=null;
     setGpsStarting(false);setTracking(false);trackingRef.current=false;
     setGeoError('Não recebemos coordenadas do Android. Toque em Ativar localização para tentar novamente.');
    },24000);
   }
  };
  const endLocalSharing=(message:string)=>{
   gpsAttemptId.current++;
   gpsActivatingRef.current=false;
   gpsInitialCancel.current?.();gpsInitialCancel.current=null;
   if(watchStartupTimeout.current!==null){window.clearTimeout(watchStartupTimeout.current);watchStartupTimeout.current=null;}
   if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null;}
   shareEpoch.current++;sharingRef.current=false;trackingRef.current=false;
   setTracking(false);setSharing(false);setGpsStarting(false);
   setLocation(null);locationRef.current=null;
   setSharingExpiresAt(null);setSharingEventId(null);
   setGeoError(message);
  };
  useEffect(()=>{
   if(!sharingExpiresAt)return;
   const check=()=>{
    if(Date.now()>=sharingExpiresAt)endLocalSharing('O compartilhamento terminou no horário escolhido.');
   };
   check();
   const timer=window.setInterval(check,5000);
   return()=>window.clearInterval(timer);
  },[sharingExpiresAt]);
  const cancelGpsStartup=()=>{
   gpsAttemptId.current++;
   gpsActivatingRef.current=false;
   gpsInitialCancel.current?.();gpsInitialCancel.current=null;
   if(watchStartupTimeout.current!==null){window.clearTimeout(watchStartupTimeout.current);watchStartupTimeout.current=null;}
   if(watch.current!==null&&!locationRef.current){navigator.geolocation.clearWatch(watch.current);watch.current=null;}
   setGpsStarting(false);
   setGeoError('Busca de localização cancelada.');
  };
  const stopSharing=async()=>{
   cancelGpsStartup();
   try{
    await savePrefs(false,false);
    shareEpoch.current++;sharingRef.current=false;setSharing(false);
    setGpsPermissionRequired(false);lastSend.current=0;
    setSharingExpiresAt(null);setSharingEventId(null);
    if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null;}
    trackingRef.current=false;setTracking(false);
    setLocation(null);locationRef.current=null;setGeoError('');
    await requestLocation('stop',{});
   }catch{}
  };
  // IMPORTANTE: NÃO tornar este handler async. O primeiro acesso ao GPS é
  // disparado sincronamente no clique, antes de qualquer fetch ou await.
  // Isso permite que o Android apresente seu diálogo de permissão quando
  // o site estiver no estado "perguntar".
  const startSharing=()=>{
   if(gpsActivatingRef.current||watch.current!==null)return;
   setFriendError('');
   if(authRequired){setFriendError('Entre no Perfil para compartilhar sua posição.');return;}
   if(!window.isSecureContext){setGeoError('GPS exige uma conexão HTTPS segura.');return;}
   if(!navigator.geolocation){setGeoError('GPS indisponível neste navegador.');return;}
   if(!sharingRef.current&&shareMode==='event'&&!selectedEventId){
    setGeoError('Selecione uma festa para compartilhar até o encerramento.');return;
   }
   gpsActivatingRef.current=true;
   setGpsStarting(true);setGeoError('');
   const attempt=++gpsAttemptId.current;
   const cancelled=()=>attempt!==gpsAttemptId.current;
   const onGpsSuccess=(position:GeolocationPosition)=>{
    if(cancelled())return;
    gpsInitialCancel.current=null;
    void (async()=>{
     try{
      // Só registra o compartilhamento no servidor depois que temos GPS real.
      if(!sharingRef.current){
       await savePrefs(true,true,shareMode,shareMode==='event'?selectedEventId:null);
       if(cancelled())return;
       shareEpoch.current++;
       sharingRef.current=true;setSharing(true);
      }
      if(cancelled())return;
      lastSend.current=0;
      rawGpsTimestamp.current=0;
      gpsActivatingRef.current=false;
      consumeGpsPosition(position);
      startGps();
     }catch(error){
      if(cancelled())return;
      gpsActivatingRef.current=false;
      setGpsStarting(false);
      setGeoError(error instanceof Error?error.message:'Não foi possível ativar a localização.');
     }
    })();
   };
   gpsInitialCancel.current=startInitialGps(navigator.geolocation,{
    onSuccess:onGpsSuccess,
    onError:error=>{
     if(cancelled())return;
     gpsInitialCancel.current=null;
     gpsActivatingRef.current=false;
     setGpsStarting(false);setTracking(false);trackingRef.current=false;
     setGpsPermissionRequired(error.code===1);
     setGeoError(gpsErrorText(error));
    }
   });
  };

 const mapped=location&&bounds?gpsToMap(location,bounds):null;
 const myOutside=mapped&&bounds&&!mapped.inside?offMapInfo(mapped,bounds):null;
 const friendMarkers=bounds?friends.map(f=>{
  const point=gpsToMap({lat:f.lat,lng:f.lng},bounds);
  return {...f,point,edge:point&&!point.inside?offMapInfo(point,bounds):null};
 }):[];
 const visibleFriends=friendMarkers.filter(f=>f.point?.inside);
 const outsideFriends=friendMarkers.filter(f=>f.point&&!f.point.inside);
 const distanceToVenue=myOutside?.outsideMeters??null;
 const positionUncertain=!!(location&&myOutside&&location.accuracy>=myOutside.outsideMeters);
 const scale=bounds?mapSize(bounds):null;
 const gpsActive=sharing&&tracking&&!!location&&!gpsPermissionRequired;
 const eventForSharing=eventChoices.find(event=>event.id===(sharingEventId||selectedEventId));
 const sharingDeadline=sharingExpiresAt?formatDeadline(sharingExpiresAt):'';
 const mapResolved=!selectedMap||(mapDataReady&&data?.map.id===selectedMap)||!!mapError;
 const showLoading=useMinimumLoading(!mapsReady||!mapResolved||!prefsReady||!friendsReady);
 if(showLoading){
  return <PageLoading label="Carregando mapa" description="Preparando o mapa e as localizações."/>;
 }

 return <section className="space-y-4">
 <div className="rounded-2xl border border-[#c4ff40]/25 bg-[#c4ff40]/[.055] p-4">
  <div className="flex items-center gap-2"><Navigation size={19} className="text-[#c4ff40]"/><h3 className="font-bold">Localização</h3></div>
  <fieldset disabled={sharing||gpsStarting||prefsSaving} className="mt-4 space-y-2 disabled:opacity-70">
   <legend className="mb-2 text-xs font-semibold text-white/70">Compartilhar por</legend>
   {([
    {value:'event',title:'Até o fim da festa',hint:eventForSharing?.ends_at?'Encerra em '+eventEndLabel(eventForSharing.ends_at):'Encerra automaticamente no horário do evento'},
    {value:'4h',title:'Por 4 horas',hint:'Encerra automaticamente em 4 horas'},
    {value:'1h',title:'Por 1 hora',hint:'Encerra automaticamente em 1 hora'}
   ] as const).map(option=><label key={option.value} className={'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition '+(shareMode===option.value?'border-[#c4ff40]/60 bg-[#c4ff40]/10':'border-white/15 bg-white/[.025]')}>
    <input type="radio" name="sharing-duration" checked={shareMode===option.value} onChange={()=>setShareMode(option.value)} value={option.value} className="h-4 w-4 shrink-0 accent-[#c4ff40]"/>
    <span className="min-w-0"><span className="block text-sm font-bold">{option.title}</span><span className="mt-0.5 block text-[11px] text-white/50">{option.hint}</span></span>
   </label>)}
  </fieldset>
  {sharing&&sharingExpiresAt&&<p className="mt-3 text-xs font-semibold text-[#c4ff40]">Compartilhamento ativo até {sharingDeadline}.</p>}
  <button
   disabled={!prefsReady||prefsSaving}
   aria-busy={gpsStarting}
   onClick={()=>{if(gpsStarting)cancelGpsStartup();else if(gpsActive)void stopSharing();else startSharing();}}
   className={'mt-3 w-full rounded-xl px-4 py-3.5 text-sm font-black disabled:opacity-50 '+(gpsActive?'border border-red-400/50 bg-red-400/5 text-red-200':'bg-[#c4ff40] text-black')}
  >{gpsStarting?'Cancelar busca de localização':gpsActive?'Desativar localização':'Ativar localização'}</button>
  <p className="mt-2 text-xs text-white/55">{gpsStarting?'Aguardando o GPS do aparelho...':gpsActive?'Sua posição está visível para seus amigos.':sharing?'O GPS deste aparelho ainda não está ativo.':'Seus amigos poderão ver sua posição enquanto o aplicativo estiver aberto.'}</p>
  {sharing&&!gpsActive&&!gpsStarting&&<button type="button" onClick={()=>void stopSharing()} className="mt-2 text-xs text-white/50 underline underline-offset-2">Desativar compartilhamento</button>}
  {authRequired&&<p className="mt-2 text-xs text-amber-300">Entre no Perfil para compartilhar.</p>}
  {geoError&&<p className="mt-2 text-xs text-amber-300">{geoError}</p>}
  {friendError&&<p className="mt-2 text-xs text-amber-300">{friendError}</p>}
  {friends.length>0&&<details className="mt-3 border-t border-white/10 pt-2 text-xs text-white/65"><summary className="cursor-pointer">Amigos compartilhando: {friends.length} · no mapa: {visibleFriends.length}</summary><div className="mt-2 space-y-1">{friends.map(f=>{const info=friendMarkers.find(p=>p.id===f.id);return <p key={f.id}>{f.name} · {info?.point?.inside?'no mapa':info?.edge?'fora do mapa ('+Math.round(info.edge.outsideMeters)+' m)':'posição indisponível'}</p>;})}</div></details>}
 </div>
 <div><h2 className="text-2xl font-black uppercase">Mapa do evento</h2></div>
 <div className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-xs">
  <div className="flex items-center gap-2 font-semibold"><MapPin size={15} className="text-[#c4ff40]"/> Sua posição</div>
  <p aria-live="polite" className="mt-1 text-white/65">{!location?(gpsStarting?'Obtendo sua posição...':'Ative a localização para aparecer no mapa.'):!bounds?'Aguardando calibração do mapa.':!mapped?'Não foi possível calcular sua posição; confira a calibração GPS.':mapped.inside?'Você está no mapa.':positionUncertain?'Você parece estar '+myOutside?.direction+' do mapa, mas o GPS está impreciso.':'Você está fora do mapa, '+myOutside?.direction+' · aproximadamente '+formatMapDistance(distanceToVenue||0)+'.'}</p>
  {location&&<p className="mt-1 text-white/40">Precisão do GPS: ±{Math.round(location.accuracy)} m</p>}
 </div>
 {calibrated?.gps?.mode==='demo-auto'&&<p className="rounded-lg border border-amber-300/20 px-3 py-2 text-xs text-amber-100/75">Localização aproximada. Os cantos ainda não foram medidos no espaço; para maior precisão, calibre o mapa.</p>}
 {maps.length>1&&<select aria-label="Selecionar mapa" value={selectedMap} onChange={e=>setSelectedMap(e.target.value)} className="w-full rounded-xl border border-white/20 bg-[#241b2c] p-3">{maps.map(m=><option key={m.id} value={m.id}>{displayLabel(m.name)}</option>)}</select>}
 {!selectedMap?<p className="rounded-xl border border-white/10 p-5 text-sm text-white/50">Este evento ainda não possui mapas publicados.</p>:<div className="overflow-hidden rounded-2xl border border-white/15 bg-[#17111d] p-3"><p className="mb-3 text-sm font-bold">{displayLabel(data?.map.name)||'Mapa'}</p><div ref={setMapElement} className="relative w-full overflow-hidden rounded-xl border border-white/20 bg-[#0e0c14]" style={{aspectRatio:mapFrameAspect(normalizeMapFrame(data?.map.frame)),backgroundImage:'linear-gradient(#ffffff12 1px,transparent 1px),linear-gradient(90deg,#ffffff12 1px,transparent 1px)',backgroundSize:'10% 10%'}}>
 {data?.areas.map(a=>{const color=validColor(a.color);return <div key={a.id} role="img" aria-label={'Ambiente: '+a.name} title={a.description||a.name} className="absolute border-2" style={{left:a.x+'%',top:a.y+'%',width:a.width+'%',height:a.height+'%',borderColor:color,backgroundColor:color+'33'}}/>;})}
 {roomLabels.map(label=>{
  const room=data?.areas.find(a=>a.id===label.id);
  if(!room)return null;
  const Icon=mapIcon(room.icon||room.kind);
  return <span key={'label-'+label.id} className="pointer-events-none absolute z-[5] flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded border border-white/15 bg-[#100d18]/90 px-1.5 py-1 text-[10px] font-bold text-white" style={{left:label.x+'%',top:label.y+'%',maxWidth:Math.max(room.width,10)+'%'}}><Icon size={12} className="shrink-0" style={{color:validColor(room.color)}}/><span className="truncate">{room.name}</span></span>;
 })}
 {data?.markers.map(m=>{const Icon=mapIcon(m.type),color=validColor(m.color,'#C4FF40'),size=Math.max(24,Math.min(72,m.size||42));return <button key={m.id} type="button" onClick={()=>setSelectedMarkerId(v=>v===m.id?null:m.id)} aria-label={m.name} title={m.description||m.name} className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center" style={{left:m.x+'%',top:m.y+'%'}}><span className={'flex items-center justify-center border-2 bg-[#15101b] shadow-lg '+(m.shape==='circle'?'rounded-full':'rounded-lg')} style={{width:size,height:size,borderColor:color,color}}><Icon size={Math.max(15,size*.5)}/></span><span className="max-w-24 rounded bg-black/90 px-1.5 py-0.5 text-[10px] font-bold">{m.name}</span></button>;})}
 {mapped?.inside&&location&&scale&&<div aria-label={'Margem de precisão do seu GPS: ±'+Math.round(location.accuracy)+' m'} className="pointer-events-none absolute z-[18] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-blue-400/40 bg-blue-400/10" style={{left:mapped.x+'%',top:mapped.y+'%',width:Math.min(75,2*location.accuracy/Math.max(scale.width,1)*100)+'%',height:Math.min(75,2*location.accuracy/Math.max(scale.height,1)*100)+'%'}}/>}
 {mapped?.inside&&<div aria-label="Sua localização aproximada" className="pointer-events-none absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-[0_0_0_6px_#33aaff55]" style={{left:mapped.x+'%',top:mapped.y+'%'}}/>}
 {myOutside&&<div
  role="img"
  aria-label={'Sua posição está '+myOutside.direction+' do mapa, a aproximadamente '+formatMapDistance(myOutside.outsideMeters)+'. Seta apontando para fora da área.'}
  title={'Você está '+myOutside.direction+' · ~'+formatMapDistance(myOutside.outsideMeters)}
  className="pointer-events-none absolute z-40 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-white shadow-[0_0_0_5px_#3b82f655,0_2px_14px_#000a]"
  style={{left:'clamp(20px, '+myOutside.edgeX+'%, calc(100% - 20px))',top:'clamp(20px, '+myOutside.edgeY+'%, calc(100% - 20px))'}}
 ><ArrowUp size={22} strokeWidth={3} style={{transform:'rotate('+myOutside.angleDegrees+'deg)'}}/></div>}
 {visibleFriends.map(f=><span key={f.id} title={f.name+' · precisão ±'+Math.round(f.accuracy)+' m'} className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-400 px-2 py-1 text-[10px] font-bold text-black" style={{left:f.point!.x+'%',top:f.point!.y+'%'}}>{f.name}</span>)}
 {outsideFriends.map(f=><span key={f.id} title={f.name+' fora da área de referência, a aproximadamente '+Math.round(f.edge!.outsideMeters)+' m do limite · precisão ±'+Math.round(f.accuracy)+' m'} className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-lg border border-amber-300 bg-[#231b13] px-1.5 py-1 text-[10px] font-bold text-amber-100" style={{left:f.edge!.edgeX+'%',top:f.edge!.edgeY+'%'}}><ArrowUp size={13} style={{transform:'rotate('+f.edge!.angleDegrees+'deg)'}}/> {f.name.slice(0,12)} · {f.edge!.outsideMeters<=f.accuracy?'perto do limite':'~'+formatMapDistance(f.edge!.outsideMeters)}</span>)}
 </div>{selectedMarkerId&&data?.markers.some(m=>m.id===selectedMarkerId)&&<div className="mt-3 rounded-xl border border-[#c4ff40]/25 bg-[#c4ff40]/5 p-3 text-xs"><p className="font-bold text-[#c4ff40]">{data.markers.find(m=>m.id===selectedMarkerId)?.name}</p><p className="mt-1 text-white/70">{data.markers.find(m=>m.id===selectedMarkerId)?.description||'Ponto de referência no mapa.'}</p></div>}</div>}
 {mapError&&<p role="alert" className="text-sm text-red-300">{mapError}</p>}
 </section>;
}
