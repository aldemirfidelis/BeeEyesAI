import { Router } from "express";
import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Serve o PWA da Bee (build do Expo Web) sob /app.
 *
 * O build é gerado com: cd mobile && npm run build:web
 * Saída: mobile/dist/
 *
 * Rotas:
 *   GET /app               → index.html
 *   GET /app/*.{js,css,...} → assets estáticos
 *   GET /app/manifest.json → manifest PWA
 *   GET /app/sw.js         → service worker
 *   GET /app/canvaskit.wasm → Skia web binary
 *   GET /app/<rota-app>    → SPA fallback → index.html
 */
export function createPwaRouter() {
  const router = Router();
  const pwaRoot = resolve(process.cwd(), "mobile", "dist");

  if (!existsSync(pwaRoot)) {
    // Build ainda não foi gerado — rota retorna 503 educadamente
    router.use("/app", (_req, res) => {
      res.status(503).type("text/plain").send(
        "PWA build não encontrado.\n\nRodar:\n  cd mobile && npm run build:web\n",
      );
    });
    return router;
  }

  // Service worker DEVE ter scope na raiz pra funcionar como PWA real,
  // então quando servido em /app/sw.js seu scope será /app/. OK pra PWA.
  router.use(
    "/app",
    express.static(pwaRoot, {
      etag: true,
      maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
      setHeaders: (res, path) => {
        if (path.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
        if (path.endsWith("sw.js")) {
          // Service worker nunca em cache
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  // SPA fallback: qualquer rota /app/* que não bate em arquivo → index.html
  router.get("/app/*", (_req, res) => {
    res.sendFile(resolve(pwaRoot, "index.html"));
  });
  router.get("/app", (_req, res) => {
    res.sendFile(resolve(pwaRoot, "index.html"));
  });

  return router;
}
