import * as SecureStore from "expo-secure-store";
import { useChatStore } from "../stores/chatStore";
import { useUIStore } from "../stores/uiStore";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL_RAW, getApiErrorMessage } from "../lib/api";
import { NewsDigestMeta } from "../lib/social";

function cleanAIText(text: string): string {
  return text
    .replace(/\{"suggest_mission":\s*\{[^}]+\}\}/g, "")
    .replace(/\{"achievement":\s*\{[^}]+\}\}/g, "")
    .replace(/\{"fetch_news":\s*\{[^}]+\}\}/g, "")
    .replace(/\{"create_event":\s*\{[\s\S]*?\}\}/g, "")
    .replace(/\{"log_finance":\s*\{[\s\S]*?\}\}/g, "")
    .replace(/\{"save_note":\s*\{[\s\S]*?\}\}/g, "")
    .trim();
}

export function useChat() {
  const { addMessage, setIsTyping, appendStream, finalizeStream } = useChatStore();
  const { setEyeExpression, showAchievement } = useUIStore();
  const queryClient = useQueryClient();

  async function sendMessage(content: string) {
    if (!content.trim()) return;

    addMessage({
      id: Date.now().toString(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      metadata: null,
    });

    setIsTyping(true);
    setEyeExpression("curious");

    const token = await SecureStore.getItemAsync("bee_token");

    try {
      const controller = new AbortController();
      // 60s para o stream de IA — pode demorar em 5G/dados móveis
      const chatTimeout = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${API_URL_RAW}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      clearTimeout(chatTimeout);

      if (!response.ok) {
        if (response.status === 401) {
          finalizeStream("Sessão expirada. Faça login novamente.");
          setEyeExpression("neutral");
          return;
        }
        if (response.status === 429) {
          const data = await response.json();
          finalizeStream(getApiErrorMessage(data, "Você enviou muitas mensagens. Tente novamente em alguns minutos."));
          setEyeExpression("neutral");
          return;
        }
        const failure = await response.json().catch(() => null);
        throw new Error(getApiErrorMessage(failure, `HTTP ${response.status}`));
      }

      const raw = await response.text();
      let fullText = "";
      let newsFetched: { query: string; items: any[] } | null = null;
      let reactedToResponse = false;

      const lines = raw.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data) continue;
        try {
          const event = JSON.parse(data);
          if (event.type === "chunk") {
            fullText += event.text;
            appendStream(cleanAIText(event.text));
            if (!reactedToResponse) {
              reactedToResponse = true;
              setEyeExpression("excited");
            }
          } else if (event.type === "mission_created") {
            queryClient.invalidateQueries({ queryKey: ["missions"] });
          } else if (event.type === "achievement_unlocked") {
            showAchievement(event.achievement);
            setEyeExpression("celebrating");
            setTimeout(() => setEyeExpression("happy"), 3000);
          } else if (event.type === "news_fetched") {
            newsFetched = { query: event.query, items: event.items };
            setEyeExpression("excited");
          } else if (event.type === "note_saved") {
            queryClient.invalidateQueries({ queryKey: ["colmeia-notes"] });
            showAchievement({ title: "Nota salva!", description: event.note?.title || "Adicionada à Colmeia" });
          } else if (event.type === "event_created") {
            queryClient.invalidateQueries({ queryKey: ["colmeia-events"] });
            showAchievement({ title: "Evento criado!", description: event.event?.title || "Adicionado ao Calendário" });
          } else if (event.type === "finance_logged") {
            queryClient.invalidateQueries({ queryKey: ["colmeia-finance"] });
            showAchievement({ title: "Transação registrada!", description: event.transaction?.description || event.transaction?.category || "Adicionada às Finanças" });
          }
        } catch { /* skip malformed */ }
      }

      finalizeStream(cleanAIText(fullText) || "Desculpe, não consegui gerar uma resposta.");
      setEyeExpression("happy");

      // Injetar card de notícias após a mensagem da IA
      if (newsFetched && newsFetched.items.length > 0) {
        addMessage({
          id: `news-${Date.now()}`,
          role: "assistant",
          content: `Aqui estão as notícias sobre "${newsFetched.query}":`,
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify({
            type: "news_digest",
            query: newsFetched.query,
            items: newsFetched.items,
          } satisfies NewsDigestMeta),
        });
      }

      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["score"] });
      queryClient.invalidateQueries({ queryKey: ["intelligent-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-center"] });
    } catch (err: any) {
      const isAbort = err?.name === "AbortError";
      const msg = isAbort
        ? "A resposta demorou muito. Verifique sua conexão e tente novamente."
        : getApiErrorMessage(err, "Não consegui me conectar agora. Verifique sua conexão e tente novamente!");
      finalizeStream(msg);
      setEyeExpression("neutral");
    }
  }

  return { sendMessage };
}

