const CACHE_NAME = "testum-pwa-v1";
const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith("http")) return;

  // Network first strategy with offline cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;
        }
        return new Response("Offline - Please check your internet connection", {
          status: 503,
          statusText: "Service Unavailable",
          headers: new Headers({ "Content-Type": "text/plain" }),
        });
      }),
  );
});
