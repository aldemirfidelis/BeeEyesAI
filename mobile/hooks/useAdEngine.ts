import { useRef, useCallback } from "react";
import {
  loadAdPreferences,
  loadAdEngineState,
  saveAdEngineState,
  getEligibleAd,
  generateBeeAdIntroMessage,
  recordAdView,
  isSensitiveContext,
  extractTopicsFromMessages,
  type UserForAds,
} from "../lib/adService";
import type { SponsoredMessageMeta } from "../lib/ads";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  metadata?: string | null;
}

export function useAdEngine(user: UserForAds | null) {
  // Track which assistant message IDs have already triggered an ad check
  const processedRef = useRef<Set<string>>(new Set());

  const onAfterAssistantResponse = useCallback(
    async (
      messages: ChatMessage[],
      lastMessageId: string,
      addMessage: (msg: ChatMessage) => void,
    ) => {
      if (!user) return;
      if (processedRef.current.has(lastMessageId)) return;
      processedRef.current.add(lastMessageId);

      try {
        // Increment the between-ads counter for this response
        const state = await loadAdEngineState();
        state.messagesSinceLastAd = (state.messagesSinceLastAd ?? 0) + 1;
        await saveAdEngineState(state);

        // Sensitive context check — never show ads during vulnerable moments
        const recentMsgs = messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const sensitive = isSensitiveContext(recentMsgs);

        const recentTopics = extractTopicsFromMessages(recentMsgs);

        const context = {
          screen: "chat" as const,
          recentTopics,
          isSensitiveContext: sensitive,
        };

        const ad = await getEligibleAd(user, context);
        if (!ad) return;

        await recordAdView(ad.id);

        const prefs = await loadAdPreferences();
        const isPersonalized = prefs.allowPersonalizedAds && prefs.consentGiven;
        const beeIntroMessage = generateBeeAdIntroMessage();

        const meta: SponsoredMessageMeta = {
          type: "sponsored",
          adId: ad.id,
          beeIntroMessage,
          isPersonalized,
          ad,
        };

        addMessage({
          id: `bee_ad_${Date.now()}`,
          role: "assistant",
          content: beeIntroMessage,
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify(meta),
        });
      } catch {
        // Never crash the chat because of an ad error
      }
    },
    [user],
  );

  return { onAfterAssistantResponse };
}
