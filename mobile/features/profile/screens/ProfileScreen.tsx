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
  KeyboardAvoidingView,
  Platform,
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

  const profile = me || user;

  const { data: testimonials = [] } = useQuery({
    queryKey: ["testimonials", profile?.id],
    queryFn: () => api.get(`/api/users/${profile!.id}/testimonials`).then((r) => r.data),
    enabled: Boolean(profile?.id),
    staleTime: 60 * 1000,
    retry: false,
  });

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

        {/* ── Depoimentos (estilo Orkut) ── */}
        <View style={styles.testimonialsSection}>
          <View style={styles.testimonialsSectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Depoimentos 💬</Text>
              <Text style={styles.testimonialsSub}>
                {safeTestimonials.length > 0
                  ? `${safeTestimonials.length} depoimento${safeTestimonials.length > 1 ? "s" : ""}`
                  : "Nenhum depoimento ainda"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowTestimonialModal(true)}
              style={styles.testimonialWriteBtn}
            >
              <Feather name="edit-3" size={14} color="#1a1a1a" />
              <Text style={styles.testimonialWriteBtnText}>Escrever</Text>
            </TouchableOpacity>
          </View>

          {safeTestimonials.length === 0 ? (
            <View style={styles.testimonialEmpty}>
              <Text style={styles.testimonialEmptyIcon}>💭</Text>
              <Text style={styles.testimonialEmptyText}>
                Seus amigos ainda não escreveram depoimentos.{"\n"}Peça para alguém deixar um!
              </Text>
            </View>
          ) : (
            safeTestimonials.map((item: any) => (
              <View key={item.id} style={styles.testimonialCard}>
                {/* Avatar do autor */}
                <View style={styles.testimonialAuthorRow}>
                  <View style={styles.testimonialAvatar}>
                    <Text style={styles.testimonialAvatarText}>
                      {(item.authorDisplayName || item.authorUsername || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.testimonialAuthorName}>
                      {item.authorDisplayName || item.authorUsername}
                    </Text>
                    {item.createdAt ? (
                      <Text style={styles.testimonialDate}>
                        {new Date(item.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "long", year: "numeric",
                        })}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.testimonialQuoteMark}>
                    <Text style={{ fontSize: 22, color: colors.primary, lineHeight: 26 }}>"</Text>
                  </View>
                </View>
                <Text style={styles.testimonialContent}>{item.content}</Text>
              </View>
            ))
          )}
        </View>

        {/* Modal — escrever depoimento para um amigo */}
        <Modal
          visible={showTestimonialModal}
          animationType="slide"
          transparent
          presentationStyle="overFullScreen"
          onRequestClose={() => { setShowTestimonialModal(false); setSelectedFriend(null); setTestimonialText(""); }}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: "flex-end" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <TouchableOpacity
              style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" }}
              activeOpacity={1}
              onPress={() => { setShowTestimonialModal(false); setSelectedFriend(null); setTestimonialText(""); }}
            />
            <TouchableOpacity activeOpacity={1} style={styles.testimonialModal}>
              <View style={styles.testimonialModalHandle} />

              {!selectedFriend ? (
                /* Step 1 — Escolher amigo */
                <>
                  <Text style={styles.testimonialModalTitle}>Para quem você quer escrever?</Text>
                  <Text style={styles.testimonialModalSub}>Selecione um amigo para deixar um depoimento</Text>
                  <FlatList
                    data={safeFriends}
                    keyExtractor={(item: any) => String(item.id)}
                    style={{ maxHeight: 280, marginTop: 12 }}
                    renderItem={({ item }: { item: any }) => (
                      <TouchableOpacity
                        onPress={() => setSelectedFriend({ id: item.id, displayName: item.displayName, username: item.username })}
                        style={styles.friendPickerRow}
                      >
                        <View style={styles.friendPickerAvatar}>
                          <Text style={styles.friendPickerAvatarText}>
                            {(item.displayName || item.username || "?")[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.friendPickerName}>{item.displayName || item.username}</Text>
                          {item.displayName ? (
                            <Text style={styles.friendPickerHandle}>@{item.username}</Text>
                          ) : null}
                        </View>
                        <Feather name="chevron-right" size={16} color={colors.muted} />
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 24 }}>
                        Nenhum amigo conectado ainda.
                      </Text>
                    }
                  />
                </>
              ) : (
                /* Step 2 — Escrever depoimento */
                <>
                  <View style={styles.testimonialForRow}>
                    <TouchableOpacity onPress={() => setSelectedFriend(null)} style={styles.testimonialBackBtn}>
                      <Feather name="arrow-left" size={16} color={colors.foreground} />
                    </TouchableOpacity>
                    <View style={styles.testimonialForAvatar}>
                      <Text style={styles.testimonialForAvatarText}>
                        {(selectedFriend.displayName || selectedFriend.username)[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.testimonialForLabel}>Escrevendo para</Text>
                      <Text style={styles.testimonialForName}>{selectedFriend.displayName || selectedFriend.username}</Text>
                    </View>
                  </View>

                  <Text style={styles.testimonialModalTitle}>Seu depoimento</Text>
                  <TextInput
                    value={testimonialText}
                    onChangeText={setTestimonialText}
                    placeholder={`Escreva o que você pensa sobre ${selectedFriend.displayName || selectedFriend.username}...`}
                    placeholderTextColor={colors.muted}
                    multiline
                    maxLength={500}
                    autoFocus
                    style={styles.testimonialTextInput}
                  />
                  <View style={styles.testimonialFooter}>
                    <Text style={[styles.testimonialCharCount, testimonialText.length > 450 && { color: colors.destructive }]}>
                      {testimonialText.length}/500
                    </Text>
                    <TouchableOpacity
                      onPress={handleSendTestimonial}
                      disabled={!testimonialText.trim() || sendingTestimonial}
                      style={[styles.testimonialPublishBtn, (!testimonialText.trim() || sendingTestimonial) && { opacity: 0.5 }]}
                    >
                      <Feather name="send" size={14} color="#1a1a1a" />
                      <Text style={styles.testimonialPublishText}>
                        {sendingTestimonial ? "Enviando..." : "Publicar"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
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
    // ── Testimonials ─────────────────────────────────────────────────────────
    testimonialsSection: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    testimonialsSectionHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    },
    testimonialsSub: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
    testimonialWriteBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: colors.primary,
      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    },
    testimonialWriteBtnText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: "#1a1a1a" },
    testimonialEmpty: { alignItems: "center", gap: 8, paddingVertical: 16 },
    testimonialEmptyIcon: { fontSize: 32 },
    testimonialEmptyText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted, textAlign: "center", lineHeight: 19 },
    testimonialCard: {
      backgroundColor: colors.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    testimonialAuthorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    testimonialAvatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    testimonialAvatarText: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
    testimonialAuthorName: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.foreground },
    testimonialDate: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 1 },
    testimonialQuoteMark: {
      width: 30, height: 30, alignItems: "center", justifyContent: "center",
      backgroundColor: colors.primary + "22", borderRadius: 15,
    },
    testimonialContent: {
      fontFamily: FONTS.sans, fontSize: 14, lineHeight: 21,
      color: colors.foreground,
      fontStyle: "italic",
    },
    // Modal
    testimonialModal: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 22, paddingBottom: 40, gap: 12,
    },
    testimonialModalHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
    testimonialModalTitle: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "800", color: colors.foreground },
    testimonialModalSub: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted, marginTop: -4 },
    friendPickerRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    friendPickerAvatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    friendPickerAvatarText: { fontFamily: FONTS.display, fontSize: 20, fontWeight: "700", color: "#1a1a1a" },
    friendPickerName: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "700", color: colors.foreground },
    friendPickerHandle: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    testimonialForRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: colors.secondary,
      borderRadius: 16, padding: 12, marginBottom: 4,
    },
    testimonialBackBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: colors.card,
      alignItems: "center", justifyContent: "center",
    },
    testimonialForAvatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    testimonialForAvatarText: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
    testimonialForLabel: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted },
    testimonialForName: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "700", color: colors.foreground },
    testimonialTextInput: {
      borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 16, padding: 14,
      minHeight: 120, maxHeight: 200,
      fontFamily: FONTS.sans, fontSize: 15, color: colors.foreground,
      textAlignVertical: "top",
      backgroundColor: colors.background,
    },
    testimonialFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    testimonialCharCount: { fontFamily: FONTS.mono, fontSize: 12, color: colors.muted },
    testimonialPublishBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: colors.primary, borderRadius: 18,
      paddingHorizontal: 20, paddingVertical: 11,
    },
    testimonialPublishText: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 14, color: "#1a1a1a" },
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

