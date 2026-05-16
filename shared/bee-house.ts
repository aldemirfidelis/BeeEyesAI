export const BEE_HOUSE_TASK_STATUSES = [
  "idle",
  "processing",
  "searching",
  "generating",
  "completed",
  "failed",
] as const;

export const BEE_AGENT_STATES = [
  "idle",
  "walking",
  "speaking",
  "thinking",
  "working",
  "researching",
  "happy",
  "tired",
  "sleeping",
  "confused",
  "celebrating",
] as const;

export const BEE_HOUSE_TASK_TYPES = [
  "general",
  "research",
  "fitness",
  "calendar",
  "study",
  "shopping",
  "social",
] as const;

export type BeeHouseTaskStatus = typeof BEE_HOUSE_TASK_STATUSES[number];
export type BeeAgentState = typeof BEE_AGENT_STATES[number];
export type BeeHouseTaskType = typeof BEE_HOUSE_TASK_TYPES[number];

export type BeeHouseCurrency = "pollen" | "premium_honey" | "xp";
export type BeeHouseRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "premium";
export type BeeHouseItemType = "furniture" | "decor" | "wallpaper" | "floor" | "effect";
export type BeeHouseRoomKind = "main" | "bedroom" | "office" | "library" | "fitness" | "shop" | "garden" | "social";
export type BeeHouseOutfitCategory = "casual" | "fitness" | "executive" | "student" | "scientist" | "party" | "premium";

export interface BeeHouseItemSeed {
  id: string;
  name: string;
  itemType: BeeHouseItemType;
  rarity: BeeHouseRarity;
  pricePollen: number;
  priceHoney: number;
  assetKey: string;
  gridWidth: number;
  gridHeight: number;
  allowedRooms: BeeHouseRoomKind[];
  interactive: boolean;
  interactionTarget?: string;
  metadata?: Record<string, unknown>;
}

export interface BeeHouseOutfitSeed {
  id: string;
  name: string;
  category: BeeHouseOutfitCategory;
  rarity: BeeHouseRarity;
  pricePollen: number;
  priceHoney: number;
  assetKey: string;
  metadata?: Record<string, unknown>;
}

export const DEFAULT_BEE_HOUSE_ITEMS: BeeHouseItemSeed[] = [
  {
    id: "starter_notebook",
    name: "Notebook da Bee",
    itemType: "furniture",
    rarity: "common",
    pricePollen: 0,
    priceHoney: 0,
    assetKey: "furniture/notebook_starter",
    gridWidth: 1,
    gridHeight: 1,
    allowedRooms: ["main", "office", "library"],
    interactive: true,
    interactionTarget: "computer",
    metadata: { stationKey: "computer", taskTypes: ["research", "general"] },
  },
  {
    id: "honey_work_desk",
    name: "Mesa de Mel",
    itemType: "furniture",
    rarity: "common",
    pricePollen: 80,
    priceHoney: 0,
    assetKey: "furniture/honey_work_desk",
    gridWidth: 2,
    gridHeight: 1,
    allowedRooms: ["main", "office"],
    interactive: true,
    interactionTarget: "desk",
    metadata: { stationKey: "desk", taskTypes: ["generating", "general"] },
  },
  {
    id: "tiny_library",
    name: "Biblioteca Favo",
    itemType: "furniture",
    rarity: "uncommon",
    pricePollen: 140,
    priceHoney: 0,
    assetKey: "furniture/tiny_library",
    gridWidth: 2,
    gridHeight: 1,
    allowedRooms: ["main", "library", "office"],
    interactive: true,
    interactionTarget: "library",
    metadata: { stationKey: "library", taskTypes: ["study", "research"] },
  },
  {
    id: "calendar_board",
    name: "Quadro Calendario",
    itemType: "furniture",
    rarity: "common",
    pricePollen: 90,
    priceHoney: 0,
    assetKey: "furniture/calendar_board",
    gridWidth: 1,
    gridHeight: 1,
    allowedRooms: ["main", "office"],
    interactive: true,
    interactionTarget: "calendar",
    metadata: { stationKey: "calendar", taskTypes: ["calendar"] },
  },
  {
    id: "fitness_mat",
    name: "Tapete Fitness",
    itemType: "furniture",
    rarity: "common",
    pricePollen: 110,
    priceHoney: 0,
    assetKey: "furniture/fitness_mat",
    gridWidth: 2,
    gridHeight: 1,
    allowedRooms: ["main", "fitness"],
    interactive: true,
    interactionTarget: "fitness",
    metadata: { stationKey: "fitness", taskTypes: ["fitness"] },
  },
  {
    id: "bee_bed",
    name: "Cama Fofinha",
    itemType: "furniture",
    rarity: "common",
    pricePollen: 120,
    priceHoney: 0,
    assetKey: "furniture/bee_bed",
    gridWidth: 2,
    gridHeight: 2,
    allowedRooms: ["main", "bedroom"],
    interactive: true,
    interactionTarget: "bed",
    metadata: { stationKey: "bed", taskTypes: ["rest"] },
  },
  {
    id: "honeycomb_wallpaper",
    name: "Papel Favo Claro",
    itemType: "wallpaper",
    rarity: "common",
    pricePollen: 60,
    priceHoney: 0,
    assetKey: "wallpaper/honeycomb_light",
    gridWidth: 0,
    gridHeight: 0,
    allowedRooms: ["main", "bedroom", "office", "library", "fitness"],
    interactive: false,
  },
  {
    id: "warm_wood_floor",
    name: "Piso Madeira Mel",
    itemType: "floor",
    rarity: "common",
    pricePollen: 60,
    priceHoney: 0,
    assetKey: "floor/warm_wood",
    gridWidth: 0,
    gridHeight: 0,
    allowedRooms: ["main", "bedroom", "office", "library", "fitness"],
    interactive: false,
  },
];

