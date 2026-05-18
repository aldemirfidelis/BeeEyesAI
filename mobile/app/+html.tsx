import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Customizacao do HTML root para web/PWA.
 * - Apple meta tags pra "Adicionar à Tela de Início" no iPhone
 * - Manifest PWA
 * - Viewport otimizado pra mobile (notch, sem zoom)
 * - Theme color
 *
 * Este arquivo NAO é renderizado em iOS/Android nativos — só na build web.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no"
        />

        {/* PWA basico */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FFD940" />
        <meta name="description" content="Sua melhor amiga com IA. Bee mora na casa dela e te ajuda com tarefas, agenda e saúde." />

        {/* Apple — PWA instalavel via 'Adicionar à Tela de Início' */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Bee" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        {/* Favicons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />

        {/* Open Graph (compartilhamento) */}
        <meta property="og:title" content="Bee — Sua melhor amiga com IA" />
        <meta property="og:description" content="Conheça a Bee, sua assistente pessoal com casa virtual customizável." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/icon-512.png" />

        {/* Splash screens iOS (gerar com tool depois) — placeholders */}
        <link rel="apple-touch-startup-image" href="/icon-512.png" />

        {/* Title default */}
        <title>Bee</title>

        {/* Reset scroll do RN Web (já é feito pelo expo-router) */}
        <ScrollViewStyleReset />

        {/* Estilos base body */}
        <style dangerouslySetInnerHTML={{ __html: `
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
          /* Permite seleção em inputs/textareas */
          input, textarea {
            -webkit-user-select: text;
            user-select: text;
            -webkit-touch-callout: default;
          }
          /* Evita pull-to-refresh no iOS */
          body { position: fixed; width: 100%; }
        ` }} />

        {/* Registra Service Worker para PWA offline + installable */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function () {});
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
