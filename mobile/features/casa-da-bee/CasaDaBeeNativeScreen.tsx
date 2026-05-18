import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";
import {
  buildBeeHouseBridgeTask,
  claimBeeHouseTaskReward,
  getBeeHouseBootstrap,
} from "@mobile/services/beeHouseService";
import { WorldCanvas } from "./components/WorldCanvas";
import { HUD } from "./components/HUD";
import { DialogBox } from "./components/DialogBox";
import { AchievementToast } from "./components/AchievementToast";
import { OnboardingOverlay } from "./components/OnboardingOverlay";
import { FloatingTextOverlay } from "./components/FloatingTextOverlay";
import { DailyStreakModal } from "./components/DailyStreakModal";
import { ShopModal } from "./components/ShopModal";
import { MiniGameModal } from "./components/MiniGameModal";
import { useBeeGame } from "./engine/state";
import { useEffectsLayer } from "./engine/effects";
import { usePassivePollen } from "./engine/passive";
import { useAchievements } from "./engine/achievements";
import { useOnboarding } from "./engine/onboarding";
import { useDailyStreak } from "./engine/dailyStreak";
import { useInventory } from "./engine/inventory";
import { useFurnitureLayout } from "./engine/furnitureLayout";
import { useCombo } from "./engine/combo";
import { getTimeOfDay, DAY_NIGHT_PRESETS } from "./engine/dayNight";
import { pickRandomMission } from "./engine/missions";
import { useBeePetStore } from "@mobile/stores/beePetStore";

