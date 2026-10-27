import EventMenu from './components/event-menu';
import PublicEvents from './components/public-events';
import { useEffect, useState } from 'react';
import VenueMap from './components/venue-map';
import AdminShell from './components/admin-shell';
import Account from './components/account';
import NotFound from './pages/not-found';
import {ErrorBoundary} from './components/error-boundary';
import Friends from './components/friends';
import NotificationCenter from './components/notification-center';
import {getActiveEventId,setActiveEventId as saveActiveEventId,clearActiveEventId as resetActiveEventId,eventIdFromPath,eventProgramPath,ACTIVE_EVENT_CHANGED,ACTIVE_EVENT_KEY} from './components/active-event';
import { Instagram, ExternalLink } from 'lucide-react';
import { CalendarDays, MapPinned, Martini, Users, UserRound, Music2, Clock3, Bell, ShieldCheck, Navigation, Search, UserPlus, Check, X, MapPin, Ticket, ChevronRight, Radio, LockKeyhole, Info, Heart, Volume2 } from 'lucide-react';

type Tab = 'inicio' | 'mapa' | 'cardapio' | 'amigos' | 'perfil';
type HomeMode = 'proxima' | 'ao-vivo';
type Friend = { id: number; name: string; status: 'pendente' | 'amigo'; share: boolean };
const tabs: { id: Tab; title: string; Icon: typeof Music2 }[] = [
  { id: 'inicio', title: 'Início', Icon: Music2 },
  { id: 'mapa', title: 'Mapa', Icon: MapPinned },
  { id: 'cardapio', title: 'Cardápio', Icon: Martini },
  { id: 'amigos', title: 'Amigos', Icon: Users },
  { id: 'perfil', title: 'Perfil', Icon: UserRound },
];
// Dados fictícios para demonstrar a experiência; não são confirmações oficiais.
const demoLineup = [{"name":"DJ NØX","start":"22:00","end":"22:50","instagram":"dj_nox808"},{"name":"LUNA BASS","start":"22:50","end":"23:40","instagram":"luna_bass808"},{"name":"KAYO 808","start":"23:40","end":"00:30","instagram":"kayo808music"},{"name":"VEXX","start":"00:30","end":"01:20","instagram":"vexxbeats808"},{"name":"MAYA VOLT","start":"01:20","end":"02:10","instagram":"maya_volt808"}];
const demoNotices = [{ title: 'Portões abertos', detail: 'Entrada principal liberada. Tenha seu ingresso em mãos.', time: '21:30' }, { title: 'Hidratação', detail: 'Pontos de água disponíveis próximos ao bar.', time: '22:15' }, { title: 'Atenção à saída', detail: 'Siga a sinalização e as orientações da equipe.', time: '23:10' }];
const drinks = [
  { section: 'Bebidas', items: [{ name: 'Água mineral', price: 'R$ 6,00' }, { name: 'Refrigerante', price: 'R$ 9,00' }, { name: 'Energético', price: 'R$ 15,00' }, { name: 'Drink da casa', price: 'R$ 28,00' }] },
  { section: 'Comidas', items: [{ name: 'Batata frita', price: 'R$ 22,00' }, { name: 'Hambúrguer', price: 'R$ 32,00' }, { name: 'Opção vegetariana', price: 'R$ 29,00' }] },
];
function readFriends(): Friend[] { try { return JSON.parse(localStorage.getItem('submundo-friends') || '[]') as Friend[]; } catch { return []; } }
function readName(): string { try { return localStorage.getItem('submundo-name') || ''; } catch { return ''; } }
function DjLinks({ dj }: { dj: (typeof demoLineup)[number] }) {
  return <div className="mt-2 flex flex-wrap items-center gap-2">
    <a href={`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(dj.instagram)}`} target="_blank" rel="noopener noreferrer" aria-label={`Pesquisar ${dj.name} no Instagram`} className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1.5 text-[11px] font-bold text-white/80"><Instagram size={13}/> Instagram <ExternalLink size={11}/></a>
    <a href={`https://open.spotify.com/search/${encodeURIComponent(dj.name)}`} target="_blank" rel="noopener noreferrer" aria-label={`Pesquisar ${dj.name} no Spotify`} className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1.5 text-[11px] font-bold text-white/80"><Music2 size={13}/> Spotify <ExternalLink size={11}/></a>
  </div>;
}
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <div className={`rounded-2xl border border-white/10 bg-white/[.045] ${className}`}>{children}</div>; }
function Tag({ children }: { children: React.ReactNode }) { return <span className="inline-flex rounded-full border border-[#c4ff40]/30 bg-[#c4ff40]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#c4ff40]">{children}</span>; }
function Title({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) { return <div className="mb-5"><p className="mb-2 text-[11px] font-bold uppercase tracking-[.24em] text-[#c4ff40]">{eyebrow}</p><h2 className="font-display text-2xl font-black uppercase leading-tight text-white">{children}</h2></div>; }
function tabFromUrl():Tab {
  const params=new URLSearchParams(window.location.search);
  if(params.has('invite'))return 'amigos';
  const segment=window.location.pathname.replace(/^\/+|\/+$/g,'').split('/')[0];
  if(segment==='programacao'||segment==='schedule')return 'inicio';
  const routes:Record<string,Tab>={map:'mapa',menu:'cardapio',friends:'amigos',profile:'perfil',register:'perfil',login:'perfil',recovery:'perfil','reset-password':'perfil','change-password':'perfil',mapa:'mapa',cardapio:'cardapio',amigos:'amigos',perfil:'perfil',cadastrar:'perfil'};
  return routes[segment]||'inicio';
}
export default function App() {
  if(window.location.hostname==='admin.submundo.menudevendas.com.br')return <AdminShell/>;
  return <ParticipantApp/>;
}
function ParticipantApp() {
  const [routePath,setRoutePath]=useState(window.location.pathname);
  const [inboxOpen,setInboxOpen]=useState(false);
  const [unreadCount,setUnreadCount]=useState(0);
  useEffect(()=>{const poll=()=>{void fetch('/api/notifications',{credentials:'same-origin'}).then(r=>r.json()).then(j=>setUnreadCount(Number(j.unread)||0)).catch(()=>{});};poll();const timer=window.setInterval(poll,30000);return()=>window.clearInterval(timer);},[inboxOpen]);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const linkEvent=params.get('event');
    if(linkEvent){saveActiveEventId(linkEvent);setActiveEventId(linkEvent);}
    if(params.get('review')==='1')setInboxOpen(true);
    const focusPoint=params.get('point');
    if(focusPoint){
      const selected=linkEvent||getActiveEventId();
      const dispatch=()=>window.dispatchEvent(new CustomEvent('submundo-map-focus',{detail:{pointId:focusPoint,eventId:selected}}));
      window.setTimeout(dispatch,600);
    }
  },[]);

  const [brandLogo,setBrandLogo]=useState('');
  useEffect(()=>{let alive=true;const load=()=>{fetch('/api/public/branding').then(r=>r.json()).then(j=>{if(alive)setBrandLogo(j.logo||'');}).catch(()=>{});};load();window.addEventListener('focus',load);return()=>{alive=false;window.removeEventListener('focus',load);};},[]);
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const [activeEventId,setActiveEventId]=useState(getActiveEventId);
  const selectEvent=(id:string)=>{saveActiveEventId(id);setActiveEventId(id);};
  const clearEvent=()=>{resetActiveEventId();setActiveEventId('');};
  useEffect(()=>{
    if(!activeEventId)return;
    // Reconciliar a seleção guardada no localStorage após login/refresh.
    void fetch('/api/events/participation',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:activeEventId})}).catch(()=>{});
  },[activeEventId]);

  const chooseAnotherEvent=()=>{clearEvent();window.history.pushState({tab:'inicio'},'','/');setTab('inicio');window.dispatchEvent(new Event('submundo-navigation'));window.scrollTo(0,0);};
  useEffect(()=>{
    // Keep deep-link selection when a participant opens /programacao/:id
    // directly, then changes tab or installs/restarts the PWA.
    const eventFromLink=eventIdFromPath(window.location.pathname);
    if(eventFromLink)saveActiveEventId(eventFromLink);
  },[]);
  useEffect(()=>{
    const sync=()=>setActiveEventId(getActiveEventId());
    const onStorage=(event:StorageEvent)=>{
      if(event.key!==ACTIVE_EVENT_KEY)return;
      const id=event.newValue||'';
      // A deep-link currently open in this tab must not override a later
      // selection saved by the same user in another browser tab.
      if(eventIdFromPath(window.location.pathname)){
        window.history.replaceState({tab:'inicio'},'',id?eventProgramPath(id):'/');
      }
      setActiveEventId(id);
    };
    window.addEventListener(ACTIVE_EVENT_CHANGED,sync);
    window.addEventListener('storage',onStorage);
    return()=>{window.removeEventListener(ACTIVE_EVENT_CHANGED,sync);window.removeEventListener('storage',onStorage);};
  },[]);
  // Preserva o rastreador GPS ao navegar entre Perfil, Amigos e Mapa.
  // O componente só é montado depois de o usuário abrir o Mapa pela primeira vez.
  const [mapMounted,setMapMounted]=useState(()=>tabFromUrl()==='mapa');
  useEffect(()=>{if(tab==='mapa')setMapMounted(true);},[tab]);
  const navigate=(next:Tab)=>{setRoutePath(next==='inicio'?(activeEventId?eventProgramPath(activeEventId):'/'):'/'+({mapa:'map',cardapio:'menu',amigos:'friends',perfil:'profile'} as Record<string,string>)[next]);const url=new URL(window.location.href);url.pathname=next==='inicio'?(activeEventId?eventProgramPath(activeEventId):'/'):'/'+({mapa:'map',cardapio:'menu',amigos:'friends',perfil:'profile'} as Record<string,string>)[next];url.searchParams.delete('invite');window.history.pushState({tab:next},'',url.pathname+url.search+url.hash);if(next==='mapa')setMapMounted(true);setTab(next);window.dispatchEvent(new Event('submundo-navigation'));setNotice('');window.scrollTo(0,0);};
  useEffect(()=>{const onPop=()=>{
    setRoutePath(window.location.pathname);
    const next=tabFromUrl();
    const fromPath=eventIdFromPath(window.location.pathname);
    if(fromPath)saveActiveEventId(fromPath);
    else if(window.location.pathname==='/')resetActiveEventId();
    setActiveEventId(getActiveEventId());
    if(next==='mapa')setMapMounted(true);
    setTab(next);window.scrollTo(0,0);
  };window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);},[]);
  const [homeMode, setHomeMode] = useState<HomeMode>('proxima');
  const [filter, setFilter] = useState('Todos');
  const [friends, setFriends] = useState<Friend[]>(readFriends);
  const [name, setName] = useState(readName);
  const [friendName, setFriendName] = useState('');
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { localStorage.setItem('submundo-friends', JSON.stringify(friends)); }, [friends]);
  useEffect(() => { localStorage.setItem('submundo-name', name); }, [name]);
  const message = (text: string) => { setNotice(text); };
  const addFriend = () => { const value = friendName.trim(); if (!value) return; if (friends.some(f => f.name.toLowerCase() === value.toLowerCase())) { message('Esse nome já está na sua lista.'); return; } setFriends(v => [...v, { id: Date.now(), name: value, status: 'pendente', share: false }]); setFriendName(''); message('Convite demonstrativo criado neste aparelho.'); };
  const changeFriend = (id: number, patch: Partial<Friend>) => setFriends(v => v.map(f => f.id === id ? { ...f, ...patch } : f));
  const parts=routePath.split('/').filter(Boolean);
  const allowed=parts.length===0||(parts.length===1&&['map','menu','friends','profile','login','register','recovery','reset-password','change-password','mapa','cardapio','amigos','perfil','cadastrar'].includes(parts[0]))||(parts.length===2&&['schedule','programacao'].includes(parts[0])&&!!parts[1]);
  return <div className="min-h-dvh bg-[#0b090f] text-[#f5f2fa] selection:bg-[#c4ff40] selection:text-black">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(164,49,207,.2),transparent_50%)]" />
    <div className="relative mx-auto max-w-xl pb-28">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0b090f]/90 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">{brandLogo&&<img src={brandLogo} alt="Logo Submundo 808" className="h-9 w-9 rounded-lg object-cover"/>}<p className="font-display text-[16px] font-black uppercase tracking-[-.06em] text-white">SUBMUNDO<span className="text-[#c4ff40]">808</span></p></div>
        <button aria-label="Avisos" onClick={() => setInboxOpen(true)} className="relative rounded-xl border border-white/10 p-2.5 text-white/70"><Bell size={18}/>{unreadCount>0&&<span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#c4ff40] px-1 text-center text-[10px] font-bold text-black">{unreadCount>99?"99+":unreadCount}</span>}</button>
      </header>
      <main className="px-5 pt-7">
       {!allowed?<NotFound/>:<ErrorBoundary resetKey={routePath} FallbackComponent={({resetError})=><NotFound status={500} onRetry={resetError}/>}>        {tab === 'inicio' && <PublicEvents activeEventId={activeEventId} onSelectEvent={selectEvent} onClearEvent={clearEvent}/>}
        {mapMounted&&<div hidden={tab!=='mapa'} aria-hidden={tab!=='mapa'}><VenueMap activeEventId={activeEventId} onChooseEvent={()=>navigate('inicio')}/></div>}
        {tab === 'cardapio' && <EventMenu activeEventId={activeEventId} onChooseEvent={chooseAnotherEvent}/>}
        {tab === 'amigos' && <Friends/>}
        {tab === 'perfil' && <Account/>}
       </ErrorBoundary>}
      </main>
    </div>
    {inboxOpen&&<NotificationCenter onClose={()=>setInboxOpen(false)} onNavigate={(kind,eventId,pointId)=>{setInboxOpen(false);if(eventId)selectEvent(eventId);const next:Tab=kind==='menu'?'cardapio':kind==='map'||kind==='point'?'mapa':'inicio';navigate(next);if(kind==='point'&&pointId){window.setTimeout(()=>window.dispatchEvent(new CustomEvent('submundo-map-focus',{detail:{pointId,eventId}})),200);}}}/>}
    {notice && <div role="status" className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-xl border border-[#c4ff40]/40 bg-[#211a29] px-4 py-3 text-sm shadow-xl"><div className="flex items-center justify-between gap-3"><span>{notice}</span><button aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={18}/></button></div></div>}
    <nav aria-label="Navegação principal" className="safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#100c15]/95 backdrop-blur-xl"><div className="mx-auto grid max-w-xl grid-flow-col auto-cols-fr">{tabs.map(({id,title,Icon}) => <button key={id} onClick={() => navigate(id)} aria-current={tab === id ? 'page' : undefined} className={`flex min-h-[69px] flex-col items-center justify-center gap-1 text-[10px] font-bold ${tab === id ? 'text-[#c4ff40]' : 'text-white/45'}`}><Icon size={21} strokeWidth={tab === id ? 2.6 : 1.8}/>{title}</button>)}</div></nav>
  </div>;
}
