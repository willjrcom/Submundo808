import {useEffect,useState} from 'react';
import {Activity,CalendarDays,Clock3,RefreshCw,Users,MousePointerClick} from 'lucide-react';

type EventItem = {id:string;name:string};
type Feature = {feature:string;visitors:number;hits:number};
type Hour = {at:number;visitors:number};
type EventRow = {id:string;name:string;visitors:number;interactions:number};
type Usage = {day:string;eventId:string|null;uniqueVisitors:number;activeNow:number;interactions:number;linkedUsers:number|null;features:Feature[];hours:Hour[];events:EventRow[];retentionDays:number};
const featureNames:Record<string,string> = {programacao:'Programação',mapa:'Mapa',cardapio:'Cardápio',amigos:'Amigos'};
const brazilianToday = () => new Date(Date.now()-3*3600000).toISOString().slice(0,10);
const hourLabel = (at:number) => new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date(at));
const card = 'rounded-2xl border border-white/10 bg-white/[.035] p-4';
const control = 'min-h-11 w-full rounded-xl border border-white/20 bg-[#241b2c] px-3 py-2 text-sm text-white';

export default function AdminUsage({events,fixedEventId}:{events:EventItem[];fixedEventId?:string}) {
 const [day,setDay]=useState(brazilianToday);
 const [eventId,setEventId]=useState('');
 const selectedEvent=fixedEventId||eventId;
 const [version,setVersion]=useState(0);
 const [usage,setUsage]=useState<Usage|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  const reload=async()=>{
   try{
    const query=new URLSearchParams({day});
    if(selectedEvent)query.set('event_id',selectedEvent);
    const response=await fetch('/api/admin/usage?'+query.toString(),{credentials:'same-origin'});
    const json=await response.json();
    if(!response.ok)throw Error(json.error||'Não foi possível consultar a telemetria.');
    if(alive){setUsage(json);setError('');}
   }catch(err){if(alive)setError(err instanceof Error?err.message:'Falha ao consultar uso do aplicativo.');}
   finally{if(alive)setLoading(false);}
  };
  setLoading(true);setUsage(null);
  void reload();
  const timer=window.setInterval(()=>void reload(),30000);
  return()=>{alive=false;window.clearInterval(timer);};
 },[day,selectedEvent,version]);
 const maxHour=Math.max(1,...(usage?.hours||[]).map(h=>h.visitors));
 const maxFeature=Math.max(1,...(usage?.features||[]).map(f=>f.hits));
 const stats=[
  {label:'Usuários/dispositivos únicos no dia',value:usage?.uniqueVisitors,Icon:Users},
  {label:'Ativos nos últimos 15 min',value:usage?.activeNow,Icon:Activity},
  {label:'Acessos às funcionalidades',value:usage?.interactions,Icon:MousePointerClick},
  ...(selectedEvent?[{label:'Contas vinculadas ao evento',value:usage?.linkedUsers,Icon:Users}]:[])
 ];
 return <section className="mt-8 space-y-5" aria-label="Telemetria do aplicativo">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <h3 className="flex items-center gap-2 text-xl font-black"><Activity size={21} className="text-[#c4ff40]"/> Telemetria e engajamento</h3>
    <p className="mt-1 text-sm text-white/60">Uso registrado no aplicativo, separado por evento e dia.</p>
   </div>
   <button type="button" onClick={()=>setVersion(v=>v+1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-bold text-white/85"><RefreshCw size={16}/> Atualizar</button>
  </div>
  <div className="grid gap-3 sm:grid-cols-2">
   {!fixedEventId&&<label className="space-y-1 text-xs font-medium text-white/60">Evento
    <select aria-label="Filtrar telemetria por evento" className={control} value={eventId} onChange={e=>setEventId(e.target.value)}>
     <option value="">Todos os eventos</option>
     {events.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}
    </select>
   </label>}
   <label className="space-y-1 text-xs font-medium text-white/60"><span className="inline-flex items-center gap-2"><CalendarDays size={14}/> Data (horário de Brasília)</span>
    <input aria-label="Data da telemetria" type="date" className={control} value={day} onChange={e=>setDay(e.target.value)}/>
   </label>
  </div>
  {error&&<p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}
  {loading&&!usage?<p role="status" className="text-sm text-white/60">Carregando indicadores...</p>:usage&&<>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {stats.map(({label,value,Icon})=><div key={label} className={card}>
     <Icon size={20} className="text-[#c4ff40]"/>
     <p className="mt-3 text-xs text-white/60">{label}</p>
     <p className="mt-2 text-3xl font-black text-[#c4ff40]">{(value??0).toLocaleString('pt-BR')}</p>
    </div>)}
   </div>
   <p className="text-xs leading-relaxed text-white/50">Usuários únicos são estimados por conta autenticada ou identificador deste navegador; a mesma pessoa pode ser contada novamente ao trocar de dispositivo ou entrar na conta. Atividade no aplicativo não comprova presença física ou entrada no evento. Dados mantidos por até {usage.retentionDays} dias.</p>
   <div className="grid gap-4 lg:grid-cols-2">
    <div className={card}>
     <h4 className="flex items-center gap-2 font-bold"><Clock3 size={17} className="text-[#c4ff40]"/> Uso por hora</h4>
     <p className="mt-1 text-xs text-white/50">Usuários/dispositivos únicos em cada faixa horária (não simultâneos).</p>
     {usage.hours.length?<div className="mt-5 flex h-44 items-end gap-1 overflow-x-auto pb-1">
      {usage.hours.map(hour=><div key={hour.at} className="flex min-w-8 flex-1 flex-col items-center justify-end gap-2" title={hour.visitors+' usuários às '+hourLabel(hour.at)}>
       <span className="text-[10px] text-white/70">{hour.visitors}</span>
       <div className="w-full max-w-10 rounded-t-md bg-[#c4ff40]/80" style={{height:Math.max(4,112*hour.visitors/maxHour)+'px'}}/>
       <span className="text-[10px] text-white/50">{hourLabel(hour.at)}</span>
      </div>)}
     </div>:<p className="mt-5 text-sm text-white/50">Ainda não houve registros nesta data.</p>}
    </div>
    <div className={card}>
     <h4 className="font-bold">Funcionalidades mais usadas</h4>
     <p className="mt-1 text-xs text-white/50">Aberturas de telas e interações de navegação registradas.</p>
     {usage.features.length?<div className="mt-5 space-y-4">{usage.features.map(feature=><div key={feature.feature}>
      <div className="mb-1 flex justify-between gap-2 text-sm"><span>{featureNames[feature.feature]||feature.feature}</span><span className="text-white/70">{feature.hits.toLocaleString('pt-BR')} acessos</span></div>
      <div className="h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-[#c4ff40]" style={{width:(100*feature.hits/maxFeature)+'%'}}/></div>
      <p className="mt-1 text-xs text-white/45">{feature.visitors.toLocaleString('pt-BR')} usuários/dispositivos distintos</p>
     </div>)}</div>:<p className="mt-5 text-sm text-white/50">Sem acessos registrados nesta data.</p>}
    </div>
   </div>
   {!fixedEventId&&<div className={card}>
    <h4 className="font-bold">Comparativo por evento</h4>
    <div className="mt-4 overflow-x-auto">
     <table className="w-full min-w-[440px] text-left text-sm">
      <thead><tr className="border-b border-white/15 text-xs text-white/60"><th className="pb-3">Evento</th><th className="pb-3 text-right">Únicos</th><th className="pb-3 text-right">Acessos</th><th className="pb-3 text-right">Detalhes</th></tr></thead>
      <tbody>{usage.events.map(event=><tr key={event.id} className="border-b border-white/10 last:border-0">
       <td className="py-3 font-medium">{event.name}</td>
       <td className="py-3 text-right">{event.visitors.toLocaleString('pt-BR')}</td>
       <td className="py-3 text-right">{event.interactions.toLocaleString('pt-BR')}</td>
       <td className="py-3 text-right"><button type="button" onClick={()=>setEventId(event.id)} className="rounded-lg px-2 py-1 font-semibold text-[#c4ff40] hover:bg-white/10">Ver dados</button></td>
      </tr>)}</tbody>
     </table>
    </div>
   </div>}
  </>}
 </section>;
}
