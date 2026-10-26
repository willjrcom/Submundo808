import AdminProducts from './admin-products';
import { useEffect, useState } from 'react';
import { EventEditor } from './admin-editors';
import AdminMapWorkspace from './admin-map-workspace';
import PageLoading from './page-loading';
import {displayLabel} from './display-label';
import useMinimumLoading from './use-minimum-loading';
import {adminRoutePath,parseAdminRoute,type AdminRoute,type AdminSection} from './admin-route';
import { Building2, CalendarDays, Map, LayoutDashboard, ArrowLeft, Plus, Pencil, Trash2, Users, ShoppingBag } from 'lucide-react';
type Item={id:string;name:string;venue_id?:string;city?:string;address?:string};
type User={id:string;name:string;email:string;isAdmin?:boolean};
const input='w-full rounded-xl border border-white/20 bg-[#241b2c] p-3 text-sm';
async function api(key:string,data?:object){const r=await fetch('/api/admin/'+key,{method:data?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});const j=await r.json();if(!r.ok)throw Error(j.error||'Erro ao salvar');return j;}
export default function AdminShell(){
 const [seedBusy,setSeedBusy]=useState(false),[seedMessage,setSeedMessage]=useState(''),[seedStage,setSeedStage]=useState('Criando...'),[useDemoGps,setUseDemoGps]=useState(false);
 const [confirmDelete,setConfirmDelete]=useState<{id:string;name:string;entity:string}|null>(null);
 const [user,setUser]=useState<User|null|undefined>(undefined),[route,setRoute]=useState<AdminRoute>(()=>parseAdminRoute(window.location.pathname)),[listsLoaded,setListsLoaded]=useState(false),[loadFailed,setLoadFailed]=useState(false);
 const [venues,setVenues]=useState<Item[]>([]),[maps,setMaps]=useState<Item[]>([]),[events,setEvents]=useState<Item[]>([]),[stats,setStats]=useState({totalUsers:0,activeUsers:0,sharingNow:0});
 const [name,setName]=useState(''),[address,setAddress]=useState(''),[city,setCity]=useState(''),[venue,setVenue]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const section=route.section,creating=route.creating;
 const editing=(section==='Estabelecimentos'?venues:section==='Mapas e ambientes'?maps:section==='Eventos'?events:[]).find(item=>item.id===route.id)||null;
 const sections:{name:AdminSection;Icon:typeof LayoutDashboard}[]=[{name:'Visão geral',Icon:LayoutDashboard},{name:'Estabelecimentos',Icon:Building2},{name:'Mapas e ambientes',Icon:Map},{name:'Eventos',Icon:CalendarDays},{name:'Produtos e cardápios',Icon:ShoppingBag}];
 async function reload(){const [v,m,e,o]=await Promise.all([api('venues'),api('maps'),api('events'),api('overview')]);setVenues(v.items);setMaps(m.items);setEvents(e.items);setStats(o);}
 useEffect(()=>{let alive=true;fetch('/api/auth/me',{credentials:'same-origin'}).then(r=>r.json()).then(j=>{if(!alive)return;setUser(j.user);if(j.user?.isAdmin)void reload().catch(e=>{if(alive){setError(String(e));setLoadFailed(true);}}).finally(()=>{if(alive)setListsLoaded(true);});else setListsLoaded(true);}).catch(()=>{if(alive){setUser(null);setListsLoaded(true);}});return()=>{alive=false;};},[]);
 useEffect(()=>{const onPop=()=>{setRoute(parseAdminRoute(window.location.pathname));setError('');setConfirmDelete(null);};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);},[]);
 useEffect(()=>{setName(editing?.name||'');setAddress(editing?.address||'');setCity(editing?.city||'');setVenue(editing?.venue_id||'');},[section,route.id,route.creating,editing?.id]);
 useEffect(()=>{if(section!=='Visão geral'||!user?.isAdmin)return;const t=setInterval(()=>void api('overview').then(setStats).catch(()=>{}),30000);return ()=>clearInterval(t);},[section,user?.isAdmin]);
 function go(next:AdminRoute){const path=adminRoutePath(next);if(window.location.pathname!==path)window.history.pushState({},'',path);setRoute(next);setError('');setConfirmDelete(null);}
 function navigate(next:AdminSection){go({section:next,id:null,creating:false});}
 function edit(item:Item){go({section,id:item.id,creating:false});}
 function back(){go({section,id:null,creating:false});}
 async function seedDemo(){
  setSeedBusy(true);setError('');setSeedMessage('');
  let location:{latitude:number;longitude:number;accuracy:number}|null=null;
  let gpsWarning='';
  try{
   if(useDemoGps){
    if(!navigator.geolocation){
     gpsWarning='GPS indisponível; o evento será criado sem calibração automática.';
    }else{
     setSeedStage('Obtendo GPS...');
     try{
      const position=await new Promise<GeolocationPosition>((resolve,reject)=>
       navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,maximumAge:0,timeout:15000})
      );
      location={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy};
     }catch(e){
      const err=e as GeolocationPositionError;
      gpsWarning=err.code===1
       ?'Permissão de localização negada; o evento será gerado sem GPS. Você poderá calibrar manualmente.'
       :'Não foi possível obter o GPS agora; o evento será gerado sem calibração automática.';
     }
    }
   }
   setSeedStage('Gerando cenários...');
   const result=await api('seed-demo',{location});
   await reload();
   const messages=[
    result.created
     ?'Evento criado com mapa, pontos, 6 DJs e '+result.productsTotal+' produtos no cardápio.'
     :result.productsLinked>0||result.productsCreated>0
      ?'Evento atualizado: '+result.productsCreated+' produtos criados e '+result.productsLinked+' vinculados, sem alterar preços personalizados.'
      :'Evento e produtos preservados, sem duplicatas.'
   ];
   if(result.gpsStatus==='auto-calibrated'){
    messages.push('Mapa calibrado aproximadamente em 50 × 40 m, com referências de 10 m. Precisão do GPS: ±'+Math.round(result.gpsAccuracy)+' m.');
    if(result.markersRepositioned)messages.push('Pontos originais reorganizados na grade de 10 m.');
   }else if(result.gpsStatus==='manual-preserved'){
    messages.push('Já existe calibração manual; ela foi preservada sem alterações.');
   }else if(result.gpsStatus==='no-demo-map'||result.gpsStatus==='no-areas'){
    messages.push('Mapa não encontrado para calibração.');
   }
   if(result.showcase?.eventsAdded)messages.push('POC ampliada: '+result.showcase.eventsAdded+' eventos, '+result.showcase.mapsAdded+' mapas e '+result.showcase.venuesAdded+' estabelecimentos adicionais, com cardápios individuais.');
   else if(result.showcase)messages.push('Os cinco eventos adicionais da POC já estão disponíveis, sem duplicatas.');
   if(gpsWarning)messages.push(gpsWarning);
   setSeedMessage(messages.join(' '));
  }catch(e){setError(e instanceof Error?e.message:'Erro ao gerar evento');}
  finally{setSeedBusy(false);setSeedStage('Criando...');}
 }
 async function removeConfirmed(){if(!confirmDelete)return;setBusy(true);setError('');try{await api('delete',{id:confirmDelete.id,entity:confirmDelete.entity});setConfirmDelete(null);await reload();if(route.id)back();}catch(e){setError(e instanceof Error?e.message:'Erro ao excluir');setConfirmDelete(null);}finally{setBusy(false);}}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{if(section==='Estabelecimentos')await api(editing?'edit-venue':'venues',{id:editing?.id,name,address,city});else await api(editing?'edit-map':'maps',{id:editing?.id,name,venue_id:venue});await reload();if(editing||creating)back();else setName('');}catch(e){setError(e instanceof Error?e.message:'Erro ao salvar');}finally{setBusy(false);}}
 const showLoading=useMinimumLoading(user===undefined||(!!user?.isAdmin&&!listsLoaded));
 if(showLoading)return <div className="flex min-h-dvh items-center justify-center bg-[#0b090f] p-5 text-white"><div className="w-full max-w-md"><PageLoading label="Carregando painel administrativo" description="Validando suas permissões e preparando os dados do painel."/></div></div>;
 if(user?.isAdmin&&loadFailed)return <div className="flex min-h-dvh items-center justify-center bg-[#0b090f] p-5 text-white"><div role="alert" className="w-full max-w-md rounded-2xl border border-red-400/25 bg-red-400/5 p-6 text-center"><p className="font-bold text-red-200">Não foi possível carregar o painel.</p><p className="mt-2 text-xs text-white/60">{error}</p><button onClick={()=>{setListsLoaded(false);setLoadFailed(false);setError('');void reload().catch(e=>{setError(String(e));setLoadFailed(true);}).finally(()=>setListsLoaded(true));}} className="mt-4 rounded-xl bg-[#c4ff40] px-4 py-2 text-sm font-bold text-black">Tentar novamente</button></div></div>;
 if(!user?.isAdmin)return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0b090f] p-6 text-center text-white"><h1 className="text-2xl font-black">Painel administrativo</h1><p className="text-white/60">{user?'Sua conta não possui permissão de administrador.':'Faça login no Submundo 808 para acessar o painel.'}</p><a href="https://submundo.menudevendas.com.br/perfil" className="rounded-xl bg-[#c4ff40] px-5 py-3 font-bold text-black">Ir para meu perfil</a></div>;
 return <div className="min-h-dvh bg-[#0b090f] text-white md:flex"><aside className="border-b border-white/10 bg-[#17101e] p-5 md:min-h-dvh md:w-64 md:border-b-0 md:border-r"><h1 className="mb-5 text-xl font-black">SUBMUNDO <span className="text-[#c4ff40]">ADMIN</span></h1><nav className="flex gap-2 overflow-x-auto md:flex-col">{sections.map(({name:label,Icon})=><button key={label} onClick={()=>navigate(label)} className={'flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm '+(section===label?'bg-[#c4ff40] font-bold text-black':'text-white/70')}><Icon size={17}/>{label}</button>)}</nav><a className="mt-6 flex items-center gap-2 text-sm text-white/60" href="https://submundo.menudevendas.com.br/perfil"><ArrowLeft size={16}/> Acessar visão do usuário</a></aside><main className="w-full min-w-0 max-w-6xl p-5 md:p-10">
 {route.id&&!editing?<div className="rounded-xl border border-white/15 bg-white/5 p-6"><h2 className="text-xl font-bold">{!listsLoaded?'Carregando página...':'Registro não encontrado'}</h2><p className="mt-2 text-sm text-white/60">{!listsLoaded?'Restaurando o item da URL.':'O item desta URL não existe ou não pôde ser carregado.'}</p><button onClick={back} className="mt-4 rounded-xl bg-[#c4ff40] px-4 py-2 text-sm font-bold text-black">Voltar à lista</button></div>:editing&&section==='Mapas e ambientes'?<AdminMapWorkspace key={editing.id} map={editing as Item & {venue_id:string}} onBack={back}/>:<>
 {(editing||creating)&&<button onClick={back} className="mb-5 flex items-center gap-2 text-sm text-white/60"><ArrowLeft size={16}/> Voltar</button>}
 <p className="mb-2 text-xs uppercase tracking-widest text-[#c4ff40]">Painel administrativo</p><h2 className="text-3xl font-black">{editing?'Editar '+(section==='Estabelecimentos'?'estabelecimento':section==='Eventos'?'evento':'mapa'):creating?'Criar '+(section==='Estabelecimentos'?'estabelecimento':section==='Eventos'?'evento':'mapa'):section}</h2><p className="mt-2 text-sm text-white/50">Olá, {user.name}</p>
 {section==='Produtos e cardápios'&&<AdminProducts events={events}/>}
 {section==='Visão geral'&&<div className="mt-6 rounded-2xl border border-[#c4ff40]/20 bg-white/5 p-5"><h3 className="font-bold">Geração rápida</h3><p className="mt-2 text-sm text-white/60">Prepare cinco eventos adicionais em quatro datas, incluindo dois no mesmo dia, com três estabelecimentos ao todo, seis mapas e cardápios completos. Os dados personalizados são preservados.</p><label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/15 p-3 text-sm"><input type="checkbox" checked={useDemoGps} disabled={seedBusy} onChange={e=>setUseDemoGps(e.target.checked)} className="mt-1 h-4 w-4 accent-[#c4ff40]"/><span><span className="font-semibold">Calibrar mapa pelo GPS</span><span className="mt-1 block text-xs text-white/55">Usa sua localização para estimar uma área de 50 × 40 m. A calibração manual não será substituída.</span></span></label><button disabled={seedBusy} onClick={()=>void seedDemo()} className="mt-4 rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-bold text-black disabled:opacity-50">{seedBusy?seedStage:'Gerar / conferir todos os cenários'}</button>{seedMessage&&<p className="mt-3 text-sm text-[#c4ff40]">{seedMessage}</p>}</div>}
 {section==='Visão geral'&&<div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[{label:'Usuários ativos (últimos 15 min)',count:stats.activeUsers,Icon:Users},{label:'Usuários cadastrados',count:stats.totalUsers,Icon:Users},{label:'Compartilhando localização agora',count:stats.sharingNow,Icon:Users},{label:'Estabelecimentos',count:venues.length,Icon:Building2},{label:'Mapas',count:maps.length,Icon:Map},{label:'Eventos',count:events.length,Icon:CalendarDays}].map(({label,count,Icon})=><div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5"><Icon size={20} className="text-[#c4ff40]"/><p className="mt-3 text-sm text-white/60">{label}</p><p className="mt-2 text-3xl font-black text-[#c4ff40]">{count}</p></div>)}</div>}
 {(section==='Estabelecimentos'||section==='Mapas e ambientes')&&!(section==='Mapas e ambientes'&&editing)&&<div className={'mt-8 grid gap-5 '+(editing||creating?'max-w-xl':'lg:grid-cols-2')}>{(editing||creating)&&<form onSubmit={save} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5"><h3 className="font-bold">{editing?'Editar':'Novo'} {section==='Estabelecimentos'?'estabelecimento':'mapa'}</h3>{section==='Mapas e ambientes'&&<select required value={venue} onChange={e=>setVenue(e.target.value)} className={input}><option value="">Selecione o estabelecimento</option>{venues.map(v=><option key={v.id} value={v.id} >{displayLabel(v.name)}</option>)}</select>}<input required placeholder="Nome" value={name} onChange={e=>setName(e.target.value)} className={input}/>{section==='Estabelecimentos'&&<><input placeholder="Endereço" value={address} onChange={e=>setAddress(e.target.value)} className={input}/><input placeholder="Cidade" value={city} onChange={e=>setCity(e.target.value)} className={input}/></>}<button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c4ff40] p-3 font-bold text-black disabled:opacity-50"><Plus size={18}/>{editing?'Salvar alterações':'Cadastrar'}</button></form>}{!editing&&!creating&&<div className="rounded-2xl border border-white/10 p-5"><div className="mb-4 flex items-center justify-between gap-2"><h3 className="font-bold">Cadastrados</h3><button onClick={()=>go({section,id:null,creating:true})} className="rounded-xl bg-[#c4ff40] px-3 py-2 text-xs font-bold text-black">+ Criar</button></div>{(section==='Estabelecimentos'?venues:maps).map(x=><div key={x.id} className="flex items-center justify-between gap-3 border-b border-white/10 py-3"><div><p className="font-medium">{displayLabel(x.name)}</p><p className="text-xs text-white/50">{section==='Estabelecimentos'?x.city:venues.find(v=>v.id===x.venue_id)?.name}</p></div><div className="flex gap-2"><button onClick={()=>edit(x)} className="flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-bold"><Pencil size={15}/> Editar</button><button aria-label={'Excluir '+x.name} onClick={()=>setConfirmDelete({id:x.id,name:x.name,entity:section==='Estabelecimentos'?'venue':'map'})} className="rounded-xl border border-red-400/40 px-3 py-2 text-red-300"><Trash2 size={15}/></button></div></div>)}</div>}</div>}
 {section==='Eventos'&&(editing||creating?<EventEditor key={editing?.id||'new'} event={editing} venues={venues} maps={maps} onSaved={()=>{void reload();back();}}/>:<div className="mt-8 space-y-3"><button onClick={()=>go({section:'Eventos',id:null,creating:true})} className="rounded-xl bg-[#c4ff40] px-4 py-3 font-bold text-black">+ Criar evento</button>{events.map(e=><div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-4"><span>{displayLabel(e.name)}</span><div className="flex gap-2"><button onClick={()=>edit(e)} className="rounded-xl border border-white/20 px-3 py-2 text-sm">Editar</button><button onClick={()=>setConfirmDelete({id:e.id,name:e.name,entity:'event'})} className="rounded-xl border border-red-400/40 px-3 py-2 text-sm text-red-300">Excluir</button></div></div>)}</div>)}
 {confirmDelete&&<div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/20 bg-[#241b2c] p-6"><h3 className="text-lg font-bold">Confirmar exclusão?</h3><p className="text-sm text-white/70">Excluir {displayLabel(confirmDelete.name)}? Esta ação não pode ser desfeita.</p><div className="flex justify-end gap-3"><button onClick={()=>setConfirmDelete(null)} className="rounded-xl border border-white/20 px-4 py-2">Cancelar</button><button disabled={busy} onClick={()=>void removeConfirmed()} className="rounded-xl bg-red-600 px-4 py-2 font-bold">Excluir</button></div></div></div>}
 {error&&<p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}</>}
 </main></div>;
}
