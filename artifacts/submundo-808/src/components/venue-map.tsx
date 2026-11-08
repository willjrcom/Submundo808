import {useEffect,useRef,useState} from 'react';
import PageLoading from './page-loading';
import useMinimumLoading from './use-minimum-loading';
import {displayLabel,displayPublicDescription} from './display-label';
import {MapPin,Navigation,ArrowUp,Info} from 'lucide-react';
import {pointIconFor} from './map-point-icons';
import {gpsToMap,stableGps,offMapInfo,mapSize,formatMapDistance,distanceMeters,type GpsFix} from './map-location-utils';
import {mapPercentToGps} from './map-calibration-geometry';
import {startInitialGps,gpsErrorText} from './gps-acquisition';
import {mapFrameAspect,normalizeMapFrame,type MapFrame} from './map-frame-geometry';
import {normalizeMarker,markerIconStyle,type MarkerAnchor} from './map-marker-geometry';
import {areaPath,visibleAreas,type AreaGeometry} from './map-area-shapes';
import useMapLabels from './use-map-labels';
type Geo={lat:number;lng:number};
type Bounds={tl:Geo;tr:Geo;br:Geo;bl:Geo};
type FriendLocation={id:string;name:string;lat:number;lng:number;accuracy:number;updatedAt:number};
type EventChoice={id:string;name:string;ends_at:string;map_ids:string[];location_sharing_enabled:number};
type Area={id:string;name:string;kind:string;x:number;y:number;width:number;height:number;gps:Partial<Bounds>&{mode?:string;spacingMeters?:number;accuracyMeters?:number;rawCorners?:Partial<Bounds>;marginMeters?:number};color?:string;icon?:string;description?:string;geometry?:AreaGeometry};
type Marker={id:string;name:string;type:string;icon?:string;x:number;y:number;anchor?:MarkerAnchor;shape?:'square'|'circle';size?:number;color?:string;description?:string;opens_at?:string;closes_at?:string;categories?:string[];access_type?:string};
type MapData={map:{id:string;name:string;frame?:MapFrame};areas:Area[];markers:Marker[]};
type PointProduct={id:string;name:string;description:string;category:string;effective_price_cents:number};
const formatBRL=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
const EMPTY_AREAS:Area[]=[];
const EMPTY_MARKERS:Marker[]=[];
const validColor=(color?:string,fallback='#9747FF')=>color&&/^#[0-9a-fA-F]{6}$/.test(color)?color:fallback;
// Nomes internos de seed não são títulos de navegação para o público.
const publicMapName=(name?:string)=>{
 if(/^DEMO\s*[—–-]\s*Planta ilustrativa/i.test(name||''))return 'Planta do local';
 const cleaned=displayLabel(name||'').replace(/^DEMO\s*[—–-]\s*/i,'').replace(/\s+(ilustrativ[oa]|demonstrativ[oa])$/i,'').trim();
 return cleaned||'Planta do local';
};
// Somente o texto público é limpo; o cadastro original permanece acessível
// ao organizador para revisão antes da publicação de plantas reais.
const publicPointName=(name:string,isTemplate:boolean)=>{
 const label=displayLabel(name);
 return isTemplate?label.replace(/\s*\((?:demo|demonstração|teste)\)\s*$/i,'').replace(/\s+(ilustrativ[oa]|demonstrativ[oa])$/i,'').trim()||'Ponto de referência':label;
};
export default function VenueMap({activeEventId,onChooseEvent,focusRequest}:{activeEventId:string;onChooseEvent:()=>void;focusRequest?:{eventId:string;pointId:string;requestId:number}|null}){
 const [maps,setMaps]=useState<{id:string;name:string}[]>([]);
 const [selectedMap,setSelectedMap]=useState('');
 const [activeEvent,setActiveEvent]=useState<EventChoice|null>(null);
 const [loadedForEventId,setLoadedForEventId]=useState('');
 const activeEventRef=useRef(activeEventId);
 activeEventRef.current=activeEventId;
 const [data,setData]=useState<MapData|null>(null);
 const [selectedMarkerId,setSelectedMarkerId]=useState<string|null>(null);
 const [pointMenuOpen,setPointMenuOpen]=useState(false),[pointProducts,setPointProducts]=useState<PointProduct[]>([]),[pointCategory,setPointCategory]=useState(''),[pointMenuError,setPointMenuError]=useState(''),[pointMenuLoading,setPointMenuLoading]=useState(false);
 useEffect(()=>{setSelectedMarkerId(null);setPointMenuOpen(false);},[activeEventId,selectedMap]);
 const lastHandledFocus=useRef<number|null>(null);

 useEffect(()=>{if(!pointMenuOpen||!activeEventId)return;let alive=true;setPointMenuLoading(true);setPointMenuError('');
 fetch('/api/public/menu?event_id='+encodeURIComponent(activeEventId)).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Falha ao carregar produtos');return j;}).then(j=>{if(alive)setPointProducts(j.items||[]);}).catch(e=>{if(alive)setPointMenuError(e instanceof Error?e.message:'Falha ao carregar produtos');}).finally(()=>{if(alive)setPointMenuLoading(false);});
 return()=>{alive=false;};},[pointMenuOpen,activeEventId]);

 const {labels:roomLabels,pointLabels,setMapElement}=useMapLabels(data?.areas||EMPTY_AREAS,data?.markers||EMPTY_MARKERS);
 const [mapError,setMapError]=useState('');
 const [mapsReady,setMapsReady]=useState(false),[mapDataReady,setMapDataReady]=useState(false);
 useEffect(()=>{
  if(!activeEventId){
   setMaps([]);setActiveEvent(null);setSelectedMap('');setLoadedForEventId('');setMapsReady(true);setMapError('');
   return;
  }
  let active=true;
  setMapsReady(false);setMapError('');
  const load=async(url:string)=>{const response=await fetch(url);if(!response.ok)throw Error('Falha ao carregar eventos ou mapas.');return response.json();};
  Promise.all([load('/api/public/events'),load('/api/public/maps')])
   .then(([events,mapsData])=>{
    if(!active)return;
    const event:EventChoice|undefined=(events.items||[]).find((e:EventChoice)=>e.id===activeEventId);
    if(!event)throw Error('O evento selecionado não está mais disponível.');
    const filtered=(mapsData.items||[]).filter((m:{id:string})=>event.map_ids?.includes(m.id));
    setActiveEvent(event);setMaps(filtered);setSelectedMap(filtered[0]?.id||'');setLoadedForEventId(activeEventId);
   })
   .catch(error=>{if(active){setActiveEvent(null);setMaps([]);setSelectedMap('');setMapError(error instanceof Error?error.message:'Não foi possível carregar o evento.');setLoadedForEventId(activeEventId);}})
   .finally(()=>{if(active)setMapsReady(true);});
  return()=>{active=false;};
 },[activeEventId]);
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
 useEffect(()=>{
  if(!focusRequest||focusRequest.eventId!==activeEventId||lastHandledFocus.current===focusRequest.requestId||
     !mapsReady||!mapDataReady||!selectedMap||!data||data.map.id!==selectedMap)return;
  if(data.markers.some(marker=>marker.id===focusRequest.pointId)){
   lastHandledFocus.current=focusRequest.requestId;
   setSelectedMarkerId(focusRequest.pointId);setPointCategory('');setPointMenuOpen(true);
   return;
  }
  // Um ponto pode pertencer ao segundo ou terceiro mapa do evento.
  let active=true;
  const findMap=async()=>{
   for(const candidate of maps){
    if(!active)return;
    if(candidate.id===selectedMap)continue;
    try{
     const response=await fetch('/api/public/map-detail?map_id='+encodeURIComponent(candidate.id));
     if(!response.ok)continue;
     const result=await response.json();
     if(!active)return;
     if((result.markers||[]).some((m:Marker)=>m.id===focusRequest.pointId)){
      setSelectedMap(candidate.id);
      return;
     }
    }catch{/* Um mapa indisponível não impede tentar os demais. */}
   }
   if(active){lastHandledFocus.current=focusRequest.requestId;setMapError('O ponto indicado na notificação não está disponível neste evento.');}
  };
  void findMap();
  return()=>{active=false;};
 },[focusRequest,activeEventId,data,mapDataReady,mapsReady,maps,selectedMap]);
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
  // Device-only GPS never calls the server or activates friend sharing.
  const [localGpsEnabled,setLocalGpsEnabled]=useState(false);
  const [localGpsError,setLocalGpsError]=useState('');
  const localGpsWatch=useRef<number|null>(null);
  const [dontShareWithFriends,setDontShareWithFriends]=useState(false);
  const dontShareRef=useRef(false);
  const privacyRevision=useRef(0);
  const statisticsRevision=useRef(0);
  const unifiedActivationPending=useRef(false);
  // Do not silently resume sharing after a configured deadline or revocation.
  const autoShareSuppressed=useRef(false);
  const prefsQueue=useRef<Promise<void>>(Promise.resolve());
  // Consentimento de Estatísticas começa no toque informado e pode ser revogado
  // no Perfil; reativações automáticas preservam a escolha atual.
  const statisticsEnabledRef=useRef(false);
  const statisticsEventRef=useRef<string|null>(null);
  const [sharingExpiresAt,setSharingExpiresAt]=useState<number|null>(null);
  const [friends,setFriends]=useState<FriendLocation[]>([]);
  const [friendsReady,setFriendsReady]=useState(false);
  const sharingRef=useRef(false);
  const lastSend=useRef(0);
  const sendBusy=useRef(false);
  const shareEpoch=useRef(0);
  const [authRequired,setAuthRequired]=useState(false);
  const [friendError,setFriendError]=useState('');
  const requestLocation=async(route:string,body?:object)=>{
   const controller=new AbortController();
   const timeout=window.setTimeout(()=>controller.abort(),10000);
   try{
    const response=await fetch('/api/location/'+route,{
     method:body?'POST':'GET',credentials:'same-origin',
     headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,
     signal:controller.signal
    });
    if(response.status===401){setAuthRequired(true);throw Object.assign(new Error('Entre na sua conta para compartilhar ou ver seus amigos.'),{status:401});}
    const data=await response.json();
    if(!response.ok)throw Object.assign(new Error(data.error||'Falha na localização.'),{status:response.status});
    return data;
   }catch(error){
    if((error as Error).name==='AbortError')throw Error('Conexão muito lenta. O GPS e a planta continuam funcionando offline.');
    throw error;
   }finally{window.clearTimeout(timeout);}
  };
  const watch=useRef<number|null>(null);
  const trackingRef=useRef(false);
  const savePrefs=(gpsEnabled:boolean,shareEnabled:boolean,eventId:string|null=null,statisticsEnabled=false,unifiedActivation=false)=>{
   // Serialize enable/disable writes so a slow enable cannot overwrite a newer stop.
   const run=async()=>{
    try{
     const result=await requestLocation('preferences',{
      gpsEnabled,shareEnabled,mode:'event',eventId,shareWithGroups:false,
      analyticsEnabled:shareEnabled&&statisticsEnabled,
      unifiedActivation:shareEnabled&&unifiedActivation
     });
     setSharingExpiresAt(result.expiresAt||null);
     statisticsEnabledRef.current=result.analyticsEnabled===true;
     statisticsEventRef.current=result.analyticsEnabled===true?result.eventId||null:null;
     return result;
    }catch(error){setFriendError(error instanceof Error?error.message:'Falha ao salvar preferências.');throw error;}
   };
   const next=prefsQueue.current.then(run,run);
   prefsQueue.current=next.then(()=>{},()=>{});
   return next;
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
   const requestedPrivacyRevision=privacyRevision.current;
   const requestedStatisticsRevision=statisticsRevision.current;
   void requestLocation('preferences').then(p=>{
    if(!alive)return;
    if(statisticsRevision.current===requestedStatisticsRevision){
     statisticsEnabledRef.current=p.analyticsEnabled===true;
     statisticsEventRef.current=p.analyticsEnabled===true?p.eventId||null:null;
    }
    if(privacyRevision.current===requestedPrivacyRevision){
     dontShareRef.current=p.dontShareWithFriends===true;
     setDontShareWithFriends(dontShareRef.current);
    }
    setSharingExpiresAt(p.expiresAt||null);
    if(p.shareEnabled&&!dontShareRef.current&&localStorage.getItem('submundo-gps-stop-pending')!=='1'){
     if(!activeEventRef.current||p.eventId!==activeEventRef.current){
      // Do not resume GPS from a different festival or a legacy unscoped session.
      void requestLocation('preferences',{gpsEnabled:false,shareEnabled:false}).catch(()=>{});
      void requestLocation('stop',{}).catch(()=>{});
      setSharingExpiresAt(null);
     }else{
      sharingRef.current=true;setSharing(true);
      void checkPermission();
     }
    }
   }).catch(()=>{});
   const refresh=async()=>{
    const eventId=activeEventRef.current;
    if(!eventId){if(alive){setFriends([]);setFriendsReady(true);}return;}
    try{
     const data=await requestLocation('friends?event_id='+encodeURIComponent(eventId));
     if(alive&&activeEventRef.current===eventId){setFriends(data.friends);if(typeof data.locationSharingEnabled==='boolean')setActiveEvent(current=>current?.id===eventId?{...current,location_sharing_enabled:data.locationSharingEnabled?1:0}:current);setAuthRequired(false);setFriendError('');}
    }catch(e){if(alive&&activeEventRef.current===eventId)setFriendError(e instanceof Error?e.message:'Falha ao carregar amigos.');}
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
    else {
     // Nunca manter uma posição antiga como se fosse uma leitura atual.
     locationRef.current=null;setLocation(null);trackingRef.current=false;setTracking(false);
     setGeoError('O GPS parou de atualizar. A posição antiga foi ocultada; aguardando novo sinal.');
    }
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
   const currentEventId=activeEventRef.current;
   if(!currentEventId){sendBusy.current=false;return;}
   void requestLocation('update',{...position,eventId:currentEventId}).then(()=>{
    if(epoch===shareEpoch.current){lastSend.current=Date.now();setFriendError('');}
   }).catch(e=>{
    if(epoch!==shareEpoch.current)return;
    if([403,409,410].includes((e as {status?:number}).status||0)){
     endFriendShareKeepingGps('Compartilhamento encerrado. O GPS local continua ativo.');
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
  const toggleLocalPosition=()=>{
   if(localGpsWatch.current!==null){
    navigator.geolocation.clearWatch(localGpsWatch.current);localGpsWatch.current=null;
    setLocalGpsEnabled(false);setLocalGpsError('');
    if(!sharingRef.current){locationRef.current=null;setLocation(null);setTracking(false);trackingRef.current=false;}
    return;
   }
   if(!window.isSecureContext||!navigator.geolocation){setLocalGpsError('O GPS local exige HTTPS e a permissão de localização no aparelho.');return;}
   setLocalGpsError('');setLocalGpsEnabled(true);
   // User gesture begins geolocation watch directly; this works without internet.
   localGpsWatch.current=navigator.geolocation.watchPosition(
    position=>{consumeGpsPosition(position);setLocalGpsError('');},
    error=>{
     setLocalGpsError(gpsErrorText(error));
     // Quando a primeira leitura falha, liberar o watch para nova tentativa.
     if(error.code===1||!locationRef.current){
      if(localGpsWatch.current!==null)navigator.geolocation.clearWatch(localGpsWatch.current);
      localGpsWatch.current=null;setLocalGpsEnabled(false);
      setTracking(false);trackingRef.current=false;setLocation(null);locationRef.current=null;
     }
    },
    {enableHighAccuracy:true,maximumAge:5000,timeout:18000}
   );
  };
  useEffect(()=>{
   const interval=window.setInterval(()=>{
    if(localGpsWatch.current===null||!locationRef.current)return;
    if(Date.now()-lastGpsFixAt.current>90000){
     locationRef.current=null;setLocation(null);
     setLocalGpsError('Sem leituras recentes de GPS. Aguardando novo sinal do aparelho.');
    }
   },20000);
   return()=>{
    window.clearInterval(interval);
    if(localGpsWatch.current!==null){navigator.geolocation?.clearWatch(localGpsWatch.current);localGpsWatch.current=null;}
   };
  },[]);
  const endFriendShareKeepingGps=(message:string)=>{
   // Expiry/revocation stops publishing but never stops the phone's local GPS.
   autoShareSuppressed.current=true;
   shareEpoch.current++;sharingRef.current=false;setSharing(false);
   setSharingExpiresAt(null);
   setFriendError('');setGeoError(message);
  };
  const endLocalSharing=(message:string)=>{
   autoShareSuppressed.current=true;
   gpsAttemptId.current++;
   gpsActivatingRef.current=false;
   gpsInitialCancel.current?.();gpsInitialCancel.current=null;
   if(watchStartupTimeout.current!==null){window.clearTimeout(watchStartupTimeout.current);watchStartupTimeout.current=null;}
   if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null;}
   shareEpoch.current++;sharingRef.current=false;trackingRef.current=false;
   setTracking(false);setSharing(false);setGpsStarting(false);
   setLocation(null);locationRef.current=null;
   setSharingExpiresAt(null);
   setGeoError(message);
  };
  useEffect(()=>{
   if(!activeEvent||activeEvent.id!==activeEventId||activeEvent.location_sharing_enabled===1)return;
   setFriends([]);
   if(sharingRef.current||gpsActivatingRef.current||watch.current!==null){
    endFriendShareKeepingGps('O organizador desabilitou o compartilhamento. Sua posição local permanece disponível.');
    void requestLocation('preferences',{gpsEnabled:false,shareEnabled:false}).catch(()=>{});
    void requestLocation('stop',{}).catch(()=>{});
   }
  },[activeEvent?.id,activeEvent?.location_sharing_enabled,activeEventId]);
  useEffect(()=>{
   if(!sharingExpiresAt)return;
   const check=()=>{
    if(Date.now()>=sharingExpiresAt)endFriendShareKeepingGps('O compartilhamento terminou. O GPS local continua ativo.');
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
  const previousEventId=useRef(activeEventId);
  useEffect(()=>{
   const oldId=previousEventId.current;
   previousEventId.current=activeEventId;
   if(oldId===activeEventId)return;
   setFriends([]);setFriendError('');
   // Changing the active party must remove coordinates from the previous map.
   if(sharingRef.current||gpsActivatingRef.current||watch.current!==null){
    endLocalSharing('Compartilhamento encerrado ao trocar de evento.');
    void requestLocation('preferences',{gpsEnabled:false,shareEnabled:false}).catch(()=>{});
    void requestLocation('stop',{}).catch(()=>{});
   }
   if(activeEventId){
    void requestLocation('friends?event_id='+encodeURIComponent(activeEventId))
     .then(result=>{if(activeEventRef.current===activeEventId)setFriends(result.friends||[]);})
     .catch(()=>{});
   }
  },[activeEventId]);
  const stopSharing=async()=>{
   autoShareSuppressed.current=true;
   // Immediately stop the device's GPS, regardless of network availability.
   unifiedActivationPending.current=false;
   cancelGpsStartup();
   if(localGpsWatch.current!==null){navigator.geolocation.clearWatch(localGpsWatch.current);localGpsWatch.current=null;}
   setLocalGpsEnabled(false);setLocalGpsError('');
   if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null;}
   shareEpoch.current++;sharingRef.current=false;setSharing(false);
   setGpsPermissionRequired(false);lastSend.current=0;
   setSharingExpiresAt(null);
   trackingRef.current=false;setTracking(false);
   setLocation(null);locationRef.current=null;setGeoError('');
   // Persist an outstanding stop so a flaky/offline phone won't silently resume
   // previously shared location after network recovery.
   try{localStorage.setItem('submundo-gps-stop-pending','1');}catch{}
   if(!navigator.onLine){setGeoError('GPS parado. A desativação no servidor será sincronizada quando houver internet.');return;}
   try{
    await savePrefs(false,false);
    await requestLocation('stop',{});
    try{localStorage.removeItem('submundo-gps-stop-pending');}catch{}
    setFriendError('');
   }catch(error){
    setGeoError('GPS parado. Não foi possível confirmar a desativação no servidor; tentaremos ao reconectar.');
    setFriendError(error instanceof Error?error.message:'Falha ao interromper o compartilhamento.');
   }
  };
  // IMPORTANTE: NÃO tornar este handler async. O primeiro acesso ao GPS é
  // disparado sincronamente no clique, antes de qualquer fetch ou await.
  // Isso permite que o Android apresente seu diálogo de permissão quando
  // o site estiver no estado "perguntar".
  const startSharing=()=>{
   if(gpsActivatingRef.current||watch.current!==null)return;
   setFriendError('');
   if(authRequired){setFriendError('Entre no Perfil para compartilhar sua posição.');return;}
   if(activeEvent?.location_sharing_enabled!==1){setGeoError('A localização de amigos está desabilitada para este evento.');return;}
   if(!window.isSecureContext){setGeoError('GPS exige uma conexão HTTPS segura.');return;}
   if(!navigator.geolocation){setGeoError('GPS indisponível neste navegador.');return;}
   if(!sharingRef.current&&!activeEventId){
    setGeoError('Selecione uma festa para compartilhar até o encerramento.');return;
   }
   
   gpsActivatingRef.current=true;
   setGpsStarting(true);setGeoError('');
   const attempt=++gpsAttemptId.current;
   const cancelled=()=>attempt!==gpsAttemptId.current;
   const onGpsSuccess=(position:GeolocationPosition)=>{
    if(cancelled())return;
    gpsInitialCancel.current=null;
    // GPS starts rendering locally before waiting for the network. If sharing
    // cannot start, it remains available offline with the same single control.
    gpsActivatingRef.current=false;
    rawGpsTimestamp.current=0;
    consumeGpsPosition(position);
    startGps();
    if(dontShareRef.current||!navigator.onLine)return;
    void (async()=>{
     try{
      await savePrefs(true,true,activeEventId,true,unifiedActivationPending.current);
      unifiedActivationPending.current=false;
      if(cancelled()||dontShareRef.current)return;
      shareEpoch.current++;
      sharingRef.current=true;setSharing(true);
      lastSend.current=0;
      sendLatestLocation();
     }catch(error){
      if(cancelled())return;
      setFriendError('O GPS está ativo no aparelho, mas o compartilhamento não foi sincronizado. Continuaremos usando a planta offline.');
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

  const enableSharingWithActiveGps=async()=>{
   if(autoShareSuppressed.current||dontShareRef.current||sharingRef.current||!navigator.onLine||!activeEventId||
      activeEvent?.location_sharing_enabled!==1||authRequired||
      (localGpsWatch.current===null&&watch.current===null))return;
   try{
    await savePrefs(true,true,activeEventId,statisticsEnabledRef.current&&statisticsEventRef.current===activeEventId,unifiedActivationPending.current);
    unifiedActivationPending.current=false;
    if(dontShareRef.current||!navigator.onLine)return;
    shareEpoch.current++;sharingRef.current=true;setSharing(true);
    lastSend.current=0;sendLatestLocation();setFriendError('');
   }catch{
    setFriendError('GPS local ativo. Sem conexão para compartilhar com amigos; tentaremos quando a rede voltar.');
   }
  };
  const toggleUnifiedGps=()=>{
   if(localGpsWatch.current!==null&&!sharingRef.current){
    toggleLocalPosition();
    return;
   }
   if(watch.current!==null||gpsStarting){
    void stopSharing();
    return;
   }
   // Mesmo se uma sessão antiga existir, um novo gesto informa a ativação
   // conjunta de amigos e Estatísticas. Não copiar consentimento silenciosamente.
   autoShareSuppressed.current=false;
   // Somente o toque explícito autoriza amigos e Estatísticas.
   // Uma preferência antiga não é revogada silenciosamente ao carregar a tela.
   const canShare=activeEvent?.location_sharing_enabled===1&&!authRequired;
   // "Ativar GPS" (sem autorização para compartilhamento) continua só local.
   // Jamais iniciar transmissão se o organizador ativar a função depois.
   if(canShare){
    unifiedActivationPending.current=true;
    privacyRevision.current++;
    dontShareRef.current=false;setDontShareWithFriends(false);
    statisticsRevision.current++;
    statisticsEnabledRef.current=true;statisticsEventRef.current=activeEventId;
   }else{
    unifiedActivationPending.current=false;
   }
   // O Android precisa receber a solicitação de GPS no gesto original.
   try{localStorage.removeItem('submundo-gps-stop-pending');}catch{}
   if(navigator.onLine&&canShare){
    startSharing();
   }else{
    toggleLocalPosition();
   }
  };
  useEffect(()=>{
   const onPrivacyChange=(event:Event)=>{
    const disabled=(event as CustomEvent<{disabled:boolean}>).detail?.disabled===true;
    privacyRevision.current++;
    dontShareRef.current=disabled;setDontShareWithFriends(disabled);
    if(disabled){
     // The server already revoked live locations. Keep the device GPS running.
     shareEpoch.current++;sharingRef.current=false;setSharing(false);
     setSharingExpiresAt(null);setFriendError('');
    }else if(localGpsWatch.current!==null||watch.current!==null){
     void enableSharingWithActiveGps();
    }
   };
   const onOnline=()=>{
    if(localStorage.getItem('submundo-gps-stop-pending')==='1'){
     void requestLocation('preferences',{gpsEnabled:false,shareEnabled:false})
      .then(()=>requestLocation('stop',{}))
      .then(()=>{localStorage.removeItem('submundo-gps-stop-pending');})
      .catch(()=>{});
    }else if(localGpsWatch.current!==null||watch.current!==null){
     void enableSharingWithActiveGps();
    }
   };
   const onStopLocation=()=>{void stopSharing();};
   const onStorage=(event:StorageEvent)=>{
    if(event.key==='submundo-gps-stop-pending'&&event.newValue==='1')void stopSharing();
   };
   window.addEventListener('submundo-location-stop',onStopLocation);
   window.addEventListener('storage',onStorage);
   const onStatisticsConsent=(event:Event)=>{
    const detail=(event as CustomEvent<{eventId:string;enabled:boolean}>).detail;
    if(detail?.eventId!==activeEventId)return;
    statisticsEnabledRef.current=detail.enabled;
    statisticsEventRef.current=detail.enabled?detail.eventId:null;
   };
   window.addEventListener('submundo-statistics-consent',onStatisticsConsent);
   window.addEventListener('submundo-friend-sharing-privacy',onPrivacyChange);
   window.addEventListener('online',onOnline);
   if(navigator.onLine)onOnline();
   return()=>{window.removeEventListener('submundo-location-stop',onStopLocation);window.removeEventListener('storage',onStorage);window.removeEventListener('submundo-statistics-consent',onStatisticsConsent);window.removeEventListener('submundo-friend-sharing-privacy',onPrivacyChange);window.removeEventListener('online',onOnline);};
  },[activeEventId,authRequired]);

 // Não projetar pessoas em plantas cujas referências geográficas não foram
 // validadas: a grade de seed não corresponde ao espaço físico do evento.
 const mapIsDemo=calibrated?.gps?.mode==='demo-auto'||data?.map.name.startsWith('DEMO —');
 const mapped=location&&bounds&&!mapIsDemo?gpsToMap(location,bounds):null;
 const myOutside=mapped&&bounds&&!mapped.inside?offMapInfo(mapped,bounds):null;
 const friendMarkers=bounds&&!mapIsDemo?friends.map(f=>{
  const point=gpsToMap({lat:f.lat,lng:f.lng},bounds);
  return {...f,point,edge:point&&!point.inside?offMapInfo(point,bounds):null};
 }):[];
 const visibleFriends=friendMarkers.filter(f=>f.point?.inside);
 const outsideFriends=friendMarkers.filter(f=>f.point&&!f.point.inside);
 const distanceToVenue=myOutside?.outsideMeters??null;
 const positionUncertain=!!(location&&myOutside&&location.accuracy>=myOutside.outsideMeters);
 // Uma entrada cadastrada no mapa vira o destino; caso contrário mostramos
 // apenas direção à borda, sem inventar uma rota ou entrada oficial.
 // A margem de 5 m expande a visualização. Para orientar até a entrada
 // física, prefira os quatro cantos medidos ANTES dessa margem.
 const measuredEntranceBounds=calibrated?.gps?.rawCorners&&(['tl','tr','br','bl'] as const).every(k=>calibrated.gps.rawCorners?.[k])
  ?calibrated.gps.rawCorners as Bounds:bounds;
 const entrances=location&&measuredEntranceBounds&&!mapIsDemo?data?.markers.filter(m=>m.type==='entrada').map(m=>{
  const target=mapPercentToGps(m.x,m.y,measuredEntranceBounds);
  return {...m,target,meters:distanceMeters(location,target)};
 }).sort((a,b)=>a.meters-b.meters)||[]:[];
 const closestEntrance=entrances[0]||null;
 const directionPoint=closestEntrance?{x:closestEntrance.x,y:closestEntrance.y}:
  mapped?{x:Math.max(0,Math.min(100,mapped.x)),y:Math.max(0,Math.min(100,mapped.y))}:null;
 const directionAngle=mapped&&directionPoint?(Math.atan2(directionPoint.x-mapped.x,mapped.y-directionPoint.y)*180/Math.PI+360)%360:0;
 const directLineStart=mapped?{x:Math.max(0,Math.min(100,mapped.x)),y:Math.max(0,Math.min(100,mapped.y))}:null;
 const directionsUrl=closestEntrance?'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(closestEntrance.target.lat+','+closestEntrance.target.lng):null;
 const scale=bounds?mapSize(bounds):null;
 const eventForSharing=activeEvent;
 const mapResolved=!selectedMap||(mapDataReady&&data?.map.id===selectedMap)||!!mapError;
 const showLoading=useMinimumLoading(!!activeEventId&&(!mapsReady||loadedForEventId!==activeEventId||!mapResolved));
 if(showLoading){
  return <PageLoading label="Carregando mapa" description="Preparando o mapa e as localizações."/>;
 }
 if(!activeEventId)return <div className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-6">
  <MapPin className="text-[#c4ff40]"/>
  <h1 className="text-2xl font-black uppercase">Mapa</h1>
  <p className="text-sm text-white/65">Escolha uma festa na aba Início para visualizar o mapa daquele evento.</p>
  <button type="button" onClick={onChooseEvent} className="rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-bold text-black">Escolher evento</button>
 </div>;

 return <section className="space-y-3">
 {(!tracking||!location)&&<div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#c4ff40]/20 bg-[#c4ff40]/[.035] px-3 py-2.5" aria-label="Ativar minha localização">
  <Navigation size={18} className="shrink-0 text-[#c4ff40]"/>
  <div className="min-w-0 flex-1">
   <p className="text-sm font-bold">Minha localização</p>
   <p className="text-[11px] leading-relaxed text-white/60">{activeEvent?.location_sharing_enabled!==1?'GPS só neste aparelho: o evento não permite compartilhar.':'Ao ativar, sua posição será compartilhada com amigos e contribuirá para Estatísticas agregadas até o fim da festa. Para encerrar, acesse Perfil → Permissões.'}</p>
  </div>
  <button type="button" onClick={toggleUnifiedGps} disabled={gpsStarting||localGpsEnabled}
   className="shrink-0 rounded-lg bg-[#c4ff40] px-3 py-2 text-xs font-bold text-black disabled:opacity-60">
   {gpsStarting||localGpsEnabled?'Ativando...':activeEvent?.location_sharing_enabled!==1||authRequired?'Ativar GPS':'Ativar GPS e compartilhar'}
  </button>
  {gpsStarting&&<p className="w-full text-xs text-white/60">Obtendo a posição do aparelho...</p>}
  {localGpsError&&<p role="status" className="w-full text-xs text-amber-300">{localGpsError}</p>}
  {geoError&&<p role="status" className="w-full text-xs text-amber-300">{geoError}</p>}
  {friendError&&sharing&&<p className="w-full text-xs text-amber-300">Os amigos não puderam ser atualizados. O GPS local continua funcionando.</p>}
 </div>}
 <div className="flex flex-wrap items-center justify-between gap-2">
  <h2 className="text-xl font-black uppercase">Mapa do evento</h2>
  {activeEvent&&<span className="max-w-[65%] truncate rounded-lg border border-[#c4ff40]/25 bg-[#c4ff40]/5 px-2 py-1 text-[11px] font-semibold text-[#c4ff40]" title={displayLabel(activeEvent.name)}>{displayLabel(activeEvent.name)}</span>}
 </div>
  {maps.length>1&&<select aria-label="Selecionar mapa" value={selectedMap} onChange={e=>setSelectedMap(e.target.value)} className="w-full rounded-xl border border-white/20 bg-[#241b2c] p-3">{maps.map(m=><option key={m.id} value={m.id}>{publicMapName(m.name)}</option>)}</select>}
 {!selectedMap?<p className="rounded-xl border border-white/10 p-5 text-sm text-white/50">Este evento ainda não possui mapas publicados.</p>:<div className="overflow-visible rounded-2xl border border-white/15 bg-[#17111d] p-3 sm:p-5"><p className="mb-2 text-xs font-bold">{publicMapName(data?.map.name)}</p><div ref={setMapElement} className="relative w-full overflow-visible rounded-xl border border-white/20 bg-[#0e0c14]" style={{aspectRatio:mapFrameAspect(normalizeMapFrame(data?.map.frame)),backgroundImage:'linear-gradient(#ffffff12 1px,transparent 1px),linear-gradient(90deg,#ffffff12 1px,transparent 1px)',backgroundSize:'10% 10%'}}>
 <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Ambientes da planta">
  {data&&visibleAreas(data.areas).map(a=>{const color=validColor(a.color),name=publicPointName(a.name,!!mapIsDemo);
   return <path key={a.id} d={areaPath(data.areas,a.id)} fill={color+'33'} stroke={color} strokeWidth={0.45} vectorEffect="non-scaling-stroke" fillRule="evenodd"><title>{displayPublicDescription(a.description)||name}</title></path>;
  })}
 </svg>
 {roomLabels.map(label=>{
  const room=data?.areas.find(a=>a.id===label.id);
  if(!room)return null;
  const Icon=pointIconFor(room.kind,room.icon);
  return <span key={'label-'+label.id} className="pointer-events-none absolute z-[5] flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded border border-white/15 bg-[#100d18]/90 px-1.5 py-1 text-[10px] font-bold text-white" style={{left:label.x+'%',top:label.y+'%',maxWidth:Math.max(room.width,10)+'%'}}><Icon size={12} className="shrink-0" style={{color:validColor(room.color)}}/><span className="truncate">{publicPointName(room.name,!!mapIsDemo)}</span></span>;
 })}
 {data?.markers.map(m=>{const Icon=pointIconFor(m.type,m.icon),selected=selectedMarkerId===m.id,color=selected?'#ff4b57':validColor(m.color,'#C4FF40'),size=Math.max(24,Math.min(72,m.size||42));
  return <button key={m.id} type="button" onClick={()=>{setSelectedMarkerId(m.id);setPointCategory('');setPointMenuOpen(true);}}
    aria-label={publicPointName(m.name,!!mapIsDemo)+(selected?' (selecionado)':'')} aria-pressed={selected} title={displayPublicDescription(m.description)||publicPointName(m.name,!!mapIsDemo)}
    className={'text-center transition-[filter] duration-200 '+(selected?'z-[25] drop-shadow-[0_0_10px_#ff4b57]':'z-10')}
    style={markerIconStyle(m,size)}>
    <span className={'relative flex h-full w-full items-center justify-center border-2 shadow-lg transition-colors duration-200 '+(m.shape==='circle'?'rounded-full':'rounded-lg')+(selected?' bg-[#45151f] ring-[3px] ring-[#ff4b57] ring-offset-2 ring-offset-[#110e17]':' bg-[#15101b]')} style={{borderColor:color,color}}><Icon size={Math.max(15,size*.5)} style={{width:'52%',height:'52%'}}/>{selected&&<span aria-hidden="true" className="pointer-events-none absolute -right-2 -top-2 h-3 w-3 rounded-full border-2 border-[#110e17] bg-[#ff4b57]"/>}</span>
  </button>;})}
 {pointLabels.filter(label=>label.visible).map(label=>{const m=data?.markers[label.index];if(!m)return null;return <span key={'point-label-'+m.id} className="pointer-events-none absolute z-[19] max-w-[116px] -translate-x-1/2 -translate-y-1/2 truncate whitespace-nowrap rounded border border-white/10 bg-black/90 px-1.5 py-1 text-center text-[10px] font-bold text-white" style={{left:label.x+'%',top:label.y+'%'}}>{publicPointName(m.name,!!mapIsDemo)}</span>;})}
 {mapped?.inside&&location&&scale&&<div aria-label={'Margem de precisão do seu GPS: ±'+Math.round(location.accuracy)+' m'} className="pointer-events-none absolute z-[18] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-blue-400/40 bg-blue-400/10" style={{left:mapped.x+'%',top:mapped.y+'%',width:Math.min(75,2*location.accuracy/Math.max(scale.width,1)*100)+'%',height:Math.min(75,2*location.accuracy/Math.max(scale.height,1)*100)+'%'}}/>}
 {mapped?.inside&&<div aria-label="Sua localização aproximada" className="pointer-events-none absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-[0_0_0_6px_#33aaff55]" style={{left:mapped.x+'%',top:mapped.y+'%'}}/>}
 {myOutside&&directionPoint&&!mapIsDemo&&<div
  role="img"
  aria-label={'Sua posição está '+myOutside.direction+' do mapa, a aproximadamente '+formatMapDistance(myOutside.outsideMeters)+'. Seta indicando a direção '+(closestEntrance?'da entrada '+closestEntrance.name:'da borda mais próxima')+'.'}
  title={'Você está '+myOutside.direction+' · ~'+formatMapDistance(myOutside.outsideMeters)}
  className="pointer-events-none absolute z-40 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-white shadow-[0_0_0_5px_#3b82f655,0_2px_14px_#000a]"
  style={{left:'clamp(20px, '+myOutside.edgeX+'%, calc(100% - 20px))',top:'clamp(20px, '+myOutside.edgeY+'%, calc(100% - 20px))'}}
 ><ArrowUp size={22} strokeWidth={3} style={{transform:'rotate('+directionAngle+'deg)'}}/></div>}
 {myOutside&&directionPoint&&directLineStart&&closestEntrance&&!mapIsDemo&&<svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[16] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
  <line x1={directLineStart.x} y1={directLineStart.y} x2={directionPoint.x} y2={directionPoint.y}
   stroke="#c4ff40" strokeWidth=".7" strokeDasharray="2 2" strokeLinecap="round"/>
 </svg>}
 {visibleFriends.map(f=><span key={f.id} title={f.name+' · precisão ±'+Math.round(f.accuracy)+' m'} className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-400 px-2 py-1 text-[10px] font-bold text-black" style={{left:f.point!.x+'%',top:f.point!.y+'%'}}>{f.name}</span>)}
 {outsideFriends.map(f=><span key={f.id} title={f.name+' fora da área de referência, a aproximadamente '+Math.round(f.edge!.outsideMeters)+' m do limite · precisão ±'+Math.round(f.accuracy)+' m'} className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-lg border border-amber-300 bg-[#231b13] px-1.5 py-1 text-[10px] font-bold text-amber-100" style={{left:f.edge!.edgeX+'%',top:f.edge!.edgeY+'%'}}><ArrowUp size={13} style={{transform:'rotate('+f.edge!.angleDegrees+'deg)'}}/> {f.name.slice(0,12)} · {f.edge!.outsideMeters<=f.accuracy?'perto do limite':'~'+formatMapDistance(f.edge!.outsideMeters)}</span>)}
 </div></div>}

 {myOutside&&!mapIsDemo&&<section aria-label="Orientação até o evento" className="flex flex-wrap items-center gap-2 rounded-xl border border-[#c4ff40]/25 bg-[#211a29] px-3 py-2.5 text-xs">
  <Navigation size={17} className="shrink-0 text-[#c4ff40]"/>
  <p className="min-w-0 flex-1 text-white/75"><strong className="text-white">{positionUncertain?'Perto do limite do mapa':'Fora do mapa'}</strong> · {positionUncertain?'Precisão do GPS insuficiente.':closestEntrance?'Entrada '+closestEntrance.name+' a ~'+formatMapDistance(closestEntrance.meters)+' em linha reta.':'Borda a ~'+formatMapDistance(myOutside.outsideMeters)+'.'}</p>
  {directionsUrl&&<a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#c4ff40]/50 px-2.5 py-1.5 font-bold text-[#c4ff40]"><Navigation size={13}/> Como chegar à entrada</a>}
 </section>}
 {pointMenuOpen&&selectedMarkerId&&data?.markers.some(m=>m.id===selectedMarkerId)&&(()=>{const marker=data.markers.find(m=>m.id===selectedMarkerId)!;const cats=marker.categories||[];const products=pointProducts.filter(p=>cats.includes(p.category)&&(!pointCategory||p.category===pointCategory));return <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80 sm:items-center sm:p-5" onClick={e=>{if(e.currentTarget===e.target)setPointMenuOpen(false);}}><section role="dialog" aria-modal="true" aria-label={'Detalhes de '+marker.name} className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#c4ff40]/25 bg-[#17111e] sm:rounded-3xl"><div className="space-y-3 border-b border-white/10 p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-black">{publicPointName(marker.name,!!mapIsDemo)}</h3><p className="mt-1 text-xs text-white/60">{displayPublicDescription(marker.description)||'Ponto de referência no mapa.'}</p></div><button type="button" aria-label="Fechar cardápio" onClick={()=>setPointMenuOpen(false)} className="rounded-lg border border-white/20 px-3 py-2">✕</button></div>{marker.opens_at&&marker.closes_at&&<p className="text-xs text-[#c4ff40]">Funcionamento: {marker.opens_at} às {marker.closes_at}</p>}{cats.length>0&&<div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setPointCategory('')} className={'rounded-lg border px-3 py-2 text-xs '+(!pointCategory?'border-[#c4ff40] text-[#c4ff40]':'border-white/20 text-white/60')}>Todos</button>{cats.map(category=><button key={category} type="button" onClick={()=>setPointCategory(category)} className={'rounded-lg border px-3 py-2 text-xs '+(pointCategory===category?'border-[#c4ff40] text-[#c4ff40]':'border-white/20 text-white/60')}>{category}</button>)}</div>}</div><div className="min-h-0 overflow-y-auto p-4">{pointMenuLoading?<p className="p-5 text-sm text-white/60">Carregando produtos...</p>:pointMenuError?<p role="alert" className="p-5 text-sm text-red-300">{pointMenuError}</p>:!products.length?<p className="p-5 text-sm text-white/60">{cats.length?'Nenhum produto dessas categorias está cadastrado para este evento.':'Este ponto não possui produtos vinculados.'}</p>:<div className="space-y-2">{products.map(p=><div key={p.id} className="flex justify-between gap-3 rounded-xl border border-white/10 bg-white/[.035] p-4"><div><p className="font-semibold">{p.name}</p>{displayPublicDescription(p.description)&&<p className="mt-1 text-xs text-white/55">{displayPublicDescription(p.description)}</p>}<p className="mt-1 text-xs text-white/40">{p.category}</p></div><span className="shrink-0 font-bold text-[#c4ff40]">{formatBRL(p.effective_price_cents)}</span></div>)}</div>}</div></section></div>;})()}
 <div className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-xs">
  <div className="flex items-center gap-2 font-semibold"><MapPin size={15} className="text-[#c4ff40]"/> Sua posição</div>
  <p aria-live="polite" className="mt-1 text-white/65">{!location?(gpsStarting||localGpsEnabled?'Obtendo sua posição pelo GPS...':'Ative a localização para aparecer no mapa.'):!bounds?'Aguardando calibração do mapa.':!mapped?'Não foi possível calcular sua posição; confira a calibração GPS.':mapIsDemo?'A localização nesta planta estará disponível após a calibração GPS do local.':mapped.inside?'Você está no mapa.':positionUncertain?'Você está próximo ao limite do mapa, mas o GPS está impreciso.':closestEntrance?'Você está fora do mapa. Entrada a aproximadamente '+formatMapDistance(closestEntrance.meters)+' em linha reta.':'Você está fora do mapa, '+myOutside?.direction+' · aproximadamente '+formatMapDistance(distanceToVenue||0)+' da borda.'}</p>
  {location&&<p className="mt-1 text-white/40">Precisão do GPS: ±{Math.round(location.accuracy)} m</p>}
 </div>
 {mapIsDemo&&<p className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55">Para utilizar a orientação por GPS nesta planta, o local precisa estar calibrado.</p>}
 {mapError&&<p role="alert" className="text-sm text-red-300">{mapError}</p>}
 </section>;
}
