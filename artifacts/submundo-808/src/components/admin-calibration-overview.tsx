import {useState} from 'react';
import {CheckCircle2,ExternalLink,MapPin,RotateCcw,X} from 'lucide-react';
import {areaPath,groupMembers,visibleAreas,type GeometricArea} from './map-area-shapes';
import {allCorners,cornersGeometryValid,MAP_MARGIN_METERS,measuredCorners,type CalibrationGps,type CornerKey} from './map-calibration-geometry';
import {distanceMeters} from './map-location-utils';
import {googleMapsLink,mapPreviewPosition,manualValuesFromGps} from './map-calibration-manual';
import {calibrationPreviewProjection,coordinateString,projectEditorAreaPath,type PreviewPoint} from './map-calibration-preview-projection';
import CalibrationPointDetails,{formatMeters} from './admin-calibration-point-details';

type PreviewRoom=GeometricArea&{name?:string;color?:string};
const order:CornerKey[]=['tl','tr','br','bl'];
const WIDTH=420,HEIGHT=304;
const dimensionPairs:[CornerKey,CornerKey][]=[['tl','tr'],['tr','br'],['br','bl'],['bl','tl']];
const svgPoint=(p:PreviewPoint)=>p.x+','+p.y;

export default function AdminCalibrationOverview({mapName,gps,areas,hasUnsavedChanges,onClose,onRecalibrate,onApplyCoordinates}:{
 mapName:string;gps:CalibrationGps|undefined;areas:PreviewRoom[];
 hasUnsavedChanges:boolean;onClose:()=>void;onRecalibrate:()=>void;
 onApplyCoordinates:(result:Extract<import('./map-calibration-manual').ManualCalibrationResult,{ok:true}>)=>void;
}){
 const [preview,setPreview]=useState<{editing:boolean;valid:boolean;gps:CalibrationGps|null}>({
  editing:false,valid:true,gps:null
 });
 function previewCoordinates(nextGps:CalibrationGps|null,valid:boolean){
  // An incomplete or invalid coordinate must not break the map: retain the last valid preview.
  setPreview(current=>({editing:true,valid,gps:nextGps??current.gps}));
 }
 function endPreview(){setPreview({editing:false,valid:true,gps:null});}
 const displayGps=preview.editing&&preview.gps?preview.gps:gps;
 const raw=measuredCorners(displayGps);
 if(!allCorners(raw)||!cornersGeometryValid(raw))return null;
 // Saved coordinates already include the external margin. Use them for the shape
 // and the rooms; use rawCorner coordinates exclusively for numbered GPS markers.
 const frame=displayGps&&allCorners(displayGps)&&cornersGeometryValid(displayGps)?displayGps:raw;
 const projection=calibrationPreviewProjection(frame,{width:WIDTH,height:HEIGHT,padding:58});
 const outline=order.map(key=>svgPoint(projection.corners[key])).join(' ');
 const width=(distanceMeters(raw.tl,raw.tr)+distanceMeters(raw.bl,raw.br))/2;
 const height=(distanceMeters(raw.tl,raw.bl)+distanceMeters(raw.tr,raw.br))/2;
 const position=mapPreviewPosition(manualValuesFromGps(displayGps),displayGps);
 const satelliteUrl=googleMapsLink(position,mapName);
 const arrowStart=projection.pointAt(50,16),arrowTip=projection.pointAt(50,-5);
 const angle=Math.atan2(arrowTip.y-arrowStart.y,arrowTip.x-arrowStart.x);
 const headA={x:arrowTip.x-9*Math.cos(angle-.45),y:arrowTip.y-9*Math.sin(angle-.45)};
 const headB={x:arrowTip.x-9*Math.cos(angle+.45),y:arrowTip.y-9*Math.sin(angle+.45)};
 // Use raw measured corners for the metric value and the visible outer green outline for label position.
 const dimensions=dimensionPairs.map(([start,end])=>{
  const a=projection.corners[start],b=projection.corners[end];
  const dx=b.x-a.x,dy=b.y-a.y;
  const length=Math.hypot(dx,dy);
  const rawAngle=Math.atan2(dy,dx)*180/Math.PI;
  const angle=rawAngle>90?rawAngle-180:rawAngle< -90?rawAngle+180:rawAngle;
  const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  const meters=distanceMeters(raw[start],raw[end]);
  return {start,end,meters,label:formatMeters(meters),center,angle,length};
 });
 const rooms=visibleAreas(areas).map(area=>{
  const members=groupMembers(areas,area.id);
  const ellipse=members.length===1&&area.geometry?.shape==='ellipse'
   ?{x:area.x,y:area.y,width:area.width,height:area.height}:undefined;
  return {...area,projectedPath:projectEditorAreaPath(areaPath(areas,area.id),projection.pointAt,ellipse)};
 });
 return <div role="presentation" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-2 sm:p-4" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section role="dialog" aria-modal="true" aria-label="Ver calibração do mapa" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#c4ff40]/40 bg-[#17111e] shadow-2xl">
   <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-4 sm:px-6">
    <div className="flex items-center gap-3"><CheckCircle2 className="text-[#c4ff40]" size={22}/><div><h3 className="text-lg font-black">Ver calibração</h3><p className="text-xs text-white/60">{mapName} · quatro pontos configurados</p></div></div>
    <button type="button" aria-label="Fechar visualização da calibração" onClick={onClose} className="rounded-xl border border-white/20 p-2.5 hover:border-[#c4ff40]/60"><X size={18}/></button>
   </header>
   <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 lg:grid-cols-[1.2fr_.8fr] lg:p-6">
    <div className="space-y-3">
     <div className="rounded-xl border border-white/15 bg-[#100d17] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-white">Planta na orientação geográfica real</p><span className="text-[10px] font-semibold text-[#c4ff40]">Norte para cima · escala proporcional</span></div>
      {preview.editing&&<p role="status" className={'mb-2 rounded-lg border px-3 py-2 text-xs '+(preview.valid?'border-[#c4ff40]/30 bg-[#c4ff40]/5 text-[#c4ff40]':'border-amber-400/30 bg-amber-400/5 text-amber-200')}>
       {preview.valid?'Prévia em tempo real · alterações ainda não aplicadas.':'Coordenadas incompletas ou inválidas · mantendo a última prévia válida.'}
      </p>}
      <svg viewBox={'0 0 '+WIDTH+' '+HEIGHT} role="img" aria-label="Vista geográfica com norte para cima, limites e ambientes nas coordenadas calibradas" className="w-full">
       <rect width={WIDTH} height={HEIGHT} rx="10" fill="#130f1b"/>
       {Array.from({length:9},(_,i)=><g key={i} stroke="#ffffff0b" strokeWidth="1"><path d={'M'+(i*50)+' 0V'+HEIGHT}/><path d={'M0 '+(i*38)+' H'+WIDTH}/></g>)}
       <polygon points={outline} fill="#251b34" stroke="#9747ff" strokeWidth="1.7"/>
       {rooms.map(area=><path key={area.id}
        d={area.projectedPath}
        fill={/^#[0-9a-fA-F]{6}$/.test(area.color||'')?area.color+'50':'#9747ff50'}
        stroke={/^#[0-9a-fA-F]{6}$/.test(area.color||'')?area.color:'#a78bfa'}
        strokeWidth="1.25" fillRule="evenodd"><title>{area.name||'Ambiente'}</title></path>)}
       <polygon points={outline} fill="none" stroke="#c4ff40" strokeWidth="2"/>
       <g aria-label="Direção do topo do desenho" stroke="#c4ff40" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={'M'+coordinateString(arrowStart)+' L'+coordinateString(arrowTip)}/>
        <path d={'M'+coordinateString(headA)+' L'+coordinateString(arrowTip)+' L'+coordinateString(headB)}/>
       </g>
       <g aria-label="Cotas entre pontos">
        {dimensions.map(d=><text key={d.start+'-'+d.end}
         x={d.center.x} y={d.center.y}
         transform={'rotate('+d.angle+' '+d.center.x+' '+d.center.y+')'}
         textAnchor="middle" dominantBaseline="middle"
         fontSize={d.length<68?9:11} fontWeight="800"
         fill="#e6ffc4" stroke="#17111e" strokeWidth="4" strokeLinejoin="round"
         paintOrder="stroke">{d.label}</text>)}
       </g>
       {order.map((key,i)=>{
        const pin=projection.projectGps(raw[key]);
        return <g key={key}><circle cx={pin.x} cy={pin.y} r="11" fill="#c4ff40" stroke="#17111e" strokeWidth="2"/><text x={pin.x} y={pin.y+4} fill="#17111e" fontSize="12" fontWeight="900" textAnchor="middle">{i+1}</text></g>;
       })}
       <g aria-label="Norte geográfico" fill="#e4e4e7"><text x={WIDTH-19} y="19" fontSize="13" textAnchor="end" fontWeight="800">N ↑</text></g>
      </svg>
      <p className="mt-1 text-[11px] leading-relaxed text-white/60">Projeção geográfica vista de cima: o norte permanece para cima, enquanto a seta verde aponta para o topo do seu desenho. A borda verde utiliza os limites salvos (com a margem, quando configurada); os números indicam os pontos originais. A metragem aparece diretamente sobre cada lado verde e corresponde à distância entre os pontos medidos, sem a margem externa de 5 m. A imagem não contém fotografia de satélite nem relevo 3D.</p>
     </div>
     <a href={satelliteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#c4ff40] hover:underline"><MapPin size={14}/> Conferir localização no Google Maps <ExternalLink size={12}/></a>
    </div>
    <div className="space-y-3">
     {hasUnsavedChanges&&<p role="status" className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-200">Há alterações não salvas no editor. Esta tela mostra os dados atuais; use Salvar mapa para publicá-los.</p>}
     <div className="rounded-xl border border-[#c4ff40]/25 bg-[#c4ff40]/5 p-3">
      <p className="flex items-center gap-2 text-sm font-bold text-[#c4ff40]"><CheckCircle2 size={16}/> Geometria de calibração válida</p>
      <p className="mt-1 text-xs text-white/65">{gps?.origin==='gps'?'Coordenadas coletadas por GPS.':gps?.origin==='coordinates'?'Coordenadas informadas manualmente.':'Origem das coordenadas não informada.'}</p>
     </div>
     <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-lg border border-white/10 p-3"><p className="text-white/55">Largura média</p><strong className="mt-1 block text-lg text-white">{width.toFixed(1)} m</strong></div>
      <div className="rounded-lg border border-white/10 p-3"><p className="text-white/55">Comprimento médio</p><strong className="mt-1 block text-lg text-white">{height.toFixed(1)} m</strong></div>
     </div>
     <p className="rounded-lg border border-white/10 p-3 text-xs text-white/70">{displayGps?.marginMeters===MAP_MARGIN_METERS?'Margem externa registrada: 5 metros em cada borda.':'Calibração anterior sem confirmação de margem externa de 5 metros.'} As dimensões acima usam os pontos originais, antes da margem.</p>
     <CalibrationPointDetails gps={gps} distances={dimensions} onApply={onApplyCoordinates} onPreviewChange={previewCoordinates} onPreviewEnd={endPreview}/>
     <p className="text-xs text-white/55">Se os pontos ainda parecerem invertidos em comparação ao satélite, confira a associação das coordenadas aos quatro cantos antes de recalibrar.</p>
    </div>
   </div>
   <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-white/10 p-4 sm:px-6">
    <button type="button" onClick={onClose} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold">Fechar</button>
    <button type="button" onClick={onRecalibrate} className="inline-flex items-center gap-2 rounded-xl bg-[#c4ff40] px-4 py-2.5 text-sm font-black text-black"><RotateCcw size={16}/> Recalibrar</button>
   </footer>
  </section>
 </div>;
}
