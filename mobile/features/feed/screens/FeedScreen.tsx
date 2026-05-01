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
  Image,
  Platform,
  Share,
} from "react-native";
import { useState, useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { api } from "@mobile/lib/api";
import { useAuthStore } from "@mobile/stores/authStore";
import { useUIStore } from "@mobile/stores/uiStore";
import { FeedPost, ConnectionSuggestion, displayNameOf, timeAgo } from "@mobile/lib/social";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

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

const AVATAR_COLORS = [
  ["#F59E0B", "#D97706"],
  ["#8B5CF6", "#7C3AED"],
  ["#EC4899", "#DB2777"],
  ["#10B981", "#059669"],
  ["#3B82F6", "#2563EB"],
  ["#F97316", "#EA580C"],
];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length][0];
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

async function pickFeedImage(onChange: (imageUrl: string) => void) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permissao necessaria", "Permita acesso a galeria para publicar uma foto.");
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return;
  const processed = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 900 } }],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (processed.base64) onChange(`data:image/jpeg;base64,${processed.base64}`);
}

export default function FeedScreen() {
  const { user } = useAuthStore();
  const themeMode = useUIStore((state) => state.themeMode);
  const insets = useSafeAreaInsets();
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [postText, setPostText] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [pickingImage, setPickingImage] = useState(false);
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
    mutationFn: ({ content, imageUrl }: { content: string; imageUrl?: string }) => api.post("/api/posts", { content, imageUrl: imageUrl || null }).then((r) => r.data),
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
      setPostImageUrl("");
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
    if (!postText.trim() && !postImageUrl) return;
    if (postText.trim().length > 500) {
      Alert.alert("Post muito longo", "Maximo de 500 caracteres.");
      return;
    }
    createPost.mutate({ content: postText.trim() || "Imagem compartilhada", imageUrl: postImageUrl });
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
              {postImageUrl ? (
                <View style={{ position: "relative" }}>
                  <Image source={{ uri: postImageUrl }} style={{ width: "100%", height: 160, borderRadius: 12, backgroundColor: colors.secondary }} resizeMode="cover" />
                  <TouchableOpacity
                    onPress={() => setPostImageUrl("")}
                    style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 14, padding: 5 }}
                  >
                    <Feather name="x" size={14} color="white" />
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={styles.postInputFooter}>
                <Text style={styles.charCount}>{postText.length}/500</Text>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={async () => {
                    setPickingImage(true);
                    try { await pickFeedImage(setPostImageUrl); } finally { setPickingImage(false); }
                  }}
                  disabled={pickingImage}
                >
                  <Feather name="image" size={13} color={colors.foreground} style={{ marginRight: 4 }} />
                  <Text style={styles.photoBtnText}>{pickingImage ? "Carregando..." : postImageUrl ? "Trocar foto" : "Foto"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.publishBtn, ((!postText.trim() && !postImageUrl) || createPost.isPending) && styles.publishBtnDisabled]}
                  onPress={handlePost}
                  disabled={(!postText.trim() && !postImageUrl) || createPost.isPending}
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
                    <View style={styles.suggestionTopRow}>
                      <Text style={styles.suggestionName}>{displayNameOf(s)}</Text>
                      {typeof s.matchScore === "number" ? (
                        <View style={styles.matchBadge}>
                          <Text style={styles.matchBadgeText}>{s.matchScore}% match</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.suggestionInterests} numberOfLines={2}>
                      {s.commonInterests.slice(0, 3).join(" • ") || s.suggestionMessage || "Boa conexao para voce"}
                    </Text>
                    {s.matchReason ? (
                      <Text style={styles.matchReasonText} numberOfLines={2}>
                        {s.matchReason}
                      </Text>
                    ) : null}
                    {s.matchSignals?.length ? (
                      <Text style={styles.suggestionSignals} numberOfLines={1}>
                        {s.matchSignals.join(" • ")}
                      </Text>
                    ) : null}
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
  const [bookmarked, setBookmarked] = useState(false);

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

  async function handleShare() {
    try {
      await Share.share({ message: post.content });
    } catch { /* ignore */ }
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
      {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.postImage} /> : null}

      {post.aiComment ? (
        <View style={styles.aiCommentBox}>
          <Text style={styles.aiCommentLabel}>🐝 BeeEyes</Text>
          <Text style={styles.aiCommentText}>{post.aiComment}</Text>
        </View>
      ) : null}

      {post.feedInsight ? (
        <View style={styles.feedInsightBox}>
          <View style={styles.feedInsightHeader}>
            <Text style={styles.feedInsightTag}>{post.feedInsight.signalLabel}</Text>
            <Text style={styles.feedInsightAngle}>{post.feedInsight.angle}</Text>
          </View>
          <Text style={styles.feedInsightText}>{post.feedInsight.audienceHint}</Text>
          <Text style={styles.feedInsightSubtext}>{post.feedInsight.impactHint}</Text>
        </View>
      ) : null}

      {post.personalizedInsight ? (
        <View style={styles.forYouBox}>
          <View style={styles.forYouHeader}>
            <Text style={styles.forYouTag}>Por que isso apareceu para voce</Text>
            <Text style={styles.forYouScore}>{post.personalizedInsight.relevanceScore}% fit</Text>
          </View>
          <Text style={styles.forYouText}>{post.personalizedInsight.forYouReason}</Text>
          <Text style={styles.forYouHint}>{post.personalizedInsight.actionHint}</Text>
        </View>
      ) : null}

      <View style={styles.postActions}>
        <TouchableOpacity
          style={[styles.actionBtn, liked && styles.likeBtnActive]}
          onPress={handleLikePress}
          disabled={isLiking}
        >
          <Text style={styles.actionBtnText}>{liked ? "❤️" : "🤍"} {likesCount > 0 ? likesCount : ""}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, expanded && styles.commentBtnActive]}
          onPress={handleToggleComments}
        >
          <Text style={styles.actionBtnText}>💬 {commentsCount > 0 ? commentsCount : ""}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Text style={styles.actionBtnText}>↗</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[styles.actionBtn, bookmarked && styles.bookmarkBtnActive]}
          onPress={() => setBookmarked((v) => !v)}
        >
          <Text style={styles.actionBtnText}>{bookmarked ? "🔖" : "🏷"}</Text>
        </TouchableOpacity>
      </View>

      {expanded ? (
        <View style={styles.commentsSection}>
          {/* Skeleton loading */}
          {commentsLoading && (
            <View style={{ gap: 10 }}>
              {[1, 2].map((i) => (
                <View key={i} style={styles.commentRow}>
                  <View style={[styles.commentAvatar, { backgroundColor: colors.secondary }]} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ height: 10, width: 80, backgroundColor: colors.secondary, borderRadius: 6 }} />
                    <View style={{ height: 9, width: "70%", backgroundColor: colors.secondary, borderRadius: 6 }} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {!commentsLoading && comments.length === 0 && (
            <Text style={styles.commentHint}>Sem comentários ainda. Seja o primeiro! ✨</Text>
          )}

          {comments.map((comment) => {
            const cName = displayNameOf(comment);
            const cColor = avatarColor(cName);
            return (
              <View key={comment.id} style={styles.commentRow}>
                <View style={[styles.commentAvatar, { backgroundColor: cColor }]}>
                  <Text style={styles.commentAvatarText}>{cName[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentName}>{cName}</Text>
                    <Text style={styles.commentText}>{comment.content}</Text>
                  </View>
                  <View style={styles.commentFooter}>
                    <Text style={styles.commentFooterText}>{timeAgo(comment.createdAt)}</Text>
                    <TouchableOpacity
                      style={styles.commentLikeBtn}
                      onPress={() => handleCommentLike(comment.id)}
                    >
                      <Text style={[styles.commentFooterText, comment.liked && { color: "#EF4444" }]}>
                        {comment.liked ? "❤️" : "🤍"} {comment.likesCount > 0 ? comment.likesCount : ""}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.commentComposer}>
            <TextInput
              style={styles.commentInput}
              value={commentInput}
              onChangeText={setCommentInput}
              placeholder="Escreva um comentário..."
              placeholderTextColor={colors.muted}
              onSubmitEditing={handleSendComment}
              returnKeyType="send"
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
    photoBtn: { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.secondary },
    photoBtnText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.foreground },
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
    suggestionTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    suggestionName: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 14, color: colors.foreground },
    suggestionInterests: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, lineHeight: 18 },
    matchReasonText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.foreground, lineHeight: 18, marginTop: 4 },
    suggestionSignals: { fontFamily: FONTS.mono, fontSize: 10, color: colors.primaryDark, marginTop: 4 },
    matchBadge: { backgroundColor: colors.primary + "24", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.primary + "44" },
    matchBadgeText: { fontFamily: FONTS.mono, fontSize: 10, fontWeight: "700", color: colors.primaryDark },
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
    postImage: { width: "100%", height: 210, borderRadius: 16, backgroundColor: colors.background },
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
    feedInsightBox: {
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 12,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    feedInsightHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
    feedInsightTag: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.primaryDark, textTransform: "uppercase" },
    feedInsightAngle: { fontFamily: FONTS.mono, fontSize: 10, color: colors.muted },
    feedInsightText: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 18, color: colors.foreground },
    feedInsightSubtext: { fontFamily: FONTS.sans, fontSize: 11, lineHeight: 17, color: colors.muted },
    forYouBox: {
      backgroundColor: colors.primary + "12",
      borderRadius: 14,
      padding: 12,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary + "33",
    },
    forYouHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
    forYouTag: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.primaryDark, textTransform: "uppercase" },
    forYouScore: { fontFamily: FONTS.mono, fontSize: 10, fontWeight: "700", color: colors.primaryDark },
    forYouText: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 18, color: colors.foreground },
    forYouHint: { fontFamily: FONTS.sans, fontSize: 11, lineHeight: 17, color: colors.muted },
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
    commentBtnActive: { borderColor: colors.primaryDark, backgroundColor: colors.primary + "14" },
    bookmarkBtnActive: { borderColor: colors.success, backgroundColor: colors.success + "14" },
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
    commentLikeBtn: { paddingVertical: 2, paddingHorizontal: 2 },
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