export default function CasaDaBeeNativeScreen() {
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const headerHeight = 56;
  const canvasHeight = height - insets.top - insets.bottom - headerHeight;

  const [dialog, setDialog] = useState<{ message: string; speaker?: string } | null>(null);
  const [timeOfDay, setTimeOfDay] = useState(() => getTimeOfDay());

  // Atualiza day/night a cada 5 min
  useEffect(() => {
    const handle = setInterval(() => setTimeOfDay(getTimeOfDay()), 5 * 60 * 1000);
    return () => clearInterval(handle);
  }, []);

  const effects = useEffectsLayer();
  const achievements = useAchievements();
  const onboarding = useOnboarding();
  const streak = useDailyStreak();
  const inventory = useInventory();
  const furnitureLayout = useFurnitureLayout();
  const combo = useCombo();
  const markVisitedHouse = useBeePetStore((s) => s.markVisitedHouse);
  const setEquippedOutfit = useBeePetStore((s) => s.setEquippedOutfit);
  const pendingPollenFromPet = useBeePetStore((s) => s.pendingPollen);

  const [showStreak, setShowStreak] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showMiniGame, setShowMiniGame] = useState(false);

  // Mostra modal de streak quando entrar (se ainda nao reclamou hoje)
  useEffect(() => {
    if (streak.loaded && !streak.claimedToday && !onboarding.shouldShow) {
      const handle = setTimeout(() => setShowStreak(true), 600);
      return () => clearTimeout(handle);
    }
  }, [onboarding.shouldShow, streak.claimedToday, streak.loaded]);

  // Mantem o PetStore sincronizado com o outfit equipado
  useEffect(() => {
    if (!inventory.loaded) return;
    setEquippedOutfit(inventory.equipped.hat, inventory.equipped.accessory, inventory.equipped.body);
  }, [inventory.loaded, inventory.equipped.hat, inventory.equipped.accessory, inventory.equipped.body, setEquippedOutfit]);

  // Sincroniza visita à casa: coleta pólen pendente que veio do PetIndicator
  useEffect(() => {
    if (pendingPollenFromPet > 0) {
      const cx = width / 2;
      const cy = canvasHeight / 2;
      effects.spawnFloatingText(cx, cy - 30, `+${pendingPollenFromPet} pólen acumulado`, {
        color: "#fbe27a",
        icon: "zap",
        durationMs: 1800,
      });
    }
    // limpa pendentes ao visitar casa
    markVisitedHouse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = useQuery({
    queryKey: ["bee-house-bootstrap"],
    queryFn: getBeeHouseBootstrap,
    staleTime: 20000,
  });

  const game = useBeeGame({
    onTaskAck: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    onTaskDone: async (taskId, target, reward, xp) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const cx = width / 2;
      const cy = canvasHeight / 2;
      effects.spawnConfetti(cx, cy, { count: 30 });
      effects.spawnFloatingText(cx, cy - 30, `+${reward} pólen`, { color: "#fbe27a", icon: "zap" });
      if (xp > 0) {
        effects.spawnFloatingText(cx, cy, `+${xp} XP`, { color: "#9ccaff", icon: "star" });
      }
      achievements.unlock("first-task");
      try {
        await claimBeeHouseTaskReward(taskId, {
          rewardPollen: reward,
          rewardXp: xp,
          bridgeTarget: target as never,
        });
      } catch {
        // silencia; HUD ja atualizou local
      }
      await query.refetch();
    },
    onLevelUp: (newLevel) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const cx = width / 2;
      const cy = canvasHeight / 2;
      effects.spawnConfetti(cx, cy, { count: 60, durationMs: 2400 });
      effects.spawnFloatingText(cx, cy, `NÍVEL ${newLevel}!`, { color: "#fbe27a", icon: "award", durationMs: 2200 });
      setDialog({
        speaker: "Bee",
        message: `Subi pra o nível ${newLevel}! 🎉 Continua assim, vamos longe juntas.`,
      });
    },
    onSpeech: (message) => setDialog({ message }),
  });

  const passive = usePassivePollen(game.map, () => ({ x: game.tileX.value, y: game.tileY.value }));

  // Detecta quando a Bee chega num tile que tem item passivo - coleta automatica
  useEffect(() => {
    const interval = setInterval(() => {
      const bx = game.tileX.value;
      const by = game.tileY.value;
      const here = passive.items.find((i) => i.position.x === bx && i.position.y === by);
      if (!here) return;
      const collected = passive.collect(here.id);
      if (!collected) return;

      // Posicao em pixels relativa a tela
      const map = game.map;
      const tileSize = Math.min(width / map.width, canvasHeight / map.height);
      const offsetX = (width - tileSize * map.width) / 2;
      const offsetY = (canvasHeight - tileSize * map.height) / 2;
      const px = offsetX + bx * tileSize + tileSize / 2;
      const py = offsetY + by * tileSize + tileSize / 2;

      const isStar = collected.type === "star";
      Haptics.impactAsync(isStar ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Combo: cada coleta consecutiva (em janela de 5s) aumenta multiplicador
      const multiplier = combo.trigger();
      const finalAmount = Math.round(collected.amount * multiplier);

      const color = isStar ? "#fff06d" : collected.type === "pollen" ? "#fbe27a" : "#f4838b";
      effects.spawnParticleBurst(px, py, { color, count: isStar ? 28 : 14 });

      if (isStar) {
        effects.spawnConfetti(px, py, { count: 18, durationMs: 1500 });
        effects.spawnFloatingText(px, py - tileSize * 0.5, `★ +${finalAmount} pólen!`, {
          color: "#fff06d",
          icon: "star",
          durationMs: 1800,
        });
      } else {
        const comboTxt = multiplier > 1 ? ` (x${multiplier})` : "";
        effects.spawnFloatingText(
          px,
          py - tileSize * 0.5,
          collected.type === "pollen" ? `+${finalAmount}${comboTxt}` : `+${finalAmount} ❤${comboTxt}`,
          { color, icon: collected.type === "pollen" ? "zap" : "heart" },
        );
      }

      // Atualiza stats (star da pollen tambem, com multiplier do combo)
      const pollenDelta = collected.type === "pollen" || collected.type === "star" ? finalAmount : 0;
      const healthDelta = collected.type === "heart" ? finalAmount : 0;
      game.applyHouseSnapshot({
        pollen: game.stats.pollen + pollenDelta,
        health: Math.min(game.stats.maxHealth, game.stats.health + healthDelta),
      });

      // Achievement
      achievements.unlock("first-pollen");
      const newTotal = game.stats.pollen + (collected.type === "pollen" ? collected.amount : 0);
      if (newTotal >= 10) achievements.unlock("ten-pollen");
      if (newTotal >= 100) achievements.unlock("hundred-pollen");
      if (newTotal >= 1000) achievements.unlock("thousand-pollen");
    }, 350);
    return () => clearInterval(interval);
  }, [achievements, canvasHeight, effects, game, passive, width]);

  // Bee task vindo do backend
  useEffect(() => {
    const activeTask = query.data?.activeTask;
    if (!activeTask) return;
    if (activeTask.status === "completed" || activeTask.status === "failed" || activeTask.status === "idle") return;
    const bridge = buildBeeHouseBridgeTask(activeTask);
    game.pushTask({
      id: bridge.id,
      target: bridge.target,
      reward: bridge.reward,
      xp: 15,
      speechText: bridge.speechText,
    });
  }, [game, query.data?.activeTask]);

  // Snapshot do servidor → stats locais
  useEffect(() => {
    if (query.data?.profile) {
      const profile = query.data.profile as { pollen?: number; xp?: number; level?: number };
      game.applyHouseSnapshot({
        pollen: profile.pollen ?? 18,
        xp: profile.xp ?? 0,
        level: profile.level ?? 1,
      });
    }
  }, [game, query.data?.profile]);

  // Achievements baseados em horário e level
  useEffect(() => {
    if (!onboarding.loaded) return;
    achievements.unlock("first-visit");
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) achievements.unlock("night-owl");
    if (hour >= 5 && hour < 8) achievements.unlock("early-bird");
  }, [achievements, onboarding.loaded]);

  useEffect(() => {
    if (game.stats.level >= 2) achievements.unlock("level-2");
    if (game.stats.level >= 5) achievements.unlock("level-5");
    if (game.stats.level >= 10) achievements.unlock("level-10");
  }, [achievements, game.stats.level]);

  const dismissDialog = useCallback(() => setDialog(null), []);
  const currentToast = achievements.pendingToast[0] ?? null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { height: headerHeight }]}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.75}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Casa da Bee</Text>
            <View style={styles.subtitleRow}>
              <Feather name={timeBadgeIcon(timeOfDay)} size={11} color={colors.muted} />
              <Text style={styles.subtitle}>{DAY_NIGHT_PRESETS[timeOfDay].label} · {game.stats.location}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setShowMiniGame(true);
            }}
            activeOpacity={0.75}
          >
            <Feather name="target" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setShowShop(true);
            }}
            activeOpacity={0.75}
          >
            <Feather name="shopping-bag" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              query.refetch();
            }}
            activeOpacity={0.75}
          >
            <Feather name="refresh-cw" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.canvasShell}>
          <WorldCanvas
            game={game}
            width={width}
            height={canvasHeight}
            timeOfDay={timeOfDay}
            passiveItems={passive.items}
            effects={effects.effects}
            equippedHat={inventory.getEquippedItem("hat")}
            equippedAccessory={inventory.getEquippedItem("accessory")}
            equippedBody={inventory.getEquippedItem("body")}
            equippedBed={inventory.getEquippedItem("furniture-bed")}
            equippedDesk={inventory.getEquippedItem("furniture-desk")}
            equippedRug={inventory.getEquippedItem("furniture-rug")}
            equippedWallpaper={inventory.getEquippedItem("wallpaper")}
            equippedFloor={inventory.getEquippedItem("floor")}
            furnitureOverrides={furnitureLayout.layout}
            onMoveFurniture={(stationId, position) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              furnitureLayout.move(stationId, position);
              setDialog({ speaker: "Bee", message: "Móvel movido! 🪄" });
            }}
            onNpcTap={(npcId) => {
              if (npcId !== "mini-bee") return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              achievements.unlock("bee-friend");
              const mission = pickRandomMission();
              setDialog({
                speaker: "Bia",
                message: `${mission.title} — ${mission.description} (recompensa: +${mission.rewardPollen} pólen)`,
              });
              // Spawnar polen extra como recompensa do encontro
              game.applyHouseSnapshot({
                pollen: game.stats.pollen + mission.rewardPollen,
                xp: game.stats.xp + mission.rewardXp,
              });
              const cx = width / 2;
              const cy = canvasHeight / 2;
              effects.spawnFloatingText(cx, cy, `+${mission.rewardPollen} pólen`, { color: "#fbe27a", icon: "zap" });
            }}
          />
          <HUD stats={game.stats} comboCount={combo.count} />
          <FloatingTextOverlay effects={effects.effects} />
          <DialogBox visible={!!dialog} speaker={dialog?.speaker} message={dialog?.message ?? ""} onDismiss={dismissDialog} />
          {query.isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={colors.primaryDark} />
            </View>
          )}
        </View>

        <AchievementToast achievement={currentToast} onDismiss={achievements.consumeToast} />
        <OnboardingOverlay visible={onboarding.shouldShow && onboarding.loaded} onComplete={onboarding.complete} />
        <DailyStreakModal
          visible={showStreak}
          streakDay={Math.min(streak.count + (streak.claimedToday ? 0 : 1), 7)}
          rewards={streak.rewards}
          claimed={streak.claimedToday}
          onClaim={async () => {
            const reward = await streak.claim();
            if (reward) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              const cx = width / 2;
              const cy = canvasHeight / 2;
              effects.spawnConfetti(cx, cy, { count: 40 });
              effects.spawnFloatingText(cx, cy, `+${reward} pólen`, { color: "#fbe27a", icon: "zap" });
              game.applyHouseSnapshot({ pollen: game.stats.pollen + reward });
            }
          }}
          onClose={() => setShowStreak(false)}
        />
        <MiniGameModal
          visible={showMiniGame}
          onClose={() => setShowMiniGame(false)}
          onFinish={(pollenEarned, hits) => {
            if (pollenEarned > 0) {
              game.applyHouseSnapshot({ pollen: game.stats.pollen + pollenEarned, xp: game.stats.xp + hits * 2 });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              const cx = width / 2;
              const cy = canvasHeight / 2;
              effects.spawnConfetti(cx, cy, { count: 30, durationMs: 1800 });
              effects.spawnFloatingText(cx, cy, `+${pollenEarned} pólen`, { color: "#fbe27a", icon: "zap", durationMs: 2000 });
            }
          }}
        />
        <ShopModal
          visible={showShop}
          onClose={() => setShowShop(false)}
          pollen={game.stats.pollen}
          level={game.stats.level}
          inventory={inventory}
          onBuy={(item) => {
            const result = inventory.buy(item, game.stats.pollen);
            if (!result.ok) {
              setDialog({ speaker: "Loja", message: result.reason ?? "Não foi possível comprar." });
              return;
            }
            // desconta polen + equipa automatico
            game.applyHouseSnapshot({ pollen: result.remainingPollen ?? game.stats.pollen });
            inventory.equip(item.id);
            const cx = width / 2;
            const cy = canvasHeight / 2;
            effects.spawnConfetti(cx, cy, { count: 24 });
            effects.spawnFloatingText(cx, cy, `${item.name} desbloqueado!`, { color: "#fbe27a", icon: "shopping-bag", durationMs: 1800 });
          }}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

function timeBadgeIcon(t: ReturnType<typeof getTimeOfDay>): keyof typeof Feather.glyphMap {
  if (t === "dawn") return "sunrise";
  if (t === "morning") return "sun";
  if (t === "noon") return "sun";
  if (t === "afternoon") return "sun";
  if (t === "dusk") return "sunset";
  return "moon";
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: "#160f04" },
    container: { flex: 1, backgroundColor: "#160f04" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.secondary,
    },
    title: { color: colors.foreground, fontFamily: FONTS.display, fontSize: 20, fontWeight: "900" },
    subtitleRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
    subtitle: { color: colors.muted, fontFamily: FONTS.sans, fontSize: 11 },
    canvasShell: { flex: 1, backgroundColor: "#160f04" },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(22, 15, 4, 0.6)",
    },
  });
}
