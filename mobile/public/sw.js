/**
 * Service Worker da Bee PWA (Expo Web build).
 *
 * Estratégia:
 * - skipWaiting + clients.claim → ativa imediatamente e substitui qualquer SW antigo
 * - Limpa TODOS os caches antigos (de versões anteriores e do Vite antigo)
 * - Network-first pra API (sempre fresca)
 * - Cache-first pra shell estática
 */
const CACHE_NAME = "bee-pwa-v2";
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
  // Toma controle imediato sem esperar reload
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Apaga TUDO de cache (inclui SW antigo do Vite, qualquer versão anterior)
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
      // Forca reload de todas as abas pra puxar PWA nova
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        try { client.navigate(client.url); } catch (_) {}
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear API (sempre rede)
  if (url.pathname.startsWith("/api/")) return;
  // Method != GET → deixa passar
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
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
