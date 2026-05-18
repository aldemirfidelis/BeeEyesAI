/**
 * Service Worker da Bee PWA — versao MINIMA segura.
 *
 * NAO intercepta fetch (browser cuida do cache HTTP normal).
 * Funcao unica: assumir controle e limpar caches antigos.
 *
 * Cache offline volta a ser feito num passo futuro com Workbox ou similar.
 */
const CACHE_NAME = "bee-pwa-v3";

self.addEventListener("install", () => {
  // Ativa imediatamente sem esperar ciclo de vida
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Apaga TODOS os caches antigos (de qualquer versao)
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Nao registra handler de fetch — browser cuida do cache HTTP normal.
// Service worker continua ativo so pra ser "installable" como PWA.
