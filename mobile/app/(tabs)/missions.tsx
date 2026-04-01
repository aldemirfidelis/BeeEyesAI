import { useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet,
  ScrollView, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useMissions } from "../../hooks/useMissions";
import { FONTS, getThemeColors } from "../../lib/theme";
import { useUIStore } from "../../stores/uiStore";

function xpForLevel(level: number) { return level * 100 + (level - 1) * 50; }

const TIER_META: Record<number, { label: string; emoji: string; color: string }> = {
  1: { label: "Boas-vindas",   emoji: "👋", color: "#F59E0B" },
  2: { label: "Social",        emoji: "🤝", color: "#3B82F6" },
  3: { label: "Conectado",     emoji: "💬", color: "#8B5CF6" },
  4: { label: "Criador",       emoji: "🚀", color: "#10B981" },
};

const LEVEL_UNLOCKS: Record<number, { icon: string; label: string }> = {
  2: { icon: "📨", label: "Mensagens Diretas desbloqueadas" },
  3: { icon: "👻", label: "Visita anônima de perfil desbloqueada" },
  4: { icon: "🏅", label: "Badge exclusiva no perfil desbloqueada" },
  5: { icon: "🤖", label: "Modo IA Avançado desbloqueado" },
};

export default function MissionsScreen() {
  const insets = useSafeAreaInsets();
  const themeMode = useUIStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { missions, isLoading, seedMissions } = useMissions();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me").then((r) => r.data),
    staleTime: 30 * 1000,
  });

  // Seed on mount (idempotent)
  useEffect(() => {
    seedMissions.mutate();
  }, []);

  const level = me?.level ?? 1;
  const xp = me?.xp ?? 0;
  const xpNeeded = xpForLevel(level);
  const progress = Math.min(xp / xpNeeded, 1);

  // Group by tier
  const systemMissions = missions.filter((m: any) => m.type === "system");
  const byTier: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const m of systemMissions) {
    const t = m.tier ?? 1;
    if (byTier[t]) byTier[t].push(m);
  }

  const totalDone = systemMissions.filter((m: any) => m.completed).length;
  const totalCount = systemMissions.length;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Missões 🎯</Text>
        <Text style={styles.headerSub}>
          {totalDone}/{totalCount} concluídas
        </Text>
      </View>

      {/* XP / Level card */}
      {me && (
        <View style={styles.levelCard}>
          <View style={styles.levelRow}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelNum}>{level}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.levelLabel}>Nível {level}</Text>
              <Text style={styles.xpLabel}>{xp} / {xpNeeded} XP</Text>
            </View>
            <Text style={styles.levelPct}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>

          {/* Next unlock hint */}
          {LEVEL_UNLOCKS[level + 1] && (
            <View style={styles.nextUnlock}>
              <Text style={styles.nextUnlockText}>
                {LEVEL_UNLOCKS[level + 1].icon} Próximo desbloqueio no nível {level + 1}:{" "}
                <Text style={{ fontWeight: "700" }}>{LEVEL_UNLOCKS[level + 1].label}</Text>
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Unlocked features */}
      {Object.entries(LEVEL_UNLOCKS)
        .filter(([lvl]) => Number(lvl) <= level)
        .map(([lvl, info]) => (
          <View key={lvl} style={styles.unlockedBanner}>
            <Text style={styles.unlockedIcon}>{info.icon}</Text>
            <Text style={styles.unlockedLabel}>{info.label}</Text>
          </View>
        ))}

      {/* Mission tiers */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primaryDark} />
      ) : (
        [1, 2, 3, 4].map((tier) => {
          const tierMissions = byTier[tier];
          if (!tierMissions || tierMissions.length === 0) return null;
          const meta = TIER_META[tier];
          const allDone = tierMissions.every((m: any) => m.completed);
          return (
            <View key={tier} style={styles.tierSection}>
              <View style={styles.tierHeader}>
                <View style={[styles.tierDot, { backgroundColor: meta.color }]} />
                <Text style={styles.tierLabel}>{meta.emoji} {meta.label}</Text>
                {allDone && <Text style={styles.tierDone}>✓ Completo</Text>}
              </View>
              {tierMissions.map((m: any) => (
                <View
                  key={m.id}
                  style={[styles.missionRow, m.completed && styles.missionRowDone]}
                >
                  <View style={[styles.missionCheck, m.completed && styles.missionCheckDone]}>
                    {m.completed && <Text style={styles.missionCheckTick}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.missionTitle, m.completed && styles.missionTitleDone]}>
                      {m.title}
                    </Text>
                    {m.description ? (
                      <Text style={styles.missionDesc}>{m.description}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.xpBadge, m.completed && styles.xpBadgeDone]}>
                    <Text style={[styles.xpBadgeText, m.completed && styles.xpBadgeTextDone]}>
                      +{m.xpReward} XP
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 14 },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingBottom: 4,
    },
    headerTitle: { fontFamily: FONTS.display, fontSize: 26, fontWeight: "800", color: colors.foreground },
    headerSub: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted },

    levelCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    levelRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    levelBadge: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: colors.primaryDark,
      alignItems: "center", justifyContent: "center",
    },
    levelNum: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "900", color: "#1A1A1A" },
    levelLabel: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "700", color: colors.foreground },
    xpLabel: { fontFamily: FONTS.mono, fontSize: 12, color: colors.muted, marginTop: 2 },
    levelPct: { fontFamily: FONTS.mono, fontSize: 14, fontWeight: "700", color: colors.primaryDark },

    progressTrack: {
      height: 8, borderRadius: 4,
      backgroundColor: colors.secondary,
      overflow: "hidden",
    },
    progressFill: {
      height: 8, borderRadius: 4,
      backgroundColor: colors.primaryDark,
    },

    nextUnlock: {
      backgroundColor: colors.secondary,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    },
    nextUnlockText: {
      fontFamily: FONTS.sans, fontSize: 12, color: colors.muted,
    },

    unlockedBanner: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: "#10B98115",
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: "#10B98130",
    },
    unlockedIcon: { fontSize: 20 },
    unlockedLabel: { fontFamily: FONTS.sans, fontSize: 13, color: "#10B981", fontWeight: "600", flex: 1 },

    tierSection: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      overflow: "hidden",
    },
    tierHeader: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    tierDot: { width: 10, height: 10, borderRadius: 5 },
    tierLabel: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.foreground, flex: 1 },
    tierDone: { fontFamily: FONTS.sans, fontSize: 12, color: "#10B981", fontWeight: "700" },

    missionRow: {
      flexDirection: "row", alignItems: "center",
      gap: 12, paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    missionRowDone: { opacity: 0.55 },
    missionCheck: {
      width: 24, height: 24, borderRadius: 12,
      borderWidth: 2, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },
    missionCheckDone: { backgroundColor: "#10B981", borderColor: "#10B981" },
    missionCheckTick: { color: "#fff", fontSize: 13, fontWeight: "900" },
    missionTitle: {
      fontFamily: FONTS.sans, fontSize: 14, fontWeight: "600", color: colors.foreground,
    },
    missionTitleDone: { textDecorationLine: "line-through" },
    missionDesc: {
      fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16,
    },
    xpBadge: {
      backgroundColor: colors.primaryDark + "22",
      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },
    xpBadgeDone: { backgroundColor: "#10B98120" },
    xpBadgeText: {
      fontFamily: FONTS.mono, fontSize: 11, fontWeight: "700", color: colors.primaryDark,
    },
    xpBadgeTextDone: { color: "#10B981" },
  });
}
