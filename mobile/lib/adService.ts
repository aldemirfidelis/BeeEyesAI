// ── BeeAds — AdService (MockAdProvider) ──────────────────────────────────────
// TODO: replace MockAdProvider with real network integration (AdMob, Meta AN,
//       or proprietary backend) and ensure all LGPD/App Store consent flows
//       are wired before production.
// Never serve personalised ads to users under 18 or with unknown age.
// Never collect sensitive data (health, religion, politics, location) for ads.

import * as SecureStore from "expo-secure-store";
import type {
  AdCampaign,
  UserAdPreferences,
  AdEngineState,
  AdContext,
  AllowedAdCategory,
} from "./ads";
import {
  SENSITIVE_CONTEXT_KEYWORDS,
  AD_FREQUENCY_CAP,
  MIN_LEVEL_BEFORE_ADS,
  MIN_XP_BEFORE_ADS,
  BLOCKED_AD_CATEGORIES,
} from "./ads";
import { MOCK_ADS } from "./mockAds";

// ── Storage keys ──────────────────────────────────────────────────────────────

const SK_PREFS = "bee_ad_preferences";
const SK_STATE = "bee_ad_engine_state";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function saveJSON<T>(key: string, value: T): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  } catch {}
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Default values ────────────────────────────────────────────────────────────

