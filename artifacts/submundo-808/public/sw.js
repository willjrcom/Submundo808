// Offline-first static shell and network-first publicly published event snapshots.
// Never cache authenticated APIs, private social data, sessions or live GPS.
const SHELL='submundo-808-shell-v6';
const PUBLIC='submundo-808-public-v1';
const ROOT=new URL('./',self.location.href).href;
const allowedPublic=new Set(['events','maps','map-detail','menu','branding','event-settings']);
const isPublicApi=url=>url.pathname.startsWith('/api/public/')&&allowedPublic.has(url.pathname.split('/').pop()||'');
const isShellAsset=url=>url.pathname.includes('/assets/')||/\.(?:js|css|png|jpg|jpeg|webp|svg|woff2?|webmanifest|ico)$/.test(url.pathname);
const safePut=async (cache,request,response)=>{try{if(response.ok&&response.type!=='opaque')await cache.put(request,response.clone());}catch{/* low storage/private browsing */}};
async function precacheShell(){
 const cache=await caches.open(SHELL);
 let assets=[ROOT];
 try{
  const response=await fetch(new URL('offline-assets.json',ROOT),{cache:'no-store'});
  if(response.ok){
   const manifest=await response.json();
   if(Array.isArray(manifest.assets))assets=manifest.assets.slice(0,180).map(path=>new URL(path,ROOT).href)
    .filter(href=>href.startsWith(ROOT));
  }
 }catch{/* first install may be offline */}
 // Request in batches; a missing optional icon must not prevent installation.
 for(let start=0;start<assets.length;start+=6){
  await Promise.allSettled(assets.slice(start,start+6).map(async href=>{
   const response=await fetch(href,{cache:'reload'});
   if(response.ok)await safePut(cache,href,response);
  }));
 }
}
self.addEventListener('install',event=>{
 event.waitUntil(precacheShell().catch(()=>{}).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('submundo-808-')&&key!==SHELL&&key!==PUBLIC).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='PRECACHE_PARTICIPANT')event.waitUntil(precacheShell().catch(()=>{}));
});
async function networkFirst(request,cacheName,cacheKey=request,timeoutMs=3200){
 const cache=await caches.open(cacheName);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(request,{signal:controller.signal,cache:'no-cache'});
  if(response.ok)await safePut(cache,cacheKey,response);
  if(response.status===408||response.status===429||response.status>=500){
   const saved=await cache.match(cacheKey);
   if(saved)return saved;
  }
  return response;
 }catch{
  const saved=await cache.match(cacheKey);
  if(saved)return saved;
  throw Error('Network unavailable, public data not cached');
 }finally{clearTimeout(timer);}
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/api')){
  // No other API, including accounts, group invites, notifications and GPS, is cached.
  if(!isPublicApi(url))return;
  event.respondWith(networkFirst(request,PUBLIC).catch(()=>new Response(JSON.stringify({error:'Este conteúdo ainda não foi baixado para uso offline.'}),{status:503,headers:{'Content-Type':'application/json'}})));
  return;
 }
 if(request.mode==='navigate'){
  // Deep links can contain invite or password-reset tokens. Never cache their
  // HTML as the SPA root: only cache an actual navigation to the bare root.
  event.respondWith((async()=>{
   const cache=await caches.open(SHELL);
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),3200);
   try{
    const response=await fetch(request,{signal:controller.signal,cache:'no-cache'});
    if(url.href===ROOT&&response.ok)await safePut(cache,ROOT,response);
    if(response.status===408||response.status===429||response.status>=500){
     const saved=await cache.match(ROOT);
     if(saved)return saved;
    }
    return response;
   }catch{
    return (await cache.match(ROOT))||
     new Response('Instale o aplicativo com internet para usar offline.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
   }finally{clearTimeout(timer);}
  })());
  return;
 }
 if(isShellAsset(url)){
  event.respondWith((async()=>{
   const cache=await caches.open(SHELL);
   const match=await cache.match(request);
   if(match)return match;
   try{
    const response=await fetch(request);
    await safePut(cache,request,response);
    return response;
   }catch{return Response.error();}
  })());
 }
});

self.addEventListener('push', event=>{
 let payload={title:'Submundo 808',body:'Você recebeu uma notificação.',url:'/'};
 try{payload={...payload,...event.data.json()};}catch{}
 event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:'./icon-192.png',badge:'./icon-192.png',tag:payload.tag||undefined,data:{url:payload.url||'/'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=new URL(event.notification.data?.url||'/',self.location.origin);
 if(url.origin!==self.location.origin)return;
 event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clients){if('focus'in client){await client.navigate(url.href);return client.focus();}}
  return self.clients.openWindow(url.href);
 })());
});
