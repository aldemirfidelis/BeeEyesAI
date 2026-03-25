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
    mutationFn: (id: string) => api.delete(`/api/missions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
  });

  return { missions, isLoading, createMission, completeMission, deleteMission };
}
