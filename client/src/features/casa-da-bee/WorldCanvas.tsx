import { useCallback, useEffect, useRef } from "react";
import type { BeeGameApi, BeePixel } from "./engine/state";
import { TILES, type BeeHouseMap, type MapItem, type Station, type MapNpc, type Position } from "./engine/types";
import { findItem, type CatalogItem } from "./engine/catalog";
import type { InventoryApi } from "./engine/inventory";
import type { TimeOfDay } from "./engine/dayNight";
import { DAY_NIGHT_PRESETS } from "./engine/dayNight";

interface SpawnedItem extends MapItem {
  spawnedAt: number;
}

interface WorldCanvasProps {
  game: BeeGameApi;
  inventory: InventoryApi;
  spawnedItems: SpawnedItem[];
  timeOfDay: TimeOfDay;
  onStationClick: (station: Station) => void;
  onNpcClick: (npc: MapNpc) => void;
  onItemPickup: (item: SpawnedItem) => void;
}

const VIRTUAL_WIDTH = 16;
const VIRTUAL_HEIGHT = 13;

export function WorldCanvas({
  game,
  inventory,
  spawnedItems,
  timeOfDay,
  onStationClick,
  onNpcClick,
  onItemPickup,
}: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const tileSizeRef = useRef<number>(32);

  // refs pra evitar dependencias no rAF loop
  const gameRef = useRef(game);
  const inventoryRef = useRef(inventory);
  const itemsRef = useRef(spawnedItems);
  const timeOfDayRef = useRef(timeOfDay);
  gameRef.current = game;
  inventoryRef.current = inventory;
  itemsRef.current = spawnedItems;
  timeOfDayRef.current = timeOfDay;

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    function resize() {
      if (!canvas || !container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const tileByW = Math.floor(w / VIRTUAL_WIDTH);
      const tileByH = Math.floor(h / VIRTUAL_HEIGHT);
      const tileSize = Math.max(16, Math.min(tileByW, tileByH));
      tileSizeRef.current = tileSize;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = VIRTUAL_WIDTH * tileSize * dpr;
      canvas.height = VIRTUAL_HEIGHT * tileSize * dpr;
      canvas.style.width = `${VIRTUAL_WIDTH * tileSize}px`;
      canvas.style.height = `${VIRTUAL_HEIGHT * tileSize}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function frame(now: number) {
      const ts = tileSizeRef.current;
      const w = VIRTUAL_WIDTH * ts;
      const h = VIRTUAL_HEIGHT * ts;
      ctx!.clearRect(0, 0, w, h);

      const g = gameRef.current;
      const inv = inventoryRef.current;
      const items = itemsRef.current;
      const tod = timeOfDayRef.current;

      drawWalls(ctx!, ts, inv.getEquippedItem("wallpaper"));
      drawFloor(ctx!, g.map, ts, inv.getEquippedItem("floor"), inv.getEquippedItem("furniture-rug"));
      drawStations(ctx!, g.map.stations, ts, now, inv);
      drawNpcs(ctx!, g.map.npcs, ts, now);
      drawItems(ctx!, items, ts, now);
      drawBee(ctx!, g.getBeePixel(), ts, now, g.state, inv);
      drawDayNightVignette(ctx!, w, h, tod);

      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Click handler
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ts = tileSizeRef.current;
    const tx = Math.floor((e.clientX - rect.left) / ts);
    const ty = Math.floor((e.clientY - rect.top) / ts);
    const pos: Position = { x: tx, y: ty };

    // 1. Item passivo? (pickup)
    const item = itemsRef.current.find((i) => i.position.x === tx && i.position.y === ty);
    if (item) {
      onItemPickup(item);
      return;
    }
    // 2. Estacao?
    const station = gameRef.current.map.stations.find((s) => s.position.x === tx && s.position.y === ty);
    if (station) {
      onStationClick(station);
      gameRef.current.walkToStation(station.id);
      return;
    }
    // 3. NPC?
    const npc = gameRef.current.map.npcs.find((n) => n.position.x === tx && n.position.y === ty);
    if (npc) {
      onNpcClick(npc);
      return;
    }
    // 4. Tile livre? Anda
    gameRef.current.walkToTile(pos);
  }, [onItemPickup, onStationClick, onNpcClick]);

  return (
    <div ref={containerRef} style={styles.container}>
      <canvas ref={canvasRef} onClick={handleClick} style={styles.canvas} />
    </div>
  );
}

// ============ DRAWING HELPERS ============

function drawWalls(ctx: CanvasRenderingContext2D, ts: number, wallpaper: CatalogItem | null) {
  const wp = wallpaper?.data as { base?: string; accent?: string; shadow?: string; stars?: boolean } | undefined;
  const base = wp?.base ?? "#6c5138";
  const accent = wp?.accent ?? "#8d7050";
  const shadow = wp?.shadow ?? "#4b3827";

  // 4 linhas de top como parede
  const wallHeight = 4;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH * ts, wallHeight * ts);

  // listras horizontais (madeira / textura)
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  for (let row = 0; row < wallHeight; row++) {
    ctx.beginPath();
    ctx.moveTo(0, row * ts + ts * 0.5);
    ctx.lineTo(VIRTUAL_WIDTH * ts, row * ts + ts * 0.5);
    ctx.stroke();
  }

  // Sombra inferior (transicao parede/chao)
  ctx.fillStyle = shadow;
  ctx.fillRect(0, wallHeight * ts - 3, VIRTUAL_WIDTH * ts, 4);

  // Estrelas (wallpaper-stars)
  if (wp?.stars) {
    ctx.fillStyle = "#fff8d6";
    for (let i = 0; i < 18; i++) {
      const x = (i * 137) % (VIRTUAL_WIDTH * ts);
      const y = (i * 41) % (wallHeight * ts - 4);
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  map: BeeHouseMap,
  ts: number,
  floor: CatalogItem | null,
  rug: CatalogItem | null,
) {
  const fp = floor?.data as { base?: string; accent?: string; shadow?: string; pattern?: string } | undefined;
  const base = fp?.base ?? "#c99357";
  const accent = fp?.accent ?? "#e1b579";
  const shadow = fp?.shadow ?? "#916039";
  const pattern = fp?.pattern;

  const floorStartY = 4;
  for (let y = floorStartY; y < VIRTUAL_HEIGHT; y++) {
    for (let x = 0; x < VIRTUAL_WIDTH; x++) {
      const tile = map.ground[y]?.[x];
      const px = x * ts;
      const py = y * ts;
      if (tile === TILES.WALL) {
        ctx.fillStyle = shadow;
        ctx.fillRect(px, py, ts, ts);
        continue;
      }
      if (tile === TILES.DOOR) {
        ctx.fillStyle = base;
        ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = "#3c2a12";
        ctx.fillRect(px + ts * 0.18, py + ts * 0.1, ts * 0.64, ts * 0.78);
        ctx.fillStyle = "#fbcb45";
        ctx.beginPath();
        ctx.arc(px + ts * 0.75, py + ts * 0.5, ts * 0.06, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      // Floor base
      ctx.fillStyle = base;
      ctx.fillRect(px, py, ts, ts);

      // Pattern
      if (pattern === "checker") {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = accent;
          ctx.fillRect(px, py, ts, ts);
        } else {
          ctx.fillStyle = base;
          ctx.fillRect(px, py, ts, ts);
        }
      } else {
        // Linhas horizontais de "tabua"
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + ts, py);
        ctx.stroke();
        // Linha vertical alternada
        if ((x + y) % 2 === 0) {
          ctx.beginPath();
          ctx.moveTo(px + ts * 0.5, py);
          ctx.lineTo(px + ts * 0.5, py + ts);
          ctx.strokeStyle = shadow;
          ctx.globalAlpha = 0.25;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // Rug (tapete) — desenhado sobre o chao na regiao do RUG
  const rugData = rug?.data as { color?: string; accent?: string; variant?: string } | undefined;
  const rugColor = rugData?.color ?? "#a63f45";
  const rugAccent = rugData?.accent ?? "#cf6c55";
  let rugX = -1, rugY = -1, rugW = 0, rugH = 0;
  for (let y = 0; y < VIRTUAL_HEIGHT; y++) {
    for (let x = 0; x < VIRTUAL_WIDTH; x++) {
      if (map.ground[y]?.[x] === TILES.RUG) {
        if (rugX === -1) { rugX = x; rugY = y; }
        rugW = Math.max(rugW, x - rugX + 1);
        rugH = Math.max(rugH, y - rugY + 1);
      }
    }
  }
  if (rugX !== -1) {
    const px = rugX * ts + 2;
    const py = rugY * ts + 2;
    const pw = rugW * ts - 4;
    const ph = rugH * ts - 4;
    ctx.fillStyle = rugColor;
    roundedRect(ctx, px, py, pw, ph, 6);
    ctx.fill();
    ctx.strokeStyle = rugAccent;
    ctx.lineWidth = 2;
    roundedRect(ctx, px + 4, py + 4, pw - 8, ph - 8, 4);
    ctx.stroke();
    if (rugData?.variant === "fluffy") {
      // textura fofinha
      ctx.fillStyle = rugAccent;
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 18; i++) {
        const fx = px + Math.random() * pw;
        const fy = py + Math.random() * ph;
        ctx.beginPath();
        ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawStations(
  ctx: CanvasRenderingContext2D,
  stations: Station[],
  ts: number,
  now: number,
  inv: InventoryApi,
) {
  for (const s of stations) {
    const px = s.position.x * ts;
    const py = s.position.y * ts;
    const bob = Math.sin((now / 800) + s.position.x) * 0.5;

    if (s.id === "bed") {
      drawBed(ctx, px, py + bob, ts, inv.getEquippedItem("furniture-bed"));
    } else if (s.id === "desk") {
      drawDesk(ctx, px, py + bob, ts, inv.getEquippedItem("furniture-desk"));
    } else if (s.id === "agenda") {
      drawAgenda(ctx, px, py + bob, ts);
    } else if (s.id === "training") {
      drawTraining(ctx, px, py + bob, ts);
    } else if (s.id === "wardrobe") {
      drawWardrobe(ctx, px, py + bob, ts);
    } else if (s.id === "plant") {
      drawPlant(ctx, px, py + bob, ts, now);
    }
  }
}

function drawBed(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, bed: CatalogItem | null) {
  const data = bed?.data as { color?: string; accent?: string; variant?: string } | undefined;
  const color = data?.color ?? "#7099d0";
  const accent = data?.accent ?? "#dde4ee";
  // 2 tiles wide
  const w = ts * 2;
  const h = ts * 0.9;
  // Estrutura
  ctx.fillStyle = "#5a4731";
  roundedRect(ctx, x, y + ts * 0.15, w, h, 6);
  ctx.fill();
  // Colchão
  ctx.fillStyle = color;
  roundedRect(ctx, x + 4, y + ts * 0.25, w - 8, h - ts * 0.2, 4);
  ctx.fill();
  // Travesseiro
  ctx.fillStyle = accent;
  roundedRect(ctx, x + 6, y + ts * 0.28, ts * 0.7, ts * 0.5, 4);
  ctx.fill();
  // Detalhe variante royal: coroinha
  if (data?.variant === "royal") {
    ctx.fillStyle = "#fbcb45";
    ctx.font = `${ts * 0.5}px serif`;
    ctx.fillText("♛", x + w - ts * 0.6, y + ts * 0.5);
  }
  if (data?.variant === "cloud") {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + ts * 0.2, ts * 0.3, 0, Math.PI * 2);
    ctx.arc(x + w * 0.7, y + ts * 0.25, ts * 0.25, 0, Math.PI * 2);
    ctx.arc(x + w * 0.3, y + ts * 0.25, ts * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, desk: CatalogItem | null) {
  const data = desk?.data as { color?: string; accent?: string; variant?: string } | undefined;
  const color = data?.color ?? "#5a4731";
  const accent = data?.accent ?? "#a2cdff";
  const w = ts * 2;
  // Mesa
  ctx.fillStyle = color;
  roundedRect(ctx, x, y + ts * 0.55, w, ts * 0.4, 3);
  ctx.fill();
  // Pernas
  ctx.fillStyle = color;
  ctx.fillRect(x + 4, y + ts * 0.9, 4, ts * 0.1);
  ctx.fillRect(x + w - 8, y + ts * 0.9, 4, ts * 0.1);
  // Notebook
  ctx.fillStyle = "#1a1a1a";
  roundedRect(ctx, x + ts * 0.5, y + ts * 0.25, ts * 0.9, ts * 0.4, 4);
  ctx.fill();
  // Tela
  ctx.fillStyle = accent;
  roundedRect(ctx, x + ts * 0.55, y + ts * 0.3, ts * 0.8, ts * 0.32, 3);
  ctx.fill();
  // Apple-ish logo
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x + ts * 0.95, y + ts * 0.46, 3, 0, Math.PI * 2);
  ctx.fill();
  if (data?.variant === "gamer") {
    // RGB strip
    const colors = ["#ec5c5c", "#fbcb45", "#5fc775", "#5b9bd5", "#b94a8a"];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(x + ts * 0.5 + i * (ts * 0.18), y + ts * 0.92, ts * 0.15, 3);
    }
  }
}

function drawAgenda(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number) {
  ctx.fillStyle = "#5fc775";
  roundedRect(ctx, x + 4, y + 4, ts - 8, ts - 8, 4);
  ctx.fill();
  ctx.fillStyle = "#fff";
  roundedRect(ctx, x + 8, y + 8, ts - 16, ts - 16, 3);
  ctx.fill();
  // Linhas
  ctx.strokeStyle = "#5a4731";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 11, y + 14 + i * 4);
    ctx.lineTo(x + ts - 11, y + 14 + i * 4);
    ctx.stroke();
  }
  // Marca check
  ctx.fillStyle = "#5fc775";
  ctx.font = `bold ${ts * 0.32}px sans-serif`;
  ctx.fillText("✓", x + ts * 0.55, y + ts * 0.7);
}

function drawTraining(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number) {
  ctx.fillStyle = "#7fc572";
  roundedRect(ctx, x + 4, y + ts * 0.3, ts - 8, ts * 0.55, 4);
  ctx.fill();
  // Listras
  ctx.strokeStyle = "#5e8050";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 8, y + ts * 0.4 + i * 6);
    ctx.lineTo(x + ts - 8, y + ts * 0.4 + i * 6);
    ctx.stroke();
  }
  // Halterzinho
  ctx.fillStyle = "#2a1a08";
  ctx.fillRect(x + ts * 0.18, y + ts * 0.15, ts * 0.08, ts * 0.18);
  ctx.fillRect(x + ts * 0.74, y + ts * 0.15, ts * 0.08, ts * 0.18);
  ctx.fillRect(x + ts * 0.2, y + ts * 0.22, ts * 0.6, ts * 0.04);
}

function drawWardrobe(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number) {
  ctx.fillStyle = "#7a4f18";
  roundedRect(ctx, x + 4, y + 2, ts - 8, ts - 4, 3);
  ctx.fill();
  ctx.strokeStyle = "#3c2a12";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + ts * 0.5, y + 4);
  ctx.lineTo(x + ts * 0.5, y + ts - 4);
  ctx.stroke();
  // Maçanetas
  ctx.fillStyle = "#fbcb45";
  ctx.beginPath();
  ctx.arc(x + ts * 0.4, y + ts * 0.5, 2, 0, Math.PI * 2);
  ctx.arc(x + ts * 0.6, y + ts * 0.5, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, now: number) {
  // Vaso
  ctx.fillStyle = "#a63f45";
  roundedRect(ctx, x + ts * 0.25, y + ts * 0.6, ts * 0.5, ts * 0.35, 3);
  ctx.fill();
  // Folhas (sway)
  const sway = Math.sin(now / 600) * 0.05;
  ctx.fillStyle = "#5fc775";
  ctx.beginPath();
  ctx.ellipse(x + ts * 0.5 + sway * ts, y + ts * 0.4, ts * 0.25, ts * 0.3, sway, 0, Math.PI * 2);
  ctx.fill();
  // Flor
  ctx.fillStyle = "#fbcb45";
  ctx.beginPath();
  ctx.arc(x + ts * 0.5 + sway * ts * 1.5, y + ts * 0.18, ts * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawNpcs(ctx: CanvasRenderingContext2D, npcs: MapNpc[], ts: number, now: number) {
  for (const n of npcs) {
    const px = n.position.x * ts;
    const py = n.position.y * ts;
    const bob = Math.sin(now / 400 + n.position.x) * 1.5;
    drawMiniBee(ctx, px + ts * 0.5, py + ts * 0.5 + bob, ts * 0.35, "#f48aa1");
  }
}

function drawMiniBee(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  // Asas
  ctx.fillStyle = "rgba(232, 244, 255, 0.85)";
  ctx.beginPath();
  ctx.ellipse(cx - size * 0.4, cy - size * 0.3, size * 0.35, size * 0.45, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + size * 0.4, cy - size * 0.3, size * 0.35, size * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  // Corpo
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fill();
  // Listras
  ctx.fillStyle = "#2a1a08";
  ctx.fillRect(cx - size * 0.7, cy - size * 0.15, size * 1.4, size * 0.18);
  ctx.fillRect(cx - size * 0.7, cy + size * 0.15, size * 1.4, size * 0.18);
  // Olhos
  ctx.fillStyle = "#22150b";
  ctx.beginPath();
  ctx.arc(cx - size * 0.3, cy - size * 0.4, size * 0.1, 0, Math.PI * 2);
  ctx.arc(cx + size * 0.3, cy - size * 0.4, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawItems(ctx: CanvasRenderingContext2D, items: SpawnedItem[], ts: number, now: number) {
  for (const i of items) {
    const px = i.position.x * ts + ts * 0.5;
    const py = i.position.y * ts + ts * 0.5;
    const bob = Math.sin(now / 300 + i.position.x) * 3;
    const yPos = py + bob;
    if (i.type === "pollen") {
      // Bola dourada
      ctx.fillStyle = "#fbcb45";
      ctx.beginPath();
      ctx.arc(px, yPos, ts * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a67c1f";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // glow
      ctx.fillStyle = "rgba(251, 203, 69, 0.3)";
      ctx.beginPath();
      ctx.arc(px, yPos, ts * 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else if (i.type === "heart") {
      ctx.fillStyle = "#ec5c5c";
      ctx.font = `${ts * 0.5}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("♥", px, yPos);
    } else if (i.type === "star") {
      ctx.fillStyle = "#fbe27a";
      ctx.font = `${ts * 0.55}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", px, yPos);
    }
  }
}

function drawBee(
  ctx: CanvasRenderingContext2D,
  pixel: BeePixel,
  ts: number,
  now: number,
  state: string,
  inv: InventoryApi,
) {
  const cx = pixel.pixelX * ts + ts * 0.5;
  const baseY = pixel.pixelY * ts + ts * 0.5;
  const bob = Math.sin(now / 200) * 2;
  const cy = baseY + bob;
  const size = ts * 0.42;

  const bodyItem = inv.getEquippedItem("body");
  const bodyData = bodyItem?.data as { color?: string; highlight?: string; rainbow?: boolean } | undefined;
  let bodyColor = bodyData?.color ?? "#fbcb45";
  const highlight = bodyData?.highlight ?? "#fff4c2";
  if (bodyData?.rainbow) {
    // arco-iris rotativo
    const grad = ctx.createLinearGradient(cx - size, cy - size, cx + size, cy + size);
    grad.addColorStop(0, "#ec5c5c");
    grad.addColorStop(0.25, "#fbcb45");
    grad.addColorStop(0.5, "#5fc775");
    grad.addColorStop(0.75, "#5b9bd5");
    grad.addColorStop(1, "#b687d8");
    bodyColor = grad as unknown as string;
  }

  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.9, size * 0.7, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Asas (flap)
  const flap = Math.sin(now / 80) * 0.3 + 0.85;
  ctx.fillStyle = "rgba(232, 244, 255, 0.85)";
  ctx.beginPath();
  ctx.ellipse(cx - size * 0.55, cy - size * 0.35, size * 0.35 * flap, size * 0.5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + size * 0.55, cy - size * 0.35, size * 0.35 * flap, size * 0.5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Corpo (gradient highlight)
  if (typeof bodyColor === "string") {
    const grad = ctx.createRadialGradient(cx - size * 0.2, cy - size * 0.3, size * 0.1, cx, cy, size);
    grad.addColorStop(0, highlight);
    grad.addColorStop(1, bodyColor);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bodyColor;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fill();

  // Listras pretas
  ctx.fillStyle = "#2a1a08";
  ctx.fillRect(cx - size * 0.85, cy - size * 0.15, size * 1.7, size * 0.18);
  ctx.fillRect(cx - size * 0.85, cy + size * 0.15, size * 1.7, size * 0.18);

  // Antenas
  ctx.strokeStyle = "#22150b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.25, cy - size * 0.6);
  ctx.lineTo(cx - size * 0.35, cy - size * 0.95);
  ctx.moveTo(cx + size * 0.25, cy - size * 0.6);
  ctx.lineTo(cx + size * 0.35, cy - size * 0.95);
  ctx.stroke();
  ctx.fillStyle = "#22150b";
  ctx.beginPath();
  ctx.arc(cx - size * 0.35, cy - size * 0.95, 2.2, 0, Math.PI * 2);
  ctx.arc(cx + size * 0.35, cy - size * 0.95, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Olhos (variam com facing — só direita/esquerda)
  ctx.fillStyle = "#22150b";
  let eyeOffsetX = 0;
  if (pixel.facing === 2) eyeOffsetX = -size * 0.08;
  else if (pixel.facing === 3) eyeOffsetX = size * 0.08;
  ctx.beginPath();
  ctx.arc(cx - size * 0.28 + eyeOffsetX, cy - size * 0.45, size * 0.12, 0, Math.PI * 2);
  ctx.arc(cx + size * 0.28 + eyeOffsetX, cy - size * 0.45, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // Brilho do olho
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx - size * 0.25 + eyeOffsetX, cy - size * 0.5, size * 0.04, 0, Math.PI * 2);
  ctx.arc(cx + size * 0.31 + eyeOffsetX, cy - size * 0.5, size * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Chapeu (acessorio)
  const hat = inv.getEquippedItem("hat");
  if (hat) drawHat(ctx, cx, cy - size, size, hat);

  // Acessorio rosto
  const acc = inv.getEquippedItem("accessory");
  if (acc) drawAccessory(ctx, cx, cy, size, acc);

  // Boquinha de happy ou tired
  if (state === "happy" || state === "celebrating") {
    ctx.strokeStyle = "#22150b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.05, size * 0.18, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }
}

function drawHat(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, hat: CatalogItem) {
  const data = hat.data as { variant?: string; color?: string; accent?: string } | undefined;
  const v = data?.variant ?? "none";
  if (v === "none") return;
  if (v === "crown") {
    ctx.fillStyle = data!.color!;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.4, cy);
    ctx.lineTo(cx - size * 0.35, cy - size * 0.35);
    ctx.lineTo(cx - size * 0.18, cy - size * 0.15);
    ctx.lineTo(cx, cy - size * 0.4);
    ctx.lineTo(cx + size * 0.18, cy - size * 0.15);
    ctx.lineTo(cx + size * 0.35, cy - size * 0.35);
    ctx.lineTo(cx + size * 0.4, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = data!.accent!;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.2, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
  } else if (v === "cap") {
    ctx.fillStyle = data!.color!;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.4, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx, cy - 2, size * 0.55, 6);
  } else if (v === "top") {
    ctx.fillStyle = data!.color!;
    ctx.fillRect(cx - size * 0.4, cy - 4, size * 0.8, 6);
    ctx.fillRect(cx - size * 0.3, cy - size * 0.5, size * 0.6, size * 0.5);
  } else if (v === "chef") {
    ctx.fillStyle = data!.color!;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.2, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - size * 0.35, cy - 4, size * 0.7, 6);
  } else if (v === "bandana") {
    ctx.fillStyle = data!.color!;
    ctx.fillRect(cx - size * 0.4, cy - 8, size * 0.8, 8);
    ctx.beginPath();
    ctx.moveTo(cx + size * 0.4, cy - 8);
    ctx.lineTo(cx + size * 0.55, cy);
    ctx.lineTo(cx + size * 0.4, cy);
    ctx.closePath();
    ctx.fill();
  } else if (v === "flower") {
    ctx.fillStyle = data!.color!;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * size * 0.18, cy - size * 0.1 + Math.sin(a) * size * 0.18, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = data!.accent!;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.1, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (v === "halo") {
    ctx.strokeStyle = data!.color!;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy - size * 0.1, size * 0.4, size * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawAccessory(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, acc: CatalogItem) {
  const data = acc.data as { variant?: string; color?: string; accent?: string } | undefined;
  const v = data?.variant ?? "none";
  if (v === "none") return;
  if (v === "sunglasses") {
    ctx.fillStyle = data!.color!;
    ctx.fillRect(cx - size * 0.45, cy - size * 0.55, size * 0.4, size * 0.18);
    ctx.fillRect(cx + size * 0.05, cy - size * 0.55, size * 0.4, size * 0.18);
    ctx.fillRect(cx - size * 0.06, cy - size * 0.5, size * 0.12, 2);
  } else if (v === "reading") {
    ctx.strokeStyle = data!.color!;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx - size * 0.28, cy - size * 0.42, size * 0.13, 0, Math.PI * 2);
    ctx.arc(cx + size * 0.28, cy - size * 0.42, size * 0.13, 0, Math.PI * 2);
    ctx.stroke();
  } else if (v === "bow") {
    ctx.fillStyle = data!.color!;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.35, cy - size * 0.6);
    ctx.lineTo(cx - size * 0.15, cy - size * 0.45);
    ctx.lineTo(cx - size * 0.35, cy - size * 0.3);
    ctx.closePath();
    ctx.moveTo(cx + size * 0.35, cy - size * 0.6);
    ctx.lineTo(cx + size * 0.15, cy - size * 0.45);
    ctx.lineTo(cx + size * 0.35, cy - size * 0.3);
    ctx.closePath();
    ctx.fill();
  } else if (v === "headphone") {
    ctx.strokeStyle = data!.color!;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.7, size * 0.45, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = data!.color!;
    ctx.beginPath();
    ctx.arc(cx - size * 0.45, cy - size * 0.3, size * 0.1, 0, Math.PI * 2);
    ctx.arc(cx + size * 0.45, cy - size * 0.3, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (v === "monocle") {
    ctx.strokeStyle = data!.color!;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + size * 0.28, cy - size * 0.42, size * 0.15, 0, Math.PI * 2);
    ctx.stroke();
  } else if (v === "mask") {
    ctx.fillStyle = data!.color!;
    ctx.fillRect(cx - size * 0.55, cy - size * 0.55, size * 1.1, size * 0.22);
    ctx.fillStyle = data!.accent!;
    ctx.fillRect(cx - size * 0.45, cy - size * 0.45, size * 0.18, size * 0.08);
    ctx.fillRect(cx + size * 0.27, cy - size * 0.45, size * 0.18, size * 0.08);
  }
}

function drawDayNightVignette(ctx: CanvasRenderingContext2D, w: number, h: number, tod: TimeOfDay) {
  const preset = DAY_NIGHT_PRESETS[tod];
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  grad.addColorStop(0, preset.vignetteColors[0]);
  grad.addColorStop(0.5, preset.vignetteColors[1]);
  grad.addColorStop(1, preset.vignetteColors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  canvas: {
    cursor: "pointer",
    imageRendering: "pixelated",
  },
};
