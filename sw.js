const CACHE = 'quickcricket-v21-extras-scoring';
const FILES = ['./', './index.html', './style.css?v=21', './app.js?v=21', './cricket-players.js?v=21', './navigation.js?v=21', './manifest.json', './business-store.js?v=21', './business.js?v=21', './merchant-cloud.js?v=21', './product-model.js?v=21', './product-cloud.js?v=21', './catalog.js?v=21', './order-model.js?v=21', './orders.js?v=21', './media.js?v=21', './profiles.js?v=21'];
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
