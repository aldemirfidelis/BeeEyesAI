import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

export type AchievementId =
  | "first-visit"
  | "first-pollen"
  | "first-task"
  | "level-2"
  | "level-5"
  | "level-10"
  | "ten-pollen"
  | "hundred-pollen"
  | "thousand-pollen"
  | "bee-friend"
  | "night-owl"
  | "early-bird";

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
  rewardPollen: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-visit", title: "Bem-vindo à casa", description: "Primeira visita à Casa da Bee", icon: "home", rewardPollen: 5 },
  { id: "first-pollen", title: "Mãos de pólen", description: "Coletou seu primeiro pólen", icon: "zap", rewardPollen: 2 },
  { id: "first-task", title: "Primeira missão", description: "Completou sua primeira tarefa", icon: "check-circle", rewardPollen: 10 },
  { id: "level-2", title: "Está crescendo", description: "Alcançou nível 2", icon: "trending-up", rewardPollen: 5 },
  { id: "level-5", title: "Em ritmo", description: "Alcançou nível 5", icon: "award", rewardPollen: 15 },
  { id: "level-10", title: "Veterana", description: "Alcançou nível 10", icon: "shield", rewardPollen: 50 },
  { id: "ten-pollen", title: "Coletora", description: "Acumulou 10 pólens", icon: "star", rewardPollen: 3 },
  { id: "hundred-pollen", title: "Tesouro", description: "Acumulou 100 pólens", icon: "gift", rewardPollen: 25 },
  { id: "thousand-pollen", title: "Rainha dos pólens", description: "Acumulou 1000 pólens", icon: "crown" as never, rewardPollen: 100 },
  { id: "bee-friend", title: "Amiga da Bia", description: "Conversou com a Bia", icon: "smile", rewardPollen: 5 },
  { id: "night-owl", title: "Coruja noturna", description: "Visitou à noite", icon: "moon", rewardPollen: 5 },
  { id: "early-bird", title: "Madrugadora", description: "Visitou antes das 8h", icon: "sun", rewardPollen: 5 },
];

const STORAGE_KEY = "bee-house-achievements-v1";

export function useAchievements() {
  const [unlocked, setUnlocked] = useState<Set<AchievementId>>(new Set());
  const [pendingToast, setPendingToast] = useState<Achievement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (raw) {
          const list = JSON.parse(raw) as AchievementId[];
          setUnlocked(new Set(list));
        }
      } catch {
        // ignora
      }
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback(async (set: Set<AchievementId>) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch {
      // ignora
    }
  }, []);

  const unlock = useCallback(
    (id: AchievementId) => {
      setUnlocked((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        persist(next);
        const ach = ACHIEVEMENTS.find((a) => a.id === id);
        if (ach) {
          setPendingToast((prevToast) => [...prevToast, ach]);
        }
        return next;
      });
    },
    [persist],
  );

  const consumeToast = useCallback(() => {
    setPendingToast((prev) => prev.slice(1));
  }, []);

  const isUnlocked = useCallback((id: AchievementId) => unlocked.has(id), [unlocked]);

  return { unlocked, unlock, isUnlocked, pendingToast, consumeToast, loaded };
}
