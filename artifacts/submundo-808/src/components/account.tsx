import { useEffect, useState } from 'react';
import PageLoading from './page-loading';
import useMinimumLoading from './use-minimum-loading';
import { UserRound, Mail, LockKeyhole, LogOut, ShieldCheck, ArrowLeft, KeyRound, Ticket, QrCode, Copy, Share2 } from 'lucide-react';
type User = { id:string; name:string; email:string; phone?:string; instagram?:string; isAdmin?:boolean };
type Mode = 'login'|'register'|'forgot'|'password'|'reset';
function authError(status?:string) {
  switch(status){
    case 'cookie_missing': return 'O cookie de login não chegou ao servidor. Verifique o domínio e o bloqueio de cookies no navegador.';
    case 'token_invalid': return 'O cookie chegou ao servidor, mas o JWT foi rejeitado. Verifique a chave JWT_SECRET e a persistência do volume /data.';
    case 'token_revoked': return 'O cookie chegou ao servidor, mas o token foi revogado.';
    case 'user_missing': return 'O JWT é válido, mas o usuário não foi encontrado no banco de dados.';
    default: return 'Não foi possível confirmar a autenticação após o login.';
  }
}
async function request(path:string, payload?:object) {
  const res=await fetch('/api/auth/'+path,{method:payload?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});
  const data=await res.json();if(!res.ok)throw new Error(data.error||'Não foi possível continuar.');return data;
}
const field='w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#c4ff40]';
const btn='w-full rounded-xl bg-[#c4ff40] px-4 py-3.5 text-sm font-black text-black disabled:opacity-50';
export default function Account({onUser}:{onUser?:(user:User|null)=>void}) {
  const [user,setUser]=useState<User|null>(null);
  const [savedDemoEmail,setSavedDemoEmail]=useState<string|null>(()=>localStorage.getItem('submundo-demo-email'));
  const [demoCredentials,setDemoCredentials]=useState<{email:string;password:string}|null>(null);
  const [mode,setMode]=useState<Mode>('login');
  const [registerStep,setRegisterStep]=useState(1),[profileEditing,setProfileEditing]=useState(false),[profilePhone,setProfilePhone]=useState(''),[profileInstagram,setProfileInstagram]=useState(''),[profileName,setProfileName]=useState(''),[phone,setPhone]=useState('');
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [current,setCurrent]=useState('');
  const [error,setError]=useState('');const [success,setSuccess]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [initialError,setInitialError]=useState(false);
  const resetToken=new URLSearchParams(window.location.search).get('reset');
  useEffect(()=>{
    let active=true;
    if(resetToken)setMode('reset');
    request('me').then(data=>{
      if(!active)return;
      setUser(data.user||null);onUser?.(data.user||null);if(data.user){setProfileName(data.user.name);setProfilePhone(data.user.phone||'');setProfileInstagram(data.user.instagram||'');}
    }).catch(()=>{if(active)setInitialError(true);})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  const change=(next:Mode)=>{setMode(next);setError('');setSuccess('');setPassword('');setConfirm('');setCurrent('');setRegisterStep(1);};
  async function submit(event:React.FormEvent) {
    event.preventDefault();setError('');setSuccess('');
    if(['register','password','reset'].includes(mode) && password!==confirm){setError('As senhas não coincidem.');return;}
    setBusy(true);
    try {
      if(mode==='login'||mode==='register'){const data=await request(mode,mode==='login'?{email,password}:{name,email,password,phone});const me=await request('me');if(!me.user)throw new Error(authError(me.authStatus));setUser(me.user);onUser?.(me.user);setPassword('');setConfirm('');}
      if(mode==='forgot'){const data=await request('forgot',{email});setSuccess(data.message||'Confira seu e-mail.');}
      if(mode==='password'){await request('password',{current,password});change('login');setSuccess('Senha alterada com sucesso. Sua sessão foi renovada.');}
      if(mode==='reset'){await request('reset',{token:resetToken,password});window.history.replaceState({},'',window.location.pathname);change('login');setSuccess('Senha redefinida. Faça login.');}
    }catch(e){setError(e instanceof Error?e.message:'Ocorreu um erro.');}finally{setBusy(false);}
  }
  async function generateDemo(){setBusy(true);setError('');try{const data=await request('demo',{});const me=await request('me');if(!me.user)throw new Error('Conta criada. '+authError(me.authStatus));setUser(me.user);onUser?.(me.user);setDemoCredentials({email:data.user.email,password:data.password});setSavedDemoEmail(data.user.email);localStorage.setItem('submundo-demo-email',data.user.email);}catch(e){setError(e instanceof Error?e.message:'Não foi possível gerar conta de teste.');}finally{setBusy(false);}}
  async function generateDemoAdmin(){setBusy(true);setError('');try{const data=await request('demo-admin',{});const me=await request('me');if(!me.user)throw new Error('Conta criada. '+authError(me.authStatus));setUser(me.user);onUser?.(me.user);setDemoCredentials({email:data.user.email,password:data.password});setSavedDemoEmail(data.user.email);localStorage.setItem('submundo-demo-email',data.user.email);}catch(e){setError(e instanceof Error?e.message:'Não foi possível gerar administrador de teste.');}finally{setBusy(false);}}
  const showLoading=useMinimumLoading(loading);
  if(showLoading)return <PageLoading label="Carregando seu perfil" description="Verificando sua sessão e preparando seu passaporte digital."/>;
  if(initialError)return <div role="alert" className="rounded-2xl border border-red-400/25 bg-red-400/5 p-6 text-center"><p className="font-bold text-red-200">Não foi possível verificar sua sessão.</p><p className="mt-2 text-xs text-white/60">Confira a conexão e tente novamente. O formulário de login não será exibido até a verificação terminar.</p><button onClick={()=>window.location.reload()} className="mt-4 rounded-xl bg-[#c4ff40] px-4 py-2 text-sm font-bold text-black">Tentar novamente</button></div>;
  if(user && mode!=='password' && mode!=='reset')return <div>
    <div className="relative mb-6 overflow-hidden rounded-3xl border border-[#c4ff40]/30 bg-[radial-gradient(circle_at_100%_0%,#46215b,transparent_50%),#17101e] p-6">
      <div className="mb-10 flex items-center justify-between"><span className="rounded-full border border-[#c4ff40]/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#c4ff40]">Passaporte digital</span><Ticket className="text-[#c4ff40]"/></div>
      <p className="text-xs uppercase tracking-widest text-white/50">Bem-vindo(a)</p><h3 className="mt-2 break-words font-display text-2xl font-black uppercase">{user.name}</h3><p className="mt-1 text-sm text-white/50">{user.email}</p>
      <div className="mt-7 border-t border-white/15 pt-4 text-[11px] text-white/40">ID: {user.id.slice(0,8).toUpperCase()} · Não é ingresso</div>
    </div>
    {user.isAdmin&&<a href="https://admin.submundo.menudevendas.com.br" className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#c4ff40] px-4 py-4 text-sm font-black text-black"><ShieldCheck size={19}/> Acessar painel administrativo</a>}
    {(demoCredentials||savedDemoEmail===user.email)&&<div className="mb-5 rounded-xl border border-[#c4ff40]/30 bg-[#c4ff40]/10 p-4 text-xs"><p className="mb-2 font-bold text-[#c4ff40]">Credenciais desta conta — salve antes de sair</p><p className="break-all">E-mail: {demoCredentials?.email||savedDemoEmail}</p><p className="mt-1 break-all">Senha: {demoCredentials?.password||'Exibida somente na criação da conta'}</p>{demoCredentials&&<button onClick={()=>void navigator.clipboard.writeText(`E-mail: ${demoCredentials.email}\nSenha: ${demoCredentials.password}`)} className="mt-3 rounded-lg border border-[#c4ff40]/30 px-3 py-2 font-bold text-[#c4ff40]">Copiar credenciais</button>}</div>}
    <div className="mb-4 rounded-xl border border-white/10 bg-white/[.03] p-4">
     <button type="button" onClick={()=>setProfileEditing(v=>!v)} className="w-full text-left text-sm font-bold text-[#c4ff40]">{profileEditing?'Fechar edição':'Editar meu perfil'}</button>
     {profileEditing&&<form className="mt-4 space-y-3" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await request('profile',{name:profileName,phone:profilePhone,instagram:profileInstagram});const j=await request('me');setUser(j.user);onUser?.(j.user);setProfileEditing(false);setSuccess('Perfil atualizado.');}catch(e){setError(e instanceof Error?e.message:'Erro ao salvar perfil');}finally{setBusy(false);}}}><label className="block text-xs">Nome ou apelido<input required minLength={2} value={profileName} onChange={e=>setProfileName(e.target.value)} className={field+' mt-1'}/></label><label className="block text-xs">Celular / WhatsApp (opcional)<input type="tel" value={profilePhone} onChange={e=>setProfilePhone(e.target.value)} className={field+' mt-1'}/></label><label className="block text-xs">Instagram (opcional)<input value={profileInstagram} onChange={e=>setProfileInstagram(e.target.value)} placeholder="@usuario" className={field+' mt-1'}/></label><p className="text-xs text-white/50">Seus contatos não ficam visíveis aos amigos automaticamente.</p><button disabled={busy} type="submit" className={btn}>Salvar perfil</button></form>}
     {success&&<p role="status" className="mt-2 text-xs text-[#c4ff40]">{success}</p>}
    </div>
    <div className="space-y-3"><button onClick={()=>change('password')} className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-white/[.04] px-4 py-4 text-sm font-bold"><KeyRound size={19} className="text-[#c4ff40]"/> Alterar minha senha</button><button onClick={async()=>{try{await request('logout',{});setUser(null);onUser?.(null);change('login');}catch(e){setError(String(e));}}} className="flex w-full items-center gap-3 rounded-xl border border-white/15 px-4 py-4 text-sm font-bold"><LogOut size={19}/> Sair da conta</button></div>
    <div className="mt-5 rounded-xl border border-white/10 p-4 text-xs leading-relaxed text-white/50"><ShieldCheck size={17} className="mb-2 text-[#c4ff40]"/> Sua conta está salva no servidor. Para compartilhar seu QR Code de amizade, acesse a aba Amigos e toque em Ver meu QR Code. Nenhuma localização é coletada.</div>
    {error&&<p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
  </div>;
  if(user && mode==='password') return <div><button onClick={()=>change('login')} className="mb-5 flex items-center gap-2 text-sm text-white/70"><ArrowLeft size={18}/> Voltar ao perfil</button><div className="mb-4 font-display text-xl font-black uppercase">Alterar senha</div><form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-white/[.04] p-5"><label className="block text-sm font-bold">Senha atual<input required type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} className={field+' mt-2'}/></label><label className="block text-sm font-bold">Nova senha<input required type="password" minLength={10} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className={field+' mt-2'}/></label><label className="block text-sm font-bold">Confirmar senha<input required type="password" minLength={10} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className={field+' mt-2'}/></label>{error&&<p role="alert" className="text-xs text-red-300">{error}</p>}{success&&<p role="status" className="text-xs text-[#c4ff40]">{success}</p>}<button disabled={busy} className={btn}>{busy?'Aguarde...':'Salvar nova senha'}</button></form></div>;
  return <div>
    <div className="mb-6 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#c4ff40]/10 text-[#c4ff40]"><UserRound size={25}/></div><div><p className="text-[11px] font-bold uppercase tracking-widest text-[#c4ff40]">Passaporte digital</p><h2 className="font-display text-xl font-black uppercase">{({login:'Entrar na conta',register:'Criar minha conta',forgot:'Recuperar acesso',password:'Alterar senha',reset:'Nova senha'})[mode]}</h2></div></div>
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-white/[.04] p-5">
      {mode==='register'&&registerStep===2&&<><p className="text-sm font-bold text-[#c4ff40]">Passo 2 de 2 · Seu perfil (opcional)</p><label className="block text-sm font-bold">Nome ou apelido<input minLength={2} maxLength={60} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} className={field+' mt-2'} placeholder="Como quer ser chamado?"/></label><label className="block text-sm font-bold">Celular / WhatsApp<input type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} className={field+' mt-2'} placeholder="(15) 99999-9999"/></label><p className="text-xs text-white/50">Nenhum desses dados é obrigatório. O celular não será exibido aos amigos.</p></>}
      {(['login','forgot'].includes(mode)||(mode==='register'&&registerStep===1))&&<label className="block text-sm font-bold">E-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className={field+' mt-2'} placeholder="voce@email.com"/></label>}
      {mode==='password'&&<label className="block text-sm font-bold">Senha atual<input required type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} className={field+' mt-2'}/></label>}
      {(['login','password','reset'].includes(mode)||(mode==='register'&&registerStep===1))&&<label className="block text-sm font-bold">{mode==='login'?'Senha':'Nova senha'}<input required type="password" minLength={mode==='login'?undefined:10} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} className={field+' mt-2'} placeholder={mode==='login'?'Sua senha':'Mínimo de 10 caracteres'}/></label>}
      {(['password','reset'].includes(mode)||(mode==='register'&&registerStep===1))&&<label className="block text-sm font-bold">Confirmar senha<input required type="password" minLength={10} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className={field+' mt-2'}/></label>}
      {error&&<p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
      {success&&<p role="status" className="rounded-lg border border-[#c4ff40]/30 bg-[#c4ff40]/10 p-3 text-xs text-[#c4ff40]">{success}</p>}
      {mode==='register'&&registerStep===1?<button type="button" className={btn} onClick={()=>{if(!email.includes('@')||password.length<10||password!==confirm){setError('Informe e-mail válido e duas senhas iguais de pelo menos 10 caracteres.');return;}setError('');setRegisterStep(2);}}>Continuar · Passo 2 de 2</button>:<button disabled={busy} className={btn}>{busy?'Aguarde...':mode==='register'?'Criar conta':({login:'Entrar',forgot:'Enviar link de recuperação',password:'Salvar nova senha',reset:'Redefinir senha'})[mode]}</button>}
      {mode==='login'&&<button type="button" disabled={busy} onClick={()=>void generateDemo()} className="w-full rounded-xl border border-[#c4ff40]/40 bg-[#c4ff40]/10 px-4 py-3 text-sm font-bold text-[#c4ff40] disabled:opacity-50">Gerar usuário teste</button>}
      {mode==='login'&&<button type="button" disabled={busy} onClick={()=>void generateDemoAdmin()} className="w-full rounded-xl border border-violet-400/40 bg-violet-400/10 px-4 py-3 text-sm font-bold text-violet-200 disabled:opacity-50">Gerar administrador teste</button>}
      {mode==='login'&&<div className="flex flex-col items-center gap-3 pt-2"><button type="button" onClick={()=>change('forgot')} className="text-xs text-white/65 underline">Esqueci minha senha</button><button type="button" onClick={()=>change('register')} className="text-sm font-bold text-[#c4ff40]">Não tem conta? Cadastrar pessoa</button></div>}
      {mode!=='login'&&<button type="button" onClick={()=>{if(user){change('login');}else{change('login');}}} className="flex w-full items-center justify-center gap-2 pt-2 text-xs text-white/60"><ArrowLeft size={14}/> {user?'Voltar':'Voltar para login'}</button>}
    </form>
    {mode==='forgot'&&<p className="mt-4 text-xs leading-relaxed text-white/50">O envio de e-mails depende da configuração do serviço de recuperação pelo administrador.</p>}
    <p className="mt-5 text-center text-xs leading-relaxed text-white/40"><LockKeyhole size={13} className="mr-1 inline"/> Sua senha não fica salva no navegador. O acesso usa sessão protegida.</p>
  </div>;
}
