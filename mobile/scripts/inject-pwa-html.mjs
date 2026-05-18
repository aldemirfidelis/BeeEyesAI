#!/usr/bin/env node
/**
 * Pos-build hook: injeta meta tags PWA + Apple + SW registration no
 * index.html gerado pelo `expo export -p web`.
 *
 * Roda automaticamente como parte de `build:web`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const distPath = resolve(process.cwd(), "dist");
const htmlPath = resolve(distPath, "index.html");

if (!existsSync(htmlPath)) {
  console.error("[inject-pwa-html] dist/index.html não encontrado. Rode `expo export -p web` primeiro.");
  process.exit(1);
}

const original = readFileSync(htmlPath, "utf-8");

// PWA servida na raiz (subistitui o Vite antigo)
const BASE = "";
const PWA_HEAD = `
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="Bee" />
  <link rel="manifest" href="${BASE}/manifest.json" />
  <link rel="apple-touch-icon" href="${BASE}/apple-touch-icon.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="${BASE}/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="${BASE}/icon-192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="${BASE}/icon-512.png" />
  <meta property="og:title" content="Bee — Sua melhor amiga com IA" />
  <meta property="og:description" content="Conheça a Bee, sua assistente pessoal com casa virtual customizável." />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${BASE}/icon-512.png" />
  <style id="bee-pwa-body-reset">
    html, body, #root {
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #fff8d6;
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
      overscroll-behavior: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    input, textarea {
      -webkit-user-select: text;
      user-select: text;
      -webkit-touch-callout: default;
    }
    body { position: fixed; width: 100%; }
  </style>
  <script src="${BASE}/boot-debug.js"></script>
  <script src="${BASE}/register-sw.js" defer></script>
`;

// Remove viewport antigo (será substituído) e injeta antes de </head>
const cleaned = original.replace(
  /<meta name="viewport"[^>]*>/,
  "",
);
const updated = cleaned.replace("</head>", `${PWA_HEAD}\n</head>`);

writeFileSync(htmlPath, updated, "utf-8");

console.log("[inject-pwa-html] OK — meta tags PWA + Apple + SW registration injetados em dist/index.html");