export function defaultAdPreferences(): UserAdPreferences {
  return {
    allowPersonalizedAds: false,
    selectedInterests: [],
    blockedCategories: [],
    hiddenAdvertisers: [],
    preferredAdFrequency: "normal",
    consentGiven: false,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function defaultAdEngineState(): AdEngineState {
  return {
    messagesSinceLastAd: 0,
    adsShownToday: 0,
    lastAdDate: todayStr(),
    hiddenAdIds: [],
  };
}

// ── Persistence ────────────────────────────────────────────────────────────────

export async function loadAdPreferences(): Promise<UserAdPreferences> {
  return (await loadJSON<UserAdPreferences>(SK_PREFS)) ?? defaultAdPreferences();
}

export async function saveAdPreferences(prefs: UserAdPreferences): Promise<void> {
  await saveJSON(SK_PREFS, { ...prefs, lastUpdatedAt: new Date().toISOString() });
}

export async function loadAdEngineState(): Promise<AdEngineState> {
  const state = (await loadJSON<AdEngineState>(SK_STATE)) ?? defaultAdEngineState();
  if (state.lastAdDate !== todayStr()) {
    state.adsShownToday = 0;
    state.lastAdDate = todayStr();
  }
  return state;
}

export async function saveAdEngineState(state: AdEngineState): Promise<void> {
  await saveJSON(SK_STATE, state);
}

// ── shouldShowAdsToUser ────────────────────────────────────────────────────────

export interface UserForAds {
  level?: number;
  xp?: number;
  subscriptionStatus?: string;
  adsDisabled?: boolean;
}

export function shouldShowAdsToUser(
  user: UserForAds,
  prefs: UserAdPreferences,
  state: AdEngineState,
): boolean {
  // Premium subscribers never see ads
  // TODO: wire to real subscription check
  if (user.subscriptionStatus === "premium") return false;

  // User explicitly disabled ads in settings
  if (user.adsDisabled) return false;

  // Check that the user has been active enough (level/xp proxy for account age)
  const isActiveEnough =
    (user.level ?? 1) >= MIN_LEVEL_BEFORE_ADS ||
    (user.xp ?? 0) >= MIN_XP_BEFORE_ADS;
  if (!isActiveEnough) return false;

  // Daily cap adjusted for frequency preference
  const dailyCap =
    prefs.preferredAdFrequency === "low"
      ? 1
      : prefs.preferredAdFrequency === "high"
      ? 5
      : AD_FREQUENCY_CAP.maxAdsPerDay;
  if (state.adsShownToday >= dailyCap) return false;

  // Minimum messages between ads
  if (state.messagesSinceLastAd < AD_FREQUENCY_CAP.minMessagesBetweenAds) return false;

  // Minimum time between ads
  if (state.lastAdShownAt) {
    const minutesSinceLast =
      (Date.now() - new Date(state.lastAdShownAt).getTime()) / 60000;
    if (minutesSinceLast < AD_FREQUENCY_CAP.minMinutesBetweenAds) return false;
  }

  return true;
}

// ── isSensitiveContext ─────────────────────────────────────────────────────────

export function isSensitiveContext(
  recentMessages: { role: string; content: string }[],
): boolean {
  const combined = recentMessages
    .slice(-4)
    .map((m) => m.content.toLowerCase())
    .join(" ");
  return SENSITIVE_CONTEXT_KEYWORDS.some((kw) => combined.includes(kw));
}

// ── isAdCategoryAllowed ────────────────────────────────────────────────────────

export function isAdCategoryAllowed(
  category: AllowedAdCategory,
  prefs: UserAdPreferences,
): boolean {
  if ((BLOCKED_AD_CATEGORIES as readonly string[]).includes(category)) return false;
  if (prefs.blockedCategories.includes(category)) return false;
  return true;
}

// ── selectBestAd ──────────────────────────────────────────────────────────────
// TODO: replace with server-side ad selection when backend is ready.

export function selectBestAd(
  prefs: UserAdPreferences,
  state: AdEngineState,
  context: AdContext,
  campaigns: AdCampaign[] = MOCK_ADS,
): AdCampaign | null {
  const now = new Date().toISOString();

  const eligible = campaigns.filter((ad) => {
    if (!ad.isActive) return false;
    if (ad.startsAt > now || ad.endsAt < now) return false;
    if (!isAdCategoryAllowed(ad.category, prefs)) return false;
    if (prefs.hiddenAdvertisers.includes(ad.advertiserName)) return false;
    if (state.hiddenAdIds.includes(ad.id)) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  const scored = eligible.map((ad) => {
    let score = 1 + Math.random() * 0.5; // small random to vary selection

    // Contextual boost — match ad tags against recent conversation topics
    const topicMatch = context.recentTopics.some((topic) =>
      ad.tags.some((tag) => tag.toLowerCase().includes(topic.toLowerCase())),
    );
    if (topicMatch) score += 3;

    // Personalised boost — only if user explicitly consented
    if (prefs.allowPersonalizedAds && prefs.consentGiven) {
      const interestMatch = prefs.selectedInterests.some(
        (interest) =>
          ad.tags.some((tag) =>
            tag.toLowerCase().includes(interest.toLowerCase()),
          ) || ad.category.toLowerCase().includes(interest.toLowerCase()),
      );
      if (interestMatch) score += 2;
    }

    return { ad, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.ad ?? null;
}

// ── generateBeeAdIntroMessage ─────────────────────────────────────────────────

const BEE_INTRO_MESSAGES = [
  "Prometo que é rapidinho 😅 Meu criador também precisa pagar os servidores. Dá uma olhadinha nesse patrocinado.",
  "Intervalo comercial da colmeia 🐝✨ Separei algo que pode combinar com seus interesses.",
  "Anúncio passando pela colmeia 🐝 Se não fizer sentido, é só ocultar.",
  "Bee aqui: esse é um conteúdo patrocinado. Se curtir, olha lá. Se não curtir, eu aprendo e mostro menos.",
  "Olha... meu criador precisa pagar as contas 😅 Separei algo que talvez faça sentido pra você.",
] as const;

export function generateBeeAdIntroMessage(): string {
  return BEE_INTRO_MESSAGES[Math.floor(Math.random() * BEE_INTRO_MESSAGES.length)];
}

// ── extractTopicsFromMessages ─────────────────────────────────────────────────

const TOPIC_KEYWORDS: string[] = [
  "power bi", "excel", "dados", "dashboard", "bi", "sql",
  "saúde", "exercício", "treino", "hidratação", "dormir",
  "carreira", "emprego", "currículo", "entrevista", "vagas",
  "estudo", "curso", "aprender", "livro", "leitura",
  "produtividade", "organização", "tarefas", "planejamento",
  "tecnologia", "programação", "software",
  "finanças", "investimento", "orçamento",
];

export function extractTopicsFromMessages(
  messages: { role: string; content: string }[],
): string[] {
  const combined = messages
    .slice(-4)
    .map((m) => m.content.toLowerCase())
    .join(" ");
  return TOPIC_KEYWORDS.filter((kw) => combined.includes(kw));
}

// ── recordAdView ──────────────────────────────────────────────────────────────

export async function recordAdView(adId: string): Promise<void> {
  const state = await loadAdEngineState();
  state.adsShownToday = (state.adsShownToday ?? 0) + 1;
  state.messagesSinceLastAd = 0;
  state.lastAdShownAt = new Date().toISOString();
  await saveAdEngineState(state);
}

export async function incrementMessageCounter(): Promise<void> {
  const state = await loadAdEngineState();
  state.messagesSinceLastAd = (state.messagesSinceLastAd ?? 0) + 1;
  await saveAdEngineState(state);
}

export async function hideAd(adId: string): Promise<void> {
  const state = await loadAdEngineState();
  if (!state.hiddenAdIds.includes(adId)) {
    state.hiddenAdIds = [...state.hiddenAdIds, adId];
    await saveAdEngineState(state);
  }
}

// ── getEligibleAd ─────────────────────────────────────────────────────────────

export async function getEligibleAd(
  user: UserForAds,
  context: AdContext,
): Promise<AdCampaign | null> {
  const [prefs, state] = await Promise.all([
    loadAdPreferences(),
    loadAdEngineState(),
  ]);
  if (!shouldShowAdsToUser(user, prefs, state)) return null;
  if (context.isSensitiveContext) return null;
  return selectBestAd(prefs, state, context);
}
