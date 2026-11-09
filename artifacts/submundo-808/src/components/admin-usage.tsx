import {useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,CalendarDays,Clock3,Download,MapPin,RefreshCw,Radio,Smartphone,Users} from 'lucide-react';
import {Area,AreaChart,CartesianGrid,Cell,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';

type EventItem = {id:string;name:string};
type Feature = {feature:string;visitors:number;hits:number};
type Point = {at:number;visitors:number;opens:number};
type EventRow = {
 id:string;name:string;starts_at?:string;ends_at?:string;
 visitors:number;opens:number;activeNow:number;interactions:number;avgSessionSeconds:number|null
};
type Period = 'today'|'7d'|'30d'|'custom';
type Usage = {
 period:Period;from:string;to:string;eventId:string|null;timelineUnit:'hour'|'day';
 uniqueVisitors:number;appOpens:number;activeNow:number;interactions:number;
 linkedUsers:number|null;avgSessionSeconds:number|null;retentionPercent:number|null;
 previousPeriodVisitors:number;returningVisitors:number;
 timeline:Point[];features:Feature[];events:EventRow[];retentionDays:number
};
type Props = {
 events:EventItem[];fixedEventId?:string;sharingNow?:number;registeredUsers?:number;onlineUsers?:number;
 venueCount?:number;mapCount?:number;totalEvents?:number;onOpenEvent?:(id:string)=>void
};
const featureNames:Record<string,string> = {
 programacao:'Programação',mapa:'Mapa do evento',cardapio:'Cardápio',amigos:'Amigos'
};
const featureColors:Record<string,string> = {
 mapa:'#a144ed',programacao:'#c08dff',cardapio:'#ffad65',amigos:'#45d9a1'
};
const dateFormat = new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'short'});
const hourFormat = new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
const timeFormat = new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const numberFormat = new Intl.NumberFormat('pt-BR');
const today = () => new Date(Date.now()-3*3600000).toISOString().slice(0,10);
const formatNumber = (n:number) => numberFormat.format(n);
const formatDuration = (seconds:number|null) => seconds===null ? '—'
 : seconds>=60 ? Math.floor(seconds/60)+' min '+String(seconds%60).padStart(2,'0')+' s' : seconds+' s';
