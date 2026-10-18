const CACHE = 'quickcricket-v22-scoring-recovery';
const FILES = ['./', './index.html', './match-storage.js?v=22', './style.css?v=22', './app.js?v=22', './cricket-players.js?v=22', './navigation.js?v=22', './manifest.json', './business-store.js?v=22', './business.js?v=22', './merchant-cloud.js?v=22', './product-model.js?v=22', './product-cloud.js?v=22', './catalog.js?v=22', './order-model.js?v=22', './orders.js?v=22', './media.js?v=22', './profiles.js?v=22'];
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
