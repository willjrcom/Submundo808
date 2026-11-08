import {allCorners,measuredCorners,type CornerKey,type CalibrationGps} from './map-calibration-geometry';

const order:CornerKey[]=['tl','tr','br','bl'];
const names:Record<CornerKey,string>={
 tl:'Início do topo',tr:'Fim do topo',br:'Fim da base',bl:'Início da base'
};
export const formatMeters=(value:number)=>value.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' m';

/** Read-only measurement details. All calibration edits belong to the satellite editor. */
export default function CalibrationPointDetails({gps,distances}:{
 gps:CalibrationGps|undefined;
 distances:{start:CornerKey;end:CornerKey;meters:number}[];
}){
 const raw=measuredCorners(gps);
 if(!allCorners(raw))return null;
 return <>
  <div className="space-y-3 rounded-xl border border-white/10 p-3">
   <p className="text-xs font-bold text-white">Pontos de referência</p>
   {order.map((key,i)=><div key={key} className="flex items-start gap-2 text-xs">
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#c4ff40] text-[10px] font-black text-black">{i+1}</span>
    <div className="min-w-0 flex-1">
     <p className="font-semibold text-white">{names[key]}</p>
     <p className="break-all text-white/55">{raw[key].lat.toFixed(6)}, {raw[key].lng.toFixed(6)}</p>
    </div>
   </div>)}
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
