const CACHE = 'quickcricket-v25-undo-redo';
const FILES = ['./', './index.html', './my-matches.js?v=25', './scorecard-export.js?v=25', './match-storage.js?v=25', './style.css?v=25', './app.js?v=25', './cricket-players.js?v=25', './navigation.js?v=25', './manifest.json', './business-store.js?v=25', './business.js?v=25', './merchant-cloud.js?v=25', './product-model.js?v=25', './product-cloud.js?v=25', './catalog.js?v=25', './order-model.js?v=25', './orders.js?v=25', './media.js?v=25', './profiles.js?v=25'];
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
