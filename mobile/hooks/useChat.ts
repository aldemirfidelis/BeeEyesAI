import * as SecureStore from "expo-secure-store";
import { useChatStore } from "../stores/chatStore";
import { useUIStore } from "../stores/uiStore";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL_RAW } from "../lib/api";

export function useChat() {
  const { addMessage, setIsTyping, appendStream, finalizeStream } = useChatStore();
  const { setEyeExpression, showAchievement } = useUIStore();
  const queryClient = useQueryClient();

  async function sendMessage(content: string) {
    if (!content.trim()) return;

    // Add user message immediately
    addMessage({
      id: Date.now().toString(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
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
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);

            if (event.type === "chunk") {
              fullText += event.text;
              appendStream(event.text);
            } else if (event.type === "done") {
              finalizeStream(fullText);
              setEyeExpression("happy");
            } else if (event.type === "mission_created") {
              queryClient.invalidateQueries({ queryKey: ["missions"] });
            } else if (event.type === "achievement_unlocked") {
              showAchievement(event.achievement);
              setEyeExpression("celebrating");
              setTimeout(() => setEyeExpression("happy"), 3000);
            } else if (event.type === "error") {
              finalizeStream("Desculpe, tive um problema ao responder. Tente novamente!");
              setEyeExpression("neutral");
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch {
      finalizeStream("Não consegui me conectar agora. Verifique sua conexão e tente novamente!");
      setEyeExpression("neutral");
    }
  }

  return { sendMessage };
}
