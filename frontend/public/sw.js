// KasirPintar AI - Service Worker
const CACHE_VERSION = "kp-v1";
const CORE_ASSETS = [
  "/",
  "/manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(CORE_ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache API calls
  if (url.pathname.startsWith("/api/")) return;

  // Cache-first for static assets (JS, CSS, images, fonts, manifest, icons)
  const dest = req.destination;
  const isAsset = ["script", "style", "image", "font", "manifest"].includes(dest) ||
                  url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|json|wav|mp3)$/i);
  if (isAsset) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const resp = await fetch(req);
        if (resp && resp.status === 200) cache.put(req, resp.clone());
        return resp;
      } catch {
        return cached || Response.error();
      }
    })());
    return;
  }

  // Network-first for HTML navigation, fallback to cached shell
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put("/", resp.clone());
        return resp;
      } catch {
        const cache = await caches.open(CACHE_VERSION);
        return (await cache.match("/")) || Response.error();
      }
    })());
  }
});
