import { TILES, type BeeHouseMap, type Position, type TileId } from "./types";

function createGrid(width: number, height: number, fill: TileId): TileId[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function setRect(grid: TileId[][], x: number, y: number, w: number, h: number, value: TileId): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const gx = x + dx;
      const gy = y + dy;
      if (grid[gy] && grid[gy][gx] !== undefined) {
        grid[gy][gx] = value;
      }
    }
  }
}

export function buildHouseMap(): BeeHouseMap {
  const width = 16;
  const height = 13;
  const ground = createGrid(width, height, TILES.FLOOR);

  setRect(ground, 0, 0, width, 1, TILES.WALL);
  setRect(ground, 0, height - 1, width, 1, TILES.WALL);
  setRect(ground, 0, 0, 1, height, TILES.WALL);
  setRect(ground, width - 1, 0, 1, height, TILES.WALL);
  setRect(ground, 6, 8, 4, 2, TILES.RUG);
  ground[11][7] = TILES.DOOR;

  const blocks: Position[] = [
    { x: 3, y: 4 }, { x: 4, y: 4 },
    { x: 9, y: 4 }, { x: 10, y: 4 },
    { x: 4, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 },
    { x: 2, y: 9 }, { x: 12, y: 10 },
  ];

  return {
    key: "house",
    name: "Quarto da Bee",
    width,
    height,
    ground,
    blocks,
    start: { x: 7, y: 10 },
    stations: [
      { id: "bed", title: "Cama", position: { x: 3, y: 4 }, texture: "station-bed", message: "Descanso curto. A Bee recupera energia.", heal: 2 },
      { id: "desk", title: "Notebook da Bee", position: { x: 9, y: 4 }, texture: "station-desk", message: "Quando o chat pede uma pesquisa, a Bee vem ate o notebook.", reward: { xp: 2 } },
      { id: "agenda", title: "Agenda", position: { x: 11, y: 8 }, texture: "station-agenda", message: "A agenda organiza compromissos e rotinas." },
      { id: "training", title: "Tapete de Treino", position: { x: 12, y: 10 }, texture: "station-training", message: "Pequenas rotinas de foco e movimento.", reward: { xp: 1 } },
      { id: "wardrobe", title: "Guarda-roupa", position: { x: 4, y: 8 }, texture: "station-wardrobe", message: "Editor de visual da Bee." },
      { id: "plant", title: "Planta de Polen", position: { x: 2, y: 9 }, texture: "station-garden", message: "Uma planta pequena, mas generosa.", reward: { pollen: 1 } },
    ],
    interactables: [],
    npcs: [
      { id: "mini-bee", name: "Bia", position: { x: 12, y: 6 }, texture: "npc-bia", message: "Bem-vinda a Casa! Toque nos moveis pra interagir." },
    ],
    items: [
      { id: "pollen-house-1", type: "pollen", position: { x: 6, y: 5 }, amount: 2 },
      { id: "heart-house-1", type: "heart", position: { x: 13, y: 6 }, amount: 2 },
    ],
  };
}

const BLOCKING_GROUND = new Set<TileId>([TILES.WATER, TILES.WALL]);

export function isWalkable(map: BeeHouseMap, position: Position): boolean {
  if (position.x < 0 || position.y < 0 || position.x >= map.width || position.y >= map.height) return false;
  const tile = map.ground[position.y]?.[position.x];
  if (tile === undefined) return false;
  if (BLOCKING_GROUND.has(tile)) return false;
  return !map.blocks.some((b) => b.x === position.x && b.y === position.y);
}
