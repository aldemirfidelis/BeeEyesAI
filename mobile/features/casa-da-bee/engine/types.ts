export const TILE_SIZE = 32;

export const TILES = {
  GRASS: 1,
  PATH: 2,
  FLOWER: 3,
  WATER: 4,
  FLOOR: 5,
  WALL: 6,
  RUG: 7,
  DOOR: 8,
  BLOCK: 9,
} as const;

export type TileId = (typeof TILES)[keyof typeof TILES];

export type Position = { x: number; y: number };

export type Direction = "up" | "down" | "left" | "right";

export type BeeState =
  | "idle"
  | "walking"
  | "working"
  | "talking"
  | "sleeping"
  | "happy"
  | "tired"
  | "confused"
  | "celebrating";

export type BridgeTarget = "search" | "train" | "calendar" | "study" | "sleep";

export interface BeeStats {
  pollen: number;
  xp: number;
  level: number;
  health: number;
  maxHealth: number;
  mood: BeeState;
  location: string;
  quest: string;
}

export interface Station {
  id: string;
  title: string;
  position: Position;
  texture: string;
  message: string;
  reward?: { pollen?: number; xp?: number };
  heal?: number;
}

export interface Interactable {
  id: string;
  title: string;
  position: Position;
  message: string;
  reward?: { pollen?: number; xp?: number };
  heal?: number;
}

export interface MapItem {
  id: string;
  type: "pollen" | "heart" | "star";
  position: Position;
  amount: number;
}

export interface MapNpc {
  id: string;
  name: string;
  position: Position;
  texture: string;
  message: string;
}

export interface BeeHouseMap {
  key: string;
  name: string;
  width: number;
  height: number;
  ground: TileId[][];
  blocks: Position[];
  start: Position;
  stations: Station[];
  interactables: Interactable[];
  npcs: MapNpc[];
  items: MapItem[];
}

export interface PendingTask {
  id: string;
  target: BridgeTarget;
  reward: number;
  xp?: number;
  speechText?: string | null;
}

export const DEFAULT_STATS: BeeStats = {
  pollen: 18,
  xp: 0,
  level: 1,
  health: 6,
  maxHealth: 6,
  mood: "idle",
  location: "Quarto da Bee",
  quest: "Bee esta passeando pela casa enquanto aguarda o chat.",
};

export const TASK_TARGETS: Record<BridgeTarget, { stationId: string; label: string; arrival: string }> = {
  search: {
    stationId: "desk",
    label: "Pesquisar no notebook",
    arrival: "Pesquisei no notebook e ja organizei um resumo para voce.",
  },
  train: {
    stationId: "training",
    label: "Treinar",
    arrival: "Treino concluido. A Bee voltou com mais foco e energia.",
  },
  calendar: {
    stationId: "agenda",
    label: "Agenda",
    arrival: "Agenda revisada. Os proximos passos ja estao separados.",
  },
  study: {
    stationId: "desk",
    label: "Estudar",
    arrival: "Sessao de estudo concluida. A Bee guardou os aprendizados.",
  },
  sleep: {
    stationId: "bed",
    label: "Descansar",
    arrival: "A Bee descansou e acordou pronta para continuar.",
  },
};
