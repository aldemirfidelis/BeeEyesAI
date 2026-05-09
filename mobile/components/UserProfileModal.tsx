import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { api } from "@mobile/lib/api";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";
import { UserAvatar } from "@mobile/components/UserAvatar";
import { timeAgo } from "@mobile/lib/social";

type Profile = {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl?: string | null;
    level: number;
    xp: number;
    currentStreak: number;
    bio?: string | null;
  };
  recentPosts: Array<{ id: string; content: string; createdAt: string; sentimentLabel?: string | null; aiComment?: string | null }>;
  interests: string[];
};

export function UserProfileModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);

  const { data, isLoading } = useQuery<Profile>({
    queryKey: ["user-profile", userId],
    queryFn: () => api.get(`/api/users/${userId}/profile`).then((r) => r.data),
    enabled: Boolean(userId),
  });

  const name = data?.user.displayName || data?.user.username || "Perfil";

  return (
    <Modal visible={Boolean(userId)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Perfil</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: 36 }} />
          ) : data ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              <View style={styles.identity}>
                <UserAvatar name={name} avatarUrl={data.user.avatarUrl} size={82} backgroundColor={colors.primary} color="#1A1A1A" />
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.handleText}>@{data.user.username}</Text>
              </View>

              {data.user.bio ? <Text style={styles.bio}>{data.user.bio}</Text> : null}


              {data.interests.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Interesses</Text>
                  <View style={styles.tags}>
                    {data.interests.slice(0, 8).map((interest) => (
                      <Text key={interest} style={styles.tag}>{interest}</Text>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Publicações recentes</Text>
                {data.recentPosts.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma publicação ainda.</Text>
                ) : (
                  data.recentPosts.map((post) => (
                    <View key={post.id} style={styles.postCard}>
                      <Text style={styles.postText}>{post.content}</Text>
                      <View style={styles.postMeta}>
                        {post.sentimentLabel ? <Text style={styles.postMetaText}>{post.sentimentLabel}</Text> : <View />}
                        <Text style={styles.postMetaText}>{timeAgo(post.createdAt)}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>Não foi possível carregar este perfil.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: { maxHeight: "86%", backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
    handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 14 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    title: { fontFamily: FONTS.display, fontSize: 20, fontWeight: "800", color: colors.foreground },
    content: { paddingBottom: 18, gap: 14 },
    identity: { alignItems: "center", gap: 6, paddingTop: 4 },
    name: { fontFamily: FONTS.display, fontSize: 24, fontWeight: "800", color: colors.foreground },
    handleText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted },
    bio: { fontFamily: FONTS.sans, fontSize: 14, lineHeight: 20, color: colors.foreground, textAlign: "center" },
    stats: { flexDirection: "row", gap: 8 },
    statBox: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 10, alignItems: "center", backgroundColor: colors.background },
    statValue: { fontFamily: FONTS.mono, fontSize: 14, fontWeight: "800", color: colors.foreground },
    statLabel: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 2 },
    section: { gap: 8 },
    sectionTitle: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "800", color: colors.muted, textTransform: "uppercase" },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tag: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.primaryDark, backgroundColor: colors.primary + "22", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
    postCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, backgroundColor: colors.background, gap: 8 },
    postText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, color: colors.foreground },
    postMeta: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    postMetaText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted },
    emptyText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted, textAlign: "center", paddingVertical: 18 },
  });
}