export const DEFAULT_BEE_HOUSE_OUTFITS: BeeHouseOutfitSeed[] = [
  {
    id: "casual_honey",
    name: "Casual Mel",
    category: "casual",
    rarity: "common",
    pricePollen: 0,
    priceHoney: 0,
    assetKey: "outfits/casual_honey",
  },
  {
    id: "fitness_mint",
    name: "Fitness Menta",
    category: "fitness",
    rarity: "uncommon",
    pricePollen: 180,
    priceHoney: 0,
    assetKey: "outfits/fitness_mint",
  },
  {
    id: "executive_charcoal",
    name: "Executiva Grafite",
    category: "executive",
    rarity: "rare",
    pricePollen: 260,
    priceHoney: 0,
    assetKey: "outfits/executive_charcoal",
  },
  {
    id: "student_lilac",
    name: "Estudante Lilas",
    category: "student",
    rarity: "uncommon",
    pricePollen: 180,
    priceHoney: 0,
    assetKey: "outfits/student_lilac",
  },
  {
    id: "scientist_sky",
    name: "Cientista Ceu",
    category: "scientist",
    rarity: "rare",
    pricePollen: 300,
    priceHoney: 0,
    assetKey: "outfits/scientist_sky",
  },
  {
    id: "party_glow",
    name: "Festa Brilho",
    category: "party",
    rarity: "epic",
    pricePollen: 420,
    priceHoney: 0,
    assetKey: "outfits/party_glow",
  },
  {
    id: "premium_royal",
    name: "Premium Rainha",
    category: "premium",
    rarity: "premium",
    pricePollen: 0,
    priceHoney: 120,
    assetKey: "outfits/premium_royal",
  },
];

export function inferBeeHouseTaskType(text: string): BeeHouseTaskType {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/pesquis|buscar|noticia|noticias|procura|encontra|fonte/.test(normalized)) return "research";
  if (/treino|fitness|exercicio|academia|saude|saudavel/.test(normalized)) return "fitness";
  if (/agenda|calendario|evento|compromisso|lembrete|alarme/.test(normalized)) return "calendar";
  if (/estud|resum|aula|prova|curso|biblioteca/.test(normalized)) return "study";
  if (/compr|loja|preco|produto|lista de desejos/.test(normalized)) return "shopping";
  if (/amigo|comunidade|feed|social|post/.test(normalized)) return "social";
  return "general";
}

export function beeStateForTaskStatus(status: BeeHouseTaskStatus, taskType: BeeHouseTaskType = "general"): BeeAgentState {
  if (status === "completed") return "happy";
  if (status === "failed") return "confused";
  if (status === "searching") return "researching";
  if (status === "generating") return "working";
  if (status === "processing") return taskType === "research" || taskType === "study" ? "thinking" : "working";
  return "idle";
}

export function stationForTaskType(taskType: BeeHouseTaskType): string {
  if (taskType === "research") return "computer";
  if (taskType === "fitness") return "fitness";
  if (taskType === "calendar") return "calendar";
  if (taskType === "study") return "library";
  if (taskType === "shopping") return "desk";
  return "desk";
}

export function speechForTaskStatus(status: BeeHouseTaskStatus, taskType: BeeHouseTaskType = "general"): string {
  if (status === "searching") return "Estou pesquisando isso para voce!";
  if (status === "generating") return "Ja volto com a resposta!";
  if (status === "completed") return "Prontinho, encontrei!";
  if (status === "failed") return "Ops, tive dificuldade aqui.";
  if (taskType === "calendar") return "Vou organizar isso agora!";
  if (taskType === "fitness") return "Vou preparar seu treino!";
  if (taskType === "study") return "Vou estudar isso com voce!";
  return "Estou trabalhando nisso!";
}
