import { useEffect, useRef, useState } from 'react';
import { MapPin, Plus, Pencil, Check, RotateCcw, Trash2, Download, Info, Navigation } from 'lucide-react';

type Kind = 'palco' | 'pista' | 'cerveja' | 'agua' | 'drink' | 'masculino' | 'feminino' | 'escada' | 'entrada' | 'saida' | 'alimentacao';
type Point = { id: string; kind: Kind; x: number; y: number };
type FriendLocation={id:string;name:string;lat:number;lng:number;accuracy:number;updatedAt:number};
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

// Georreferenciamento por quatro cantos: topo esquerdo, topo direito,
// base direita e base esquerda. Para locais pequenos, aproximação bilinear.
type Geo={lat:number;lng:number};
type Bounds={tl:Geo;tr:Geo;br:Geo;bl:Geo};
const geoKey='submundo-geo-bounds-v1';
const CASA:Bounds={
 tl:{lat:-23.4809490,lng:-47.4364547},
 tr:{lat:-23.4809490,lng:-47.4360629},
 br:{lat:-23.4813084,lng:-47.4360629},
 bl:{lat:-23.4813084,lng:-47.4364547}
};
const CASA_NAME='Casa (área de teste)';
const presetKey='submundo-geo-preset-v1';
function validGeo(p:any):p is Geo{return p&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180;}
function loadGeo():Bounds|null{try{const b=JSON.parse(localStorage.getItem(geoKey)||'null');return b&&validGeo(b.tl)&&validGeo(b.tr)&&validGeo(b.br)&&validGeo(b.bl)?b:null;}catch{return null;}}
function gpsToMap(p:Geo,b:Bounds){
 const origin=b.tl;const rad=Math.PI/180;const scaleX=111320*Math.cos(origin.lat*rad);const scaleY=111320;
 const xy=(q:Geo)=>({x:(q.lng-origin.lng)*scaleX,y:(origin.lat-q.lat)*scaleY});
 const tr=xy(b.tr),bl=xy(b.bl),br=xy(b.br),pt=xy(p);
 // Invert bilinear mapping with Newton iterations.
 let u=.5,v=.5;
 for(let i=0;i<12;i++){const fx=tr.x*u+bl.x*v+(br.x-tr.x-bl.x)*u*v-pt.x;const fy=tr.y*u+bl.y*v+(br.y-tr.y-bl.y)*u*v-pt.y;
 const ax=tr.x+(br.x-tr.x-bl.x)*v,ay=tr.y+(br.y-tr.y-bl.y)*v,bx=bl.x+(br.x-tr.x-bl.x)*u,by=bl.y+(br.y-tr.y-bl.y)*u;
 const det=ax*by-ay*bx;if(Math.abs(det)<1e-8)return null;
 const du=(fx*by-fy*bx)/det,dv=(ax*fy-ay*fx)/det;u-=du;v-=dv;if(Math.abs(du)+Math.abs(dv)<1e-8)break;}
 return Number.isFinite(u)&&Number.isFinite(v)?{x:u*100,y:v*100,inside:u>=0&&u<=1&&v>=0&&v<=1}:null;
}
function mapScale(b:Bounds){const rad=Math.PI/180;const avgLat=(b.tl.lat+b.tr.lat+b.bl.lat+b.br.lat)/4;const distance=(a:Geo,c:Geo)=>Math.hypot((a.lng-c.lng)*111320*Math.cos(avgLat*rad),(a.lat-c.lat)*111320);return {width:(distance(b.tl,b.tr)+distance(b.bl,b.br))/2,height:(distance(b.tl,b.bl)+distance(b.tr,b.br))/2};}

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
  const [bounds,setBounds]=useState<Bounds|null>(()=>loadGeo()||CASA);
  const [presetName,setPresetName]=useState(()=>{try{return localStorage.getItem(presetKey)||'Casa';}catch{return 'Casa';}});
  const [geoDraft,setGeoDraft]=useState<Record<string,string>>(()=>{const b=loadGeo()||CASA;return Object.fromEntries((['tl','tr','br','bl'] as const).flatMap(k=>[[k+'Lat',b?.[k].lat.toString()||''],[k+'Lng',b?.[k].lng.toString()||'']]));});
  const [location,setLocation]=useState<{lat:number;lng:number;accuracy:number}|null>(null);
  const [geoError,setGeoError]=useState('');
  const [tracking,setTracking]=useState(false);
  const [sharing,setSharing]=useState(false);
  const [friends,setFriends]=useState<FriendLocation[]>([]);
  const sharingRef=useRef(false);
  const lastSend=useRef(0);
  const sendBusy=useRef(false);
  const shareEpoch=useRef(0);
  const [authRequired,setAuthRequired]=useState(false);
  const [friendError,setFriendError]=useState('');
  const requestLocation=async(route:string,body?:object)=>{const response=await fetch('/api/location/'+route,{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(response.status===401){setAuthRequired(true);throw Error('Entre na sua conta para compartilhar ou ver seus amigos.');}const data=await response.json();if(!response.ok)throw Error(data.error||'Falha na localização.');return data;};
  const watch=useRef<number|null>(null);
  useEffect(()=>{let alive=true;const refresh=async()=>{try{const data=await requestLocation('friends');if(alive){setFriends(data.friends);setAuthRequired(false);setFriendError('');}}catch(e){if(alive)setFriendError(e instanceof Error?e.message:'Falha ao carregar amigos.');}};void refresh();const timer=window.setInterval(()=>void refresh(),15000);return()=>{alive=false;window.clearInterval(timer);shareEpoch.current++;sharingRef.current=false;if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);if(lastSend.current>0)void fetch('/api/location/stop',{method:'POST',credentials:'same-origin',keepalive:true});};},[]);
  const mapped=location&&bounds?gpsToMap(location,bounds):null;
  const scale=bounds?mapScale(bounds):null;
  const uncertainty=location&&scale?Math.max(location.accuracy/Math.max(scale.width,1)*100,location.accuracy/Math.max(scale.height,1)*100):null;
  const reliable=!!mapped&&!!location&&location.accuracy<=10&&!!scale&&scale.width>10&&scale.height>10&&uncertainty!==null&&uncertainty<15;
  const applyCasa=()=>{setBounds(CASA);setPresetName('Casa');setGeoDraft(Object.fromEntries((['tl','tr','br','bl'] as const).flatMap(k=>[[k+'Lat',String(CASA[k].lat)],[k+'Lng',String(CASA[k].lng)]])));localStorage.setItem(geoKey,JSON.stringify(CASA));localStorage.setItem(presetKey,'Casa');setGeoError('Casa selecionada. Área provisória de teste, não corresponde necessariamente ao imóvel.');};
  const saveGeo=()=>{const keys=['tl','tr','br','bl'] as const;const parsed={} as Bounds;for(const k of keys){const lat=Number(geoDraft[k+'Lat']),lng=Number(geoDraft[k+'Lng']);if(!geoDraft[k+'Lat']?.trim()||!geoDraft[k+'Lng']?.trim()||!validGeo({lat,lng})){setGeoError('Preencha as oito coordenadas válidas.');return;}parsed[k]={lat,lng};}const dimensions=mapScale(parsed);if(dimensions.width<3||dimensions.height<3){setGeoError('Os cantos não formam uma área válida.');return;}setBounds(parsed);setPresetName('Personalizado');localStorage.setItem(geoKey,JSON.stringify(parsed));localStorage.setItem(presetKey,'Personalizado');setGeoError('Coordenadas salvas neste aparelho.');};
  const startGps=()=>{if(!navigator.geolocation){setGeoError('GPS indisponível neste navegador.');return;}setGeoError('');watch.current=navigator.geolocation.watchPosition(p=>{setLocation({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});setTracking(true);if(sharingRef.current&&!sendBusy.current&&Date.now()-lastSend.current>=10000){sendBusy.current=true;const epoch=shareEpoch.current;void requestLocation('update',{lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}).then(()=>{if(epoch===shareEpoch.current)lastSend.current=Date.now();}).catch(e=>{if(epoch===shareEpoch.current)setFriendError(e instanceof Error?e.message:'Falha ao enviar localização.');}).finally(()=>{sendBusy.current=false;});}},e=>{setGeoError('Não foi possível obter a localização: '+e.message);setTracking(false);},{enableHighAccuracy:true,maximumAge:3000,timeout:15000});setTracking(true);};
  const stopSharing=async()=>{shareEpoch.current++;sharingRef.current=false;setSharing(false);lastSend.current=0;try{await requestLocation('stop',{});}catch(e){setFriendError(e instanceof Error?e.message:'Não foi possível parar o compartilhamento.');}};
  const startSharing=async()=>{setFriendError('');try{const me=await fetch('/api/auth/me',{credentials:'same-origin'}).then(r=>r.json());if(!me.user){setAuthRequired(true);setFriendError('Entre na sua conta antes de compartilhar sua localização.');return;}if(!navigator.geolocation){setFriendError('GPS indisponível.');return;}if(!tracking)startGps();shareEpoch.current++;sharingRef.current=true;setSharing(true);lastSend.current=0;}catch{setFriendError('Não foi possível verificar sua conta.');}};
  const stopGps=()=>{if(sharingRef.current)void stopSharing();if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null;}setTracking(false);setLocation(null);};
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
        {mapped&&mapped.x>=0&&mapped.x<=100&&mapped.y>=0&&mapped.y<=100&&<div aria-label="Sua localização aproximada" className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{left:mapped.x+'%',top:mapped.y+'%'}}><span className="block h-5 w-5 rounded-full border-[3px] border-white bg-[#33aaff] shadow-[0_0_0_7px_#33aaff55]"/></div>}
        {bounds&&friends.map(f=>{const pos=gpsToMap({lat:f.lat,lng:f.lng},bounds);if(!pos||!pos.inside)return null;return <div key={'friend-'+f.id} className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{left:pos.x+'%',top:pos.y+'%'}}><span className="rounded-full border-2 border-white bg-[#ff98d0] px-2 py-1 text-[10px] font-black text-black shadow-lg">{f.name.slice(0,18)}</span><span className="rounded-full bg-black/80 px-1.5 py-0.5 text-[9px] text-white">±{Math.round(f.accuracy)}m</span></div>;})}
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
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.04] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold">Local cadastrado: {presetName}</span><button type="button" onClick={applyCasa} className="rounded-lg border border-[#c4ff40]/60 px-3 py-2 text-xs font-bold text-[#c4ff40]">Usar Casa (automático)</button></div>
      <div className="flex items-center gap-2"><Navigation size={19} className="text-[#c4ff40]"/><h3 className="text-sm font-black uppercase">Minha localização no evento</h3></div>
      <p className="mt-2 text-xs leading-relaxed text-white/55">Permita o GPS para mostrar sua posição aproximada no mapa. Sua posição só é enviada ao servidor se você ativar o compartilhamento com amigos.</p>
      <button onClick={tracking?stopGps:startGps} className="mt-3 w-full rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-black text-black">{tracking?'Parar localização':'Ativar minha localização'}</button>
      <div className="mt-3 rounded-xl border border-white/10 p-3">
        <p className="text-xs font-bold">Compartilhar minha localização com amigos</p>
        <p className="mt-1 text-xs text-white/50">Desativado por padrão. Somente amigos adicionados podem consultar sua posição. O envio funciona enquanto o mapa estiver aberto e o navegador permitir GPS.</p>
        <button onClick={()=>void(sharing?stopSharing():startSharing())} className={`mt-3 w-full rounded-xl px-3 py-3 text-xs font-black ${sharing?'border border-rose-400/50 text-rose-200':'bg-[#c4ff40] text-black'}`}>{sharing?'Parar de compartilhar':'Compartilhar com meus amigos'}</button>
        {sharing&&<p className="mt-2 text-xs text-[#c4ff40]">Compartilhamento ativado. Aguardando posição GPS para atualizar os amigos.</p>}
        {authRequired&&<p className="mt-2 text-xs text-amber-300">Faça login no Perfil para usar a localização dos amigos.</p>}
        {friendError&&<p role="status" className="mt-2 text-xs text-amber-300">{friendError}</p>}
        <p className="mt-3 text-xs font-bold">Amigos com localização recente ({friends.length})</p>
        {friends.length===0?<p className="mt-1 text-xs text-white/50">Nenhum amigo compartilhando no momento.</p>:<div className="mt-2 space-y-1">{friends.map(f=><p key={f.id} className="text-xs text-white/70">{f.name} · ±{Math.round(f.accuracy)} m · atualizado há {Math.max(0,Math.floor((Date.now()-f.updatedAt)/1000))} s</p>)}</div>}
      </div>
      {location&&<p className="mt-3 text-xs text-white/70">Precisão estimada: ±{Math.round(location.accuracy)} m. {!bounds?'Configure os quatro cantos da planta para mostrar sua posição.':!mapped?'Não foi possível posicionar no mapa.':!reliable?'Posição incerta; não é seguro identificar o ambiente.':mapped.inside?'Seu GPS está dentro da área cadastrada.':'Seu GPS está fora da área de teste cadastrada; isso não significa que você esteja fora da casa.'}</p>}
      {location&&<p className="mt-2 text-xs text-white/50">GPS atual: {location.lat.toFixed(7)}, {location.lng.toFixed(7)}. Compare com os limites cadastrados para calibrar o mapa.</p>}
      {geoError&&<p role="status" className="mt-2 text-xs text-amber-300">{geoError}</p>}
      <details className="mt-4 border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs font-bold text-white/80">Configurar limites geográficos da planta</summary>
        <p className="mt-2 text-xs leading-relaxed text-white/50">O preset Casa preenche automaticamente as oito coordenadas estimadas. Para precisão real, substitua pelos quatro cantos medidos do imóvel. Essa configuração é local.</p>
        <div className="mt-3 space-y-3">{(['tl','tr','br','bl'] as const).map((key,i)=><div key={key}><p className="mb-1 text-xs font-bold">{['Superior esquerdo','Superior direito','Inferior direito','Inferior esquerdo'][i]}</p><div className="grid grid-cols-2 gap-2">{(['Lat','Lng'] as const).map(axis=><input key={axis} type="number" step="any" inputMode="decimal" aria-label={axis==='Lat'?'Latitude':'Longitude'} placeholder={axis==='Lat'?'Latitude':'Longitude'} value={geoDraft[key+axis]||''} onChange={e=>setGeoDraft(old=>({...old,[key+axis]:e.target.value}))} className="min-w-0 rounded-lg border border-white/20 bg-[#211b29] p-2 text-xs text-white"/>)}</div></div>)}</div>
        <button onClick={saveGeo} className="mt-3 w-full rounded-xl border border-[#c4ff40]/50 px-4 py-3 text-xs font-bold text-[#c4ff40]">Salvar coordenadas</button>
        <p className="mt-2 text-xs text-white/45">O GPS pode errar vários metros. Este recurso não distingue com segurança pista, bar e camarote próximos.</p>
      </details>
    </div>
    {editing && <div className="mt-4 rounded-2xl border border-[#c4ff40]/30 bg-[#c4ff40]/[.045] p-4">
      <p className="mb-1 text-sm font-black uppercase">Editor de planta</p><p className="mb-4 text-xs leading-relaxed text-white/55">Escolha um tipo, adicione e arraste na planta. As posições ficam salvas neste dispositivo.</p>
      <div className="flex gap-2"><select aria-label="Tipo de ponto" value={kind} onChange={e => setKind(e.target.value as Kind)} className="min-w-0 flex-1 rounded-xl border border-white/20 bg-[#211b29] px-3 py-3 text-sm text-white">{catalog.map(c => <option key={c.kind} value={c.kind}>{c.label}</option>)}</select><button onClick={add} className="flex items-center gap-1 rounded-xl bg-[#c4ff40] px-3 text-xs font-black text-black"><Plus size={18}/> Adicionar</button></div>
      <div className="mt-3 grid grid-cols-2 gap-2"><button disabled={!active} onClick={() => { setPoints(old => old.filter(p => p.id !== selected)); setSelected(''); }} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-2 py-3 text-xs font-bold disabled:opacity-30"><Trash2 size={15}/> Remover selecionado</button><button onClick={() => { setPoints(initial); setSelected('stage'); }} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-2 py-3 text-xs font-bold"><RotateCcw size={15}/> Restaurar exemplo</button></div>
      <button onClick={exportMap} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-3 text-xs font-bold"><Download size={16}/> Exportar planta (JSON)</button>
      {status && <p role="status" className="mt-3 text-xs text-[#c4ff40]">{status}</p>}
    </div>}
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="flex items-start gap-3"><Info size={19} className="shrink-0 text-[#c4ff40]"/><p className="text-xs leading-relaxed text-white/55">Layout fictício para teste. O editor é local, sem publicação para outros visitantes. Para uma festa real, a organização deverá configurar a planta oficial e publicá-la por um backend com acesso restrito.</p></div></div>

  </section>;
}
