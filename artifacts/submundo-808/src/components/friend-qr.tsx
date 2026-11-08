import {useEffect,useState} from 'react';
import {Copy,Check,QrCode,Share2,LoaderCircle} from 'lucide-react';
import GroupInviteQRCode from './group-invite-qr-code';
import {getCachedFriendCode,saveCachedFriendCode} from './offline-private-data';

export default function FriendQR(){
 const [token,setToken]=useState(getCachedFriendCode);
 const [error,setError]=useState(''),[status,setStatus]=useState(''),[copied,setCopied]=useState(false);
 useEffect(()=>{
  if(!navigator.onLine){
   if(!getCachedFriendCode())setError('Abra seu QR Code com internet uma vez para deixá-lo disponível offline.');
   return;
  }
  let live=true;
  fetch('/api/friends/code',{method:'POST',credentials:'same-origin'})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível carregar QR Code');return d;})
   .then(d=>{
    if(!live)return;
    if(typeof d.token!=='string'||!/^[a-f0-9]{64}$/.test(d.token))throw Error('Convite inválido.');
    saveCachedFriendCode(d.token);
    setToken(d.token);setError('');
   })
   .catch(e=>{if(live&&!getCachedFriendCode())setError(String(e.message||e));});
  return()=>{live=false;};
 },[]);
 const link=token?window.location.origin+'/?invite='+token:'';
 async function copy(){
  try{await navigator.clipboard.writeText(link);setStatus('Link copiado! Ele não expira.');setCopied(true);window.setTimeout(()=>setCopied(false),2200);}
  catch{setError('Não foi possível copiar.');}
 }
 return <section className="mb-5 rounded-2xl border border-white/10 bg-white/[.04] p-5">
  <div className="mb-3 flex items-center gap-2"><QrCode className="text-[#c4ff40]" size={22}/><h3 className="font-display text-sm font-black uppercase">Meu QR Code</h3></div>
  <p className="mb-4 text-xs leading-relaxed text-white/55">Mostre seu QR Code ou compartilhe seu link. Depois da primeira abertura com internet, ele também aparece offline neste dispositivo.</p>
  <div className="relative mx-auto flex min-h-[284px] w-full max-w-[284px] items-center justify-center rounded-xl bg-white p-3">
   {token?<GroupInviteQRCode link={link} size={260}/>:!error?<div role="status" className="flex flex-col items-center gap-3 text-center text-xs text-[#473950]"><LoaderCircle className="motion-safe:animate-spin" size={28}/><span>Preparando QR Code...</span></div>:<p className="px-3 text-center text-xs text-[#473950]">QR indisponível. Abra com internet ao menos uma vez.</p>}
  </div>
  <p className="mt-3 text-center text-xs font-bold text-[#c4ff40]">Seu código não expira</p>
  <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={!token} onClick={()=>void copy()} className={"flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition-all duration-200 disabled:opacity-40 "+(copied?"border-[#c4ff40] bg-[#c4ff40]/15 text-[#c4ff40] scale-[1.02]":"border-white/15")}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?'Copiado!':'Copiar link'}</button><button disabled={!token} onClick={async()=>{if(navigator.share){try{await navigator.share({title:'Me adicione no Submundo 808',url:link});}catch{}}else await copy();}} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-3 text-xs font-bold disabled:opacity-40"><Share2 size={15}/> Compartilhar</button></div>
  {error&&<p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}{status&&<p role="status" className="mt-3 text-xs text-[#c4ff40]">{status}</p>}
  <p className="mt-3 text-xs text-white/40">O QR é gerado no próprio celular. Quem receber o link precisará de internet para concluir a amizade.</p>
 </section>;
}
