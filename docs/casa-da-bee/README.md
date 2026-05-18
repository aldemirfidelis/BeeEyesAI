# Casa da Bee

## Arquitetura atual

A Casa da Bee roda como um jogo Phaser 3 estilo RPG Maker dentro de uma WebView do app Expo.
O app mobile continua cuidando de chat, feed, Colmeia, perfil e autenticacao.
O servidor hospeda o jogo em `/casa-da-bee`, serve Phaser, React, ReactDOM e
grid-engine localmente a partir do npm, e mantem as APIs de perfil, layout,
inventario, tarefas da IA e recompensas.

```text
mobile/app/casa-da-bee.tsx
  WebView -> http(s)://servidor/casa-da-bee

server/routes/bee-house.ts
  /casa-da-bee
  /casa-da-bee/vendor/phaser.min.js
  /casa-da-bee/vendor/grid-engine.esm.min.js
  /casa-da-bee/vendor/react.production.min.js
  /casa-da-bee/vendor/react-dom.production.min.js
  /casa-da-bee/game/main.js
  /api/bee-house/*

mobile/casa da bee/
  casa-da-bee-fase1.html
  game/main.js
```

## O que a fase atual entrega

- Mapa top-down em tiles com leitura visual de RPG Maker.
- Pixel art original com clima cozy/fazenda, sem uso de assets externos.
- Movimento autonomo tile-a-tile com `grid-engine`.
- Phaser responsavel por mapa, personagens, itens, teleportes e rotina da Bee.
- React por cima do canvas para HUD, caixa de dialogo e feedback visual.
- A Bee passeia pela casa sozinha enquanto aguarda interacoes vindas do chat.
- Tarefas da IA roteiam a Bee para a estacao correta, como notebook, agenda ou cama.
- Ponte WebView com `window.beeBridge.setState(...)`.
- Eventos do jogo para o app via `ReactNativeWebView.postMessage`.
- Recompensas de tarefas creditadas no backend.

## Contrato da ponte

App para jogo:

```json
{
  "type": "house_snapshot",
  "snapshot": {}
}
```

```json
{
  "type": "ai_task",
  "id": "task-id",
  "target": "search",
  "status": "start",
  "reward": 15,
  "speechText": "Estou pesquisando isso para voce!"
}
```

Jogo para app:

```json
{ "type": "game_ready" }
```

```json
{ "type": "task_ack", "id": "task-id", "target": "search", "status": "processing" }
```

```json
{ "type": "task_done", "id": "task-id", "target": "search", "status": "completed", "reward": 15, "xp": 15 }
```

## Dependencias

- `phaser` fica no `package.json` raiz porque o jogo e servido pelo backend.
- `grid-engine` tambem fica no `package.json` raiz e controla o movimento em grade.
- `react` e `react-dom` ja existem no projeto e sao usados no HUD/dialogo do jogo.
- `react-native-webview` fica em `mobile/package.json` porque a tela mobile carrega o jogo.

## Rodando

```powershell
npm run dev
```

Abra:

```text
http://localhost:5000/casa-da-bee
```

No app mobile, a tela `Casa da Bee` abre o mesmo endpoint dentro da WebView.

## Proximos passos

- Migrar os mapas gerados em codigo para mapas do Tiled com `ge_collide`.
- Trocar os desenhos runtime por atlas/spritesheets oficiais da Bee.
- Adicionar inimigos/mini-desafios e empurrar/cortar objetos interativos.
- Persistir alteracoes de mapa e decoracao usando `/api/bee-house/layouts`.
- Criar visitas assincronas com snapshot publico quando a experiencia single-player estiver madura.
