import { useRef, useCallback } from "react";
import { api } from "@mobile/lib/api";
import {
  loadAdPreferences,
  loadAdEngineState,
  saveAdEngineState,
  getEligibleAds,
  generateBeeAdIntroMessage,
  recordAdView,
  isSensitiveContext,
  extractTopicsFromMessages,
  type UserForAds,
} from "../lib/adService";

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

        const ads = await getEligibleAds(user, context, 3);
        if (ads.length === 0) return;

        const prefs = await loadAdPreferences();
        const isPersonalized = prefs.allowPersonalizedAds && prefs.consentGiven;
        const beeIntroMessage = generateBeeAdIntroMessage();

        const response = await api.post("/api/ad-impressions/chat", {
          anchorMessageId: lastMessageId,
          adId: ads[0].id,
          beeIntroMessage,
          isPersonalized,
          ad: ads[0],
          ads,
          groupTitle: ads.length > 1 ? "Anúncios que podem te interessar" : undefined,
          layoutType: ads.length > 1 ? "carousel" : undefined,
          source: "mobile_chat",
        });

        const persisted = response.data?.message;
        if (!persisted?.id) return;

        for (const ad of ads) await recordAdView(ad.id);
        addMessage({
          id: persisted.id,
          role: "assistant",
          content: persisted.content,
          createdAt: persisted.createdAt,
          metadata: persisted.metadata,
        });
      } catch {
        // Never crash the chat because of an ad error
      }
    },
    [user],
  );

  return { onAfterAssistantResponse };
}
