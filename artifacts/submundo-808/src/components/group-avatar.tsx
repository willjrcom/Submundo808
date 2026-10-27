import {useEffect,useState} from 'react';
import {Users} from 'lucide-react';

const icons:Record<string,string>={music:'🎵',fire:'🔥',party:'🎉',star:'⭐',heart:'💚'};
export default function GroupAvatar({name,color,icon='users',photo='',size='md'}:{name:string;color:string;icon?:string;photo?:string;size?:'sm'|'md'|'lg'}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[photo]);
 const dims=size==='sm'?'h-12 w-12 rounded-xl text-xl':size==='lg'?'h-20 w-20 rounded-2xl text-3xl':'h-16 w-16 rounded-2xl text-2xl';
 return <span aria-label={'Imagem do grupo '+name} className={'flex shrink-0 items-center justify-center overflow-hidden text-white '+dims} style={{backgroundColor:color}}>
  {photo&&!failed&&/^data:image\/webp;base64,/.test(photo)?<img src={photo} alt="" onError={()=>setFailed(true)} className="h-full w-full object-cover"/>:icon==='users'?<Users size={size==='lg'?35:size==='sm'?22:30}/>:<span>{icons[icon]||'👥'}</span>}
 </span>;
}
