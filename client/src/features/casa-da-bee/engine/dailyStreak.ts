import { useCallback, useEffect, useState } from "react";
import { SecureStore } from "./storage";

const KEY = "bee-house-streak-v1";

interface StreakData {
  count: number;
  lastClaimedDate: string;
  claimedToday: boolean;
}

const REWARDS_BY_DAY = [5, 8, 12, 18, 25, 35, 60] as const;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useDailyStreak() {
  const [data, setData] = useState<StreakData>({ count: 0, lastClaimedDate: "", claimedToday: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        if (raw) {
          const stored = JSON.parse(raw) as { count: number; lastClaimedDate: string };
          const today = todayKey();
          const yesterday = yesterdayKey();
          if (stored.lastClaimedDate === today) {
            setData({ count: stored.count, lastClaimedDate: stored.lastClaimedDate, claimedToday: true });
          } else if (stored.lastClaimedDate === yesterday) {
            setData({ count: stored.count, lastClaimedDate: stored.lastClaimedDate, claimedToday: false });
          } else {
            setData({ count: 0, lastClaimedDate: "", claimedToday: false });
          }
        }
      } catch { /* ignora */ }
      setLoaded(true);
    })();
  }, []);

  const claim = useCallback(async (): Promise<number | null> => {
    if (data.claimedToday) return null;
    const today = todayKey();
    const newCount = Math.min(7, data.count + 1);
    const reward = REWARDS_BY_DAY[Math.min(newCount - 1, REWARDS_BY_DAY.length - 1)];
    const next: StreakData = { count: newCount, lastClaimedDate: today, claimedToday: true };
    setData(next);
    try { await SecureStore.setItemAsync(KEY, JSON.stringify({ count: newCount, lastClaimedDate: today })); } catch { /* ignora */ }
    return reward;
  }, [data]);

  const nextReward = REWARDS_BY_DAY[Math.min(data.count, REWARDS_BY_DAY.length - 1)];

  return { ...data, claim, loaded, rewards: REWARDS_BY_DAY, nextReward };
}
