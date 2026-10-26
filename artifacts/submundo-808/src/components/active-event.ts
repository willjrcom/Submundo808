// Fonte única da seleção do evento na experiência do participante.
// O evento pertence à navegação do usuário, não às abas individualmente.
export const ACTIVE_EVENT_KEY='submundo-event-id';
export const ACTIVE_EVENT_CHANGED='submundo-event-selected';
export function eventIdFromPath(pathname:string):string{
 const parts=pathname.split('/').filter(Boolean);
 if(parts[0]!=='programacao'||parts.length!==2)return '';
 try{return decodeURIComponent(parts[1]);}catch{return '';}
}
export function getActiveEventId():string{
 return eventIdFromPath(window.location.pathname)||localStorage.getItem(ACTIVE_EVENT_KEY)||'';
}
export function setActiveEventId(id:string):void{
 if(!id)return;
 localStorage.setItem(ACTIVE_EVENT_KEY,id);
 window.dispatchEvent(new Event(ACTIVE_EVENT_CHANGED));
}
export function clearActiveEventId():void{
 localStorage.removeItem(ACTIVE_EVENT_KEY);
 window.dispatchEvent(new Event(ACTIVE_EVENT_CHANGED));
}
export function eventProgramPath(id:string):string{
 return '/programacao/'+encodeURIComponent(id);
}
