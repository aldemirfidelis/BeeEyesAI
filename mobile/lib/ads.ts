// ── BeeAds — Types and constants ─────────────────────────────────────────────
// TODO: integrate with ad network or proprietary backend.
// Always respect user consent, age restrictions, LGPD and App Store policies.
// Never use personalised ads for users under 18 or with unknown age.

export type AllowedAdCategory =
  | "education"
  | "productivity"
  | "career"
  | "technology"
  | "wellness"
  | "books"
  | "tools"
  | "organization"
  | "study_materials"
  | "office_equipment"
  | "professional_services";

export const BLOCKED_AD_CATEGORIES = [
  "alcohol", "tobacco", "vape", "drugs", "gambling", "casino",
  "adult_content", "weapons", "dangerous_products", "get_rich_quick",
  "extreme_diets", "aggressive_supplements", "medication",
  "sensitive_politics", "sensitive_religion",
] as const;
export type BlockedAdCategory = typeof BLOCKED_AD_CATEGORIES[number];

export type AgeRating = "all" | "13_plus" | "18_plus";
export type AdFrequency = "low" | "normal" | "high";
export type AdMobAdFormat =
  | "banner"
  | "adaptive_banner"
  | "native"
  | "native_image"
  | "native_video"
  | "interstitial"
  | "rewarded"
  | "rewarded_interstitial"
  | "app_open";

export type SponsoredMessageType = "sponsored" | "sponsored_group";

export interface AdCampaign {
  id: string;
  adMobAdUnitId?: string;
  adFormat?: AdMobAdFormat;
  adType?: string;
  title: string;
  description: string;
  body?: string;
  advertiserName: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  mediaContent?: Record<string, unknown>;
  callToActionText: string;
  ctaLabel?: string;
  targetUrl: string;
  productUrl?: string;
  price?: string | number | null;
  source?: string;
  isVideo?: boolean;
  isNative?: boolean;
  isBanner?: boolean;
  isRewarded?: boolean;
  isInterstitial?: boolean;
  isAppOpen?: boolean;
  category: AllowedAdCategory;
  tags: string[];
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  ageRating: AgeRating;
  createdAt: string;
  updatedAt: string;
}

export interface AdItem extends AdCampaign {
  expiresAt?: string;
  addedToWishlist?: boolean;
  adImpressionId?: string;
  status?: "active" | "expired" | "unavailable";
}

export interface SponsoredMessageMeta {
  type: SponsoredMessageType;
  adId: string;
  beeIntroMessage: string;
  isPersonalized: boolean;
  ad: AdItem;
  ads?: AdItem[];
  adGroupId?: string;
  groupTitle?: string;
  layoutType?: "carousel" | "grid" | "vertical";
  adImpressionId?: string;
  expiresAt?: string;
  addedToWishlist?: boolean;
  status?: "active" | "expired" | "unavailable";
  wishlistItemId?: string;
}

export interface UserAdPreferences {
  allowPersonalizedAds: boolean;
  selectedInterests: string[];
  blockedCategories: string[];
  hiddenAdvertisers: string[];
  preferredAdFrequency: AdFrequency;
  consentGiven: boolean;
  consentGivenAt?: string;
  lastUpdatedAt: string;
}

export interface AdEngineState {
  messagesSinceLastAd: number;
  adsShownToday: number;
  lastAdDate: string;
  lastAdShownAt?: string;
  hiddenAdIds: string[];
}

export interface AdContext {
  screen: "chat" | "feed" | "colmeia" | "settings";
  recentTopics: string[];
  isSensitiveContext: boolean;
}

// Frequency caps — conservative defaults
export const AD_FREQUENCY_CAP = {
  maxAdsPerDay: 3,
  minMessagesBetweenAds: 10,
  minMinutesBetweenAds: 30,
} as const;

// Minimum activity before showing any ad
export const MIN_LEVEL_BEFORE_ADS = 2;
export const MIN_XP_BEFORE_ADS = 200;

// Interests shown in AdSettingsScreen
export const AD_INTEREST_OPTIONS = [
  "Tecnologia",
  "Carreira",
  "Cursos",
  "Estudos",
  "Produtividade",
  "Saúde e bem-estar",
  "Finanças pessoais",
  "Dados e BI",
  "Empreendedorismo",
  "Organização",
] as const;

// Keywords that signal a sensitive context — never show ads in these moments
export const SENSITIVE_CONTEXT_KEYWORDS = [
  "dor", "sofrendo", "sofrimento", "tristeza", "ansiedade", "depressão",
  "chorar", "chorando", "morte", "luto", "morrendo", "suicídio",
  "crise", "emergência", "ajuda urgente", "socorro", "desespero",
  "dívida", "falência", "endividado", "desemprego", "demitido",
  "separação", "divórcio", "doença grave", "hospital", "diagnóstico",
  "acidente", "vítima", "abuso", "violência",
] as const;
