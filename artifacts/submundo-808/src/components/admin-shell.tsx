import {venueLocation,completeVenueAddress} from '../venue-address';
import {formatMobile} from './phone-mask';
import {applyAccentColor,DEFAULT_COLOR} from '../theme-accent';
import {accentTextColor,contrastRatio,readableAccentOnDark} from '../accent-contrast';
import AdminProducts from './admin-products';
import {AdminReviews,AdminNotifications} from './admin-engagement';
import NotFound from '../pages/not-found';
import {ErrorBoundary} from './error-boundary';
import { useEffect, useState } from 'react';
import { EventEditor } from './admin-editors';
import AdminMapWorkspace from './admin-map-workspace';
import AdminVenueMaps from './admin-venue-maps';
import AdminEventList from './admin-event-list';
import AdminCrowd from './admin-crowd';
import PageLoading from './page-loading';
import {displayLabel} from './display-label';
import useMinimumLoading from './use-minimum-loading';
import {adminRoutePath,parseAdminRoute,type AdminRoute,type AdminSection} from './admin-route';
import { Building2, CalendarDays, Map, LayoutDashboard, ArrowLeft, Plus, Pencil, Trash2, Users, ShoppingBag, Star, Bell, Menu, X } from 'lucide-react';
type Item={id:string;name:string;venue_id?:string;city?:string;address?:string;postal_code?:string;street?:string;neighborhood?:string;complement?:string;address_url?:string;services?:string;starts_at?:string;ends_at?:string;map_ids?:string[];lineup?:unknown[];location_sharing_enabled?:number};
type User={id:string;name:string;email:string;isAdmin?:boolean};
const input='w-full rounded-xl border border-white/20 bg-[#241b2c] p-3 text-sm text-white placeholder:text-white/40';
async function api(key:string,data?:object){const r=await fetch('/api/admin/'+key,{method:data?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});const j=await r.json();if(!r.ok)throw Error(j.error||'Erro ao salvar');return j;}
export default function AdminShell(){
 const [brandLogo,setBrandLogo]=useState(''),[brandMessage,setBrandMessage]=useState('');
 const [accentColor,setAccentColor]=useState(DEFAULT_COLOR),[accentStatus,setAccentStatus]=useState(''),[accentSaving,setAccentSaving]=useState(false);
 const [settings,setSettings]=useState({minimum_age:18,entry_rules:'',accepted_documents:'',cancellation_policy:'',contact_name:'Submundo 808',contact_phone:''}),[settingsNotice,setSettingsNotice]=useState('');
 const [venueTab,setVenueTab]=useState<'maps'|'info'|'events'>(window.location.pathname.includes('/events/')||window.location.pathname.endsWith('/analytics')?'events':'info');
 const [currentPath,setCurrentPath]=useState(window.location.pathname);
 const [navOpen,setNavOpen]=useState(false);
 const [exampleOpen,setExampleOpen]=useState(false);
 const [confirmDelete,setConfirmDelete]=useState<{id:string;name:string;entity:string}|null>(null);
 const [user,setUser]=useState<User|null|undefined>(undefined),[route,setRoute]=useState<AdminRoute>(()=>parseAdminRoute(window.location.pathname)),[listsLoaded,setListsLoaded]=useState(false),[loadFailed,setLoadFailed]=useState(false);
 const [venues,setVenues]=useState<Item[]>([]),[maps,setMaps]=useState<Item[]>([]),[events,setEvents]=useState<Item[]>([]),[stats,setStats]=useState({totalUsers:0,activeUsers:0,sharingNow:0});
 const [name,setName]=useState(''),[address,setAddress]=useState(''),[city,setCity]=useState(''),[postalCode,setPostalCode]=useState(''),[street,setStreet]=useState(''),[neighborhood,setNeighborhood]=useState(''),[complement,setComplement]=useState(''),[addressUrl,setAddressUrl]=useState(''),[services,setServices]=useState(''),[venueSearch,setVenueSearch]=useState(''),[filteredVenues,setFilteredVenues]=useState<Item[]|null>(null),[searchBusy,setSearchBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);

 const section=route.section,creating=route.creating;
 const editing=(section==='Estabelecimentos'?venues:section==='Eventos'?events:[]).find(item=>item.id===route.id)||null;
 const openedMap=route.mapId?maps.find(item=>item.id===route.mapId&&item.venue_id===route.id):null;
 const venueEvents=events.filter(item=>item.venue_id===route.id);
 const selectedVenueEvent=route.eventId?venueEvents.find(item=>item.id===route.eventId):null;
 const sections:{name:AdminSection;Icon:typeof LayoutDashboard}[]=[{name:'Visão geral',Icon:LayoutDashboard},{name:'Estabelecimentos',Icon:Building2},{name:'Eventos',Icon:CalendarDays},{name:'Produtos',Icon:ShoppingBag},{name:'Avaliações',Icon:Star},{name:'Notificações',Icon:Bell},{name:'Preferências',Icon:Pencil}];
 async function reload(){const [v,m,e,o]=await Promise.all([api('venues'),api('maps'),api('events'),api('overview')]);setVenues(v.items);setMaps(m.items);setEvents(e.items);setStats(o);}
 useEffect(()=>{void api('event-settings').then(j=>setSettings(j.settings)).catch(()=>{});void api('branding').then(j=>{setBrandLogo(j.logo||'');setAccentColor(j.color||DEFAULT_COLOR);}).catch(()=>{});},[]);
 useEffect(()=>{let alive=true;fetch('/api/auth/me',{credentials:'same-origin'}).then(r=>r.json()).then(j=>{if(!alive)return;setUser(j.user);if(j.user?.isAdmin)void reload().catch(e=>{if(alive){setError(String(e));setLoadFailed(true);}}).finally(()=>{if(alive)setListsLoaded(true);});else setListsLoaded(true);}).catch(()=>{if(alive){setUser(null);setListsLoaded(true);}});return()=>{alive=false;};},[]);
 useEffect(()=>{const onPop=()=>{setNavOpen(false);setCurrentPath(window.location.pathname);setRoute(parseAdminRoute(window.location.pathname));setVenueTab(window.location.pathname.includes('/events/')||window.location.pathname.endsWith('/analytics')?'events':'info');setError('');setConfirmDelete(null);};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);},[]);
 useEffect(()=>{
  if(!navOpen)return;
  const onEscape=(e:KeyboardEvent)=>{if(e.key==='Escape')setNavOpen(false);};
  document.addEventListener('keydown',onEscape);
  return()=>document.removeEventListener('keydown',onEscape);
 },[navOpen]);
 useEffect(()=>{const location=venueLocation(editing);setName(editing?.name||'');setAddress(editing?.address||'');setCity(editing?.city||'');setPostalCode(location.postalCode);setStreet(location.street);setNeighborhood(location.neighborhood);setComplement(editing?.complement||'');setAddressUrl(editing?.address_url||'');setServices(editing?.services||'');},[section,route.id,route.creating,editing?.id]);
 useEffect(()=>{if(section!=='Visão geral'||!user?.isAdmin)return;const t=setInterval(()=>void api('overview').then(setStats).catch(()=>{}),30000);return ()=>clearInterval(t);},[section,user?.isAdmin]);
 // Preserve old /mapas/:id bookmarks while removing the standalone menu.
 useEffect(()=>{
  if(section!=='Mapas e ambientes'||!listsLoaded)return;
  const map=maps.find(item=>item.id===route.id);
  const next:AdminRoute=map?.venue_id
   ?{section:'Estabelecimentos',id:map.venue_id,creating:false,mapId:map.id}
   :{section:'Estabelecimentos',id:null,creating:false};
  const path=adminRoutePath(next);
  window.history.replaceState({},'',path);
  setRoute(next);
 },[section,route.id,listsLoaded,maps]);
 useEffect(()=>{
   if(section!=='Inteligência')return;
   const next:AdminRoute={section:'Estabelecimentos',id:null,creating:false};
   const path=adminRoutePath(next);
   window.history.replaceState({},'',path);
   setCurrentPath(path);setRoute(next);
  },[section]);
  useEffect(()=>{if(section!=='Estabelecimentos'||creating||route.id){setFilteredVenues(null);return;}let alive=true;const controller=new AbortController();const timer=setTimeout(()=>{setSearchBusy(true);fetch('/api/admin/search-venues?q='+encodeURIComponent(venueSearch),{credentials:'same-origin',signal:controller.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Falha na busca');return j;}).then(j=>{if(alive)setFilteredVenues(j.items);}).catch(e=>{if(alive&&e.name!=='AbortError')setError(String(e));}).finally(()=>{if(alive)setSearchBusy(false);});},250);return()=>{alive=false;controller.abort();clearTimeout(timer);};},[venueSearch,section,creating,route.id,venues]);
 function go(next:AdminRoute){setNavOpen(false);setExampleOpen(false);const path=adminRoutePath(next);setCurrentPath(path);if(next.section==='Estabelecimentos'){if(next.analytics||next.eventId)setVenueTab('events');else if(next.id!==route.id)setVenueTab('info');}if(window.location.pathname!==path)window.history.pushState({},'',path);setRoute(next);setError('');setNotice('');setConfirmDelete(null);}
 function navigate(next:AdminSection){go({section:next,id:null,creating:false});}
 function edit(item:Item){go({section,id:item.id,creating:false});}
 function back(){
  if(route.eventId){go({section:'Estabelecimentos',id:route.id,creating:false});setVenueTab('events');return;}
  if(route.mapId){go({section:'Estabelecimentos',id:route.id,creating:false});setVenueTab('maps');return;}
  go({section,id:null,creating:false});
 }
 function openMap(mapId:string){if(!route.id)return;go({section:'Estabelecimentos',id:route.id,creating:false,mapId});}

 async function removeConfirmed(){
  if(!confirmDelete)return;
  const item=confirmDelete;
  setBusy(true);setError('');
  try{
   await api('delete',{id:item.id,entity:item.entity});
   setConfirmDelete(null);await reload();
   if((item.entity==='venue'&&route.id===item.id)||(item.entity==='map'&&route.mapId===item.id)||(item.entity==='event'&&route.id===item.id))back();
  }catch(e){setError(e instanceof Error?e.message:'Erro ao excluir');setConfirmDelete(null);}
  finally{setBusy(false);}
 }
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(section!=='Estabelecimentos')return;
   const response=await api(editing?'edit-venue':'venues',{id:editing?.id,name,address:completeVenueAddress(street,neighborhood,city,postalCode,address),city,postal_code:postalCode,street,neighborhood,complement,address_url:addressUrl,services});
   await reload();
   if(!editing&&response.id)go({section:'Estabelecimentos',id:response.id,creating:false});
   else setNotice('Estabelecimento atualizado com sucesso.');
  }catch(e){setError(e instanceof Error?e.message:'Erro ao salvar');}
  finally{setBusy(false);}
 }
 const pathParts=currentPath.split('/').filter(Boolean);
 const knownAdminRoute=(pathParts.length===5&&['venues','estabelecimentos'].includes(pathParts[0])&&pathParts[2]==='events'&&pathParts[4]==='analysis'&&!!pathParts[1]&&!!pathParts[3])||pathParts.length===0||(pathParts.length===3&&['venues','estabelecimentos'].includes(pathParts[0])&&pathParts[2]==='analytics'&&!!pathParts[1])||(pathParts.length===1&&['venues','events','products','maps','preferences','reviews','notifications','intelligence','inteligencia','estabelecimentos','eventos','produtos','mapas'].includes(pathParts[0]))||(pathParts.length===2&&['venues','events','maps','estabelecimentos','eventos','mapas'].includes(pathParts[0])&&!!pathParts[1])||(pathParts.length===4&&['venues','estabelecimentos'].includes(pathParts[0])&&['maps','mapas'].includes(pathParts[2])&&!!pathParts[1]&&!!pathParts[3]);
 const showLoading=useMinimumLoading(user===undefined||(!!user?.isAdmin&&!listsLoaded));
 if(showLoading)return <div className="flex min-h-dvh items-center justify-center bg-[#0b090f] p-5 text-white"><div className="w-full max-w-md"><PageLoading label="Carregando painel administrativo" description="Validando suas permissões e preparando os dados do painel."/></div></div>;
 if(user?.isAdmin&&loadFailed)return <div className="flex min-h-dvh items-center justify-center bg-[#0b090f] p-5 text-white"><div role="alert" className="w-full max-w-md rounded-2xl border border-red-400/25 bg-red-400/5 p-6 text-center"><p className="font-bold text-red-200">Não foi possível carregar o painel.</p><p className="mt-2 text-xs text-white/60">{error}</p><button onClick={()=>{setListsLoaded(false);setLoadFailed(false);setError('');void reload().catch(e=>{setError(String(e));setLoadFailed(true);}).finally(()=>setListsLoaded(true));}} className="mt-4 rounded-xl bg-[#c4ff40] px-4 py-2 text-sm font-bold text-black">Tentar novamente</button></div></div>;
 if(!user?.isAdmin)return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0b090f] p-6 text-center text-white"><h1 className="text-2xl font-black">Painel administrativo</h1><p className="text-white/60">{user?'Sua conta não possui permissão de administrador.':'Faça login no Submundo 808 para acessar o painel.'}</p><a href="https://submundo.menudevendas.com.br/profile" className="rounded-xl bg-[#c4ff40] px-5 py-3 font-bold text-black">Ir para meu perfil</a></div>;
 return <div className="min-h-dvh min-w-0 bg-[#0b090f] text-white xl:flex">
  <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-[#17101e]/95 px-4 py-3 backdrop-blur-xl xl:hidden">
   <div className="min-w-0">
    <p className="text-sm font-black tracking-wide">SUBMUNDO <span className="text-[#c4ff40]">ADMIN</span></p>
    <p className="truncate text-xs text-white/60">{section}</p>
   </div>
   <button type="button" aria-label="Abrir menu administrativo" aria-controls="submundo-admin-sidebar" aria-expanded={navOpen} onClick={()=>setNavOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 text-white"><Menu size={22}/></button>
  </header>
  {navOpen&&<button type="button" aria-label="Fechar menu administrativo" onClick={()=>setNavOpen(false)} className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm xl:hidden"/>}
  <aside id="submundo-admin-sidebar" className={'fixed inset-y-0 left-0 z-50 flex w-[min(85vw,18rem)] flex-col overflow-y-auto border-r border-white/10 bg-[#17101e] p-5 shadow-2xl transition-transform duration-200 xl:sticky xl:top-0 xl:z-auto xl:h-dvh xl:w-64 xl:shrink-0 xl:translate-x-0 xl:shadow-none '+(navOpen?'visible translate-x-0':'invisible -translate-x-full xl:visible')}>
   <div className="mb-5 flex items-center justify-between gap-2">
    <h1 className="text-xl font-black">SUBMUNDO <span className="text-[#c4ff40]">ADMIN</span></h1>
    <button type="button" aria-label="Fechar navegação" onClick={()=>setNavOpen(false)} className="rounded-lg border border-white/20 p-2 xl:hidden"><X size={18}/></button>
   </div>
   <nav aria-label="Seções administrativas" className="flex flex-col gap-1">
    {sections.map(({name:label,Icon})=><button key={label} type="button" onClick={()=>navigate(label)} aria-current={section===label?'page':undefined} className={'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors '+(section===label?'bg-[#c4ff40] font-bold text-black':'text-white/70 hover:bg-white/10')}><Icon size={17}/>{label}</button>)}
   </nav>
   <a className="mt-auto flex items-center gap-2 border-t border-white/10 pt-5 text-sm text-white/60" href="https://submundo.menudevendas.com.br/profile"><ArrowLeft size={16}/> Acessar visão do usuário</a>
  </aside>
  <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-5 sm:px-6 xl:px-10 xl:py-10">
 {!knownAdminRoute?<NotFound/>:<ErrorBoundary resetKey={currentPath} FallbackComponent={({resetError})=><NotFound status={500} onRetry={resetError}/>}>
 {route.id&&!editing?<NotFound/>:route.eventId&&!selectedVenueEvent?<NotFound/>:route.mapId&&!openedMap?<NotFound/>:openedMap?<AdminMapWorkspace key={openedMap.id} map={openedMap as Item & {venue_id:string}} onBack={back}/>:<>
 {(editing||creating)&&<button onClick={back} className="mb-5 flex items-center gap-2 text-sm text-white/60"><ArrowLeft size={16}/> Voltar</button>}
 <p className="mb-2 text-xs uppercase tracking-widest text-[#c4ff40]">Painel administrativo</p><h2 className="text-3xl font-black">{editing&&section==='Estabelecimentos'?displayLabel(editing.name):editing?'Editar evento':creating?'Criar '+(section==='Estabelecimentos'?'estabelecimento':'evento'):section}</h2><p className="mt-2 text-sm text-white/50">Olá, {user.name}</p>
 {section==='Produtos'&&<AdminProducts/>}
 {section==='Avaliações'&&<AdminReviews events={events}/>}
 {section==='Notificações'&&<AdminNotifications events={events}/>}
 {section==='Preferências'&&<form onSubmit={async e=>{e.preventDefault();setSettingsNotice('');try{await api('event-settings',settings);setSettingsNotice('Preferências salvas. As regras serão exibidas nos eventos publicados.');}catch(e){setSettingsNotice(e instanceof Error?e.message:'Erro ao salvar preferências.');}}} className="mt-6 max-w-3xl space-y-4 rounded-2xl border border-white/10 bg-white/[.04] p-5">
  <div className="space-y-3 rounded-xl border border-white/10 p-4"><h3 className="font-bold">Identidade visual</h3><div className="mt-4 space-y-3 border-t border-white/10 pt-4"><h4 className="text-sm font-bold">Cor principal do aplicativo</h4><p className="text-xs text-white/60">Altera os destaques, botões, bordas e seleções de todas as telas (participantes e administração). A cor fica salva mesmo após reiniciar.</p><div className="flex flex-wrap items-center gap-3"><input aria-label="Selecionar cor do aplicativo" type="color" value={accentColor} onChange={e=>{setAccentColor(e.target.value);applyAccentColor(e.target.value);}} className="h-12 w-16 cursor-pointer rounded-lg border border-white/20 bg-transparent p-1"/><input aria-label="Código hexadecimal da cor" className={input+' max-w-36'} value={accentColor} maxLength={7} onChange={e=>{setAccentColor(e.target.value);if(/^#[0-9a-fA-F]{6}$/.test(e.target.value))applyAccentColor(e.target.value);}}/><button type="button" onClick={()=>{setAccentColor(DEFAULT_COLOR);applyAccentColor(DEFAULT_COLOR);}} className="rounded-xl border border-white/20 px-3 py-2 text-xs">Restaurar verde</button></div><div className="flex flex-wrap gap-2">{[['Verde','#c4ff40'],['Roxo','#a855f7'],['Vermelho','#ef4444'],['Azul','#3b82f6'],['Rosa','#ec4899'],['Laranja','#fb923c']] .map(([label,color])=><button type="button" key={color} title={label} aria-label={'Escolher '+label} onClick={()=>{setAccentColor(color);applyAccentColor(color);}} className="h-9 w-9 rounded-full border-2 border-white/40 transition hover:scale-110" style={{backgroundColor:color,outline:accentColor===color?'2px solid white':'none',outlineOffset:2}}/> )}</div><button type="button" disabled={accentSaving||!/^#[0-9a-fA-F]{6}$/.test(accentColor)} onClick={async()=>{setAccentSaving(true);setAccentStatus('');try{const j=await api('accent-color',{color:accentColor});applyAccentColor(j.color);setAccentStatus('Cor salva para todo o aplicativo.');}catch(e){setAccentStatus('Não foi possível salvar a cor.');}finally{setAccentSaving(false);}}} className="rounded-xl bg-[#c4ff40] px-5 py-3 text-sm font-bold text-black disabled:opacity-50">{accentSaving?'Salvando...':'Salvar cor do aplicativo'}</button><p className="text-xs text-white/65" role="status">Contraste automático: {/^#[0-9a-fA-F]{6}$/.test(accentColor)?contrastRatio(accentColor,accentTextColor(accentColor)).toFixed(1)+' : 1 no botão · '+contrastRatio(readableAccentOnDark(accentColor),'#0b090f').toFixed(1)+' : 1 nos destaques':'informe uma cor hexadecimal válida'}. Os textos e destaques se adaptam sem alterar a cor escolhida para os fundos.</p>{accentStatus&&<p role="status" className="text-xs text-white/70">{accentStatus}</p>}</div><p className="text-xs text-white/60">Escolha a imagem que aparecerá junto ao nome Submundo 808 no cabeçalho. Sem imagem, será exibido apenas o nome.</p><div className="flex items-center gap-3">{brandLogo&&<img src={brandLogo} alt="Logo atual" className="h-14 w-14 rounded-xl object-cover"/>}<label className="flex-1 space-y-1 text-xs">Imagem do cabeçalho<input type="file" accept="image/png,image/jpeg,image/webp" className={input} onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>4_000_000){setBrandMessage('Selecione uma imagem de até 4 MB.');return;}const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const context=canvas.getContext('2d');if(!context)return;context.drawImage(image,0,0,128,128);URL.revokeObjectURL(url);const data=canvas.toDataURL('image/webp',.75);void api('branding',{logo:data}).then(()=>{setBrandLogo(data);setBrandMessage('Imagem do cabeçalho atualizada.');}).catch(err=>setBrandMessage(String(err)));};image.onerror=()=>{URL.revokeObjectURL(url);setBrandMessage('Imagem inválida.');};image.src=url;}}/></label></div>{brandLogo&&<button type="button" className="text-xs text-red-300 underline" onClick={()=>void api('branding',{logo:''}).then(()=>{setBrandLogo('');setBrandMessage('Imagem removida.');}).catch(err=>setBrandMessage(String(err)))}>Remover imagem</button>}{brandMessage&&<p role="status" className="text-xs text-[#c4ff40]">{brandMessage}</p>}</div>
  <h3 className="text-lg font-bold">Regras gerais de todos os eventos</h3><p className="text-xs text-white/60">Configuradas uma única vez. Serviços que variam por local ou festa devem ficar no cadastro correspondente.</p>
  <div className="space-y-3 rounded-xl border border-white/10 p-4"><h3 className="font-bold">Contato oficial da Submundo</h3><p className="text-xs text-white/55">Aparece nos eventos publicados para copiar, ligar ou chamar no WhatsApp. Deixe o telefone vazio para ocultar essas ações.</p><label className="block space-y-1 text-xs">Nome do contato<input className={input} value={settings.contact_name} onChange={e=>setSettings(v=>({...v,contact_name:e.target.value}))} placeholder="Submundo 808"/></label><label className="block space-y-1 text-xs">Celular / WhatsApp com DDD<input className={input} type="tel" inputMode="numeric" maxLength={15} placeholder="(11) 99999-9999" value={formatMobile(settings.contact_phone)} onChange={e=>{const digits=e.target.value.replace(/\D/g,'').slice(0,11);setSettings(v=>({...v,contact_phone:digits}));}}/></label></div>
  <label className="block space-y-1 text-xs">Classificação etária mínima<input type="number" min={0} max={100} value={settings.minimum_age} onChange={e=>setSettings(v=>({...v,minimum_age:Number(e.target.value)}))} className={input}/></label>
  {([['entry_rules','Regras de entrada e itens proibidos'],['accepted_documents','Documentos aceitos'],['cancellation_policy','Política de cancelamento']] as const).map(([field,label])=><label key={field} className="block space-y-1 text-xs">{label}<textarea rows={5} maxLength={5000} value={settings[field]} onChange={e=>setSettings(v=>({...v,[field]:e.target.value}))} className={input} placeholder="Uma regra por linha"/></label>)}
  <button type="submit" className="rounded-xl bg-[#c4ff40] px-5 py-3 text-sm font-bold text-black">Salvar preferências</button>{settingsNotice&&<p role="status" className="text-sm text-[#c4ff40]">{settingsNotice}</p>}
 </form>}

 {section==='Visão geral'&&<div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[{label:'Usuários ativos (últimos 15 min)',count:stats.activeUsers,Icon:Users},{label:'Usuários cadastrados',count:stats.totalUsers,Icon:Users},{label:'Compartilhando localização agora',count:stats.sharingNow,Icon:Users},{label:'Estabelecimentos',count:venues.length,Icon:Building2},{label:'Mapas',count:maps.length,Icon:Map},{label:'Eventos',count:events.length,Icon:CalendarDays}].map(({label,count,Icon})=><div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5"><Icon size={20} className="text-[#c4ff40]"/><p className="mt-3 text-sm text-white/60">{label}</p><p className="mt-2 text-3xl font-black text-[#c4ff40]">{count}</p></div>)}</div>}

 
 {section==='Estabelecimentos'&&(editing||creating?
 <div className="mt-8 space-y-5">
  {editing&&<div role="tablist" aria-label="Seções do estabelecimento" className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
   <button type="button" role="tab" aria-selected={venueTab==='info'} onClick={()=>{go({section:'Estabelecimentos',id:editing.id,creating:false});setVenueTab('info');}} className={'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold '+(venueTab==='info'?'bg-[#c4ff40] text-black':'border border-white/15 text-white/70')}><Pencil size={16}/> Dados do estabelecimento</button>
   <button type="button" role="tab" aria-selected={venueTab==='maps'} onClick={()=>{go({section:'Estabelecimentos',id:editing.id,creating:false});setVenueTab('maps');}} className={'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold '+(venueTab==='maps'?'bg-[#c4ff40] text-black':'border border-white/15 text-white/70')}><Map size={16}/> Plantas do local ({maps.filter(map=>map.venue_id===editing.id).length})</button>
    <button type="button" role="tab" aria-selected={venueTab==='events'} onClick={()=>{go({section:'Estabelecimentos',id:editing.id,creating:false});setVenueTab('events');}} className={'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold '+(venueTab==='events'?'bg-[#c4ff40] text-black':'border border-white/15 text-white/70')}><CalendarDays size={16}/> Eventos ({events.filter(event=>event.venue_id===editing.id).length})</button>
  </div>}
  <div role="tabpanel" className={venueTab==='events'?'w-full':'max-w-3xl'}>
   {(!editing||venueTab==='info')&&<form onSubmit={save} className="h-fit space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
    <h3 className="font-bold">{editing?'Dados do estabelecimento':'Cadastrar estabelecimento'}</h3>
    <label className="block space-y-1 text-xs text-white/60">Nome<input required maxLength={100} placeholder="Nome do estabelecimento" value={name} onChange={e=>setName(e.target.value)} className={input}/></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1 text-xs text-white/60">CEP<input value={postalCode} onChange={e=>setPostalCode(e.target.value)} placeholder="00000-000" maxLength={12} className={input}/></label><label className="block space-y-1 text-xs text-white/60">Rua e número<input value={street} onChange={e=>setStreet(e.target.value)} placeholder="Rua, avenida e número" className={input}/></label><label className="block space-y-1 text-xs text-white/60">Bairro<input value={neighborhood} onChange={e=>setNeighborhood(e.target.value)} className={input}/></label><label className="block space-y-1 text-xs text-white/60">Complemento<input value={complement} onChange={e=>setComplement(e.target.value)} placeholder="Bloco, sala, referência..." className={input}/></label></div><label className="block space-y-1 text-xs text-white/60">Link de localização<input type="url" value={addressUrl} onChange={e=>setAddressUrl(e.target.value)} placeholder="https://maps.google.com/..." className={input}/></label>
    <label className="block space-y-1 text-xs text-white/60">Cidade<input placeholder="Cidade" value={city} onChange={e=>setCity(e.target.value)} className={input}/></label>
    <label className="block space-y-1 text-xs text-white/60">Serviços disponíveis no estabelecimento (opcional)<textarea rows={3} value={services} onChange={e=>setServices(e.target.value)} className={input} placeholder="Ex.: Chapelaria — R$ 12; posto médico; acessibilidade"/></label>
    <button disabled={busy} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c4ff40] p-3 font-bold text-black disabled:opacity-50"><Pencil size={17}/>{busy?'Salvando...':editing?'Salvar estabelecimento':'Cadastrar e abrir'}</button>
    {notice&&<p role="status" className="text-xs text-[#c4ff40]">{notice}</p>}
   </form>}
   {editing&&venueTab==='maps'&&<AdminVenueMaps key={editing.id} venue={editing} maps={maps} events={events}
    onOpen={openMap} onChanged={reload}
    onDelete={map=>setConfirmDelete({id:map.id,name:map.name,entity:'map'})}/>}
    {editing&&venueTab==='events'&&(!route.eventId?
    <section className="space-y-4">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-bold">Eventos deste estabelecimento</h3><p className="mt-1 text-xs text-white/55">Selecione uma festa para consultar o histórico de movimentação por hora.</p></div>
      <button type="button" onClick={()=>setExampleOpen(true)} className="rounded-xl border border-white/20 px-4 py-2.5 text-xs font-bold">Ver exemplo</button>
     </div>
     {!venueEvents.length?<p className="rounded-xl border border-white/10 p-5 text-sm text-white/60">Nenhum evento cadastrado neste estabelecimento.</p>:
      <div className="space-y-3">{[...venueEvents].sort((a,b)=>(b.starts_at||'').localeCompare(a.starts_at||'')).map(event=>
       <article key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-4">
        <div className="min-w-0"><p className="font-bold">{displayLabel(event.name)}</p><p className="mt-1 text-xs text-white/60">{event.starts_at?new Date(event.starts_at).toLocaleString('pt-BR'):'Data a definir'}</p></div>
        <button type="button" onClick={()=>go({section:'Estabelecimentos',id:editing.id,creating:false,eventId:event.id})} className="shrink-0 rounded-xl bg-[#c4ff40] px-4 py-2.5 text-xs font-bold text-black">Ver análise</button>
       </article>)}</div>}
    </section>
   :selectedVenueEvent&&<AdminCrowd key={selectedVenueEvent.id} event={selectedVenueEvent} venueMaps={maps.filter(map=>map.venue_id===editing.id)}/>)}
   {editing&&venueTab==='events'&&exampleOpen&&<div role="dialog" aria-modal="true" aria-label="Exemplo de análise do evento" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3" onClick={()=>setExampleOpen(false)}>
    <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/20 bg-[#17111d] p-4 sm:p-6" onClick={e=>e.stopPropagation()}>
     <div className="mb-5 flex items-center justify-between gap-2"><h3 className="font-bold">Como a análise aparecerá depois do evento</h3><button type="button" onClick={()=>setExampleOpen(false)} aria-label="Fechar exemplo" className="rounded-lg border border-white/20 p-2"><X size={18}/></button></div>
     <AdminCrowd example event={{id:'example',name:'Exemplo de movimentação',map_ids:[]}} venueMaps={[]}/>
    </div>
   </div>}

  </div>
 </div>
 :<div className="mt-8 space-y-4">
  <div className="flex items-center justify-between gap-3">
   <div><h3 className="font-bold">Estabelecimentos cadastrados</h3><p className="mt-1 text-xs text-white/50">Acesse um estabelecimento para gerenciar plantas e consultar eventos.</p></div>
   <button type="button" onClick={()=>go({section:'Estabelecimentos',id:null,creating:true})} className="shrink-0 rounded-xl bg-[#c4ff40] px-3 py-2.5 text-xs font-bold text-black"><Plus size={14} className="mr-1 inline-block"/> Novo</button>
  </div>
  <label className="block space-y-2 text-xs text-white/60">Buscar por nome, cidade, rua, bairro ou CEP<input value={venueSearch} onChange={e=>setVenueSearch(e.target.value)} placeholder="Digite uma cidade ou outro termo..." className={input}/></label>{searchBusy&&<p className="text-xs text-white/50">Buscando no servidor...</p>}
  {(filteredVenues??venues).length===0?<p className="rounded-xl border border-white/15 p-5 text-sm text-white/60">Nenhum estabelecimento cadastrado.</p>
  :<div className="grid gap-3 md:grid-cols-2">{(filteredVenues??venues).map(item=>{
   const mapCount=maps.filter(map=>map.venue_id===item.id).length;
   const eventCount=events.filter(event=>event.venue_id===item.id).length;
   return <article key={item.id} className="rounded-xl border border-white/10 bg-white/[.035] p-4">
    <h3 className="font-bold">{displayLabel(item.name)}</h3>
    <p className="mt-1 text-xs text-white/50">{[item.city,item.neighborhood,item.street||item.address].filter(Boolean).join(' · ')||'Endereço não informado'}</p>
    {item.address_url&&/^https?:\/\//i.test(item.address_url)&&<a href={item.address_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#c4ff40] underline">Ver localização</a>}
    <p className="mt-3 flex flex-wrap gap-3 text-xs text-white/70"><span className="inline-flex items-center gap-1"><Map size={14}/>{mapCount} {mapCount===1?'mapa':'mapas'}</span><span className="inline-flex items-center gap-1"><CalendarDays size={14}/>{eventCount} {eventCount===1?'evento':'eventos'}</span></p>
    <div className="mt-4 flex gap-2">
     <button onClick={()=>edit(item)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#c4ff40]/40 px-3 py-2 text-xs font-bold text-[#c4ff40]"><Pencil size={14}/> Abrir estabelecimento</button>
     <button aria-label={'Excluir '+item.name} title="Excluir estabelecimento" onClick={()=>setConfirmDelete({id:item.id,name:item.name,entity:'venue'})} className="rounded-xl border border-red-400/40 px-3 py-2 text-red-300"><Trash2 size={15}/></button>
    </div>
   </article>;
  })}</div>}
 </div>)}
 {section==='Eventos'&&(editing||creating
  ?<EventEditor key={editing?.id||'new'} event={editing} venues={venues} maps={maps} onPublicationChanged={()=>{void reload();}} onSaved={()=>{void reload();back();}}/>
  :<AdminEventList events={events} venues={venues}
    onCreate={()=>go({section:'Eventos',id:null,creating:true})}
    onEdit={item=>edit(item)}
    onDelete={item=>setConfirmDelete({id:item.id,name:item.name,entity:'event'})}/>)}
 {confirmDelete&&<div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/20 bg-[#241b2c] p-6"><h3 className="text-lg font-bold">Confirmar exclusão?</h3><p className="text-sm text-white/70">Excluir {displayLabel(confirmDelete.name)}? Esta ação não pode ser desfeita.</p><div className="flex justify-end gap-3"><button onClick={()=>setConfirmDelete(null)} className="rounded-xl border border-white/20 px-4 py-2">Cancelar</button><button disabled={busy} onClick={()=>void removeConfirmed()} className="rounded-xl bg-red-600 px-4 py-2 font-bold">Excluir</button></div></div></div>}
 {error&&<p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}</>}
 </ErrorBoundary>}
 </main></div>;
}
