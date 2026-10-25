const CACHE = 'quickcricket-v28-private-verification';
const FILES = ['./sports-core.js?v=28', './sports-ui.js?v=28', './', './index.html', './my-matches.js?v=28', './scorecard-export.js?v=28', './match-storage.js?v=28', './style.css?v=28', './app.js?v=28', './cricket-players.js?v=28', './navigation.js?v=28', './manifest.json', './business-store.js?v=28', './business.js?v=28', './merchant-cloud.js?v=28', './product-model.js?v=28', './product-cloud.js?v=28', './catalog.js?v=28', './order-model.js?v=28', './orders.js?v=28', './media.js?v=28', './profiles.js?v=28'];
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
