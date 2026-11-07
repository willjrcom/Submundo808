import {Plus,Check,ArrowUp} from 'lucide-react';
import {parseManualCoordinate,type ManualPointMode,type ManualValues} from './map-calibration-manual';
import {type CornerKey} from './map-calibration-geometry';

const markers:{key:CornerKey;number:number;position:string;description:string}[]=[
 {key:'tl',number:1,position:'left-[27%] top-[15%]',description:'início da borda de cima'},
 {key:'tr',number:2,position:'left-[85%] top-[30%]',description:'fim da borda de cima'},
 {key:'br',number:3,position:'left-[73%] top-[85%]',description:'fim da borda de baixo'},
 {key:'bl',number:4,position:'left-[15%] top-[70%]',description:'início da borda de baixo'}
];
export const CALIBRATION_POINT_NAMES:Record<CornerKey,string>={
 tl:'Início do topo',tr:'Fim do topo',br:'Fim da base',bl:'Início da base'
};

export default function MapCalibrationOrientation({selected,mode,values,onSelect}:{
 selected:CornerKey;mode:ManualPointMode;values:ManualValues;onSelect:(key:CornerKey)=>void;
}){
 return <div className="space-y-2 rounded-xl border border-white/15 bg-[#110e18] p-3">
  <p className="text-xs font-bold text-white">Escolha um ponto no desenho</p>
  <p className="text-[11px] text-white/65">A seta indica a parte de cima da sua planta, não o norte geográfico.</p>
  <div className="relative mx-auto aspect-[1.5] w-full max-w-[330px]">
   <span className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-[#c4ff40]/15 px-2 py-1 text-[10px] font-bold text-[#c4ff40]"><ArrowUp size={12}/> TOPO DO DESENHO</span>
   <div aria-hidden="true" className="absolute inset-x-[15%] bottom-[15%] top-[15%] rounded-lg border-2 border-[#c4ff40]/70 bg-[#3b2860]/35 shadow-[inset_0_0_30px_#9747ff18]" style={{backgroundImage:'linear-gradient(#ffffff0b 1px,transparent 1px),linear-gradient(90deg,#ffffff0b 1px,transparent 1px)',backgroundSize:'16% 16%'}}/>
   <div aria-hidden="true" className="absolute inset-x-[20%] bottom-[22%] top-[22%] flex items-center justify-center text-center text-[10px] text-white/45">Esboço da planta</div>
   {markers.map(({key,number,position,description})=>{
    const filled=parseManualCoordinate(values[key].lat,90)!==null&&parseManualCoordinate(values[key].lng,180)!==null;
    const estimated=mode==='3'&&key==='br';
    return <button key={key} type="button" disabled={estimated} aria-pressed={selected===key}
     aria-label={'Selecionar ponto '+number+' · '+description}
     title={'Ponto '+number+' · '+description}
     onClick={()=>onSelect(key)}
     className={'absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-bold shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-60 '+position+' '+(selected===key?'border-white bg-[#c4ff40] text-black ring-2 ring-[#c4ff40]/50':filled?'border-[#c4ff40] bg-[#28391d] text-[#c4ff40]':'border-[#c4ff40]/80 bg-[#1b1523] text-[#c4ff40]')}>
     {estimated?<span className="text-[11px]">4*</span>:filled?<Check size={16}/>:<Plus size={16}/>}
     <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-[#191321] bg-[#c4ff40] text-[9px] font-black text-black">{number}</span>
    </button>;
   })}
  </div>
  <p className="text-[11px] leading-relaxed text-white/60">Os quatro botões ficam distribuídos pelas bordas para facilitar a seleção, mas cada número representa um <strong className="text-white">canto de referência</strong>, não o meio da borda. O desenho é esquemático e não precisa ter o formato real do local.</p>
 </div>;
}
