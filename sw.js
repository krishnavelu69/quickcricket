const CACHE = 'quickcricket-v27-profiles-merchants';
const FILES = ['./sports-core.js?v=27', './sports-ui.js?v=27', './', './index.html', './my-matches.js?v=27', './scorecard-export.js?v=27', './match-storage.js?v=27', './style.css?v=27', './app.js?v=27', './cricket-players.js?v=27', './navigation.js?v=27', './manifest.json', './business-store.js?v=27', './business.js?v=27', './merchant-cloud.js?v=27', './product-model.js?v=27', './product-cloud.js?v=27', './catalog.js?v=27', './order-model.js?v=27', './orders.js?v=27', './media.js?v=27', './profiles.js?v=27'];
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
