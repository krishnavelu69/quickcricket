const CACHE = 'quickcricket-v18-toss-roles';
const FILES = ['./', './index.html', './style.css?v=18', './app.js?v=18', './cricket-players.js?v=18', './navigation.js?v=18', './manifest.json', './business-store.js?v=18', './business.js?v=18', './merchant-cloud.js?v=18', './product-model.js?v=18', './product-cloud.js?v=18', './catalog.js?v=18', './order-model.js?v=18', './orders.js?v=18', './media.js?v=18', './profiles.js?v=18'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('quickcricket-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response && response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match('./index.html'));
  }));
});
