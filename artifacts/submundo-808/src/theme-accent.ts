import {accentTextColor,readableAccentOnDark} from './accent-contrast';
const DEFAULT_ACCENT='#c4ff40';
let current=DEFAULT_ACCENT;
export function applyAccentColor(color:string){
 if(!/^#[0-9a-fA-F]{6}$/.test(color))return;
 current=color.toLowerCase();
 document.documentElement.style.setProperty('--submundo-accent',current);
 document.documentElement.style.setProperty('--submundo-accent-foreground',accentTextColor(current));
 document.documentElement.style.setProperty('--submundo-accent-readable',readableAccentOnDark(current));
 const old=document.getElementById('submundo-dynamic-accent');
 if(old)return;
 const style=document.createElement('style');
 style.id='submundo-dynamic-accent';
 const token=(name:string)=>'[class~="'+name+'"]';
 const rules:string[]=[];
 const foreground=['text-[#c4ff40]','group-hover:text-[#c4ff40]'];
 for(const x of foreground)rules.push(token(x)+(x.startsWith('group-hover:')?':hover':'')+'{color:var(--submundo-accent-readable)!important}');
 for(const x of ['bg-[#c4ff40]','hover:bg-[#c4ff40]'])rules.push(token(x)+(x.startsWith('hover:')?':hover':'')+'{background-color:var(--submundo-accent)!important;color:var(--submundo-accent-foreground)!important}');
 for(const x of ['border-[#c4ff40]','hover:border-[#c4ff40]'])rules.push(token(x)+(x.startsWith('hover:')?':hover':'')+'{border-color:var(--submundo-accent-readable)!important}');
 const variants=[10,15,20,25,30,35,40,50,60,65,70,75,80,90];
 for(const a of variants){
  const pct=a+'%';
  rules.push(token('bg-[#c4ff40]/'+a)+'{background-color:color-mix(in srgb,var(--submundo-accent) '+pct+',transparent)!important}');
  rules.push(token('border-[#c4ff40]/'+a)+'{border-color:color-mix(in srgb,var(--submundo-accent) '+pct+',transparent)!important}');
  rules.push(token('hover:border-[#c4ff40]/'+a)+':hover{border-color:color-mix(in srgb,var(--submundo-accent) '+pct+',transparent)!important}');
  rules.push(token('hover:bg-[#c4ff40]/'+a)+':hover{background-color:color-mix(in srgb,var(--submundo-accent) '+pct+',transparent)!important}');
  rules.push(token('text-[#c4ff40]/'+a)+'{color:color-mix(in srgb,var(--submundo-accent) '+pct+',transparent)!important}');
 }
 rules.push(token('accent-[#c4ff40]')+'{accent-color:var(--submundo-accent)!important}');
 rules.push(token('focus-visible:outline-[#c4ff40]')+':focus-visible{outline-color:var(--submundo-accent-readable)!important}');
 rules.push('::selection{background:var(--submundo-accent);color:var(--submundo-accent-foreground)}');
 style.textContent=rules.join('\n');
 document.head.append(style);
}
export async function loadAccentColor(){
 try{
  const response=await fetch('/api/public/branding');
  if(!response.ok)return;
  const data=await response.json();
  applyAccentColor(data.color||DEFAULT_ACCENT);
 }catch{/* Keep the default palette when offline. */}
}
export const DEFAULT_COLOR=DEFAULT_ACCENT;
