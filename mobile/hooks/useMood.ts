import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useMood(days = 30) {
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["mood", days],
    queryFn: async () => {
      const { data } = await api.get(`/api/mood?days=${days}`);
      return data;
    },
    staleTime: 60 * 60 * 1000,
  });

  const logMood = useMutation({
    mutationFn: (body: { mood: number; note?: string }) =>
      api.post("/api/mood", body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mood"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  return { entries, isLoading, logMood };
}
