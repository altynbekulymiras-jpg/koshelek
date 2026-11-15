/* Мой кошелёк: offline cache */
const CACHE='koshelek-7d026fd5';
const ASSETS=["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "fonts/unbounded-cyrillic-600-normal.woff2", "fonts/unbounded-latin-600-normal.woff2", "fonts/unbounded-latin-ext-600-normal.woff2", "fonts/unbounded-cyrillic-700-normal.woff2", "fonts/unbounded-latin-700-normal.woff2", "fonts/unbounded-latin-ext-700-normal.woff2", "fonts/golos-text-cyrillic-400-normal.woff2", "fonts/golos-text-latin-400-normal.woff2", "fonts/golos-text-latin-ext-400-normal.woff2", "fonts/golos-text-cyrillic-500-normal.woff2", "fonts/golos-text-latin-500-normal.woff2", "fonts/golos-text-latin-ext-500-normal.woff2", "fonts/golos-text-cyrillic-600-normal.woff2", "fonts/golos-text-latin-600-normal.woff2", "fonts/golos-text-latin-ext-600-normal.woff2", "fonts/golos-text-cyrillic-700-normal.woff2", "fonts/golos-text-latin-700-normal.woff2", "fonts/golos-text-latin-ext-700-normal.woff2"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('koshelek-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put('index.html',copy))}return r}).catch(()=>caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return r})));
});
