import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useUIStore } from "../stores/uiStore";
import { useChatStore } from "../stores/chatStore";
import { API_URL_RAW } from "../lib/api";
import * as SecureStore from "expo-secure-store";

export function useMissions() {
  const queryClient = useQueryClient();
  const { setEyeExpression, showAchievement } = useUIStore();
  const { addMessage } = useChatStore();

  const { data: missions = [], isLoading } = useQuery({
    queryKey: ["missions"],
    queryFn: async () => {
      const { data } = await api.get("/api/missions");
      return data;
    },
  });

  const createMission = useMutation({
    mutationFn: (body: { title: string; description?: string; xpReward?: number }) =>
      api.post("/api/missions", body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
  });

  const completeMission = useMutation({
    mutationFn: (id: string) =>
      api.put(`/api/missions/${id}/complete`).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setEyeExpression("celebrating");
      setTimeout(() => setEyeExpression("happy"), 3000);

      if (data.achievement) {
        showAchievement(data.achievement);
      }

      // Inject BeeEyes celebration message into chat
      if (data.celebrationMessage) {
        addMessage({
          id: `celebration-${Date.now()}`,
          role: "assistant",
          content: data.celebrationMessage,
          createdAt: new Date().toISOString(),
        });
      }
    },
  });

  const deleteMission = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      await api.delete(`/api/missions/${id}`);
      return { id, title };
    },
    onSuccess: async ({ title }) => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      const token = await SecureStore.getItemAsync("bee_token");
      if (!token) return;

      try {
        const response = await fetch(`${API_URL_RAW}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: `[SISTEMA] O usuario acabou de desistir e deletar a missao "${title}". Faca uma piada curta, leve e carinhosa sobre ele ter desistido.`,
            isSystem: true,
          }),
        });

        if (!response.ok) return;

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let finalContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "chunk") {
                finalContent += event.text;
              } else if (event.type === "done") {
                addMessage({
                  id: `mission-delete-${Date.now()}`,
                  role: "assistant",
                  content: event.cleanText ?? finalContent,
                  createdAt: new Date().toISOString(),
                  metadata: null,
                });
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
      } catch {
        // ignore joke generation failures
      }
    },
  });

  return { missions, isLoading, createMission, completeMission, deleteMission };
}
