import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { WorldCanvas } from "./WorldCanvas";
import { HUD } from "./components/HUD";
import { DialogBox } from "./components/DialogBox";
import { AchievementToast } from "./components/AchievementToast";
import { ShopModal } from "./components/ShopModal";
import { DailyStreakModal } from "./components/DailyStreakModal";
import { MiniGameModal } from "./components/MiniGameModal";
import { OnboardingOverlay } from "./components/OnboardingOverlay";
import { useBeeGame } from "./engine/state";
import { useInventory } from "./engine/inventory";
import { useAchievements } from "./engine/achievements";
import { useDailyStreak } from "./engine/dailyStreak";
import { useOnboarding } from "./engine/onboarding";
import { usePassivePollen } from "./engine/passive";
import { getTimeOfDay, DAY_NIGHT_PRESETS } from "./engine/dayNight";
import type { Station, MapNpc } from "./engine/types";
import type { CatalogItem } from "./engine/catalog";

export default function CasaDaBeeScreen() {
  const [, setLocation] = useLocation();
  const [dialog, setDialog] = useState<{ message: string; speaker?: string } | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [miniOpen, setMiniOpen] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState(() => getTimeOfDay());

  // Atualiza day/night a cada 5min
  useEffect(() => {
    const i = setInterval(() => setTimeOfDay(getTimeOfDay()), 5 * 60 * 1000);
    return () => clearInterval(i);
  }, []);

  const game = useBeeGame({
    onSpeech: (msg) => setDialog({ message: msg, speaker: "Bee" }),
    onLevelUp: (lv) => {
      setDialog({ message: `Subiu pro nivel ${lv}! Comemorando!`, speaker: "Bee" });
      if (lv >= 2) unlockAch("level-2");
      if (lv >= 5) unlockAch("level-5");
      if (lv >= 10) unlockAch("level-10");
    },
  });
  const inventory = useInventory();
  const achievements = useAchievements();
  const streak = useDailyStreak();
  const onboarding = useOnboarding();
  const passive = usePassivePollen(game.map, useCallback(() => ({ x: game.getBeePixel().x, y: game.getBeePixel().y }), [game]));

  // Helper pra desbloquear achievement (extrai pra fora pra evitar re-render hell)
  const unlockAch = useCallback((id: Parameters<typeof achievements.unlock>[0]) => {
    achievements.unlock(id);
  }, [achievements]);

  // First visit
  useEffect(() => {
    if (!onboarding.loaded || !achievements.loaded) return;
    unlockAch("first-visit");
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 6) unlockAch("night-owl");
    if (hour >= 5 && hour < 8) unlockAch("early-bird");
  }, [onboarding.loaded, achievements.loaded, unlockAch]);

  // Player click on station
  const onStationClick = useCallback((station: Station) => {
    setDialog({ message: station.message, speaker: station.title });
    if (station.id === "wardrobe") {
      setShopOpen(true);
    } else if (station.reward) {
      game.setStats((prev) => ({
        ...prev,
        pollen: prev.pollen + (station.reward?.pollen ?? 0),
        xp: prev.xp + (station.reward?.xp ?? 0),
      }));
    } else if (station.heal) {
      game.setStats((prev) => ({ ...prev, health: Math.min(prev.maxHealth, prev.health + station.heal!) }));
    }
  }, [game]);

  const onNpcClick = useCallback((npc: MapNpc) => {
    setDialog({ message: npc.message, speaker: npc.name });
    unlockAch("bee-friend");
  }, [unlockAch]);

  const onItemPickup = useCallback((item: { id: string; type: string; amount: number }) => {
    passive.collect(item.id);
    game.setStats((prev) => {
      let pollen = prev.pollen;
      let xp = prev.xp;
      let health = prev.health;
      if (item.type === "pollen") pollen += item.amount;
      if (item.type === "star") pollen += item.amount;
      if (item.type === "heart") health = Math.min(prev.maxHealth, health + item.amount);
      // Achievement firsts
      if (item.type === "pollen" || item.type === "star") {
        unlockAch("first-pollen");
        if (pollen >= 10) unlockAch("ten-pollen");
        if (pollen >= 100) unlockAch("hundred-pollen");
        if (pollen >= 1000) unlockAch("thousand-pollen");
      }
      return { ...prev, pollen, xp, health };
    });
  }, [game, passive, unlockAch]);

  const onBuy = useCallback((item: CatalogItem) => {
    const res = inventory.buy(item, game.stats.pollen);
    if (res.ok) {
      game.setStats((prev) => ({ ...prev, pollen: res.remainingPollen ?? prev.pollen }));
    }
    return res;
  }, [inventory, game]);

  const claimStreak = useCallback(async () => {
    const reward = await streak.claim();
    if (reward !== null) {
      game.setStats((prev) => ({ ...prev, pollen: prev.pollen + reward }));
      setStreakOpen(false);
      setDialog({ message: `Sequencia mantida! Voce ganhou ${reward} pólens.`, speaker: "Bee" });
    }
  }, [streak, game]);

  const onMiniReward = useCallback((pollen: number) => {
    game.setStats((prev) => ({ ...prev, pollen: prev.pollen + pollen, xp: prev.xp + Math.floor(pollen / 2) }));
    setDialog({ message: `Bom jogo! +${pollen} pólens coletados.`, speaker: "Bee" });
  }, [game]);

  const handleClose = useCallback(() => setLocation("/"), [setLocation]);

  const todayLabel = useMemo(() => DAY_NIGHT_PRESETS[timeOfDay].label, [timeOfDay]);

  if (!inventory.loaded || !achievements.loaded || !streak.loaded || !onboarding.loaded) {
    return <div style={styles.loader}>🐝 Carregando Casa da Bee...</div>;
  }

  return (
    <div style={styles.root}>
      <div style={styles.canvasWrap}>
        <WorldCanvas
          game={game}
          inventory={inventory}
          spawnedItems={passive.items}
          timeOfDay={timeOfDay}
          onStationClick={onStationClick}
          onNpcClick={onNpcClick}
          onItemPickup={onItemPickup}
        />
      </div>

      <HUD
        stats={game.stats}
        streakCount={streak.count}
        streakClaimedToday={streak.claimedToday}
        timeOfDayLabel={todayLabel}
        onOpenShop={() => setShopOpen(true)}
        onOpenStreak={() => setStreakOpen(true)}
        onOpenMiniGame={() => setMiniOpen(true)}
        onClose={handleClose}
      />

      {dialog && <DialogBox message={dialog.message} speaker={dialog.speaker} onClose={() => setDialog(null)} />}

      {achievements.pendingToast.length > 0 && (
        <AchievementToast achievement={achievements.pendingToast[0]} onDismiss={achievements.consumeToast} />
      )}

      {shopOpen && (
        <ShopModal
          pollen={game.stats.pollen}
          level={game.stats.level}
          inventory={inventory}
          onBuy={onBuy}
          onClose={() => setShopOpen(false)}
        />
      )}

      {streakOpen && (
        <DailyStreakModal
          count={streak.count}
          rewards={streak.rewards}
          claimedToday={streak.claimedToday}
          nextReward={streak.nextReward}
          onClaim={claimStreak}
          onClose={() => setStreakOpen(false)}
        />
      )}

      {miniOpen && <MiniGameModal onClose={() => setMiniOpen(false)} onReward={onMiniReward} />}

      {onboarding.shouldShow && <OnboardingOverlay onComplete={onboarding.complete} />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "fixed",
    inset: 0,
    background: "#160f04",
    overflow: "hidden",
    zIndex: 1,
  },
  canvasWrap: {
    position: "absolute",
    inset: 0,
    paddingTop: 88,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loader: {
    position: "fixed",
    inset: 0,
    background: "#fff8d6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 900,
    color: "#5a3a08",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};
