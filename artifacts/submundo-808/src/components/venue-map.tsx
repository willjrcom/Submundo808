import { useEffect, useRef, useState } from 'react';
import { MapPin, Plus, Pencil, Check, RotateCcw, Trash2, Download, Info, Navigation } from 'lucide-react';

type Kind = 'palco' | 'pista' | 'cerveja' | 'agua' | 'drink' | 'masculino' | 'feminino' | 'escada' | 'entrada' | 'saida' | 'alimentacao';
type Point = { id: string; kind: Kind; x: number; y: number };
const catalog: { kind: Kind; label: string; symbol: string; color: string }[] = [
  { kind: 'palco', label: 'Palco', symbol: '♫', color: '#c4ff40' },
  { kind: 'pista', label: 'Pista', symbol: '◉', color: '#ba9dfb' },
  { kind: 'cerveja', label: 'Cervejas', symbol: '🍺', color: '#ffc96b' },
  { kind: 'agua', label: 'Água', symbol: '💧', color: '#6fceff' },
  { kind: 'drink', label: 'Drinks', symbol: '◈', color: '#ff98d0' },
  { kind: 'masculino', label: 'WC masculino', symbol: 'M', color: '#a2baff' },
  { kind: 'feminino', label: 'WC feminino', symbol: 'F', color: '#ffa8df' },
  { kind: 'escada', label: 'Escadas', symbol: '↗', color: '#e0e0e0' },
  { kind: 'entrada', label: 'Entrada', symbol: '↓', color: '#c4ff40' },
  { kind: 'saida', label: 'Saída', symbol: '↑', color: '#fcb77e' },
  { kind: 'alimentacao', label: 'Alimentação', symbol: '◆', color: '#ffcf7d' },
];
const initial: Point[] = [
  { id: 'stage', kind: 'palco', x: 50, y: 12 },
  { id: 'floor', kind: 'pista', x: 50, y: 40 },
  { id: 'beer1', kind: 'cerveja', x: 15, y: 32 },
  { id: 'beer2', kind: 'cerveja', x: 85, y: 32 },
  { id: 'water', kind: 'agua', x: 16, y: 60 },
  { id: 'drinks', kind: 'drink', x: 84, y: 60 },
  { id: 'wcM', kind: 'masculino', x: 16, y: 78 },
  { id: 'wcF', kind: 'feminino', x: 84, y: 78 },
  { id: 'stairs', kind: 'escada', x: 85, y: 13 },
  { id: 'entrance', kind: 'entrada', x: 50, y: 92 },
];
const storageKey = 'submundo-map-layout-v1';
function load(): Point[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(saved) && saved.every(p => p && typeof p.id === 'string' && catalog.some(c => c.kind === p.kind) && Number.isFinite(p.x) && Number.isFinite(p.y))) return saved;
  } catch {}
  return initial;
}
const clamp = (n: number) => Math.max(7, Math.min(93, n));
export default function VenueMap() {
  const [points, setPoints] = useState<Point[]>(load);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState('stage');
  const [kind, setKind] = useState<Kind>('cerveja');
  const [status, setStatus] = useState('');
  const board = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(points)); } catch {} }, [points]);
  const active = points.find(p => p.id === selected);
  const details = catalog.find(c => c.kind === active?.kind);
  const position = (clientX: number, clientY: number) => {
    const rect = board.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clamp(Math.round((clientX - rect.left) / rect.width * 100)), y: clamp(Math.round((clientY - rect.top) / rect.height * 100)) };
  };
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editing || !dragging.current) return;
    const pos = position(event.clientX, event.clientY);
    if (!pos) return;
    const id = dragging.current;
    setPoints(old => old.map(p => p.id === id ? { ...p, ...pos } : p));
  };
  const add = () => {
    const id = 'item-' + Date.now();
    setPoints(old => [...old, { id, kind, x: 50, y: 60 }]);
    setSelected(id);
    setStatus('Item adicionado. Arraste-o para a posição desejada.');
  };
  const exportMap = () => {
    const blob = new Blob([JSON.stringify({ version: 1, points }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'submundo808-mapa.json'; a.click();
    URL.revokeObjectURL(url);
  };
  return <section>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.24em] text-[#c4ff40]">Explore o espaço</p><h2 className="font-display text-2xl font-black uppercase">Mapa do evento</h2></div>
      <button onClick={() => { setEditing(v => !v); setStatus(''); }} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${editing ? 'bg-[#c4ff40] text-black' : 'border border-white/20 bg-white/5'}`}>{editing ? <Check size={16}/> : <Pencil size={16}/>} {editing ? 'Concluir edição' : 'Editar mapa'}</button>
    </div>
    <div className="mb-4 flex items-center justify-between gap-2"><span className="rounded-full border border-[#c4ff40]/30 bg-[#c4ff40]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#c4ff40]">Planta 2D ilustrativa</span><span className="text-[11px] text-white/45">{editing ? 'Arraste os pontos' : 'Toque para explorar'}</span></div>
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#17111d] p-2.5">
      <div ref={board} onPointerMove={move} onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }} className="relative h-[510px] w-full select-none overflow-hidden rounded-xl border border-[#c4ff40]/20 bg-[#0e0c14]" style={{ touchAction: editing ? 'none' : 'pan-y' }}>
        <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'linear-gradient(#ffffff12 1px,transparent 1px),linear-gradient(90deg,#ffffff12 1px,transparent 1px)', backgroundSize: '24px 24px' }}/>
        <div className="absolute inset-[4%_4%] rounded-xl border-[5px] border-[#71677d]/60 shadow-[inset_0_0_25px_#00000088]" />
        <div className="absolute left-[5%] top-[22%] h-[49%] w-[90%] rounded-lg border border-dashed border-[#9e85bc]/30 bg-[#643b84]/[.055]" />
        <div className="pointer-events-none absolute left-1/2 top-[24%] -translate-x-1/2 text-[10px] font-black uppercase tracking-[.28em] text-white/20">Área de circulação</div>
        <div className="pointer-events-none absolute left-[32%] top-[5%] h-[12%] w-[36%] rounded-b-2xl border-x-2 border-b-4 border-[#c4ff40]/50 bg-[#c4ff40]/10" />
        <div className="pointer-events-none absolute bottom-[4%] left-[37%] h-[9%] w-[26%] rounded-t-lg border-x border-t border-[#c4ff40]/30 bg-[#c4ff40]/[.055]" />
        <div className="pointer-events-none absolute bottom-[17%] left-[6%] right-[6%] border-t border-dashed border-white/15"/>
        {points.map(p => {
          const item = catalog.find(c => c.kind === p.kind)!;
          const isSelected = selected === p.id;
          return <button type="button" key={p.id} onPointerDown={e => { setSelected(p.id); if (editing) { dragging.current = p.id; e.currentTarget.setPointerCapture(e.pointerId); } }} onPointerMove={e => { if (!editing || dragging.current !== p.id) return; const pos = position(e.clientX, e.clientY); if (pos) setPoints(old => old.map(q => q.id === p.id ? { ...q, ...pos } : q)); }} onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }} onClick={() => setSelected(p.id)} style={{ left: p.x + '%', top: p.y + '%', borderColor: isSelected ? item.color : item.color + '70', boxShadow: isSelected ? '0 0 0 2px ' + item.color + '50' : undefined }} className={`absolute z-10 flex min-w-[65px] max-w-[98px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-lg border bg-[#211b29]/95 px-1.5 py-2 text-center shadow-lg ${editing ? 'cursor-grab active:cursor-grabbing' : ''}`}>
            <span className="text-lg font-black leading-none" style={{ color: item.color }}>{item.symbol}</span><span className="text-[9px] font-bold leading-tight text-white">{item.label}</span>
          </button>;
        })}
        <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/50 px-2 py-1 font-mono text-[9px] text-white/40">PLANTA DEMO · NÃO EM ESCALA</span>
      </div>
      <div className="flex items-start gap-3 px-2 py-4"><MapPin size={20} className="shrink-0 text-[#c4ff40]"/><div><p className="font-bold">{details?.label || 'Selecione um ponto'}</p><p className="text-xs text-white/50">{active ? `Posição na planta: X ${Math.round(active.x)}% · Y ${Math.round(active.y)}%` : 'Selecione um elemento do mapa.'}</p></div></div>
    </div>
    {editing && <div className="mt-4 rounded-2xl border border-[#c4ff40]/30 bg-[#c4ff40]/[.045] p-4">
      <p className="mb-1 text-sm font-black uppercase">Editor de planta</p><p className="mb-4 text-xs leading-relaxed text-white/55">Escolha um tipo, adicione e arraste na planta. As posições ficam salvas neste dispositivo.</p>
      <div className="flex gap-2"><select aria-label="Tipo de ponto" value={kind} onChange={e => setKind(e.target.value as Kind)} className="min-w-0 flex-1 rounded-xl border border-white/20 bg-[#211b29] px-3 py-3 text-sm text-white">{catalog.map(c => <option key={c.kind} value={c.kind}>{c.label}</option>)}</select><button onClick={add} className="flex items-center gap-1 rounded-xl bg-[#c4ff40] px-3 text-xs font-black text-black"><Plus size={18}/> Adicionar</button></div>
      <div className="mt-3 grid grid-cols-2 gap-2"><button disabled={!active} onClick={() => { setPoints(old => old.filter(p => p.id !== selected)); setSelected(''); }} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-2 py-3 text-xs font-bold disabled:opacity-30"><Trash2 size={15}/> Remover selecionado</button><button onClick={() => { setPoints(initial); setSelected('stage'); }} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-2 py-3 text-xs font-bold"><RotateCcw size={15}/> Restaurar exemplo</button></div>
      <button onClick={exportMap} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-3 text-xs font-bold"><Download size={16}/> Exportar planta (JSON)</button>
      {status && <p role="status" className="mt-3 text-xs text-[#c4ff40]">{status}</p>}
    </div>}
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="flex items-start gap-3"><Info size={19} className="shrink-0 text-[#c4ff40]"/><p className="text-xs leading-relaxed text-white/55">Layout fictício para teste. O editor é local, sem publicação para outros visitantes. Para uma festa real, a organização deverá configurar a planta oficial e publicá-la por um backend com acesso restrito.</p></div></div>
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="flex items-start gap-3"><Navigation size={20} className="shrink-0 text-[#c4ff40]"/><div><p className="text-sm font-bold">Localização dos amigos</p><p className="mt-1 text-xs text-white/50">Indisponível neste protótipo. Compartilhamento real requer autenticação e consentimento.</p></div></div></div>
  </section>;
}
