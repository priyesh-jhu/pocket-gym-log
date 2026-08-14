// Service worker for the Workout Tracker PWA.
// Strategy: network-first for navigation (so updates land when online),
// cache-first for static assets (so the app opens instantly & offline).
// The registration URL includes package.json's version, so every version bump
// gets a fresh cache without requiring a second manual version edit here.

const RELEASE_VERSION = new URL(self.location.href).searchParams.get("v") || "development";
const CACHE_VERSION = `workout-tracker-${RELEASE_VERSION}`;
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/icon-512.png"];
const IS_DEVELOPMENT_HOST = ["localhost", "127.0.0.1", "::1"].includes(self.location.hostname);

self.addEventListener("install", (event) => {
  if (IS_DEVELOPMENT_HOST) {
    // Immediately replace any older localhost worker so Vite modules stop
    // being served from a release cache after the next navigation.
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => IS_DEVELOPMENT_HOST || k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Never put Vite source or optimized dependency modules behind a service
  // worker. A stale module graph can load two incompatible React runtimes.
  if (IS_DEVELOPMENT_HOST) return;

  const { request } = event;
  if (request.method !== "GET") return;

  // Navigation requests: try network first, fall back to cached app shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets (JS/CSS/images): cache first, then network, then cache the result.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
        }
        return res;
      });
    })
  );
});
