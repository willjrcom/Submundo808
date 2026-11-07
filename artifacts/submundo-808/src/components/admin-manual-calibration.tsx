import {useEffect,useState} from 'react';
import {ArrowLeft,CheckCircle2,ExternalLink,MapPin,Satellite,X} from 'lucide-react';
import MapCalibrationOrientation,{CALIBRATION_POINT_NAMES} from './map-calibration-orientation';
import {type CalibrationGps,type CornerKey} from './map-calibration-geometry';
import {
 buildManualCalibration,CORNER_LABELS,googleMapsLink,googleSatelliteEmbedUrl,
 mapPreviewPosition,type ManualPointMode,type ManualValues,type ManualCalibrationResult
} from './map-calibration-manual';

const field='w-full min-w-0 rounded-lg border border-white/15 bg-[#241b2d] px-2.5 py-2 text-xs text-white outline-none focus:border-[#c4ff40]';
const outline='rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#c4ff40]/55';
const order:CornerKey[]=['tl','tr','br','bl'];

function CornerSketch({result}:{result:ManualCalibrationResult}){
 if(!result.ok)return <p className="flex h-full items-center justify-center p-5 text-center text-xs text-white/55">Informe os cantos para visualizar o contorno estimado da planta.</p>;
 const centerLat=order.reduce((sum,k)=>sum+result.raw[k].lat,0)/4;
 const projection=order.map(key=>{
  const p=result.raw[key];
  return {key,x:p.lng* Math.cos(centerLat*Math.PI/180),y:-p.lat};
 });
 const xs=projection.map(p=>p.x),ys=projection.map(p=>p.y);
 const x1=Math.min(...xs),x2=Math.max(...xs),y1=Math.min(...ys),y2=Math.max(...ys);
 const span=Math.max(x2-x1,y2-y1,.000001);
 const points=projection.map(p=>({...p,px:22+(p.x-x1)/span*196,py:18+(p.y-y1)/span*114}));
 return <svg viewBox="0 0 240 150" role="img" aria-label="Esboço do contorno calculado a partir dos cantos informados" className="h-full max-h-44 w-full">
  <rect x="1" y="1" width="238" height="148" rx="10" fill="#16111f" stroke="#ffffff24"/>
  {Array.from({length:7},(_,i)=><g key={i} stroke="#ffffff12"><path d={'M'+(i*40)+' 0 V150'}/><path d={'M0 '+(i*25)+' H240'}/></g>)}
  <polygon points={points.map(p=>p.px+','+p.py).join(' ')} fill="#9747ff" fillOpacity=".28" stroke="#c4ff40" strokeWidth="2" strokeLinejoin="round"/>
  {points.map((p,i)=><g key={p.key}><circle cx={p.px} cy={p.py} r="6" stroke="#211729" strokeWidth="2" fill="#c4ff40"/>
   <text x={p.px} y={p.py-11} fontSize="10" fontWeight="bold" fill="#f0fae0" textAnchor="middle">{i+1}</text></g>)}
 </svg>;
}

