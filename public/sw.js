// Minimal service worker.
//
// It deliberately does NOT cache or intercept requests. This is an SSR +
// realtime app: caching HTML/navigations caused stale pages ("Failed to find
// Server Action"), favicon/network errors and intermittent freezes (the old
// fetch handler could call respondWith(undefined) → "Failed to convert value
// to 'Response'"). The app must always reach the server.
//
// The SW is kept only to (a) stay registered so the app remains installable as
// a PWA, and (b) actively purge caches left by previous, caching versions.

const CACHE_PREFIX = "projectra-";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove every cache created by older versions of this worker.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// No-op fetch handler: present so the worker is well-formed, but it never calls
// respondWith(), so the browser handles every request over the network as usual.
self.addEventListener("fetch", () => {
  /* pass through to network */
});
