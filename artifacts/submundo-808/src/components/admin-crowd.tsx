import {useEffect,useMemo,useState} from 'react';
import {Activity,Clock3,MapPin,AlertTriangle} from 'lucide-react';

type EventItem={id:string;name:string;starts_at?:string;ends_at?:string;map_ids?:string[]};
type Zone={id:string;name:string;x:number;y:number;width:number;height:number};
type MapData={id:string;name:string;calibrated:boolean;areas:Zone[]};
type Cell={x:number;y:number;count:number};
type Hour={at:number;participants:number|null;samples:number;cells:Cell[]};
type Report={event:EventItem;map:MapData;divisions:number;hours:Hour[]};
type Props={event:EventItem;venueMaps:{id:string;name:string}[];example?:boolean};

const SAMPLE_ZONES:Zone[]=[
 {id:'a',name:'Pista principal',x:4,y:8,width:79,height:77},
 {id:'b',name:'Palco',x:83,y:8,width:13,height:35},
 {id:'c',name:'Bar',x:83,y:51,width:13,height:34}
];
const dots=[
 [1,1,16],[2,2,22],[3,2,36],[4,2,72],[5,2,81],[5,3,95],[4,3,74],
 [3,4,59],[2,4,37],[1,5,12],[4,5,52],[5,5,76],[6,5,89],[6,6,34],
 [2,6,24],[3,6,41],[5,6,69],[6,3,57],[7,4,22]
];
function createExample():Report{
 const start=Date.parse('2026-10-24T21:00:00-03:00');
 return {
  event:{id:'example',name:'Evento ilustrativo'},
  map:{id:'example',name:'Planta principal',calibrated:true,areas:SAMPLE_ZONES},
  divisions:8,
  hours:Array.from({length:6},(_,i)=>({
   at:start+i*3600000,participants:[125,264,387,432,319,171][i],samples:12,
   cells:dots.map(([x,y,count])=>({x,y,count:Math.max(5,Math.round(count*([.48,.75,1,1.15,.9,.6][i])))}))
  }))
 };
}
function hourLabel(at:number){return new Date(at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false});}
function heatColor(ratio:number){
 if(ratio>=.7)return 'rgba(255,55,58,.88)';
 if(ratio>=.35)return 'rgba(255,206,43,.82)';
 return 'rgba(55,111,255,.8)';
}
export default function AdminCrowd({event,venueMaps,example=false}:Props){
 const linkedMaps=useMemo(()=>venueMaps.filter(m=>event.map_ids?.includes(m.id)),[venueMaps,event.map_ids]);
 const [mapId,setMapId]=useState('');
 const currentMapId=linkedMaps.some(m=>m.id===mapId)?mapId:linkedMaps[0]?.id||'';
 const [hourAt,setHourAt]=useState<number|null>(null);
 const [report,setReport]=useState<Report|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const sample=useMemo(()=>createExample(),[]);
 useEffect(()=>{
  setReport(null);setError('');setHourAt(null);
  if(example||!currentMapId)return;
  let active=true;
  setBusy(true);
  fetch('/api/admin/crowd-hourly?event_id='+encodeURIComponent(event.id)+'&map_id='+encodeURIComponent(currentMapId),{
   credentials:'same-origin',cache:'no-store'
  }).then(async r=>{
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Não foi possível consultar o histórico.');
   return data as Report;
  }).then(data=>{if(active)setReport(data);}).catch(err=>{
   if(active)setError(err instanceof Error?err.message:'Falha ao carregar a análise.');
  }).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[event.id,currentMapId,example]);
 const displayed=example?sample:report;
 const hours=displayed?.hours||[];
 const current=hours.find(h=>h.at===hourAt)||hours[hours.length-1];
 const map=displayed?.map;
 const maxCount=Math.max(1,...(current?.cells||[]).map(c=>c.count));
 const hasCells=!!current?.cells.length;
 return <section className="space-y-5" aria-label="Análise de movimentação por hora">
  <div>
   <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#c4ff40]"><Activity size={16}/> Análise de movimentação</p>
   <h3 className="mt-2 text-xl font-black">{event.name}</h3>
   <p className="mt-2 text-xs leading-relaxed text-white/60">{example
    ?'Exemplo ilustrativo de como será a análise após um evento com participantes usando o aplicativo e autorizando estatísticas.'
    :'Histórico dos participantes que autorizaram estatísticas de localização. Sem acompanhamento individual ou atualização ao vivo.'}</p>
  </div>
  {!example&&<label className="block max-w-sm space-y-1 text-xs text-white/65">Planta do evento
   <select value={currentMapId} onChange={e=>{setMapId(e.target.value);setHourAt(null);}} className="block w-full rounded-xl border border-white/20 bg-[#211829] px-3 py-3 text-sm text-white">
    {linkedMaps.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
   </select>
  </label>}
  {error&&<p role="alert" className="rounded-xl border border-red-400/30 p-3 text-sm text-red-200">{error}</p>}
  {!example&&!linkedMaps.length&&<p className="rounded-xl border border-white/15 p-5 text-sm text-white/60">Este evento ainda não possui plantas vinculadas.</p>}
  {busy&&<p className="text-sm text-white/60">Carregando histórico...</p>}
  {displayed&&<div className="space-y-4">
   <div className="rounded-2xl border border-white/10 bg-[#17111d] p-4">
    <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} className="text-[#c4ff40]"/> Horário do evento</p>
    {hours.length?<div className="flex gap-2 overflow-x-auto pb-1">
     {hours.map(hour=><button key={hour.at} type="button" onClick={()=>setHourAt(hour.at)}
      aria-pressed={current?.at===hour.at}
      className={'shrink-0 rounded-xl border px-4 py-2.5 text-sm font-bold '+(current?.at===hour.at?'border-[#c4ff40] bg-[#c4ff40] text-black':'border-white/15 text-white/70')}>
      {hourLabel(hour.at)}
     </button>)}
    </div>:<p className="text-sm text-white/50">Ainda não foram registradas amostras neste evento.</p>}
   </div>
   <div className="rounded-2xl border border-white/10 bg-[#1c1424] p-5">
    <p className="text-xs text-white/60">Participantes ativos detectados · média da hora</p>
    <p className="mt-2 text-3xl font-black text-[#c4ff40]">{current?.participants===null||current?.participants===undefined?'Amostra insuficiente':new Intl.NumberFormat('pt-BR').format(current.participants)}</p>
    <p className="mt-2 text-xs text-white/45">Média das leituras a cada 5 minutos, não o total de presentes no evento.</p>
   </div>
   <div className="rounded-2xl border border-white/10 bg-[#17111d] p-4">
    <h4 className="mb-3 flex items-center gap-2 text-sm font-bold"><MapPin size={16} className="text-[#c4ff40]"/> Mapa de calor · {map?.name}</h4>
    <div className="relative aspect-[6/5] w-full overflow-hidden rounded-xl border border-white/15 bg-[#080f2b]"
     style={{backgroundImage:'linear-gradient(#ffffff0c 1px,transparent 1px),linear-gradient(90deg,#ffffff0c 1px,transparent 1px)',backgroundSize:'12.5% 12.5%'}}>
     {map?.areas.map(zone=><div key={zone.id} className="pointer-events-none absolute z-10 flex items-start overflow-hidden border border-white/30 p-1"
       style={{left:zone.x+'%',top:zone.y+'%',width:zone.width+'%',height:zone.height+'%'}}>
       <span className="truncate rounded bg-black/50 px-1 py-0.5 text-[10px] text-white/80">{zone.name}</span>
      </div>)}
     {current?.cells.map(cell=><span key={cell.x+':'+cell.y} aria-hidden="true"
       className="pointer-events-none absolute h-[24%] w-[24%] rounded-full"
       style={{left:((cell.x+.5)/displayed.divisions*100-12)+'%',
        top:((cell.y+.5)/displayed.divisions*100-12)+'%',
        background:'radial-gradient(circle,'+heatColor(cell.count/maxCount)+' 0%, '+heatColor(cell.count/maxCount).replace(/,[^,]+\)$/,',0.16)')+' 52%,transparent 76%)',
        filter:'blur(5px)'}}/>)}
     {!hasCells&&<div className="absolute inset-0 z-20 flex items-center justify-center bg-[#080f2b]/75 p-6 text-center"><p className="max-w-xs text-sm text-white/75">{map?.calibrated===false?'A planta precisa estar calibrada para registrar concentrações espaciais.':'Ainda não existem amostras suficientes para desenhar o mapa de calor neste horário.'}</p></div>}
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-white/60">
     <span><span className="text-blue-400">●</span> Baixa</span>
     <span><span className="text-yellow-400">●</span> Média</span>
     <span><span className="text-red-400">●</span> Alta</span>
    </div>
    <p className="mt-3 text-[11px] leading-relaxed text-white/50">Intensidade relativa às concentrações detectadas nesta planta e hora. Cada mancha representa uma região aproximada, não um ambiente inteiro nem uma medição precisa de pessoas/m².</p>
   </div>
  </div>}
  <p className="flex items-start gap-2 text-[11px] leading-relaxed text-white/45"><AlertTriangle size={14} className="mt-0.5 shrink-0"/>
   {example?'Os números exibidos neste exemplo são inteiramente ilustrativos.': 'Só são usados dados de participantes com consentimento explícito. Regiões com menos de cinco dispositivos na média horária são ocultadas; a precisão GPS em locais fechados pode ser limitada. O histórico é mantido por até 30 dias.'}</p>
 </section>;
}
