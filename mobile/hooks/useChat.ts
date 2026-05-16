import * as SecureStore from "expo-secure-store";
import { useChatStore } from "../stores/chatStore";
import { useUIStore } from "../stores/uiStore";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL_RAW, getApiErrorMessage } from "../lib/api";
import { NewsDigestMeta } from "../lib/social";
import { createBeeHouseTask, updateBeeHouseTask } from "../services/beeHouseService";
import type { ResearchResult } from "../components/ResearchResultCard";
import type { Message } from "../stores/chatStore";

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

  async function sendMessage(content: string, repliedTo?: Pick<Message, "id" | "role" | "content" | "createdAt"> | null) {
    if (!content.trim()) return;
    const replyPayload = repliedTo
      ? {
          repliedToMessageId: repliedTo.id,
          repliedToMessageContent: repliedTo.content.slice(0, 1000),
          repliedToMessageRole: repliedTo.role,
          repliedToMessageCreatedAt: repliedTo.createdAt,
        }
      : {};

    addMessage({
      id: Date.now().toString(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      metadata: null,
      ...replyPayload,
    });

    setIsTyping(true);
    setEyeExpression("curious");

    const token = await SecureStore.getItemAsync("bee_token");
    let beeHouseTaskId: string | null = null;
    const syncBeeHouseTask = (patch: Parameters<typeof updateBeeHouseTask>[1]) => {
      if (!beeHouseTaskId) return;
      updateBeeHouseTask(beeHouseTaskId, patch)
        .then(() => queryClient.invalidateQueries({ queryKey: ["bee-house-bootstrap"] }))
        .catch(() => {});
    };

    try {
      if (token) {
        const task = await createBeeHouseTask({
          content,
          payload: { origin: "chat" },
        }).catch(() => null);
        beeHouseTaskId = task?.id ?? null;
        if (beeHouseTaskId) queryClient.invalidateQueries({ queryKey: ["bee-house-bootstrap"] });
      }

      const controller = new AbortController();
      // 60s para o stream de IA — pode demorar em 5G/dados móveis
      const chatTimeout = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${API_URL_RAW}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ content, ...replyPayload }),
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

      let fullText = "";
      let visibleText = "";
      // Containers para variáveis mutadas dentro da closure handleSSELine.
      // TypeScript não faz narrowing através de mutações em closures, então
      // usar `.current` em um objeto preserva o tipo declarado.
      const newsRef: { current: { query: string; items: any[] } | null } = { current: null };
      const researchRef: { current: { intent: string; results: ResearchResult[] } | null } = { current: null };
      const workoutRef: { current: any } = { current: null };
      let reactedToResponse = false;
      let doneMetadata: string | null = null;
      let doneId: string | undefined;

      // Processa uma linha SSE `data: ...`. Extraído pra reuso entre streaming
      // incremental (reader) e fallback batch (response.text()).
      const handleSSELine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        const data = line.slice(6).trim();
        if (!data) return;
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
            syncBeeHouseTask({ status: "searching", progress: 35 });
          } else if (event.type === "research_results") {
            if (event.results?.length > 0) {
              researchRef.current = { intent: event.intent, results: event.results };
            }
            setEyeExpression("excited");
            syncBeeHouseTask({ status: "generating", progress: 75, payload: { intent: event.intent } });
          } else if (event.type === "workout_suggestion") {
            workoutRef.current = event.plan;
            setEyeExpression("excited");
            syncBeeHouseTask({ status: "generating", taskType: "fitness", progress: 80 });
          } else if (event.type === "news_fetched") {
            newsRef.current = { query: event.query, items: event.items };
            setEyeExpression("excited");
            syncBeeHouseTask({ status: "generating", taskType: "research", progress: 80, payload: { query: event.query } });
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
            showAchievement({ id: "alarm_created", type: "alarm_created", title: "Despertador criado!", description: event.alarm?.title || "Adicionado ao Relógio" });
          } else if (event.type === "done") {
            doneId = event.id;
            if (event.cleanText) fullText = event.cleanText;
            const pending = researchRef.current;
            doneMetadata = event.metadata
              ?? (pending
                ? JSON.stringify({ type: "research", intent: pending.intent, results: pending.results })
                : null);
          }
        } catch { /* skip malformed */ }
      };

      // Streaming incremental via getReader() — usuário vê a Bee "digitando"
      // em tempo real em vez de esperar a resposta completa. Fallback para
      // response.text() quando o body não é exposto (RN antigo / certos shims).
      const reader = (response.body as ReadableStream<Uint8Array> | null | undefined)?.getReader?.();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE separa eventos por \n\n; processa só linhas completas.
          let newlineIdx;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);
            handleSSELine(line);
          }
        }
        // Flush qualquer linha pendente no buffer
        if (buffer.trim()) handleSSELine(buffer);
      } else {
        // Fallback (modo legado): lê tudo de uma vez
        const raw = await response.text();
        for (const line of raw.split("\n")) handleSSELine(line);
      }

      finalizeStream(cleanAIText(fullText) || "Desculpe, não consegui gerar uma resposta.", doneMetadata, doneId);
      setEyeExpression("happy");
      syncBeeHouseTask({
        status: "completed",
        progress: 100,
        sourceMessageId: doneId ?? null,
        resultSummary: cleanAIText(fullText).slice(0, 800),
      });

      // Injetar card de sugestão de treino após a mensagem da IA
      if (workoutRef.current) {
        addMessage({
          id: `workout-${Date.now()}`,
          role: "assistant",
          content: "Aqui está minha sugestão de treino para você 🐝💪",
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify({ type: "workout_suggestion", plan: workoutRef.current }),
        });
      }

      // Injetar card de notícias após a mensagem da IA
      const news = newsRef.current;
      if (news && news.items.length > 0) {
        addMessage({
          id: `news-${Date.now()}`,
          role: "assistant",
          content: `Aqui estão as notícias sobre "${news.query}":`,
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify({
            type: "news_digest",
            query: news.query,
            items: news.items,
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
      syncBeeHouseTask({
        status: "failed",
        progress: 100,
        errorMessage: msg,
      });
    }
  }

  return { sendMessage };
}
