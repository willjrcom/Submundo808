import {useState} from 'react';
import {Pencil,Check,X} from 'lucide-react';
import {allCorners,measuredCorners,type CornerKey,type CalibrationGps} from './map-calibration-geometry';
import {buildManualCalibration,manualValuesFromGps,type ManualValues,type ManualCalibrationResult} from './map-calibration-manual';

const order:CornerKey[]=['tl','tr','br','bl'];
const names:Record<CornerKey,string>={
 tl:'Início do topo',tr:'Fim do topo',br:'Fim da base',bl:'Início da base'
};
export const formatMeters=(value:number)=>value.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' m';

export default function CalibrationPointDetails({gps,distances,onApply}:{
 gps:CalibrationGps|undefined;
 distances:{start:CornerKey;end:CornerKey;meters:number}[];
 onApply:(result:Extract<ManualCalibrationResult,{ok:true}>)=>void;
}){
 const [editing,setEditing]=useState(false);
 const [values,setValues]=useState<ManualValues>(()=>manualValuesFromGps(gps));
 const [error,setError]=useState('');
 const raw=measuredCorners(gps);
 if(!allCorners(raw))return null;
 function beginEdit(){setValues(manualValuesFromGps(gps));setError('');setEditing(true);}
 function cancelEdit(){setError('');setEditing(false);}
 function applyEdit(){
  const result=buildManualCalibration(values,'4');
  if(!result.ok){setError(result.error);return;}
  onApply(result);
  setError('');setEditing(false);
 }
 return <>
  <div className="space-y-3 rounded-xl border border-white/10 p-3">
   <div className="flex items-center justify-between gap-2">
    <p className="text-xs font-bold text-white">Pontos de referência</p>
    {!editing&&<button type="button" onClick={beginEdit} aria-label="Editar latitude e longitude" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#c4ff40]/40 px-3 py-1.5 text-xs font-bold text-[#c4ff40] hover:bg-[#c4ff40]/10"><Pencil size={13}/> Editar</button>}
   </div>
   {editing&&<p className="text-xs leading-relaxed text-white/60">Edite os quatro pontos. Aplicar recalcula os limites e a margem de 5 m, mas não publica o mapa automaticamente.</p>}
   {order.map((key,i)=><div key={key} className="flex items-start gap-2 text-xs">
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#c4ff40] text-[10px] font-black text-black">{i+1}</span>
    <div className="min-w-0 flex-1">
     <p className="font-semibold text-white">{names[key]}</p>
     {editing?<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <label className="space-y-1 text-[11px] text-white/65">Latitude
       <input type="text" inputMode="decimal" aria-label={'Latitude do ponto '+(i+1)} autoComplete="off" value={values[key].lat} onChange={event=>{setError('');setValues(current=>({...current,[key]:{...current[key],lat:event.target.value}}));}} className="w-full min-w-0 rounded-lg border border-white/20 bg-[#100d17] px-2 py-2 text-sm text-white outline-none focus:border-[#c4ff40]"/>
      </label>
      <label className="space-y-1 text-[11px] text-white/65">Longitude
       <input type="text" inputMode="decimal" aria-label={'Longitude do ponto '+(i+1)} autoComplete="off" value={values[key].lng} onChange={event=>{setError('');setValues(current=>({...current,[key]:{...current[key],lng:event.target.value}}));}} className="w-full min-w-0 rounded-lg border border-white/20 bg-[#100d17] px-2 py-2 text-sm text-white outline-none focus:border-[#c4ff40]"/>
      </label>
     </div>:<p className="break-all text-white/55">{raw[key].lat.toFixed(6)}, {raw[key].lng.toFixed(6)}</p>}
    </div>
   </div>)}
   {editing&&<div className="space-y-2 border-t border-white/10 pt-3">
    {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
    <div className="grid grid-cols-2 gap-2">
     <button type="button" onClick={cancelEdit} className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/20 px-3 py-2.5 text-xs font-semibold"><X size={14}/> Cancelar</button>
     <button type="button" onClick={applyEdit} className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#c4ff40] px-3 py-2.5 text-xs font-black text-black"><Check size={14}/> Aplicar ao rascunho</button>
    </div>
   </div>}
  </div>
  <div className="space-y-2 rounded-xl border border-white/10 p-3">
   <p className="text-xs font-bold text-white">Medidas entre os pontos</p>
   <div className="grid grid-cols-2 gap-2">
    {distances.map(d=><div key={d.start+'-'+d.end} className="rounded-lg bg-white/[.04] px-3 py-2 text-xs">
     <p className="text-white/55">{order.indexOf(d.start)+1} → {order.indexOf(d.end)+1}</p>
     <strong className="mt-1 block text-sm text-white">{formatMeters(d.meters)}</strong>
    </div>)}
   </div>
   <p className="text-[11px] text-white/45">Distâncias aproximadas, medidas entre as coordenadas originais (sem a margem de 5 m).</p>
  </div>
 </>;
}
