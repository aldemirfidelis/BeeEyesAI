import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useUIStore } from "../stores/uiStore";
import { useChatStore } from "../stores/chatStore";

export function useMissions() {
  const queryClient = useQueryClient();
  const { setEyeExpression, showAchievement } = useUIStore();
  const { addMessage } = useChatStore();

  const { data: missions = [], isLoading } = useQuery({
    queryKey: ["missions"],
    queryFn: () => api.get("/api/missions").then((r) => r.data),
    refetchInterval: 8000,       // poll every 8s so auto-completed missions appear quickly
    refetchOnWindowFocus: true,
  });

  // Seed predefined missions for user (idempotent)
  const seedMissions = useMutation({
    mutationFn: () => api.post("/api/missions/seed").then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
  });

  // Complete a mission manually (e.g. if triggered from UI)
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

  return { missions, isLoading, seedMissions, completeMission };
}