const metricCard = 'min-w-0 rounded-2xl border border-white/[.12] bg-[#171320] px-4 py-4 sm:px-5 sm:py-5';
const control = 'min-h-11 rounded-xl border border-white/20 bg-[#221b2c] px-3 py-2.5 text-sm text-white outline-none focus:border-[#c4ff40] focus-visible:ring-2 focus-visible:ring-[#c4ff40]/30';
const chartTooltip = {backgroundColor:'#171220',border:'1px solid #ffffff28',borderRadius:12,color:'#f5f2fa',fontSize:12};
function timePoint(at:number,unit:'hour'|'day') {
 return unit==='hour'?hourFormat.format(new Date(at)):dateFormat.format(new Date(at));
}
function parseEventTime(value?:string) {
 if(!value)return NaN;
 const local=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value);
 return Date.parse(local?value+'-03:00':value);
}
function eventSituation(event:EventRow) {
 const now=Date.now(),start=parseEventTime(event.starts_at),end=parseEventTime(event.ends_at);
 if(Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&end>=now)return 'Em andamento';
 if(Number.isFinite(end)&&end<now)return 'Encerrado';
 if(Number.isFinite(start)&&start>now)return 'Agendado';
 return 'Sem horário';
}
function downloadCsv(rows:EventRow[],from:string,to:string) {
 const encode=(value:string|number)=>'"'+String(value).replaceAll('"','""')+'"';
 const header=['Evento','Usuários únicos estimados','Aberturas/sessões','Ativos 15 min','Interações','Tempo médio (s)'];
 const lines=[header,...rows.map(row=>[row.name,row.visitors,row.opens,row.activeNow,row.interactions,row.avgSessionSeconds??''])];
 const csv='\uFEFF'+lines.map(row=>row.map(encode).join(';')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 link.href=url;link.download='submundo-uso-'+from+'-'+to+'.csv';link.click();
 URL.revokeObjectURL(url);
}

export default function AdminUsage({
 events,fixedEventId,sharingNow,registeredUsers,onlineUsers,venueCount,mapCount,totalEvents,onOpenEvent
}:Props) {
 const [period,setPeriod]=useState<Period>('7d');
 const [from,setFrom]=useState(today);
 const [to,setTo]=useState(today);
 const [eventId,setEventId]=useState('');
 const [reloadKey,setReloadKey]=useState(0);
 const selectedEvent=fixedEventId||eventId;
 const [usage,setUsage]=useState<Usage|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [updatedAt,setUpdatedAt]=useState<number|null>(null);
 const [chartMode,setChartMode]=useState<'visitors'|'opens'>('visitors');
 useEffect(()=>{
  let mounted=true;
  const reload=async()=>{
   try {
    const query=new URLSearchParams({period});
    if(selectedEvent)query.set('event_id',selectedEvent);
    if(period==='custom'){query.set('from',from);query.set('to',to);}
    const response=await fetch('/api/admin/usage?'+query.toString(),{credentials:'same-origin'});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Falha ao consultar os indicadores.');
    if(mounted){setUsage(result);setError('');setUpdatedAt(Date.now());}
   }catch(err) {
    if(mounted)setError(err instanceof Error?err.message:'Falha ao consultar os indicadores.');
   }finally {if(mounted)setLoading(false);}
  };
  setLoading(true);setUsage(null);
  void reload();
  const timer=window.setInterval(()=>void reload(),30000);
  return()=>{mounted=false;window.clearInterval(timer);};
 },[period,from,to,selectedEvent,reloadKey]);
 const rows=usage?.events||[];
 const activeEvents=rows.filter(item=>item.visitors>0).length;
 const chartData=useMemo(()=>usage?.timeline.map(point=>({
  ...point,label:timePoint(point.at,usage.timelineUnit)
 }))||[],[usage]);
 const features=usage?.features||[];
 const totalFeatureHits=features.reduce((sum,row)=>sum+row.hits,0);
 const activeUsers=usage?.activeNow??0;
 const cardValues=[
  {label:'Usuários únicos estimados',value:usage?formatNumber(usage.uniqueVisitors):'—',detail:'Contas ou dispositivos no período',Icon:Users},
  {label:'Aberturas / sessões',value:usage?formatNumber(usage.appOpens):'—',detail:'Sessões iniciadas no período',Icon:Smartphone},
  {label:'Ativos agora',value:usage?formatNumber(activeUsers):'—',detail:'Atividade nos últimos 15 minutos',Icon:Radio},
  {label:'Eventos com uso',value:usage?formatNumber(activeEvents):'—',detail:'Eventos acessados no período',Icon:CalendarDays}
 ];
 return <section className="mt-7 space-y-5" aria-label="Telemetria e engajamento">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div className="min-w-0">
    <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#c4ff40]">Telemetria e engajamento</p>
    <h3 className="mt-2 text-xl font-black sm:text-2xl">{fixedEventId?'Análise de utilização do evento':'Uso do aplicativo em tempo real'}</h3>
    <p className="mt-1 text-sm text-white/55">Acompanhe a adoção, a navegação e a recorrência dos participantes.</p>
   </div>
   <div className="flex flex-wrap items-center gap-2">
    <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-3 text-xs text-white/70">
     <span className="h-2 w-2 rounded-full bg-emerald-400"/> Atualiza a cada 30 s
    </span>
    <button type="button" onClick={()=>setReloadKey(key=>key+1)} disabled={loading}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 px-3 text-xs font-bold text-white/80 hover:border-[#c4ff40]/60 disabled:opacity-50">
      <RefreshCw size={15}/> Atualizar
    </button>
   </div>
  </div>
  <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#171320] p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-4">
   <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-white/60 sm:min-w-40">
    <span>Período</span>
    <select value={period} onChange={e=>setPeriod(e.target.value as Period)} className={control}>
     <option value="today">Hoje</option><option value="7d">Últimos 7 dias</option>
     <option value="30d">Últimos 30 dias</option><option value="custom">Personalizado</option>
    </select>
   </label>
   {!fixedEventId&&<label className="flex min-w-0 flex-[1.5] flex-col gap-1 text-xs text-white/60 sm:min-w-52">
    <span>Evento</span>
    <select aria-label="Filtrar telemetria por evento" value={eventId} onChange={e=>setEventId(e.target.value)} className={control}>
     <option value="">Todos os eventos</option>
     {events.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}
    </select>
   </label>}
   {period==='custom'&&<>
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-white/60 sm:min-w-36">De
     <input aria-label="Data inicial" type="date" value={from} max={today()} onChange={e=>setFrom(e.target.value)} className={control}/>
    </label>
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-white/60 sm:min-w-36">Até
     <input aria-label="Data final" type="date" value={to} max={today()} onChange={e=>setTo(e.target.value)} className={control}/>
    </label>
   </>}
   {updatedAt&&<span className="pb-2 text-xs text-white/45">Atualizado às {timeFormat.format(new Date(updatedAt))}</span>}
  </div>

  {error&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/[.06] p-3 text-sm text-red-200">{error}</p>}
  {loading&&!usage?<div role="status" className="rounded-2xl border border-white/10 bg-[#171320] p-8 text-sm text-white/55">Carregando indicadores reais...</div>:usage&&<>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {cardValues.map(({label,value,detail,Icon})=><div className={metricCard} key={label}>
     <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#a144ed]/15 text-[#b877fa]"><Icon size={21}/></div>
      <p className="min-w-0 text-sm font-semibold text-white/85">{label}</p>
     </div>
     <p className="mt-3 text-3xl font-black tabular-nums tracking-tight text-white">{value}</p>
     <p className="mt-1 text-xs text-white/45">{detail}</p>
    </div>)}
   </div>
   <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
    <div className={metricCard}>
     <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
       <h4 className="font-bold">Uso do aplicativo ao longo do tempo</h4>
       <p className="mt-1 text-xs text-white/45">Contagem por {usage.timelineUnit==='hour'?'hora':'dia'}, em horário de Brasília</p>
      </div>
      <div className="inline-flex rounded-xl border border-white/15 bg-[#100d16] p-1 text-xs">
       <button type="button" onClick={()=>setChartMode('visitors')} aria-pressed={chartMode==='visitors'}
        className={'rounded-lg px-3 py-2 font-semibold '+(chartMode==='visitors'?'bg-[#7936bc] text-white':'text-white/55')}>Usuários</button>
       <button type="button" onClick={()=>setChartMode('opens')} aria-pressed={chartMode==='opens'}
        className={'rounded-lg px-3 py-2 font-semibold '+(chartMode==='opens'?'bg-[#7936bc] text-white':'text-white/55')}>Sessões</button>
      </div>
     </div>
     <div className="mt-5 h-[245px] w-full min-w-0" aria-label="Gráfico de uso do aplicativo">
      <ResponsiveContainer width="100%" height="100%">
       <AreaChart data={chartData} margin={{top:6,right:6,bottom:2,left:-20}}>
        <defs><linearGradient id="submundoUsageGradient" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0%" stopColor="#a144ed" stopOpacity={0.48}/><stop offset="100%" stopColor="#a144ed" stopOpacity={0}/>
        </linearGradient></defs>
        <CartesianGrid stroke="#ffffff16" vertical={false}/>
        <XAxis dataKey="label" stroke="#ffffff65" tick={{fill:'#a9a1b4',fontSize:10}} tickLine={false} axisLine={false} minTickGap={18}/>
        <YAxis allowDecimals={false} stroke="#ffffff65" tick={{fill:'#a9a1b4',fontSize:10}} tickLine={false} axisLine={false}/>
        <Tooltip contentStyle={chartTooltip} labelStyle={{color:'#f5f2fa'}}
         formatter={(value,name)=>[formatNumber(Number(value)),name==='opens'?'Sessões':'Usuários únicos estimados']}/>
        <Area type="monotone" dataKey={chartMode} name={chartMode} stroke="#b461fa" strokeWidth={3}
         fill="url(#submundoUsageGradient)" dot={chartData.length<=10?{r:3,fill:'#d8b4fe'}:false}
         activeDot={{r:5,fill:'#c4ff40'}}/>
       </AreaChart>
      </ResponsiveContainer>
     </div>
     <p className="mt-2 text-xs text-white/40">Usuários distintos por faixa de tempo; a soma das faixas não corresponde necessariamente ao total do período.</p>
    </div>
    <div className={metricCard}>
     <h4 className="font-bold">Uso por funcionalidade</h4>
     <p className="mt-1 text-xs text-white/45">Acessos às telas do aplicativo</p>
     {features.length?<>
      <div className="relative mx-auto mt-2 h-[205px] w-full max-w-xs">
       <ResponsiveContainer width="100%" height="100%">
        <PieChart>
         <Pie data={features} dataKey="hits" nameKey="feature" innerRadius={64} outerRadius={88}
          cx="50%" cy="50%" stroke="none" isAnimationActive={false}>
          {features.map(feature=><Cell key={feature.feature} fill={featureColors[feature.feature]||'#508ee9'}/>)}
         </Pie>
         <Tooltip contentStyle={chartTooltip} formatter={value=>[formatNumber(Number(value)),'Acessos']}/>
        </PieChart>
       </ResponsiveContainer>
       <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-black tabular-nums">{formatNumber(totalFeatureHits)}</p>
        <p className="text-xs text-white/55">acessos</p>
       </div>
      </div>
      <div className="space-y-2">
       {features.map(feature=><div key={feature.feature} className="flex items-center gap-2 text-xs">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor:featureColors[feature.feature]||'#508ee9'}}/>
        <span className="min-w-0 flex-1 text-white/70">{featureNames[feature.feature]||feature.feature}</span>
        <span className="font-semibold tabular-nums">{totalFeatureHits?Math.round(100*feature.hits/totalFeatureHits):0}%</span>
       </div>)}
      </div>
     </>:<div className="flex min-h-[260px] items-center justify-center text-center text-sm text-white/45">Ainda não há acessos registrados às funcionalidades neste período.</div>}
    </div>
   </div>
   <div className="grid gap-3 lg:grid-cols-3">
    <div className={metricCard}>
     <div className="flex items-center gap-2"><Users size={19} className="text-[#b877fa]"/><h4 className="font-bold">Retorno de usuários</h4></div>
     <p className="mt-3 text-3xl font-black">{usage.retentionPercent===null?'—':usage.retentionPercent.toLocaleString('pt-BR')+'%'}</p>
     <p className="mt-1 text-xs text-white/55">{usage.retentionPercent===null?'Sem base anterior suficiente para comparação':formatNumber(usage.returningVisitors)+' de '+formatNumber(usage.previousPeriodVisitors)+' usuários do período anterior retornaram'}</p>
    </div>
    <div className={metricCard}>
     <div className="flex items-center gap-2"><Clock3 size={19} className="text-[#b877fa]"/><h4 className="font-bold">Tempo médio de uso</h4></div>
     <p className="mt-3 text-3xl font-black">{formatDuration(usage.avgSessionSeconds)}</p>
     <p className="mt-1 text-xs text-white/55">Tempo ativo estimado por sessão, a partir de sinais de atividade</p>
    </div>
    <div className={metricCard}>
     <div className="flex items-center gap-2"><MapPin size={19} className="text-[#b877fa]"/><h4 className="font-bold">{fixedEventId?'Contas vinculadas':'Localização compartilhada'}</h4></div>
     <p className="mt-3 text-3xl font-black">{formatNumber(fixedEventId?usage.linkedUsers??0:sharingNow??0)}</p>
     <p className="mt-1 text-xs text-white/55">{fixedEventId?'Selecionaram o evento; não comprova entrada':'Compartilhando agora (total do aplicativo, com consentimento)'}</p>
    </div>
   </div>
   {!fixedEventId&&<div className={metricCard}>
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><h4 className="font-bold">Eventos recentes</h4><p className="mt-1 text-xs text-white/55">Comparativo de uso por evento no período selecionado</p></div>
     <button type="button" onClick={()=>downloadCsv(rows,usage.from,usage.to)}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 px-3 text-xs font-bold text-white/80 hover:border-[#c4ff40]/50">
      <Download size={15}/> Exportar CSV
     </button>
    </div>
    <div className="mt-4 overflow-x-auto">
     <table className="w-full min-w-[760px] text-left text-sm">
      <thead className="text-xs text-white/50"><tr className="border-b border-white/15">
       <th className="py-3 font-semibold">Evento</th>
       <th className="px-2 py-3 text-right font-semibold">Usuários únicos</th>
       <th className="px-2 py-3 text-right font-semibold">Ativos agora</th>
       <th className="px-2 py-3 text-right font-semibold">Sessões</th>
       <th className="px-2 py-3 text-right font-semibold">Tempo médio</th>
       <th className="py-3 text-right font-semibold">Análise</th>
      </tr></thead>
      <tbody>{rows.map(event=><tr key={event.id} className="border-b border-white/10 last:border-0">
       <td className="py-3 pr-3">
        <p className="max-w-64 truncate font-bold">{event.name}</p>
        <p className="mt-1 text-xs text-white/45">{eventSituation(event)}</p>
       </td>
       <td className="px-2 py-3 text-right font-semibold tabular-nums">{formatNumber(event.visitors)}</td>
       <td className="px-2 py-3 text-right font-semibold tabular-nums text-[#c4ff40]">{formatNumber(event.activeNow)}</td>
       <td className="px-2 py-3 text-right tabular-nums">{formatNumber(event.opens)}</td>
       <td className="px-2 py-3 text-right tabular-nums">{formatDuration(event.avgSessionSeconds)}</td>
       <td className="py-3 text-right">
        <button type="button" onClick={()=>{setEventId(event.id);if(onOpenEvent)onOpenEvent(event.id);}}
         className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold text-[#c4ff40] hover:bg-white/10">
         Ver evento <ArrowUpRight size={14}/>
        </button>
       </td>
      </tr>)}</tbody>
     </table>
    </div>
    {!rows.length&&<p className="py-5 text-center text-sm text-white/50">Nenhum evento disponível.</p>}
   </div>}
   {(registeredUsers!==undefined||venueCount!==undefined||mapCount!==undefined||onlineUsers!==undefined||totalEvents!==undefined)&&<div className="rounded-2xl border border-white/10 bg-[#171320] px-4 py-4">
    <h4 className="text-sm font-semibold text-white/70">Cadastros e operação</h4>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
     {registeredUsers!==undefined&&<div><p className="text-xs text-white/45">Usuários cadastrados</p><p className="mt-1 text-xl font-black">{formatNumber(registeredUsers)}</p></div>}
     {onlineUsers!==undefined&&<div><p className="text-xs text-white/45">Contas ativas (15 min)</p><p className="mt-1 text-xl font-black">{formatNumber(onlineUsers)}</p></div>}
     {venueCount!==undefined&&<div><p className="text-xs text-white/45">Estabelecimentos</p><p className="mt-1 text-xl font-black">{formatNumber(venueCount)}</p></div>}
     {mapCount!==undefined&&<div><p className="text-xs text-white/45">Mapas</p><p className="mt-1 text-xl font-black">{formatNumber(mapCount)}</p></div>}
     {totalEvents!==undefined&&<div><p className="text-xs text-white/45">Eventos cadastrados</p><p className="mt-1 text-xl font-black">{formatNumber(totalEvents)}</p></div>}
    </div>
   </div>}
   <p className="text-xs leading-relaxed text-white/45">
    Pessoas únicas são estimadas por conta ou navegador e podem ser duplicadas ao trocar de dispositivo ou entrar na conta.
    Sessões e duração são estimativas do uso visível, não comprovam check-in ou presença física.
    O retorno compara usuários deste período com os do intervalo imediatamente anterior.
    Os registros são mantidos por até {usage.retentionDays} dias.
   </p>
  </>}
 </section>;
}
