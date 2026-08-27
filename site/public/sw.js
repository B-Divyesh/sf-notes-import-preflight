const CACHE = "notes-preflight-v1";
const SHELL = ["/", "/privacy/", "/terms/", "/assets/preflight-market.webp"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && /\.(?:js|css|woff2|webp)$/.test(new URL(event.request.url).pathname)) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
