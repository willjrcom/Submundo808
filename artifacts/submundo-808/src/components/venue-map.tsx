import {useEffect,useRef,useState} from 'react';
import {MapPin,Navigation,Info,Music2,Warehouse,Crown,Users,DoorOpen,Sofa,Utensils,Wine,Bath,Flag,Stethoscope} from 'lucide-react';
import {gpsToMap,stableGps,offMapInfo,mapSize,type GpsFix} from './map-location-utils';
type Geo={lat:number;lng:number};
type Bounds={tl:Geo;tr:Geo;br:Geo;bl:Geo};
type FriendLocation={id:string;name:string;lat:number;lng:number;accuracy:number;updatedAt:number};
type Area={id:string;name:string;kind:string;x:number;y:number;width:number;height:number;gps:Partial<Bounds>&{mode?:string;spacingMeters?:number;accuracyMeters?:number};color?:string;icon?:string;description?:string};
type Marker={id:string;name:string;type:string;x:number;y:number;shape?:'square'|'circle';size?:number;color?:string;description?:string};
type MapData={map:{id:string;name:string};areas:Area[];markers:Marker[]};
const mapIcon=(type:string)=>{
 const icons:Record<string,typeof MapPin>={pista:Music2,palco:Warehouse,vip:Crown,recepcao:Users,entrada:DoorOpen,descanso:Sofa,cozinha:Utensils,alimentacao:Utensils,bar:Wine,banheiro:Bath,saida:Flag,'posto-medico':Stethoscope};
 return icons[type]||MapPin;
};
const validColor=(color?:string,fallback='#9747FF')=>color&&/^#[0-9a-fA-F]{6}$/.test(color)?color:fallback;
export default function VenueMap(){
 const [maps,setMaps]=useState<{id:string;name:string}[]>([]);
 const [selectedMap,setSelectedMap]=useState('');
 const [selectedMarkerId,setSelectedMarkerId]=useState<string|null>(null);
 const [data,setData]=useState<MapData|null>(null);
 const [mapError,setMapError]=useState('');
 useEffect(()=>{let active=true;Promise.all([fetch('/api/public/events').then(r=>r.json()),fetch('/api/public/maps').then(r=>r.json())]).then(([events,mapsData])=>{if(!active)return;const event=events.items?.find((e:{id:string})=>e.id===localStorage.getItem('submundo-event-id'))||events.items?.[0];const filtered=(mapsData.items||[]).filter((m:{id:string})=>event?.map_ids?.includes(m.id));setMaps(filtered);setSelectedMap(filtered[0]?.id||'');}).catch(()=>{if(active)setMapError('Não foi possível carregar os mapas.');});return()=>{active=false;};},[]);
 useEffect(()=>{if(!selectedMap){setData(null);return;}let active=true;fetch('/api/public/map-detail?map_id='+encodeURIComponent(selectedMap)).then(async r=>{if(!r.ok)throw Error('Falha ao carregar mapa');return r.json();}).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setMapError(String(e));});return()=>{active=false;};},[selectedMap]);
 const calibrated=data?.areas.find(a=>['tl','tr','br','bl'].every(k=>a.gps?.[k as keyof Bounds]));
 const bounds=calibrated?.gps as Bounds|undefined;
  const [location,setLocation]=useState<GpsFix|null>(null);
  const locationRef=useRef<GpsFix|null>(null);
  const rawGpsTimestamp=useRef(0);
  const [geoError,setGeoError]=useState('');
  const [tracking,setTracking]=useState(false);
  const [sharing,setSharing]=useState(false);
  const [prefsReady,setPrefsReady]=useState(false);
  const [prefsSaving,setPrefsSaving]=useState(false);
  const [friends,setFriends]=useState<FriendLocation[]>([]);
  const sharingRef=useRef(false);
  const lastSend=useRef(0);
  const sendBusy=useRef(false);
  const shareEpoch=useRef(0);
  const [authRequired,setAuthRequired]=useState(false);
  const [friendError,setFriendError]=useState('');
  const requestLocation=async(route:string,body?:object)=>{const response=await fetch('/api/location/'+route,{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(response.status===401){setAuthRequired(true);throw Error('Entre na sua conta para compartilhar ou ver seus amigos.');}const data=await response.json();if(!response.ok)throw Error(data.error||'Falha na localização.');return data;};
  const watch=useRef<number|null>(null);
  const trackingRef=useRef(false);
  const savePrefs=async(gpsEnabled:boolean,shareEnabled:boolean)=>{setPrefsSaving(true);try{await requestLocation('preferences',{gpsEnabled,shareEnabled});}catch(e){setFriendError(e instanceof Error?e.message:'Falha ao salvar preferências.');throw e;}finally{setPrefsSaving(false);}};
  useEffect(()=>{
   let alive=true;
   void requestLocation('preferences').then(p=>{
    if(!alive)return;
    setPrefsReady(true);
    if(p.shareEnabled){sharingRef.current=true;setSharing(true);startGps();}
   }).catch(()=>{if(alive)setPrefsReady(true);});
   const refresh=async()=>{
    try{const data=await requestLocation('friends');if(alive){setFriends(data.friends);setAuthRequired(false);}}
    catch(e){if(alive)setFriendError(e instanceof Error?e.message:'Falha ao carregar amigos.');}
   };
   void refresh();
   const refreshTimer=window.setInterval(()=>void refresh(),15000);
   // Um GPS parado pode não disparar eventos: mantenha o último ponto válido
   // vivo no servidor, desde que o usuário ainda esteja compartilhando.
   const heartbeat=window.setInterval(()=>sendLatestLocation(true),20000);
   return()=>{
    alive=false;window.clearInterval(refreshTimer);window.clearInterval(heartbeat);
    shareEpoch.current++;sharingRef.current=false;
    if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null;}
    // Sair da tela não equivale a clicar em "Desativar compartilhamento".
    // O servidor deixa um GPS sem atualizações expirar naturalmente.
   };
  },[]);
  const sendLatestLocation=(heartbeat=false)=>{
   const position=locationRef.current;
   if(!sharingRef.current||!position||sendBusy.current)return;
   if(Date.now()-lastSend.current<(heartbeat?15000:10000))return;
   const epoch=shareEpoch.current;
   sendBusy.current=true;
   void requestLocation('update',position).then(()=>{
    if(epoch===shareEpoch.current){lastSend.current=Date.now();setFriendError('');}
   }).catch(e=>{
    if(epoch===shareEpoch.current)setFriendError(e instanceof Error?e.message:'Falha ao enviar localização.');
   }).finally(()=>{sendBusy.current=false;});
  };
  const startGps=()=>{
   if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null;}
   if(!navigator.geolocation){setGeoError('GPS indisponível neste navegador.');return;}
   setGeoError('');
   watch.current=navigator.geolocation.watchPosition(p=>{
    if(p.timestamp<rawGpsTimestamp.current)return;
    rawGpsTimestamp.current=p.timestamp;
    const next=stableGps(locationRef.current,{lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});
    locationRef.current=next;
    setLocation(next);setTracking(true);trackingRef.current=true;
    sendLatestLocation();
   },e=>{
    setGeoError(e.code===1?'Permissão de localização negada. Autorize a localização nas configurações do navegador para atualizar o GPS.':'Não foi possível obter a localização: '+e.message);
    setTracking(false);trackingRef.current=false;
    if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null;}
   },{enableHighAccuracy:true,maximumAge:3000,timeout:15000});
   setTracking(true);trackingRef.current=true;
  };
  const stopSharing=async()=>{try{await savePrefs(false,false);shareEpoch.current++;sharingRef.current=false;setSharing(false);lastSend.current=0;if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null;}trackingRef.current=false;setTracking(false);setLocation(null);locationRef.current=null;await requestLocation('stop',{});}catch{}};
  const startSharing=async()=>{setFriendError('');try{const me=await fetch('/api/auth/me',{credentials:'same-origin'}).then(r=>r.json());if(!me.user){setAuthRequired(true);setFriendError('Entre na sua conta antes de compartilhar sua localização.');return;}if(!navigator.geolocation){setFriendError('GPS indisponível.');return;}await savePrefs(true,true);shareEpoch.current++;sharingRef.current=true;setSharing(true);lastSend.current=0;startGps();}catch{}};


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

 return <section className="space-y-5"><div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#c4ff40]">Explore o espaço</p><h2 className="text-2xl font-black uppercase">Mapa do evento</h2><p className="mt-2 text-xs text-white/50">Mapa oficial somente para consulta. A edição é exclusiva do administrador.</p></div>
 <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm"><div className="flex items-center gap-2 font-bold"><Navigation size={16} className="text-[#c4ff40]"/> Sua localização</div><p className="mt-2 text-xs text-white/70">{!location?'Aguardando localização. Ative o GPS abaixo para se localizar.':!bounds?'GPS ativo, mas o mapa ainda não possui os quatro pontos de calibração.':mapped?.inside?'Você está dentro do mapa da festa.':positionUncertain?'Você pode estar próximo da festa; o GPS não tem precisão suficiente para confirmar.':'Você está fora do mapa da festa. A aproximadamente '+Math.round(distanceToVenue||0)+' metros do limite da área de referência.'}</p>{location&&<p className="mt-1 text-[11px] text-white/50">Precisão estimada ±{Math.round(location.accuracy)} m</p>}{bounds&&<p className="mt-2 text-xs text-white/60">Amigos dentro: {visibleFriends.length} · fora do mapa: {outsideFriends.length} · compartilhando: {friends.length}.</p>}</div>
 {calibrated?.gps?.mode==='demo-auto'&&<p role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-xs leading-relaxed text-amber-100">Mapa com calibração GPS <strong>estimada para demonstração</strong>: área de 50 × 40 m, com referências de {calibrated.gps.spacingMeters||10} m. Os cantos não foram medidos no local e a localização exibida pode apresentar desvio de ±{Math.round(calibrated.gps.accuracyMeters||0)} m ou mais. Para uso real, calibre manualmente no painel administrativo.</p>}
 {maps.length>1&&<select aria-label="Selecionar mapa" value={selectedMap} onChange={e=>setSelectedMap(e.target.value)} className="w-full rounded-xl border border-white/20 bg-[#241b2c] p-3">{maps.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>}
 {!selectedMap?<p className="rounded-xl border border-white/10 p-5 text-sm text-white/50">Este evento ainda não possui mapas publicados.</p>:<div className="overflow-hidden rounded-2xl border border-white/15 bg-[#17111d] p-3"><p className="mb-3 text-sm font-bold">{data?.map.name||'Carregando mapa...'}</p><div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/20 bg-[#0e0c14]" style={{backgroundImage:'linear-gradient(#ffffff12 1px,transparent 1px),linear-gradient(90deg,#ffffff12 1px,transparent 1px)',backgroundSize:'10% 10%'}}>
 {data?.areas.map(a=>{const Icon=mapIcon(a.icon||a.kind),color=validColor(a.color);return <div key={a.id} title={a.description||a.name} className="absolute flex flex-col items-center justify-center overflow-hidden border-2 p-1 text-center text-[10px] font-bold sm:text-xs" style={{left:a.x+'%',top:a.y+'%',width:a.width+'%',height:a.height+'%',borderColor:color,backgroundColor:color+'33'}}><Icon size={22} style={{color}} className="mb-1 shrink-0"/><span className="max-w-full break-words">{a.name}</span></div>;})}
 {data?.markers.map(m=>{const Icon=mapIcon(m.type),color=validColor(m.color,'#C4FF40'),size=Math.max(24,Math.min(72,m.size||42));return <button key={m.id} type="button" onClick={()=>setSelectedMarkerId(v=>v===m.id?null:m.id)} aria-label={m.name} title={m.description||m.name} className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center" style={{left:m.x+'%',top:m.y+'%'}}><span className={'flex items-center justify-center border-2 bg-[#15101b] shadow-lg '+(m.shape==='circle'?'rounded-full':'rounded-lg')} style={{width:size,height:size,borderColor:color,color}}><Icon size={Math.max(15,size*.5)}/></span><span className="max-w-24 rounded bg-black/90 px-1.5 py-0.5 text-[10px] font-bold">{m.name}</span></button>;})}
 {mapped?.inside&&location&&scale&&<div aria-label={'Margem de precisão do seu GPS: ±'+Math.round(location.accuracy)+' m'} className="pointer-events-none absolute z-[18] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-blue-400/40 bg-blue-400/10" style={{left:mapped.x+'%',top:mapped.y+'%',width:Math.min(75,2*location.accuracy/Math.max(scale.width,1)*100)+'%',height:Math.min(75,2*location.accuracy/Math.max(scale.height,1)*100)+'%'}}/>}
 {mapped?.inside&&<div aria-label="Sua localização aproximada" className="pointer-events-none absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-[0_0_0_6px_#33aaff55]" style={{left:mapped.x+'%',top:mapped.y+'%'}}/>}
 {myOutside&&<span aria-label={'Você está fora da área do mapa, aproximadamente '+Math.round(myOutside.outsideMeters)+' metros'} className="pointer-events-none absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-lg border border-blue-400 bg-[#0b1020] px-2 py-1 text-[10px] font-bold text-blue-200" style={{left:myOutside.edgeX+'%',top:myOutside.edgeY+'%'}}><Navigation size={14}/> Você · fora</span>}
 {visibleFriends.map(f=><span key={f.id} title={f.name+' · precisão ±'+Math.round(f.accuracy)+' m'} className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-400 px-2 py-1 text-[10px] font-bold text-black" style={{left:f.point!.x+'%',top:f.point!.y+'%'}}>{f.name}</span>)}
 {outsideFriends.map(f=><span key={f.id} title={f.name+' fora da área de referência, a aproximadamente '+Math.round(f.edge!.outsideMeters)+' m do limite · precisão ±'+Math.round(f.accuracy)+' m'} className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-lg border border-amber-300 bg-[#231b13] px-1.5 py-1 text-[10px] font-bold text-amber-100" style={{left:f.edge!.edgeX+'%',top:f.edge!.edgeY+'%'}}><Navigation size={13}/> {f.name.slice(0,12)} · fora</span>)}
 </div>{selectedMarkerId&&data?.markers.some(m=>m.id===selectedMarkerId)&&<div className="mt-3 rounded-xl border border-[#c4ff40]/25 bg-[#c4ff40]/5 p-3 text-xs"><p className="font-bold text-[#c4ff40]">{data.markers.find(m=>m.id===selectedMarkerId)?.name}</p><p className="mt-1 text-white/70">{data.markers.find(m=>m.id===selectedMarkerId)?.description||'Ponto de referência no mapa.'}</p></div>}</div>}
 {mapError&&<p role="alert" className="text-sm text-red-300">{mapError}</p>}
 <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="flex items-center gap-2"><Navigation size={19} className="text-[#c4ff40]"/><h3 className="font-bold">Localização com amigos</h3></div><p className="mt-2 text-xs text-white/60">Ao ativar, você permite que seus amigos vejam sua localização no mapa. Sua escolha fica salva na conta e será restaurada quando você voltar. O GPS só atualiza enquanto o navegador permitir.</p><button disabled={!prefsReady||prefsSaving} onClick={()=>void(sharing?stopSharing():startSharing())} className={'mt-4 w-full rounded-xl p-3 text-sm font-bold disabled:opacity-50 '+(sharing?'border border-red-400/50 text-red-200':'bg-[#c4ff40] text-black')}>{sharing?'Desativar localização e compartilhamento':'Ativar localização e compartilhar com amigos'}</button><p className="mt-3 text-xs text-white/50">Amigos compartilhando agora: {friends.length}{bounds?' · dentro: '+visibleFriends.length+' · fora: '+outsideFriends.length:''}</p>{friends.map(f=>{const friend=friendMarkers.find(p=>p.id===f.id);const edge=friend?.edge;return <p key={f.id} className="mt-2 text-xs">{f.name} · precisão ±{Math.round(f.accuracy)} m{friend?.point?.inside?' · dentro do mapa':edge?' · fora do mapa ('+(edge.outsideMeters<=f.accuracy?'perto do limite':Math.round(edge.outsideMeters)+' m do limite')+')':''}</p>;})}{location&&<p className="mt-3 text-xs text-white/60">Precisão do GPS: ±{Math.round(location.accuracy)} m{!bounds?' · mapa sem calibração GPS publicada':''}</p>}{authRequired&&<p className="mt-2 text-xs text-amber-300">Faça login no Perfil para compartilhar sua localização.</p>}{geoError&&<p className="mt-2 text-xs text-amber-300">{geoError}</p>}{friendError&&<p className="mt-2 text-xs text-amber-300">{friendError}</p>}</div>
 <p className="flex items-start gap-2 text-xs text-white/45"><Info size={16} className="shrink-0"/>O GPS pode oscilar mesmo com você parado. A posição é suavizada; usuários fora do mapa aparecem na borda como indicadores, não como posições dentro do evento.</p>
 </section>;
}
