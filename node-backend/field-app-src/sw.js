// v4 (16-Nov-2026): the page itself is taken from the server first (from the cache only without internet), so a phone
// with the app on its Home Screen gets each update of the app (phone register, English text). Before, v3 kept serving
// the page it cached on the first day.
const CACHE = "eagleview-field-v4";
const URLS  = ["/field-app/", "/field-app/index.html"];
self.addEventListener("install",  e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.url.includes("/api/")) return;
  if (e.request.mode === "navigate" || URLS.some(u => new URL(e.request.url).pathname === u)) {
    e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("/field-app/"))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});