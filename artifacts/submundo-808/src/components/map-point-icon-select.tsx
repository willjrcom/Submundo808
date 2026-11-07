import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react';
import {ChevronDown,Check} from 'lucide-react';
import {
 POINT_ICON_OPTIONS,defaultPointIconId,pointIconName,isPointIconId,
 type PointIconId
} from './map-point-icon-catalog';
import {pointIconFor,POINT_ICON_COMPONENTS} from './map-point-icons';

type Choice={id:string;name:string};
export default function MapPointIconSelect({type,icon,onChange}:{
 type:string;icon?:string;onChange:(value:string|undefined)=>void
}){
 const [open,setOpen]=useState(false);
 const [highlight,setHighlight]=useState(0);
 const root=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const optionRefs=useRef<Array<HTMLButtonElement|null>>([]);
 const listId=useId();
 const validSelection=isPointIconId(icon)?icon:'';
 const defaults=defaultPointIconId(type);
 const options:Choice[]=[
  {id:'',name:'Automático · '+pointIconName(defaults)},
  ...POINT_ICON_OPTIONS
 ];
 const selectedIndex=Math.max(0,options.findIndex(option=>option.id===validSelection));
 const SelectedIcon=pointIconFor(type,icon);
 useEffect(()=>{
  if(!open)return;
  const onOutside=(event:PointerEvent)=>{
   if(!root.current?.contains(event.target as Node))setOpen(false);
  };
  document.addEventListener('pointerdown',onOutside);
  return()=>document.removeEventListener('pointerdown',onOutside);
 },[open]);
 useEffect(()=>{
  if(open)optionRefs.current[highlight]?.scrollIntoView({block:'nearest'});
 },[open,highlight]);
 const choose=(value:string)=>{
  onChange(value||undefined);
  setOpen(false);
  trigger.current?.focus();
 };
 const onKeys=(event:KeyboardEvent<HTMLButtonElement>)=>{
  if(event.key==='Escape'){if(open){event.preventDefault();setOpen(false);}return;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End'){
   event.preventDefault();
   if(!open){setHighlight(selectedIndex);setOpen(true);return;}
   setHighlight(i=>event.key==='Home'?0:event.key==='End'?options.length-1
    :(i+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);
  }else if(open&&(event.key==='Enter'||event.key===' ')){
   event.preventDefault();choose(options[highlight].id);
  }
 };
 return <div ref={root} className="relative space-y-1">
  <p id={listId+'-label'} className="text-xs text-white/65">Ícone exibido no mapa</p>
  <button ref={trigger} type="button" role="combobox" aria-labelledby={listId+'-label'}
   aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
   aria-activedescendant={open?listId+'-option-'+highlight:undefined}
   onClick={()=>{setHighlight(selectedIndex);setOpen(value=>!value);}}
   onKeyDown={onKeys}
   className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-[#1b1624] px-3 py-2.5 text-left text-sm text-white outline-none hover:border-white/35 focus-visible:border-[#c4ff40]">
   <SelectedIcon size={19} className="shrink-0 text-[#c4ff40]"/>
   <span className="min-w-0 flex-1 truncate">{validSelection?pointIconName(validSelection as PointIconId):'Automático · '+pointIconName(defaults)}</span>
   <ChevronDown size={16} className={'shrink-0 text-white/60 transition '+(open?'rotate-180':'')}/>
  </button>
  {open&&<div id={listId} role="listbox" aria-labelledby={listId+'-label'} className="absolute inset-x-0 top-full z-[80] mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-[#c4ff40]/40 bg-[#211729] p-1.5 shadow-2xl">
   {options.map((option,index)=>{
    const Icon=option.id?POINT_ICON_COMPONENTS[option.id as PointIconId]:pointIconFor(type);
    return <button key={option.id||'auto'} type="button" id={listId+'-option-'+index}
     ref={element=>{optionRefs.current[index]=element;}} tabIndex={-1} role="option"
     aria-selected={selectedIndex===index} onMouseEnter={()=>setHighlight(index)}
     onClick={()=>choose(option.id)}
     className={'flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition '+
       (highlight===index?'bg-[#c4ff40]/15 text-[#c4ff40]':'text-white/85 hover:bg-white/10')}>
     <Icon size={18} className="shrink-0"/><span className="min-w-0 flex-1 truncate">{option.name}</span>
     {selectedIndex===index&&<Check size={15} className="shrink-0 text-[#c4ff40]"/>}
    </button>;
   })}
  </div>}
  <p className="text-[11px] leading-relaxed text-white/45">A escolha muda somente o desenho. O tipo do ponto e suas regras continuam iguais.</p>
 </div>;
}
