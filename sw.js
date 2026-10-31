const CACHE='quickcricket-v1-rc1-marketplace1';
const FILES=["./index.html", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./style.css?v=rc1-marketplace1", "./vendor/supabase.js?v=rc1", "./sync-queue.js?v=rc1", "./match-storage.js?v=rc1", "./cricket-players.js?v=rc1", "./scorecard-export.js?v=rc1", "./sports-core.js?v=rc1", "./app.js?v=rc1", "./media.js?v=rc1", "./sports-ui.js?v=rc1", "./my-matches.js?v=rc1", "./navigation.js?v=rc1-marketplace1", "./business-store.js?v=rc1", "./business.js?v=rc1", "./moderation.js?v=rc1", "./profiles.js?v=rc1", "./merchant-cloud.js?v=rc1", "./merchant-admin.js?v=rc1", "./product-model.js?v=rc1", "./product-cloud.js?v=rc1", "./order-model.js?v=rc1", "./orders.js?v=rc1-marketplace1", "./catalog.js?v=rc1", "./community-market.js?v=rc1", "./account-tools.js?v=rc1", "./local-history.js?v=rc1", "./pwa.js?v=rc1"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('quickcricket-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;
 // A coherent installed shell. A new release is adopted only after the user accepts it.
 if(request.mode==='navigate'&&(url.pathname===new URL('./',self.location).pathname||url.pathname.endsWith('/index.html'))){event.respondWith(caches.open(CACHE).then(cache=>cache.match('./index.html')).then(cached=>cached||fetch(request)));return;}
 if(FILES.some(file=>new URL(file,self.location).href===url.href))event.respondWith(caches.open(CACHE).then(cache=>cache.match(request)).then(cached=>cached||fetch(request)));
});
