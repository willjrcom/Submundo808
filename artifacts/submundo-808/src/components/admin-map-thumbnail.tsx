import {useEffect,useState} from 'react';
import {Map} from 'lucide-react';

export type MapAreaPreview={
 id:string;map_id:string;x:number;y:number;width:number;height:number;
 color?:string;geometry?:{shape?:string};
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
  {areas.map(area=>area.geometry?.shape==='ellipse'
   ?<ellipse key={area.id} cx={area.x+area.width/2} cy={area.y+area.height/2} rx={area.width/2} ry={area.height/2}
      fill={area.color||'#474d9c'} fillOpacity={.35} stroke="#c4ff40" strokeWidth={.75}/>
   :<rect key={area.id} x={area.x} y={area.y} width={area.width} height={area.height} rx="1"
      fill={area.color||'#474d9c'} fillOpacity={.35} stroke="#c4ff40" strokeWidth={.75}/>)}
 </svg>:<Map size={39} className="text-[#c4ff40]/70"/>;
}
