// Network-first for app shell and JS/CSS so deployments never mix stale assets.
const CACHE = 'submundo-808-shell-v5';
const ROOT = new URL('./', self.location.href).href;
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('submundo-808-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request, { cache: 'no-cache' });
      if (response.ok && (event.request.mode === 'navigate' || /\.(?:js|css|png|svg|webmanifest|woff2?)$/.test(url.pathname))) {
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      return (await cache.match(event.request)) || (event.request.mode === 'navigate' ? await cache.match(ROOT) : undefined) || Response.error();
    }
  })());
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
