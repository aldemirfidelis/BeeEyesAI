import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Alert,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { queryClient } from "../../lib/queryClient";
import XPProgress from "../../components/XPProgress";
function xpForLevel(level: number) { return level * 100 + (level - 1) * 50; }
import { COLORS, FONTS } from "../../lib/theme";

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

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
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.username?.[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <Text style={styles.username}>{profile?.username}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Nível {profile?.level ?? 1}</Text>
          </View>
        </View>

        {/* XP Progress */}
        {me && (
          <View style={styles.section}>
            <XPProgress
              currentXP={me.xp}
              level={me.level}
              xpToNextLevel={xpForLevel(me.level)}
            />
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard emoji="🎯" label="Missões" value={completedMissions.toString()} />
          <StatCard emoji="🔥" label="Streak" value={`${profile?.currentStreak ?? 0} dias`} />
          <StatCard emoji="💬" label="Mensagens" value={(me?.totalMessagesCount ?? 0).toString()} />
          <StatCard emoji="🏆" label="Conquistas" value={achievements.length.toString()} />
        </View>

        {/* Achievements */}
        {achievements.length > 0 && (
          <View style={styles.achievementsSection}>
            <Text style={styles.sectionTitle}>🏆 Conquistas</Text>
            {achievements.map((a: any) => (
              <View key={a.id} style={styles.achievementRow}>
                <View style={styles.achievementIcon}>
                  <Text style={styles.achievementEmoji}>🎖️</Text>
                </View>
                <View>
                  <Text style={styles.achievementTitle}>{a.title}</Text>
                  <Text style={styles.achievementDesc}>{a.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 16 },
  avatarSection: { alignItems: "center", paddingVertical: 8, gap: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: FONTS.display, fontSize: 36, fontWeight: "700", color: "#1A1A1A" },
  username: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "700", color: COLORS.foreground },
  levelBadge: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  levelText: { fontFamily: FONTS.mono, fontSize: 13, fontWeight: "700", color: COLORS.foreground },
  section: {
    backgroundColor: COLORS.card,
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
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  statEmoji: { fontSize: 28 },
  statValue: { fontFamily: FONTS.mono, fontWeight: "700", fontSize: 18, color: COLORS.foreground },
  statLabel: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted },
  achievementsSection: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 16, color: COLORS.foreground },
  achievementRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  achievementEmoji: { fontSize: 20 },
  achievementTitle: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 14, color: COLORS.foreground },
  achievementDesc: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted },
  logoutButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.destructive + "66",
    marginTop: 8,
  },
  logoutText: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 15, color: COLORS.destructive },
});
