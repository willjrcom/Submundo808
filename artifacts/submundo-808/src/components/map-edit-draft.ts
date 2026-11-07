/**
 * Unpublished editor changes are kept on this device until explicitly saved
 * or discarded. This also survives a React error-boundary remount.
 */
export type DraftStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type MapEditDraft<A,M,F>={mapId:string;updatedAt:number;areas:A[];markers:M[];frame:F};
const PREFIX='submundo808:map-draft:v1:';
const MAX_AGE=14*24*60*60*1000;
const MAX_BYTES=2_000_000;
const key=(mapId:string)=>PREFIX+encodeURIComponent(mapId);
function availableStorage(store?:DraftStorage|null):DraftStorage|null{
 if(store!==undefined)return store;
 try{return typeof window!=='undefined'?window.localStorage:null;}catch{return null;}
}
export function readMapDraft<A,M,F>(mapId:string,store?:DraftStorage|null):MapEditDraft<A,M,F>|null{
 const storage=availableStorage(store);
 if(!storage)return null;
 try{
  const raw=storage.getItem(key(mapId));
  if(!raw)return null;
  if(raw.length>MAX_BYTES){storage.removeItem(key(mapId));return null;}
  const draft=JSON.parse(raw) as MapEditDraft<A,M,F>;
  if(draft?.mapId!==mapId||!Number.isFinite(draft.updatedAt)||
     draft.updatedAt>Date.now()+60_000||Date.now()-draft.updatedAt>MAX_AGE||
     !Array.isArray(draft.areas)||draft.areas.length>150||
     !Array.isArray(draft.markers)||draft.markers.length>250||
     !draft.frame||typeof draft.frame!=='object'||
     draft.areas.some(a=>!a||typeof a!=='object'||typeof (a as {id?:unknown}).id!=='string')||
     draft.markers.some(m=>!m||typeof m!=='object'||typeof (m as {id?:unknown}).id!=='string')){
   storage.removeItem(key(mapId));return null;
  }
  return draft;
 }catch{return null;}
}
export function persistMapDraft<A,M,F>(mapId:string,snapshot:{areas:A[];markers:M[];frame:F},store?:DraftStorage|null):boolean{
 const storage=availableStorage(store);
 if(!storage)return false;
 try{
  const body=JSON.stringify({mapId,updatedAt:Date.now(),...snapshot});
  if(body.length>MAX_BYTES)return false;
  storage.setItem(key(mapId),body);
  return true;
 }catch{return false;}
}
export function removeMapDraft(mapId:string,store?:DraftStorage|null):boolean{
 const storage=availableStorage(store);
 if(!storage)return false;
 try{storage.removeItem(key(mapId));return true;}catch{return false;}
}
