import {useEffect,useState} from 'react';
import {ArrowLeft,Copy,Link2,Plus,Users,UserPlus,LogOut,X,QrCode,Share2} from 'lucide-react';
import SocialAvatar from './social-avatar';

type Person={id:string;name:string;avatar?:string};
type Group={id:string;name:string;description:string;color:string;ownerId:string;memberCount:number;avatars:Person[]};
type GroupDetail=Group&{members:(Person&{role:string})[];role:string};
async function groupApi(route:string,data?:object){
 const r=await fetch('/api/groups'+route,{method:data?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
 const j=await r.json();if(!r.ok)throw Error(j.error||'Não foi possível concluir a operação.');return j;
}
const colors=['#8957e5','#14b87a','#f48a31','#ffc24b','#eb6076'];
export default function FriendGroups(){
 const [groups,setGroups]=useState<Group[]>([]),[selected,setSelected]=useState<GroupDetail|null>(null);
 const [mode,setMode]=useState<'list'|'create'|'join'>('list'),[name,setName]=useState(''),[description,setDescription]=useState(''),[color,setColor]=useState(colors[0]);
 const [inviteLink,setInviteLink]=useState(''),[joinLink,setJoinLink]=useState(new URLSearchParams(window.location.search).get('group_invite')||'');
 const [preview,setPreview]=useState<(Group&{joined:boolean})|null>(null),[qrOpen,setQrOpen]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 const load=async()=>{const j=await groupApi('');setGroups(j.groups||[]);};
 const showError=(e:unknown)=>setError(e instanceof Error?e.message:'Falha na operação.');
 useEffect(()=>{void load().catch(showError);if(new URLSearchParams(window.location.search).has('group_invite'))setMode('join');},[]);
 const open=async(id:string)=>{setBusy(true);setError('');try{const j=await groupApi('/detail?id='+encodeURIComponent(id));setSelected(j.group);setMode('list');setInviteLink('');setQrOpen(false);}catch(e){showError(e);}finally{setBusy(false);}};
 async function create(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setStatus('');
  try{const j=await groupApi('/create',{name:name.trim(),description:description.trim(),color});setName('');setDescription('');await load();await open(j.group.id);}
  catch(e){showError(e);}finally{setBusy(false);}
 }
 async function lookup(){
  setBusy(true);setError('');setPreview(null);
  try{
   let token=joinLink.trim();
   try{const u=new URL(token);token=u.searchParams.get('group_invite')||'';}catch{}
   const j=await groupApi('/preview?token='+encodeURIComponent(token));setPreview(j.group);
  }catch(e){showError(e);}finally{setBusy(false);}
 }
 async function join(){
  setBusy(true);setError('');
  try{
   const j=await groupApi('/join',{token:joinLink.trim()});
   setJoinLink('');setPreview(null);window.history.replaceState({},'',window.location.pathname);await load();await open(j.id);
  }catch(e){showError(e);}finally{setBusy(false);}
 }
 async function invite(){
  if(!selected)return;
  setBusy(true);setError('');
  try{const j=await groupApi('/invite',{id:selected.id});setInviteLink(window.location.origin+'/friends?group_invite='+j.token);setQrOpen(false);}
  catch(e){showError(e);}finally{setBusy(false);}
 }
 async function copy(){
  try{await navigator.clipboard.writeText(inviteLink);setStatus('Link de convite copiado.');}
  catch{setStatus('Selecione e copie o link exibido abaixo.');}
 }
 async function share(){
  if(!inviteLink)return;
  if(navigator.share){try{await navigator.share({title:'Entre no meu grupo Submundo808',url:inviteLink});}catch{}}
  else await copy();
 }
 async function leave(){
  if(!selected)return;
  if(!window.confirm('Sair de '+selected.name+'? Se você é o administrador, outro integrante assumirá o grupo.'))return;
  setBusy(true);setError('');
  try{await groupApi('/leave',{id:selected.id});setSelected(null);await load();setStatus('Você saiu do grupo.');}
  catch(e){showError(e);}finally{setBusy(false);}
 }
 async function remove(id:string,name:string){
  if(!selected||!window.confirm('Remover '+name+' do grupo?'))return;
  setBusy(true);setError('');
  try{await groupApi('/remove',{id:selected.id,userId:id});await open(selected.id);}
  catch(e){showError(e);}finally{setBusy(false);}
 }
 const button='w-full rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-black text-black disabled:opacity-40';
 if(selected)return <div className="space-y-5">
  <div className="flex items-center justify-between"><button onClick={()=>{setSelected(null);setInviteLink('');void load();}} className="inline-flex items-center gap-2 p-2 text-sm text-white/70"><ArrowLeft size={18}/> Meus grupos</button><button disabled={busy} onClick={()=>void leave()} className="inline-flex items-center gap-1 text-xs text-white/50"><LogOut size={15}/> Sair</button></div>
  <div className="space-y-3 text-center">
   <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl" style={{backgroundColor:selected.color}}><Users size={31} className="text-white"/></div>
   <h3 className="text-xl font-black">{selected.name}</h3>
   <p className="text-sm text-white/55">{selected.description||'Seu grupo de amigos'} · {selected.memberCount} {selected.memberCount===1?'integrante':'integrantes'}</p>
   <div className="flex justify-center -space-x-2">{selected.avatars.map(p=><SocialAvatar key={p.id} name={p.name} avatar={p.avatar} size="sm" className="ring-2 ring-[#0e0b14]"/>)}</div>
  </div>
  <button disabled={busy} onClick={()=>void invite()} className={button}><UserPlus className="mr-2 inline" size={18}/> Convidar pessoas</button>
  {inviteLink&&<div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
   <p className="text-xs text-white/65">Qualquer pessoa com este convite pode solicitar entrada no grupo. Ao entrar, ela não começa a compartilhar localização automaticamente.</p>
   <label className="block text-xs font-bold text-white/65">Link do grupo<input aria-label="Link do grupo" readOnly value={inviteLink} onFocus={e=>e.currentTarget.select()} className="mt-2 w-full rounded-xl border border-white/20 bg-[#100b16] p-3 text-xs text-white"/></label>
   <div className="grid grid-cols-3 gap-2"><button onClick={()=>void copy()} className="rounded-xl border border-white/20 p-3 text-xs"><Copy size={16} className="mx-auto mb-1"/>Copiar</button><button onClick={()=>void share()} className="rounded-xl border border-white/20 p-3 text-xs"><Share2 size={16} className="mx-auto mb-1"/>Enviar</button><button onClick={()=>setQrOpen(v=>!v)} className="rounded-xl border border-white/20 p-3 text-xs"><QrCode size={16} className="mx-auto mb-1"/>QR Code</button></div>
   {qrOpen&&<div className="mx-auto w-fit rounded-xl bg-white p-3"><img width={220} height={220} alt="QR Code de convite para o grupo" src={'https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data='+encodeURIComponent(inviteLink)}/></div>}
  </div>}
  <div><h4 className="mb-3 text-sm font-black uppercase">Membros</h4><div className="space-y-2">{selected.members.map(p=><div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] p-3">
   <SocialAvatar name={p.name} avatar={p.avatar}/>
   <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-xs text-white/45">{p.role==='owner'?'Administrador':'Integrante'}</p></div>
   {selected.role==='owner'&&p.role!=='owner'&&<button aria-label={'Remover '+p.name} disabled={busy} onClick={()=>void remove(p.id,p.name)} className="p-2 text-white/50"><X size={16}/></button>}
  </div>)}</div></div>
  <p className="text-xs text-white/45">Os grupos são permanentes. A localização depende da autorização de cada integrante e da habilitação do evento.</p>
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}{status&&<p role="status" className="text-xs text-[#c4ff40]">{status}</p>}
 </div>;
 return <div className="space-y-4">
  {mode==='list'?<><div className="grid grid-cols-2 gap-3">
    <button className={button} onClick={()=>{setMode('create');setError('');}}><Plus className="mr-1 inline" size={16}/> Criar grupo</button>
    <button className="rounded-xl border border-white/20 px-3 py-3 text-sm font-bold" onClick={()=>{setMode('join');setError('');}}><Link2 className="mr-1 inline" size={16}/> Entrar em grupo</button>
   </div><h3 className="pt-3 text-sm font-black uppercase">Meus grupos ({groups.length})</h3>
   {!groups.length?<div className="rounded-2xl border border-white/10 p-8 text-center"><Users size={32} className="mx-auto mb-3 text-[#c4ff40]"/><p className="font-semibold">Nenhum grupo ainda</p><p className="mt-2 text-sm text-white/55">Crie um grupo para organizar sua galera nas próximas festas.</p></div>:
   groups.map(g=><button key={g.id} onClick={()=>void open(g.id)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4 text-left">
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{backgroundColor:g.color}}><Users size={22} className="text-white"/></span>
    <span className="min-w-0 flex-1"><span className="block truncate font-bold">{g.name}</span><span className="text-xs text-white/55">{g.memberCount} integrantes</span><span className="mt-1 flex -space-x-1">{g.avatars.map(p=><SocialAvatar key={p.id} name={p.name} avatar={p.avatar} size="sm" className="ring-2 ring-[#0e0b14]"/>)}</span></span><span aria-hidden="true">›</span>
   </button>)}</>:
   <div className="space-y-4"><button onClick={()=>{setMode('list');setError('');setPreview(null);}} className="inline-flex items-center gap-2 text-sm text-white/60"><ArrowLeft size={17}/> Grupos</button>
    {mode==='create'?<form onSubmit={e=>void create(e)} className="space-y-4 rounded-2xl border border-white/10 bg-white/[.04] p-5">
     <h3 className="text-lg font-bold">Criar grupo</h3><label className="block text-xs text-white/65">Nome do grupo<input required minLength={2} maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Galera do Rolê" className="mt-2 w-full rounded-xl border border-white/20 bg-[#241b2c] p-3 text-base text-white"/></label>
     <label className="block text-xs text-white/65">Descrição (opcional)<textarea maxLength={250} value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-white/20 bg-[#241b2c] p-3 text-base text-white"/></label>
     <fieldset><legend className="mb-2 text-xs font-bold text-white/65">Cor do grupo</legend><div className="flex flex-wrap gap-3">{colors.map(c=><label key={c} className="cursor-pointer"><input className="sr-only" type="radio" name="group-color" checked={color===c} onChange={()=>setColor(c)}/><span style={{backgroundColor:c}} className={'block h-10 w-10 rounded-full '+(color===c?'ring-2 ring-white ring-offset-2 ring-offset-[#17101e]':'')}/></label>)}</div></fieldset>
     <button type="submit" disabled={busy||name.trim().length<2} className={button}>Criar grupo</button>
    </form>:
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[.04] p-5"><h3 className="text-lg font-bold">Entrar em grupo</h3><p className="text-xs text-white/55">Cole um link ou código de convite recebido.</p><input aria-label="Convite de grupo" value={joinLink} onChange={e=>{setJoinLink(e.target.value);setPreview(null);}} placeholder="Link do grupo" className="w-full rounded-xl border border-white/20 bg-[#241b2c] p-3 text-base text-white"/><button disabled={busy||!joinLink.trim()} onClick={()=>void lookup()} className={button}>Ver grupo</button>
     {preview&&<div className="space-y-3 rounded-xl border border-white/15 p-4"><p className="font-bold">{preview.name}</p><p className="text-xs text-white/55">{preview.memberCount} integrantes</p><button disabled={busy||preview.joined} onClick={()=>void join()} className={button}>{preview.joined?'Você já participa':'Entrar no grupo'}</button></div>}
    </div>}
   </div>}
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}{status&&<p role="status" className="text-xs text-[#c4ff40]">{status}</p>}
 </div>;
}
