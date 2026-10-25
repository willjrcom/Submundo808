import { useEffect, useState } from 'react';
import { Copy, QrCode, Share2 } from 'lucide-react';
export default function FriendQR(){
 const [token,setToken]=useState('');const [error,setError]=useState('');const [status,setStatus]=useState('');
 useEffect(()=>{let live=true;fetch('/api/friends/code',{method:'POST',credentials:'same-origin'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível carregar QR Code');if(live)setToken(d.token);}).catch(e=>{if(live)setError(String(e.message||e));});return()=>{live=false;};},[]);
 const link=token?window.location.origin+'/?invite='+token:'';
 async function copy(){try{await navigator.clipboard.writeText(link);setStatus('Link copiado! Ele não expira.');}catch{setError('Não foi possível copiar.');}}
 return <section className="mb-5 rounded-2xl border border-white/10 bg-white/[.04] p-5">
  <div className="mb-3 flex items-center gap-2"><QrCode className="text-[#c4ff40]" size={22}/><h3 className="font-display text-sm font-black uppercase">Meu QR Code</h3></div>
  <p className="mb-4 text-xs leading-relaxed text-white/55">Mostre seu QR Code ou compartilhe seu link pelo WhatsApp. O convite é permanente e pode ser utilizado por várias pessoas.</p>
  {token?<div className="mx-auto w-fit rounded-xl bg-white p-3"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=12&data=${encodeURIComponent(link)}`} alt="QR Code permanente para adicionar amigo" width={260} height={260}/></div>:<p className="text-center text-xs text-white/50">Carregando QR Code...</p>}
  <p className="mt-3 text-center text-xs font-bold text-[#c4ff40]">Seu código não expira</p>
  <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={!token} onClick={()=>void copy()} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-3 text-xs font-bold disabled:opacity-40"><Copy size={15}/> Copiar link</button><button disabled={!token} onClick={async()=>{if(navigator.share){try{await navigator.share({title:'Me adicione no Submundo 808',url:link});}catch{}}else await copy();}} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-3 text-xs font-bold disabled:opacity-40"><Share2 size={15}/> Compartilhar</button></div>
  {error&&<p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}{status&&<p role="status" className="mt-3 text-xs text-[#c4ff40]">{status}</p>}
  <p className="mt-3 text-xs text-white/40">Qualquer pessoa com o código pode adicionar você. O QR é gerado por um serviço externo, sem incluir seu e-mail ou senha.</p>
 </section>;
}
