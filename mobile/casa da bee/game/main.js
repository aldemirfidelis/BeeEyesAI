(function () {
  'use strict';

  const TILE_SIZE = 32;
  const PLAYER_ID = 'bee';
  const STORAGE_KEY = 'bee-house-rpg-state-v1';
  const GRID_ENGINE_URL = '/casa-da-bee/vendor/grid-engine.esm.min.js';

  const TILES = {
    GRASS: 1,
    PATH: 2,
    FLOWER: 3,
    WATER: 4,
    FLOOR: 5,
    WALL: 6,
    RUG: 7,
    DOOR: 8,
    BLOCK: 9,
  };

  const BLOCKING_GROUND_TILES = new Set([TILES.WATER, TILES.WALL]);

  const DIRECTION_VECTORS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const TASK_TARGETS = {
    search: {
      mapKey: 'house',
      stationId: 'desk',
      label: 'Pesquisar no notebook',
      arrival: 'Pesquisei no notebook e ja organizei um resumo para voce.',
    },
    train: {
      mapKey: 'house',
      stationId: 'training',
      label: 'Treinar',
      arrival: 'Treino concluido. A Bee voltou com mais foco e energia.',
    },
    calendar: {
      mapKey: 'house',
      stationId: 'agenda',
      label: 'Agenda',
      arrival: 'Agenda revisada. Os proximos passos ja estao separados.',
    },
    study: {
      mapKey: 'house',
      stationId: 'desk',
      label: 'Estudar',
      arrival: 'Sessao de estudo concluida. A Bee guardou os aprendizados.',
    },
    sleep: {
      mapKey: 'house',
      stationId: 'bed',
      label: 'Descansar',
      arrival: 'A Bee descansou e acordou pronta para continuar.',
    },
  };

  const DEFAULT_STATS = {
    pollen: 18,
    xp: 0,
    level: 1,
    health: 6,
    maxHealth: 6,
    mood: 'idle',
    location: 'Quarto da Bee',
    quest: 'Bee esta passeando pela casa enquanto aguarda o chat.',
  };

  let activeScene = null;
  let queuedBridgePayloads = [];
  let latestSnapshot = null;

  window.beeBridge = {
    setState(payload) {
      if (activeScene) {
        activeScene.receiveBridgePayload(payload);
        return;
      }

      queuedBridgePayloads.push(payload);
    },
  };

  function emitUiEvent(type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function postToApp(payload) {
    if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      return;
    }

    console.info('[Casa da Bee]', payload);
  }

  function toKey(position) {
    return `${position.x}:${position.y}`;
  }

  function addPosition(position, direction) {
    const vector = DIRECTION_VECTORS[direction] || DIRECTION_VECTORS.down;
    return { x: position.x + vector.x, y: position.y + vector.y };
  }

  function directionTo(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }

    if (dy !== 0) {
      return dy > 0 ? 'down' : 'up';
    }

    return 'down';
  }

  function numberOr(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function createGrid(width, height, fillValue) {
    return Array.from({ length: height }, () => Array.from({ length: width }, () => fillValue));
  }

  function setRect(grid, x, y, width, height, value) {
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        if (grid[row] && grid[row][column] !== undefined) {
          grid[row][column] = value;
        }
      }
    }
  }

  function addBlockRect(blocks, x, y, width, height, exceptPositions) {
    const except = new Set((exceptPositions || []).map(toKey));

    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        const position = { x: column, y: row };
        if (!except.has(toKey(position))) {
          blocks.push(position);
        }
      }
    }
  }

  function loadLocalState() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveLocalState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Local storage can be unavailable in a few WebView modes. The game still runs.
    }
  }

  function healthStates(health, maxHealth) {
    return Array.from({ length: Math.ceil(maxHealth / 2) }, (_, index) => {
      const value = Math.max(health - index * 2, 0);
      if (value >= 2) return 'full';
      if (value === 1) return 'half';
      return 'empty';
    });
  }

  function buildVillageMap() {
    const width = 30;
    const height = 22;
    const ground = createGrid(width, height, TILES.GRASS);
    const blocks = [];

    setRect(ground, 0, 0, width, 1, TILES.WATER);
    setRect(ground, 0, height - 1, width, 1, TILES.WATER);
    setRect(ground, 0, 0, 1, height, TILES.WATER);
    setRect(ground, width - 1, 0, 1, height, TILES.WATER);
    setRect(ground, 2, 12, 26, 2, TILES.PATH);
    setRect(ground, 14, 4, 2, 15, TILES.PATH);
    setRect(ground, 5, 8, 8, 2, TILES.PATH);
    setRect(ground, 21, 9, 6, 2, TILES.PATH);

    [
      { x: 8, y: 5 },
      { x: 9, y: 5 },
      { x: 18, y: 4 },
      { x: 22, y: 15 },
      { x: 23, y: 15 },
      { x: 6, y: 16 },
      { x: 7, y: 16 },
      { x: 19, y: 17 },
    ].forEach((position) => {
      ground[position.y][position.x] = TILES.FLOWER;
    });

    addBlockRect(blocks, 11, 2, 7, 4, [{ x: 14, y: 5 }]);
    addBlockRect(blocks, 3, 4, 4, 4);
    addBlockRect(blocks, 22, 5, 4, 4);
    blocks.push({ x: 5, y: 10 }, { x: 24, y: 11 }, { x: 17, y: 11 }, { x: 20, y: 16 });

    return {
      key: 'village',
      name: 'Praca da Colmeia',
      width,
      height,
      ground,
      blocks,
      start: { x: 14, y: 15 },
      cameraZoom: 1.55,
      decorations: [
        { type: 'building', id: 'home', label: 'Casa', x: 11, y: 2, width: 7, height: 4, wall: 0xf5c56a, roof: 0x8d5b34 },
        { type: 'building', id: 'archive-house', label: 'Arquivo', x: 3, y: 4, width: 4, height: 4, wall: 0xe7d39b, roof: 0x587f62 },
        { type: 'building', id: 'gym-house', label: 'Treino', x: 22, y: 5, width: 4, height: 4, wall: 0xdabfa1, roof: 0xb75d4d },
        { type: 'station', id: 'archive', x: 5, y: 10, texture: 'station-archive' },
        { type: 'station', id: 'training', x: 24, y: 11, texture: 'station-training' },
        { type: 'station', id: 'garden', x: 17, y: 11, texture: 'station-garden' },
        { type: 'station', id: 'fountain', x: 20, y: 16, texture: 'station-fountain' },
      ],
      interactables: [
        {
          id: 'archive',
          title: 'Arquivo Bee',
          position: { x: 5, y: 10 },
          message: 'Aqui a Bee pesquisa mensagens, ideias e pistas antes de responder com calma.',
        },
        {
          id: 'training',
          title: 'Area de Treino',
          position: { x: 24, y: 11 },
          message: 'Um pouco de treino ajuda a Bee a manter ritmo nas tarefas longas.',
        },
        {
          id: 'garden',
          title: 'Jardim de Polen',
          position: { x: 17, y: 11 },
          message: 'As flores daqui rendem polen quando a Bee cuida bem da rotina.',
          reward: { pollen: 2, xp: 1 },
        },
        {
          id: 'fountain',
          title: 'Fonte Mansa',
          position: { x: 20, y: 16 },
          message: 'A agua da fonte recupera a disposicao da Bee.',
          heal: 2,
        },
      ],
      npcs: [
        {
          id: 'mentor-mel',
          name: 'Mel',
          position: { x: 13, y: 10 },
          texture: 'npc-mel',
          message: 'Oi! Esta versao ja parece RPG Maker: mapa em grade, dialogo em React e a Bee andando tile por tile.',
        },
        {
          id: 'runner-iasmin',
          name: 'Iasmin',
          position: { x: 8, y: 13 },
          texture: 'npc-iasmin',
          message: 'Quando uma tarefa chegar do app, a Bee vai ate a estacao certa e volta com recompensa.',
        },
      ],
      items: [
        { id: 'pollen-1', type: 'pollen', x: 10, y: 13, amount: 3 },
        { id: 'pollen-2', type: 'pollen', x: 21, y: 10, amount: 3 },
        { id: 'heart-1', type: 'heart', x: 25, y: 15, amount: 2 },
      ],
      teleports: [
        {
          id: 'home-door',
          at: { x: 14, y: 6 },
          targetMapKey: 'house',
          targetPosition: { x: 7, y: 10 },
          label: 'Entrando em casa',
        },
      ],
    };
  }

  function buildHouseMap() {
    const width = 16;
    const height = 13;
    const ground = createGrid(width, height, TILES.FLOOR);
    const blocks = [];

    setRect(ground, 0, 0, width, 1, TILES.WALL);
    setRect(ground, 0, height - 1, width, 1, TILES.WALL);
    setRect(ground, 0, 0, 1, height, TILES.WALL);
    setRect(ground, width - 1, 0, 1, height, TILES.WALL);
    setRect(ground, 6, 8, 4, 2, TILES.RUG);
    ground[11][7] = TILES.DOOR;

    blocks.push({ x: 3, y: 4 }, { x: 4, y: 4 }, { x: 9, y: 4 }, { x: 10, y: 4 });
    blocks.push({ x: 4, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 }, { x: 2, y: 9 });
    blocks.push({ x: 12, y: 10 });

    return {
      key: 'house',
      name: 'Quarto da Bee',
      width,
      height,
      ground,
      blocks,
      start: { x: 7, y: 10 },
      cameraZoom: 2.2,
      decorations: [
        { type: 'station', id: 'bed', x: 3, y: 4, texture: 'station-bed' },
        { type: 'station', id: 'desk', x: 9, y: 4, texture: 'station-desk' },
        { type: 'station', id: 'agenda', x: 11, y: 8, texture: 'station-agenda' },
        { type: 'station', id: 'training', x: 12, y: 10, texture: 'station-training' },
        { type: 'station', id: 'wardrobe', x: 4, y: 8, texture: 'station-wardrobe' },
        { type: 'station', id: 'plant', x: 2, y: 9, texture: 'station-garden' },
      ],
      interactables: [
        {
          id: 'bed',
          title: 'Cama',
          position: { x: 3, y: 4 },
          message: 'Descanso curto. A Bee recupera energia e fica pronta para outra rodada.',
          heal: 2,
        },
        {
          id: 'desk',
          title: 'Notebook da Bee',
          position: { x: 9, y: 4 },
          message: 'Quando o chat pede uma pesquisa, a Bee vem ate o notebook e trabalha daqui.',
          reward: { xp: 2 },
        },
        {
          id: 'training',
          title: 'Tapete de Treino',
          position: { x: 12, y: 10 },
          message: 'A Bee usa este tapete para pequenas rotinas de foco e movimento.',
          reward: { xp: 1 },
        },
        {
          id: 'agenda',
          title: 'Agenda',
          position: { x: 11, y: 8 },
          message: 'A agenda organiza compromissos, lembretes e rotinas da Bee.',
        },
        {
          id: 'wardrobe',
          title: 'Guarda-roupa',
          position: { x: 4, y: 8 },
          message: 'Depois da base do RPG, este ponto pode virar editor de visual da Bee.',
        },
        {
          id: 'plant',
          title: 'Planta de Polen',
          position: { x: 2, y: 9 },
          message: 'Uma planta pequena, mas generosa.',
          reward: { pollen: 1 },
        },
      ],
      npcs: [
        {
          id: 'mini-bee',
          name: 'Bia',
          position: { x: 12, y: 6 },
          texture: 'npc-bia',
          message: 'O HUD e a caixa de dialogo sao React. O mapa e a movimentacao ficam no Phaser.',
        },
      ],
      items: [
        { id: 'pollen-house-1', type: 'pollen', x: 6, y: 5, amount: 2 },
        { id: 'heart-house-1', type: 'heart', x: 13, y: 6, amount: 2 },
      ],
      teleports: [
        {
          id: 'exit-door',
          at: { x: 7, y: 11 },
          targetMapKey: 'village',
          targetPosition: { x: 14, y: 7 },
          label: 'Saindo para a vila',
        },
      ],
    };
  }

  const MAP_BUILDERS = {
    village: buildVillageMap,
    house: buildHouseMap,
  };

  function mountReactUi() {
    const rootElement = document.getElementById('ui-root');
    const React = window.React;
    const ReactDOM = window.ReactDOM;

    if (!rootElement || !React || !ReactDOM) {
      return;
    }

    const e = React.createElement;

    function BeeUi() {
      const [hud, setHud] = React.useState({
        ...DEFAULT_STATS,
        healthStates: healthStates(DEFAULT_STATS.health, DEFAULT_STATS.maxHealth),
      });
      const [dialog, setDialog] = React.useState(null);
      const [toast, setToast] = React.useState(null);

      React.useEffect(() => {
        const handleHud = (event) => {
          setHud((current) => ({ ...current, ...event.detail }));
        };
        const handleDialogOpen = (event) => setDialog(event.detail);
        const handleDialogClose = () => setDialog(null);
        const handleToast = (event) => {
          setToast(event.detail.text);
          window.clearTimeout(handleToast.timeoutId);
          handleToast.timeoutId = window.setTimeout(() => setToast(null), 2600);
        };

        window.addEventListener('bee-hud:update', handleHud);
        window.addEventListener('bee-dialog:open', handleDialogOpen);
        window.addEventListener('bee-dialog:close', handleDialogClose);
        window.addEventListener('bee-toast', handleToast);

        return () => {
          window.removeEventListener('bee-hud:update', handleHud);
          window.removeEventListener('bee-dialog:open', handleDialogOpen);
          window.removeEventListener('bee-dialog:close', handleDialogClose);
          window.removeEventListener('bee-toast', handleToast);
          window.clearTimeout(handleToast.timeoutId);
        };
      }, []);

      const closeDialog = React.useCallback(() => {
        if (dialog) {
          window.dispatchEvent(new CustomEvent('bee-dialog:end', { detail: dialog }));
        }
        setDialog(null);
      }, [dialog]);

      return e(
        'div',
        { className: 'bee-ui' },
        e(
          'section',
          { className: 'bee-hud bee-panel', 'aria-label': 'Status da Bee' },
          e(
            'div',
            { className: 'bee-hearts' },
            (hud.healthStates || []).map((state, index) => e('span', { key: index, className: `bee-heart ${state}` })),
          ),
          e(
            'div',
            { className: 'bee-metrics' },
            e(Metric, { label: 'Nivel', value: hud.level }),
            e(Metric, { label: 'Polen', value: hud.pollen }),
            e(Metric, { label: 'XP', value: hud.xp }),
          ),
          e('div', { className: 'bee-quest' }, hud.quest || 'Explore a Casa da Bee.'),
        ),
        toast ? e('div', { className: 'bee-toast' }, toast) : null,
        dialog
          ? e(
              'section',
              { className: 'bee-dialog', role: 'dialog', 'aria-live': 'polite' },
              e('div', { className: 'bee-dialog-speaker' }, dialog.speaker || 'Bee'),
              e('div', { className: 'bee-dialog-message' }, dialog.message),
              e('div', { className: 'bee-dialog-actions' }, e('button', { className: 'bee-button', onClick: closeDialog }, dialog.actionLabel || 'OK')),
            )
          : null,
      );
    }

    function Metric({ label, value }) {
      return e('div', { className: 'bee-metric' }, e('span', { className: 'bee-label' }, label), e('strong', { className: 'bee-value' }, String(value ?? 0)));
    }

    if (ReactDOM.createRoot) {
      ReactDOM.createRoot(rootElement).render(e(BeeUi));
    } else {
      ReactDOM.render(e(BeeUi), rootElement);
    }
  }

  class BeeWorldScene extends Phaser.Scene {
    constructor() {
      super('BeeWorldScene');
      this.mapKey = 'house';
      this.pendingTask = null;
      this.completedTaskIds = new Set();
    }

    init(data) {
      this.mapKey = data?.mapKey || 'house';
      this.heroStart = data?.heroStart || null;
      this.pendingTask = data?.pendingTask || null;
    }

    create() {
      activeScene = this;
      this.localState = loadLocalState();
      this.collectedItems = new Set(this.localState.collectedItems || []);
      this.stats = {
        ...DEFAULT_STATS,
        ...(this.localState.stats || {}),
      };

      this.createRuntimeTextures();
      this.createMap(this.mapKey, this.heroStart);
      this.bindGridEngineEvents();
      this.applySnapshot(latestSnapshot);
      this.updateHud({ quest: this.stats.quest });
      this.scheduleAmbientWander(900);

      queuedBridgePayloads.forEach((payload) => this.receiveBridgePayload(payload));
      queuedBridgePayloads = [];

      if (this.pendingTask) {
        this.time.delayedCall(400, () => this.startBridgeTask(this.pendingTask));
      }

      this.cameras.main.fadeIn(260, 20, 18, 12);
      postToApp({ type: 'game_ready' });

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.wanderTimer?.remove(false);
        this.subscriptions?.forEach((subscription) => subscription.unsubscribe());
        activeScene = null;
      });
    }

    createRuntimeTextures() {
      this.createTilesetTexture();
      this.createBeeTextures();
      this.createNpcTextures();
      this.createStationTextures();
      this.createItemTextures();
    }

    createTilesetTexture() {
      if (this.textures.exists('bee-rpg-tiles')) return;

      const texture = this.textures.createCanvas('bee-rpg-tiles', TILE_SIZE * 9, TILE_SIZE);
      const context = texture.getContext();
      context.imageSmoothingEnabled = false;

      const fillPixels = (x, pixels, color) => {
        if (!color) return;
        context.fillStyle = color;
        pixels.forEach(([px, py, width = 2, height = 2]) => {
          context.fillRect(x + px, py, width, height);
        });
      };

      const drawTile = (index, base, accent, shadow, detail) => {
        const x = (index - 1) * TILE_SIZE;
        context.fillStyle = base;
        context.fillRect(x, 0, TILE_SIZE, TILE_SIZE);

        fillPixels(x, [[3, 4], [13, 8], [25, 5], [7, 20], [19, 24], [27, 18]], accent);
        fillPixels(x, [[2, 27, 6, 2], [17, 15, 5, 2], [23, 28, 4, 2]], shadow);

        if (detail) {
          detail(x, fillPixels);
        }

        context.fillStyle = 'rgba(32, 26, 18, 0.16)';
        context.fillRect(x, 31, TILE_SIZE, 1);
        context.fillRect(x + 31, 0, 1, TILE_SIZE);
      };

      drawTile(TILES.GRASS, '#6fbd57', '#8ed46b', '#579947', (x, fill) => {
        fill(x, [[5, 12, 2, 5], [10, 18, 2, 4], [21, 7, 2, 5], [27, 23, 2, 4]], '#4b8f3f');
      });
      drawTile(TILES.PATH, '#b9824d', '#cc9a63', '#8d623c', (x, fill) => {
        fill(x, [[4, 6, 7, 3], [17, 5, 9, 3], [8, 20, 10, 3], [21, 24, 6, 3]], '#9c6a3f');
        context.fillStyle = '#d8ad75';
        context.fillRect(x + 1, 1, 30, 2);
      });
      drawTile(TILES.FLOWER, '#72bf59', '#90d970', '#579947', (x, fill) => {
        fill(x, [[13, 15, 2, 6], [22, 11, 2, 5]], '#3e8437');
        fill(x, [[11, 12], [15, 12], [13, 10], [13, 14]], '#fff06d');
        fill(x, [[20, 8], [24, 8], [22, 6], [22, 10]], '#ef6f85');
      });
      drawTile(TILES.WATER, '#367fbc', '#67b8df', '#246596', (x, fill) => {
        fill(x, [[3, 8, 12, 2], [18, 16, 10, 2], [8, 25, 14, 2]], '#9bd7f1');
        fill(x, [[0, 29, 32, 3]], '#246596');
      });
      drawTile(TILES.FLOOR, '#c99357', '#d6a66b', '#9f6c3f', (x, fill) => {
        for (let row = 7; row < TILE_SIZE; row += 8) {
          context.fillStyle = '#916039';
          context.fillRect(x, row, TILE_SIZE, 2);
          context.fillStyle = '#e1b579';
          context.fillRect(x + ((row / 8) % 2 ? 10 : 2), row - 3, 13, 2);
        }
      });
      drawTile(TILES.WALL, '#6c5138', '#7b6044', '#4b3827', (x, fill) => {
        fill(x, [[0, 9, 32, 2], [0, 19, 32, 2], [7, 0, 2, 9], [21, 10, 2, 9], [13, 20, 2, 12]], '#4f3a28');
        fill(x, [[1, 1, 30, 2], [2, 11, 28, 2]], '#8d7050');
      });
      drawTile(TILES.RUG, '#a63f45', '#cf6c55', '#743135', (x, fill) => {
        context.fillStyle = '#672a32';
        context.fillRect(x + 3, 3, 26, 26);
        context.fillStyle = '#c95558';
        context.fillRect(x + 5, 5, 22, 22);
        fill(x, [[8, 8, 16, 3], [8, 21, 16, 3], [14, 12, 4, 8]], '#f0b05a');
      });
      drawTile(TILES.DOOR, '#a8703f', '#ca9658', '#6f492c', (x, fill) => {
        context.fillStyle = '#4c3425';
        context.fillRect(x + 9, 3, 14, 27);
        context.fillStyle = '#7c5431';
        context.fillRect(x + 11, 5, 10, 23);
        fill(x, [[18, 16, 2, 2]], '#f2c35a');
      });
      drawTile(TILES.BLOCK, '#000000', '#000000');
      texture.refresh();
    }

    createBeeTextures() {
      ['down', 'up', 'left', 'right'].forEach((direction) => {
        const key = `bee-${direction}`;
        if (this.textures.exists(key)) return;

        const texture = this.textures.createCanvas(key, TILE_SIZE, TILE_SIZE);
        const context = texture.getContext();
        context.imageSmoothingEnabled = false;

        context.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
        context.fillStyle = 'rgba(42, 28, 15, 0.28)';
        context.fillRect(8, 27, 16, 3);
        context.fillRect(11, 30, 10, 1);

        context.fillStyle = 'rgba(245, 253, 255, 0.72)';
        context.fillRect(6, 8, 8, 10);
        context.fillRect(18, 8, 8, 10);
        context.fillStyle = 'rgba(166, 218, 226, 0.56)';
        context.fillRect(8, 10, 5, 6);
        context.fillRect(19, 10, 5, 6);

        context.fillStyle = '#3c2a17';
        context.fillRect(10, 11, 12, 16);
        context.fillRect(8, 15, 16, 8);
        context.fillStyle = '#f6c847';
        context.fillRect(11, 9, 10, 19);
        context.fillRect(9, 14, 14, 9);
        context.fillStyle = '#ffdf63';
        context.fillRect(13, 10, 7, 4);
        context.fillStyle = '#3b2816';
        context.fillRect(10, 16, 13, 3);
        context.fillRect(11, 22, 11, 3);
        context.fillStyle = '#2a1c10';
        context.fillRect(10, 5, 2, 6);
        context.fillRect(20, 5, 2, 6);

        const eyeY = direction === 'up' ? 12 : 14;
        const leftEyeX = direction === 'left' ? 11 : direction === 'right' ? 16 : 12;
        const rightEyeX = direction === 'left' ? 15 : direction === 'right' ? 20 : 18;
        if (direction !== 'up') {
          context.fillStyle = '#fff8c8';
          context.fillRect(leftEyeX, eyeY, 3, 3);
          context.fillRect(rightEyeX, eyeY, 3, 3);
          context.fillStyle = '#1e150c';
          context.fillRect(leftEyeX + 1, eyeY + 1, 1, 1);
          context.fillRect(rightEyeX + 1, eyeY + 1, 1, 1);
        } else {
          context.fillStyle = '#3b2816';
          context.fillRect(12, 12, 8, 2);
        }

        texture.refresh();
      });
    }

    createNpcTextures() {
      [
        ['npc-mel', '#ffe78a', '#7b4f2a'],
        ['npc-iasmin', '#8bd7ff', '#244969'],
        ['npc-bia', '#f2b6ff', '#6d3476'],
      ].forEach(([key, body, detail]) => {
        if (this.textures.exists(key)) return;

        const texture = this.textures.createCanvas(key, TILE_SIZE, TILE_SIZE);
        const context = texture.getContext();
        context.imageSmoothingEnabled = false;
        context.fillStyle = 'rgba(42, 28, 15, 0.24)';
        context.fillRect(8, 28, 17, 3);
        context.fillStyle = detail;
        context.fillRect(10, 17, 13, 11);
        context.fillStyle = '#2f2217';
        context.fillRect(9, 16, 15, 2);
        context.fillRect(9, 27, 15, 2);
        context.fillStyle = body;
        context.fillRect(10, 6, 13, 12);
        context.fillRect(8, 9, 17, 7);
        context.fillStyle = '#3f2d1d';
        context.fillRect(9, 5, 15, 2);
        context.fillRect(8, 7, 2, 10);
        context.fillRect(23, 8, 2, 8);
        context.fillStyle = detail;
        context.fillRect(10, 5, 13, 4);
        context.fillStyle = '#ffffff';
        context.fillRect(12, 11, 3, 3);
        context.fillRect(18, 11, 3, 3);
        context.fillStyle = '#1e150c';
        context.fillRect(13, 12, 1, 1);
        context.fillRect(19, 12, 1, 1);
        texture.refresh();
      });
    }

    createStationTextures() {
      const draw = (key, callback) => {
        if (this.textures.exists(key)) return;
        const texture = this.textures.createCanvas(key, TILE_SIZE, TILE_SIZE);
        const context = texture.getContext();
        context.imageSmoothingEnabled = false;
        callback(context);
        texture.refresh();
      };

      const shadow = (context, x, y, width) => {
        context.fillStyle = 'rgba(42, 28, 15, 0.28)';
        context.fillRect(x, y, width, 3);
        context.fillRect(x + 3, y + 3, Math.max(width - 6, 2), 1);
      };

      draw('station-archive', (context) => {
        shadow(context, 5, 27, 22);
        context.fillStyle = '#4d3426';
        context.fillRect(5, 10, 22, 17);
        context.fillStyle = '#8a6140';
        context.fillRect(7, 8, 18, 18);
        context.fillStyle = '#f6d889';
        context.fillRect(9, 5, 14, 6);
        context.fillStyle = '#fff5bf';
        context.fillRect(10, 12, 12, 10);
        context.fillStyle = '#7b5637';
        context.fillRect(11, 14, 10, 2);
        context.fillRect(11, 18, 7, 2);
      });
      draw('station-training', (context) => {
        shadow(context, 7, 26, 18);
        context.fillStyle = '#53372d';
        context.fillRect(14, 6, 4, 21);
        context.fillRect(9, 10, 14, 4);
        context.fillStyle = '#c34e4e';
        context.fillRect(7, 8, 6, 8);
        context.fillRect(19, 8, 6, 8);
        context.fillStyle = '#ee7a60';
        context.fillRect(8, 9, 4, 5);
        context.fillRect(20, 9, 4, 5);
      });
      draw('station-garden', (context) => {
        shadow(context, 6, 27, 20);
        context.fillStyle = '#6b4c2c';
        context.fillRect(5, 18, 22, 9);
        context.fillStyle = '#8a6239';
        context.fillRect(7, 16, 18, 4);
        context.fillStyle = '#3d8b42';
        context.fillRect(9, 11, 14, 9);
        context.fillStyle = '#55b854';
        context.fillRect(11, 9, 4, 6);
        context.fillRect(18, 10, 4, 6);
        context.fillStyle = '#ffed60';
        context.fillRect(15, 7, 4, 4);
        context.fillStyle = '#f07379';
        context.fillRect(21, 9, 3, 3);
      });
      draw('station-fountain', (context) => {
        shadow(context, 5, 27, 22);
        context.fillStyle = '#65798b';
        context.fillRect(5, 18, 22, 8);
        context.fillStyle = '#90a0ad';
        context.fillRect(7, 15, 18, 5);
        context.fillStyle = '#4ba9d8';
        context.fillRect(9, 9, 14, 12);
        context.fillStyle = '#a8e4f3';
        context.fillRect(11, 11, 10, 2);
        context.fillRect(12, 16, 8, 2);
        context.fillStyle = '#ffffff';
        context.fillRect(14, 5, 4, 8);
      });
      draw('station-bed', (context) => {
        shadow(context, 4, 27, 25);
        context.fillStyle = '#5e3d2a';
        context.fillRect(4, 12, 25, 15);
        context.fillStyle = '#8b5a36';
        context.fillRect(5, 10, 23, 15);
        context.fillStyle = '#f0deac';
        context.fillRect(7, 7, 10, 9);
        context.fillStyle = '#d85f5d';
        context.fillRect(15, 12, 12, 11);
        context.fillStyle = '#f1a064';
        context.fillRect(17, 13, 8, 2);
      });
      draw('station-desk', (context) => {
        shadow(context, 5, 27, 22);
        context.fillStyle = '#5d3a24';
        context.fillRect(5, 14, 22, 10);
        context.fillRect(7, 24, 3, 4);
        context.fillRect(22, 24, 3, 4);
        context.fillStyle = '#8a5a35';
        context.fillRect(6, 12, 20, 9);
        context.fillStyle = '#23304d';
        context.fillRect(10, 6, 12, 9);
        context.fillStyle = '#8fd6f4';
        context.fillRect(12, 8, 8, 5);
        context.fillStyle = '#f5d56a';
        context.fillRect(18, 17, 5, 2);
      });
      draw('station-agenda', (context) => {
        shadow(context, 8, 27, 17);
        context.fillStyle = '#233f68';
        context.fillRect(7, 5, 18, 22);
        context.fillStyle = '#4f89cf';
        context.fillRect(9, 4, 15, 22);
        context.fillStyle = '#ffffff';
        context.fillRect(12, 8, 9, 2);
        context.fillRect(12, 13, 9, 2);
        context.fillRect(12, 18, 7, 2);
        context.fillStyle = '#f7c857';
        context.fillRect(9, 4, 3, 22);
      });
      draw('station-wardrobe', (context) => {
        shadow(context, 6, 28, 20);
        context.fillStyle = '#5f3d25';
        context.fillRect(5, 5, 22, 23);
        context.fillStyle = '#91613a';
        context.fillRect(7, 4, 18, 23);
        context.fillStyle = '#6f472b';
        context.fillRect(15, 5, 2, 21);
        context.fillStyle = '#b47a45';
        context.fillRect(9, 7, 5, 15);
        context.fillRect(18, 7, 5, 15);
        context.fillStyle = '#f5cd62';
        context.fillRect(12, 16, 3, 3);
        context.fillRect(18, 16, 3, 3);
      });
    }

    createItemTextures() {
      if (!this.textures.exists('item-pollen')) {
        const pollen = this.textures.createCanvas('item-pollen', TILE_SIZE, TILE_SIZE);
        const context = pollen.getContext();
        context.imageSmoothingEnabled = false;
        context.fillStyle = 'rgba(42, 28, 15, 0.24)';
        context.fillRect(11, 24, 11, 3);
        context.fillStyle = '#7a4d12';
        context.fillRect(11, 11, 12, 12);
        context.fillStyle = '#ffdb4a';
        context.fillRect(12, 10, 10, 14);
        context.fillRect(10, 13, 14, 8);
        context.fillStyle = '#f2a83b';
        context.fillRect(12, 20, 10, 3);
        context.fillStyle = '#fff4a3';
        context.fillRect(14, 11, 3, 3);
        pollen.refresh();
      }

      if (!this.textures.exists('item-heart')) {
        const heart = this.textures.createCanvas('item-heart', TILE_SIZE, TILE_SIZE);
        const context = heart.getContext();
        context.imageSmoothingEnabled = false;
        context.fillStyle = 'rgba(42, 28, 15, 0.24)';
        context.fillRect(10, 25, 13, 3);
        context.fillStyle = '#7b2424';
        context.fillRect(10, 10, 5, 5);
        context.fillRect(18, 10, 5, 5);
        context.fillRect(8, 14, 17, 7);
        context.fillRect(11, 21, 11, 4);
        context.fillStyle = '#e65050';
        context.fillRect(11, 9, 4, 5);
        context.fillRect(18, 9, 4, 5);
        context.fillRect(9, 13, 15, 7);
        context.fillRect(12, 20, 9, 4);
        context.fillStyle = '#ff8a86';
        context.fillRect(12, 11, 3, 3);
        heart.refresh();
      }
    }

    createMap(mapKey, heroStart) {
      const builder = MAP_BUILDERS[mapKey] || MAP_BUILDERS.village;
      this.mapDef = builder();
      this.mapKey = this.mapDef.key;
      this.stats.location = this.mapDef.name;

      const map = this.make.tilemap({ data: this.mapDef.ground, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
      const tileset = map.addTilesetImage('bee-rpg-tiles', 'bee-rpg-tiles', TILE_SIZE, TILE_SIZE);
      const groundLayer = map.createLayer(0, tileset, 0, 0);
      const blockedPositions = new Set(this.mapDef.blocks.map(toKey));

      groundLayer.forEachTile((tile) => {
        tile.properties = {
          ...tile.properties,
          ge_collide: BLOCKING_GROUND_TILES.has(tile.index) || blockedPositions.has(toKey({ x: tile.x, y: tile.y })),
        };
      });

      this.map = map;
      this.groundLayer = groundLayer;
      this.interactablesByPosition = new Map(this.mapDef.interactables.map((item) => [toKey(item.position), item]));
      this.npcsByPosition = new Map(this.mapDef.npcs.map((npc) => [toKey(npc.position), npc]));
      this.teleportsByPosition = new Map(this.mapDef.teleports.map((teleport) => [toKey(teleport.at), teleport]));
      this.itemsByPosition = new Map();

      this.drawDecorations();
      this.createItems();

      const heroSprite = this.add.sprite(0, 0, 'bee-down').setOrigin(0, 0);
      heroSprite.setDepth(100);
      this.heroSprite = heroSprite;

      const characters = [
        {
          id: PLAYER_ID,
          sprite: heroSprite,
          startPosition: heroStart || this.mapDef.start,
          speed: 4,
        },
      ];

      this.mapDef.npcs.forEach((npc) => {
        const sprite = this.add.sprite(0, 0, npc.texture).setOrigin(0, 0);
        sprite.setDepth(90);
        characters.push({
          id: npc.id,
          sprite,
          startPosition: npc.position,
          speed: 1,
        });
      });

      this.gridEngine.create(map, {
        characters,
        numberOfDirections: 4,
      });

      this.marker = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0xffffff, 0.16).setOrigin(0, 0);
      this.marker.setStrokeStyle(2, 0xffe36a, 0.8);
      this.marker.setDepth(80);
      this.marker.setVisible(false);
      this.updateMarker();

      this.cameras.main.setBounds(0, 0, this.mapDef.width * TILE_SIZE, this.mapDef.height * TILE_SIZE);
      this.cameras.main.startFollow(this.heroSprite, true, 0.12, 0.12);
      this.cameras.main.setZoom(this.mapDef.cameraZoom || 1.6);
      this.updateHud({
        location: this.mapDef.name,
        quest: this.stats.quest,
      });
    }

    drawDecorations() {
      this.mapDef.decorations.forEach((decoration) => {
        if (decoration.type === 'building') {
          const x = decoration.x * TILE_SIZE;
          const y = decoration.y * TILE_SIZE;
          const width = decoration.width * TILE_SIZE;
          const height = decoration.height * TILE_SIZE;
          const graphics = this.add.graphics();

          graphics.fillStyle(decoration.wall, 1);
          graphics.fillRect(x + 6, y + 24, width - 12, height - 18);
          graphics.fillStyle(decoration.roof, 1);
          graphics.fillTriangle(x, y + 28, x + width / 2, y, x + width, y + 28);
          graphics.fillRect(x + 8, y + 26, width - 16, 12);
          graphics.fillStyle(0x3b281d, 1);
          graphics.fillRect(x + width / 2 - 8, y + height - 24, 16, 24);
          graphics.setDepth((decoration.y + decoration.height) * TILE_SIZE);

          const label = this.add.text(x + width / 2, y + height - 8, decoration.label, {
            color: '#fff0b3',
            fontFamily: 'Fredoka, system-ui, sans-serif',
            fontSize: '11px',
            fontStyle: 'bold',
            stroke: '#4c3320',
            strokeThickness: 3,
          });
          label.setOrigin(0.5, 1);
          label.setDepth((decoration.y + decoration.height) * TILE_SIZE + 1);
          return;
        }

        if (decoration.type === 'station') {
          const image = this.add.image(decoration.x * TILE_SIZE + TILE_SIZE / 2, decoration.y * TILE_SIZE + TILE_SIZE / 2, decoration.texture);
          image.setDepth(decoration.y * TILE_SIZE + 5);
        }
      });
    }

    createItems() {
      this.mapDef.items.forEach((item) => {
        const itemKey = `${this.mapKey}:${item.id}`;
        if (this.collectedItems.has(itemKey)) return;

        const texture = item.type === 'heart' ? 'item-heart' : 'item-pollen';
        const sprite = this.add.image(item.x * TILE_SIZE + TILE_SIZE / 2, item.y * TILE_SIZE + TILE_SIZE / 2, texture);
        sprite.setDepth(item.y * TILE_SIZE + 8);

        this.itemsByPosition.set(toKey({ x: item.x, y: item.y }), {
          ...item,
          itemKey,
          sprite,
        });
      });
    }

    bindGridEngineEvents() {
      this.subscriptions = [
        this.gridEngine.movementStarted().subscribe(({ charId, direction }) => {
          if (charId !== PLAYER_ID) return;
          this.setHeroDirection(direction);
          this.updateMarker();
        }),
        this.gridEngine.directionChanged().subscribe(({ charId, direction }) => {
          if (charId !== PLAYER_ID) return;
          this.setHeroDirection(direction);
          this.updateMarker();
        }),
        this.gridEngine.movementStopped().subscribe(({ charId }) => {
          if (charId !== PLAYER_ID) return;
          this.updateMarker();
          this.handleHeroStep();
        }),
        this.gridEngine.positionChangeFinished().subscribe(({ charId }) => {
          if (charId !== PLAYER_ID) return;
          this.updateMarker();
          this.handleHeroStep();
        }),
      ];
    }

    scheduleAmbientWander(delay) {
      this.wanderTimer?.remove(false);
      this.wanderTimer = this.time.delayedCall(delay ?? Phaser.Math.Between(2800, 6200), () => {
        this.performAmbientWander();
      });
    }

    performAmbientWander() {
      if (!this.gridEngine) return;

      if (this.activeTask || this.taskRoute || this.dialogActive || this.gridEngine.isMoving(PLAYER_ID)) {
        this.scheduleAmbientWander(1600);
        return;
      }

      const target = this.pickAmbientDestination();
      if (target) {
        this.stats.mood = 'wandering';
        this.stats.quest = 'Bee esta passeando pela casa enquanto aguarda o chat.';
        this.updateHud();
        this.gridEngine.moveTo(PLAYER_ID, target);
      }

      this.scheduleAmbientWander();
    }

    pauseAmbientWander() {
      this.wanderTimer?.remove(false);
      this.wanderTimer = null;
    }

    pickAmbientDestination() {
      const stationRoll = Phaser.Math.Between(1, 100);
      if (stationRoll <= 45) {
        const stations = this.mapDef.interactables
          .map((interactable) => this.findNearestStandTile(interactable.position))
          .filter(Boolean);

        if (stations.length > 0) {
          return Phaser.Utils.Array.GetRandom(stations);
        }
      }

      for (let attempt = 0; attempt < 28; attempt += 1) {
        const position = {
          x: Phaser.Math.Between(1, this.mapDef.width - 2),
          y: Phaser.Math.Between(1, this.mapDef.height - 2),
        };

        if (!this.isBlockedAt(position) && !this.teleportsByPosition.has(toKey(position))) {
          return position;
        }
      }

      return null;
    }

    setHeroDirection(direction) {
      const key = `bee-${direction}`;
      if (this.textures.exists(key)) {
        this.heroSprite.setTexture(key);
      }
    }

    getHeroPosition() {
      return this.gridEngine.getPosition(PLAYER_ID);
    }

    getFrontPosition() {
      const direction = this.gridEngine.getFacingDirection(PLAYER_ID) || 'down';
      return addPosition(this.getHeroPosition(), direction);
    }

    updateMarker() {
      if (!this.marker || !this.gridEngine) return;

      const front = this.getFrontPosition();
      this.marker.setVisible(false);
      this.marker.setPosition(front.x * TILE_SIZE, front.y * TILE_SIZE);
    }

    handleHeroStep() {
      const position = this.getHeroPosition();
      this.collectItemAt(position);

      const teleport = this.teleportsByPosition.get(toKey(position));
      if (teleport) {
        if (this.activeTask) {
          this.showToast(teleport.label);
          this.changeMap(teleport.targetMapKey, teleport.targetPosition, this.activeTask);
        }
        return;
      }

      if (this.taskRoute && toKey(position) === toKey(this.taskRoute.standPosition)) {
        this.arriveAtTaskStation();
      }
    }

    collectItemAt(position) {
      const item = this.itemsByPosition.get(toKey(position));
      if (!item) return;

      this.itemsByPosition.delete(toKey(position));
      this.collectedItems.add(item.itemKey);
      item.sprite.destroy();

      if (item.type === 'heart') {
        this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + item.amount);
        this.showToast('Energia restaurada.');
      } else {
        this.stats.pollen += item.amount;
        this.stats.xp += 1;
        this.showToast(`+${item.amount} polen coletado.`);
      }

      this.persistLocalState();
      this.updateHud();
    }

    interact() {
      if (!this.gridEngine || this.gridEngine.isMoving(PLAYER_ID)) return;

      const front = this.getFrontPosition();
      const frontKey = toKey(front);
      const npc = this.npcsByPosition.get(frontKey);
      if (npc) {
        this.turnHeroToward(npc.position);
        this.openDialog({ speaker: npc.name, message: npc.message });
        return;
      }

      const interactable = this.interactablesByPosition.get(frontKey);
      if (interactable) {
        this.turnHeroToward(interactable.position);
        this.handleInteractable(interactable);
        return;
      }

      const teleport = this.teleportsByPosition.get(frontKey);
      if (teleport) {
        this.changeMap(teleport.targetMapKey, teleport.targetPosition, this.activeTask || null);
        return;
      }

      this.showToast('Nada para interagir aqui.');
    }

    handleInteractable(interactable) {
      const afterDialog = () => {
        if (interactable.reward) {
          this.stats.pollen += interactable.reward.pollen || 0;
          this.stats.xp += interactable.reward.xp || 0;
          this.showToast('A Bee ganhou uma pequena recompensa.');
        }

        if (interactable.heal) {
          this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + interactable.heal);
          this.showToast('Energia restaurada.');
        }

        this.persistLocalState();
        this.updateHud();
      };

      this.openDialog(
        {
          speaker: interactable.title,
          message: interactable.message,
        },
        interactable.reward || interactable.heal ? afterDialog : null,
      );
    }

    openDialog(dialog, onDone) {
      const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let finished = false;
      this.dialogActive = true;

      const finishDialog = () => {
        if (finished) return;
        finished = true;
        this.dialogActive = false;
        window.removeEventListener('bee-dialog:end', handleEnd);
        if (onDone) {
          onDone();
        }
      };

      const handleEnd = (event) => {
        if (event.detail?.token !== token) return;
        finishDialog();
      };
      window.addEventListener('bee-dialog:end', handleEnd);

      emitUiEvent('bee-dialog:open', {
        token,
        speaker: dialog.speaker || 'Bee',
        message: dialog.message,
        actionLabel: dialog.actionLabel || 'OK',
      });

      if (dialog.autoCloseMs) {
        this.time.delayedCall(dialog.autoCloseMs, () => {
          emitUiEvent('bee-dialog:close');
          finishDialog();
        });
      }
    }

    showToast(text) {
      emitUiEvent('bee-toast', { text });
    }

    updateHud(extra) {
      emitUiEvent('bee-hud:update', {
        pollen: this.stats.pollen,
        xp: this.stats.xp,
        level: this.stats.level,
        mood: this.stats.mood,
        location: this.stats.location,
        quest: this.stats.quest,
        healthStates: healthStates(this.stats.health, this.stats.maxHealth),
        ...(extra || {}),
      });
    }

    persistLocalState() {
      saveLocalState({
        stats: this.stats,
        collectedItems: Array.from(this.collectedItems),
      });
    }

    receiveBridgePayload(payload) {
      if (!payload || typeof payload !== 'object') return;

      if (payload.type === 'house_snapshot') {
        latestSnapshot = payload.snapshot;
        this.applySnapshot(payload.snapshot);
        return;
      }

      if (payload.type === 'ai_task') {
        this.startBridgeTask(payload);
      }
    }

    applySnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') return;

      const profile = snapshot.profile || {};
      this.stats.pollen = numberOr(profile.pollen, this.stats.pollen);
      this.stats.xp = numberOr(profile.xp, this.stats.xp);
      this.stats.level = numberOr(profile.level, this.stats.level);
      this.stats.mood = profile.currentState || this.stats.mood;
      this.persistLocalState();
      this.updateHud();
    }

    startBridgeTask(task) {
      const target = TASK_TARGETS[task.target] || TASK_TARGETS.study;
      const normalizedTask = {
        ...task,
        id: task.id || `local-${Date.now()}`,
        target: task.target || 'study',
        reward: numberOr(task.reward, 15),
        xp: numberOr(task.xp, 15),
      };

      if (this.completedTaskIds.has(normalizedTask.id)) return;

      this.pauseAmbientWander();
      if (this.gridEngine?.isMoving(PLAYER_ID)) {
        this.gridEngine.stopMovement(PLAYER_ID);
      }

      this.activeTask = normalizedTask;
      this.stats.quest = `${target.label}: ${task.speechText || 'Bee recebeu uma tarefa da IA.'}`;
      this.stats.mood = 'working';
      this.updateHud();
      postToApp({
        type: 'task_ack',
        id: normalizedTask.id,
        target: normalizedTask.target,
        status: 'processing',
      });

      if (this.mapKey !== target.mapKey) {
        this.showToast(`Bee indo para ${target.mapKey === 'house' ? 'casa' : 'vila'}.`);
        this.changeMap(target.mapKey, MAP_BUILDERS[target.mapKey]().start, normalizedTask);
        return;
      }

      this.routeTaskToStation(normalizedTask, target);
    }

    routeTaskToStation(task, target) {
      const interactable = this.mapDef.interactables.find((item) => item.id === target.stationId);
      if (!interactable) {
        this.completeTask(task, target);
        return;
      }

      const standPosition = this.findNearestStandTile(interactable.position) || this.getHeroPosition();
      this.taskRoute = {
        task,
        target,
        interactable,
        standPosition,
        completed: false,
      };

      this.showToast(`${target.label} em andamento.`);

      if (toKey(this.getHeroPosition()) === toKey(standPosition)) {
        this.time.delayedCall(180, () => this.arriveAtTaskStation());
        return;
      }

      this.gridEngine.moveTo(PLAYER_ID, standPosition);
    }

    arriveAtTaskStation() {
      if (!this.taskRoute || this.taskRoute.completed) return;

      this.taskRoute.completed = true;
      this.turnHeroToward(this.taskRoute.interactable.position);
      this.openDialog(
        {
          speaker: 'Bee',
          message: this.taskRoute.target.arrival,
          actionLabel: 'OK',
          autoCloseMs: 2600,
        },
        () => {
          this.completeTask(this.taskRoute.task, this.taskRoute.target);
        },
      );
    }

    completeTask(task, target) {
      if (this.completedTaskIds.has(task.id)) return;

      this.completedTaskIds.add(task.id);
      this.activeTask = null;
      this.taskRoute = null;
      this.stats.pollen += task.reward;
      this.stats.xp += task.xp;
      this.stats.level = Math.max(this.stats.level, 1 + Math.floor(this.stats.xp / 100));
      this.stats.mood = 'done';
      this.stats.quest = 'Tarefa concluida. A Bee esta pronta para a proxima.';
      this.persistLocalState();
      this.updateHud();
      this.showToast(`+${task.reward} polen, +${task.xp} XP.`);
      this.scheduleAmbientWander(2400);

      postToApp({
        type: 'task_done',
        id: task.id,
        target: task.target,
        status: 'completed',
        reward: task.reward,
        xp: task.xp,
      });
    }

    changeMap(mapKey, heroStart, pendingTask) {
      this.cameras.main.fadeOut(220, 20, 18, 12);
      this.time.delayedCall(230, () => {
        this.scene.restart({
          mapKey,
          heroStart,
          pendingTask,
        });
      });
    }

    findNearestStandTile(target) {
      const candidates = [
        { x: target.x, y: target.y + 1 },
        { x: target.x, y: target.y - 1 },
        { x: target.x - 1, y: target.y },
        { x: target.x + 1, y: target.y },
      ];

      const hero = this.getHeroPosition();

      return candidates
        .filter((position) => !this.isBlockedAt(position))
        .sort((left, right) => {
          const leftDistance = Math.abs(left.x - hero.x) + Math.abs(left.y - hero.y);
          const rightDistance = Math.abs(right.x - hero.x) + Math.abs(right.y - hero.y);
          return leftDistance - rightDistance;
        })[0];
    }

    turnHeroToward(target) {
      const direction = directionTo(this.getHeroPosition(), target);
      this.gridEngine.turnTowards(PLAYER_ID, direction);
      this.setHeroDirection(direction);
      this.updateMarker();
    }

    isInBounds(position) {
      return position.x >= 0 && position.y >= 0 && position.x < this.mapDef.width && position.y < this.mapDef.height;
    }

    isBlockedAt(position) {
      if (!this.isInBounds(position)) return true;

      try {
        return this.gridEngine.isBlocked(position);
      } catch {
        return true;
      }
    }
  }

  function startGame(GridEngine) {
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: 'game',
      backgroundColor: '#1c2318',
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      physics: {
        default: 'arcade',
      },
      plugins: {
        scene: [
          {
            key: 'gridEngine',
            plugin: GridEngine,
            mapping: 'gridEngine',
          },
        ],
      },
      scene: [BeeWorldScene],
    });

    window.__beeHouseGame = game;
  }

  function showBootError(error) {
    console.error('[Casa da Bee] Falha ao iniciar o jogo', error);
    emitUiEvent('bee-dialog:open', {
      speaker: 'Casa da Bee',
      message: 'Nao consegui iniciar o jogo Phaser. Recarregue a tela para tentar de novo.',
      actionLabel: 'OK',
    });
  }

  function boot() {
    mountReactUi();

    if (!window.Phaser) {
      showBootError(new Error('Phaser nao carregou.'));
      return;
    }

    import(GRID_ENGINE_URL)
      .then((module) => startGame(module.default || module.GridEngine))
      .catch(showBootError);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
