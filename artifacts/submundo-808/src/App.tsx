import { useEffect, useState } from 'react';
import { CalendarDays, MapPinned, Martini, Users, UserRound, Music2, Clock3, Bell, ShieldCheck, Navigation, Search, UserPlus, Check, X, MapPin, Ticket, ChevronRight, Radio, LockKeyhole, Info, Heart, Volume2 } from 'lucide-react';

type Tab = 'inicio' | 'mapa' | 'cardapio' | 'amigos' | 'perfil';
type Friend = { id: number; name: string; status: 'pendente' | 'amigo'; share: boolean };
const tabs: { id: Tab; title: string; Icon: typeof Music2 }[] = [
  { id: 'inicio', title: 'Início', Icon: Music2 },
  { id: 'mapa', title: 'Mapa', Icon: MapPinned },
  { id: 'cardapio', title: 'Cardápio', Icon: Martini },
  { id: 'amigos', title: 'Amigos', Icon: Users },
  { id: 'perfil', title: 'Perfil', Icon: UserRound },
];
const drinks = [
  { section: 'Bebidas', items: [{ name: 'Água mineral', price: 'R$ 6,00' }, { name: 'Refrigerante', price: 'R$ 9,00' }, { name: 'Energético', price: 'R$ 15,00' }, { name: 'Drink da casa', price: 'R$ 28,00' }] },
  { section: 'Comidas', items: [{ name: 'Batata frita', price: 'R$ 22,00' }, { name: 'Hambúrguer', price: 'R$ 32,00' }, { name: 'Opção vegetariana', price: 'R$ 29,00' }] },
];
const spots = [{ id: 'palco', name: 'Palco', x: 50, y: 22, icon: '♫' }, { id: 'bar', name: 'Bar', x: 22, y: 48, icon: '◈' }, { id: 'banheiros', name: 'Banheiros', x: 79, y: 51, icon: 'WC' }, { id: 'entrada', name: 'Entrada', x: 50, y: 83, icon: '↟' }];
function readFriends(): Friend[] { try { return JSON.parse(localStorage.getItem('submundo-friends') || '[]') as Friend[]; } catch { return []; } }
function readName(): string { try { return localStorage.getItem('submundo-name') || ''; } catch { return ''; } }
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <div className={`rounded-2xl border border-white/10 bg-white/[.045] ${className}`}>{children}</div>; }
function Tag({ children }: { children: React.ReactNode }) { return <span className="inline-flex rounded-full border border-[#c4ff40]/30 bg-[#c4ff40]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#c4ff40]">{children}</span>; }
function Title({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) { return <div className="mb-5"><p className="mb-2 text-[11px] font-bold uppercase tracking-[.24em] text-[#c4ff40]">{eyebrow}</p><h2 className="font-display text-2xl font-black uppercase leading-tight text-white">{children}</h2></div>; }
export default function App() {
  const [tab, setTab] = useState<Tab>('inicio');
  const [selectedSpot, setSelectedSpot] = useState('palco');
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
          <div className="relative mb-7 overflow-hidden rounded-3xl border border-[#c4ff40]/20 bg-[radial-gradient(circle_at_80%_20%,#51235d,transparent_45%),linear-gradient(145deg,#211129,#0b090f)] p-6">
            <div className="absolute -right-8 top-6 rotate-[-17deg] font-display text-[100px] font-black leading-none text-white/[.045]">808</div>
            <Tag>Seu acesso à cena</Tag><h1 className="relative mt-6 font-display text-[34px] font-black uppercase leading-[1.08] tracking-[-.06em]">A NOITE<br/><span className="text-[#c4ff40]">É NOSSA.</span></h1>
            <p className="relative mt-4 max-w-[260px] text-sm leading-relaxed text-white/60">Line-up, mapa, cardápio e sua galera. Tudo num só lugar.</p>
            <button onClick={() => setTab('perfil')} className="relative mt-7 flex items-center gap-2 rounded-xl bg-[#c4ff40] px-5 py-3 text-sm font-black text-black">MEU PASSAPORTE <ChevronRight size={17}/></button>
          </div>
          <Title eyebrow="Próxima edição">O evento</Title>
          <Panel className="mb-7 p-5"><div className="flex items-center gap-3"><CalendarDays className="text-[#c4ff40]" size={24}/><div><p className="font-bold">Aguardando anúncio oficial</p><p className="text-xs text-white/50">Data e local serão divulgados pela organização.</p></div></div></Panel>
          <Title eyebrow="Som na pista">Line-up</Title>
          <Panel className="mb-7 overflow-hidden"><div className="flex items-center gap-3 border-b border-white/10 p-5"><Radio className="text-[#c4ff40]" size={23}/><div><p className="font-bold">Tocando agora</p><p className="text-xs text-white/50">Disponível durante o evento, após atualização oficial.</p></div></div><div className="flex items-center gap-3 p-5"><Clock3 className="text-[#c4ff40]" size={23}/><div><p className="font-bold">Próximo DJ</p><p className="text-xs text-white/50">Programação ainda não cadastrada.</p></div></div></Panel>
          <Title eyebrow="Fique ligado">Comunicados</Title><Panel className="p-5"><div className="flex gap-3"><Volume2 className="shrink-0 text-[#c4ff40]" size={22}/><div><p className="font-bold">Em preparação</p><p className="mt-1 text-sm text-white/55">Novidades e promoções oficiais aparecerão aqui.</p></div></div></Panel>
        </>}
        {tab === 'mapa' && <>
          <Title eyebrow="Explore o espaço">Mapa do evento</Title>
          <Panel className="mb-4 p-4"><div className="mb-4 flex items-center justify-between"><Tag>Mapa ilustrativo</Tag><span className="text-xs text-white/40">Sem GPS indoor</span></div>
            <div className="relative h-[360px] overflow-hidden rounded-2xl border border-[#c4ff40]/20 bg-[linear-gradient(90deg,transparent_96%,rgba(196,255,64,.08)_100%),linear-gradient(transparent_96%,rgba(196,255,64,.08)_100%),#14101b] bg-[length:32px_32px]">
              <div className="absolute inset-[12%_10%] rounded-[45%] border border-dashed border-white/15" />
              <div className="absolute left-[30%] top-[33%] h-[40%] w-[40%] rounded-full bg-[#c4ff40]/[.035] blur-xl" />
              {spots.map(s => <button key={s.id} onClick={() => setSelectedSpot(s.id)} style={{ left: `${s.x}%`, top: `${s.y}%` }} className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-xl px-3 py-2 transition ${selectedSpot === s.id ? 'bg-[#c4ff40] text-black shadow-[0_0_25px_#c4ff4050]' : 'border border-white/20 bg-[#221b2a] text-white'}`}><span className="text-xl font-black">{s.icon}</span><span className="text-[10px] font-bold">{s.name}</span></button>)}
            </div>
            <div className="mt-4 flex items-start gap-3"><MapPin className="shrink-0 text-[#c4ff40]" size={20}/><div><p className="font-bold">{spots.find(s => s.id === selectedSpot)?.name}</p><p className="text-xs text-white/50">Posição ilustrativa. O mapa real depende da planta oficial do evento.</p></div></div>
          </Panel>
          <Panel className="p-5"><div className="flex items-start gap-3"><Navigation className="shrink-0 text-[#c4ff40]" size={22}/><div><p className="font-bold">Localização dos amigos</p><p className="mt-1 text-sm text-white/55">Ainda não disponível. Compartilhamento real exige autenticação, backend e consentimento de cada pessoa.</p><button onClick={() => { setLocationEnabled(false); message('A localização não está ativa neste protótipo.'); }} className="mt-3 rounded-lg border border-white/20 px-3 py-2 text-xs font-bold">Entendi</button></div></div></Panel>
        </>}
        {tab === 'cardapio' && <>
          <Title eyebrow="O que tem por aqui">Cardápio</Title>
          <Panel className="mb-5 flex items-start gap-3 p-4"><Info size={20} className="shrink-0 text-[#c4ff40]"/><p className="text-xs leading-relaxed text-white/60">Itens e valores ilustrativos. O cardápio oficial será publicado pela organização. Não há compras ou pagamentos no aplicativo.</p></Panel>
          <div className="mb-5 flex gap-2">{['Todos','Bebidas','Comidas'].map(x => <button key={x} onClick={() => setFilter(x)} className={`rounded-full px-4 py-2 text-xs font-bold ${filter === x ? 'bg-[#c4ff40] text-black' : 'border border-white/15 text-white/60'}`}>{x}</button>)}</div>
          {drinks.filter(x => filter === 'Todos' || filter === x.section).map(group => <section key={group.section} className="mb-6"><h3 className="mb-3 font-display text-sm font-bold uppercase">{group.section}</h3><Panel className="divide-y divide-white/10">{group.items.map(item => <div key={item.name} className="flex items-center justify-between gap-3 p-4"><span className="text-sm font-medium">{item.name}</span><span className="whitespace-nowrap font-mono text-sm font-bold text-[#c4ff40]">{item.price}</span></div>)}</Panel></section>)}
        </>}
        {tab === 'amigos' && <>
          <Title eyebrow="Sua galera">Amigos</Title>
          <Panel className="mb-5 p-5"><p className="mb-2 font-bold">Adicionar amigo</p><p className="mb-4 text-xs text-white/50">Demonstração local: os convites ainda não são enviados a outras pessoas.</p><div className="flex gap-2"><input aria-label="Nome do amigo" value={friendName} onChange={e => setFriendName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addFriend(); }} placeholder="Nome do amigo" maxLength={50} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#c4ff40]"/><button aria-label="Adicionar" onClick={addFriend} className="rounded-xl bg-[#c4ff40] px-4 text-black"><UserPlus size={20}/></button></div></Panel>
          <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-sm font-bold uppercase">Minha lista</h3><span className="text-xs text-white/45">{friends.length} cadastrados</span></div>
          {friends.length === 0 ? <Panel className="p-8 text-center"><Users className="mx-auto mb-3 text-[#c4ff40]" size={35}/><p className="font-bold">Sua lista está vazia</p><p className="mt-2 text-sm text-white/50">Adicione nomes para experimentar a interface.</p></Panel> : <div className="space-y-3">{friends.map(f => <Panel key={f.id} className="p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c4ff40]/15 font-bold text-[#c4ff40]">{f.name.slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{f.name}</p><p className="text-xs text-white/45">{f.status === 'pendente' ? 'Convite local pendente' : 'Amigo demonstrativo'}</p></div><button aria-label="Remover amigo" onClick={() => setFriends(v => v.filter(x => x.id !== f.id))} className="p-2 text-white/40"><X size={18}/></button></div><div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3"><span className="text-xs text-white/55">Permissão de localização (prévia)</span><button onClick={() => { changeFriend(f.id, { share: !f.share }); message('Preferência salva apenas neste dispositivo. Nenhuma localização é enviada.'); }} className={`rounded-full px-3 py-1.5 text-xs font-bold ${f.share ? 'bg-[#c4ff40] text-black' : 'bg-white/10 text-white/60'}`}>{f.share ? 'Permitida' : 'Desativada'}</button></div></Panel>)}</div>}
          <p className="mt-4 text-xs leading-relaxed text-white/40"><LockKeyhole size={13} className="mr-1 inline"/> Nenhuma localização ou convite é transmitido. Integração entre usuários requer um serviço de contas e dados.</p>
        </>}
        {tab === 'perfil' && <>
          <Title eyebrow="Sua identidade">Meu passaporte</Title>
          <div className="relative mb-6 overflow-hidden rounded-3xl border border-[#c4ff40]/30 bg-[radial-gradient(circle_at_100%_0%,#46215b,transparent_50%),#17101e] p-6"><div className="mb-12 flex items-center justify-between"><Tag>Digital pass</Tag><Ticket size={25} className="text-[#c4ff40]"/></div><p className="text-xs uppercase tracking-[.2em] text-white/50">Passaporte de</p><p className="mt-2 break-words font-display text-xl font-black uppercase">{name.trim() || 'Visitante 808'}</p><div className="mt-8 flex items-end justify-between border-t border-dashed border-white/20 pt-5"><div><p className="font-display text-2xl font-black text-[#c4ff40]">808</p><p className="text-[10px] uppercase tracking-widest text-white/40">Submundo</p></div><p className="text-right text-[10px] uppercase tracking-widest text-white/45">Perfil demonstrativo<br/>Não é ingresso</p></div></div>
          <Panel className="mb-5 p-5"><label htmlFor="profile-name" className="mb-2 block text-sm font-bold">Como quer ser chamado?</label><input id="profile-name" value={name} maxLength={50} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#c4ff40]"/><p className="mt-2 text-xs text-white/40">Salvo somente neste aparelho.</p></Panel>
          <Panel className="mb-5 p-5"><div className="flex gap-3"><CalendarDays className="shrink-0 text-[#c4ff40]" size={23}/><div><p className="font-bold">Meu histórico</p><p className="mt-1 text-sm text-white/50">Nenhuma presença confirmada. O histórico real dependerá de validação pela organização.</p></div></div></Panel>
          <Panel className="p-5"><div className="flex gap-3"><ShieldCheck className="shrink-0 text-[#c4ff40]" size={23}/><div><p className="font-bold">Privacidade primeiro</p><p className="mt-1 text-sm text-white/50">Localização desligada por padrão. Nenhum rastreamento em segundo plano neste protótipo.</p><p className="mt-3 text-xs text-[#c4ff40]">Status: {locationEnabled ? 'ativo' : 'desativado'}</p></div></div></Panel>
        </>}
      </main>
    </div>
    {notice && <div role="status" className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-xl border border-[#c4ff40]/40 bg-[#211a29] px-4 py-3 text-sm shadow-xl"><div className="flex items-center justify-between gap-3"><span>{notice}</span><button aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={18}/></button></div></div>}
    <nav aria-label="Navegação principal" className="safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#100c15]/95 backdrop-blur-xl"><div className="mx-auto grid max-w-xl grid-cols-5">{tabs.map(({id,title,Icon}) => <button key={id} onClick={() => { setTab(id); setNotice(''); window.scrollTo(0,0); }} aria-current={tab === id ? 'page' : undefined} className={`flex min-h-[69px] flex-col items-center justify-center gap-1 text-[10px] font-bold ${tab === id ? 'text-[#c4ff40]' : 'text-white/45'}`}><Icon size={21} strokeWidth={tab === id ? 2.6 : 1.8}/>{title}</button>)}</div></nav>
  </div>;
}
