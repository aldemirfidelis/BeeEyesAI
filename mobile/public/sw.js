/**
 * Service Worker minimalista da Bee PWA.
 *
 * Estratégia:
 * - Pre-cache do shell (HTML + chunks principais)
 * - Network-first pra API (sempre fresca)
 * - Cache-first pra assets estáticos (icones, manifest, bundle JS)
 */
const CACHE_NAME = "bee-pwa-v1";
const SHELL = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear API (sempre rede)
  if (url.pathname.startsWith("/api/")) {
    return; // deixa o browser cuidar
  }

  // Method != GET → deixa passar
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // So cacheia 200 OK
          if (response.ok && response.type !== "opaque") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match("/"));
    }),
  );
});
