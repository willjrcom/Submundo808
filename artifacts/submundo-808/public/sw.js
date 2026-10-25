const CACHE = 'submundo-808-shell-v1';
const ROOT = new URL('./', self.location.href).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(ROOT, { cache: 'reload' });
    if (!response.ok) throw new Error('Não foi possível guardar o aplicativo.');
    await cache.put(ROOT, response.clone());
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], ROOT))
      .filter((url) => url.origin === self.location.origin && /\.(?:js|css|png|svg|webmanifest)(?:\?|$)/.test(url.href));
    await cache.addAll([...new Set(assets.map((url) => url.href))]);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('submundo-808-') && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      try {
        return await fetch(event.request);
      } catch {
        return (await cache.match(ROOT)) || Response.error();
      }
    }
    const saved = await cache.match(event.request);
    if (saved) return saved;
    const response = await fetch(event.request);
    if (response.ok && /\.(js|css|png|jpg|jpeg|webp|svg|woff2?)$/.test(url.pathname)) {
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
