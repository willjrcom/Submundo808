import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,Check,Copy,History,Plus,Search,Shield,ShieldCheck,Trash2,UserRound,X} from 'lucide-react';

type Role='owner'|'admin';
type Admin={id:string;name:string;email:string;role:Role;created_at:number;granted_by?:string|null};
type Candidate={id:string;name:string;email:string};
type Log={id:string;actor_name:string|null;target_name:string|null;action:string;old_role:Role|null;new_role:Role|null;created_at:number};
type Dialog='create'|'edit'|'revoke'|'bootstrap'|null;
type AdminList={items:Admin[];role:Role;ownerCount:number;bootstrapEligible:boolean};
type Created={newAccount:boolean;emailSent:boolean;tempPassword?:string;item:Admin};

const input='w-full rounded-xl border border-white/20 bg-[#241b2c] px-3 py-3 text-sm text-white placeholder:text-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4ff40]';
const secondary='rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10';
const primary='rounded-xl bg-[#c4ff40] px-4 py-2.5 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50';
const readableError=(error:unknown)=>error instanceof Error?error.message:'Não foi possível concluir a operação.';
async function adminApi<T>(resource:string,data?:Record<string,unknown>):Promise<T>{
 const response=await fetch('/api/admin/'+resource,{
  method:data?'POST':'GET',credentials:'same-origin',
  headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined
 });
 const value=await response.json();
 if(!response.ok)throw Error(value.error||'Operação administrativa não concluída.');
 return value as T;
}
const roleLabel=(role:Role)=>role==='owner'?'Proprietário':'Administrador';

