import {useEffect,useMemo,useRef,useState} from 'react';
import {advanceGpsSimulation,createGpsSimulation,simulationHotspots,SIMULATION_INTERVAL_MS,SIMULATION_RADIUS_METERS,SIMULATION_STEP_MINUTES,type CrowdGpsSimulation,type SimulationZone} from './crowd-gps-simulator';
import {Activity,BarChart3,MapPin,RefreshCw,Eye,EyeOff,AlertTriangle,Users,TrendingUp,Play,Square,LocateFixed,Footprints} from 'lucide-react';
import {AreaChart,Area,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';

type EventItem={id:string;name:string;starts_at?:string;location_sharing_enabled?:number};
type Zone={id:string;name:string;x:number;y:number;width:number;height:number;count:number|null};
type MapInfo={id:string;name:string;calibrated:boolean;areas:Zone[]};
type Live={event:{id:string;name:string};updatedAt:number;minimumGroup:number;participants:number|null;classified:number|null;unclassified:number|null;maps:MapInfo[];refreshSeconds:number};
type Hotspot={id:string;mapId:string;name:string;mapName:string;average:number;peak:number;samples:number};
type History={period:string;series:{at:number;participants:number|null}[];hotspots:Hotspot[];snapshotCount:number;lastSnapshotAt:number|null;minimumGroup:number};
type Props={events:EventItem[];compact?:boolean;onOpenReports?:()=>void};

const noData='Amostra insuficiente';
function countText(n:number|null|undefined){return n===null||n===undefined?noData:new Intl.NumberFormat('pt-BR').format(n);}
function timeText(at:number,day=false){return new Date(at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:day?'2-digit':undefined,month:day?'2-digit':undefined,hour:'2-digit',minute:'2-digit'});}
async function get<T>(path:string):Promise<T>{
 const r=await fetch('/api/admin/'+path,{credentials:'same-origin',cache:'no-store'});
 const j=await r.json();
 if(!r.ok)throw Error(j.error||'Não foi possível consultar a movimentação.');
 return j as T;
}
function exampleMaps(maps:MapInfo[]):MapInfo[]{
 const source=maps.length?maps:[{id:'example',name:'Planta demonstrativa',calibrated:false,areas:[
  {id:'pista',name:'Pista',x:5,y:5,width:63,height:55,count:0},
  {id:'palco',name:'Palco',x:70,y:5,width:26,height:55,count:0},
  {id:'bar',name:'Bares',x:5,y:64,width:46,height:32,count:0},
  {id:'lounge',name:'Área externa',x:55,y:64,width:41,height:32,count:0}
 ]}];
 return source.map(map=>({...map,calibrated:true,areas:map.areas.map((a,i)=>({...a,count:[186,128,78,36,24,12][i%6]}))}));
}
function congestionColor(n:number|null,peak:number){
 if(n===null)return 'rgba(148,163,184,.14)';
 if(n===0)return 'rgba(22,163,74,.12)';
 const ratio=n/Math.max(peak,1);
 if(ratio>=.75)return 'rgba(239,68,68,.37)';
 if(ratio>=.5)return 'rgba(249,115,22,.33)';
 if(ratio>=.25)return 'rgba(234,179,8,.29)';
 return 'rgba(132,204,22,.22)';
}
export default function AdminCrowd({events,compact=false,onOpenReports}:Props){
 const [eventId,setEventId]=useState('');
 const [selectedMapId,setSelectedMapId]=useState('');
 const [view,setView]=useState<'live'|'history'>('live');
 const [period,setPeriod]=useState<'24h'|'7d'|'30d'>('24h');
 const [example,setExample]=useState(false);
 const [simulation,setSimulation]=useState<CrowdGpsSimulation|null>(null);
 const [simulatingGps,setSimulatingGps]=useState(false);
 const gpsRequestId=useRef(0);
 const [simulationSize,setSimulationSize]=useState(140);
 const [live,setLive]=useState<Live|null>(null),[history,setHistory]=useState<History|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const eventOptions=useMemo(()=>[...events].sort((a,b)=>(b.starts_at||'').localeCompare(a.starts_at||'')),[events]);
 const currentEvent=eventOptions.some(e=>e.id===eventId)?eventId:eventOptions[0]?.id||'';
 useEffect(()=>{
  gpsRequestId.current++;
  setSimulatingGps(false);setSelectedMapId('');setError('');setLive(null);setHistory(null);setSimulation(null);setExample(false);
 },[currentEvent]);
 useEffect(()=>{
  if(!currentEvent)return;
  let alive=true,updating=false;
  const refresh=async()=>{
   if(updating)return;
   updating=true;setBusy(true);
   try{
    const data=await get<Live>('crowd-live?event_id='+encodeURIComponent(currentEvent));
    if(alive){setLive(data);setError('');}
   }catch(e){if(alive)setError(e instanceof Error?e.message:'Erro ao atualizar as posições.');}
   finally{updating=false;if(alive)setBusy(false);}
  };
  void refresh();
  const timer=window.setInterval(()=>void refresh(),30_000);
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};
  document.addEventListener('visibilitychange',visible);
  return()=>{alive=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[currentEvent]);
 useEffect(()=>{
  if(!currentEvent||compact||view!=='history')return;
  let alive=true;
  void get<History>('crowd-history?event_id='+encodeURIComponent(currentEvent)+'&period='+period)
   .then(data=>{if(alive){setHistory(data);setError('');}})
   .catch(e=>{if(alive)setError(e instanceof Error?e.message:'Erro no histórico.');});
  return()=>{alive=false;};
 },[currentEvent,compact,view,period]);
 // Somente a apresentação é mockada. A API real e os snapshots do banco
 // permanecem inteiramente separados e não recebem nenhuma posição fictícia.
 const sourceMaps=example?exampleMaps(live?.maps||[]):live?.maps||[];
 const virtualMap:MapInfo={...exampleMaps([])[0],id:'virtual-map',name:'Mapa virtual (40 × 40 m)'};
 const baseMaps=simulation&&!sourceMaps.length?[virtualMap]:sourceMaps;
 const latest=simulation?.history.at(-1);
 const maps=simulation?baseMaps.map(map=>({...map,calibrated:true,areas:map.areas.map(area=>({
  ...area,count:map.id===simulation.mapId?(latest?.zones[area.id]||0):0
 }))})):baseMaps;
 const chosenMap=maps.find(m=>m.id===selectedMapId)||maps[0];
 const simulationMap=simulation?maps.find(m=>m.id===simulation.mapId):null;
 const peak=Math.max(1,...(chosenMap?.areas.map(a=>a.count||0)||[]));
 const topZone=maps.flatMap(m=>m.areas.map(a=>({...a,mapName:m.name})))
  .filter(a=>(a.count||0)>=5).sort((a,b)=>(b.count||0)-(a.count||0))[0];
 const fakeSeries=Array.from({length:12},(_,i)=>({at:Date.now()-(11-i)*60*60_000,participants:[24,45,82,146,220,315,428,378,303,226,120,62][i]}));
 const chartPoints=simulation?simulation.history.map(frame=>({
  label:frame.step===0?'Início':'+'+(frame.step*SIMULATION_STEP_MINUTES)+' min',
  participants:frame.participants
 })):(example?fakeSeries:history?.series||[]).map(p=>({...p,label:timeText(p.at,period!=='24h')}));
 const fakeHotspots=(simulation?
   simulationHotspots(simulation,(simulationMap?.areas||[])).map(zone=>({
    ...zone,mapId:simulation.mapId,name:simulationMap?.areas.find(a=>a.id===zone.id)?.name||'Ambiente',
    mapName:simulationMap?.name||'Mapa virtual'
   }))
   :example?maps.flatMap(m=>m.areas.map(a=>({id:a.id,mapId:m.id,name:a.name,mapName:m.name,average:Math.round((a.count||0)*.66),peak:a.count||0,samples:12}))):history?.hotspots||[]
  ).sort((a,b)=>b.average-a.average);
 function beginGpsSimulation(){
  if(simulatingGps)return;
  setError('');
  if(!navigator.geolocation){setError('GPS indisponível. Use o botão Ver exemplo fictício para visualizar uma demonstração sem localização.');return;}
  if(!window.isSecureContext){setError('A simulação com GPS precisa de HTTPS.');return;}
  setSimulatingGps(true);
  const request=++gpsRequestId.current;
  // getCurrentPosition somente no clique: nunca solicitar GPS em segundo plano.
  navigator.geolocation.getCurrentPosition(position=>{
   if(request!==gpsRequestId.current)return; // Evento ou modal alterado durante a permissão.
   setSimulatingGps(false);
   try{
    // "Ver exemplo fictício" não pode virar a origem dos mocks do GPS.
    // Usa somente a planta real cadastrada ou a grade virtual independente.
    const availableMaps=live?.maps||[];
    const map=availableMaps.find(m=>m.id===selectedMapId)||availableMaps[0]||virtualMap;
    const zones:SimulationZone[]=map.areas.map(a=>({id:a.id,x:a.x,y:a.y,width:a.width,height:a.height}));
    const result=createGpsSimulation({lat:position.coords.latitude,lng:position.coords.longitude},
     zones,map.id,simulationSize);
    setSelectedMapId(map.id);setExample(false);setView('live');setSimulation(result);
   }catch(e){setError(e instanceof Error?e.message:'Falha ao criar a simulação.');}
  },error=>{
   if(request!==gpsRequestId.current)return;
   setSimulatingGps(false);
   setError(error.code===1
    ?'A localização foi bloqueada. Libere o GPS nas configurações do navegador ou use Ver exemplo fictício.'
    :error.code===3?'O GPS demorou para responder. Tente novamente em um local com sinal.'
    :'Não foi possível obter seu GPS. Confira a conexão e tente novamente.');
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 }
 useEffect(()=>{
  if(!simulation)return;
  const timer=window.setInterval(()=>{
   setSimulation(previous=>{
    if(!previous)return previous;
    const selected=(live?.maps||[]).find(m=>m.id===previous.mapId)||virtualMap;
    return advanceGpsSimulation(previous,selected.areas);
   });
  },SIMULATION_INTERVAL_MS);
  return()=>window.clearInterval(timer);
 },[simulation?.seed,simulation?.mapId,live?.maps]);
 if(!eventOptions.length)return <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.035] p-5"><p className="font-bold">Inteligência do evento</p><p className="mt-2 text-sm text-white/60">Cadastre um evento com mapa para iniciar a análise de movimentação.</p></div>;
 return <section className="mt-7 space-y-4" aria-label="Inteligência do evento">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#c4ff40]"><Activity size={16}/> Inteligência do evento <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">Prévia</span></p><h3 className="mt-2 text-xl font-black">{compact?'Concentração ao vivo':'Movimentação e ocupação por ambiente'}</h3><p className="mt-1 text-xs text-white/55">Amostra voluntária de participantes com GPS ativo, não a lotação total da festa.</p></div>
   {compact&&onOpenReports&&<button type="button" onClick={onOpenReports} className="rounded-xl border border-[#c4ff40]/50 px-3 py-2.5 text-xs font-bold text-[#c4ff40]">Ver relatórios <BarChart3 size={14} className="ml-1 inline"/></button>}
  </div>
  <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-4">
   <label className="min-w-[200px] flex-1 space-y-1 text-xs text-white/65">Evento
    <select aria-label="Evento para análise de movimento" value={currentEvent} onChange={e=>{setEventId(e.target.value);setSelectedMapId('');}} className="w-full rounded-xl border border-white/15 bg-[#211829] px-3 py-3 text-sm text-white">{eventOptions.map(ev=><option key={ev.id} value={ev.id}>{ev.name}</option>)}</select>
   </label>
   <button type="button" onClick={()=>{gpsRequestId.current++;setSimulatingGps(false);setSimulation(null);setExample(v=>!v);}} className={'flex items-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold '+(example?'border-amber-400/50 bg-amber-400/10 text-amber-200':'border-white/20 text-white/70')}>{example?<EyeOff size={16}/>:<Eye size={16}/>} {example?'Ocultar exemplo':'Ver exemplo fictício'}</button>
   {simulation?<button type="button" onClick={()=>{gpsRequestId.current++;setSimulation(null);}} className="flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-3 text-xs font-bold text-red-200"><Square size={15}/> Parar simulação</button>
    :<div className="flex flex-wrap items-end gap-2">
     <label className="space-y-1 text-xs text-white/60">Pessoas fictícias
      <select aria-label="Quantidade de pessoas simuladas" value={simulationSize} onChange={e=>setSimulationSize(Number(e.target.value))} className="block rounded-xl border border-white/20 bg-[#211829] px-3 py-3 text-xs text-white"><option value={50}>50</option><option value={140}>140</option><option value={250}>250</option></select>
     </label>
     <button type="button" disabled={simulatingGps} onClick={beginGpsSimulation} className="flex items-center gap-2 rounded-xl bg-[#c4ff40] px-3 py-3 text-xs font-black text-black disabled:opacity-50"><LocateFixed size={16}/>{simulatingGps?'Obtendo GPS...':'Simular ±20 m do meu GPS'}</button>
    </div>}
   {!compact&&<div role="tablist" aria-label="Modo de análise" className="flex gap-1 rounded-xl border border-white/10 p-1">
    {(['live','history'] as const).map(tab=><button type="button" key={tab} role="tab" aria-selected={view===tab} onClick={()=>setView(tab)} className={'rounded-lg px-3 py-2 text-xs font-bold '+(view===tab?'bg-[#c4ff40] text-black':'text-white/70')}>{tab==='live'?'Ao vivo':'Histórico'}</button>)}
   </div>}
  </div>
  {simulation&&<div role="note" className="flex items-start gap-2 rounded-xl border border-amber-400/60 bg-amber-400/10 p-3 text-xs font-semibold leading-relaxed text-amber-100"><Footprints size={17} className="mt-0.5 shrink-0"/> SIMULAÇÃO GPS ATIVA — {simulation.people.length} pessoas fictícias em uma área virtual de 40 × 40 metros, centrada na sua posição ao iniciar. O mapa é esquemático, não usa a escala real do local. Cada 3 segundos avançam 5 minutos fictícios. Nenhuma posição é enviada ao servidor ou salva em relatórios reais.</div>}
  {example&&<div role="note" className="flex gap-2 rounded-xl border border-amber-400/45 bg-amber-400/10 p-3 text-xs font-semibold text-amber-200"><AlertTriangle size={16} className="shrink-0"/> EXEMPLO FICTÍCIO — números e cores inventados para visualizar a interface. Não representam pessoas reais nem medições do evento.</div>}
  {error&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
  {(view==='live'||compact)?<>
   <div className="grid gap-3 sm:grid-cols-3">
    {[
     {label:simulation?'Pessoas fictícias em movimento':'Participantes detectados',value:simulation?latest?.participants:example?428:live?.participants,icon:Users,hint:simulation?'Simulação local, sem pessoas reais':'Consentimento ativo e GPS recente'},
     {label:simulation?'Simulados dentro dos ambientes':'Identificados em ambientes',value:simulation?latest?.classified:example?392:live?.classified,icon:MapPin,hint:simulation?'Contagem fictícia por área no mapa':'Localização com precisão suficiente'},
     {label:simulation?'Simulados fora dos ambientes':'Sem ambiente confiável',value:simulation?latest?.unclassified:example?36:live?.unclassified,icon:Activity,hint:simulation?'Pessoas fictícias em circulação':'GPS impreciso, fora da área ou planta sem calibração'}
    ].map(({label,value,icon:Icon,hint})=><div key={label} className="rounded-2xl border border-white/10 bg-[#1c1424] p-4"><Icon size={18} className="text-[#c4ff40]"/><p className="mt-3 text-xs text-white/60">{label}</p><p className="mt-2 text-2xl font-black">{countText(value)}</p><p className="mt-1 text-[11px] text-white/40">{hint}</p></div>)}
   </div>
   <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,.7fr)]">
    <div className="rounded-2xl border border-white/10 bg-[#17111d] p-4">
     <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-bold"><MapPin size={17} className="text-[#c4ff40]"/> Concentração relativa no mapa</div>{maps.length>1&&<select aria-label="Mapa da concentração" value={chosenMap?.id||''} onChange={e=>{gpsRequestId.current++;setSimulation(null);setSimulatingGps(false);setSelectedMapId(e.target.value);}} className="rounded-lg border border-white/20 bg-[#211829] px-2 py-2 text-xs">{maps.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>}</div>
     {!chosenMap?<p className="rounded-xl border border-white/10 p-6 text-sm text-white/55">O evento ainda não possui mapa cadastrado.</p>:<div className="relative aspect-[6/5] w-full overflow-hidden rounded-xl border border-white/15 bg-[#0e0c14]" style={{backgroundImage:'linear-gradient(#ffffff0d 1px,transparent 1px),linear-gradient(90deg,#ffffff0d 1px,transparent 1px)',backgroundSize:'10% 10%'}}>
      {chosenMap.areas.map(a=><div key={a.id} className="absolute flex flex-col items-center justify-center overflow-hidden border-2 border-white/25 p-1 text-center" style={{left:a.x+'%',top:a.y+'%',width:a.width+'%',height:a.height+'%',backgroundColor:congestionColor(a.count,peak)}} title={a.name+' · '+(a.count===null?'amostra protegida':String(a.count)+' detectados')}><span className="max-w-full truncate text-[10px] font-bold text-white drop-shadow-md">{a.name}</span><span className="mt-0.5 text-[10px] text-white/80">{a.count===null?'< 5':String(a.count)}</span></div>)}
      {simulation&&chosenMap.id===simulation.mapId&&<>
       {simulation.people.filter(person=>person.active).map(person=><span key={person.id} aria-hidden="true" className="pointer-events-none absolute z-[12] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-200/85 shadow-[0_0_5px_#e879f9]" style={{left:person.x+'%',top:person.y+'%'}}/>)}
       <span aria-label="Centro do seu GPS nesta simulação" title="Seu GPS foi usado como centro virtual (0 m)" className="pointer-events-none absolute z-[25] flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-500 shadow-[0_0_0_7px_#3b82f655]" style={{left:'50%',top:'50%'}}><LocateFixed size={13}/></span>
       <span className="pointer-events-none absolute bottom-1 left-2 z-[26] rounded bg-black/85 px-2 py-1 text-[10px] font-semibold text-amber-100">SIMULADO · ±{SIMULATION_RADIUS_METERS} m · GPS no centro</span>
      </>}
      {!chosenMap.calibrated&&!example&&!simulation&&<div className="absolute inset-0 flex items-center justify-center bg-[#0e0c14]/85 p-5 text-center"><p className="max-w-xs text-xs leading-relaxed text-amber-200">Esta planta ainda não possui calibração GPS manual. O mapa de calor real só poderá funcionar depois da calibração do local.</p></div>}
     </div>}
     <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/50"><span>Baixa <span className="text-green-300">●</span> · Moderada <span className="text-yellow-300">●</span> · Alta <span className="text-red-300">●</span></span><span>Relativo à maior contagem, não à capacidade</span></div>
    </div>
    <div className="rounded-2xl border border-white/10 bg-[#17111d] p-4">
     <h4 className="text-sm font-bold">Ambientes mais movimentados</h4>
     <p className="mt-1 text-xs text-white/50">Por pessoas detectadas neste instante</p>
     <div className="mt-4 space-y-3">{maps.flatMap(m=>m.areas.map(a=>({...a,mapName:m.name}))).filter(a=>(a.count||0)>=5).sort((a,b)=>(b.count||0)-(a.count||0)).slice(0,7).map(a=><div key={a.id} className="space-y-1"><div className="flex items-center justify-between gap-2 text-xs"><span className="truncate">{a.name}</span><span className="shrink-0 font-bold">{countText(a.count)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{width:(100*(a.count||0)/Math.max(peak,1))+'%',backgroundColor:congestionColor(a.count,peak).replace(/\.\d+\)$/,'1)')}}/></div></div>)}</div>
     {!topZone&&<p className="mt-5 text-xs leading-relaxed text-white/55">Ainda não há amostras suficientes por ambiente. As contagens menores que 5 são ocultadas.</p>}
     <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs text-white/50"><RefreshCw size={15} className={'shrink-0 '+(busy?'animate-spin':'')}/> {simulation?'Movimento simulado: a cada 3 segundos · +5 min por ciclo. Etapa '+simulation.tick+'.':'Atualização real a cada 30 segundos.'} {live?.updatedAt&&!example&&!simulation?'Última leitura: '+timeText(live.updatedAt):''}</div>
    </div>
   </div>
  </>:<div className="space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-white/60">{simulation?'Histórico simulado: cada etapa representa 5 minutos fictícios. Não é salvo no banco.':'Série de registros agregados a cada 5 minutos. A média de 7/30 dias é exibida por hora.'}</p><select aria-label="Período do relatório" disabled={!!simulation} value={period} onChange={e=>setPeriod(e.target.value as '24h'|'7d'|'30d')} className="rounded-xl border border-white/20 bg-[#211829] px-3 py-2.5 text-sm"><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option></select></div>
   <div className="rounded-2xl border border-white/10 bg-[#17111d] p-4"><h4 className="text-sm font-bold">{simulation?'Pessoas fictícias ao longo da simulação':'Participantes detectados ao longo do tempo'}</h4>{chartPoints.length===0?<p className="py-12 text-center text-sm text-white/55">Nenhuma amostra consolidada para este período. A coleta começa após participantes autorizarem as estatísticas.</p>:<div className="mt-5 h-64 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartPoints}><defs><linearGradient id="crowd-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#c4ff40" stopOpacity={0.35}/><stop offset="95%" stopColor="#c4ff40" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ffffff15" vertical={false}/><XAxis dataKey="label" tick={{fill:'#ada2b5',fontSize:10}} tickLine={false} axisLine={false} minTickGap={24}/><YAxis tick={{fill:'#ada2b5',fontSize:10}} tickLine={false} axisLine={false} width={35}/><Tooltip contentStyle={{background:'#211829',border:'1px solid #ffffff33',borderRadius:12,color:'#fff'}} labelStyle={{color:'#fff'}}/><Area name="Participantes detectados" type="monotone" dataKey="participants" stroke="#c4ff40" fill="url(#crowd-fill)" strokeWidth={3} connectNulls={false}/></AreaChart></ResponsiveContainer></div>}<p className="mt-2 text-[11px] text-white/45">{simulation?'Simulação local em ciclos acelerados. Os dados fictícios desaparecem ao clicar em Parar.':'Lacunas podem indicar falta de participantes, GPS indisponível ou amostras menores que 5.'}</p></div>
   <div className="rounded-2xl border border-white/10 bg-[#17111d] p-4"><div className="flex items-center gap-2"><TrendingUp size={17} className="text-[#c4ff40]"/><h4 className="font-bold">Locais que ficaram mais movimentados</h4></div><p className="mt-1 text-xs text-white/50">Média por snapshot e maior pico de participantes por ambiente</p>{fakeHotspots.length===0?<p className="mt-5 text-sm text-white/55">Ainda não existem ambientes com amostras suficientes para calcular o histórico.</p>:<div className="mt-4 space-y-2">{fakeHotspots.slice(0,10).map((h,i)=><div key={h.mapId+':'+h.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] px-3 py-3"><span className="w-6 text-center text-sm font-black text-[#c4ff40]">{i+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{h.name}</p><p className="truncate text-[11px] text-white/50">{h.mapName}</p></div><div className="text-right"><p className="text-sm font-bold">Média {h.average.toLocaleString('pt-BR')}</p><p className="text-[11px] text-white/50">Pico {h.peak}</p></div></div>)}</div>}</div>
   <p className="text-xs text-white/50">{simulation?'Dados 100% simulados, temporários e locais. Não aparecem nos relatórios reais.':'Dados históricos consolidados, retenção de até 30 dias. Nenhum registro identifica indivíduos; médias não equivalem à lotação do evento.'}</p>
  </div>}
  <p className="flex items-start gap-2 text-[11px] leading-relaxed text-white/45"><AlertTriangle size={15} className="mt-0.5 shrink-0"/> A análise utiliza somente GPS recente de participantes que autorizaram explicitamente estatísticas anônimas. Áreas com amostras entre 1 e 4 participantes são ocultadas, e posições de precisão insuficiente não são atribuídas a ambientes. Mapas demonstrativos não produzem leituras reais.</p>
 </section>;
}
