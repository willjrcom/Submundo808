import { useEffect, useState } from 'react';
import { Copy, RefreshCw, QrCode, Share2 } from 'lucide-react';
export default function FriendQR() {
  const [token,setToken]=useState('');const [expires,setExpires]=useState(0);const [error,setError]=useState('');const [status,setStatus]=useState('');
  const [seconds,setSeconds]=useState(60);
  async function refresh() {
    try {
      const res=await fetch('/api/friends/code',{method:'POST',credentials:'same-origin'});
      const data=await res.json();if(!res.ok)throw new Error(data.error||'Falha ao gerar código');
      setToken(data.token);setExpires(data.expiresAt);setError('');
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível gerar o código.');}
  }
  useEffect(()=>{void refresh();const timer=window.setInterval(()=>{void refresh();},45000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{const timer=window.setInterval(()=>setSeconds(Math.max(0,Math.ceil((expires-Date.now())/1000))),1000);return()=>window.clearInterval(timer);},[expires]);
  const link=token?window.location.origin+'/?invite='+token:'';
  async function copy(){try{await navigator.clipboard.writeText(link);setStatus('Link copiado! Válido por até 60 segundos.');}catch{setError('Não foi possível copiar o link.');}}
  return <section className="mb-5 rounded-2xl border border-white/10 bg-white/[.04] p-5">
    <div className="mb-3 flex items-center gap-2"><QrCode className="text-[#c4ff40]" size={22}/><h3 className="font-display text-sm font-black uppercase">Meu QR Code</h3></div>
    <p className="mb-4 text-xs leading-relaxed text-white/55">Mostre este código para adicionar um amigo instantaneamente. Ele expira em 60 segundos e se renova automaticamente.</p>
    {token&&<div className="mx-auto w-fit rounded-xl bg-white p-3"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`} alt="QR Code temporário para adicionar amigo" width={220} height={220}/></div>}
    <p className="mt-3 text-center text-xs text-white/55">Expira em <strong className="text-[#c4ff40]">{seconds}s</strong></p>
    <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={!token} onClick={()=>void copy()} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-3 text-xs font-bold disabled:opacity-40"><Copy size={15}/> Copiar link</button><button disabled={!token} onClick={async()=>{if(navigator.share){try{await navigator.share({title:'Adicione-me no Submundo 808',url:link});}catch{}}else await copy();}} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-3 text-xs font-bold disabled:opacity-40"><Share2 size={15}/> Compartilhar</button></div>
    <button onClick={()=>void refresh()} className="mt-3 flex w-full items-center justify-center gap-2 text-xs text-white/60"><RefreshCw size={14}/> Gerar outro código</button>
    {error&&<p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}{status&&<p role="status" className="mt-3 text-xs text-[#c4ff40]">{status}</p>}
    <p className="mt-3 text-xs text-white/40">A imagem é gerada por um serviço externo. Apenas o token temporário é compartilhado, nunca seu e-mail ou senha.</p>
  </section>;
}
