export type ItemCategory = "hat" | "accessory" | "body" | "furniture-bed" | "furniture-desk" | "furniture-rug" | "wallpaper" | "floor";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface CatalogItem {
  id: string;
  category: ItemCategory;
  name: string;
  description: string;
  rarity: Rarity;
  price: number;
  unlockLevel?: number; // nivel minimo pra comprar
  data: Record<string, unknown>; // dados especificos do renderer
}

const RARITY_ORDER: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

export const RARITY_COLORS: Record<Rarity, { bg: string; border: string; label: string }> = {
  common: { bg: "rgba(180, 180, 180, 0.18)", border: "#9c9c9c", label: "Comum" },
  uncommon: { bg: "rgba(95, 199, 117, 0.18)", border: "#5fc775", label: "Incomum" },
  rare: { bg: "rgba(91, 155, 213, 0.22)", border: "#5b9bd5", label: "Raro" },
  epic: { bg: "rgba(185, 74, 138, 0.22)", border: "#b94a8a", label: "Épico" },
  legendary: { bg: "rgba(255, 180, 0, 0.28)", border: "#f5b400", label: "Lendário" },
};

// ============= HATS =============
export const HATS: CatalogItem[] = [
  { id: "hat-none", category: "hat", name: "Sem chapéu", description: "A clássica da Bee", rarity: "common", price: 0, data: { variant: "none" } },
  { id: "hat-crown", category: "hat", name: "Coroa Real", description: "Pra Bee se sentir rainha", rarity: "epic", price: 280, data: { variant: "crown", color: "#fbcb45", accent: "#ec5c5c" } },
  { id: "hat-cap", category: "hat", name: "Boné Estiloso", description: "Casual e descolado", rarity: "common", price: 35, data: { variant: "cap", color: "#5b9bd5" } },
  { id: "hat-top", category: "hat", name: "Cartola Vintage", description: "Para a Bee elegante", rarity: "rare", price: 120, data: { variant: "top", color: "#2a1a08" } },
  { id: "hat-chef", category: "hat", name: "Touca de Chefe", description: "Cozinheira de pólen", rarity: "uncommon", price: 75, unlockLevel: 2, data: { variant: "chef", color: "#ffffff" } },
  { id: "hat-bandana", category: "hat", name: "Bandana Pirata", description: "À aventura!", rarity: "uncommon", price: 60, data: { variant: "bandana", color: "#ec5c5c" } },
  { id: "hat-flower", category: "hat", name: "Flor de Verão", description: "Quase como uma fada", rarity: "rare", price: 140, unlockLevel: 3, data: { variant: "flower", color: "#f4838b", accent: "#5da45c" } },
  { id: "hat-halo", category: "hat", name: "Auréola Dourada", description: "Bee abençoada", rarity: "legendary", price: 750, unlockLevel: 8, data: { variant: "halo", color: "#fbe27a" } },
];

// ============= ACCESSORIES =============
export const ACCESSORIES: CatalogItem[] = [
  { id: "acc-none", category: "accessory", name: "Sem acessório", description: "Cara limpinha", rarity: "common", price: 0, data: { variant: "none" } },
  { id: "acc-sunglasses", category: "accessory", name: "Óculos Escuros", description: "Bee descolada 😎", rarity: "uncommon", price: 50, data: { variant: "sunglasses", color: "#1a1a1a" } },
  { id: "acc-reading", category: "accessory", name: "Óculos de Leitura", description: "Para a Bee estudiosa", rarity: "common", price: 25, data: { variant: "reading", color: "#5a4731" } },
  { id: "acc-bow", category: "accessory", name: "Lacinho", description: "Fofo demais", rarity: "common", price: 30, data: { variant: "bow", color: "#ec5c5c" } },
  { id: "acc-headphone", category: "accessory", name: "Fones", description: "Música o dia todo", rarity: "rare", price: 130, unlockLevel: 3, data: { variant: "headphone", color: "#b94a8a" } },
  { id: "acc-monocle", category: "accessory", name: "Monóculo", description: "Refinada", rarity: "rare", price: 110, data: { variant: "monocle", color: "#fbcb45" } },
  { id: "acc-mask", category: "accessory", name: "Máscara de Herói", description: "Salvando o mundo", rarity: "epic", price: 220, unlockLevel: 5, data: { variant: "mask", color: "#2a1a08", accent: "#fbcb45" } },
];

