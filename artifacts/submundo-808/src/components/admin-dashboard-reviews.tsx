import {useEffect,useState} from 'react';
import {MessageSquare,Star,ChevronDown,ChevronUp} from 'lucide-react';

type Review={event_id:string;event_name:string;rating:number;tags:string[];comment:string;updated_at:number};
type Summary={count:number;average:number|null};
type Report={items:Review[];summary:Summary};
type Props={eventId?:string;venueId?:string};
const empty:Report={items:[],summary:{count:0,average:null}};

export default function AdminDashboardReviews({eventId,venueId}:Props){
 const [data,setData]=useState<Report>(empty);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[visible,setVisible]=useState(3);
 const param=eventId?'event_id='+encodeURIComponent(eventId):'venue_id='+encodeURIComponent(venueId||'');
 const scopeKey=(eventId?'event:':'venue:')+(eventId||venueId||'');
 useEffect(()=>{
  let active=true;
  setData(empty);setLoading(true);setError('');setVisible(3);
  void fetch('/api/admin/reviews?'+param,{credentials:'same-origin'})
   .then(async res=>{const body=await res.json();if(!res.ok)throw Error(body.error||'Erro ao consultar avaliações.');return body as Report;})
   .then(report=>{if(active)setData(report);})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível carregar as avaliações.');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[scopeKey]);
 const count=data.summary.count,average=data.summary.average;
 const tags=data.items.flatMap(item=>Array.isArray(item.tags)?item.tags:[])
  .reduce<Record<string,number>>((acc,tag)=>(acc[tag]=(acc[tag]||0)+1,acc),{});
 return <section aria-label={eventId?'Avaliações deste evento':'Avaliações do estabelecimento'}
  className="space-y-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5">
  <div className="flex items-center gap-2"><MessageSquare size={20} className="text-[#c4ff40]"/><div>
   <h3 className="text-lg font-black">Avaliações</h3>
   <p className="text-xs text-white/55">{eventId?'Respostas dos participantes deste evento.':'Resumo de todos os eventos deste estabelecimento.'}</p>
  </div></div>
  <div className="grid grid-cols-2 gap-3">
   <div className="rounded-xl border border-white/10 bg-[#17111e] p-3"><p className="text-xs text-white/55">Nota média</p><p className="mt-1 flex items-center gap-2 text-2xl font-black text-[#c4ff40]"><Star size={18}/>{average===null?'—':average.toFixed(1).replace('.',',')}</p></div>
   <div className="rounded-xl border border-white/10 bg-[#17111e] p-3"><p className="text-xs text-white/55">Respostas</p><p className="mt-1 text-2xl font-black text-[#c4ff40]">{count}</p></div>
  </div>
  {loading&&<p role="status" className="text-xs text-white/60">Carregando avaliações...</p>}
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
  {!loading&&!error&&count===0&&<p className="text-sm text-white/55">Este {eventId?'evento':'estabelecimento'} ainda não recebeu avaliações.</p>}
  {!!Object.keys(tags).length&&<div className="flex flex-wrap gap-2">{Object.entries(tags).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([tag,total])=>
   <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">{tag} · {total}</span>
  )}</div>}
  {!!data.items.length&&<div className="space-y-2">
   {data.items.slice(0,visible).map((review,i)=><article key={review.event_id+'-'+review.updated_at+'-'+i} className="rounded-xl border border-white/10 p-3">
    <p aria-label={review.rating+' de 5 estrelas'} className="text-sm font-semibold text-[#c4ff40]">{'★'.repeat(Math.max(0,Math.min(5,review.rating)))}{'☆'.repeat(Math.max(0,5-review.rating))}</p>
    <p className="mt-1 text-xs text-white/45">{review.event_name} · {new Date(review.updated_at).toLocaleDateString('pt-BR')}</p>
    {!!review.tags?.length&&<p className="mt-2 text-xs text-white/60">{review.tags.join(' · ')}</p>}
    {review.comment&&<p className="mt-2 whitespace-pre-wrap break-words text-sm text-white/80">{review.comment}</p>}
   </article>)}
   {visible<data.items.length&&<button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-[#c4ff40]" onClick={()=>setVisible(n=>n+10)}><ChevronDown size={15}/> Mostrar mais avaliações</button>}
   {visible>3&&<button type="button" className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold" onClick={()=>setVisible(3)}><ChevronUp size={15}/> Mostrar menos</button>}
   {count>data.items.length&&<p className="text-[11px] text-white/45">Exibindo as {data.items.length} avaliações mais recentes.</p>}
  </div>}
 </section>;
}
