/**
 * Private, per-account offline snapshots for the PARTICIPANT UI.
 *
 * Unlike the public Cache Storage / service worker, these stay only in this
 * browser's local storage and are never served to an unauthenticated request.
 * Passwords, tokens, invitations, GPS readings and friends' positions are
 * neither fetched for this cache nor retained in its responses.
 */
export const OFFLINE_PRIVATE_KEY='submundo-participant-private-v1';
export const OFFLINE_PRIVATE_TTL_MS=30*24*60*60*1000;
type Snapshot={ownerId:string;updatedAt:number;responses:Record<string,unknown>};
type SessionUser={id:string;name:string;email:string;phone?:string;instagram?:string;avatar?:string;isAdmin?:boolean};
const allowedPaths=new Set(['/api/auth/me','/api/auth/connections','/api/friends','/api/groups']);
const maxGroups=30;
const maxBytes=3_500_000;

export function allowedOfflinePrivatePath(path:string):boolean{
 try{
  const url=new URL(path,'https://submundo.local');
  if(url.origin!=='https://submundo.local')return false;
  if(allowedPaths.has(url.pathname))return url.search==='';
  if(url.pathname==='/api/groups/detail'||url.pathname==='/api/groups/alerts')
   return url.searchParams.size===1&&!!url.searchParams.get('id')&&
    /^[\w-]{1,128}$/.test(url.searchParams.get('id')||'');
  return false;
 }catch{return false;}
}
const keyOf=(path:string):string=>{
 const u=new URL(path,'https://submundo.local');
 return u.pathname+(u.searchParams.has('id')?'?id='+encodeURIComponent(u.searchParams.get('id')||''):'');
};
function readRaw():Snapshot|null{
 try{
  const raw=localStorage.getItem(OFFLINE_PRIVATE_KEY);
  if(!raw)return null;
  const data=JSON.parse(raw) as Snapshot;
  if(!data||typeof data.ownerId!=='string'||!data.ownerId||
    typeof data.updatedAt!=='number'||data.updatedAt>Date.now()||
    Date.now()-data.updatedAt>OFFLINE_PRIVATE_TTL_MS||
    !data.responses||typeof data.responses!=='object')return null;
  return data;
 }catch{return null;}
}
export function getOfflineProfile():SessionUser|null{
 const item=readRaw()?.responses['/api/auth/me'] as {user?:SessionUser}|undefined;
 return item?.user?.id?item.user:null;
}
export function hasOfflineParticipantData():boolean{
 return !!getOfflineProfile();
}
export function getOfflinePrivateResponse<T=unknown>(path:string):T|null{
 if(!allowedOfflinePrivatePath(path))return null;
 const snapshot=readRaw();
 if(!snapshot)return null;
 const item=snapshot.responses[keyOf(path)];
 return item===undefined?null:item as T;
}
function sanitise(value:unknown):unknown{
 // No credentials or bearer tokens, even if API response structure changes.
 return JSON.parse(JSON.stringify(value,(field,item)=>{
  if(/^(password|token|accessToken|refreshToken|cookie|secret|jwt)$/i.test(field))return undefined;
  if(/^(lat|lng|latitude|longitude|coordinates|positions|trajectory|shareLocation)$/i.test(field))return undefined;
  // Large base64 portraits could exceed browser quota; initials remain usable offline.
  if(/^(avatar|photo)$/i.test(field)&&typeof item==='string'&&
      item.startsWith('data:image/')&&item.length>70000)return '';
  return item;
 }));
}
function persist(snapshot:Snapshot):void{
 try{
  let serial=JSON.stringify(snapshot);
  if(serial.length>maxBytes){
   // Only evict less essential detail/history records, never a different account.
   for(const key of Object.keys(snapshot.responses).filter(k=>k.startsWith('/api/groups/alerts?'))){
    delete snapshot.responses[key];serial=JSON.stringify(snapshot);
    if(serial.length<=maxBytes)break;
   }
  }
  if(serial.length<=maxBytes)localStorage.setItem(OFFLINE_PRIVATE_KEY,serial);
 }catch{/* Private/incognito mode or storage quota: keep the live UI working. */}
}
function saveUser(data:{user?:SessionUser|null}):void{
 const user=data.user;
 if(!user?.id)return;
 const previous=readRaw();
 const responses=previous?.ownerId===user.id?{...previous.responses}:{};
 responses['/api/auth/me']=sanitise({user}) as object;
 persist({ownerId:user.id,updatedAt:Date.now(),responses});
}
export function saveOfflinePrivateResponse(path:string,data:unknown):void{
 if(!allowedOfflinePrivatePath(path))return;
 if(path==='/api/auth/me'){
  saveUser(data as {user?:SessionUser|null});
  return;
 }
 const snapshot=readRaw();
 if(!snapshot?.ownerId)return;
 const next={...snapshot,updatedAt:Date.now(),responses:{...snapshot.responses,[keyOf(path)]:sanitise(data)}};
 persist(next);
}
export function clearOfflineParticipantData():void{
 try{localStorage.removeItem(OFFLINE_PRIVATE_KEY);}catch{}
}
/** A GET either returns fresh server data or the last authenticated snapshot.
 * HTTP 401 and other server responses never get converted into offline success.
 */
export async function privateParticipantGet<T=unknown>(path:string):Promise<T>{
 if(!allowedOfflinePrivatePath(path))throw Error('Este recurso não pode ser armazenado offline.');
 if(typeof navigator!=='undefined'&&!navigator.onLine){
  const cached=getOfflinePrivateResponse<T>(path);
  if(cached!==null)return cached;
  throw Error('Este conteúdo ainda não foi sincronizado no aparelho.');
 }
 try{
  const response=await fetch(path,{credentials:'same-origin',headers:{Accept:'application/json'}});
  const data=await response.json();
  if(!response.ok){
   if(path==='/api/auth/me'&&(response.status===401||response.status===403))clearOfflineParticipantData();
   const err=Object.assign(new Error(data?.error||'Não foi possível concluir a consulta.'),{status:response.status});
   throw err;
  }
  if(path==='/api/auth/me'&&!data?.user)clearOfflineParticipantData();
  else saveOfflinePrivateResponse(path,data);
  return data as T;
 }catch(error){
  // A definite HTTP response is authoritative, even when we have a snapshot.
  if(typeof (error as {status?:number})?.status==='number')throw error;
  const cached=getOfflinePrivateResponse<T>(path);
  if(cached!==null)return cached;
  throw error;
 }
}
/** Best-effort hydration while online. The UI never blocks on this preload. */
let preloading:Promise<void>|null=null;
export function warmParticipantPrivateOffline():Promise<void>{
 if(preloading)return preloading;
 if(typeof navigator!=='undefined'&&!navigator.onLine)return Promise.resolve();
 preloading=(async()=>{
  const me=await privateParticipantGet<{user?:SessionUser|null}>('/api/auth/me');
  if(!me.user?.id)return;
  const [friends,groups]=await Promise.allSettled([
   privateParticipantGet('/api/friends'),
   privateParticipantGet<{groups?:Array<{id:string}>}>('/api/groups')
  ]);
  await privateParticipantGet('/api/auth/connections').catch(()=>{});
  if(groups.status==='fulfilled'){
   const items=groups.value.groups||[];
   for(let offset=0;offset<Math.min(items.length,maxGroups);offset+=5){
    await Promise.allSettled(items.slice(offset,offset+5).map(item=>
     privateParticipantGet('/api/groups/detail?id='+encodeURIComponent(item.id))
    ));
   }
  }
  void friends;
 })().catch(()=>{}).finally(()=>{preloading=null;});
 return preloading;
}
