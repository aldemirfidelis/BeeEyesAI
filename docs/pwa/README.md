# Bee PWA — Web instalável no iPhone

Mesma base de código do app nativo. Roda no browser via `react-native-web` + Skia
WASM. Instalável no iPhone via Safari → **Compartilhar** → **Adicionar à Tela de
Início**.

## Como funciona

```
mobile/                                          server/
├── app/        (Expo Router)            ──┐
├── features/casa-da-bee/                  │
│   ├── components/    (Skia + RN Web)     │
│   ├── engine/        (TS puro)           │
│   └── CasaDaBeeNativeScreen.tsx          │
└── public/                                │
    ├── canvaskit.wasm                     │
    ├── manifest.json                      ▼
    └── sw.js                       routes/pwa.ts
                                     serve /app/* a partir de mobile/dist/
                                     (gerado pelo expo export -p web)
```

A mesma `CasaDaBeeNativeScreen` que roda no Android renderiza no browser.
Skia compila pra WebGL via canvaskit-wasm. Reanimated 4 funciona no web.

## Rodar localmente em dev

```bash
cd mobile
npm run web
```

Abre em `http://localhost:8081` (Metro web). Skia carrega `/canvaskit.wasm`
automaticamente (8 MB, primeira carga demora alguns segundos).

## Buildar pra produção

```bash
cd mobile
npm run build:web
```

Saída em `mobile/dist/`. Esse diretório contém:
- `index.html` — entry point
- `_expo/static/js/web/*.js` — bundle JS
- `canvaskit.wasm` — engine Skia (8 MB)
- `manifest.json` — PWA manifest
- `sw.js` — service worker
- Assets diversos (ícones, fontes)

## Servir em produção

A rota Express `/app` (em `server/routes/pwa.ts`) serve `mobile/dist/`
automaticamente. Em `beeyes.net/app` o user acessa a PWA.

```
GET beeyes.net/app           → index.html
GET beeyes.net/app/sw.js     → service worker
GET beeyes.net/app/canvaskit.wasm → engine Skia
GET beeyes.net/app/(tabs)/chat → SPA fallback → index.html
```

Backend continua sendo o **mesmo** (`/api/*`) — PWA chama as mesmas APIs.

## Instalar no iPhone (PWA)

1. Abrir `https://beeyes.net/app` no **Safari** (não funciona em Chrome iOS)
2. Toca em **Compartilhar** (ícone de quadrado com seta)
3. Rola pra baixo → **Adicionar à Tela de Início**
4. Confirma nome **Bee** → **Adicionar**
5. Ícone aparece na home como app nativo
6. Abre sem barra de navegador (standalone mode via `apple-mobile-web-app-capable`)

## Limitações no web (vs nativo)

| Feature | Status |
|---|---|
| **Casa da Bee (Skia)** | ✅ Funciona idêntico ao mobile (canvaskit-wasm) |
| **PetIndicator** | ✅ FAB com Bee customizada flutua sobre todas as telas |
| **Loja + Inventário** | ✅ SecureStore no web vira `localStorage` automaticamente |
| **Daily streak, achievements, combo** | ✅ Tudo persistido em localStorage |
| **Mini-game flor de pólen** | ✅ Modal funciona idêntico |
| **Drag-and-drop móveis** | ✅ Long press funciona com touch e mouse |
| **Reanimated 4** | ✅ Versão web suportada |
| **Google Sign-In** | ⚠️ No web usa `expo-auth-session` (OAuth web flow) — `googleAuth.ts` faz `try/catch` que falha graciosamente. Pra login no web, melhor usar email/senha |
| **Haptics** | ❌ Browser não tem haptics. `.catch(() => {})` em todas as chamadas, sem erro |
| **Push notifications** | ❌ iOS Safari só suporta a partir de iOS 16.4 com PWA instalada. Por ora skip |
| **expo-camera** | ⚠️ Funciona via `<input type=file accept=image/* capture>` |
| **Sentry** | ✅ Funciona no web via `@sentry/react-native` |

## Deploy completo

**A PWA é buildada dentro do Docker.** O `Dockerfile` tem um stage extra
`pwa-builder` que roda `expo export -p web` durante o build da imagem. Não
precisa committar `mobile/dist/` (ele está no `.gitignore`).

```bash
# Deploy normal:
./deploy.ps1

# Vai:
# 1. git push origin main
# 2. ssh no droplet → git pull
# 3. docker compose up -d --build
#    └── Dockerfile builda 3 stages:
#        - builder: server + client Vite (mesma rota /)
#        - pwa-builder: mobile/dist/ via expo export -p web (NOVO)
#        - production: COPY do server bundle + COPY do mobile/dist/
# 4. Container restart serve /app/* a partir de mobile/dist/

# Verificacao pos-deploy:
curl https://beeyes.net/app/manifest.json
curl -I https://beeyes.net/app/canvaskit.wasm  # deve ter Content-Type: application/wasm
```

**Tempo de build:** primeiro deploy demora +5-8 min porque baixa node_modules
do mobile (~600 MB). Builds incrementais usam cache do Docker.

## Customizações importantes

### Service worker scope

O `sw.js` é servido em `/app/sw.js`, então seu **scope é `/app/`**. Isso
significa: só intercepta requests dentro de `/app/`. Se você quiser que a PWA
controle a raiz (`/`), o `sw.js` precisa estar em `/sw.js` (raiz) E o
service worker precisa de header `Service-Worker-Allowed: /`.

### Ícones PWA

Você precisa gerar manualmente:
- `public/icon-192.png` — 192x192
- `public/icon-512.png` — 512x512
- `public/icon-maskable-512.png` — 512x512 com safe area
- `public/apple-touch-icon.png` — 180x180

Tool sugerida: <https://realfavicongenerator.net/> — gera todos os tamanhos
a partir de um ícone único.

### Splash screen iOS

Sem assets ainda. Pra splash bonita no iPhone PWA, adicionar em `+html.tsx`:

```tsx
<link
  rel="apple-touch-startup-image"
  media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)"
  href="/splash-iphone-14-pro.png"
/>
```

Tem 12+ resoluções pra iPhone diferentes. Tool: <https://appsco.pe/developer/splash-screens>
