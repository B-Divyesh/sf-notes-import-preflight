const CACHE = "notes-preflight-v2";
const SHELL = ["/", "/privacy/", "/terms/", "/assets/preflight-market.b48100d9.webp"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && /\.(?:js|css|woff2|webp)$/.test(new URL(event.request.url).pathname)) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
