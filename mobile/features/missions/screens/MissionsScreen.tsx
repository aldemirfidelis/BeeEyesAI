import { useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet,
  ScrollView, ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@mobile/lib/api";
import { useMissions } from "@mobile/hooks/useMissions";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";

function xpForLevel(level: number) { return level * 100 + (level - 1) * 50; }

const TIER_META: Record<number, { labelKey: string; emoji: string; color: string }> = {
  1: { labelKey: "missions_tier_welcome", emoji: "👋", color: "#F59E0B" },
  2: { labelKey: "missions_tier_social",  emoji: "🤝", color: "#3B82F6" },
  3: { labelKey: "missions_tier_connected", emoji: "💬", color: "#8B5CF6" },
  4: { labelKey: "missions_tier_creator", emoji: "🚀", color: "#10B981" },
};

const LEVEL_UNLOCKS: Record<number, { icon: string; labelKey: string }> = {
  2: { icon: "📨", labelKey: "missions_unlock_dm" },
  3: { icon: "👻", labelKey: "missions_unlock_anon" },
  4: { icon: "🏅", labelKey: "missions_unlock_badge" },
  5: { icon: "🤖", labelKey: "missions_unlock_ai" },
};

export default function MissionsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const themeMode = useUIStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { missions, isLoading, seedMissions, refreshDailyMissions, completeMission } = useMissions();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me").then((r) => r.data),
    staleTime: 30 * 1000,
    retry: false,
  });

  const { data: weeklyReport } = useQuery({
    queryKey: ["weekly-report"],
    queryFn: () => api.get("/api/reports/weekly").then((r) => r.data),
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: dailyContext } = useQuery<{
    label: string; reason: string; tip: string; moodAvg: number | null;
  }>({
    queryKey: ["daily-context"],
    queryFn: () => api.get("/api/missions/daily-context").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Seed on mount (idempotent)
  useEffect(() => {
    seedMissions.mutate();
    refreshDailyMissions.mutate();
  }, []);

  const level = me?.level ?? 1;
  const xp = me?.xp ?? 0;
  const xpNeeded = xpForLevel(level);
  const progress = Math.min(xp / xpNeeded, 1);

  const dailyMissions  = missions.filter((m: any) => m.type === "ai_daily");
  const bonusMissions  = missions.filter((m: any) => m.type === "ai_bonus");
  const systemMissions = missions.filter((m: any) => m.type === "system");
  const byTier: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const m of systemMissions) {
    const t = m.tier ?? 1;
    if (byTier[t]) byTier[t].push(m);
  }

  const pendingBonus = bonusMissions.filter((m: any) => !m.completed).length;
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
        <Text style={styles.headerTitle}>{t("missions_title")}</Text>
        <Text style={styles.headerSub}>
          {totalDone}/{totalCount} {t("missions_completed")}
        </Text>
      </View>

      {/* Contexto adaptativo da Bee */}
      {dailyContext && (
        <View style={styles.contextCard}>
          <View style={styles.contextHeader}>
            <Text style={styles.contextBee}>🐝</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.contextLabel}>{dailyContext.label}</Text>
              <Text style={styles.contextReason}>{dailyContext.reason}</Text>
            </View>
            {typeof dailyContext.moodAvg === "number" && Number.isFinite(dailyContext.moodAvg) && (
              <View style={styles.moodBadge}>
                <Text style={styles.moodBadgeText}>{dailyContext.moodAvg.toFixed(1)}</Text>
                <Text style={styles.moodBadgeSub}>humor</Text>
              </View>
            )}
          </View>
          <Text style={styles.contextTip}>💡 {dailyContext.tip}</Text>
        </View>
      )}

      {/* XP / Level card */}
      {me && (
        <View style={styles.levelCard}>
          <View style={styles.levelRow}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelNum}>{level}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.levelLabel}>{t("missions_level")} {level}</Text>
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
                {LEVEL_UNLOCKS[level + 1].icon} {t("missions_next_unlock_prefix")} {level + 1}:{" "}
                <Text style={{ fontWeight: "700" }}>{t(LEVEL_UNLOCKS[level + 1].labelKey as any)}</Text>
              </Text>
            </View>
          )}
        </View>
      )}


      {weeklyReport ? (
        <View style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitle}>{t("missions_weekly_report")}</Text>
            <View style={styles.reportScores}>
              <Text style={styles.reportScore}>{weeklyReport.consistencyScore}{t("missions_consistency")}</Text>
              <Text style={styles.reportScore}>{weeklyReport.disciplineScore}{t("missions_discipline")}</Text>
            </View>
          </View>
          <Text style={styles.reportSummary}>{weeklyReport.summary}</Text>
          <Text style={styles.reportLine}><Text style={styles.reportLabel}>{t("missions_strong_point")}</Text> {weeklyReport.positive}</Text>
          <Text style={styles.reportLine}><Text style={styles.reportLabel}>{t("missions_attention")}</Text> {weeklyReport.attention}</Text>
          <Text style={styles.reportLine}><Text style={styles.reportLabel}>{t("missions_next_step")}</Text> {weeklyReport.nextAction}</Text>
        </View>
      ) : null}

      {/* Missões bônus — aparecem após concluir todas as outras */}
      {bonusMissions.length > 0 ? (
        <View style={styles.bonusSection}>
          <View style={styles.bonusHeader}>
            <Text style={styles.bonusTitle}>{t("missions_bonus_title")}</Text>
            <Text style={styles.bonusHint}>{pendingBonus} {pendingBonus !== 1 ? t("missions_bonus_pending_other") : t("missions_bonus_pending_one")} • {t("missions_bonus_xp")}</Text>
          </View>
          {bonusMissions.map((m: any) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.bonusMissionRow, m.completed && styles.missionRowDone]}
              disabled={m.completed || completeMission.isPending}
              onPress={() => !m.completed && completeMission.mutate(m.id)}
            >
              <View style={[styles.missionCheck, m.completed && styles.missionCheckDone]}>
                {m.completed && <Text style={styles.missionCheckTick}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.missionTitle, m.completed && styles.missionTitleDone]}>{m.title}</Text>
                {m.description ? <Text style={styles.missionDesc}>{m.description}</Text> : null}
              </View>
              <View style={[styles.xpBadgeBonus, m.completed && styles.xpBadgeDone]}>
                <Text style={[styles.xpBadgeText, m.completed && styles.xpBadgeTextDone]}>+{m.xpReward} XP</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {dailyMissions.length > 0 ? (
        <View style={styles.dailySection}>
          <View style={styles.dailyHeader}>
            <Text style={styles.dailyTitle}>{t("missions_daily_title")}</Text>
            <Text style={styles.dailyHint}>{t("missions_daily_hint")}</Text>
          </View>
          {dailyMissions.map((mission: any) => (
            <TouchableOpacity
              key={mission.id}
              style={[styles.dailyMissionRow, mission.completed && styles.missionRowDone]}
              disabled={mission.completed || completeMission.isPending}
              onPress={() => completeMission.mutate(mission.id)}
            >
              <View style={[styles.missionCheck, mission.completed && styles.missionCheckDone]}>
                {mission.completed && <Text style={styles.missionCheckTick}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.missionTitle, mission.completed && styles.missionTitleDone]}>{mission.title}</Text>
                {mission.description ? <Text style={styles.missionDesc}>{mission.description}</Text> : null}
              </View>
              <View style={[styles.xpBadge, mission.completed && styles.xpBadgeDone]}>
                <Text style={[styles.xpBadgeText, mission.completed && styles.xpBadgeTextDone]}>+{mission.xpReward} XP</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Unlocked features */}
      {Object.entries(LEVEL_UNLOCKS)
        .filter(([lvl]) => Number(lvl) <= level)
        .map(([lvl, info]) => (
          <View key={lvl} style={styles.unlockedBanner}>
            <Text style={styles.unlockedIcon}>{info.icon}</Text>
            <Text style={styles.unlockedLabel}>{t(info.labelKey as any)}</Text>
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
                <Text style={styles.tierLabel}>{meta.emoji} {t(meta.labelKey as any)}</Text>
                {allDone && <Text style={styles.tierDone}>{t("missions_tier_done")}</Text>}
              </View>
              {tierMissions.map((m: any) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.missionRow, m.completed && styles.missionRowDone]}
                  disabled={m.completed || completeMission.isPending}
                  onPress={() => !m.completed && completeMission.mutate(m.id)}
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
                </TouchableOpacity>
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

    contextCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.primary + "55",
      gap: 8,
    },
    contextHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    contextBee: { fontSize: 22, lineHeight: 28 },
    contextLabel: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.primary },
    contextReason: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 1 },
    contextTip: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, lineHeight: 18 },
    moodBadge: {
      backgroundColor: colors.primary + "22",
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignItems: "center",
      minWidth: 44,
    },
    moodBadgeText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: colors.primary },
    moodBadgeSub: { fontFamily: FONTS.sans, fontSize: 9, color: colors.muted, textTransform: "uppercase" },

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

    reportCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    reportHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    reportTitle: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: colors.foreground },
    reportScores: { alignItems: "flex-end", gap: 2 },
    reportScore: { fontFamily: FONTS.mono, fontSize: 11, color: colors.primaryDark, fontWeight: "700" },
    reportSummary: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, lineHeight: 19 },
    reportLine: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, lineHeight: 18 },
    reportLabel: { color: colors.foreground, fontWeight: "700" },

    bonusSection: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.primary + "66",
      overflow: "hidden",
    },
    bonusHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.primary + "18",
      borderBottomWidth: 1,
      borderBottomColor: colors.primary + "33",
    },
    bonusTitle: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "800", color: colors.primaryDark },
    bonusHint:  { fontFamily: FONTS.sans, fontSize: 11, color: colors.primaryDark, opacity: 0.8 },
    bonusMissionRow: {
      flexDirection: "row", alignItems: "center",
      gap: 12, paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    xpBadgeBonus: {
      backgroundColor: colors.primary + "33",
      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },

    dailySection: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    dailyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dailyTitle: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "800", color: colors.foreground },
    dailyHint: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted },
    dailyMissionRow: {
      flexDirection: "row", alignItems: "center",
      gap: 12, paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },

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
