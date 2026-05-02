import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api } from "@mobile/lib/api";
import type { NotificationCenterItem, ScoreSnapshot } from "@mobile/lib/intelligence";
import { useAuthStore } from "@mobile/stores/authStore";
import { queryClient } from "@mobile/lib/queryClient";
import XPProgress from "@mobile/components/XPProgress";
import { MedalGrid, MedalDetail } from "@mobile/components/MedalBadge";
import type { MedalSpec } from "@mobile/lib/medals";
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

  const [showTestimonialModal, setShowTestimonialModal] = React.useState(false);
  const [selectedFriend, setSelectedFriend] = React.useState<{ id: number; displayName: string; username: string } | null>(null);
  const [testimonialText, setTestimonialText] = React.useState("");
  const [sendingTestimonial, setSendingTestimonial] = React.useState(false);
  const [selectedMedal, setSelectedMedal] = React.useState<MedalSpec | null>(null);

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

  const { data: testimonials = [] } = useQuery({
    queryKey: ["testimonials", profile?.id],
    queryFn: () => api.get(`/api/users/${profile!.id}/testimonials`).then((r) => r.data),
    enabled: Boolean(profile?.id),
    staleTime: 60 * 1000,
    retry: false,
  });
  const profile = me || user;

  const { data: score } = useQuery<ScoreSnapshot>({
    queryKey: ["score"],
    queryFn: () => api.get("/api/score").then((r) => r.data),
    staleTime: 30 * 1000,
    retry: false,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: () => api.get("/api/friends").then((r) => r.data),
    staleTime: 60 * 1000,
    retry: false,
  });
  const safeFriends = Array.isArray(friends) ? friends : [];

  const { data: notificationCenter = [] } = useQuery<NotificationCenterItem[]>({
    queryKey: ["notifications-center"],
    queryFn: () => api.get("/api/notifications/center").then((r) => r.data),
    staleTime: 45 * 1000,
    retry: false,
  });
  const safeNotificationCenter = Array.isArray(notificationCenter) ? notificationCenter : [];
  const safeAchievements = Array.isArray(achievements) ? achievements : [];
  const safeTestimonials = Array.isArray(testimonials) ? testimonials : [];
  const unreadNotificationCount = safeNotificationCenter.filter((item) => !item.read).length;

  async function handleSendTestimonial() {
    if (!selectedFriend || !testimonialText.trim()) return;
    setSendingTestimonial(true);
    try {
      await api.post(`/api/users/${selectedFriend.id}/testimonials`, { content: testimonialText.trim() });
      Alert.alert("Depoimento enviado!", `Seu depoimento para ${selectedFriend.displayName || selectedFriend.username} foi publicado.`);
      setShowTestimonialModal(false);
      setSelectedFriend(null);
      setTestimonialText("");
    } catch {
      Alert.alert("Erro", "Não foi possível enviar o depoimento. Tente novamente.");
    } finally {
      setSendingTestimonial(false);
    }
  }

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
          {profile?.bio ? <Text style={styles.profileBio}>{profile.bio}</Text> : null}
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
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Ritmo atual</Text>
                <Text style={styles.scoreSummary}>{score.summary}</Text>
              </View>
              <View style={styles.scoreChip}>
                <Text style={styles.scoreChipValue}>{score.focusScore}</Text>
                <Text style={styles.scoreChipLabel}>{score.scoreTone}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          <StatCard emoji="🔥" label="Streak" value={`${profile?.currentStreak ?? 0} dias`} colors={colors} />
          <StatCard emoji="🏆" label="Medalhas" value={safeAchievements.length.toString()} colors={colors} />
        </View>

        {/* ── Medalhas ── */}
        <View style={styles.medalsSection}>
          <View style={styles.medalsSectionHeader}>
            <Text style={styles.sectionTitle}>Medalhas</Text>
            <Text style={styles.medalsCount}>
              {safeAchievements.length} / 21 conquistadas
            </Text>
          </View>
          <MedalGrid
            earnedTypes={safeAchievements.map((a: any) => a.type)}
            onPress={setSelectedMedal}
          />
        </View>

        {/* Modal de detalhes da medalha */}
        <Modal
          visible={Boolean(selectedMedal)}
          animationType="slide"
          transparent
          presentationStyle="overFullScreen"
          onRequestClose={() => setSelectedMedal(null)}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
            activeOpacity={1}
            onPress={() => setSelectedMedal(null)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40, gap: 0 }}
            >
              <View style={{ width: 36, height: 4, backgroundColor: "#E0E0E0", borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />
              {selectedMedal && (
                <MedalDetail
                  spec={selectedMedal}
                  earned={safeAchievements.some((a: any) => a.type === selectedMedal.type)}
                  unlockedAt={safeAchievements.find((a: any) => a.type === selectedMedal.type)?.unlockedAt}
                />
              )}
              <TouchableOpacity
                onPress={() => setSelectedMedal(null)}
                style={{ marginTop: 24, backgroundColor: "#F5C842", borderRadius: 16, paddingVertical: 14, alignItems: "center" }}
              >
                <Text style={{ fontFamily: FONTS.sans, fontWeight: "700", fontSize: 15, color: "#1A1A1A" }}>Fechar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <View style={styles.achievementsSection}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={styles.sectionTitle}>Depoimentos</Text>
            <TouchableOpacity
              onPress={() => setShowTestimonialModal(true)}
              style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
            >
              <Text style={{ fontSize: 12, fontFamily: FONTS.sans, fontWeight: "700", color: "#1a1a1a" }}>+ Escrever</Text>
            </TouchableOpacity>
          </View>
          {safeTestimonials.length === 0 ? (
            <Text style={styles.achievementDesc}>Seus amigos ainda nao escreveram depoimentos.</Text>
          ) : safeTestimonials.map((item: any) => (
            <View key={item.id} style={styles.testimonialBox}>
              <Text style={styles.achievementDesc}>{item.content}</Text>
              <Text style={styles.testimonialAuthor}>por {item.authorDisplayName || item.authorUsername}</Text>
            </View>
          ))}
        </View>

        {/* Modal de depoimento */}
        <Modal visible={showTestimonialModal} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setShowTestimonialModal(false)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setShowTestimonialModal(false)}>
            <TouchableOpacity activeOpacity={1} style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
              <View style={{ width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }} />
              <Text style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: "800", color: colors.foreground, marginBottom: 16 }}>Escrever depoimento</Text>

              {!selectedFriend ? (
                <>
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: colors.muted, marginBottom: 12 }}>Selecione um amigo:</Text>
                  <FlatList
                    data={safeFriends}
                    keyExtractor={(item: any) => String(item.id)}
                    style={{ maxHeight: 220 }}
                    renderItem={({ item }: { item: any }) => (
                      <TouchableOpacity
                        onPress={() => setSelectedFriend({ id: item.id, displayName: item.displayName, username: item.username })}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                      >
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                          <Text style={{ fontWeight: "700", color: "#1a1a1a" }}>{(item.displayName || item.username || "?")[0].toUpperCase()}</Text>
                        </View>
                        <Text style={{ fontFamily: FONTS.sans, fontSize: 14, color: colors.foreground }}>{item.displayName || item.username}</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={{ color: colors.muted, fontSize: 13 }}>Nenhum amigo encontrado.</Text>}
                  />
                </>
              ) : (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                    <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: colors.muted }}>Para: </Text>
                    <Text style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.foreground }}>{selectedFriend.displayName || selectedFriend.username}</Text>
                    <TouchableOpacity onPress={() => setSelectedFriend(null)} style={{ marginLeft: 8 }}>
                      <Text style={{ fontSize: 12, color: colors.muted }}>trocar</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={testimonialText}
                    onChangeText={setTestimonialText}
                    placeholder="Escreva um depoimento sincero..."
                    placeholderTextColor={colors.muted}
                    multiline
                    maxLength={500}
                    style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, minHeight: 100, fontFamily: FONTS.sans, fontSize: 14, color: colors.foreground, textAlignVertical: "top", marginBottom: 16 }}
                  />
                  <TouchableOpacity
                    onPress={handleSendTestimonial}
                    disabled={!testimonialText.trim() || sendingTestimonial}
                    style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, alignItems: "center", opacity: (!testimonialText.trim() || sendingTestimonial) ? 0.5 : 1 }}
                  >
                    <Text style={{ fontFamily: FONTS.sans, fontWeight: "700", fontSize: 15, color: "#1a1a1a" }}>{sendingTestimonial ? "Enviando..." : "Publicar depoimento"}</Text>
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

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
    profileBio: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, color: colors.foreground, textAlign: "center", paddingHorizontal: 18 },
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
    scoreHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
    scoreSummary: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 2 },
    scoreChip: { minWidth: 78, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.secondary, alignItems: "center", gap: 2 },
    scoreChipValue: { fontFamily: FONTS.display, fontSize: 26, fontWeight: "800", color: colors.foreground },
    scoreChipLabel: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.primaryDark, textTransform: "uppercase" },
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
    medalsSection: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    medalsSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    medalsCount: { fontFamily: FONTS.mono, fontSize: 12, fontWeight: "700", color: colors.primaryDark },
    sectionTitle: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 16, color: colors.foreground },
    testimonialBox: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12, gap: 6 },
    testimonialAuthor: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.primaryDark },
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

