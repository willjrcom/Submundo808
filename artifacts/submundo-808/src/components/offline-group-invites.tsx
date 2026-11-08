import {useState} from 'react';
import {Copy,Check,QrCode} from 'lucide-react';
import GroupInviteQRCode from './group-invite-qr-code';
import {getCachedGroupInvites,groupInviteUrl} from './group-invite-cache';

/** Available even when the social API cannot verify a session without internet.
 * Only QR links explicitly generated and saved on this device are shown.
 */
export default function OfflineGroupInvites(){
 const invites=getCachedGroupInvites();
 const [selectedId,setSelectedId]=useState(invites[0]?.groupId||'');
 const [copied,setCopied]=useState(false);
 const selected=invites.find(entry=>entry.groupId===selectedId)||invites[0];
 if(!selected)return <section aria-label="Convites offline" className="rounded-xl border border-white/15 bg-white/[.04] p-4 text-sm text-white/65">
  Nenhum QR Code de grupo foi preparado neste aparelho. Abra o convite de cada grupo com internet uma vez antes de ir à festa.
 </section>;
 const link=groupInviteUrl(selected.token);
 const copy=async()=>{
  try{await navigator.clipboard.writeText(link);setCopied(true);}
  catch{setCopied(false);}
 };
 return <section aria-label="Convites de grupos offline" className="space-y-3 rounded-2xl border border-[#c4ff40]/30 bg-white/[.04] p-4">
  <h2 className="flex items-center gap-2 text-base font-black"><QrCode size={20} className="text-[#c4ff40]"/> Convites salvos offline</h2>
  <p className="text-xs leading-relaxed text-white/65">Estes QR Codes foram preparados neste celular enquanto havia internet. Você pode mostrá-los sem sinal. Quem escanear precisará de conexão para entrar no grupo.</p>
  {invites.length>1&&<label className="block text-xs font-semibold text-white/70">Escolha o grupo
   <select aria-label="Grupo do convite offline" value={selected.groupId} onChange={event=>{setSelectedId(event.target.value);setCopied(false);}} className="mt-2 w-full rounded-xl border border-white/20 bg-[#241b2c] px-3 py-3 text-sm text-white">
    {invites.map(item=><option key={item.groupId} value={item.groupId}>{item.name}</option>)}
   </select>
  </label>}
  <p className="text-center text-sm font-semibold">{selected.name}</p>
  <div className="mx-auto w-fit rounded-xl bg-white p-3"><GroupInviteQRCode link={link} size={220}/></div>
  <label className="block space-y-2 text-xs text-white/60">Link de convite<input readOnly value={link} onFocus={event=>event.currentTarget.select()} aria-label="Link de convite offline" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs text-white"/></label>
  <button type="button" onClick={()=>void copy()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#c4ff40]/40 px-4 py-3 text-xs font-bold text-[#c4ff40]">{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copiado!':'Copiar link'}</button>
 </section>;
}
