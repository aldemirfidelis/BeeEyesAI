import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, RefreshControl, Modal, ActivityIndicator,
  Pressable,
} from "react-native";
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { COLORS, FONTS } from "../../lib/theme";

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
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>👥 Amigos</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {isLoading && (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        )}

        {!isLoading && friends.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyTitle}>Nenhum amigo ainda</Text>
            <Text style={styles.emptyDesc}>
              Vá ao Feed e conecte-se com outras pessoas para vê-las aqui!
            </Text>
          </View>
        )}

        {friends.map((friend) => {
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "700", color: COLORS.foreground },
  content: { padding: 16, gap: 10, paddingBottom: 32 },

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
