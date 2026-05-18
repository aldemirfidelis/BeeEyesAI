import { Router } from "express";
import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Serve o PWA da Bee (build do Expo Web) sob /pwa.
 *
 * O build é gerado pelo Dockerfile (stage pwa-builder) com:
 *   cd mobile && expo export -p web && node scripts/inject-pwa-html.mjs
 * Saída: mobile/dist/
 *
 * Rotas:
 *   GET /pwa               → index.html (Casa da Bee PWA)
 *   GET /pwa/_expo/...     → bundle JS + chunks
 *   GET /pwa/manifest.json → manifest PWA
 *   GET /pwa/sw.js         → service worker (scope /pwa/)
 *   GET /pwa/canvaskit.wasm → Skia web binary
 *   GET /pwa/<rota>        → SPA fallback → index.html
 *
 * A raiz `/` continua sendo servida pelo Vite/client antigo (serveStatic).
 */
export function createPwaRouter() {
  const router = Router();
  const pwaRoot = resolve(process.cwd(), "mobile", "dist");

  if (!existsSync(pwaRoot)) {
    router.get("/pwa", (_req, res) => {
      res.status(503).type("text/plain").send(
        "PWA build não encontrado.\n\nRodar:\n  cd mobile && npm run build:web\n",
      );
    });
    return router;
  }

  // Arquivos estáticos da PWA, montados sob /pwa
  router.use(
    "/pwa",
    express.static(pwaRoot, {
      etag: true,
      maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
      setHeaders: (res, path) => {
        if (path.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
        if (path.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
      index: false,
      redirect: false,
    }),
  );

  // Raiz /pwa → index.html
  router.get("/pwa", (_req, res) => {
    res.sendFile(resolve(pwaRoot, "index.html"));
  });

  // SPA fallback pra rotas Expo Router dentro de /pwa
  router.get("/pwa/*", (req, res, next) => {
    if (req.path.includes(".")) return next();
    res.sendFile(resolve(pwaRoot, "index.html"));
  });

  return router;
}
