// Copy-Cat Service Worker v6.0 - High Performance & Dynamic Admin Bypass
const CACHE_NAME = "copycat-cache-v6.0";
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  "/",
  "/offline.html",
  "/login",
  "/logo.jpg",
  "/image.png",
  "/manifest.json",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("Precache failed:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 1. CRITICAL: Cache API strictly supports ONLY GET requests.
  // Any POST, PUT, DELETE, PATCH, or HEAD request MUST be completely ignored.
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // 2. Only cache HTTP and HTTPS requests (ignore chrome-extension:, data:, blob:, etc.)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // 3. Skip localhost / development
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // 4. CRITICAL: NEVER cache admin pages, API routes, or dynamic server actions
  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("_next/data")
  ) {
    return;
  }

  // 5. Static Assets (Next.js JS/CSS chunks, fonts, images) -> Cache First with background update
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && request.method === "GET") {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone).catch(() => {});
              });
            }
            return networkResponse;
          })
          .catch(() => {
            return new Response("", { status: 408, statusText: "Offline" });
          });
      })
    );
    return;
  }

  // 6. Document Navigation -> Network First with cache fallback, then offline.html fallback
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && request.method === "GET") {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedPage) => {
            if (cachedPage) {
              return cachedPage;
            }
            return caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // 7. Default -> Stale-while-revalidate (strictly for GET)
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && request.method === "GET") {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
