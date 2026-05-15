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
  "alcohol",
  "tobacco",
  "vape",
  "drugs",
  "gambling",
  "casino",
  "adult_content",
  "weapons",
  "dangerous_products",
  "get_rich_quick",
  "extreme_diets",
  "aggressive_supplements",
  "medication",
  "sensitive_politics",
  "sensitive_religion",
] as const;

export type BlockedAdCategory = (typeof BLOCKED_AD_CATEGORIES)[number];

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
  advertiserName: string;
  advertiserLogo?: string;
  title: string;
  body: string;
  description?: string;
  ctaLabel: string;
  callToAction?: string;
  targetUrl: string;
  productUrl?: string;
  category: AllowedAdCategory;
  topicKeywords: string[];
  imageUrl?: string | null;
  videoUrl?: string | null;
  mediaContent?: Record<string, unknown>;
  price?: string | number | null;
  source?: string;
  isVideo?: boolean;
  isNative?: boolean;
  isBanner?: boolean;
  isRewarded?: boolean;
  isInterstitial?: boolean;
  isAppOpen?: boolean;
  ageRating: "all" | "18+";
  isActive: boolean;
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

export const AD_FREQUENCY_CAP = {
  maxAdsPerDay: 3,
  minMessagesBetweenAds: 10,
  minMinutesBetweenAds: 30,
} as const;

export const MIN_LEVEL_BEFORE_ADS = 2;
export const MIN_XP_BEFORE_ADS = 200;

export const SENSITIVE_CONTEXT_KEYWORDS = [
  "dor",
  "sofrendo",
  "tristeza",
  "ansiedade",
  "depressão",
  "morte",
  "luto",
  "suicídio",
  "crise",
  "emergência",
  "urgente",
  "socorro",
  "desespero",
  "chorando",
  "choro",
  "angústia",
  "pânico",
  "medo",
  "trauma",
  "abuso",
  "violência",
  "acidente",
  "doença",
  "hospital",
  "cancer",
  "separação",
  "divórcio",
  "demitido",
  "desempregado",
  "endividado",
  "falência",
  "automutilação",
  "cutting",
] as const;

export const AD_INTEREST_OPTIONS = [
  "Tecnologia",
  "Produtividade",
  "Educação",
  "Carreira",
  "Saúde e Bem-estar",
  "Livros",
  "Finanças pessoais",
  "Organização",
  "Cursos online",
  "Ferramentas digitais",
];
