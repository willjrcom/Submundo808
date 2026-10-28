import {useEffect,useState} from 'react';
import {ArrowLeft,Copy,Link2,Plus,Users,UserPlus,LogOut,Trash2,X,QrCode,Share2,Check,Megaphone,Bell,AlertTriangle,Pencil,UserCheck,Clock3,Search} from 'lucide-react';
import SocialAvatar from './social-avatar';
import GroupAvatar from './group-avatar';
import {optimizeAvatar} from './optimized-avatar';
import GroupQrScanner from './group-qr-scanner';

type Person={id:string;name:string;avatar?:string};
type Group={id:string;name:string;description:string;color:string;ownerId:string;memberCount:number;avatars:Person[];editPolicy?:'admin'|'everyone';joinPolicy?:'direct'|'approval';icon?:string;photo?:string};
type GroupDetail=Group&{members:(Person&{role:string;relation:'self'|'friends'|'sent'|'received'|'none'})[];role:string};
async function groupApi(route:string,data?:object){
 const r=await fetch('/api/groups'+route,{method:data?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
 const j=await r.json();if(!r.ok)throw Error(j.error||'Não foi possível concluir a operação.');return j;
}
const colors=['#8957e5','#14b87a','#f48a31','#ffc24b','#eb6076'];
function inviteToken(value:string){
 const text=value.trim();
 try{const url=new URL(text);return url.searchParams.get('group_invite')||'';}catch{return text;}
}
export default function FriendGroups({onDetailChange}:{onDetailChange?:(open:boolean)=>void}){
 const [groups,setGroups]=useState<Group[]>([]),[selected,setSelected]=useState<GroupDetail|null>(null);
 const [memberActionsId,setMemberActionsId]=useState<string|null>(null);
 useEffect(()=>{onDetailChange?.(selected!==null);},[selected,onDetailChange]);
 const [mode,setMode]=useState<'list'|'create'|'join'>('list'),[name,setName]=useState(''),[description,setDescription]=useState(''),[color,setColor]=useState(colors[0]),[photo,setPhoto]=useState('');
 const [inviteLink,setInviteLink]=useState(''),[joinLink,setJoinLink]=useState(new URLSearchParams(window.location.search).get('group_invite')||'');
 const [preview,setPreview]=useState<(Group&{joined:boolean})|null>(null),[qrOpen,setQrOpen]=useState(false);
 const [linkedInvite,setLinkedInvite]=useState(()=>Boolean(new URLSearchParams(window.location.search).get('group_invite')));
 const [previewLoading,setPreviewLoading]=useState(false),[participantsOpen,setParticipantsOpen]=useState(false),[participantNames,setParticipantNames]=useState<{name:string}[]>([]),[participantsLoading,setParticipantsLoading]=useState(false);
 const [dialog,setDialog]=useState<'leave'|'delete'|null>(null),[successorId,setSuccessorId]=useState(''),[confirmation,setConfirmation]=useState('');
 const [alertOpen,setAlertOpen]=useState(false),[alertTab,setAlertTab]=useState<'send'|'history'>('send'),[alertChoice,setAlertChoice]=useState(''),[alerts,setAlerts]=useState<{id:string;code:string;message:string;createdAt:number;senderName:string;avatar?:string}[]>([]);
 const [copied,setCopied]=useState(false);
 const [editOpen,setEditOpen]=useState(false),[editName,setEditName]=useState(''),[editDescription,setEditDescription]=useState(''),[editColor,setEditColor]=useState(''),[editIcon,setEditIcon]=useState('users'),[editPolicy,setEditPolicy]=useState<'admin'|'everyone'>('admin'),[joinPolicy,setJoinPolicy]=useState<'direct'|'approval'>('direct'),[editPhoto,setEditPhoto]=useState(''),[photoBusy,setPhotoBusy]=useState(false);
 const [friendPickerOpen,setFriendPickerOpen]=useState(false),[friendQuery,setFriendQuery]=useState(''),[friendChoices,setFriendChoices]=useState<Person[]>([]),[pickedFriends,setPickedFriends]=useState<string[]>([]),[loadingFriends,setLoadingFriends]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 const load=async()=>{const j=await groupApi('');setGroups(j.groups||[]);};
 const showError=(e:unknown)=>setError(e instanceof Error?e.message:'Falha na operação.');
 useEffect(()=>{void load().catch(showError);const refresh=()=>void load().catch(showError);window.addEventListener('submundo-social-updated',refresh);if(new URLSearchParams(window.location.search).has('group_invite')){setLinkedInvite(true);setMode('join');}return()=>window.removeEventListener('submundo-social-updated',refresh);},[]);
 useEffect(()=>{if(mode!=='create'&&!friendPickerOpen)return;let active=true;const timer=window.setTimeout(()=>{setLoadingFriends(true);groupApi('/friends?q='+encodeURIComponent(friendQuery.trim())).then(j=>{if(active)setFriendChoices(j.friends||[]);}).catch(showError).finally(()=>{if(active)setLoadingFriends(false);});},240);return()=>{active=false;window.clearTimeout(timer);};},[mode,friendPickerOpen,friendQuery]);
 const open=async(id:string)=>{setBusy(true);setError('');try{const j=await groupApi('/detail?id='+encodeURIComponent(id));setSelected(j.group);setMode('list');setInviteLink('');setQrOpen(false);}catch(e){showError(e);}finally{setBusy(false);}};
 async function create(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setStatus('');
  try{const j=await groupApi('/create',{name:name.trim(),description:description.trim(),color,photo});setName('');setPhoto('');setDescription('');await load();await open(j.group.id);if(pickedFriends.length){try{const invites=await groupApi('/invite-friends',{id:j.group.id,friendIds:pickedFriends});setStatus(invites.invited.length+' convite(s) enviado(s) aos amigos.');}catch(e){setError('Grupo criado, mas não foi possível enviar os convites: '+(e instanceof Error?e.message:'Erro desconhecido'));}}setPickedFriends([]);setFriendQuery('');}
  catch(e){showError(e);}finally{setBusy(false);}
 }
 // The invitation is resolved on arrival; joining takes only one explicit tap.
 useEffect(()=>{
  if(mode!=='join')return;
  const token=inviteToken(joinLink);
  setPreview(null);setParticipantNames([]);setParticipantsOpen(false);
  if(!/^[a-f0-9]{64}$/.test(token)){setPreviewLoading(false);return;}
  let active=true;
  const timer=window.setTimeout(()=>{
   setPreviewLoading(true);setError('');
   groupApi('/preview?token='+encodeURIComponent(token))
    .then(j=>{if(active)setPreview(j.group);})
    .catch(e=>{if(active)showError(e);})
    .finally(()=>{if(active)setPreviewLoading(false);});
  },linkedInvite?0:220);
  return()=>{active=false;window.clearTimeout(timer);};
 },[mode,joinLink,linkedInvite]);
 async function toggleParticipants(){
  if(!preview)return;
  if(participantsOpen){setParticipantsOpen(false);return;}
  setParticipantsOpen(true);
  if(participantNames.length)return;
  setParticipantsLoading(true);setError('');
  try{const j=await groupApi('/preview?token='+encodeURIComponent(inviteToken(joinLink))+'&members=1');setParticipantNames(j.members||[]);}
  catch(e){setParticipantsOpen(false);showError(e);}finally{setParticipantsLoading(false);}
 }
 async function join(){
  setBusy(true);setError('');
  try{
   const j=await groupApi('/join',{token:inviteToken(joinLink)});
   setJoinLink('');setPreview(null);window.history.replaceState({},'',window.location.pathname);await load();await open(j.id);
  }catch(e){showError(e);}finally{setBusy(false);}
 }
 function toggleFriend(id:string){setPickedFriends(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);}
 async function sendFriendInvites(){if(!selected||!pickedFriends.length)return;setBusy(true);setError('');try{const data=await groupApi('/invite-friends',{id:selected.id,friendIds:pickedFriends});setStatus(data.invited.length+' convite(s) enviado(s).'+(data.skipped.length?' '+data.skipped.length+' pessoa(s) já convidada(s) ou integrante(s).':''));setPickedFriends([]);setFriendQuery('');setFriendPickerOpen(false);}catch(e){showError(e);}finally{setBusy(false);}}
 async function addGroupFriend(id:string){if(!selected)return;setBusy(true);setError('');try{const r=await fetch('/api/friends/request',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:id})});const j=await r.json();if(!r.ok)throw Error(j.error||'Não foi possível solicitar amizade.');setStatus(j.status==='friends'?'Vocês já são amigos.':'Solicitação de amizade enviada.');const detail=await groupApi('/detail?id='+encodeURIComponent(selected.id));setSelected(detail.group);}catch(e){showError(e);}finally{setBusy(false);}}
 async function invite(){
  if(!selected)return;
  setBusy(true);setError('');
  try{const j=await groupApi('/invite',{id:selected.id});setInviteLink(window.location.origin+'/groups?group_invite='+j.token);setQrOpen(false);}
  catch(e){showError(e);}finally{setBusy(false);}
 }
 async function copy(){
  try{await navigator.clipboard.writeText(inviteLink);setCopied(true);setStatus('Link de convite copiado.');window.setTimeout(()=>setCopied(false),2200);}
  catch{setStatus('Selecione e copie o link exibido abaixo.');}
 }
 async function share(){
  if(!inviteLink)return;
  if(navigator.share){try{await navigator.share({title:'Entre no meu grupo Submundo808',url:inviteLink});}catch{}}
  else await copy();
 }
 function openDialog(kind:'leave'|'delete'){setError('');setConfirmation('');setSuccessorId('');setDialog(kind);}
 async function confirmDialog(){
  if(!selected||!dialog)return;
  const last=selected.memberCount===1;
  if(dialog==='leave'&&selected.role==='owner'&&!last&&!successorId){setError('Selecione o próximo administrador.');return;}
  if((dialog==='delete'||last)&&confirmation!=='EXCLUIR'){setError('Digite EXCLUIR para confirmar.');return;}
  setBusy(true);setError('');
  try{
   const result=await groupApi(dialog==='delete'?'/delete':'/leave',{id:selected.id,successorId,confirmation});
   setDialog(null);setSelected(null);setInviteLink('');await load();setStatus(result.deleted?'Grupo excluído.':'Você saiu do grupo.');
  }catch(e){showError(e);}finally{setBusy(false);}
 }
 async function remove(id:string,name:string){
  if(!selected||!window.confirm('Remover '+name+' do grupo?'))return;
  setBusy(true);setError('');
  try{await groupApi('/remove',{id:selected.id,userId:id});setMemberActionsId(null);await open(selected.id);}
  catch(e){showError(e);}finally{setBusy(false);}
 }
 function startEdit(){if(!selected)return;setEditPhoto(selected.photo||'');setEditName(selected.name);setEditDescription(selected.description);setEditColor(selected.color);setEditIcon(selected.icon||'users');setEditPolicy(selected.editPolicy||'admin');setJoinPolicy(selected.joinPolicy||'direct');setError('');setEditOpen(true);}
 async function changePhoto(file:File|undefined,update:(value:string)=>void){
  if(!file)return;setPhotoBusy(true);setError('');
  try{update(await optimizeAvatar(file,{size:320,maxChars:145000}));}catch(e){showError(e);}finally{setPhotoBusy(false);}
 }
 async function changeRole(id:string,personName:string,role:'admin'|'member'){
  if(!selected||!window.confirm((role==='admin'?'Promover ':'Rebaixar ')+personName+(role==='admin'?' a administrador?':' a integrante?')))return;
  setBusy(true);setError('');
  try{await groupApi('/role',{id:selected.id,userId:id,role});const fresh=await groupApi('/detail?id='+encodeURIComponent(selected.id));setSelected(fresh.group);setMemberActionsId(null);setStatus(role==='admin'?personName+' agora é administrador.':personName+' agora é integrante.');}
  catch(e){showError(e);}finally{setBusy(false);}
 }
 async function saveEdit(e:React.FormEvent){e.preventDefault();if(!selected)return;setBusy(true);setError('');try{await groupApi('/edit',{id:selected.id,name:editName.trim(),description:editDescription.trim(),color:editColor,icon:editIcon,photo:editPhoto,editPolicy,joinPolicy});await open(selected.id);await load();setEditOpen(false);setStatus('Grupo atualizado.');}catch(e){showError(e);}finally{setBusy(false);}}
 const quickAlerts=[['palco','🎵','Bora pro palco!'],['bar','🥤','Bora pro bar!'],['encontro','📍','Me encontrem aqui!'],['agua','💧','Vou pegar água'],['banheiro','🚻','Estou no banheiro'],['onde','👥','Onde vocês estão?'],['entrada','🚶','Estou indo pra entrada'],['bem','💚','Está tudo bem comigo'],['embora','👋','Estou indo embora'],['mal','🚨','Estou passando mal, preciso de ajuda!'],['roubo','⚠️','Fui roubado, preciso de ajuda!']] as const;
 const loadAlerts=async(id:string)=>{const j=await groupApi('/alerts?id='+encodeURIComponent(id));setAlerts(j.alerts||[]);};
 async function sendAlert(){if(!selected||!alertChoice)return;setBusy(true);setError('');try{await groupApi('/alert',{id:selected.id,code:alertChoice});setAlertChoice('');setAlertTab('history');await loadAlerts(selected.id);setStatus('Aviso enviado aos integrantes do grupo.');}catch(e){showError(e);}finally{setBusy(false);}}
 const friendSelect=(excludeMembers:boolean)=><div className="space-y-3"><label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[.035] px-3"><Search size={18} className="text-white/50"/><input type="search" value={friendQuery} onChange={e=>setFriendQuery(e.target.value)} placeholder="Buscar meus amigos pelo nome" className="min-w-0 w-full bg-transparent py-3 text-base text-white outline-none"/></label><p className="text-xs text-white/55">Escolha amigos para convidar. Cada pessoa aceita ou recusa o convite nas notificações.</p>{loadingFriends&&<p className="text-xs text-white/60">Buscando amigos...</p>}<div className="max-h-48 space-y-2 overflow-y-auto">{friendChoices.filter(p=>!excludeMembers||!selected?.members.some(m=>m.id===p.id)).map(p=><label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3"><input type="checkbox" checked={pickedFriends.includes(p.id)} onChange={()=>toggleFriend(p.id)} className="accent-[#c4ff40]"/><SocialAvatar name={p.name} avatar={p.avatar} size="sm"/><span className="text-sm font-medium">{p.name}</span></label>)}{!loadingFriends&&!friendChoices.filter(p=>!excludeMembers||!selected?.members.some(m=>m.id===p.id)).length&&<p className="py-3 text-center text-xs text-white/55">Nenhum amigo encontrado. Adicione amigos pelo perfil dos integrantes ou pela área Meus amigos.</p>}</div><p className="text-xs text-[#c4ff40]">{pickedFriends.length} selecionado(s)</p></div>;
 const button='w-full rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-black text-black disabled:opacity-40';
 const memberActions=selected?.members.find(p=>p.id===memberActionsId)||null;
 if(selected)return <div className="space-y-5">
  <div className="flex items-center justify-between"><button onClick={()=>{setSelected(null);setInviteLink('');void load();}} className="inline-flex items-center gap-2 p-2 text-sm text-white/70"><ArrowLeft size={18}/> Meus grupos</button>{(selected.role==='owner'||selected.role==='admin'||selected.editPolicy==='everyone')&&<button onClick={startEdit} className="inline-flex items-center gap-2 rounded-xl border border-[#c4ff40]/40 px-3 py-2 text-sm font-bold text-[#c4ff40]"><Pencil size={16}/> Editar grupo</button>}</div>
  <div className="space-y-3 text-center">
   <div className="flex justify-center"><GroupAvatar name={selected.name} color={selected.color} icon={selected.icon} photo={selected.photo} size="lg"/></div>
   <h3 className="text-xl font-black">{selected.name}</h3>
   <p className="text-sm text-white/55">{selected.description||'Seu grupo de amigos'} · {selected.memberCount} {selected.memberCount===1?'integrante':'integrantes'}</p>
   <div className="flex justify-center -space-x-2">{selected.avatars.map(p=><SocialAvatar key={p.id} name={p.name} avatar={p.avatar} size="sm" className="ring-2 ring-[#0e0b14]"/>)}</div>
  </div>
  {editOpen&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-3" role="dialog" aria-modal="true" aria-label="Editar grupo"><form onSubmit={e=>void saveEdit(e)} className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#211729]"><div className="flex shrink-0 items-center justify-between border-b border-white/10 p-4"><h3 className="text-lg font-black">Editar grupo</h3><button type="button" aria-label="Fechar" onClick={()=>{setEditOpen(false);setError('');}}><X/></button></div><div className="min-h-0 space-y-4 overflow-y-auto p-4">
   <label className="block text-sm font-semibold">Nome do grupo<input required minLength={2} maxLength={60} value={editName} onChange={e=>setEditName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/20 bg-[#302238] p-3 text-base text-white"/></label>
   <label className="block text-sm font-semibold">Descrição<textarea maxLength={250} rows={2} value={editDescription} onChange={e=>setEditDescription(e.target.value)} className="mt-2 w-full rounded-xl border border-white/20 bg-[#302238] p-3 text-base text-white"/></label>
   <fieldset><legend className="mb-2 text-sm font-semibold">Cor do grupo</legend><div className="flex flex-wrap gap-3">{colors.map(c=><label key={c}><input type="radio" name="edit-color" className="sr-only" checked={editColor===c} onChange={()=>setEditColor(c)}/><span className={'flex h-10 w-10 items-center justify-center rounded-full '+(editColor===c?'ring-2 ring-white ring-offset-2 ring-offset-[#211729]':'')} style={{backgroundColor:c}}>{editColor===c&&<Check size={20}/>}</span></label>)}</div></fieldset>
   <div className="space-y-2"><p className="text-sm font-semibold">Foto do grupo</p><div className="flex items-center gap-3"><GroupAvatar name={editName||selected.name} color={editColor} icon={editIcon} photo={editPhoto} size="lg"/><div className="space-y-2"><label className="inline-flex cursor-pointer items-center rounded-lg border border-white/20 px-3 py-2 text-xs font-bold">Escolher foto<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e=>{void changePhoto(e.target.files?.[0],setEditPhoto);e.target.value='';}}/></label>{editPhoto&&<button type="button" onClick={()=>setEditPhoto('')} className="block text-xs text-red-300">Remover foto</button>}</div></div><p className="text-xs text-white/50">Corte central quadrado, WebP otimizado (até 120 KB).</p></div>
   <fieldset><legend className="mb-2 text-sm font-semibold">Ícone do grupo</legend><div className="grid grid-cols-6 gap-2">{([['users','👥'],['music','🎵'],['fire','🔥'],['party','🎉'],['star','⭐'],['heart','💚']] as const).map(([id,emoji])=><button key={id} type="button" aria-pressed={editIcon===id} aria-label={'Ícone '+id} onClick={()=>{setEditIcon(id);setEditPhoto('');}} className={'rounded-xl border p-2 text-xl '+(editIcon===id?'border-[#c4ff40] bg-[#c4ff40]/15':'border-white/15')}>{emoji}</button>)}</div></fieldset>
   {selected.role==='owner'&&<fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Quem pode editar o grupo?</legend><label className="flex gap-2 text-sm"><input type="radio" checked={editPolicy==='admin'} onChange={()=>setEditPolicy('admin')}/> Apenas administradores</label><label className="flex gap-2 text-sm"><input type="radio" checked={editPolicy==='everyone'} onChange={()=>setEditPolicy('everyone')}/> Todos os integrantes</label><p className="text-xs text-white/50">Mesmo permitindo a edição por todos, só administradores gerenciam integrantes. Apenas o proprietário promove administradores, altera permissões ou exclui o grupo.</p></fieldset>}
   {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
   </div><div className="shrink-0 border-t border-white/15 p-4"><button type="submit" disabled={busy||photoBusy||editName.trim().length<2} className={button}>{busy?'Salvando...':'Salvar alterações'}</button></div></form></div>}
  <div className="grid grid-cols-2 gap-2"><button onClick={()=>void invite()} disabled={busy} className="rounded-xl bg-[#c4ff40] px-3 py-3 text-sm font-black text-black"><UserPlus size={18} className="mr-1 inline"/> Convidar</button><button onClick={()=>{setAlertOpen(true);setAlertTab('send');setAlertChoice('');void loadAlerts(selected.id).catch(showError);}} className="flex items-center justify-center gap-2 rounded-xl border border-[#c4ff40] px-3 py-3 text-sm font-bold text-[#c4ff40]"><Megaphone size={18}/> Avisar a galera</button></div>
  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
   <div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-bold">Convide sua galera</h4><p className="mt-1 text-xs text-white/50">Use o botão acima para gerar o link ou QR Code do grupo.</p></div></div>
   {inviteLink&&<div className="space-y-3 border-t border-white/10 pt-3">
    <div className="flex items-center gap-2"><input aria-label="Link do grupo" readOnly value={inviteLink} onFocus={e=>e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#100b16] px-3 py-2.5 text-xs text-white"/><button aria-label={copied?'Link copiado':'Copiar link'} title={copied?'Copiado!':'Copiar link'} onClick={()=>void copy()} className={'flex min-w-[44px] items-center justify-center gap-1 rounded-lg border p-2.5 transition-all duration-200 '+(copied?'border-[#c4ff40] bg-[#c4ff40]/15 text-[#c4ff40] scale-105':'border-white/20')} >{copied?<><Check size={18}/><span className="text-xs font-bold">Copiado!</span></>:<Copy size={18}/>}</button><button aria-label="Compartilhar convite" title="Compartilhar" onClick={()=>void share()} className="rounded-lg border border-white/20 p-2.5"><Share2 size={18}/></button><button aria-label="Mostrar QR Code" aria-expanded={qrOpen} title="QR Code" onClick={()=>setQrOpen(v=>!v)} className={'rounded-lg border p-2.5 '+(qrOpen?'border-[#c4ff40] text-[#c4ff40]':'border-white/20')}><QrCode size={18}/></button></div>
    {qrOpen&&<div className="mx-auto w-fit rounded-xl bg-white p-3"><img width={220} height={220} alt="QR Code para entrar no grupo" src={'https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data='+encodeURIComponent(inviteLink)}/></div>}
    <p className="text-[11px] text-white/45">Entrar no grupo não ativa o compartilhamento de localização.</p>
   </div>}
  </div>
  <button onClick={()=>{setAlertOpen(true);setAlertTab('history');void loadAlerts(selected.id).catch(showError);}} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm"><span className="flex items-center gap-2"><Bell size={17} className="text-[#c4ff40]"/> Histórico de avisos</span><span className="text-white/45">Ver avisos ›</span></button>
  {alertOpen&&<div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/85 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label="Avisos do grupo">
   <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#201728] shadow-2xl">
    <div className="shrink-0 space-y-3 border-b border-white/10 p-4">
     <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-black"><Megaphone className="text-[#c4ff40]"/> Avisar a galera</h3><button aria-label="Fechar" onClick={()=>{setAlertOpen(false);setError('');}}><X/></button></div>
     <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1">{(['send','history'] as const).map(t=><button key={t} onClick={()=>{setAlertTab(t);setAlertChoice('');}} className={'rounded-lg py-2 text-sm font-bold '+(alertTab===t?'bg-[#c4ff40] text-black':'text-white/70')}>{t==='send'?'Enviar aviso':'Avisos anteriores'}</button>)}</div>
    </div>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
     {alertTab==='send'?<><p className="text-xs text-white/60">Escolha uma mensagem pronta. Ela será enviada para os integrantes deste grupo.</p><div className="grid grid-cols-2 gap-2">{quickAlerts.map(([code,emoji,label])=><button key={code} onClick={()=>setAlertChoice(code)} className={'flex min-h-[90px] flex-col items-start gap-2 rounded-xl border p-3 text-left text-xs font-semibold '+(alertChoice===code?'border-[#c4ff40] bg-[#c4ff40]/10':'border-white/15 bg-white/[.025]')}><span className="text-xl">{emoji}</span><span>{label}</span></button>)}</div></>:<div className="space-y-2">{alerts.length===0?<p className="py-6 text-center text-sm text-white/50">Nenhum aviso enviado ainda.</p>:alerts.map(a=>{const raw=a.createdAt??(a as typeof a&{createdat?:number;created_at?:number}).createdat??(a as typeof a&{created_at?:number}).created_at;const ms=Number(raw);const formatted=Number.isFinite(ms)&&ms>0?new Date(ms<1e11?ms*1000:ms).toLocaleString('pt-BR'):'Data indisponível';return <div key={a.id} className="rounded-xl border border-white/10 bg-white/[.04] p-3"><p className="text-xs text-white/50">{a.senderName||'Integrante'} · {formatted}</p><p className="mt-1 text-sm font-semibold">{a.message}</p></div>;})}</div>}
    </div>
    {alertTab==='send'&&<div className="shrink-0 space-y-2 border-t border-white/15 bg-[#201728] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_#0005]">
     {alertChoice?<p className="truncate text-xs text-[#c4ff40]">Selecionado: {quickAlerts.find(a=>a[0]===alertChoice)?.[2]}</p>:<p className="text-xs text-white/55">Selecione uma mensagem para habilitar o envio.</p>}
     {['mal','roubo'].includes(alertChoice)&&<p className="flex items-start gap-2 text-xs text-amber-200"><AlertTriangle size={16} className="shrink-0"/> Este aviso não chama segurança nem serviços de emergência.</p>}
     <button type="button" disabled={busy||!alertChoice} onClick={()=>void sendAlert()} className={button}>{busy?'Enviando...':'Enviar aviso'}</button>
    </div>}
    {error&&<p role="alert" className="shrink-0 px-4 pb-3 text-xs text-red-300">{error}</p>}
   </div>
  </div>}
  <div><div className="mb-3 flex items-center justify-between gap-2"><h4 className="text-sm font-black uppercase">Membros</h4>{(selected.role==='owner'||selected.role==='admin')&&<button type="button" onClick={()=>{setFriendPickerOpen(true);setPickedFriends([]);setFriendQuery('');setError('');}} className="inline-flex items-center gap-2 rounded-lg border border-[#c4ff40]/40 px-3 py-2 text-xs font-bold text-[#c4ff40]"><UserPlus size={15}/> Adicionar amigos</button>}</div>
   <div className="space-y-2">{selected.members.map(p=><div key={p.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] p-2">
    <button type="button" onClick={()=>{setMemberActionsId(p.id);setError('');}} aria-label={'Ver detalhes de '+p.name} aria-haspopup="dialog" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4ff40]">
     <SocialAvatar name={p.name} avatar={p.avatar}/>
     <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{p.name}</span><span className="block text-xs text-white/45">{p.role==='owner'?'Proprietário':p.role==='admin'?'Administrador':'Integrante'}</span></span>
    </button>
    {p.relation==='friends'?<span title="Já é seu amigo" aria-label="Amigo" className="inline-flex shrink-0 items-center gap-1 px-2 text-xs font-bold text-[#c4ff40]"><UserCheck size={16}/><span className="hidden sm:inline">Amigo</span></span>:p.relation==='sent'?<span title="Solicitação de amizade enviada" aria-label="Solicitação enviada" className="shrink-0 px-2 text-amber-200"><Clock3 size={18}/></span>:p.relation==='received'?<span title="Solicitação recebida. Responda nas notificações." aria-label="Solicitação recebida" className="shrink-0 px-2 text-white/60"><Bell size={18}/></span>:p.relation==='none'?<button type="button" disabled={busy} onClick={()=>void addGroupFriend(p.id)} title={'Adicionar '+p.name+' como amigo'} aria-label={'Adicionar '+p.name+' como amigo'} className="shrink-0 rounded-lg border border-[#c4ff40]/40 p-2 text-[#c4ff40] disabled:opacity-40"><UserPlus size={17}/></button>:null}
   </div>)}</div>
  </div>
  {memberActions&&<div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label={'Detalhes de '+memberActions.name} onClick={e=>{if(e.target===e.currentTarget){setMemberActionsId(null);setError('');}}}>
   <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/20 bg-[#211729] p-5 shadow-2xl">
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><SocialAvatar name={memberActions.name} avatar={memberActions.avatar}/><div className="min-w-0"><h3 className="truncate font-black">{memberActions.name}</h3><p className="text-xs text-white/55">{memberActions.role==='owner'?'Proprietário':memberActions.role==='admin'?'Administrador':'Integrante'}</p></div></div><button type="button" aria-label="Fechar detalhes" onClick={()=>{setMemberActionsId(null);setError('');}} className="rounded-lg p-2 text-white/70"><X size={20}/></button></div>
    <div className="space-y-2 border-t border-white/10 pt-3">
     {memberActions.relation==='friends'&&<p className="flex items-center gap-2 text-sm text-[#c4ff40]"><UserCheck size={17}/> Vocês já são amigos.</p>}
     {memberActions.relation==='sent'&&<p className="flex items-center gap-2 text-sm text-amber-200"><Clock3 size={17}/> Solicitação de amizade enviada.</p>}
     {memberActions.relation==='received'&&<p className="text-sm text-white/65">Solicitação de amizade recebida. Responda nas notificações.</p>}
     {memberActions.relation==='none'&&<button type="button" disabled={busy} onClick={()=>void addGroupFriend(memberActions.id)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#c4ff40]/40 px-4 py-3 text-sm font-semibold text-[#c4ff40] disabled:opacity-40"><UserPlus size={17}/> Adicionar amigo</button>}
     {selected.role==='owner'&&memberActions.role==='member'&&<button type="button" disabled={busy} onClick={()=>void changeRole(memberActions.id,memberActions.name,'admin')} className="w-full rounded-xl border border-white/20 px-4 py-3 text-left text-sm font-semibold disabled:opacity-40">Tornar administrador</button>}
     {selected.role==='owner'&&memberActions.role==='admin'&&<button type="button" disabled={busy} onClick={()=>void changeRole(memberActions.id,memberActions.name,'member')} className="w-full rounded-xl border border-white/20 px-4 py-3 text-left text-sm font-semibold disabled:opacity-40">Remover função de administrador</button>}
     {(selected.role==='owner'||(selected.role==='admin'&&memberActions.role==='member'))&&memberActions.role!=='owner'&&<button type="button" disabled={busy} onClick={()=>void remove(memberActions.id,memberActions.name)} className="w-full rounded-xl border border-red-400/30 px-4 py-3 text-left text-sm font-semibold text-red-300 disabled:opacity-40">Remover do grupo</button>}
     {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
     {memberActions.relation==='self'&&selected.role!=='owner'&&<p className="text-xs text-white/45">Para gerenciar sua participação, use a opção Sair do grupo.</p>}
    </div>
   </div>
  </div>}
  {friendPickerOpen&&<div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/85 p-3" role="dialog" aria-modal="true" aria-label="Convidar amigos para o grupo"><div className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-2xl border border-white/20 bg-[#211729]"><div className="flex items-center justify-between border-b border-white/10 p-4"><h3 className="font-black">Adicionar amigos ao grupo</h3><button type="button" aria-label="Fechar" onClick={()=>setFriendPickerOpen(false)}><X/></button></div><div className="min-h-0 flex-1 overflow-y-auto p-4">{friendSelect(true)}</div><div className="border-t border-white/10 p-4"><button type="button" disabled={busy||!pickedFriends.length} onClick={()=>void sendFriendInvites()} className={button}>{busy?'Enviando...':'Enviar '+pickedFriends.length+' convite(s)'}</button></div></div></div>}
  <div className="space-y-3 border-t border-white/10 pt-5">
   <h4 className="text-xs font-black uppercase tracking-widest text-white/45">Gerenciar participação</h4>
   <button disabled={busy} onClick={()=>openDialog('leave')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold"><LogOut size={17}/> Sair do grupo</button>
   {selected.role==='owner'&&<button disabled={busy} onClick={()=>openDialog('delete')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/40 px-4 py-3 text-sm font-semibold text-red-300"><Trash2 size={17}/> Excluir grupo</button>}
  </div>
  {dialog&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label={dialog==='delete'?'Excluir grupo':'Sair do grupo'}>
   <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/20 bg-[#211729] p-5 shadow-2xl">
    <h3 className="text-lg font-black">{dialog==='delete'?'Excluir grupo?':'Sair de '+selected.name+'?'}</h3>
    <p className="text-sm text-white/65">{dialog==='delete'?'Todos os integrantes perderão acesso ao grupo. Esta ação não pode ser desfeita.':selected.memberCount===1?'Você é o último integrante. Ao sair, o grupo será excluído.':'Sua participação será encerrada.'}</p>
    {dialog==='leave'&&selected.role==='owner'&&selected.memberCount>1&&<label className="block text-sm font-semibold">Escolha o próximo administrador<select value={successorId} onChange={e=>setSuccessorId(e.target.value)} className="mt-2 w-full rounded-xl border border-white/20 bg-[#302238] p-3 text-white"><option value="">Selecione um integrante</option>{selected.members.filter(p=>p.role!=='owner').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    {(dialog==='delete'||selected.memberCount===1)&&<label className="block text-sm font-semibold">Digite <strong>EXCLUIR</strong> para confirmar<input autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="EXCLUIR" className="mt-2 w-full rounded-xl border border-white/20 bg-[#302238] p-3 text-base text-white"/></label>}
    {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
    <div className="flex gap-3"><button disabled={busy} onClick={()=>{setDialog(null);setError('');}} className="flex-1 rounded-xl border border-white/20 p-3 text-sm font-semibold">Cancelar</button><button disabled={busy||(dialog==='leave'&&selected.role==='owner'&&selected.memberCount>1&&!successorId)||((dialog==='delete'||selected.memberCount===1)&&confirmation!=='EXCLUIR')} onClick={()=>void confirmDialog()} className="flex-1 rounded-xl bg-red-500 p-3 text-sm font-black text-white disabled:opacity-40">{busy?'Aguarde...':dialog==='delete'||selected.memberCount===1?'Excluir':'Confirmar saída'}</button></div>
   </div>
  </div>}
  <p className="text-xs text-white/45">Os grupos são permanentes. A localização depende da autorização de cada integrante e da habilitação do evento.</p>
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}{status&&<p role="status" className="text-xs text-[#c4ff40]">{status}</p>}
 </div>;
 return <div className="space-y-4">
  {mode==='list'?<><div className="grid grid-cols-2 gap-3">
    <button className={button} onClick={()=>{setMode('create');setError('');}}><Plus className="mr-1 inline" size={16}/> Criar grupo</button>
    <button className="rounded-xl border border-white/20 px-3 py-3 text-sm font-bold" onClick={()=>{setLinkedInvite(false);setJoinLink('');setMode('join');setError('');}}><Link2 className="mr-1 inline" size={16}/> Entrar em grupo</button>
   </div><h3 className="pt-3 text-sm font-black uppercase">Meus grupos ({groups.length})</h3>
   {!groups.length?<div className="rounded-2xl border border-white/10 p-8 text-center"><Users size={32} className="mx-auto mb-3 text-[#c4ff40]"/><p className="font-semibold">Nenhum grupo ainda</p><p className="mt-2 text-sm text-white/55">Crie um grupo para organizar sua galera nas próximas festas.</p></div>:
   groups.map(g=><button key={g.id} onClick={()=>void open(g.id)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4 text-left">
    <GroupAvatar name={g.name} color={g.color} icon={g.icon} photo={g.photo} size="sm"/>
    <span className="min-w-0 flex-1"><span className="block truncate font-bold">{g.name}</span><span className="text-xs text-white/55">{g.memberCount} integrantes</span><span className="mt-1 flex -space-x-1">{g.avatars.map(p=><SocialAvatar key={p.id} name={p.name} avatar={p.avatar} size="sm" className="ring-2 ring-[#0e0b14]"/>)}</span></span><span aria-hidden="true">›</span>
   </button>)}</>:
   <div className="space-y-4"><button onClick={()=>{setMode('list');setError('');setPreview(null);}} className="inline-flex items-center gap-2 text-sm text-white/60"><ArrowLeft size={17}/> Grupos</button>
    {mode==='create'?<form onSubmit={e=>void create(e)} className="space-y-4 rounded-2xl border border-white/10 bg-white/[.04] p-5">
     <h3 className="text-lg font-bold">Criar grupo</h3><label className="block text-xs text-white/65">Nome do grupo<input required minLength={2} maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Galera do Rolê" className="mt-2 w-full rounded-xl border border-white/20 bg-[#241b2c] p-3 text-base text-white"/></label>
     <label className="block text-xs text-white/65">Descrição (opcional)<textarea maxLength={250} value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-white/20 bg-[#241b2c] p-3 text-base text-white"/></label>
     <fieldset><legend className="mb-2 text-xs font-bold text-white/65">Cor do grupo</legend><div className="flex flex-wrap gap-3">{colors.map(c=><label key={c} className="cursor-pointer"><input className="sr-only" type="radio" name="group-color" checked={color===c} onChange={()=>setColor(c)}/><span style={{backgroundColor:c}} className={'block h-10 w-10 rounded-full '+(color===c?'ring-2 ring-white ring-offset-2 ring-offset-[#17101e]':'')}/></label>)}</div></fieldset>
     <div className="space-y-2"><p className="text-xs font-bold text-white/65">Foto do grupo (opcional)</p><div className="flex items-center gap-3"><GroupAvatar name={name||'Novo grupo'} color={color} photo={photo}/><div><label className="inline-flex cursor-pointer items-center rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold">Selecionar foto<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e=>{void changePhoto(e.target.files?.[0],setPhoto);e.target.value='';}}/></label>{photo&&<button type="button" className="mt-2 block text-xs text-red-300" onClick={()=>setPhoto('')}>Remover foto</button>}</div></div><p className="text-xs text-white/50">Imagem convertida automaticamente para WebP compacto.</p></div>
     <div className="space-y-2 border-t border-white/10 pt-4"><h4 className="text-sm font-bold">Convidar meus amigos (opcional)</h4>{friendSelect(false)}</div>
      <button type="submit" disabled={busy||photoBusy||name.trim().length<2} className={button}>Criar grupo{pickedFriends.length?' e convidar '+pickedFriends.length+' amigo(s)':''}</button>
    </form>:
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[.04] p-5">
     <h3 className="text-lg font-bold">Entrar em grupo</h3>
     {!linkedInvite&&<div className="space-y-3">
      {!preview&&<GroupQrScanner onDetected={token=>{setError('');setJoinLink(token);setPreview(null);setParticipantsOpen(false);}} onError={setError}/>}
      <div className="flex items-center gap-3 text-xs text-white/40"><span className="h-px flex-1 bg-white/15"/><span>OU COLE O LINK</span><span className="h-px flex-1 bg-white/15"/></div>
      <p className="text-xs text-white/55">Use o QR Code ou cole um link ou código de convite recebido.</p>
      <input aria-label="Convite de grupo" value={joinLink} onChange={e=>{setJoinLink(e.target.value);setPreview(null);setParticipantsOpen(false);}} placeholder="Link do grupo" className="w-full rounded-xl border border-white/20 bg-[#241b2c] p-3 text-base text-white"/>
     </div>}
     {previewLoading&&<p role="status" className="text-sm text-white/65">Carregando convite...</p>}
     {preview&&<div className="space-y-3 rounded-xl border border-white/15 p-4">
      <div className="flex items-center gap-3"><GroupAvatar name={preview.name} color={preview.color} icon={preview.icon} photo={preview.photo} size="sm"/><div className="min-w-0"><p className="font-bold">{preview.name}</p><p className="text-xs text-white/55">{preview.memberCount} {preview.memberCount===1?'integrante':'integrantes'}</p></div></div>
      <button type="button" disabled={busy} onClick={()=>preview.joined?void open(preview.id):void join()} className={button}>{busy?'Aguarde...':preview.joined?'Abrir grupo':'Entrar no grupo'}</button>
      <button type="button" aria-expanded={participantsOpen} onClick={()=>void toggleParticipants()} className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-white/60 hover:text-[#c4ff40]"><Users size={15}/>{participantsOpen?'Ocultar participantes':'Ver participantes'} <span aria-hidden="true">{participantsOpen?'⌃':'⌄'}</span></button>
      {participantsOpen&&<div className="space-y-2 border-t border-white/10 pt-3">{participantsLoading?<p className="text-xs text-white/50">Carregando participantes...</p>:participantNames.map((p,i)=><div key={i} className="flex items-center gap-2 text-sm text-white/75"><SocialAvatar name={p.name} size="sm"/><span>{p.name}</span></div>)}</div>}
     </div>}
     {!preview&&!previewLoading&&!linkedInvite&&<button type="button" disabled={busy||!joinLink.trim()} onClick={()=>void join()} className={button}>{busy?'Entrando...':'Entrar no grupo'}</button>}
    </div>}
   </div>}
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}{status&&<p role="status" className="text-xs text-[#c4ff40]">{status}</p>}
 </div>;
}
