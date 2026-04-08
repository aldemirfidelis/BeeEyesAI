import { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet,
  ScrollView, ActivityIndicator, TouchableOpacity, Alert,
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

type TabKey = "bee" | "user";

export default function MissionsScreen() {
  const insets = useSafeAreaInsets();
  const themeMode = useUIStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<TabKey>("bee");

  const { missions, isLoading, seedMissions, completeMission, deleteMission } = useMissions();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me").then((r) => r.data),
    staleTime: 30 * 1000,
  });

  useEffect(() => { seedMissions.mutate(); }, []);

  const level = me?.level ?? 1;
  const xp = me?.xp ?? 0;
  const xpNeeded = xpForLevel(level);
  const progress = Math.min(xp / xpNeeded, 1);

  const systemMissions = missions.filter((m: any) => m.type === "system");
  const userMissions   = missions.filter((m: any) => m.type === "user");

  const byTier: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const m of systemMissions) {
    const t = m.tier ?? 1;
    if (byTier[t]) byTier[t].push(m);
  }

  const totalDone  = systemMissions.filter((m: any) => m.completed).length;
  const totalCount = systemMissions.length;
  const pendingUserMissions = userMissions.filter((m: any) => !m.completed).length;

  const handleDeleteMission = (id: string, title: string) => {
    Alert.alert("Remover missão", `Remover "${title}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => deleteMission.mutate(id) },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Missões 🎯</Text>
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

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "bee" && styles.tabBtnActive]}
          onPress={() => setActiveTab("bee")}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabLabel, activeTab === "bee" && styles.tabLabelActive]}>
            🐝 Missões da Bee
          </Text>
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{totalDone}/{totalCount}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "user" && styles.tabBtnActive]}
          onPress={() => setActiveTab("user")}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabLabel, activeTab === "user" && styles.tabLabelActive]}>
            ⭐ Missões do Usuário
          </Text>
          {pendingUserMissions > 0 && (
            <View style={styles.tabPill}>
              <Text style={styles.tabPillText}>{pendingUserMissions}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Missões da Bee ──────────────────────────── */}
      {activeTab === "bee" && (
        <>
          {/* Unlocked features */}
          {Object.entries(LEVEL_UNLOCKS)
            .filter(([lvl]) => Number(lvl) <= level)
            .map(([lvl, info]) => (
              <View key={lvl} style={styles.unlockedBanner}>
                <Text style={styles.unlockedIcon}>{info.icon}</Text>
                <Text style={styles.unlockedLabel}>{info.label}</Text>
              </View>
            ))}

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
        </>
      )}

      {/* ── Missões do Usuário ──────────────────────── */}
      {activeTab === "user" && (
        <>
          <View style={styles.userMissionsHint}>
            <Text style={styles.userMissionsHintText}>
              💡 Recomendações personalizadas da Bee com base nas suas conversas e hábitos.
            </Text>
          </View>

          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primaryDark} />
          ) : userMissions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🐝</Text>
              <Text style={styles.emptyTitle}>Nenhuma recomendação ainda.</Text>
              <Text style={styles.emptyDesc}>
                Converse com a Bee para ela criar missões para você!
              </Text>
            </View>
          ) : (
            <View style={styles.tierSection}>
              {userMissions.map((m: any) => (
                <View
                  key={m.id}
                  style={[styles.missionRow, m.completed && styles.missionRowDone]}
                >
                  <TouchableOpacity
                    onPress={() => !m.completed && completeMission.mutate(m.id)}
                    disabled={m.completed}
                    style={[styles.missionCheck, m.completed && styles.missionCheckDone]}
                    activeOpacity={0.7}
                  >
                    {m.completed && <Text style={styles.missionCheckTick}>✓</Text>}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.missionTitle, m.completed && styles.missionTitleDone]}>
                      {m.title}
                    </Text>
                    {m.description ? (
                      <Text style={styles.missionDesc}>{m.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.missionActions}>
                    <View style={[styles.xpBadge, m.completed && styles.xpBadgeDone]}>
                      <Text style={[styles.xpBadgeText, m.completed && styles.xpBadgeTextDone]}>
                        +{m.xpReward} XP
                      </Text>
                    </View>
                    {!m.completed && (
                      <TouchableOpacity
                        onPress={() => handleDeleteMission(m.id, m.title)}
                        style={styles.deleteBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 14 },

    header: { paddingBottom: 4 },
    headerTitle: { fontFamily: FONTS.display, fontSize: 26, fontWeight: "800", color: colors.foreground },

    levelCard: {
      backgroundColor: colors.card,
      borderRadius: 20, padding: 18,
      borderWidth: 1, borderColor: colors.border,
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
    progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primaryDark },

    nextUnlock: {
      backgroundColor: colors.secondary,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    },
    nextUnlockText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },

    /* Tabs */
    tabRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
      padding: 4,
      gap: 4,
    },
    tabBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 9, paddingHorizontal: 6,
      borderRadius: 10, gap: 6,
    },
    tabBtnActive: { backgroundColor: colors.primaryDark + "22" },
    tabLabel: {
      fontFamily: FONTS.sans, fontSize: 12, fontWeight: "600",
      color: colors.muted, textAlign: "center",
    },
    tabLabelActive: { color: colors.primaryDark },
    tabBadge: {
      backgroundColor: colors.secondary,
      borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    },
    tabBadgeText: { fontFamily: FONTS.mono, fontSize: 10, color: colors.muted, fontWeight: "700" },
    tabPill: {
      backgroundColor: colors.primaryDark,
      borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    },
    tabPillText: { fontFamily: FONTS.mono, fontSize: 10, color: "#1A1A1A", fontWeight: "900" },

    /* Unlocked banners */
    unlockedBanner: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: "#10B98115",
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: "#10B98130",
    },
    unlockedIcon: { fontSize: 20 },
    unlockedLabel: { fontFamily: FONTS.sans, fontSize: 13, color: "#10B981", fontWeight: "600", flex: 1 },

    /* User missions hint */
    userMissionsHint: {
      backgroundColor: colors.secondary,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    },
    userMissionsHintText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, lineHeight: 18 },

    /* Empty state */
    emptyState: { alignItems: "center", paddingVertical: 48, gap: 8 },
    emptyEmoji: { fontSize: 40 },
    emptyTitle: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "700", color: colors.foreground },
    emptyDesc: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted, textAlign: "center", paddingHorizontal: 24 },

    /* Mission tiers / rows */
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
    missionTitleDone: { textDecorationLine: "line-through" as const },
    missionDesc: {
      fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16,
    },
    missionActions: { flexDirection: "row", alignItems: "center", gap: 6 },
    xpBadge: {
      backgroundColor: colors.primaryDark + "22",
      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },
    xpBadgeDone: { backgroundColor: "#10B98120" },
    xpBadgeText: {
      fontFamily: FONTS.mono, fontSize: 11, fontWeight: "700", color: colors.primaryDark,
    },
    xpBadgeTextDone: { color: "#10B981" },
    deleteBtn: {
      width: 26, height: 26, borderRadius: 13,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.secondary,
    },
    deleteBtnText: { fontSize: 11, color: colors.muted, fontWeight: "700" },
  });
}
