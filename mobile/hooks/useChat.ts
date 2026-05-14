import * as SecureStore from "expo-secure-store";
import { useChatStore } from "../stores/chatStore";
import { useUIStore } from "../stores/uiStore";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL_RAW, getApiErrorMessage } from "../lib/api";
import { NewsDigestMeta } from "../lib/social";
import type { ResearchResult } from "../components/ResearchResultCard";

function cleanAIText(text: string): string {
  return text
    .replace(/\{"achievement":\s*\{[^}]+\}\}/g, "")
    .replace(/\{"fetch_news":\s*\{[^}]+\}\}/g, "")
    .replace(/\{"create_event":\s*\{[\s\S]*?\}\}/g, "")
    .replace(/\{"log_finance":\s*\{[\s\S]*?\}\}/g, "")
    .replace(/\{"save_note":\s*\{[\s\S]*?\}\}/g, "")
    .replace(/\{"(?:achievement|fetch_news|create_event|log_finance|save_note)"[\s\S]*$/g, "")
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
      let visibleText = "";
      let newsFetched: { query: string; items: any[] } | null = null;
      let pendingResearch: { intent: string; results: ResearchResult[] } | null = null;
      let pendingWorkout: any = null;
      let reactedToResponse = false;
      let doneMetadata: string | null = null;
      let doneId: string | undefined;

      const lines = raw.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data) continue;
        try {
          const event = JSON.parse(data);
          if (event.type === "chunk") {
            fullText += event.text;
            const nextVisibleText = cleanAIText(fullText);
            if (nextVisibleText.length > visibleText.length) {
              appendStream(nextVisibleText.slice(visibleText.length));
            }
            visibleText = nextVisibleText;
            if (!reactedToResponse) {
              reactedToResponse = true;
              setEyeExpression("excited");
            }
          } else if (event.type === "research_start") {
            setEyeExpression("curious");
          } else if (event.type === "research_results") {
            if (event.results?.length > 0) {
              pendingResearch = { intent: event.intent, results: event.results };
            }
            setEyeExpression("excited");
          } else if (event.type === "workout_suggestion") {
            pendingWorkout = event.plan;
            setEyeExpression("excited");
          } else if (event.type === "news_fetched") {
            newsFetched = { query: event.query, items: event.items };
            setEyeExpression("excited");
          } else if (event.type === "note_saved") {
            queryClient.invalidateQueries({ queryKey: ["colmeia-notes"] });
            showAchievement({ id: "note_saved", type: "note_saved", title: "Nota salva!", description: event.note?.title || event.note?.content?.slice(0, 50) || "Adicionada à Colmeia" });
          } else if (event.type === "event_created") {
            queryClient.invalidateQueries({ queryKey: ["colmeia-events"] });
            showAchievement({ id: "event_created", type: "event_created", title: "Evento criado!", description: event.event?.title || "Adicionado ao Calendário" });
          } else if (event.type === "finance_logged") {
            queryClient.invalidateQueries({ queryKey: ["colmeia-finance"] });
            const tx = event.transaction;
            const label = tx?.type === "income" ? "Receita" : "Despesa";
            const amount = tx ? ` R$ ${(tx.amountCents / 100).toFixed(2)}` : "";
            showAchievement({ id: "finance_logged", type: "finance_logged", title: `${label} registrada!`, description: (tx?.description || tx?.category || "Finanças") + amount });
          } else if (event.type === "alarm_created") {
            queryClient.invalidateQueries({ queryKey: ["colmeia-alarms"] });
            showAchievement({ id: "alarm_created", type: "alarm_created", title: "Despertador criado!", description: event.alarm?.title || "Adicionado ao Relogio" });
          } else if (event.type === "done") {
            doneId = event.id;
            if (event.cleanText) fullText = event.cleanText;
            // Prefer metadata from server (already includes research); fall back to pending research
            doneMetadata = event.metadata
              ?? (pendingResearch
                ? JSON.stringify({ type: "research", intent: pendingResearch.intent, results: pendingResearch.results })
                : null);
          }
        } catch { /* skip malformed */ }
      }

      finalizeStream(cleanAIText(fullText) || "Desculpe, não consegui gerar uma resposta.", doneMetadata, doneId);
      setEyeExpression("happy");

      // Injetar card de sugestão de treino após a mensagem da IA
      if (pendingWorkout) {
        addMessage({
          id: `workout-${Date.now()}`,
          role: "assistant",
          content: "Aqui está minha sugestão de treino para você 🐝💪",
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify({ type: "workout_suggestion", plan: pendingWorkout }),
        });
      }

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
