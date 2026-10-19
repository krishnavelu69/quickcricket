const CACHE = 'quickcricket-v24-my-matches';
const FILES = ['./', './index.html', './my-matches.js?v=24', './scorecard-export.js?v=24', './match-storage.js?v=24', './style.css?v=24', './app.js?v=24', './cricket-players.js?v=24', './navigation.js?v=24', './manifest.json', './business-store.js?v=24', './business.js?v=24', './merchant-cloud.js?v=24', './product-model.js?v=24', './product-cloud.js?v=24', './catalog.js?v=24', './order-model.js?v=24', './orders.js?v=24', './media.js?v=24', './profiles.js?v=24'];
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
