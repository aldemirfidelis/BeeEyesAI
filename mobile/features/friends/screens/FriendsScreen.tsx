import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, RefreshControl, Modal, ActivityIndicator,
  TextInput,
} from "react-native";
import { useState, useCallback, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@mobile/lib/api";
import { COLORS, FONTS } from "@mobile/lib/theme";

interface SearchUser {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
  currentStreak: number;
  connectionStatus: "none" | "pending" | "accepted";
}

interface Friend {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
  currentStreak: number;
  lastActiveAt: string | null;
  personality: { interests: string } | null;
}

interface FriendProfile {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    level: number;
    xp: number;
    currentStreak: number;
    lastActiveAt: string | null;
  };
  recentPosts: Array<{
    id: string;
    content: string;
    aiComment: string | null;
    sentimentLabel: string | null;
    createdAt: string;
  }>;
  interests: string[];
  activeMissionsCount: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [connecting, setConnecting] = useState<Set<string>>(new Set());
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: friends = [], isLoading } = useQuery<Friend[]>({
    queryKey: ["friends"],
    queryFn: () => api.get("/api/friends").then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["friends"] });
    setRefreshing(false);
  }, [queryClient]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get(`/api/users/search?q=${encodeURIComponent(q)}`);
        setSearchResults(res.data);
      } catch { /* ignore */ }
      finally { setSearchLoading(false); }
    }, 350);
  };

  const handleConnect = async (targetUserId: string) => {
    if (connecting.has(targetUserId)) return;
    setConnecting((prev) => new Set(prev).add(targetUserId));
    try {
      await api.post("/api/connections", { targetUserId });
      setSearchResults((prev) =>
        prev.map((u) => u.id === targetUserId ? { ...u, connectionStatus: "pending" as const } : u)
      );
    } catch { /* ignore */ }
    finally { setConnecting((prev) => { const s = new Set(prev); s.delete(targetUserId); return s; }); }
  };

  const openProfile = async (friendId: string) => {
    setSelectedFriendId(friendId);
    setProfile(null);
    setProfileLoading(true);
    try {
      const [profileRes] = await Promise.all([
        api.get(`/api/users/${friendId}/profile`).then((r) => r.data),
        api.post(`/api/users/${friendId}/visit`).catch(() => {}),
      ]);
      setProfile(profileRes);
    } catch { /* ignore */ }
    finally { setProfileLoading(false); }
  };

  const closeProfile = () => {
    setSelectedFriendId(null);
    setProfile(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>👥 Amigos</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Search bar */}
        <View style={styles.searchWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar pessoas no BeeEyes..."
            placeholderTextColor={COLORS.muted}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>

        {/* Search results */}
        {searchQuery.trim().length > 0 && (
          <>
            {searchResults.length === 0 && !searchLoading && (
              <Text style={styles.noResults}>Nenhum usuário encontrado.</Text>
            )}
            {searchResults.map((u) => {
              const name = u.displayName || u.username;
              return (
                <View key={u.id} style={styles.friendCard}>
                  <TouchableOpacity style={styles.friendCardLeft} onPress={() => openProfile(u.id)} activeOpacity={0.7}>
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarText}>{name[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.friendNameRow}>
                        <Text style={styles.friendName}>{name}</Text>
                        <View style={styles.levelBadge}>
                          <Text style={styles.levelBadgeText}>Nv {u.level}</Text>
                        </View>
                      </View>
                      <Text style={styles.friendInterests}>@{u.username}</Text>
                    </View>
                  </TouchableOpacity>
                  {u.connectionStatus === "accepted" ? (
                    <Text style={styles.friendTag}>✓ Amigos</Text>
                  ) : u.connectionStatus === "pending" ? (
                    <Text style={styles.pendingTag}>Pendente</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.connectBtn}
                      onPress={() => handleConnect(u.id)}
                      disabled={connecting.has(u.id)}
                    >
                      <Text style={styles.connectBtnText}>+ Conectar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* Friends list — only when not searching */}
        {!searchQuery.trim() && (
          <>
            {isLoading && (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
            )}

            {!isLoading && friends.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>👥</Text>
                <Text style={styles.emptyTitle}>Nenhum amigo ainda</Text>
                <Text style={styles.emptyDesc}>Use a busca para encontrar pessoas!</Text>
              </View>
            )}
          </>
        )}

        {!searchQuery.trim() && friends.map((friend) => {
          const name = friend.displayName || friend.username;
          const interests: string[] = (() => {
            try { return JSON.parse(friend.personality?.interests || "[]"); } catch { return []; }
          })();

          return (
            <TouchableOpacity
              key={friend.id}
              style={styles.friendCard}
              onPress={() => openProfile(friend.id)}
              activeOpacity={0.7}
            >
              <View style={styles.friendAvatar}>
                <Text style={styles.friendAvatarText}>{name[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.friendNameRow}>
                  <Text style={styles.friendName}>{name}</Text>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>Nv {friend.level}</Text>
                  </View>
                  {friend.currentStreak > 0 && (
                    <Text style={styles.streakText}>🔥 {friend.currentStreak}d</Text>
                  )}
                </View>
                {interests.length > 0 && (
                  <Text style={styles.friendInterests} numberOfLines={1}>
                    {interests.slice(0, 3).join(" · ")}
                  </Text>
                )}
                {friend.lastActiveAt && (
                  <Text style={styles.lastActive}>Ativo {timeAgo(friend.lastActiveAt)}</Text>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Friend Profile Modal */}
      <Modal
        visible={!!selectedFriendId}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeProfile}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Perfil</Text>
            <TouchableOpacity onPress={closeProfile} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {profileLoading && (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
            )}

            {!profileLoading && profile && (() => {
              const { user: f, recentPosts, interests, activeMissionsCount } = profile;
              const name = f.displayName || f.username;
              return (
                <>
                  {/* Avatar + name */}
                  <View style={styles.profileAvatarSection}>
                    <View style={styles.profileAvatar}>
                      <Text style={styles.profileAvatarText}>{name[0].toUpperCase()}</Text>
                    </View>
                    <Text style={styles.profileName}>{name}</Text>
                    <Text style={styles.profileUsername}>@{f.username}</Text>
                  </View>

                  {/* Stats */}
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statEmoji}>🏆</Text>
                      <Text style={styles.statValue}>Nv {f.level}</Text>
                      <Text style={styles.statLabel}>Nível</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statEmoji}>🔥</Text>
                      <Text style={styles.statValue}>{f.currentStreak}d</Text>
                      <Text style={styles.statLabel}>Streak</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statEmoji}>🎯</Text>
                      <Text style={styles.statValue}>{activeMissionsCount}</Text>
                      <Text style={styles.statLabel}>Missões</Text>
                    </View>
                  </View>

                  {/* Interests */}
                  {interests.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>INTERESSES</Text>
                      <View style={styles.interestTags}>
                        {interests.slice(0, 8).map((interest) => (
                          <View key={interest} style={styles.tag}>
                            <Text style={styles.tagText}>{interest}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Recent posts */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>PUBLICAÇÕES RECENTES</Text>
                    {recentPosts.length === 0 && (
                      <Text style={styles.emptyDesc}>{name} ainda não publicou nada.</Text>
                    )}
                    {recentPosts.map((post) => (
                      <View key={post.id} style={styles.postCard}>
                        <Text style={styles.postContent}>{post.content}</Text>
                        {post.aiComment && (
                          <View style={styles.aiCommentBox}>
                            <Text style={styles.aiCommentLabel}>🐝 BeeEyes</Text>
                            <Text style={styles.aiCommentText}>{post.aiComment}</Text>
                          </View>
                        )}
                        <View style={styles.postMeta}>
                          {post.sentimentLabel && (
                            <Text style={styles.postSentiment}>{post.sentimentLabel}</Text>
                          )}
                          <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {f.lastActiveAt && (
                    <Text style={styles.lastActiveCenter}>
                      Último acesso: {timeAgo(f.lastActiveAt)}
                    </Text>
                  )}
                </>
              );
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "700", color: COLORS.foreground },
  content: { padding: 16, gap: 10, paddingBottom: 32 },

  // Search
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: COLORS.foreground,
    padding: 0,
  },
  noResults: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    paddingVertical: 16,
  },
  friendCardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  friendTag: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "600", color: "#16a34a" },
  pendingTag: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted },
  connectBtn: {
    backgroundColor: COLORS.primary + "22",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  connectBtnText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: COLORS.primary },

  // Friend card
  friendCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  friendAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  friendAvatarText: { fontFamily: FONTS.display, fontSize: 20, fontWeight: "700", color: "#1A1A1A" },
  friendNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  friendName: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 15, color: COLORS.foreground },
  levelBadge: { backgroundColor: COLORS.secondary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  levelBadgeText: { fontFamily: FONTS.mono, fontSize: 10, fontWeight: "700", color: COLORS.foreground },
  streakText: { fontFamily: FONTS.sans, fontSize: 12, color: "#F97316" },
  friendInterests: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 2 },
  lastActive: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, marginTop: 2 },
  chevron: { fontSize: 22, color: COLORS.muted },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: COLORS.foreground },
  emptyDesc: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted, textAlign: "center", paddingHorizontal: 24 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalHeaderTitle: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: COLORS.foreground },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: COLORS.muted },
  modalContent: { padding: 20, gap: 20, paddingBottom: 40 },

  // Profile
  profileAvatarSection: { alignItems: "center", gap: 6 },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: { fontFamily: FONTS.display, fontSize: 36, fontWeight: "700", color: "#1A1A1A" },
  profileName: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "700", color: COLORS.foreground },
  profileUsername: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted },

  // Stats
  statsRow: { flexDirection: "row", gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statEmoji: { fontSize: 22 },
  statValue: { fontFamily: FONTS.mono, fontWeight: "700", fontSize: 16, color: COLORS.foreground },
  statLabel: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted },

  // Interests
  section: { gap: 10 },
  sectionTitle: { fontFamily: FONTS.mono, fontSize: 11, fontWeight: "700", color: COLORS.muted, letterSpacing: 1 },
  interestTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: COLORS.primary + "22",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.primary + "44",
  },
  tagText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "600", color: COLORS.primary },

  // Posts
  postCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  postContent: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.foreground, lineHeight: 20 },
  aiCommentBox: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
    paddingLeft: 10,
    gap: 2,
  },
  aiCommentLabel: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 11, color: COLORS.primary },
  aiCommentText: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.foreground },
  postMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  postSentiment: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted },
  postTime: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted },

  lastActiveCenter: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, textAlign: "center" },
});

