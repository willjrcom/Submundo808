import { useEffect, useState } from 'react';
import {displayLabel} from './display-label';
import {validateDjLinks,validateEventFields} from './event-save-validation';
type Item={id:string;name:string;venue_id?:string;map_id?:string;x?:number;y?:number;width?:number;height?:number;gps?:Record<string,{lat:number;lng:number;accuracy:number}>};
const input='w-full rounded-xl border border-white/20 bg-[#241b2c] p-3 text-sm text-white';
async function request(route:string,payload?:object){const r=await fetch('/api/admin/'+route,{method:payload?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});const j=await r.json();if(!r.ok)throw Error(j.error||'Falha na operação');return j;}
export function AreaEditor({maps}:{maps:Item[]}){
 const [areas,setAreas]=useState<Item[]>([]),[mapId,setMapId]=useState(''),[name,setName]=useState(''),[kind,setKind]=useState('principal'),[x,setX]=useState(10),[y,setY]=useState(10),[width,setWidth]=useState(35),[height,setHeight]=useState(30),[selected,setSelected]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(){setAreas((await request('areas')).items);}
 useEffect(()=>{void load().catch(e=>setError(String(e)));},[]);
 const filtered=areas.filter(a=>a.map_id===mapId),active=areas.find(a=>a.id===selected);
 async function create(e:React.FormEvent){e.preventDefault();setError('');try{await request('areas',{map_id:mapId,name,kind,x,y,width,height});setName('');await load();}catch(e){setError(String(e));}}
 async function capture(corner:string){setError('');setMessage('Obtendo localização...');if(!navigator.geolocation){setError('GPS indisponível.');return;}navigator.geolocation.getCurrentPosition(async p=>{try{await request('gps',{id:selected,corner,lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});await load();setMessage('Ponto salvo com precisão ±'+Math.round(p.coords.accuracy)+' m');}catch(e){setError(String(e));}},e=>{setError(e.message);setMessage('');},{enableHighAccuracy:true,timeout:20000,maximumAge:0});}
 return <div className="mt-6 space-y-5"><h3 className="text-lg font-bold">Editor de ambientes</h3><select className={input} value={mapId} onChange={e=>{setMapId(e.target.value);setSelected('');}}><option value="">Selecione um mapa</option>{maps.map(m=><option key={m.id} value={m.id}>{displayLabel(m.name)}</option>)}</select>{mapId&&<><div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/20 bg-[#241b2c]" style={{backgroundImage:'linear-gradient(#ffffff0b 1px, transparent 1px),linear-gradient(90deg,#ffffff0b 1px, transparent 1px)',backgroundSize:'10% 10%'}}>{filtered.map(a=><button key={a.id} onClick={()=>setSelected(a.id)} className={'absolute flex items-center justify-center overflow-hidden border-2 p-1 text-xs font-bold '+(selected===a.id?'border-[#c4ff40] bg-[#c4ff40]/30':'border-violet-400 bg-violet-500/25')} style={{left:a.x+'%',top:a.y+'%',width:a.width+'%',height:a.height+'%'}}>{a.name}</button>)}</div><form onSubmit={create} className="space-y-3 rounded-xl border border-white/10 p-4"><p className="font-bold">Novo ambiente</p><input required className={input} placeholder="Nome: Principal, VIP, Backstage" value={name} onChange={e=>setName(e.target.value)}/><select className={input} value={kind} onChange={e=>setKind(e.target.value)}>{['principal','vip','backstage','bar','banheiro','outro'].map(k=><option key={k}>{k}</option>)}</select><div className="grid grid-cols-2 gap-3">{[[x,setX,'X (%)'],[y,setY,'Y (%)'],[width,setWidth,'Largura (%)'],[height,setHeight,'Altura (%)']].map(([value,set,label])=><label key={String(label)} className="text-xs text-white/60">{String(label)}<input type="number" min="0" max="100" className={input+' mt-1'} value={value as number} onChange={e=>(set as (n:number)=>void)(Number(e.target.value))}/></label>)}</div><button className="w-full rounded-xl bg-[#c4ff40] p-3 font-bold text-black">Criar ambiente</button></form>{active&&<div className="rounded-xl border border-[#c4ff40]/30 p-4"><h4 className="mb-3 font-bold">Calibrar GPS: {active.name}</h4><p className="mb-4 text-xs text-white/60">Vá fisicamente a cada canto do ambiente e toque em capturar. Prefira leituras com boa precisão.</p><div className="grid grid-cols-2 gap-3">{[{id:'tl',label:'Superior esquerdo'},{id:'tr',label:'Superior direito'},{id:'br',label:'Inferior direito'},{id:'bl',label:'Inferior esquerdo'}].map(c=><button key={c.id} onClick={()=>void capture(c.id)} className="rounded-xl border border-white/20 p-3 text-xs">{c.label}<span className="mt-1 block text-[#c4ff40]">{active.gps?.[c.id]?'✓ Capturado':'Capturar GPS'}</span></button>)}</div><p className="mt-3 text-xs text-white/60">{message}</p></div>}</>}{error&&<p className="text-sm text-red-300">{error}</p>}</div>;
}
export function EventEditor({venues,maps,onSaved,onPublicationChanged,onOpenMenu,event}:{venues:Item[];maps:Item[];onSaved:()=>void;onPublicationChanged?:()=>void;onOpenMenu?:()=>void;event?:any}){
 const [tab,setTab]=useState<'geral'|'programacao'|'mapa'|'cardapio'|'ingressos'>('geral');
 const [confirmDj,setConfirmDj]=useState<number|null>(null);
 const [name,setName]=useState(event?.name||''),[venue,setVenue]=useState(event?.venue_id||''),[selected,setSelected]=useState<string[]>(event?.map_ids||[]),[description,setDescription]=useState(event?.description||''),[starts,setStarts]=useState(event?.starts_at||''),[ends,setEnds]=useState(event?.ends_at||''),[site,setSite]=useState(event?.site_url||''),[tickets,setTickets]=useState(event?.tickets_url||''),[instagram,setInstagram]=useState(event?.instagram_url||''),[djs,setDjs]=useState<{nome:string;instagram:string;spotify?:string;inicio:string;fim:string}[]>(event?.lineup||[]),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [doors,setDoors]=useState(event?.doors_at||''),[cover,setCover]=useState(event?.cover_image||''),[services,setServices]=useState(event?.services||''),[published,setPublished]=useState(Boolean(event?.is_published)),[publishing,setPublishing]=useState(false);
 const [locationSharingEnabled,setLocationSharingEnabled]=useState(event?Number(event.location_sharing_enabled)===1:true);
  const [confirmDisableLocation,setConfirmDisableLocation]=useState(false),[locationBusy,setLocationBusy]=useState(false),[locationError,setLocationError]=useState(''),[locationNotice,setLocationNotice]=useState('');
 const [meapleEventId,setMeapleEventId]=useState(event?.meaple_event_id||'');
 const [saving,setSaving]=useState(false);
 const [eventFormChanged,setEventFormChanged]=useState(false),[confirmMenuExit,setConfirmMenuExit]=useState(false);
 function requestMenu(){if(!onOpenMenu)return;if(eventFormChanged){setConfirmMenuExit(true);return;}onOpenMenu();}
 async function changeLocationSharing(enabled:boolean){
  if(locationBusy||saving)return;
  setLocationError('');setLocationNotice('');
  if(!event?.id){
   setLocationSharingEnabled(enabled);setConfirmDisableLocation(false);setEventFormChanged(true);
   return;
  }
  setLocationBusy(true);
  try{
   await request('set-event-location-sharing',{id:event.id,enabled});
   setLocationSharingEnabled(enabled);
   setConfirmDisableLocation(false);
   setLocationNotice(enabled?'Localização permitida neste evento. Cada participante precisa ativar seu GPS no Mapa.':'Compartilhamento desativado. As sessões e posições ativas deste evento foram encerradas.');
   onPublicationChanged?.();
  }catch(err){
   setLocationError(err instanceof Error?err.message:'Não foi possível alterar o compartilhamento. Tente novamente.');
  }finally{setLocationBusy(false);}
 }
 async function save(e:React.FormEvent){
  e.preventDefault();
  if(saving||locationBusy)return;
  setError('');setMessage('');
  const validation=validateEventFields(name,venue,starts,ends,[site,tickets,instagram])||validateDjLinks(djs);
  if(validation){setTab('geral');setError(validation);return;}
  setSaving(true);
  try{
   await request(event?'edit-event':'events',{id:event?.id,name:name.trim(),venue_id:venue,map_ids:selected,description,starts_at:starts,ends_at:ends,site_url:site,tickets_url:tickets,instagram_url:instagram,lineup:djs,doors_at:doors,cover_image:cover,services,meaple_event_id:meapleEventId,location_sharing_enabled:locationSharingEnabled});
   setMessage('Evento salvo com sucesso.');onSaved();
  }catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar o evento.');}
  finally{setSaving(false);}
 }
 async function togglePublication(){
  if(!event?.id)return;
  setPublishing(true);setError('');setMessage('');
  try{const result=await request('set-event-publication',{id:event.id,published:!published});setPublished(Boolean(result.is_published));onPublicationChanged?.();setMessage(result.is_published?'Evento publicado na agenda pública.':'Evento retirado da agenda pública.');}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setPublishing(false);}
 }
 const tabs:[typeof tab,string][]=[['geral','Geral'],['programacao','Programação'],['mapa','Mapas'],['cardapio','Cardápio'],['ingressos','Ingressos']];
 return <div className="mt-8 max-w-3xl space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-4">
   <div><h3 className="font-bold">{event?'Editar evento':'Novo evento'}</h3><p className="mt-1 text-xs text-white/55">{published?'Publicado e visível aos participantes':'Rascunho — invisível na agenda pública'}</p></div>
   {event&&<button type="button" disabled={publishing} onClick={()=>void togglePublication()} className={'rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 '+(published?'border border-amber-400/40 text-amber-200':'bg-[#c4ff40] text-black')}>{publishing?'Atualizando...':published?'Despublicar evento':'Publicar evento'}</button>}
  </div>
  <nav aria-label="Seções do evento" className="flex flex-wrap gap-2 border-b border-white/10 pb-3">{tabs.map(([key,label])=><button type="button" key={key} aria-current={tab===key?'page':undefined} onClick={()=>setTab(key)} className={'rounded-xl px-3 py-2.5 text-sm font-semibold '+(tab===key?'bg-[#c4ff40] text-black':'border border-white/15 text-white/70')}>{label}</button>)}</nav>
  <form noValidate onSubmit={save} onChange={()=>setEventFormChanged(true)} className="space-y-4 rounded-2xl border border-white/10 p-5">
   <div className={tab==='geral'?'space-y-4':'hidden'}><h4 className="font-bold">Dados gerais</h4>
    <label className="block space-y-1 text-xs text-white/65">Nome<input required={tab==='geral'} className={input} placeholder="Nome do evento" value={name} onChange={e=>setName(e.target.value)}/></label>
    <label className="block space-y-1 text-xs text-white/65">Estabelecimento<select required={tab==='geral'} className={input} value={venue} onChange={e=>{setVenue(e.target.value);setSelected([]);}}><option value="">Selecione</option>{venues.map(v=><option key={v.id} value={v.id}>{displayLabel(v.name)}</option>)}</select></label>
    <textarea className={input} placeholder="Descrição" value={description} onChange={e=>setDescription(e.target.value)}/>
    <label className="block text-xs">Abertura dos portões (opcional)<input type="datetime-local" value={doors} onChange={e=>setDoors(e.target.value)} className={input+' [color-scheme:dark] mt-1'}/></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Início do show<input type="datetime-local" step="60" className={input+' [color-scheme:dark]'} value={starts} onChange={e=>setStarts(e.target.value)}/></label><label className="text-xs">Fim<input type="datetime-local" className={input+' [color-scheme:dark]'} value={ends} onChange={e=>setEnds(e.target.value)}/></label></div>
    <label className="block space-y-2 text-xs">Capa do evento (opcional)<input type="file" accept="image/jpeg,image/png,image/webp" className={input} onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>6_000_000){setError('Imagem muito grande (máximo 6 MB).');return;}const img=new Image();const u=URL.createObjectURL(file);img.onload=()=>{const canvas=document.createElement('canvas'),scale=Math.min(1,800/img.width,450/img.height);canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d')?.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(u);const data=canvas.toDataURL('image/jpeg',.68);if(data.length>150000){setError('A capa ainda está muito grande. Tente uma imagem menor.');return;}setCover(data);setError('');};img.onerror=()=>{URL.revokeObjectURL(u);setError('Imagem inválida.');};img.src=u;}}/>{cover&&<div className="space-y-2"><img src={cover} alt="Prévia da capa do evento" className="h-36 w-full rounded-xl object-cover"/><button type="button" className="text-xs text-red-300 underline" onClick={()=>{setCover('');setEventFormChanged(true);}}>Remover capa</button></div>}</label>
    <label className="block space-y-1 text-xs">Serviços extras deste evento (opcional)<textarea rows={3} maxLength={2000} value={services} onChange={e=>setServices(e.target.value)} className={input} placeholder="Ex.: Chapelaria R$ 12; ambulatório; guarda-volumes"/></label>
    <label className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/[.03] p-4 text-sm"><input type="checkbox" checked={locationSharingEnabled} disabled={locationBusy||saving} onChange={e=>{e.stopPropagation();if(e.target.checked)void changeLocationSharing(true);else{setLocationError('');setConfirmDisableLocation(true);}}} className="mt-1 h-4 w-4 shrink-0 accent-[#c4ff40]"/><span><strong className="block">Permitir compartilhamento de localização neste evento</strong><span className="mt-1 block text-xs text-white/55">Ativado por padrão nos eventos novos. Os participantes só compartilham sua posição quando ativam o GPS no Mapa. Desativar não remove o mapa.</span></span></label>
     {locationBusy&&<p role="status" className="text-xs text-white/60">Atualizando compartilhamento...</p>}
     {locationNotice&&<p role="status" className="text-xs text-[#c4ff40]">{locationNotice}</p>}
     {locationError&&!confirmDisableLocation&&<p role="alert" className="text-xs text-red-300">{locationError}</p>}
    <input type="url" className={input} placeholder="Site oficial" value={site} onChange={e=>setSite(e.target.value)}/>
   </div>
   <div className={tab==='programacao'?'space-y-3':'hidden'}><div className="flex items-center justify-between"><h4 className="font-bold">Programação / Lineup</h4><button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-xs" onClick={()=>{setEventFormChanged(true);setDjs(v=>[...v,{nome:'',instagram:'',spotify:'',inicio:'',fim:''}]);}}>+ DJ</button></div><p className="text-xs leading-relaxed text-white/55">Informe a data e o horário de início e fim de cada DJ. Para apresentações depois da meia-noite, selecione a data do dia seguinte. O participante verá automaticamente quem está tocando na aba Início, inclusive offline.</p>
    {djs.map((dj,i)=><div key={i} className="space-y-3 rounded-xl border border-white/10 p-4">
      <label className="block space-y-1 text-xs">Nome do DJ<input className={input} value={dj.nome} placeholder="Nome artístico" onChange={e=>setDjs(v=>v.map((d,j)=>j===i?{...d,nome:e.target.value}:d))}/></label>
      <div className="grid gap-2 sm:grid-cols-2">{(['inicio','fim'] as const).map(k=><label key={k} className="block space-y-1 text-xs">{k==='inicio'?'Início':'Fim'}<input type="datetime-local" className={input+' [color-scheme:dark]'} value={dj[k]} onChange={e=>setDjs(v=>v.map((d,j)=>j===i?{...d,[k]:e.target.value}:d))}/></label>)}</div>
      {(['instagram','spotify'] as const).map(k=><label key={k} className="block space-y-1 text-xs">Link completo do {k==='instagram'?'Instagram':'Spotify'} (opcional)<input type="url" className={input} placeholder={k==='instagram'?'https://www.instagram.com/nome_do_dj/':'https://open.spotify.com/artist/...'} value={dj[k]||''} onChange={e=>setDjs(v=>v.map((d,j)=>j===i?{...d,[k]:e.target.value}:d))}/></label>)}
      <p className="text-[11px] text-white/50">Cole a URL completa. Não informe apenas @usuário.</p>
      <button type="button" onClick={()=>setConfirmDj(i)} className="text-xs text-red-300">Remover DJ</button>
    </div>)}
    {!djs.length&&<p className="text-sm text-white/55">Nenhuma atração cadastrada.</p>}
   </div>
   <div className={tab==='mapa'?'space-y-3':'hidden'}><h4 className="font-bold">Mapas do evento</h4><p className="text-xs text-white/55">Selecione os mapas cadastrados no estabelecimento. Para editar plantas e ambientes, abra o estabelecimento no painel administrativo.</p>
    {maps.filter(m=>m.venue_id===venue).map(m=><label key={m.id} className="flex items-center gap-3 rounded-lg border border-white/10 p-3 text-sm"><input type="checkbox" checked={selected.includes(m.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,m.id]:v.filter(id=>id!==m.id))}/>{displayLabel(m.name)}</label>)}
    {!maps.some(m=>m.venue_id===venue)&&<p className="text-xs text-amber-200">Nenhum mapa cadastrado para este estabelecimento.</p>}
   </div>
   <div className={tab==='cardapio'?'space-y-3':'hidden'}>
    <div className="space-y-3 rounded-xl border border-[#c4ff40]/25 bg-[#c4ff40]/[.035] p-4">
     <h4 className="font-bold">Cardápio do evento</h4>
     <p className="text-sm text-white/60">{event?.id?'O cardápio agora é gerenciado em uma tela própria, com mais espaço para pesquisar, adicionar produtos e ajustar preços.':'Salve o evento primeiro para configurar seus produtos e preços.'}</p>
     {event?.id&&onOpenMenu&&<button type="button" onClick={requestMenu} className="rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-bold text-black">Abrir editor de cardápio</button>}
     {event?.id&&<p className="text-xs text-amber-100/80">Se você alterou outros dados deste evento, salve-os antes de abrir o cardápio.</p>}
    </div>
   </div>
   <div className={tab==='ingressos'?'space-y-3':'hidden'}><h4 className="font-bold">Ingressos e redes sociais</h4><label className="block text-xs">ID do evento na Meaple<input className={input} value={meapleEventId} onChange={e=>setMeapleEventId(e.target.value)} placeholder="ID do evento na Meaple"/></label><input type="url" className={input} placeholder="Link externo de ingressos" value={tickets} onChange={e=>setTickets(e.target.value)}/><input type="url" className={input} placeholder="Instagram do evento" value={instagram} onChange={e=>setInstagram(e.target.value)}/><p className="text-xs text-white/50">Sem processamento de pagamentos pelo aplicativo.</p></div>
   {tab!=='cardapio'&&<button type="submit" disabled={saving||locationBusy} className="w-full rounded-xl bg-[#c4ff40] p-3 font-bold text-black disabled:opacity-50">{saving?'Salvando evento...':'Salvar evento'}</button>}
  </form>
  {event&&!published&&<p className="text-xs text-white/55">Para publicar: salve nome, estabelecimento, datas válidas e pelo menos um mapa. Depois use “Publicar evento”.</p>}
  {confirmDisableLocation&&<div role="presentation" className="fixed inset-0 z-[160] flex items-start justify-center overflow-y-auto bg-black/85 p-3 py-6" onMouseDown={e=>{if(e.target===e.currentTarget&&!locationBusy)setConfirmDisableLocation(false);}}>
   <section role="alertdialog" aria-modal="true" aria-labelledby="disable-event-location-title" aria-describedby="disable-event-location-description" className="my-auto w-full max-w-md space-y-4 rounded-2xl border border-red-400/35 bg-[#211729] p-5 shadow-2xl">
    <div className="flex items-start justify-between gap-3">
     <h3 id="disable-event-location-title" className="text-lg font-black">Desativar compartilhamento de localização?</h3>
     <button type="button" aria-label="Fechar confirmação de localização" disabled={locationBusy} onClick={()=>setConfirmDisableLocation(false)} className="rounded-lg border border-white/20 px-3 py-2 text-white/70 disabled:opacity-50">✕</button>
    </div>
    <p id="disable-event-location-description" className="text-sm leading-relaxed text-white/75">{event?.id?'A desativação será imediata: as posições dos amigos serão retiradas e as sessões de GPS e Estatísticas deste evento serão encerradas.':'Ao cadastrar este evento, os participantes não poderão compartilhar localização nem contribuir para Estatísticas até você permitir.'} O mapa 2D continuará disponível. Ao permitir novamente, cada participante precisará ativar seu GPS.</p>
    {locationError&&<p role="alert" className="rounded-lg border border-red-400/30 p-3 text-sm text-red-300">{locationError}</p>}
    <button type="button" autoFocus disabled={locationBusy} onClick={()=>void changeLocationSharing(false)} className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{locationBusy?'Desativando...':'Confirmar desativação'}</button>
   </section>
  </div>}
  {confirmDj!==null&&<div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/20 bg-[#241b2c] p-6"><h3 className="text-lg font-bold">Remover DJ?</h3><p className="text-sm text-white/70">Remover {djs[confirmDj]?.nome||'este DJ'} do lineup?</p><div className="flex justify-end gap-3"><button type="button" onClick={()=>setConfirmDj(null)} className="rounded-xl border border-white/20 px-4 py-2">Cancelar</button><button type="button" onClick={()=>{setDjs(v=>v.filter((_,i)=>i!==confirmDj));setEventFormChanged(true);setConfirmDj(null);}} className="rounded-xl bg-red-600 px-4 py-2 font-bold">Remover</button></div></div></div>}
  {confirmMenuExit&&<div role="presentation" className="fixed inset-0 z-[140] flex items-center justify-center bg-black/85 p-3">
   <div role="alertdialog" aria-modal="true" aria-labelledby="unsaved-event-title" className="w-full max-w-md space-y-4 rounded-2xl border border-amber-400/35 bg-[#211729] p-5 shadow-2xl">
    <h3 id="unsaved-event-title" className="text-lg font-black">Alterações do evento não salvas</h3>
    <p className="text-sm text-white/65">Você modificou os dados do evento. Salve-os antes de abrir a página do cardápio ou descarte essas edições.</p>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" autoFocus onClick={()=>setConfirmMenuExit(false)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm">Continuar editando</button><button type="button" onClick={()=>{setConfirmMenuExit(false);onOpenMenu?.();}} className="rounded-xl border border-amber-400/40 px-4 py-2.5 text-sm font-bold text-amber-200">Descartar e abrir cardápio</button></div>
   </div>
  </div>}
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}{message&&<p role="status" className="text-sm text-[#c4ff40]">{message}</p>}
 </div>;
}
