import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api } from "@mobile/lib/api";
import type { NotificationCenterItem, ScoreSnapshot } from "@mobile/lib/intelligence";
import { useAuthStore } from "@mobile/stores/authStore";
import { queryClient } from "@mobile/lib/queryClient";
import XPProgress from "@mobile/components/XPProgress";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";

function xpForLevel(level: number) {
  return level * 100 + (level - 1) * 50;
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const themeMode = useUIStore((state) => state.themeMode);
  const profileImageUri = useUIStore((state) => state.profileImageUri);
  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me").then((r) => r.data),
    staleTime: 30 * 1000,
    retry: false,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => api.get("/api/achievements").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: missions = [] } = useQuery({
    queryKey: ["missions"],
    queryFn: () => api.get("/api/missions").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: score } = useQuery<ScoreSnapshot>({
    queryKey: ["score"],
    queryFn: () => api.get("/api/score").then((r) => r.data),
    staleTime: 30 * 1000,
    retry: false,
  });

  const { data: notificationCenter = [] } = useQuery<NotificationCenterItem[]>({
    queryKey: ["notifications-center"],
    queryFn: () => api.get("/api/notifications/center").then((r) => r.data),
    staleTime: 45 * 1000,
    retry: false,
  });
  const safeNotificationCenter = Array.isArray(notificationCenter) ? notificationCenter : [];
  const safeAchievements = Array.isArray(achievements) ? achievements : [];
  const safeMissions = Array.isArray(missions) ? missions : [];
  const unreadNotificationCount = safeNotificationCenter.filter((item) => !item.read).length;

  async function handleLogout() {
    Alert.alert("Sair", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await logout();
          queryClient.clear();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  const completedMissions = safeMissions.filter((m: any) => m.completed).length;
  const profile = me || user;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/notifications" as never)}>
            <View>
              <Feather name="bell" size={20} color={colors.muted} />
              {unreadNotificationCount > 0 ? (
                <View style={styles.topBadge}>
                  <Text style={styles.topBadgeText}>{Math.min(unreadNotificationCount, 9)}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push("/settings" as never)}>
            <Feather name="settings" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {profile?.username?.[0]?.toUpperCase() ?? "?"}
              </Text>
            )}
          </View>
          <Text style={styles.username}>{profile?.displayName || profile?.username}</Text>
          {profile?.displayName ? <Text style={styles.usernameHandle}>@{profile?.username}</Text> : null}
          {profile?.gender ? <Text style={styles.profileMeta}>Genero: {profile.gender}</Text> : null}
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Nivel {profile?.level ?? 1}</Text>
          </View>
        </View>

        {me && (
          <View style={styles.section}>
            <XPProgress currentXP={me.xp} level={me.level} xpToNextLevel={xpForLevel(me.level)} />
          </View>
        )}

        {score ? (
          <View style={styles.scoreCard}>
            <View style={styles.scoreHeader}>
              <View>
                <Text style={styles.sectionTitle}>Ritmo atual</Text>
                <Text style={styles.scoreSummary}>{score.summary}</Text>
              </View>
              <View style={styles.scoreChip}>
                <Text style={styles.scoreChipValue}>{score.focusScore}</Text>
                <Text style={styles.scoreChipLabel}>{score.scoreTone}</Text>
              </View>
            </View>
            <View style={styles.scoreMetaRow}>
              <Text style={styles.scoreMeta}>{score.consistencyScore}% constancia</Text>
              <Text style={styles.scoreMeta}>{score.disciplineScore}% disciplina</Text>
            </View>
            <Text style={styles.scoreInsight}>{score.insight}</Text>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          <StatCard emoji="🎯" label="Missoes" value={completedMissions.toString()} colors={colors} />
          <StatCard emoji="🔥" label="Streak" value={`${profile?.currentStreak ?? 0} dias`} colors={colors} />
          <StatCard emoji="💬" label="Mensagens" value={(me?.totalMessagesCount ?? 0).toString()} colors={colors} />
          <StatCard emoji="🏆" label="Conquistas" value={safeAchievements.length.toString()} colors={colors} />
        </View>

        {safeAchievements.length > 0 && (
          <View style={styles.achievementsSection}>
            <Text style={styles.sectionTitle}>Conquistas</Text>
            {safeAchievements.map((a: any) => (
              <View key={a.id} style={styles.achievementRow}>
                <View style={styles.achievementIcon}>
                  <Text style={styles.achievementEmoji}>🏅</Text>
                </View>
                <View>
                  <Text style={styles.achievementTitle}>{a.title}</Text>
                  <Text style={styles.achievementDesc}>{a.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function StatCard({
  emoji,
  label,
  value,
  colors,
}: {
  emoji: string;
  label: string;
  value: string;
  colors: ReturnType<typeof getThemeColors>;
}) {
  const styles = makeStyles(colors);

  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 16 },
    topActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
    iconButton: {
      padding: 8,
      position: "relative",
    },
    settingsButton: {
      padding: 8,
    },
    topBadge: {
      position: "absolute",
      top: -6,
      right: -8,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.destructive,
    },
    topBadgeText: { fontFamily: FONTS.mono, fontSize: 10, fontWeight: "800", color: "#fff" },
    avatarSection: { alignItems: "center", paddingVertical: 8, gap: 8 },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: { width: "100%", height: "100%" },
    avatarText: { fontFamily: FONTS.display, fontSize: 36, fontWeight: "700", color: "#1A1A1A" },
    username: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "700", color: colors.foreground },
    usernameHandle: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted },
    profileMeta: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    levelBadge: {
      backgroundColor: colors.secondary,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    levelText: { fontFamily: FONTS.mono, fontSize: 13, fontWeight: "700", color: colors.foreground },
    section: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
    },
    scoreCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scoreHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
    scoreSummary: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 2, maxWidth: 220 },
    scoreChip: { minWidth: 78, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.secondary, alignItems: "center", gap: 2 },
    scoreChipValue: { fontFamily: FONTS.display, fontSize: 26, fontWeight: "800", color: colors.foreground },
    scoreChipLabel: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.primaryDark, textTransform: "uppercase" },
    scoreMetaRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    scoreMeta: { fontFamily: FONTS.mono, fontSize: 12, fontWeight: "700", color: colors.foreground },
    scoreInsight: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, color: colors.foreground },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    statCard: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
      gap: 4,
    },
    statEmoji: { fontSize: 28 },
    statValue: { fontFamily: FONTS.mono, fontWeight: "700", fontSize: 18, color: colors.foreground },
    statLabel: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    achievementsSection: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      gap: 12,
    },
    sectionTitle: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 16, color: colors.foreground },
    achievementRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    achievementIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    achievementEmoji: { fontSize: 20 },
    achievementTitle: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 14, color: colors.foreground },
    achievementDesc: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    logoutButton: {
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.destructive + "66",
      marginTop: 8,
      backgroundColor: colors.card,
    },
    logoutText: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 15, color: colors.destructive },
  });
}

