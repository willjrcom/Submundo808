import { useEffect, useState } from 'react';
import VenueMap from './components/venue-map';
import AdminShell from './components/admin-shell';
import Account from './components/account';
import Friends from './components/friends';
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
  return tabs.some(t=>t.id===segment)?segment as Tab:'inicio';
}
export default function App() {
  if(window.location.hostname==='admin.submundo.menudevendas.com.br')return <AdminShell/>;
  return <ParticipantApp/>;
}
function ParticipantApp() {
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const navigate=(next:Tab)=>{const url=new URL(window.location.href);url.pathname=next==='inicio'?'/':'/'+next;url.searchParams.delete('invite');window.history.pushState({tab:next},'',url.pathname+url.search+url.hash);setTab(next);setNotice('');window.scrollTo(0,0);};
  useEffect(()=>{const onPop=()=>{setTab(tabFromUrl());window.scrollTo(0,0);};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);},[]);
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
  return <div className="min-h-dvh bg-[#0b090f] text-[#f5f2fa] selection:bg-[#c4ff40] selection:text-black">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(164,49,207,.2),transparent_50%)]" />
    <div className="relative mx-auto max-w-xl pb-28">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0b090f]/90 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c4ff40] text-xl font-black text-black">8</div><div><p className="font-display text-[13px] font-black uppercase tracking-[-.06em] text-white">SUBMUNDO<span className="text-[#c4ff40]">808</span></p><p className="text-[9px] uppercase tracking-[.22em] text-white/45">Passaporte digital</p></div></div>
        <button aria-label="Avisos" onClick={() => message('Nenhum comunicado oficial cadastrado.')} className="rounded-xl border border-white/10 p-2.5 text-white/70"><Bell size={18}/></button>
      </header>
      <main className="px-5 pt-7">
        {tab === 'inicio' && <>
          {homeMode === 'proxima' ? <>
            <div className="relative mb-7 overflow-hidden rounded-3xl border border-[#c4ff40]/20 bg-[radial-gradient(circle_at_85%_15%,#51235d,transparent_48%),linear-gradient(145deg,#211129,#0b090f)] p-6">
              <div className="absolute -right-8 top-6 rotate-[-17deg] font-display text-[100px] font-black leading-none text-white/[.045]">808</div>
              <Tag>Próxima edição</Tag>
              <h1 className="relative mt-6 font-display text-[32px] font-black uppercase leading-[1.1] tracking-[-.06em]">A PRÓXIMA<br/><span className="text-[#c4ff40]">FREQUÊNCIA.</span></h1>
              <p className="relative mt-4 max-w-[270px] text-sm leading-relaxed text-white/60">A próxima noite começa aqui. Acompanhe os anúncios oficiais.</p>
              <button onClick={() => navigate('perfil')} className="relative mt-7 flex items-center gap-2 rounded-xl bg-[#c4ff40] px-5 py-3 text-sm font-black text-black">MEU PASSAPORTE <ChevronRight size={17}/></button>
            </div>
            <Title eyebrow="Anote na agenda">Próxima festa</Title>
            <Panel className="mb-7 p-5"><div className="flex items-center gap-3"><CalendarDays className="shrink-0 text-[#c4ff40]" size={25}/><div><p className="font-bold">Aguardando anúncio oficial</p><p className="mt-1 text-xs text-white/50">Data, horário e local serão divulgados pela organização.</p></div></div></Panel>
            <Title eyebrow="Quem vai comandar">DJs confirmados</Title>
            <Panel className="mb-7 overflow-hidden"><div className="border-b border-white/10 px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-white/45">Line-up fictício • demonstração</div>{demoLineup.map((dj, index) => <div key={dj.name} className="flex items-center gap-4 border-b border-white/10 px-5 py-4 last:border-b-0"><span className="font-mono text-xs text-[#c4ff40]">{String(index + 1).padStart(2, '0')}</span><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#c4ff40]/10 font-display text-lg font-black text-[#c4ff40]">{dj.name.slice(0, 1)}</div><div className="min-w-0 flex-1"><p className="font-display text-xs font-bold uppercase">{dj.name}</p><p className="mt-1 text-xs text-white/45">{dj.start} — {dj.end} · @{dj.instagram} (fictício)</p><DjLinks dj={dj}/></div></div>)}</Panel>
            <Title eyebrow="Novidades">Anúncios e informações</Title>
            <Panel className="p-5"><div className="flex items-start gap-3"><Bell className="shrink-0 text-[#c4ff40]" size={22}/><div><p className="font-bold">Fique por dentro</p><p className="mt-1 text-sm text-white/55">Informações oficiais da próxima edição serão publicadas neste espaço.</p></div></div></Panel>
          </> : <>
            <div className="mb-5 flex items-center justify-between gap-3"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.24em] text-[#c4ff40]">Modo dia da festa</p><h1 className="font-display text-[28px] font-black uppercase leading-tight">A PISTA <span className="text-[#c4ff40]">CHAMA.</span></h1></div><span className="rounded-full border border-white/15 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/60">Prévia</span></div>
            <Panel className="mb-5 overflow-hidden border-[#c4ff40]/35 bg-[radial-gradient(circle_at_90%_10%,#38204a,transparent_65%),#16101c]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#c4ff40]"><Radio size={16}/> Tocando agora</span><span className="text-[10px] text-white/40">Simulação • não é ao vivo</span></div>
              <div className="px-5 py-7"><p className="font-display text-2xl font-black uppercase text-white">{demoLineup[2].name}</p><p className="mt-2 text-sm text-white/55">{demoLineup[2].start} — {demoLineup[2].end} · Set demonstrativo</p><DjLinks dj={demoLineup[2]}/></div>
              <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4"><Clock3 size={19} className="text-[#c4ff40]"/><div><p className="text-[10px] uppercase tracking-widest text-white/45">A seguir</p><p className="text-sm font-bold">{demoLineup[3].name} · {demoLineup[3].start}</p></div></div>
            </Panel>
            <Title eyebrow="Informações prioritárias">Comunicados da festa</Title>
            <Panel className="mb-7 overflow-hidden"><p className="border-b border-white/10 px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-white/45">Comunicados fictícios para demonstração</p>{demoNotices.map((notice, index) => <div key={notice.title} className="flex gap-3 border-b border-white/10 p-5 last:border-0"><Bell className="shrink-0 text-[#c4ff40]" size={21}/><div className="flex-1"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">{notice.title}</p><span className="font-mono text-xs text-white/40">{notice.time}</span></div><p className="mt-1 text-xs leading-relaxed text-white/55">{notice.detail}</p></div></div>)}</Panel>
            <Title eyebrow="A programação completa">Ordem das apresentações</Title>
            <Panel className="mb-7 overflow-hidden">{demoLineup.map((dj, index) => <div key={dj.name} className={`flex items-center gap-3 border-b border-white/10 p-4 last:border-0 ${index === 2 ? 'bg-[#c4ff40]/10' : ''}`}><span className="w-12 shrink-0 font-mono text-xs text-[#c4ff40]">{dj.start}</span><div className="flex-1"><p className="text-sm font-bold">{dj.name}</p><p className="text-xs text-white/45">Até {dj.end} · @{dj.instagram}</p><DjLinks dj={dj}/></div>{index === 2 && <span className="rounded-full bg-[#c4ff40] px-2 py-1 text-[10px] font-black text-black">SIMULANDO AGORA</span>}</div>)}</Panel>
            
          </>}
          <div className="mt-10 border-t border-white/10 pt-6">
            <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[.2em] text-white/40">Visualizar outro momento do evento</p>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[.04] p-1.5" role="group" aria-label="Modo da página inicial">
              <button aria-pressed={homeMode === 'proxima'} onClick={() => { setHomeMode('proxima'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`rounded-xl px-3 py-3 text-xs font-bold transition ${homeMode === 'proxima' ? 'bg-[#c4ff40] text-black' : 'text-white/60'}`}>Próxima festa</button>
              <button aria-pressed={homeMode === 'ao-vivo'} onClick={() => { setHomeMode('ao-vivo'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`rounded-xl px-3 py-3 text-xs font-bold transition ${homeMode === 'ao-vivo' ? 'bg-[#c4ff40] text-black' : 'text-white/60'}`}>Dia da festa</button>
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-white/35">Alternância demonstrativa. O modo automático dependerá da programação oficial do evento.</p>
          </div>
        </>}
        {tab === 'mapa' && <VenueMap/>}
        {tab === 'cardapio' && <>
          <Title eyebrow="O que tem por aqui">Cardápio</Title>
          <Panel className="mb-5 flex items-start gap-3 p-4"><Info size={20} className="shrink-0 text-[#c4ff40]"/><p className="text-xs leading-relaxed text-white/60">Itens e valores ilustrativos. O cardápio oficial será publicado pela organização. Não há compras ou pagamentos no aplicativo.</p></Panel>
          <div className="mb-5 flex gap-2">{['Todos','Bebidas','Comidas'].map(x => <button key={x} onClick={() => setFilter(x)} className={`rounded-full px-4 py-2 text-xs font-bold ${filter === x ? 'bg-[#c4ff40] text-black' : 'border border-white/15 text-white/60'}`}>{x}</button>)}</div>
          {drinks.filter(x => filter === 'Todos' || filter === x.section).map(group => <section key={group.section} className="mb-6"><h3 className="mb-3 font-display text-sm font-bold uppercase">{group.section}</h3><Panel className="divide-y divide-white/10">{group.items.map(item => <div key={item.name} className="flex items-center justify-between gap-3 p-4"><span className="text-sm font-medium">{item.name}</span><span className="whitespace-nowrap font-mono text-sm font-bold text-[#c4ff40]">{item.price}</span></div>)}</Panel></section>)}
        </>}
        {tab === 'amigos' && <Friends/>}
        {tab === 'perfil' && <Account/>}
      </main>
    </div>
    {notice && <div role="status" className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-xl border border-[#c4ff40]/40 bg-[#211a29] px-4 py-3 text-sm shadow-xl"><div className="flex items-center justify-between gap-3"><span>{notice}</span><button aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={18}/></button></div></div>}
    <nav aria-label="Navegação principal" className="safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#100c15]/95 backdrop-blur-xl"><div className="mx-auto grid max-w-xl grid-cols-5">{tabs.map(({id,title,Icon}) => <button key={id} onClick={() => navigate(id)} aria-current={tab === id ? 'page' : undefined} className={`flex min-h-[69px] flex-col items-center justify-center gap-1 text-[10px] font-bold ${tab === id ? 'text-[#c4ff40]' : 'text-white/45'}`}><Icon size={21} strokeWidth={tab === id ? 2.6 : 1.8}/>{title}</button>)}</div></nav>
  </div>;
}