// ============= BODY COLORS =============
export const BODY_COLORS: CatalogItem[] = [
  { id: "body-yellow", category: "body", name: "Amarelo Clássico", description: "A original", rarity: "common", price: 0, data: { color: "#fbcb45", highlight: "#fff4c2" } },
  { id: "body-gold", category: "body", name: "Dourado", description: "Brilho de tesouro", rarity: "rare", price: 180, data: { color: "#f5b400", highlight: "#ffe27a" } },
  { id: "body-pink", category: "body", name: "Rosa Doce", description: "Adocicada", rarity: "uncommon", price: 90, data: { color: "#f48aa1", highlight: "#ffd4dd" } },
  { id: "body-blue", category: "body", name: "Azul Cristal", description: "Bee de outro mundo", rarity: "rare", price: 200, unlockLevel: 4, data: { color: "#7099d0", highlight: "#dde4ee" } },
  { id: "body-green", category: "body", name: "Verde Natureza", description: "Bee da floresta", rarity: "uncommon", price: 95, data: { color: "#7fc572", highlight: "#d4f0c8" } },
  { id: "body-purple", category: "body", name: "Roxo Místico", description: "Bee dos sonhos", rarity: "epic", price: 320, unlockLevel: 6, data: { color: "#b687d8", highlight: "#e8d4f5" } },
  { id: "body-rainbow", category: "body", name: "Arco-íris", description: "Bee mágica das raras", rarity: "legendary", price: 900, unlockLevel: 10, data: { color: "#ffffff", highlight: "#fff4c2", rainbow: true } },
];

// ============= FURNITURE: BED =============
export const FURNITURE_BEDS: CatalogItem[] = [
  { id: "bed-default", category: "furniture-bed", name: "Cama Padrão", description: "Aconchegante", rarity: "common", price: 0, data: { variant: "default", color: "#7099d0", accent: "#dde4ee" } },
  { id: "bed-royal", category: "furniture-bed", name: "Cama Real", description: "Para sonhos de rainha", rarity: "epic", price: 260, unlockLevel: 4, data: { variant: "royal", color: "#b94a8a", accent: "#fbcb45" } },
  { id: "bed-treehouse", category: "furniture-bed", name: "Cama Casa-na-Árvore", description: "Bem natureza", rarity: "rare", price: 180, data: { variant: "treehouse", color: "#7fc572", accent: "#5a4731" } },
  { id: "bed-cloud", category: "furniture-bed", name: "Cama Nuvem", description: "Flutuante", rarity: "legendary", price: 700, unlockLevel: 8, data: { variant: "cloud", color: "#dde4ee", accent: "#ffffff" } },
];

// ============= FURNITURE: DESK =============
export const FURNITURE_DESKS: CatalogItem[] = [
  { id: "desk-default", category: "furniture-desk", name: "Mesa Simples", description: "Funcional", rarity: "common", price: 0, data: { variant: "default", color: "#5a4731", accent: "#a2cdff" } },
  { id: "desk-gamer", category: "furniture-desk", name: "Setup Gamer", description: "RGB everywhere", rarity: "epic", price: 320, unlockLevel: 5, data: { variant: "gamer", color: "#1a1a1a", accent: "#b94a8a" } },
  { id: "desk-vintage", category: "furniture-desk", name: "Escrivaninha Vintage", description: "Estilo retrô", rarity: "rare", price: 200, data: { variant: "vintage", color: "#7a4f18", accent: "#fff4c2" } },
];