export default function AdminManualCalibration({mapName,values,mode,existingGps,onChange,onModeChange,onBack,onClose,onApply}:{
 mapName:string;
 values:ManualValues;mode:ManualPointMode;existingGps:CalibrationGps|undefined;
 onChange:(key:CornerKey,field:'lat'|'lng',value:string)=>void;
 onModeChange:(mode:ManualPointMode)=>void;
 onBack:()=>void;onClose:()=>void;
 onApply:(value:Extract<ManualCalibrationResult,{ok:true}>)=>void;
}){
 const [review,setReview]=useState(false),[error,setError]=useState('');
 const [selectedCorner,setSelectedCorner]=useState<CornerKey>('tl');
 const selectCorner=(key:CornerKey)=>{setSelectedCorner(key);document.getElementById('cal-lat-'+key)?.focus();};
 const result=buildManualCalibration(values,mode);
 const position=mapPreviewPosition(values,existingGps);
 const url=googleSatelliteEmbedUrl(position,mapName);
 const link=googleMapsLink(position,mapName);
 // Avoid reloading a third-party map on every keystroke.
 const [displayUrl,setDisplayUrl]=useState(url);
 useEffect(()=>{
  const timer=window.setTimeout(()=>setDisplayUrl(url),650);
  return()=>window.clearTimeout(timer);
 },[url]);
 const change=(key:CornerKey,field:'lat'|'lng',value:string)=>{
  setReview(false);setError('');onChange(key,field,value);
 };
 const next=()=>{
  if(!result.ok){setError(result.error);return;}
  setError('');setReview(true);
 };
 return <div role="presentation" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-2 sm:p-4">
  <section role="dialog" aria-modal="true" aria-label="Calibração manual de mapa" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#c4ff40]/40 bg-[#17111e] shadow-2xl">
   <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-4 sm:px-6">
    <div className="flex items-center gap-3"><MapPin className="text-[#c4ff40]" size={22}/><div><h3 className="text-lg font-black">Calibração manual</h3><p className="text-xs text-white/55">{mapName} · marque os cantos da planta</p></div></div>
    <button type="button" onClick={onClose} aria-label="Fechar calibração manual" className={outline}><X size={18}/></button>
   </header>
   <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1.08fr_.92fr] lg:gap-5 lg:p-6">
    <div className="space-y-4">
     <p className="text-sm text-white/70">Oriente o desenho pela parte de cima da planta e escolha os pontos numerados. Depois, informe as coordenadas dos quatro cantos em latitude e longitude.</p>
     <MapCalibrationOrientation selected={selectedCorner} mode={mode} values={values} onSelect={selectCorner}/>
     <div className="flex gap-2" role="group" aria-label="Quantidade de pontos de calibração">
      <button type="button" aria-pressed={mode==='4'} onClick={()=>{setReview(false);setError('');onModeChange('4');}} className={outline+' flex-1 '+(mode==='4'?'border-[#c4ff40] bg-[#c4ff40] font-black text-black':'')}>4 cantos · recomendado</button>
      <button type="button" aria-pressed={mode==='3'} onClick={()=>{setReview(false);setError('');onModeChange('3');}} className={outline+' flex-1 '+(mode==='3'?'border-[#c4ff40] bg-[#c4ff40] font-black text-black':'')}>3 pontos</button>
     </div>
     {mode==='3'&&<p role="status" className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">Com três pontos, o canto inferior direito será estimado como um paralelogramo. Pode não corresponder à geometria real. Prefira quatro cantos para melhor alinhamento.</p>}
     <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 px-1 text-[11px] font-semibold text-white/45"><span>Latitude</span><span>Longitude</span></div>
      {order.map((key,i)=>{
       const estimated=mode==='3'&&key==='br';
       return <div key={key} className={'rounded-xl border bg-white/[.025] p-2.5 '+(selectedCorner===key?'border-[#c4ff40]/60':'border-white/10')}>
        <div className="mb-2 flex items-center justify-between gap-2"><label className="text-xs font-semibold text-white" htmlFor={'cal-lat-'+key}><span className="mr-2 rounded-full bg-[#c4ff40]/15 px-2 py-0.5 text-[#c4ff40]">{i+1}</span>{'Ponto '+(i+1)}<span className="ml-2 text-[10px] font-normal text-white/50">{CALIBRATION_POINT_NAMES[key]}</span></label>
         {estimated&&<span className="text-[10px] text-amber-200">Estimado</span>}</div>
        <div className="grid grid-cols-2 gap-2">
         <input id={'cal-lat-'+key} aria-label={'Latitude '+CORNER_LABELS[key]} onFocus={()=>setSelectedCorner(key)} className={field} type="text" inputMode="decimal" placeholder="-23.450459" disabled={estimated} value={estimated&&result.ok?result.raw.br.lat.toFixed(6):values[key].lat} onChange={e=>change(key,'lat',e.target.value)}/>
         <input aria-label={'Longitude '+CORNER_LABELS[key]} className={field} onFocus={()=>setSelectedCorner(key)} type="text" inputMode="decimal" placeholder="-47.397806" disabled={estimated} value={estimated&&result.ok?result.raw.br.lng.toFixed(6):values[key].lng} onChange={e=>change(key,'lng',e.target.value)}/>
        </div>
       </div>;
      })}
     </div>
     <p className="text-xs text-white/50">A latitude e a longitude podem ser copiadas do Google Maps. Os números identificam os cantos técnicos do desenho: botões nas bordas servem só para selecionar, não para registrar o ponto médio de um lado.</p>
     {result.ok&&<div role="status" className="rounded-xl border border-[#c4ff40]/30 bg-[#c4ff40]/5 p-3 text-xs text-[#c4ff40]"><CheckCircle2 size={15} className="mr-1 inline"/> Geometria consistente · aproximadamente {result.width.toFixed(1)} m × {result.height.toFixed(1)} m.</div>}
     {error&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
     {review&&result.ok&&<div className="space-y-2 rounded-xl border-2 border-[#c4ff40]/60 bg-[#251d30] p-4">
      <h4 className="font-bold">Confirmar calibração</h4>
      <p className="text-sm text-white/75">Confirme a orientação dos cantos e o contorno. Será aplicada uma margem externa de 5 metros, como na calibração por GPS. {result.derived?'O quarto canto é estimado.':''}</p>
      <p className="text-xs text-amber-200">As coordenadas manuais não incluem uma medição de precisão GPS. A imagem de satélite serve apenas como referência.</p>
      <button type="button" className="w-full rounded-xl bg-[#c4ff40] px-4 py-3 text-sm font-black text-black" onClick={()=>onApply(result)}>Aplicar ao rascunho da planta</button>
     </div>}
    </div>
    <div className="space-y-3">
     <div className="overflow-hidden rounded-xl border border-white/15 bg-[#110e17]">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold"><span className="inline-flex items-center gap-2"><Satellite size={16} className="text-[#c4ff40]"/> Imagem de satélite · Google Maps</span><a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#c4ff40] hover:underline">Abrir Maps <ExternalLink size={12}/></a></div>
      <iframe title="Imagem de satélite do Google Maps" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-60 w-full border-0 sm:h-72 lg:h-80" src={displayUrl}/>
      <p className="px-3 py-2 text-[11px] text-white/50">Imagem fornecida pelo Google Maps. Se o mapa não carregar no navegador, use “Abrir Maps”. A referência central acompanha as coordenadas digitadas.</p>
     </div>
     <div className="space-y-2 rounded-xl border border-white/15 bg-[#110e17] p-3"><h4 className="text-xs font-semibold">Prévia dos quatro cantos · contorno estimado</h4><CornerSketch result={result}/><p className="text-[11px] text-white/50">Esboço matemático orientado pelas coordenadas, não sobreposto à imagem do Google Maps. A área real precisa ser conferida.</p></div>
     <div className="rounded-xl border border-white/10 bg-white/[.025] p-3 text-xs text-white/60">A calibração só substituirá a anterior após sua confirmação e será enviada ao servidor quando você clicar em <strong className="text-white">Salvar mapa</strong> no editor.</div>
    </div>
   </div>
   <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#17111e] p-4 sm:px-6">
    <button type="button" onClick={onBack} className={outline+' inline-flex items-center gap-2'}><ArrowLeft size={15}/> Escolher outro método</button>
    <div className="flex gap-2"><button type="button" onClick={onClose} className={outline}>Fechar</button>
     {!review&&<button type="button" onClick={next} className="rounded-xl bg-[#c4ff40] px-4 py-2.5 text-sm font-black text-black">Revisar calibração</button>}
     {review&&<button type="button" onClick={()=>setReview(false)} className={outline}>Corrigir pontos</button>}
    </div>
   </footer>
  </section>
 </div>;
}
