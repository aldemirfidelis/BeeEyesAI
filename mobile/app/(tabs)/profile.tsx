import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { queryClient } from "../../lib/queryClient";
import XPProgress from "../../components/XPProgress";
import { FONTS, getThemeColors } from "../../lib/theme";
import { useUIStore } from "../../stores/uiStore";

function xpForLevel(level: number) {
  return level * 100 + (level - 1) * 50;
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const themeMode = useUIStore((state) => state.themeMode);
  const profileImageUri = useUIStore((state) => state.profileImageUri);
  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me").then((r) => r.data),
    staleTime: 30 * 1000,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => api.get("/api/achievements").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: missions = [] } = useQuery({
    queryKey: ["missions"],
    queryFn: () => api.get("/api/missions").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

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

  const completedMissions = missions.filter((m: any) => m.completed).length;
  const profile = me || user;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push("/settings" as never)}>
            <Text style={styles.settingsButtonText}>Configuracoes</Text>
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
          <Text style={styles.username}>{profile?.username}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Nivel {profile?.level ?? 1}</Text>
          </View>
        </View>

        {me && (
          <View style={styles.section}>
            <XPProgress currentXP={me.xp} level={me.level} xpToNextLevel={xpForLevel(me.level)} />
          </View>
        )}

        <View style={styles.statsGrid}>
          <StatCard emoji="🎯" label="Missoes" value={completedMissions.toString()} colors={colors} />
          <StatCard emoji="🔥" label="Streak" value={`${profile?.currentStreak ?? 0} dias`} colors={colors} />
          <StatCard emoji="💬" label="Mensagens" value={(me?.totalMessagesCount ?? 0).toString()} colors={colors} />
          <StatCard emoji="🏆" label="Conquistas" value={achievements.length.toString()} colors={colors} />
        </View>

        {achievements.length > 0 && (
          <View style={styles.achievementsSection}>
            <Text style={styles.sectionTitle}>Conquistas</Text>
            {achievements.map((a: any) => (
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
    </SafeAreaView>
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
    topActions: { alignItems: "flex-end" },
    settingsButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    settingsButtonText: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.foreground },
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