// ============= FURNITURE: RUG =============
export const FURNITURE_RUGS: CatalogItem[] = [
  { id: "rug-default", category: "furniture-rug", name: "Tapete Vermelho", description: "Clássico", rarity: "common", price: 0, data: { variant: "default", color: "#a63f45", accent: "#cf6c55" } },
  { id: "rug-persian", category: "furniture-rug", name: "Tapete Persa", description: "Sofisticação", rarity: "rare", price: 150, data: { variant: "persian", color: "#7a4f18", accent: "#fbcb45" } },
  { id: "rug-fluffy", category: "furniture-rug", name: "Pelúcia Macia", description: "Macia macia", rarity: "uncommon", price: 80, data: { variant: "fluffy", color: "#dde4ee", accent: "#ffffff" } },
];

// ============= WALLPAPERS (cor da parede) =============
export const WALLPAPERS: CatalogItem[] = [
  { id: "wall-default", category: "wallpaper", name: "Madeira Padrão", description: "Aconchegante", rarity: "common", price: 0, data: { base: "#6c5138", accent: "#8d7050", shadow: "#4b3827" } },
  { id: "wall-pink", category: "wallpaper", name: "Rosa Pastel", description: "Suave", rarity: "uncommon", price: 70, data: { base: "#f4c2cb", accent: "#fbd6db", shadow: "#d27a92" } },
  { id: "wall-blue", category: "wallpaper", name: "Azul Marinho", description: "Sereno", rarity: "uncommon", price: 75, data: { base: "#3e5380", accent: "#5b7099", shadow: "#2a3a5c" } },
  { id: "wall-green", category: "wallpaper", name: "Verde Folha", description: "Natureza", rarity: "uncommon", price: 75, data: { base: "#5a8a4a", accent: "#7fa86f", shadow: "#3e6534" } },
  { id: "wall-stars", category: "wallpaper", name: "Céu Estrelado", description: "Magia", rarity: "epic", price: 280, unlockLevel: 5, data: { base: "#2a2e58", accent: "#5b6ba0", shadow: "#1a1c3c", stars: true } },
  { id: "wall-gold", category: "wallpaper", name: "Dourado Real", description: "Luxo", rarity: "legendary", price: 650, unlockLevel: 8, data: { base: "#a67c1f", accent: "#fbcb45", shadow: "#7d5f1a" } },
];

// ============= FLOORS =============
export const FLOORS: CatalogItem[] = [
  { id: "floor-default", category: "floor", name: "Madeira Pinho", description: "Padrão", rarity: "common", price: 0, data: { base: "#c99357", accent: "#e1b579", shadow: "#916039" } },
  { id: "floor-marble", category: "floor", name: "Mármore", description: "Elegante", rarity: "rare", price: 180, data: { base: "#e0e0e0", accent: "#ffffff", shadow: "#a0a0a0" } },
  { id: "floor-grass", category: "floor", name: "Grama Artificial", description: "Verdinho", rarity: "uncommon", price: 95, data: { base: "#7fa86f", accent: "#9bbf8a", shadow: "#5e8050" } },
  { id: "floor-checker", category: "floor", name: "Xadrez", description: "Retrô", rarity: "uncommon", price: 90, data: { base: "#fff", accent: "#222", shadow: "#888", pattern: "checker" } },
];

export const ALL_ITEMS: CatalogItem[] = [
  ...HATS,
  ...ACCESSORIES,
  ...BODY_COLORS,
  ...FURNITURE_BEDS,
  ...FURNITURE_DESKS,
  ...FURNITURE_RUGS,
  ...WALLPAPERS,
  ...FLOORS,
];

export function findItem(id: string): CatalogItem | null {
  return ALL_ITEMS.find((i) => i.id === id) ?? null;
}

export function itemsByCategory(category: ItemCategory): CatalogItem[] {
  return ALL_ITEMS.filter((i) => i.category === category).sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.price - b.price);
}
