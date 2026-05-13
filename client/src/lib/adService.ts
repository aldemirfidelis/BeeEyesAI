import type { AdCampaign, AdEngineState, UserAdPreferences } from "./ads";
import {
  AD_FREQUENCY_CAP,
  MIN_LEVEL_BEFORE_ADS,
  MIN_XP_BEFORE_ADS,
  SENSITIVE_CONTEXT_KEYWORDS,
} from "./ads";
import { MOCK_AD_CAMPAIGNS } from "./mockAds";

const PREF_KEY = "bee_ad_preferences";
const STATE_KEY = "bee_ad_engine_state";

export interface UserForAds {
  level: number;
  xp: number;
  subscriptionStatus?: string;
  adsDisabled?: boolean;
  birthYear?: number;
}

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
    lastAdDate: "",
    hiddenAdIds: [],
  };
}

export function loadAdPreferences(): UserAdPreferences {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return { ...defaultAdPreferences(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultAdPreferences();
}

export function saveAdPreferences(prefs: UserAdPreferences): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

function loadAdEngineState(): AdEngineState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return { ...defaultAdEngineState(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultAdEngineState();
}

function saveAdEngineState(state: AdEngineState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function shouldShowAdsToUser(
  user: UserForAds,
  prefs: UserAdPreferences,
  state: AdEngineState,
): boolean {
  if (user.subscriptionStatus === "premium") return false;
  if (user.adsDisabled) return false;
  if (user.level < MIN_LEVEL_BEFORE_ADS && user.xp < MIN_XP_BEFORE_ADS) return false;

  const today = new Date().toISOString().slice(0, 10);
  const adsToday = state.lastAdDate === today ? state.adsShownToday : 0;

  const dailyCap: Record<string, number> = { low: 1, normal: AD_FREQUENCY_CAP.maxAdsPerDay, high: 5 };
  if (adsToday >= (dailyCap[prefs.preferredAdFrequency] ?? AD_FREQUENCY_CAP.maxAdsPerDay)) return false;

  if (state.messagesSinceLastAd < AD_FREQUENCY_CAP.minMessagesBetweenAds) return false;

  if (state.lastAdShownAt) {
    const elapsedMin = (Date.now() - new Date(state.lastAdShownAt).getTime()) / 60000;
    if (elapsedMin < AD_FREQUENCY_CAP.minMinutesBetweenAds) return false;
  }

  return true;
}

export function isSensitiveContext(recentMessages: { role: string; content: string }[]): boolean {
  const last4 = recentMessages.slice(-4);
  const text = last4.map((m) => m.content.toLowerCase()).join(" ");
  return SENSITIVE_CONTEXT_KEYWORDS.some((kw) => text.includes(kw));
}

function scoreAd(
  ad: AdCampaign,
  prefs: UserAdPreferences,
  contextTopics: string[],
  user: UserForAds,
): number {
  if (!ad.isActive) return -1;
  if (ad.ageRating === "18+" && (!user.birthYear || new Date().getFullYear() - user.birthYear < 18)) return -1;
  if (prefs.hiddenAdvertisers.includes(ad.advertiserName)) return -1;

  let score = Math.random() * 0.5;

  const lowerContext = contextTopics.map((t) => t.toLowerCase());
  if (ad.topicKeywords.some((kw) => lowerContext.some((t) => t.includes(kw)))) score += 3;

  if (prefs.allowPersonalizedAds && prefs.selectedInterests.length > 0) {
    const interestMatch = prefs.selectedInterests.some((interest) =>
      ad.topicKeywords.some(
        (kw) => interest.toLowerCase().includes(kw) || kw.includes(interest.toLowerCase()),
      ),
    );
    if (interestMatch) score += 2;
  }

  return score;
}

export function selectBestAd(
  prefs: UserAdPreferences,
  state: AdEngineState,
  contextTopics: string[],
  user: UserForAds,
  campaigns: AdCampaign[] = MOCK_AD_CAMPAIGNS,
): AdCampaign | null {
  const scored = campaigns
    .filter((ad) => !state.hiddenAdIds.includes(ad.id))
    .map((ad) => ({ ad, score: scoreAd(ad, prefs, contextTopics, user) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.ad ?? null;
}

const BEE_INTRO_MESSAGES = [
  "Ei, pausinha rápida: a Bee tem um recado patrocinado pra você. Prometo que é relevante (ou quase).",
  "Vou ser honesta: isso aqui é um anúncio. Mas é de algo que talvez faça sentido pra você.",
  "Momento publicitário da Bee: sim, é um anúncio. Pode ignorar se quiser, sem julgamentos.",
  "A Bee precisa pagar as contas também. Segue o aviso patrocinado com carinho:",
  "Pequena pausa: a seguir um anúncio transparente e não invasivo. É o jeito Bee de fazer publicidade.",
];

export function generateBeeAdIntroMessage(): string {
  return BEE_INTRO_MESSAGES[Math.floor(Math.random() * BEE_INTRO_MESSAGES.length)];
}

export function incrementMessageCount(): void {
  const state = loadAdEngineState();
  saveAdEngineState({ ...state, messagesSinceLastAd: state.messagesSinceLastAd + 1 });
}

export function recordAdView(_adId: string): void {
  const state = loadAdEngineState();
  const today = new Date().toISOString().slice(0, 10);
  saveAdEngineState({
    ...state,
    messagesSinceLastAd: 0,
    adsShownToday: state.lastAdDate === today ? state.adsShownToday + 1 : 1,
    lastAdDate: today,
    lastAdShownAt: new Date().toISOString(),
    hiddenAdIds: state.hiddenAdIds,
  });
}

export function hideAd(adId: string): void {
  const state = loadAdEngineState();
  if (!state.hiddenAdIds.includes(adId)) {
    saveAdEngineState({ ...state, hiddenAdIds: [...state.hiddenAdIds, adId] });
  }
}

export function getEligibleAd(
  user: UserForAds,
  contextTopics: string[],
  recentMessages: { role: string; content: string }[],
): AdCampaign | null {
  const prefs = loadAdPreferences();
  const state = loadAdEngineState();
  if (!shouldShowAdsToUser(user, prefs, state)) return null;
  if (isSensitiveContext(recentMessages)) return null;
  return selectBestAd(prefs, state, contextTopics, user);
}
