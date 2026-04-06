import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState, useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@mobile/lib/api";
import { useAuthStore } from "@mobile/stores/authStore";
import { useUIStore } from "@mobile/stores/uiStore";
import { FeedPost, ConnectionSuggestion, displayNameOf, timeAgo } from "@mobile/lib/social";
import { FONTS, getThemeColors } from "@mobile/lib/theme";

interface FeedComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  username: string;
  displayName: string | null;
  likesCount: number;
  liked: boolean;
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

export default function FeedScreen() {
  const { user } = useAuthStore();
  const themeMode = useUIStore((state) => state.themeMode);
  const insets = useSafeAreaInsets();
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
      queryClient.setQueryData<FeedPost[]>(["feed"], (prev = []) => [
        {
          ...newPost,
          author: { id: user!.id, username: user!.username, displayName: user!.displayName || null, level: user!.level },
          likesCount: 0,
          liked: false,
          commentsCount: 0,
        },
        ...prev,
      ]);
      setPostText("");
      setShowPostInput(false);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["feed"] });
        queryClient.invalidateQueries({ queryKey: ["me"] });
      }, 3000);
    },
    onError: () => Alert.alert("Erro", "Nao foi possivel publicar. Tente novamente."),
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
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["feed"] });
    setRefreshing(false);
  }, [queryClient]);

  function handlePost() {
    if (!postText.trim()) return;
    if (postText.trim().length > 500) {
      Alert.alert("Post muito longo", "Maximo de 500 caracteres.");
      return;
    }
    createPost.mutate(postText.trim());
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Feed</Text>
            <Text style={styles.headerSubtitle}>Compartilhe, comente e acompanhe sua rede</Text>
          </View>
          <TouchableOpacity style={styles.newPostBtn} onPress={() => setShowPostInput((v) => !v)}>
            <Text style={styles.newPostBtnText}>{showPostInput ? "Cancelar" : "+ Post"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {showPostInput && (
            <View style={styles.postInputCard}>
              <Text style={styles.postInputLabel}>O que esta acontecendo?</Text>
              <TextInput
                style={styles.postInput}
                placeholder="Compartilhe um momento, conquista ou pensamento..."
                placeholderTextColor={colors.muted}
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
                  <Text style={styles.publishBtnText}>{createPost.isPending ? "Publicando..." : "Publicar"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {suggestions.length > 0 && (
            <View style={styles.suggestionsCard}>
              <Text style={styles.sectionTitle}>Sugestoes de conexao</Text>
              {suggestions.map((s) => (
                <View key={s.id} style={styles.suggestionRow}>
                  <View style={styles.suggestionAvatar}>
                    <Text style={styles.suggestionAvatarText}>{displayNameOf(s)[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName}>{displayNameOf(s)}</Text>
                    <Text style={styles.suggestionInterests} numberOfLines={2}>
                      {s.commonInterests.slice(0, 3).join(" • ") || s.suggestionMessage || "Boa conexao para voce"}
                    </Text>
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

          {isLoading && <Text style={styles.loadingText}>Carregando feed...</Text>}

          {!isLoading && feed.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌐</Text>
              <Text style={styles.emptyTitle}>Seu feed esta vazio</Text>
              <Text style={styles.emptyDesc}>Publique algo ou conecte-se com outros usuarios para ver conteudos aqui.</Text>
            </View>
          )}

          {feed.map((post) => (
            <PostCard
              key={post.id}
              post={{ ...post, commentsCount: post.commentsCount ?? 0 }}
              onLike={() => likePost.mutate(post.id)}
              isLiking={likePost.isPending}
              colors={colors}
            />
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PostCard({
  post,
  onLike,
  isLiking,
  colors,
}: {
  post: FeedPost & { commentsCount: number };
  onLike: () => void;
  isLiking: boolean;
  colors: ReturnType<typeof getThemeColors>;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sentimentEmoji = post.sentiment ? SENTIMENT_EMOJI[post.sentiment] ?? "💭" : null;
  const [expanded, setExpanded] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(post.liked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);

  async function handleLikePress() {
    const next = !liked;
    setLiked(next);
    setLikesCount((current) => current + (next ? 1 : -1));
    try {
      await onLike();
    } catch {
      setLiked(!next);
      setLikesCount((current) => current + (next ? -1 : 1));
    }
  }

  async function handleToggleComments() {
    if (!expanded && !commentsLoaded) {
      setCommentsLoading(true);
      try {
        const { data } = await api.get(`/api/posts/${post.id}/comments`);
        setComments(data);
        setCommentsLoaded(true);
      } finally {
        setCommentsLoading(false);
      }
    }
    setExpanded((value) => !value);
  }

  async function handleSendComment() {
    if (!commentInput.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/api/posts/${post.id}/comments`, { content: commentInput.trim() });
      setComments((prev) => [
        ...prev,
        {
          ...data,
          username: data.username || "Voce",
          displayName: data.displayName || null,
          likesCount: data.likesCount ?? 0,
          liked: data.liked ?? false,
        },
      ]);
      setCommentsCount((current) => current + 1);
      setCommentInput("");
      setCommentsLoaded(true);
    } finally {
      setSending(false);
    }
  }

  async function handleCommentLike(commentId: string) {
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              liked: !comment.liked,
              likesCount: comment.likesCount + (comment.liked ? -1 : 1),
            }
          : comment,
      ),
    );

    try {
      const { data } = await api.post(`/api/comments/${commentId}/like`);
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? { ...comment, liked: data.liked, likesCount: data.likesCount }
            : comment,
        ),
      );
    } catch {
      // ignore optimistic rollback complexity
    }
  }

  const authorName = displayNameOf(post.author);

  return (
    <View style={styles.postCard}>
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
        {sentimentEmoji ? (
          <View style={styles.sentimentBadge}>
            <Text style={styles.sentimentEmoji}>{sentimentEmoji}</Text>
            {post.sentimentLabel ? <Text style={styles.sentimentLabel}>{post.sentimentLabel}</Text> : null}
          </View>
        ) : null}
      </View>

      <Text style={styles.postContent}>{post.content}</Text>

      {post.aiComment ? (
        <View style={styles.aiCommentBox}>
          <Text style={styles.aiCommentLabel}>🐝 BeeEyes</Text>
          <Text style={styles.aiCommentText}>{post.aiComment}</Text>
        </View>
      ) : null}

      <View style={styles.postActions}>
        <TouchableOpacity
          style={[styles.actionBtn, liked && styles.likeBtnActive]}
          onPress={handleLikePress}
          disabled={isLiking}
        >
          <Text style={styles.actionBtnText}>{liked ? "❤️" : "🤍"} {likesCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleToggleComments}>
          <Text style={styles.actionBtnText}>💬 {commentsCount}</Text>
        </TouchableOpacity>
      </View>

      {expanded ? (
        <View style={styles.commentsSection}>
          {commentsLoading ? <Text style={styles.commentHint}>Carregando comentarios...</Text> : null}
          {!commentsLoading && comments.length === 0 ? (
            <Text style={styles.commentHint}>Sem comentarios ainda. Seja o primeiro.</Text>
          ) : null}

          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>{displayNameOf(comment)[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.commentBubble}>
                  <Text style={styles.commentName}>{displayNameOf(comment)}</Text>
                  <Text style={styles.commentText}>{comment.content}</Text>
                </View>
                <View style={styles.commentFooter}>
                  <Text style={styles.commentFooterText}>{timeAgo(comment.createdAt)}</Text>
                  <TouchableOpacity onPress={() => handleCommentLike(comment.id)}>
                    <Text style={styles.commentFooterText}>{comment.liked ? "❤️" : "🤍"} {comment.likesCount || ""}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          <View style={styles.commentComposer}>
            <TextInput
              style={styles.commentInput}
              value={commentInput}
              onChangeText={setCommentInput}
              placeholder="Escreva um comentario..."
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity
              style={[styles.commentSendBtn, (!commentInput.trim() || sending) && styles.publishBtnDisabled]}
              onPress={handleSendComment}
              disabled={!commentInput.trim() || sending}
            >
              <Text style={styles.commentSendBtnText}>{sending ? "..." : "Enviar"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "700", color: colors.foreground },
    headerSubtitle: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
    newPostBtn: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    newPostBtnText: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 13, color: "#1A1A1A" },
    content: { padding: 16, gap: 12, paddingBottom: 32 },
    postInputCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      gap: 10,
      borderWidth: 1.5,
      borderColor: colors.primary + "66",
    },
    postInputLabel: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 14, color: colors.foreground },
    postInput: {
      fontFamily: FONTS.sans,
      fontSize: 15,
      color: colors.foreground,
      minHeight: 80,
      textAlignVertical: "top",
    },
    postInputFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    charCount: { fontFamily: FONTS.mono, fontSize: 12, color: colors.muted },
    publishBtn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    publishBtnDisabled: { opacity: 0.5 },
    publishBtnText: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 14, color: "#1A1A1A" },
    suggestionsCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 15, color: colors.foreground },
    suggestionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    suggestionAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    suggestionAvatarText: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: colors.foreground },
    suggestionName: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 14, color: colors.foreground },
    suggestionInterests: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, lineHeight: 18 },
    connectBtn: {
      backgroundColor: colors.primary + "33",
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    connectBtnText: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 12, color: colors.primaryDark },
    postCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    postHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    postAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    postAvatarText: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: "#1A1A1A" },
    postAuthorRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    postAuthorName: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 14, color: colors.foreground },
    levelChip: { backgroundColor: colors.secondary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
    levelChipText: { fontFamily: FONTS.mono, fontSize: 10, fontWeight: "700", color: colors.foreground },
    postTime: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
    sentimentBadge: { alignItems: "center", gap: 2 },
    sentimentEmoji: { fontSize: 20 },
    sentimentLabel: { fontFamily: FONTS.sans, fontSize: 10, color: colors.muted },
    postContent: { fontFamily: FONTS.sans, fontSize: 15, color: colors.foreground, lineHeight: 22 },
    aiCommentBox: {
      backgroundColor: colors.secondary + "88",
      borderRadius: 12,
      padding: 10,
      gap: 4,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    aiCommentLabel: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 12, color: colors.primaryDark },
    aiCommentText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, lineHeight: 18 },
    postActions: { flexDirection: "row", alignItems: "center", gap: 12 },
    actionBtn: {
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    likeBtnActive: { borderColor: colors.destructive, backgroundColor: colors.destructive + "11" },
    actionBtnText: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 13, color: colors.foreground },
    commentsSection: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
      gap: 10,
    },
    commentHint: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, textAlign: "center" },
    commentRow: { flexDirection: "row", gap: 8 },
    commentAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    commentAvatarText: { fontFamily: FONTS.display, fontSize: 12, fontWeight: "700", color: colors.foreground },
    commentBubble: {
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    commentName: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 12, color: colors.foreground, marginBottom: 2 },
    commentText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, lineHeight: 18 },
    commentFooter: { flexDirection: "row", gap: 12, paddingLeft: 4, paddingTop: 4 },
    commentFooterText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted },
    commentComposer: { flexDirection: "row", gap: 8, paddingTop: 4 },
    commentInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: FONTS.sans,
      color: colors.foreground,
    },
    commentSendBtn: {
      borderRadius: 12,
      paddingHorizontal: 12,
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    commentSendBtnText: { fontFamily: FONTS.sans, fontWeight: "700", color: "#1A1A1A" },
    loadingText: { fontFamily: FONTS.sans, fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 32 },
    emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: colors.foreground },
    emptyDesc: { fontFamily: FONTS.sans, fontSize: 14, color: colors.muted, textAlign: "center", paddingHorizontal: 24 },
  });
}

