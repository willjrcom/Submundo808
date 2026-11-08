import {useEffect,useState,type FormEvent} from 'react';
import {Building2,Camera,Check,FileText,IdCard,Image as ImageIcon,Mail,Palette,Pencil,Phone,ShieldCheck,X} from 'lucide-react';
import {formatMobile} from './phone-mask';
import {applyAccentColor,DEFAULT_COLOR} from '../theme-accent';
import {accentTextColor,contrastRatio,readableAccentOnDark} from '../accent-contrast';
import {compressVenueImage} from './compress-venue-image';

type CompanySettings={
 minimum_age:number;
 entry_rules:string;
 accepted_documents:string;
 cancellation_policy:string;
 contact_name:string;
 contact_phone:string;
};
type CompanyProfile={logo:string;cover:string;color:string;settings:CompanySettings};
type ProfileTab='identity'|'contact'|'rules';

const input='w-full rounded-xl border border-white/20 bg-[#241b2c] px-3 py-3 text-sm text-white placeholder:text-white/40';
const swatches:[string,string][]=[
 ['Verde','#c4ff40'],['Roxo','#a855f7'],['Vermelho','#ef4444'],
 ['Azul','#3b82f6'],['Rosa','#ec4899'],['Laranja','#fb923c']
];
const validColor=(color:string)=>/^#[0-9a-fA-F]{6}$/.test(color);
async function profileApi(data?:CompanyProfile):Promise<CompanyProfile>{
 const response=await fetch('/api/admin/company-profile',{
  method:data?'POST':'GET',credentials:'same-origin',
  headers:{'Content-Type':'application/json'},
  body:data?JSON.stringify(data):undefined
 });
 const payload=await response.json();
 if(!response.ok)throw Error(payload.error||'Não foi possível carregar o perfil da empresa.');
 return payload.profile as CompanyProfile;
}
const brief=(text:string)=>text.trim()?text.trim():'Não informado';

