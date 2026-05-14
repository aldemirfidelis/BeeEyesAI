export const WISHLIST_CATEGORIES = [
  "Tecnologia",
  "Moda",
  "Casa",
  "Estudos",
  "Trabalho",
  "Saúde e bem-estar",
  "Viagem",
  "Alimentação",
  "Serviços",
  "Cursos",
  "Presentes",
  "Outros",
] as const;

export const WISHLIST_STATUSES = [
  "saved",
  "interested",
  "buy_later",
  "comparing",
  "purchased",
  "not_interested",
] as const;

export const WISHLIST_STATUS_LABELS: Record<WishlistStatus, string> = {
  saved: "Salvo",
  interested: "Tenho interesse",
  buy_later: "Quero comprar depois",
  comparing: "Comparando preços",
  purchased: "Já comprei",
  not_interested: "Não tenho mais interesse",
};

export const WISHLIST_EVENT_TYPES = [
  "added_to_wishlist",
  "duplicate_add_attempt",
  "removed_from_wishlist",
  "marked_as_interested",
  "marked_as_purchased",
  "marked_not_interested",
  "status_changed",
  "note_added",
  "category_changed",
  "opened",
  "shared",
  "recommendation_clicked",
  "interest_removed",
  "personalization_disabled",
  "interests_cleared",
  "wishlist_cleared",
] as const;

export const SENSITIVE_INTEREST_KEYWORDS = [
  "religião",
  "política",
  "partido",
  "raça",
  "etnia",
  "sexualidade",
  "orientação sexual",
  "criança",
  "infantil sensível",
  "doença",
  "diagnóstico",
  "medicação",
  "remédio controlado",
  "terapia íntima",
] as const;

export type WishlistCategory = (typeof WISHLIST_CATEGORIES)[number];
export type WishlistStatus = (typeof WISHLIST_STATUSES)[number];
export type WishlistEventType = (typeof WISHLIST_EVENT_TYPES)[number];

export function normalizeWishlistCategory(value: unknown): WishlistCategory {
  if (typeof value === "string") {
    const found = WISHLIST_CATEGORIES.find((category) => category.toLowerCase() === value.trim().toLowerCase());
    if (found) return found;
  }
  return "Outros";
}

export function normalizeWishlistStatus(value: unknown): WishlistStatus {
  return typeof value === "string" && (WISHLIST_STATUSES as readonly string[]).includes(value)
    ? (value as WishlistStatus)
    : "saved";
}

export function containsSensitiveInterest(value: string) {
  const normalized = value.toLowerCase();
  return SENSITIVE_INTEREST_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
