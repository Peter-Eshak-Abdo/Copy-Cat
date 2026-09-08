// Copy-Cat Service Worker v3.0 - High Performance Offline First
const CACHE_NAME = "copycat-cache-v3.0";
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  "/",
  "/offline.html",
  "/login",
  "/admin",
  "/admin/id-cards",
  "/admin/passport-photos",
  "/admin/scanner",
  "/admin/inventory",
  "/admin/research",
  "/admin/shortcuts",
  "/admin/ocr",
  "/admin/school-sheets",
  "/admin/tasks",
  "/admin/calculator",
  "/admin/lan-transfer",
  "/admin/pdf-tools",
  "/logo.jpg",
  "/image.png",
  "/manifest.json",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache core shell and offline page defensively
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("Some precache assets failed to load:", err);
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
  const url = new URL(request.url);

  // Skip localhost / development completely to prevent HMR chunk caching and hydration mismatches
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // 1. Skip non-GET, non-HTTP, and Next.js /api/ routes
  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;
  if (url.pathname.startsWith("/api/")) return;

  // 2. Static Assets (Next.js JS/CSS chunks, fonts, images) -> Cache First with background update
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
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
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

  // 3. Document Navigation -> Network First with cache fallback, then offline.html fallback
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
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

  // 4. Default -> Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
