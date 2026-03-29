import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, RefreshControl, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { COLORS, FONTS } from "../../lib/theme";

interface PostAuthor {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
}

interface FeedPost {
  id: string;
  userId: string;
  content: string;
  sentiment: string | null;
  sentimentLabel: string | null;
  aiComment: string | null;
  createdAt: string;
  author: PostAuthor;
  likesCount: number;
  liked: boolean;
}

interface ConnectionSuggestion {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
  commonInterests: string[];
  suggestionMessage: string;
}

const SENTIMENT_EMOJI: Record<string, string> = {
  happy: "😊",
  motivated: "💪",
  tired: "😴",
  sad: "💙",
  neutral: "😐",
  excited: "🎉",
  proud: "🏆",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function FeedScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [postText, setPostText] = useState("");
  const [showPostInput, setShowPostInput] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: feed = [], isLoading } = useQuery<FeedPost[]>({
    queryKey: ["feed"],
    queryFn: () => api.get("/api/feed").then((r) => r.data),
    staleTime: 60 * 1000,
  });

  const { data: suggestions = [] } = useQuery<ConnectionSuggestion[]>({
    queryKey: ["connection-suggestions"],
    queryFn: () => api.get("/api/connections/suggestions").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const createPost = useMutation({
    mutationFn: (content: string) => api.post("/api/posts", { content }).then((r) => r.data),
    onSuccess: (newPost) => {
      // Optimistic update: prepend immediately
      queryClient.setQueryData<FeedPost[]>(["feed"], (prev = []) => [{
        ...newPost,
        author: { id: user!.id, username: user!.username, displayName: null, level: user!.level },
        likesCount: 0,
        liked: false,
      }, ...prev]);
      setPostText("");
      setShowPostInput(false);
      // Reload in background after 3s to get AI comment
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["feed"] });
        queryClient.invalidateQueries({ queryKey: ["me"] });
      }, 3000);
    },
    onError: () => Alert.alert("Erro", "Não foi possível publicar. Tente novamente."),
  });

  const likePost = useMutation({
    mutationFn: (postId: string) => api.post(`/api/posts/${postId}/like`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
  });

  const sendConnection = useMutation({
    mutationFn: (targetUserId: string) => api.post("/api/connections", { targetUserId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connection-suggestions"] });
    },
    onError: () => {},
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["feed"] });
    setRefreshing(false);
  }, [queryClient]);

  function handlePost() {
    if (!postText.trim()) return;
    if (postText.trim().length > 500) {
      Alert.alert("Post muito longo", "Máximo de 500 caracteres.");
      return;
    }
    createPost.mutate(postText.trim());
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🌐 Feed</Text>
          <TouchableOpacity
            style={styles.newPostBtn}
            onPress={() => setShowPostInput((v) => !v)}
          >
            <Text style={styles.newPostBtnText}>{showPostInput ? "Cancelar" : "+ Post"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {/* Post Input */}
          {showPostInput && (
            <View style={styles.postInputCard}>
              <Text style={styles.postInputLabel}>O que está acontecendo?</Text>
              <TextInput
                style={styles.postInput}
                placeholder="Compartilhe um momento, conquista ou pensamento..."
                placeholderTextColor={COLORS.muted}
                multiline
                maxLength={500}
                value={postText}
                onChangeText={setPostText}
                autoFocus
              />
              <View style={styles.postInputFooter}>
                <Text style={styles.charCount}>{postText.length}/500</Text>
                <TouchableOpacity
                  style={[styles.publishBtn, (!postText.trim() || createPost.isPending) && styles.publishBtnDisabled]}
                  onPress={handlePost}
                  disabled={!postText.trim() || createPost.isPending}
                >
                  <Text style={styles.publishBtnText}>
                    {createPost.isPending ? "Publicando..." : "Publicar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Connection Suggestions */}
          {suggestions.length > 0 && (
            <View style={styles.suggestionsCard}>
              <Text style={styles.sectionTitle}>💡 Sugestões de conexão</Text>
              {suggestions.map((s) => (
                <View key={s.id} style={styles.suggestionRow}>
                  <View style={styles.suggestionAvatar}>
                    <Text style={styles.suggestionAvatarText}>
                      {(s.displayName || s.username)[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName}>{s.displayName || s.username}</Text>
                    {s.commonInterests.length > 0 && (
                      <Text style={styles.suggestionInterests} numberOfLines={1}>
                        {s.commonInterests.slice(0, 3).join(" · ")}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.connectBtn}
                    onPress={() => sendConnection.mutate(s.id)}
                    disabled={sendConnection.isPending}
                  >
                    <Text style={styles.connectBtnText}>Conectar</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Feed */}
          {isLoading && (
            <Text style={styles.loadingText}>Carregando feed...</Text>
          )}

          {!isLoading && feed.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌐</Text>
              <Text style={styles.emptyTitle}>Seu feed está vazio</Text>
              <Text style={styles.emptyDesc}>
                Publique algo ou conecte-se com outros usuários para ver conteúdos aqui.
              </Text>
            </View>
          )}

          {feed.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={() => likePost.mutate(post.id)}
              isLiking={likePost.isPending}
            />
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PostCard({
  post,
  onLike,
  isLiking,
}: {
  post: FeedPost;
  onLike: () => void;
  isLiking: boolean;
}) {
  const authorName = post.author.displayName || post.author.username;
  const sentimentEmoji = post.sentiment ? (SENTIMENT_EMOJI[post.sentiment] ?? "💭") : null;

  return (
    <View style={styles.postCard}>
      {/* Author row */}
      <View style={styles.postHeader}>
        <View style={styles.postAvatar}>
          <Text style={styles.postAvatarText}>{authorName[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.postAuthorRow}>
            <Text style={styles.postAuthorName}>{authorName}</Text>
            <View style={styles.levelChip}>
              <Text style={styles.levelChipText}>Nv {post.author.level}</Text>
            </View>
          </View>
          <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
        </View>
        {sentimentEmoji && (
          <View style={styles.sentimentBadge}>
            <Text style={styles.sentimentEmoji}>{sentimentEmoji}</Text>
            {post.sentimentLabel && (
              <Text style={styles.sentimentLabel}>{post.sentimentLabel}</Text>
            )}
          </View>
        )}
      </View>

      {/* Content */}
      <Text style={styles.postContent}>{post.content}</Text>

      {/* BeeEyes AI comment */}
      {post.aiComment && (
        <View style={styles.aiCommentBox}>
          <Text style={styles.aiCommentLabel}>🐝 BeeEyes</Text>
          <Text style={styles.aiCommentText}>{post.aiComment}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity
          style={[styles.likeBtn, post.liked && styles.likeBtnActive]}
          onPress={onLike}
          disabled={isLiking}
        >
          <Text style={styles.likeBtnText}>
            {post.liked ? "❤️" : "🤍"} {post.likesCount}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "700", color: COLORS.foreground },
  newPostBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  newPostBtnText: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 13, color: "#1A1A1A" },

  content: { padding: 16, gap: 12, paddingBottom: 32 },

  // Post input
  postInputCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary + "66",
  },
  postInputLabel: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 14, color: COLORS.foreground },
  postInput: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    color: COLORS.foreground,
    minHeight: 80,
    textAlignVertical: "top",
  },
  postInputFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  charCount: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted },
  publishBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  publishBtnDisabled: { opacity: 0.5 },
  publishBtnText: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 14, color: "#1A1A1A" },

  // Suggestions
  suggestionsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 15, color: COLORS.foreground },
  suggestionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  suggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionAvatarText: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: COLORS.foreground },
  suggestionName: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 14, color: COLORS.foreground },
  suggestionInterests: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted },
  connectBtn: {
    backgroundColor: COLORS.primary + "33",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  connectBtnText: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 12, color: COLORS.primary },

  // Post card
  postCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  postHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  postAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  postAvatarText: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: "#1A1A1A" },
  postAuthorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  postAuthorName: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 14, color: COLORS.foreground },
  levelChip: {
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  levelChipText: { fontFamily: FONTS.mono, fontSize: 10, fontWeight: "700", color: COLORS.foreground },
  postTime: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 2 },
  sentimentBadge: {
    alignItems: "center",
    gap: 2,
  },
  sentimentEmoji: { fontSize: 20 },
  sentimentLabel: { fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted },

  postContent: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    color: COLORS.foreground,
    lineHeight: 22,
  },

  aiCommentBox: {
    backgroundColor: COLORS.secondary + "88",
    borderRadius: 12,
    padding: 10,
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  aiCommentLabel: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 12, color: COLORS.primary },
  aiCommentText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.foreground, lineHeight: 18 },

  postActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  likeBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  likeBtnActive: { borderColor: "#e0245e", backgroundColor: "#e0245e11" },
  likeBtnText: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 13, color: COLORS.foreground },

  // States
  loadingText: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted, textAlign: "center", marginTop: 32 },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: COLORS.foreground },
  emptyDesc: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted, textAlign: "center", paddingHorizontal: 24 },
});
