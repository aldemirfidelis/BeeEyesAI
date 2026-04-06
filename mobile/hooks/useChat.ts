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
      const response = await fetch(`${API_URL_RAW}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

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
          } else if (event.type === "mission_created") {
            queryClient.invalidateQueries({ queryKey: ["missions"] });
          } else if (event.type === "achievement_unlocked") {
            showAchievement(event.achievement);
            setEyeExpression("celebrating");
            setTimeout(() => setEyeExpression("happy"), 3000);
          } else if (event.type === "news_fetched") {
            newsFetched = { query: event.query, items: event.items };
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
    } catch (err) {
      console.error("[useChat] erro:", err);
      finalizeStream(getApiErrorMessage(err, "Não consegui me conectar agora. Verifique sua conexão e tente novamente!"));
      setEyeExpression("neutral");
    }
  }

  return { sendMessage };
}

