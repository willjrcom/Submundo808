import {AlertTriangle,MapPinOff} from 'lucide-react';
export default function NotFound({status=404,onRetry}:{status?:404|500;onRetry?:()=>void}){
 const missing=status===404;
 return <section role={missing?'status':'alert'} className="mx-auto my-8 flex min-h-[44vh] max-w-lg flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[.035] px-6 py-12 text-center text-white">
  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#c4ff40]/30 bg-[#c4ff40]/10 text-[#c4ff40]">{missing?<MapPinOff size={32}/>:<AlertTriangle size={32}/>}</div>
  <p className="text-xs font-bold tracking-[.3em] text-[#c4ff40]">{status} · SUBMUNDO 808</p>
  <h1 className="mt-3 text-2xl font-black">{missing?'Página não encontrada':'Não foi possível carregar esta página'}</h1>
  <p className="mt-3 text-sm leading-relaxed text-white/60">{missing?'Este endereço não existe ou não está disponível. Use o menu para continuar navegando.':'Ocorreu um erro inesperado. Você pode tentar novamente ou navegar para outra seção.'}</p>
  {!missing&&onRetry&&<button type="button" onClick={onRetry} className="mt-6 rounded-xl bg-[#c4ff40] px-5 py-3 text-sm font-bold text-black">Tentar novamente</button>}
 </section>;
}
