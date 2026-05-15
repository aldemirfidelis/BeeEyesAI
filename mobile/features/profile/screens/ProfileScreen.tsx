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
import { MedalGrid, MedalDetail } from "@mobile/components/MedalBadge";
import { UserAvatar } from "@mobile/components/UserAvatar";
import { MEDAL_CATALOG, TIER_COLORS, type MedalSpec, type MedalTier } from "@mobile/lib/medals";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const themeMode = useUIStore((state) => state.themeMode);
  const profileImageUri = useUIStore((state) => state.profileImageUri);
  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const [showTestimonialModal, setShowTestimonialModal] = React.useState(false);
  const [selectedFriend, setSelectedFriend] = React.useState<{ id: number; displayName: string; username: string; avatarUrl?: string | null } | null>(null);
  const [testimonialText, setTestimonialText] = React.useState("");
  const [sendingTestimonial, setSendingTestimonial] = React.useState(false);
  const [selectedMedal, setSelectedMedal] = React.useState<MedalSpec | null>(null);
  const [medalFilter, setMedalFilter] = React.useState<"all" | "earned" | "locked" | MedalTier>("all");

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
          <TouchableOpacity
            onPress={() => router.push("/settings" as never)}
            activeOpacity={0.85}
            accessibilityLabel="Trocar foto de perfil"
            style={styles.avatar}
          >
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {profile?.username?.[0]?.toUpperCase() ?? "?"}
              </Text>
            )}
            <View style={styles.avatarEditOverlay}>
              <Feather name="camera" size={12} color="#1A1A1A" />
            </View>
            {profile?.level ? (
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>Nv {profile.level}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>{profile?.displayName || profile?.username}</Text>
            {typeof profile?.xp === "number" ? (
              <View style={styles.xpChip}>
                <Text style={styles.xpChipText}>{profile.xp} XP</Text>
              </View>
            ) : null}
          </View>
          {profile?.displayName ? <Text style={styles.usernameHandle}>@{profile?.username}</Text> : null}
          {profile?.bio ? (
            <Text style={styles.profileBio}>{profile.bio}</Text>
          ) : (
            <Text style={styles.profileBioEmpty}>Adicione uma bio nas configurações ✨</Text>
          )}

          {/* Mini stats */}
          <View style={styles.miniStatsRow}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{safeAchievements.length}</Text>
              <Text style={styles.miniStatLabel}>Medalhas</Text>
            </View>
            <View style={styles.miniStatDivider} />
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{safeFriends.length}</Text>
              <Text style={styles.miniStatLabel}>Amigos</Text>
            </View>
            <View style={styles.miniStatDivider} />
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{profile?.currentStreak ?? 0}</Text>
              <Text style={styles.miniStatLabel}>Dias ativos</Text>
            </View>
          </View>

          {/* Profile completeness */}
          {(() => {
            const checks = [
              Boolean(profile?.displayName),
              Boolean(profileImageUri),
              Boolean(profile?.bio && profile.bio.trim().length >= 12),
              Boolean(profile?.language),
              Boolean(profile?.email),
            ];
            const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
            return (
              <View style={styles.completenessWrap}>
                <View style={styles.completenessHeader}>
                  <Text style={styles.completenessLabel}>Perfil {pct}% completo</Text>
                  {pct === 100 ? (
                    <Text style={styles.completenessDone}>Tudo certo! 🐝</Text>
                  ) : (
                    <TouchableOpacity onPress={() => router.push("/settings" as never)}>
                      <Text style={styles.completenessLink}>Completar →</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.completenessBar}>
                  <View style={[styles.completenessFill, { width: `${pct}%` as any }]} />
                </View>
              </View>
            );
          })()}
        </View>

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
          <StatCard emoji="🏆" label="Medalhas" value={safeAchievements.length.toString()} colors={colors} />
        </View>

        {/* ── Medalhas ── */}
        <View style={styles.medalsSection}>
          <View style={styles.medalsSectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Medalhas</Text>
              <Text style={styles.medalsCount}>
                {safeAchievements.length} de {MEDAL_CATALOG.length} conquistadas · {Math.round((safeAchievements.length / MEDAL_CATALOG.length) * 100)}%
              </Text>
            </View>
          </View>
          {/* Progresso */}
          <View style={styles.medalProgressBar}>
            <View style={[
              styles.medalProgressFill,
              { width: `${Math.round((safeAchievements.length / MEDAL_CATALOG.length) * 100)}%` as any },
            ]} />
          </View>
          {/* Filtros */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.medalFilters}>
            {[
              { value: "all", label: `Todas (${MEDAL_CATALOG.length})` },
              { value: "earned", label: `Conquistadas (${safeAchievements.length})` },
              { value: "locked", label: `Bloqueadas (${MEDAL_CATALOG.length - safeAchievements.length})` },
              { value: "bronze", label: "Bronze", color: TIER_COLORS.bronze.body },
              { value: "silver", label: "Prata", color: TIER_COLORS.silver.body },
              { value: "gold", label: "Ouro", color: TIER_COLORS.gold.body },
              { value: "diamond", label: "Diamante", color: TIER_COLORS.diamond.body },
            ].map((f) => {
              const active = medalFilter === (f.value as any);
              return (
                <TouchableOpacity
                  key={f.value}
                  onPress={() => setMedalFilter(f.value as any)}
                  style={[styles.medalFilterChip, active && styles.medalFilterChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  {f.color ? <View style={[styles.medalFilterDot, { backgroundColor: f.color }]} /> : null}
                  <Text style={[styles.medalFilterText, active && styles.medalFilterTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {(() => {
            const filtered = MEDAL_CATALOG.filter((m) => {
              const earned = safeAchievements.some((a: any) => a.type === m.type);
              switch (medalFilter) {
                case "all": return true;
                case "earned": return earned;
                case "locked": return !earned;
                default: return m.tier === medalFilter;
              }
            }).map((m) => m.type);
            if (filtered.length === 0) {
              return (
                <View style={styles.medalEmpty}>
                  <Text style={styles.medalEmptyText}>
                    Nenhuma medalha nesta categoria 🐝
                  </Text>
                </View>
              );
            }
            return (
              <MedalGrid
                earnedTypes={safeAchievements.map((a: any) => a.type)}
                onPress={setSelectedMedal}
                filterTypes={filtered}
              />
            );
          })()}
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
              style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40, gap: 0 }}
            >
              <View style={{ width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />
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
                  <UserAvatar name={item.authorDisplayName || item.authorUsername || "?"} avatarUrl={item.authorAvatarUrl} size={42} backgroundColor={colors.primary} color="#1A1A1A" />
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
            keyboardVerticalOffset={0}
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
                        onPress={() => setSelectedFriend({ id: item.id, displayName: item.displayName, username: item.username, avatarUrl: item.avatarUrl })}
                        style={styles.friendPickerRow}
                      >
                        <UserAvatar name={item.displayName || item.username || "?"} avatarUrl={item.avatarUrl} size={44} backgroundColor={colors.primary} color="#1A1A1A" />
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
                    <UserAvatar name={selectedFriend.displayName || selectedFriend.username} avatarUrl={selectedFriend.avatarUrl} size={42} backgroundColor={colors.primary} color="#1A1A1A" />
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
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      position: "relative",
    },
    settingsButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
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
    avatarSection: { alignItems: "center", paddingVertical: 18, paddingHorizontal: 16, gap: 8, backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.border, shadowColor: "#4B3508", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 6 },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderWidth: 3,
      borderColor: colors.primary + "44",
    },
    avatarImage: { width: "100%", height: "100%" },
    avatarText: { fontFamily: FONTS.display, fontSize: 36, fontWeight: "700", color: "#1A1A1A" },
    avatarEditOverlay: {
      position: "absolute",
      bottom: -2,
      left: -2,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    usernameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" },
    xpChip: {
      paddingHorizontal: 8, paddingVertical: 2,
      borderRadius: 99,
      backgroundColor: colors.primary + "22",
    },
    xpChipText: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "800", color: colors.primaryDark },
    username: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "700", color: colors.foreground },
    usernameHandle: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted },
    profileBio: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, color: colors.foreground, textAlign: "center", paddingHorizontal: 18 },
    profileBioEmpty: { fontFamily: FONTS.sans, fontSize: 12, fontStyle: "italic", color: colors.muted, textAlign: "center" },
    levelBadge: { position: "absolute", bottom: -4, right: -4, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
    levelBadgeText: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "900", color: "#1A1A1A" },
    miniStatsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 6 },
    miniStat: { alignItems: "center", minWidth: 60 },
    miniStatValue: { fontFamily: FONTS.display, fontSize: 17, fontWeight: "800", color: colors.foreground },
    miniStatLabel: { fontFamily: FONTS.sans, fontSize: 10, color: colors.muted, marginTop: 1 },
    miniStatDivider: { width: 1, height: 22, backgroundColor: colors.border },
    completenessWrap: { width: "100%", paddingHorizontal: 4, marginTop: 6, gap: 4 },
    completenessHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    completenessLabel: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.foreground },
    completenessDone: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "800", color: colors.success },
    completenessLink: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.primaryDark },
    completenessBar: { height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" },
    completenessFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 3 },
    profileMeta: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
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
      shadowColor: "#4B3508",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 4,
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
      borderWidth: 1,
      borderColor: colors.border,
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
      shadowColor: "#4B3508",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 4,
    },
    medalsSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    medalsCount: { fontFamily: FONTS.mono, fontSize: 11, fontWeight: "700", color: colors.primaryDark, marginTop: 2 },
    sectionTitle: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 16, color: colors.foreground },
    medalProgressBar: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" },
    medalProgressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 3 },
    medalFilters: { flexDirection: "row", gap: 6, paddingVertical: 2 },
    medalFilterChip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
    },
    medalFilterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "22" },
    medalFilterDot: { width: 7, height: 7, borderRadius: 4 },
    medalFilterText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.muted },
    medalFilterTextActive: { color: colors.primaryDark },
    medalEmpty: { padding: 24, alignItems: "center" },
    medalEmptyText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    // ── Testimonials ─────────────────────────────────────────────────────────
    testimonialsSection: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#4B3508",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.05,
      shadowRadius: 14,
      elevation: 3,
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