export default function AdminAdmins({currentUserId}:{currentUserId:string}){
 const [state,setState]=useState<AdminList|null>(null),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const [search,setSearch]=useState(''),[candidateQuery,setCandidateQuery]=useState(''),[candidates,setCandidates]=useState<Candidate[]>([]);
 const [dialog,setDialog]=useState<Dialog>(null),[selected,setSelected]=useState<Admin|null>(null);
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[role,setRole]=useState<Role>('admin');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [created,setCreated]=useState<Created|null>(null),[copied,setCopied]=useState(false);
 const [showAudit,setShowAudit]=useState(false),[history,setHistory]=useState<Log[]>([]),[historyError,setHistoryError]=useState('');
 const isOwner=state?.role==='owner';
 const filtered=(state?.items||[]).filter(item=>(item.name+' '+item.email+' '+roleLabel(item.role)).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));

 async function reload(){
  setLoadError('');
  const next=await adminApi<AdminList>('admins');
  setState(next);
 }
 useEffect(()=>{
  let active=true;
  setLoading(true);
  void adminApi<AdminList>('admins').then(result=>{if(active)setState(result);})
   .catch(err=>{if(active)setLoadError(readableError(err));})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(dialog!=='create'||!isOwner||candidateQuery.trim().length<2){setCandidates([]);return;}
  let active=true;const controller=new AbortController();
  const timer=window.setTimeout(()=>{
   void fetch('/api/admin/admins-search?q='+encodeURIComponent(candidateQuery.trim()),{credentials:'same-origin',signal:controller.signal})
    .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Busca indisponível.');return data as {items:Candidate[]};})
    .then(data=>{if(active)setCandidates(data.items);})
    .catch(()=>{if(active)setCandidates([]);});
  },280);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[candidateQuery,dialog,isOwner]);
 useEffect(()=>{
  if(!dialog)return;
  const old=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const handler=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy){event.preventDefault();setDialog(null);}};
  document.addEventListener('keydown',handler);
  return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',handler);};
 },[dialog,busy]);
 function open(next:Dialog,item:Admin|null=null){
  setSelected(item);setName(item?.name||'');setEmail(item?.email||'');setRole(item?.role||'admin');
  setError('');setNotice('');setCandidateQuery('');setCreated(null);setCopied(false);setDialog(next);
 }
 async function save(event:FormEvent){
  event.preventDefault();if(busy||!dialog)return;
  setError('');setBusy(true);
  try{
   if(dialog==='bootstrap'){
    await adminApi('admins',{action:'bootstrap'});
    setNotice('Propriedade assumida. Agora você pode gerenciar administradores.');
   }else if(dialog==='create'){
    const result=await adminApi<Created>('admins',{action:'create',name,email,role});
    setCreated(result);
    setNotice(result.newAccount?'Conta administrativa criada. Guarde as credenciais antes de sair.':'A conta cadastrada recebeu acesso administrativo.');
   }else if(dialog==='edit'&&selected){
    await adminApi('admins',{action:'update',id:selected.id,name,role});
    setNotice('Administrador atualizado com sucesso.');
   }else if(dialog==='revoke'&&selected){
    await adminApi('admins',{action:'revoke',id:selected.id});
    setNotice('Acesso administrativo revogado. A conta pessoal foi preservada.');
   }
   await reload();
   if(dialog!=='create')setDialog(null);
   if(showAudit){const log=await adminApi<{items:Log[]}>('admins-audit');setHistory(log.items);}
  }catch(err){setError(readableError(err));}
  finally{setBusy(false);}
 }
 async function showHistory(){
  if(showAudit){setShowAudit(false);return;}
  setHistoryError('');
  try{const result=await adminApi<{items:Log[]}>('admins-audit');setHistory(result.items);setShowAudit(true);}
  catch(err){setHistoryError(readableError(err));}
 }
 const roleOptions=<select value={role} onChange={e=>setRole(e.target.value as Role)} className={input} aria-label="Nível de acesso">
  <option value="admin">Administrador — operações do painel</option><option value="owner">Proprietário — gerencia acessos</option>
 </select>;

 return <section className="mt-6 space-y-5" aria-label="Gerenciar administradores">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-sm text-white/55">Gerencie os acessos ao painel sem alterar as contas de participantes.</p><p className="mt-1 text-xs text-white/40">{state?.items.length??0} administrador(es) · {state?.ownerCount??0} proprietário(s)</p></div>
   {isOwner&&<button type="button" className={primary+' inline-flex items-center gap-2'} onClick={()=>open('create')}><Plus size={18}/> Novo admin</button>}
  </div>
  {loadError&&<div role="alert" className="rounded-xl border border-red-400/30 p-4 text-sm text-red-200">{loadError}<button type="button" onClick={()=>{setLoading(true);void reload().catch(e=>setLoadError(readableError(e))).finally(()=>setLoading(false));}} className="ml-3 underline">Tentar novamente</button></div>}
  {loading&&<p role="status" className="text-sm text-white/65">Carregando administradores...</p>}
  {state&&!state.ownerCount&&<div className="rounded-2xl border border-amber-300/30 bg-amber-300/[.06] p-4">
   <h3 className="flex items-center gap-2 text-sm font-bold text-amber-200"><Shield size={18}/> Definir o primeiro proprietário</h3>
   <p className="mt-2 text-xs leading-relaxed text-white/70">Nenhum proprietário foi definido automaticamente. O primeiro administrador cadastrado pode assumir a propriedade usando sua sessão atual, inclusive pelo Google ou Meaple. Nenhuma senha adicional é necessária.</p>
   {state.bootstrapEligible?<button type="button" onClick={()=>open('bootstrap')} className={secondary+' mt-3'}>Assumir propriedade</button>:<p className="mt-2 text-xs text-amber-100/75">Por segurança, a atribuição inicial é reservada ao primeiro administrador cadastrado.</p>}
  </div>}
  {notice&&<p role="status" className="rounded-xl border border-[#c4ff40]/30 bg-[#c4ff40]/[.06] p-3 text-sm text-[#c4ff40]">{notice}</p>}
  <label className="relative block">
   <span className="sr-only">Pesquisar administradores</span><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/45"/>
   <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar por nome, e-mail ou função" className={input+' pl-11'}/>
  </label>
  {state&&<div className="overflow-hidden rounded-2xl border border-white/15 bg-[#191321]">
   {filtered.length?filtered.map(item=><article key={item.id} className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4 last:border-b-0">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#c4ff40]/10 font-black text-[#c4ff40]"><UserRound size={21}/></span>
    <div className="min-w-0 flex-1">
     <p className="flex flex-wrap items-center gap-2 text-sm font-bold">{item.name}{item.id===currentUserId&&<span className="text-xs font-normal text-white/40">(você)</span>}</p>
     <p className="break-all text-xs text-white/55">{item.email}</p>
     <span className={'mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold '+(item.role==='owner'?'border-[#c4ff40]/35 text-[#c4ff40]':'border-white/20 text-white/65')}>{item.role==='owner'?<ShieldCheck size={12}/>:<Shield size={12}/>} {roleLabel(item.role)}</span>
    </div>
    {isOwner&&<div className="flex gap-2"><button type="button" onClick={()=>open('edit',item)} className={secondary} aria-label={'Editar '+item.name}>Editar</button><button type="button" onClick={()=>open('revoke',item)} disabled={item.role==='owner'&&state.ownerCount<=1} title={item.role==='owner'&&state.ownerCount<=1?'Não é possível remover o último proprietário':'Revogar acesso'} className="rounded-xl border border-red-400/30 p-3 text-red-300 disabled:cursor-not-allowed disabled:opacity-30" aria-label={'Revogar acesso de '+item.name}><Trash2 size={17}/></button></div>}
   </article>):<p className="p-5 text-sm text-white/60">Nenhum administrador encontrado.</p>}
  </div>}
  {state&&!isOwner&&state.ownerCount>0&&<p className="text-xs text-white/50">Somente proprietários podem adicionar, editar ou revogar administradores.</p>}
  {isOwner&&<section className="space-y-3">
   <button type="button" className={secondary+' inline-flex items-center gap-2'} onClick={()=>void showHistory()}><History size={17}/>{showAudit?'Ocultar histórico':'Ver histórico de alterações'}</button>
   {historyError&&<p role="alert" className="text-sm text-red-300">{historyError}</p>}
   {showAudit&&<div className="overflow-hidden rounded-xl border border-white/15 bg-white/[.035]">
    {history.length?history.map(log=><div key={log.id} className="border-b border-white/10 px-4 py-3 text-xs last:border-b-0">
     <p className="font-semibold">{log.actor_name||'Administrador'} · {log.action==='grant'?'Concedeu acesso':log.action==='revoke'?'Revogou acesso':log.action==='bootstrap'?'Assumiu propriedade':'Atualizou acesso'}</p>
     <p className="mt-1 text-white/55">{log.target_name||log.target_user_id} · {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(log.created_at))}</p>
    </div>):<p className="p-4 text-xs text-white/50">Nenhuma alteração registrada.</p>}
   </div>}
  </section>}

  {dialog&&<div role="presentation" className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/85 p-3 py-6" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setDialog(null);}}>
   <div role="dialog" aria-modal="true" aria-label={dialog==='create'?'Novo administrador':dialog==='edit'?'Editar administrador':dialog==='revoke'?'Revogar acesso administrativo':'Definir proprietário'} className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-white/20 bg-[#1d1427] shadow-2xl">
    <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
     <div><h3 className="text-lg font-black">{dialog==='create'?'Novo administrador':dialog==='edit'?'Editar administrador':dialog==='revoke'?'Revogar acesso':'Assumir propriedade'}</h3><p className="mt-1 text-xs text-white/55">{dialog==='create'?'Conceda acesso a um usuário existente ou crie uma nova conta.':dialog==='edit'?'Atualize o nome e a função.':dialog==='revoke'?'A conta pessoal e seus dados serão mantidos.':'Confirme que deseja assumir a propriedade deste painel com a conta autenticada.'}</p></div>
     <button type="button" disabled={busy} onClick={()=>setDialog(null)} aria-label="Fechar modal" className="rounded-lg border border-white/15 p-2 text-white/70"><X size={18}/></button>
    </header>
    {created?<div className="space-y-3 p-5">
     <p className="flex items-center gap-2 font-bold text-[#c4ff40]"><Check size={20}/> Acesso administrativo criado</p>
     <p className="text-sm text-white/80">{created.item.name} · {created.item.email}</p>
     {created.newAccount&&<div className="rounded-xl border border-amber-300/30 bg-amber-300/[.06] p-3 text-sm">
      <p className="font-bold text-amber-100">Credenciais provisórias — copie antes de fechar</p>
      <p className="mt-2 break-all text-white/70">E-mail: {created.item.email}</p><p className="mt-1 break-all text-white/70">Senha: {created.tempPassword}</p>
      <p className="mt-2 text-xs text-white/55">{created.emailSent?'Foi enviado um convite por e-mail para definir uma nova senha.':'O envio por e-mail não está configurado ou não foi concluído. Entregue as credenciais por um canal seguro e oriente a troca da senha.'}</p>
      <button type="button" className={secondary+' mt-3 inline-flex items-center gap-2'} onClick={async()=>{try{await navigator.clipboard.writeText('E-mail: '+created.item.email+'\nSenha: '+created.tempPassword);setCopied(true);}catch{setError('Não foi possível copiar as credenciais.');}}}><Copy size={16}/>{copied?'Copiado!':'Copiar credenciais'}</button>
     </div>}
     {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
     <button type="button" className={primary+' w-full'} onClick={()=>{setDialog(null);setCreated(null);}}>Concluir</button>
    </div>:<form onSubmit={e=>void save(e)} className="space-y-4 p-4 sm:p-5">
     {dialog==='create'&&<>
      <label className="block space-y-1.5 text-sm font-semibold"><span>E-mail do administrador</span><input type="email" required maxLength={254} autoComplete="off" value={email} onChange={e=>{setEmail(e.target.value);setCandidateQuery(e.target.value);}} placeholder="pessoa@exemplo.com" className={input}/></label>
      {candidates.length>0&&<div className="space-y-1 rounded-xl border border-white/15 bg-white/[.035] p-2"><p className="px-2 py-1 text-[11px] text-white/50">Usuários existentes</p>{candidates.map(person=><button type="button" key={person.id} onClick={()=>{setName(person.name);setEmail(person.email);setCandidateQuery('');}} className="block w-full rounded-lg p-2 text-left text-xs hover:bg-white/10"><strong className="block">{person.name}</strong><span className="text-white/55">{person.email}</span></button>)}</div>}
      <label className="block space-y-1.5 text-sm font-semibold"><span>Nome (para contas novas)</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={60} placeholder="Nome completo" className={input}/></label>
      <p className="text-xs text-white/50">Se o e-mail já estiver cadastrado, sua conta atual será promovida, sem alterar a senha. Para um e-mail novo, será criada uma conta com senha provisória.</p>
      <label className="block space-y-1.5 text-sm font-semibold"><span>Nível de acesso</span>{roleOptions}</label>
     </>}
     {dialog==='edit'&&<>
      <p className="break-all text-sm text-white/60">{selected?.email}</p>
      <label className="block space-y-1.5 text-sm font-semibold"><span>Nome</span><input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={60} required className={input}/></label>
      <label className="block space-y-1.5 text-sm font-semibold"><span>Nível de acesso</span>{roleOptions}</label>
      {selected?.role==='owner'&&state?.ownerCount===1&&<p className="text-xs text-amber-200">O último proprietário não pode perder esse papel.</p>}
     </>}
     {dialog==='revoke'&&<p className="text-sm leading-relaxed text-white/75">Deseja revogar o acesso de <strong>{selected?.name}</strong> ({selected?.email})? A pessoa perderá o acesso ao painel imediatamente, mas sua conta continuará funcionando.</p>}
     {dialog==='bootstrap'&&<p className="rounded-xl border border-amber-300/25 p-3 text-sm leading-relaxed text-white/75">Esta ação concede acesso completo para gerenciar administradores. Confirme apenas se esta for sua conta administrativa. A operação ficará registrada no histórico.</p>}
     {error&&<p role="alert" className="rounded-lg border border-red-400/30 p-3 text-sm text-red-300">{error}</p>}
     <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
      <button type="button" disabled={busy} className={secondary} onClick={()=>setDialog(null)}><ArrowLeft size={15} className="mr-1 inline"/>Cancelar</button>
      <button type="submit" disabled={busy||(dialog==='revoke'&&selected?.role==='owner'&&state?.ownerCount===1)} className={dialog==='revoke'?'rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40':primary}>{busy?'Salvando...':dialog==='create'?'Criar administrador':dialog==='edit'?'Salvar alterações':dialog==='revoke'?'Revogar acesso':'Confirmar propriedade'}</button>
     </footer>
    </form>}
   </div>
  </div>}
 </section>;
}
