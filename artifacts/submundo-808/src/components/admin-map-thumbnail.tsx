import {useEffect,useState} from 'react';
import {Map} from 'lucide-react';
import {areaPath,visibleAreas,type AreaGeometry} from './map-area-shapes';

export type MapAreaPreview={
 id:string;map_id:string;x:number;y:number;width:number;height:number;
 color?:string;geometry?:AreaGeometry;
};

/** The two dashboards use the same persisted room geometry for their thumbnails. */
export function useAdminMapAreas(maps:ReadonlyArray<{id:string}>):MapAreaPreview[]{
 const [areas,setAreas]=useState<MapAreaPreview[]>([]);
 useEffect(()=>{
  let active=true;
  if(!maps.length){setAreas([]);return()=>{active=false;};}
  void fetch('/api/admin/areas',{credentials:'same-origin'})
   .then(async response=>{
    if(!response.ok)throw Error('Não foi possível carregar os ambientes.');
    return response.json();
   })
   .then(data=>{if(active)setAreas(Array.isArray(data.items)?data.items:[]);})
   .catch(()=>{if(active)setAreas([]);});
  return()=>{active=false;};
 },[maps]);
 return areas;
}

export function AdminMapThumbnail({areas}:{areas:MapAreaPreview[]}){
 return areas.length?<svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full p-4">
  {visibleAreas(areas).map(area=><path key={area.id} d={areaPath(areas,area.id)}
   fill={area.color||'#474d9c'} fillOpacity={.35} stroke="#c4ff40" strokeWidth={.75} fillRule="evenodd"/>)}
 </svg>:<Map size={39} className="text-[#c4ff40]/70"/>;
}
