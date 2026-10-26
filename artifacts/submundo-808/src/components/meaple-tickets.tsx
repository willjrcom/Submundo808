import {useEffect,useState} from 'react';

type Ticket={id:string;slug:string;name:string;qrCodeDataUrl:string|null;usedAt:string|null};
type Event={event_id:string;name:string;tickets:Ticket[]};
export default function MeapleTickets({connected}:{connected:boolean}){
 const [events,setEvents]=useState<Event[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[open,setOpen]=useState<string|null>(null);
 async function refresh(){
  setLoading(true);setError('');
  try{const r=await fetch('/api/meaple/tickets',{credentials:'same-origin'}),j=await r.json();if(!r.ok)throw Error(j.error||'Não foi possível buscar ingressos.');setEvents(j.events||[]);setLoaded(true);}
  catch(e){setError(e instanceof Error?e.message:'Erro ao buscar ingressos.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{if(connected)void refresh();},[connected]);
 return <section className="mb-4 space-y-3 rounded-xl border border-white/10 bg-white/[.035] p-4">
  <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Meus ingressos Meaple</h3>{connected&&<button type="button" disabled={loading} onClick={()=>void refresh()} className="text-xs font-semibold text-[#c4ff40]">Atualizar</button>}</div>
  {!connected?<p className="text-xs text-white/60">Vincule sua conta Meaple acima para buscar ingressos automaticamente.</p>:loading?<p className="text-xs text-white/60">Consultando Meaple...</p>:null}
  {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
  {connected&&loaded&&!events.length&&<p className="text-xs text-white/60">Nenhum ingresso encontrado nos eventos Submundo vinculados à Meaple.</p>}
  {events.map(event=><div key={event.event_id} className="space-y-2 rounded-xl border border-white/10 p-3"><p className="font-semibold">{event.name}</p>{event.tickets.map(ticket=><div key={ticket.id} className="space-y-2 rounded-lg bg-black/20 p-3"><p className="text-sm">{ticket.name}</p><p className="text-[11px] text-white/55">Ingresso {ticket.slug} {ticket.usedAt?'• utilizado':''}</p>{ticket.qrCodeDataUrl&&<><button type="button" className="text-xs text-[#c4ff40]" onClick={()=>setOpen(v=>v===ticket.id?null:ticket.id)}>{open===ticket.id?'Ocultar QR Code':'Ver QR Code'}</button>{open===ticket.id&&<img alt={'QR Code do ingresso '+ticket.slug} src={ticket.qrCodeDataUrl} className="mx-auto h-48 w-48 rounded-lg bg-white p-2"/>}</>}</div>)}</div>)}
  <p className="text-[11px] text-white/45">A busca é feita somente para ingressos pertencentes à conta Meaple conectada e eventos associados pelo ID no painel.</p>
 </section>;
}
