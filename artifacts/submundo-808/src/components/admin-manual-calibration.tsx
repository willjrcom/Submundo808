import {useState} from 'react';
import {MapPin,Satellite,X,SlidersHorizontal,Plus,Navigation,Pencil,ChevronDown} from 'lucide-react';
import AdminCalibrationSatelliteMap from './admin-calibration-satellite-map';
import {distanceMeters} from './map-location-utils';
import {type CornerKey} from './map-calibration-geometry';
import {buildManualCalibration,parseManualCoordinate,CORNER_LABELS,type ManualValues,type ManualCalibrationResult} from './map-calibration-manual';
import {CALIBRATION_POINT_NAMES} from './map-calibration-orientation';

const outline='rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#c4ff40]/55 disabled:cursor-not-allowed disabled:opacity-40';
const field='w-full min-w-0 rounded-lg border border-white/15 bg-[#241b2d] px-2.5 py-2 text-xs text-white outline-none focus:border-[#c4ff40]';
const order:CornerKey[]=['tl','tr','br','bl'];

export default function AdminManualCalibration({mapName,values,onChange,onClose,onApply}:{
 mapName:string;
 values:ManualValues;
 onChange:(key:CornerKey,field:'lat'|'lng',value:string)=>void;
 onClose:()=>void;
 onApply:(result:Extract<ManualCalibrationResult,{ok:true}>)=>Promise<void>;
}){
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);
 const [selectedCorner,setSelectedCorner]=useState<CornerKey>('tl');
 const [coordinatesOpen,setCoordinatesOpen]=useState(false);
 const [mapType,setMapType]=useState<'satellite'|'roadmap'>('satellite');
 const [opacity,setOpacity]=useState(55);
 const [showOutline,setShowOutline]=useState(true);
 const [showMeasures,setShowMeasures]=useState(true);
 const result=buildManualCalibration(values,'4');
 const change=(key:CornerKey,field:'lat'|'lng',value:string)=>{
  setError('');onChange(key,field,value);
 };
 const setMapCorner=(key:CornerKey,lat:number,lng:number)=>{
  setError('');
  // React batches both coordinates; the same values update the satellite overlay.
  onChange(key,'lat',lat.toFixed(7));
  onChange(key,'lng',lng.toFixed(7));
 };
 const measured=order.map((key,i)=>{
  const other=order[(i+1)%order.length];
  const lat=parseManualCoordinate(values[key].lat,90),lng=parseManualCoordinate(values[key].lng,180);
  const lat2=parseManualCoordinate(values[other].lat,90),lng2=parseManualCoordinate(values[other].lng,180);
  if(lat===null||lng===null||lat2===null||lng2===null)return {key,other,meters:null};
  return {key,other,meters:distanceMeters({lat,lng},{lat:lat2,lng:lng2})};
 });
 async function applyCalibration(){
  if(saving)return;
  if(!result.ok){setError(result.error);return;}
  setError('');setSaving(true);
  try{await onApply(result);}
  catch(err){setError(err instanceof Error?err.message:'Não foi possível salvar a calibração. Tente novamente.');}
  finally{setSaving(false);}
 }
 return <div role="presentation" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-2 sm:p-4">
  <section role="dialog" aria-modal="true" aria-label="Calibração manual de mapa" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-[#c4ff40]/40 bg-[#17111e] shadow-2xl">
   <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-4 sm:px-6">
    <div className="flex items-center gap-3"><MapPin className="text-[#c4ff40]" size={22}/><div><h3 className="text-lg font-black">Ajustar calibração pelo mapa</h3><p className="text-xs text-white/55">{mapName} · posicione os quatro pontos no satélite</p></div></div>
    <button type="button" disabled={saving} onClick={onClose} aria-label="Fechar calibração manual" className={outline}><X size={18}/></button>
   </header>
   <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-3 lg:grid-cols-[minmax(250px,310px)_minmax(0,1fr)] lg:gap-5 lg:p-6">
    <div className="space-y-4">
     <section className="space-y-3 rounded-xl border border-white/15 bg-[#110e17] p-3">
      <h4 className="text-sm font-bold text-white">Pontos do mapa</h4>
      <p className="text-xs leading-relaxed text-white/60">Selecione o <strong className="text-[#c4ff40]">+</strong> do ponto desejado e toque no satélite para posicioná-lo. Para ajustes finos, arraste o ponto.</p>
      <div className="space-y-1">
       {order.map((key,i)=>{
        const lat=parseManualCoordinate(values[key].lat,90),lng=parseManualCoordinate(values[key].lng,180);
        const filled=lat!==null&&lng!==null;
        return <button key={key} type="button" disabled={saving} aria-pressed={selectedCorner===key} aria-label={'Selecionar ponto '+(i+1)+' para marcar no satélite'} onClick={()=>setSelectedCorner(key)} className={'flex min-h-14 w-full items-center gap-3 rounded-xl border p-2.5 text-left transition '+(selectedCorner===key?'border-[#c4ff40] bg-[#c4ff40]/10':'border-transparent bg-white/[.035] hover:border-white/20')}>
         <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black '+(selectedCorner===key?'border-white bg-[#c4ff40] text-[#17111e]':'border-[#c4ff40] text-[#c4ff40]')}>{filled?i+1:<Plus size={17}/>}</span>
         <span className="min-w-0 flex-1"><strong className="block text-xs text-white">{'Ponto '+(i+1)} · {CALIBRATION_POINT_NAMES[key]}</strong><span className="block truncate text-[11px] text-white/50">{filled?lat!.toFixed(6)+', '+lng!.toFixed(6):'Toque no satélite para definir'}</span></span>
         <MapPin size={15} className={selectedCorner===key?'text-[#c4ff40]':'text-white/35'}/>
        </button>;
       })}
      </div>
      <div className="border-t border-white/10 pt-2">
       <button type="button" disabled={saving} aria-expanded={coordinatesOpen} aria-controls="calibration-coordinate-fields" onClick={()=>setCoordinatesOpen(open=>!open)} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/5 hover:text-[#c4ff40]">
        <Pencil size={13}/> Editar coordenadas <ChevronDown size={13} className={coordinatesOpen?'rotate-180':''}/>
       </button>
       {coordinatesOpen&&<div id="calibration-coordinate-fields" className="mt-2 space-y-3 rounded-xl border border-white/10 bg-white/[.025] p-3">
        <p className="text-[11px] leading-relaxed text-white/60">Ajuste fino opcional por latitude e longitude. O contorno no satélite acompanha as alterações.</p>
        {order.map((key,i)=><div key={key} className="space-y-1.5">
         <p className="text-xs font-semibold text-white">{'Ponto '+(i+1)} · {CALIBRATION_POINT_NAMES[key]}</p>
         <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[10px] text-white/50">Latitude
           <input type="text" inputMode="decimal" disabled={saving} aria-label={'Latitude '+CORNER_LABELS[key]} value={values[key].lat} onFocus={()=>setSelectedCorner(key)} onChange={e=>change(key,'lat',e.target.value)} className={field}/>
          </label>
          <label className="space-y-1 text-[10px] text-white/50">Longitude
           <input type="text" inputMode="decimal" disabled={saving} aria-label={'Longitude '+CORNER_LABELS[key]} value={values[key].lng} onFocus={()=>setSelectedCorner(key)} onChange={e=>change(key,'lng',e.target.value)} className={field}/>
          </label>
         </div>
        </div>)}
       </div>}
      </div>
     </section>
     <section className="space-y-3 rounded-xl border border-white/15 bg-[#110e17] p-3">
      <h4 className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal size={16} className="text-[#c4ff40]"/> Visualização</h4>
      <label className="flex items-center justify-between text-xs text-white/70" htmlFor="satellite-calibration-opacity"><span>Opacidade da planta</span><span>{opacity}%</span></label>
      <input id="satellite-calibration-opacity" disabled={saving} aria-label="Opacidade da planta" type="range" min="0" max="100" step="5" value={opacity} onChange={e=>setOpacity(Number(e.target.value))} className="w-full accent-[#c4ff40]"/>
      <label className="flex items-center gap-2 text-xs text-white/75"><input type="checkbox" disabled={saving} checked={showOutline} onChange={e=>setShowOutline(e.target.checked)} className="accent-[#c4ff40]"/> Mostrar contorno da planta</label>
      <label className="flex items-center gap-2 text-xs text-white/75"><input type="checkbox" disabled={saving} checked={showMeasures} onChange={e=>setShowMeasures(e.target.checked)} className="accent-[#c4ff40]"/> Mostrar medidas (m)</label>
     </section>
     <p className="rounded-lg border border-white/10 bg-white/[.03] p-3 text-[11px] leading-relaxed text-white/60"><Navigation size={13} className="mr-1 inline text-[#c4ff40]"/> O mapa mantém o norte para cima. A direção do topo da planta é indicada pela linha verde entre os pontos 1 e 2.</p>
    </div>
    <div className="min-w-0 space-y-3">
     <div className="rounded-xl border border-white/15 bg-[#110e17] p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
       <p className="flex items-center gap-2 text-xs font-bold"><Satellite size={16} className="text-[#c4ff40]"/> Mapa geográfico para calibração</p>
       <div role="group" aria-label="Tipo de mapa" className="flex rounded-lg border border-white/15 p-1">
        <button type="button" disabled={saving} aria-pressed={mapType==='roadmap'} onClick={()=>setMapType('roadmap')} className={'rounded-md px-2 py-1 text-xs '+(mapType==='roadmap'?'bg-[#c4ff40] font-bold text-black':'text-white/60')}>Mapa</button>
        <button type="button" disabled={saving} aria-pressed={mapType==='satellite'} onClick={()=>setMapType('satellite')} className={'rounded-md px-2 py-1 text-xs '+(mapType==='satellite'?'bg-[#c4ff40] font-bold text-black':'text-white/60')}>Satélite</button>
       </div>
      </div>
      <AdminCalibrationSatelliteMap mapName={mapName} values={values} selected={selectedCorner} onSelect={setSelectedCorner}
       onMove={setMapCorner} opacity={opacity} showOutline={showOutline} showMeasures={showMeasures} mapKind={mapType}/>
     </div>
     <section className="rounded-xl border border-white/15 bg-[#110e17] p-3">
      <h4 className="mb-3 text-sm font-bold">Medidas atuais da planta</h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
       {measured.map(({key,other,meters})=><div key={key} className="rounded-lg bg-white/[.035] p-2 text-xs"><p className="text-white/55">{order.indexOf(key)+1} → {order.indexOf(other)+1}</p><strong className="block pt-1 text-sm text-[#c4ff40]">{meters===null?'—':meters.toLocaleString('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1})+' m'}</strong></div>)}
      </div>
     </section>
     {result.ok?<p role="status" className="rounded-xl border border-[#c4ff40]/30 bg-[#c4ff40]/5 px-3 py-2.5 text-xs text-[#c4ff40]">Geometria válida. A margem externa de 5 metros será reaplicada ao salvar.</p>
      :<p role="status" className="rounded-xl border border-white/15 bg-white/[.025] px-3 py-2.5 text-xs text-white/60">Posicione quatro pontos válidos no satélite para salvar a calibração.</p>}
     {error&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    </div>
   </div>
   <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-[#17111e] p-4 sm:px-6">
    <button type="button" disabled={saving} onClick={onClose} className={outline}>Fechar</button>
    <button type="button" disabled={saving} onClick={()=>void applyCalibration()} className="rounded-xl bg-[#c4ff40] px-4 py-2.5 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-45">{saving?'Salvando calibração...':'Aplicar calibração'}</button>
   </footer>
  </section>
 </div>;
}
