import { useEffect, useState } from 'react';
import { UserRound, Mail, LockKeyhole, LogOut, ShieldCheck, ArrowLeft, KeyRound, Ticket, QrCode, Copy, Share2 } from 'lucide-react';
type User = { id:string; name:string; email:string };
type Mode = 'login'|'register'|'forgot'|'password'|'reset';
async function request(path:string, payload?:object) {
  const res=await fetch('/api/auth/'+path,{method:payload?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});
  const data=await res.json();if(!res.ok)throw new Error(data.error||'Não foi possível continuar.');return data;
}
const field='w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#c4ff40]';
const btn='w-full rounded-xl bg-[#c4ff40] px-4 py-3.5 text-sm font-black text-black disabled:opacity-50';
export default function Account({onUser}:{onUser?:(user:User|null)=>void}) {
  const [user,setUser]=useState<User|null>(null);
  const [mode,setMode]=useState<Mode>('login');
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [current,setCurrent]=useState('');
  const [error,setError]=useState('');const [success,setSuccess]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
  const resetToken=new URLSearchParams(window.location.search).get('reset');
  useEffect(()=>{if(resetToken)setMode('reset');request('me').then(data=>{setUser(data.user);onUser?.(data.user);}).catch(()=>setError('Não foi possível conectar ao servidor.')).finally(()=>setLoading(false));},[]);
  const change=(next:Mode)=>{setMode(next);setError('');setSuccess('');setPassword('');setConfirm('');setCurrent('');};
  async function submit(event:React.FormEvent) {
    event.preventDefault();setError('');setSuccess('');
    if(['register','password','reset'].includes(mode) && password!==confirm){setError('As senhas não coincidem.');return;}
    setBusy(true);
    try {
      if(mode==='login'||mode==='register'){const data=await request(mode,mode==='login'?{email,password}:{name,email,password});setUser(data.user);onUser?.(data.user);setPassword('');setConfirm('');}
      if(mode==='forgot'){const data=await request('forgot',{email});setSuccess(data.message||'Confira seu e-mail.');}
      if(mode==='password'){await request('password',{current,password});change('login');setSuccess('Senha alterada com sucesso. Sua sessão foi renovada.');}
      if(mode==='reset'){await request('reset',{token:resetToken,password});window.history.replaceState({},'',window.location.pathname);change('login');setSuccess('Senha redefinida. Faça login.');}
    }catch(e){setError(e instanceof Error?e.message:'Ocorreu um erro.');}finally{setBusy(false);}
  }
  if(loading)return <p className="text-sm text-white/50">Carregando seu perfil...</p>;
  if(user && mode!=='password' && mode!=='reset')return <div>
    <div className="relative mb-6 overflow-hidden rounded-3xl border border-[#c4ff40]/30 bg-[radial-gradient(circle_at_100%_0%,#46215b,transparent_50%),#17101e] p-6">
      <div className="mb-10 flex items-center justify-between"><span className="rounded-full border border-[#c4ff40]/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#c4ff40]">Passaporte digital</span><Ticket className="text-[#c4ff40]"/></div>
      <p className="text-xs uppercase tracking-widest text-white/50">Bem-vindo(a)</p><h3 className="mt-2 break-words font-display text-2xl font-black uppercase">{user.name}</h3><p className="mt-1 text-sm text-white/50">{user.email}</p>
      <div className="mt-7 border-t border-white/15 pt-4 text-[11px] text-white/40">ID: {user.id.slice(0,8).toUpperCase()} · Não é ingresso</div>
    </div>
    <div className="mb-5 rounded-2xl border border-white/10 bg-white/[.04] p-5">
      <div className="mb-3 flex items-center gap-2"><QrCode className="text-[#c4ff40]" size={22}/><h3 className="font-display text-sm font-black uppercase">Meu QR Code</h3></div>
      <p className="mb-4 text-xs leading-relaxed text-white/55">Mostre seu código para outra pessoa encontrar seu perfil. O código não contém seu e-mail ou senha.</p>
      <div className="mx-auto w-fit rounded-xl bg-white p-3"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(window.location.origin+'/?friend='+user.id)}`} alt="QR Code do seu perfil" width={220} height={220} loading="lazy"/></div>
      <p className="mt-3 text-center font-mono text-xs tracking-widest text-white/55">{user.id.slice(0,8).toUpperCase()}</p>
      <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={async()=>{try{await navigator.clipboard.writeText(window.location.origin+'/?friend='+user.id);setSuccess('Link copiado.');}catch{setError('Não foi possível copiar.');}}} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-3 text-xs font-bold"><Copy size={15}/> Copiar link</button><button onClick={async()=>{const link=window.location.origin+'/?friend='+user.id;if(navigator.share){try{await navigator.share({title:'Meu perfil Submundo 808',url:link});}catch{}}else{try{await navigator.clipboard.writeText(link);setSuccess('Link copiado.');}catch{setError('Não foi possível compartilhar.');}}}} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-3 text-xs font-bold"><Share2 size={15}/> Compartilhar</button></div>
      <p className="mt-3 text-xs text-white/40">QR Code gerado por serviço externo. O convite de amizade será conectado na próxima etapa.</p>
    </div>
    {success&&<p role="status" className="mb-3 text-xs text-[#c4ff40]">{success}</p>}
    <div className="space-y-3"><button onClick={()=>change('password')} className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-white/[.04] px-4 py-4 text-sm font-bold"><KeyRound size={19} className="text-[#c4ff40]"/> Alterar minha senha</button><button onClick={async()=>{try{await request('logout',{});setUser(null);onUser?.(null);change('login');}catch(e){setError(String(e));}}} className="flex w-full items-center gap-3 rounded-xl border border-white/15 px-4 py-4 text-sm font-bold"><LogOut size={19}/> Sair da conta</button></div>
    <div className="mt-5 rounded-xl border border-white/10 p-4 text-xs leading-relaxed text-white/50"><ShieldCheck size={17} className="mb-2 text-[#c4ff40]"/> Sua conta está salva no servidor. O QR Code identifica seu perfil; o envio de convites de amizade será a próxima etapa. Nenhuma localização é coletada.</div>
    {error&&<p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
  </div>;
  if(user && mode==='password') return <div><button onClick={()=>change('login')} className="mb-5 flex items-center gap-2 text-sm text-white/70"><ArrowLeft size={18}/> Voltar ao perfil</button><div className="mb-4 font-display text-xl font-black uppercase">Alterar senha</div><form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-white/[.04] p-5"><label className="block text-sm font-bold">Senha atual<input required type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} className={field+' mt-2'}/></label><label className="block text-sm font-bold">Nova senha<input required type="password" minLength={10} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className={field+' mt-2'}/></label><label className="block text-sm font-bold">Confirmar senha<input required type="password" minLength={10} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className={field+' mt-2'}/></label>{error&&<p role="alert" className="text-xs text-red-300">{error}</p>}{success&&<p role="status" className="text-xs text-[#c4ff40]">{success}</p>}<button disabled={busy} className={btn}>{busy?'Aguarde...':'Salvar nova senha'}</button></form></div>;
  return <div>
    <div className="mb-6 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#c4ff40]/10 text-[#c4ff40]"><UserRound size={25}/></div><div><p className="text-[11px] font-bold uppercase tracking-widest text-[#c4ff40]">Passaporte digital</p><h2 className="font-display text-xl font-black uppercase">{({login:'Entrar na conta',register:'Criar minha conta',forgot:'Recuperar acesso',password:'Alterar senha',reset:'Nova senha'})[mode]}</h2></div></div>
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-white/[.04] p-5">
      {mode==='register'&&<label className="block text-sm font-bold">Nome<input required minLength={2} maxLength={60} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} className={field+' mt-2'} placeholder="Seu nome"/></label>}
      {['login','register','forgot'].includes(mode)&&<label className="block text-sm font-bold">E-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className={field+' mt-2'} placeholder="voce@email.com"/></label>}
      {mode==='password'&&<label className="block text-sm font-bold">Senha atual<input required type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} className={field+' mt-2'}/></label>}
      {['login','register','password','reset'].includes(mode)&&<label className="block text-sm font-bold">{mode==='login'?'Senha':'Nova senha'}<input required type="password" minLength={mode==='login'?undefined:10} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} className={field+' mt-2'} placeholder={mode==='login'?'Sua senha':'Mínimo de 10 caracteres'}/></label>}
      {['register','password','reset'].includes(mode)&&<label className="block text-sm font-bold">Confirmar senha<input required type="password" minLength={10} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className={field+' mt-2'}/></label>}
      {error&&<p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
      {success&&<p role="status" className="rounded-lg border border-[#c4ff40]/30 bg-[#c4ff40]/10 p-3 text-xs text-[#c4ff40]">{success}</p>}
      <button disabled={busy} className={btn}>{busy?'Aguarde...':({login:'Entrar',register:'Cadastrar pessoa',forgot:'Enviar link de recuperação',password:'Salvar nova senha',reset:'Redefinir senha'})[mode]}</button>
      {mode==='login'&&<div className="flex flex-col items-center gap-3 pt-2"><button type="button" onClick={()=>change('forgot')} className="text-xs text-white/65 underline">Esqueci minha senha</button><button type="button" onClick={()=>change('register')} className="text-sm font-bold text-[#c4ff40]">Não tem conta? Cadastrar pessoa</button></div>}
      {mode!=='login'&&<button type="button" onClick={()=>{if(user){change('login');}else{change('login');}}} className="flex w-full items-center justify-center gap-2 pt-2 text-xs text-white/60"><ArrowLeft size={14}/> {user?'Voltar':'Voltar para login'}</button>}
    </form>
    {mode==='forgot'&&<p className="mt-4 text-xs leading-relaxed text-white/50">O envio de e-mails depende da configuração do serviço de recuperação pelo administrador.</p>}
    <p className="mt-5 text-center text-xs leading-relaxed text-white/40"><LockKeyhole size={13} className="mr-1 inline"/> Sua senha não fica salva no navegador. O acesso usa sessão protegida.</p>
  </div>;
}
