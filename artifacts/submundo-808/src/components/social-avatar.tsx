import {useState} from 'react';

export function initialsOf(name:string){
 const parts=name.trim().split(/\s+/u).filter(Boolean);
 return ((parts[0]?.[0]||'?')+(parts[1]?.[0]||'')).toLocaleUpperCase('pt-BR');
}
export default function SocialAvatar({name,avatar,size='md',className=''}:{name:string;avatar?:string|null;size?:'sm'|'md'|'lg';className?:string}){
 const [failed,setFailed]=useState(false);
 const dimensions=size==='sm'?'h-8 w-8 text-[11px]':size==='lg'?'h-14 w-14 text-lg':'h-11 w-11 text-sm';
 return <span aria-label={'Avatar de '+name} className={'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#c4ff40]/15 font-black text-[#c4ff40] '+dimensions+' '+className}>
  {avatar&&!failed&&/^data:image\/(webp|png|jpeg);base64,/.test(avatar)?<img src={avatar} alt="" onError={()=>setFailed(true)} className="h-full w-full object-cover"/>:initialsOf(name)}
 </span>;
}
