/** Offline snapshots of publicly published event data only.
 * Never store authenticated APIs, friends' coordinates, sessions or user identity.
 * Both this warmup and sw.js use the same public cache name.
 */
export const PARTICIPANT_PUBLIC_CACHE='submundo-808-public-v1';
const PUBLIC_PATHS=new Set(['events','maps','map-detail','menu','branding','event-settings']);
const LIMIT=32;
function validPublicPath(path:string):boolean {
 const url=new URL(path,window.location.origin);
 return url.origin===window.location.origin&&url.pathname.startsWith('/api/public/')&&
  PUBLIC_PATHS.has(url.pathname.split('/').pop()||'');
}
async function cachePublicJson(path:string):Promise<unknown>{
 if(!validPublicPath(path))throw Error('Public cache path not allowed');
 const request=new Request(path,{credentials:'omit'});
 try{
  const response=await fetch(request);
  if(!response.ok)throw Error('Public data unavailable');
  const json=await response.clone().json();
  if('caches'in window){
   try{const cache=await caches.open(PARTICIPANT_PUBLIC_CACHE);await cache.put(request,response.clone());}catch{/* Storage quota or private mode. */}
  }
  return json;
 }catch{
  if('caches'in window){
   const cached=await (await caches.open(PARTICIPANT_PUBLIC_CACHE)).match(request);
   if(cached)return cached.json();
  }
  throw Error('Public data not cached yet');
 }
}
let warming:Promise<void>|null=null;
export function warmParticipantOffline():Promise<void>{
 if(warming)return warming;
 if(typeof navigator!=='undefined'&&!navigator.onLine)return Promise.resolve();
 warming=(async()=>{
  // Wake the service worker so the next offline navigation has a complete shell.
  if('serviceWorker'in navigator)void navigator.serviceWorker.ready.then(reg=>reg.active?.postMessage({type:'PRECACHE_PARTICIPANT'})).catch(()=>{});
  const initial=await Promise.allSettled(['events','maps','branding','event-settings'].map(key=>cachePublicJson('/api/public/'+key)));
  const events=initial[0].status==='fulfilled'?(initial[0].value as {items?:Array<{id?:string}>}).items||[]:[];
  const maps=initial[1].status==='fulfilled'?(initial[1].value as {items?:Array<{id?:string}>}).items||[]:[];
  const paths=[
   ...maps.slice(0,LIMIT).filter(m=>m.id).map(m=>'/api/public/map-detail?map_id='+encodeURIComponent(m.id!)),
   ...events.slice(0,LIMIT).filter(e=>e.id).map(e=>'/api/public/menu?event_id='+encodeURIComponent(e.id!))
  ];
  // Keep network usage bounded; caching is best effort, never blocks the map.
  for(let offset=0;offset<paths.length;offset+=4){
   await Promise.allSettled(paths.slice(offset,offset+4).map(cachePublicJson));
  }
 })().finally(()=>{warming=null;});
 return warming;
}
