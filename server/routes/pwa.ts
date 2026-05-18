import { Router } from "express";
import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Serve o PWA da Bee (build do Expo Web) na raiz `/`.
 *
 * O build é gerado pelo Dockerfile (stage pwa-builder) com:
 *   cd mobile && expo export -p web && node scripts/inject-pwa-html.mjs
 * Saída: mobile/dist/
 *
 * Rotas:
 *   GET /                  → index.html (PWA)
 *   GET /_expo/...         → bundle JS + chunks
 *   GET /manifest.json     → manifest PWA
 *   GET /sw.js             → service worker
 *   GET /canvaskit.wasm    → Skia web binary
 *   GET /<rota-app>        → SPA fallback → index.html
 *
 * IMPORTANTE: este router PRECISA ser montado depois das rotas /api/*,
 * /uploads/*, /casa-da-bee/* (Phaser antigo), /legal/* — porque o SPA
 * fallback engole qualquer rota que não bata em arquivo.
 */
export function createPwaRouter() {
  const router = Router();
  const pwaRoot = resolve(process.cwd(), "mobile", "dist");

  if (!existsSync(pwaRoot)) {
    router.get("/", (_req, res) => {
      res.status(503).type("text/plain").send(
        "PWA build não encontrado.\n\nRodar:\n  cd mobile && npm run build:web\n",
      );
    });
    return router;
  }

  // Arquivos estáticos da PWA
  router.use(
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
      index: false, // controlamos o '/' explicitamente abaixo
    }),
  );

  // Raiz e SPA fallback — qualquer GET que não bate em arquivo nem em outra rota
  router.get("/", (_req, res) => {
    res.sendFile(resolve(pwaRoot, "index.html"));
  });

  // SPA fallback pra rotas do Expo Router
  // (ex: /(tabs)/chat, /casa-da-bee-native, /onboarding, etc)
  // CUIDADO: este wildcard deve ficar por ULTIMO no app — registrar este
  // router como ultimo middleware garante que rotas /api/* ja foram tentadas.
  router.get("/*", (req, res, next) => {
    // Se for um path com extensao (arquivo) que nao existe, deixa 404
    if (req.path.includes(".")) return next();
    res.sendFile(resolve(pwaRoot, "index.html"));
  });

  return router;
}