export default function AdminCompanyProfile(){
 const [profile,setProfile]=useState<CompanyProfile|null>(null);
 const [draft,setDraft]=useState<CompanyProfile|null>(null);
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const [editOpen,setEditOpen]=useState(false),[tab,setTab]=useState<ProfileTab>('identity');
 const [busy,setBusy]=useState(false),[imageBusy,setImageBusy]=useState(false);
 const [error,setError]=useState(''),[feedback,setFeedback]=useState('');
 const [confirmDiscard,setConfirmDiscard]=useState(false);
 const dirty=Boolean(profile&&draft&&JSON.stringify(profile)!==JSON.stringify(draft));

 async function reload(){
  setLoading(true);setLoadError('');
  try{
   const saved=await profileApi();
   setProfile(saved);
   applyAccentColor(validColor(saved.color)?saved.color:DEFAULT_COLOR);
  }catch(e){setLoadError(e instanceof Error?e.message:'Falha ao carregar preferências.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void reload();},[]);

 function openEditor(){
  if(!profile)return;
  setDraft({...profile,settings:{...profile.settings}});
  setError('');setFeedback('');setTab('identity');setConfirmDiscard(false);setEditOpen(true);
 }
 function closeEditor(){
  if(busy||imageBusy)return;
  if(dirty){setConfirmDiscard(true);return;}
  setEditOpen(false);setDraft(null);setError('');
 }
 function discardEditor(){
  setConfirmDiscard(false);setEditOpen(false);setDraft(null);setError('');
 }
 useEffect(()=>{
  if(!editOpen)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const keydown=(event:KeyboardEvent)=>{
   if(event.key!=='Escape')return;
   event.preventDefault();
   if(confirmDiscard){setConfirmDiscard(false);return;}
   closeEditor();
  };
  document.addEventListener('keydown',keydown);
  return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',keydown);};
 },[editOpen,confirmDiscard,busy,imageBusy,dirty]);

 const changeSettings=(patch:Partial<CompanySettings>)=>setDraft(old=>old?{...old,settings:{...old.settings,...patch}}:old);
 async function uploadImage(file:File,kind:'cover'|'logo'){
  if(busy||imageBusy)return;
  setImageBusy(true);setError('');
  try{
   const image=await compressVenueImage(file,kind);
   setDraft(old=>old?{...old,[kind]:image}:old);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível processar a imagem.');}
  finally{setImageBusy(false);}
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!draft||busy||imageBusy)return;
  setError('');setFeedback('');
  if(!validColor(draft.color)){setTab('identity');setError('Informe uma cor hexadecimal válida.');return;}
  if(draft.settings.contact_phone&&draft.settings.contact_phone.length!==11){
   setTab('contact');setError('Informe um celular com DDD e 11 dígitos, ou deixe em branco.');return;
  }
  setBusy(true);
  try{
   const saved=await profileApi({...draft,color:draft.color.toLowerCase()});
   setProfile(saved);applyAccentColor(saved.color);
   setDraft(null);setEditOpen(false);setConfirmDiscard(false);
   setFeedback('Perfil da empresa atualizado com sucesso.');
  }catch(e){setError(e instanceof Error?e.message:'Erro ao salvar o perfil da empresa.');}
  finally{setBusy(false);}
 }

 if(loading&&!profile)return <div className="mt-6 rounded-2xl border border-white/15 p-6 text-sm text-white/60">Carregando perfil da empresa...</div>;
 if(!profile)return <div role="alert" className="mt-6 space-y-3 rounded-2xl border border-red-400/25 bg-red-400/5 p-6">
  <p className="font-bold text-red-200">Não foi possível carregar o perfil da empresa.</p>
  <p className="text-sm text-white/65">{loadError}</p>
  <button type="button" onClick={()=>void reload()} className="rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-bold text-black">Tentar novamente</button>
 </div>;

 const phone=profile.settings.contact_phone;
 const age=profile.settings.minimum_age;
 const tabs:[ProfileTab,string,typeof Palette][]=[
  ['identity','Identidade visual',Palette],['contact','Contato',IdCard],['rules','Regras gerais',FileText]
 ];

 return <div className="mt-6 space-y-5">
  {feedback&&<p role="status" className="rounded-xl border border-[#c4ff40]/30 bg-[#c4ff40]/5 p-3 text-sm text-[#c4ff40]">{feedback}</p>}
  <section className="overflow-hidden rounded-3xl border border-white/15 bg-[#18121f]" aria-label="Perfil da empresa">
   <div className="relative h-44 overflow-hidden bg-[radial-gradient(circle_at_80%_20%,#54316f,transparent_60%),linear-gradient(115deg,#181121,#302039)] sm:h-60">
    {profile.cover?<img src={profile.cover} alt="Capa da empresa" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center"><ImageIcon size={54} className="text-white/15"/></div>}
    <div className="absolute inset-0 bg-gradient-to-t from-[#18121f] via-transparent to-transparent"/>
    <button type="button" onClick={openEditor} aria-haspopup="dialog" className="absolute right-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-[#c4ff40] bg-[#110d18]/90 px-4 py-2.5 text-sm font-bold text-[#c4ff40] shadow-lg backdrop-blur"><Pencil size={16}/> Editar</button>
   </div>
   <div className="relative px-4 pb-6 pt-3 sm:px-6">
    <div className="flex items-end gap-4">
     <div className="-mt-12 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-[#18121f] bg-[#22172f] text-[#c4ff40] shadow-xl sm:h-28 sm:w-28">
      {profile.logo?<img src={profile.logo} alt="Logotipo da Submundo 808" className="h-full w-full object-cover"/>:<Building2 size={38}/>}
     </div>
     <div className="min-w-0 pb-1"><p className="text-[11px] font-bold uppercase tracking-widest text-[#c4ff40]">Perfil da empresa</p><h3 className="mt-1 text-xl font-black sm:text-2xl">Submundo 808</h3><p className="mt-1 text-sm text-white/60">Identidade e informações oficiais do aplicativo</p></div>
    </div>
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4 text-xs text-white/65">
     <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2"><span className="h-3 w-3 rounded-full border border-white/20" style={{backgroundColor:profile.color}}/> Cor da marca: {profile.color.toUpperCase()}</span>
     <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2"><ShieldCheck size={14} className="text-[#c4ff40]"/> Regras gerais dos eventos</span>
    </div>
   </div>
  </section>

  <div className="grid gap-4 lg:grid-cols-2">
   <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5">
    <h3 className="flex items-center gap-2 font-bold"><Phone size={18} className="text-[#c4ff40]"/> Contato oficial</h3>
    <div><p className="text-xs text-white/50">Nome de contato</p><p className="mt-1 text-sm font-semibold">{brief(profile.settings.contact_name)}</p></div>
    <div><p className="text-xs text-white/50">WhatsApp / Telefone</p><p className="mt-1 text-sm font-semibold">{phone?formatMobile(phone):'Não informado'}</p></div>
    {phone&&<a href={'https://wa.me/55'+phone} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-[#c4ff40]"><Mail size={14}/> Abrir WhatsApp</a>}
   </section>
   <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5">
    <h3 className="flex items-center gap-2 font-bold"><Palette size={18} className="text-[#c4ff40]"/> Identidade visual</h3>
    <div className="flex items-center gap-3">
     <div className="h-12 w-12 shrink-0 rounded-xl border border-white/20" style={{backgroundColor:profile.color}}/>
     <div><p className="text-sm font-semibold">Cor principal do aplicativo</p><p className="mt-1 text-xs text-white/55">{profile.color.toUpperCase()}</p></div>
    </div>
    <p className="text-xs text-white/55">A cor é aplicada aos destaques, botões e seleções do aplicativo.</p>
   </section>
  </div>

  <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5">
   <div className="flex items-center gap-2"><FileText size={18} className="text-[#c4ff40]"/><h3 className="font-bold">Regras gerais dos eventos</h3></div>
   <p className="text-xs text-white/55">Estas regras valem para os eventos da empresa. Informações específicas de um local ou festa permanecem nos cadastros correspondentes.</p>
   <div className="grid gap-4 md:grid-cols-2">
    <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-white/50">Classificação etária mínima</p><p className="mt-1 text-lg font-black">{age} anos</p></div>
    {([
     ['entry_rules','Regras de entrada'],
     ['accepted_documents','Documentos aceitos'],
     ['cancellation_policy','Política de cancelamento']
    ] as const).map(([field,label])=><div key={field} className="rounded-xl border border-white/10 p-3">
     <p className="text-xs font-semibold text-white/65">{label}</p>
     <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-white/80">{brief(profile.settings[field])}</p>
    </div>)}
   </div>
  </section>

  {editOpen&&draft&&<div role="presentation" className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-2 sm:p-5" onMouseDown={event=>{if(event.target===event.currentTarget)closeEditor();}}>
   <form role="dialog" aria-modal="true" aria-labelledby="company-profile-editor-title" onSubmit={event=>void save(event)} className="flex max-h-[96dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#c4ff40]/30 bg-[#1a1421] shadow-2xl sm:max-h-[92dvh]">
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 p-4 sm:px-6">
     <div><h3 id="company-profile-editor-title" className="text-lg font-black">Editar perfil da empresa</h3><p className="mt-1 text-xs text-white/55">Atualize a identidade visual, o contato e as regras gerais.</p></div>
     <button type="button" disabled={busy||imageBusy} aria-label="Fechar edição da empresa" onClick={closeEditor} className="rounded-lg border border-white/20 p-2 disabled:opacity-40"><X size={19}/></button>
    </header>
    <nav aria-label="Seções do perfil empresarial" className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 px-3 py-3 sm:px-6">
     {tabs.map(([key,label,Icon])=><button type="button" key={key} onClick={()=>setTab(key)} aria-current={tab===key?'page':undefined} className={'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold '+(tab===key?'bg-[#c4ff40] text-black':'border border-white/20 text-white/75')}><Icon size={15}/>{label}</button>)}
    </nav>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
     {tab==='identity'&&<section className="space-y-5">
      <div className="space-y-3"><h4 className="font-bold">Capa da empresa</h4>
       <div className="h-40 overflow-hidden rounded-xl border border-white/15 bg-[linear-gradient(120deg,#23152c,#51316e)]">
        {draft.cover?<img src={draft.cover} alt="Prévia da capa" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center gap-2 text-sm text-white/45"><ImageIcon size={20}/> Sem capa cadastrada</div>}
       </div>
       <div className="flex flex-wrap items-center gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-bold"><Camera size={15}/>{imageBusy?'Processando...':'Escolher capa'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy||imageBusy} className="sr-only" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void uploadImage(file,'cover');}}/></label>
        {draft.cover&&<button type="button" disabled={busy||imageBusy} onClick={()=>setDraft(old=>old?{...old,cover:''}:old)} className="text-xs text-red-300 underline">Remover capa</button>}</div>
      </div>
      <div className="space-y-3"><h4 className="font-bold">Logotipo do aplicativo</h4>
       <div className="flex items-center gap-4">{draft.logo?<img src={draft.logo} alt="Prévia do logotipo" className="h-20 w-20 rounded-2xl border border-white/20 object-cover"/>:<div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/[.04]"><Building2 size={30} className="text-white/40"/></div>}
        <div className="space-y-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-bold"><Camera size={15}/> Escolher logotipo<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy||imageBusy} className="sr-only" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void uploadImage(file,'logo');}}/></label>
         {draft.logo&&<button type="button" disabled={busy||imageBusy} onClick={()=>setDraft(old=>old?{...old,logo:''}:old)} className="block text-xs text-red-300 underline">Remover logotipo</button>}</div>
       </div>
       <p className="text-xs text-white/55">O logotipo continua sendo exibido no cabeçalho do aplicativo. O envio converte e compacta as imagens automaticamente.</p>
      </div>
      <div className="space-y-3"><h4 className="font-bold">Cor principal</h4>
       <div className="flex flex-wrap items-center gap-3">
        <input type="color" aria-label="Selecionar cor principal" value={validColor(draft.color)?draft.color:DEFAULT_COLOR} onChange={event=>setDraft(old=>old?{...old,color:event.target.value}:old)} className="h-12 w-16 cursor-pointer rounded-lg border border-white/20 bg-transparent p-1"/>
        <input aria-label="Código hexadecimal da cor principal" maxLength={7} value={draft.color} onChange={event=>setDraft(old=>old?{...old,color:event.target.value}:old)} className={input+' max-w-40'}/>
        <button type="button" onClick={()=>setDraft(old=>old?{...old,color:DEFAULT_COLOR}:old)} className="rounded-lg border border-white/20 px-3 py-2 text-xs">Restaurar verde</button>
       </div>
       <div className="flex flex-wrap gap-2">{swatches.map(([label,color])=><button type="button" key={color} aria-label={'Escolher '+label} title={label} onClick={()=>setDraft(old=>old?{...old,color}:old)} className="h-9 w-9 rounded-full border-2 border-white/40" style={{backgroundColor:color,outline:draft.color.toLowerCase()===color?'2px solid white':'none',outlineOffset:2}}/>)}</div>
       {validColor(draft.color)&&<div className="flex items-center gap-3 rounded-xl border border-white/10 p-3"><div className="rounded-lg px-3 py-2 text-xs font-bold" style={{backgroundColor:draft.color,color:accentTextColor(draft.color)}}>Prévia do botão</div><p className="text-xs text-white/55">Contraste {contrastRatio(draft.color,accentTextColor(draft.color)).toFixed(1)}:1 · destaque {readableAccentOnDark(draft.color)}</p></div>}
      </div>
     </section>}
     {tab==='contact'&&<section className="space-y-4">
      <p className="text-sm text-white/60">Este contato é exibido nos eventos para ligar, copiar ou abrir o WhatsApp.</p>
      <label className="block space-y-2 text-sm font-semibold text-white/75">Nome do contato oficial<input maxLength={100} value={draft.settings.contact_name} onChange={event=>changeSettings({contact_name:event.target.value})} placeholder="Submundo 808" className={input}/></label>
      <label className="block space-y-2 text-sm font-semibold text-white/75">Celular / WhatsApp com DDD<input type="tel" inputMode="numeric" maxLength={15} value={formatMobile(draft.settings.contact_phone)} onChange={event=>changeSettings({contact_phone:event.target.value.replace(/\D/g,'').slice(0,11)})} placeholder="(11) 99999-9999" className={input}/></label>
      <p className="text-xs text-white/55">Deixe o telefone vazio para ocultar as ações de contato nos eventos.</p>
     </section>}
     {tab==='rules'&&<section className="space-y-4">
      <p className="text-sm text-white/60">As regras abaixo são compartilhadas pelos eventos. Ajustes específicos devem ficar no cadastro de cada evento.</p>
      <label className="block space-y-2 text-sm font-semibold text-white/75">Classificação etária mínima<input type="number" min={0} max={100} required value={draft.settings.minimum_age} onChange={event=>changeSettings({minimum_age:Number(event.target.value)})} className={input}/></label>
      {([
       ['entry_rules','Regras de entrada e itens proibidos'],
       ['accepted_documents','Documentos aceitos'],
       ['cancellation_policy','Política de cancelamento']
      ] as const).map(([field,label])=><label key={field} className="block space-y-2 text-sm font-semibold text-white/75">{label}<textarea rows={5} maxLength={5000} value={draft.settings[field]} onChange={event=>changeSettings({[field]:event.target.value})} className={input+' min-h-28 resize-y'} placeholder="Uma regra por linha"/></label>)}
     </section>}
     {error&&<p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-300">{error}</p>}
    </div>
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4 sm:px-6">
     <p className="text-xs text-white/45">{imageBusy?'Processando imagem...':dirty?'Há alterações não salvas':'Nenhuma alteração pendente'}</p>
     <div className="flex flex-wrap gap-2"><button type="button" disabled={busy||imageBusy} onClick={closeEditor} className="rounded-xl border border-white/20 px-4 py-3 text-sm disabled:opacity-40">Cancelar</button><button type="submit" disabled={busy||imageBusy||!dirty} className="inline-flex items-center gap-2 rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-bold text-black disabled:opacity-40"><Check size={17}/>{busy?'Salvando...':'Salvar alterações'}</button></div>
    </footer>
   </form>
   {confirmDiscard&&<div role="presentation" className="fixed inset-0 z-[145] flex items-center justify-center bg-black/90 p-3">
    <div role="alertdialog" aria-modal="true" aria-labelledby="discard-company-profile-title" className="w-full max-w-sm space-y-4 rounded-2xl border border-amber-400/30 bg-[#211729] p-5 shadow-2xl">
     <h3 id="discard-company-profile-title" className="text-lg font-black">Descartar alterações?</h3>
     <p className="text-sm leading-relaxed text-white/70">Você alterou informações do perfil da empresa e ainda não salvou. Para não perder os dados, escolha Continuar editando.</p>
     <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" autoFocus onClick={()=>setConfirmDiscard(false)} className="rounded-lg border border-white/20 px-4 py-2.5 text-sm">Continuar editando</button><button type="button" onClick={discardEditor} className="rounded-lg border border-amber-400/40 px-4 py-2.5 text-sm font-bold text-amber-200">Descartar</button></div>
    </div>
   </div>}
  </div>}
 </div>;
}
