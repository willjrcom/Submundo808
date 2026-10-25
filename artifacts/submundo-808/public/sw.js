// Network-first for app shell and JS/CSS so deployments never mix stale assets.
const CACHE = 'submundo-808-shell-v2';
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
