import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Image,
  Platform,
  Share,
} from "react-native";
import { useState, useCallback, useMemo, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { api } from "@mobile/lib/api";
import { useAuthStore } from "@mobile/stores/authStore";
import { useUIStore } from "@mobile/stores/uiStore";
import { FeedPost, ConnectionSuggestion, displayNameOf, timeAgo } from "@mobile/lib/social";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { UserAvatar } from "@mobile/components/UserAvatar";
import { UserProfileModal } from "@mobile/components/UserProfileModal";
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
  avatarUrl?: string | null;
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

const MAX_SIDE = 1080;
const FEED_PAGE_SIZE = 20;

type FeedPage = { items: FeedPost[]; nextCursor: string | null };

interface ProcessedImage {
  previewUri: string;  // caminho local — Image component do RN renderiza com dimensões automáticas
  uploadUrl: string;   // data:image/jpeg;base64,... — enviado ao servidor
}

async function processImage(
  asset: { uri: string; width?: number; height?: number },
): Promise<ProcessedImage | null> {
  const w = asset.width ?? MAX_SIDE;
  const h = asset.height ?? MAX_SIDE;
  const resizeOp = w > MAX_SIDE || h > MAX_SIDE
    ? [{ resize: w >= h ? { width: MAX_SIDE } : { height: MAX_SIDE } }]
    : [];

  try {
    const processed = await ImageManipulator.manipulateAsync(
      asset.uri,
      resizeOp,
      { compress: 0.80, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!processed.base64) return null;
    return {
      previewUri: processed.uri,
      uploadUrl: `data:image/jpeg;base64,${processed.base64}`,
    };
  } catch {
    return null;
  }
}

async function pickFeedImage(): Promise<{ uri: string; width?: number; height?: number } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permissão necessária", "Permita acesso à galeria para publicar uma foto.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0];
}

async function takeFeedPhoto(): Promise<{ uri: string; width?: number; height?: number } | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permissão necessária", "Permita acesso à câmera para tirar uma foto.");
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: "images",
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0];
}

export default function FeedScreen() {
  const { user } = useAuthStore();
  const themeMode = useUIStore((state) => state.themeMode);
  const profileImageUri = useUIStore((state) => state.profileImageUri);
  const insets = useSafeAreaInsets();
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [postText, setPostText] = useState("");
  const [postImagePreview, setPostImagePreview] = useState(""); // data URI usada na prévia
  const [postImageUrl, setPostImageUrl] = useState("");         // data URI enviada ao servidor
  const [pickingImage, setPickingImage] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<"friends" | "for-you">("for-you");
  const inputRef = useRef<TextInput>(null);

  function openComposer() {
    setShowComposer(true);
    setTimeout(() => inputRef.current?.focus(), 300);
  }

  function clearImage() {
    setPostImagePreview("");
    setPostImageUrl("");
  }

  function closeComposer() {
    setShowComposer(false);
    setPostText("");
    clearImage();
  }

  const {
    data: feedPages,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<FeedPage>({
    queryKey: ["feed", feedMode],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { mode: feedMode, limit: FEED_PAGE_SIZE };
      if (typeof pageParam === "string" && pageParam) params.cursor = pageParam;
      const res = await api.get("/api/feed", { params });
      const nextCursor = (res.headers["x-feed-next-cursor"] as string | undefined) ?? null;
      return { items: res.data as FeedPost[], nextCursor };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60 * 1000,
  });

  const feed = useMemo<FeedPost[]>(
    () => feedPages?.pages.flatMap((page) => page.items) ?? [],
    [feedPages],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { data: suggestions = [] } = useQuery<ConnectionSuggestion[]>({
    queryKey: ["connection-suggestions"],
    queryFn: () => api.get("/api/connections/suggestions").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const createPost = useMutation({
    mutationFn: ({ content, imageUrl }: { content: string; imageUrl?: string }) => api.post("/api/posts", { content, imageUrl: imageUrl || null }).then((r) => r.data),
    onSuccess: (newPost) => {
      const optimistic: FeedPost = {
        ...newPost,
        author: {
          id: user!.id,
          username: user!.username,
          displayName: user!.displayName || null,
          level: user!.level,
          avatarUrl: user!.avatarUrl || profileImageUri,
        },
        likesCount: 0,
        liked: false,
        commentsCount: 0,
      };
      queryClient.setQueryData<InfiniteData<FeedPage>>(["feed", feedMode], (prev) => {
        if (!prev || prev.pages.length === 0) {
          return { pages: [{ items: [optimistic], nextCursor: null }], pageParams: [null] };
        }
        const [first, ...rest] = prev.pages;
        return {
          ...prev,
          pages: [{ ...first, items: [optimistic, ...first.items] }, ...rest],
        };
      });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setPostText("");
      clearImage();
      closeComposer();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Não foi possível publicar. Tente novamente.";
      Alert.alert("Erro ao publicar", msg);
    },
  });

  const likePost = useMutation({
    mutationFn: (postId: string) => api.post(`/api/posts/${postId}/like`).then((r) => r.data),
    // Optimistic update lives no PostCard local state; nada de invalidar o feed inteiro a cada toque.
  });

  const sendConnection = useMutation({
    mutationFn: (targetUserId: string) => api.post("/api/connections", { targetUserId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connection-suggestions"] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  function handlePost() {
    if (!postText.trim() && !postImageUrl) return;
    if (postText.trim().length > 500) {
      Alert.alert("Post muito longo", "Maximo de 500 caracteres.");
      return;
    }
    createPost.mutate({ content: postText.trim() || "Imagem compartilhada", imageUrl: postImageUrl });
  }

  const authorName = user?.displayName || user?.username || "?";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Composer Modal ── */}
      <Modal
        visible={showComposer}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={closeComposer}
      >
        <View style={{ flex: 1 }}>
          {/* Dimmer */}
          <TouchableOpacity style={styles.composerBackdrop} activeOpacity={1} onPress={closeComposer} />
          {/* Sheet */}
          <KeyboardAvoidingView
            style={styles.composerKeyboard}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
          >
            <View style={styles.composerSheet}>
              {/* Handle */}
              <View style={styles.composerHandle} />

              {/* Header */}
              <View style={styles.composerHeader}>
                <UserAvatar name={authorName} avatarUrl={user?.avatarUrl || profileImageUri} size={40} backgroundColor={colors.primary} color="#1A1A1A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.composerName}>{user?.displayName || user?.username}</Text>
                  <Text style={styles.composerSub}>Publicação pública</Text>
                </View>
                <TouchableOpacity onPress={closeComposer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x" size={22} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.composerScroll}
                contentContainerStyle={styles.composerScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
              {/* Text input */}
              <TextInput
                ref={inputRef}
                style={styles.composerInput}
                placeholder="O que você está pensando?"
                placeholderTextColor={colors.muted}
                multiline
                maxLength={500}
                value={postText}
                onChangeText={setPostText}
                textAlignVertical="top"
              />

              {/* Image preview */}
              {postImagePreview ? (
                <View style={styles.composerImageWrap}>
                  <Image source={{ uri: postImagePreview }} style={styles.composerImage} resizeMode="contain" />
                  <TouchableOpacity
                    onPress={clearImage}
                    style={styles.composerImageRemove}
                  >
                    <Feather name="x" size={16} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.composerImageLabel}>
                    <Feather name="image" size={12} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600", marginLeft: 4 }}>Foto anexada</Text>
                  </View>
                </View>
              ) : null}
              </ScrollView>

              {/* Action bar */}
              <View style={[styles.composerActions, { paddingBottom: insets.bottom + 8 }]}>
                {/* Câmera */}
                <TouchableOpacity
                  style={styles.composerActionBtn}
                  disabled={pickingImage}
                  onPress={async () => {
                    setPickingImage(true);
                    try {
                      const asset = await takeFeedPhoto();
                      if (asset) {
                        const result = await processImage(asset);
                        if (result) {
                          setPostImagePreview(result.previewUri);
                          setPostImageUrl(result.uploadUrl);
                        } else {
                          Alert.alert("Erro", "Não foi possível preparar a foto. Tente outra imagem.");
                        }
                      }
                    } finally { setPickingImage(false); }
                  }}
                >
                  <Feather name="camera" size={20} color={colors.primaryDark} />
                  <Text style={styles.composerActionLabel}>Câmera</Text>
                </TouchableOpacity>

                {/* Galeria */}
                <TouchableOpacity
                  style={styles.composerActionBtn}
                  disabled={pickingImage}
                  onPress={async () => {
                    setPickingImage(true);
                    try {
                      const asset = await pickFeedImage();
                      if (asset) {
                        const result = await processImage(asset);
                        if (result) {
                          setPostImagePreview(result.previewUri);
                          setPostImageUrl(result.uploadUrl);
                        } else {
                          Alert.alert("Erro", "Não foi possível preparar a foto. Tente outra imagem.");
                        }
                      }
                    } finally { setPickingImage(false); }
                  }}
                >
                  <Feather name={postImageUrl ? "refresh-cw" : "image"} size={20} color={colors.primaryDark} />
                  <Text style={styles.composerActionLabel}>{postImageUrl ? "Trocar" : "Galeria"}</Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                {/* Char count */}
                <Text style={[styles.composerCharCount, postText.length > 450 && { color: colors.destructive }]}>
                  {postText.length}/500
                </Text>

                {/* Publicar */}
                <TouchableOpacity
                  style={[
                    styles.composerPublishBtn,
                    ((!postText.trim() && !postImageUrl) || createPost.isPending || pickingImage) && styles.composerPublishDisabled,
                  ]}
                  onPress={handlePost}
                  disabled={(!postText.trim() && !postImageUrl) || createPost.isPending || pickingImage}
                >
                  <Text style={styles.composerPublishText}>
                    {createPost.isPending ? "Publicando..." : pickingImage ? "Preparando..." : "Publicar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />

      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <View>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Feed</Text>
              <View style={styles.feedModeTabs}>
                {([
                  ["friends", "Amigos"],
                  ["for-you", "Para Você"],
                ] as const).map(([mode, label]) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.feedModeTab, feedMode === mode && styles.feedModeTabActive]}
                    onPress={() => setFeedMode(mode)}
                  >
                    <Text style={[styles.feedModeText, feedMode === mode && styles.feedModeTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Text style={styles.headerSubtitle}>Compartilhe e acompanhe sua rede</Text>
          </View>
        </View>

        <View style={styles.fixedComposerWrap}>
          <TouchableOpacity style={styles.composerTrigger} onPress={openComposer} activeOpacity={0.75}>
            <UserAvatar name={authorName} avatarUrl={user?.avatarUrl || profileImageUri} size={36} backgroundColor={colors.primary} color="#1A1A1A" />
            <Text style={styles.composerTriggerPlaceholder}>O que você está pensando?</Text>
            <View style={styles.composerTriggerPhotoBtn}>
              <Feather name="image" size={16} color={colors.primaryDark} />
            </View>
          </TouchableOpacity>
        </View>

        <FlatList
          data={feed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.feedFooterLoading}>
                <FeedPostSkeleton styles={styles} />
              </View>
            ) : null
          }
          ListHeaderComponent={
            <View>
              <TouchableOpacity style={[styles.composerTrigger, { display: "none" }]} onPress={openComposer} activeOpacity={0.75}>
                <UserAvatar name={authorName} avatarUrl={user?.avatarUrl || profileImageUri} size={36} backgroundColor={colors.primary} color="#1A1A1A" />
                <Text style={styles.composerTriggerPlaceholder}>O que você está pensando?</Text>
                <View style={styles.composerTriggerPhotoBtn}>
                  <Feather name="image" size={16} color={colors.primaryDark} />
                </View>
              </TouchableOpacity>

              {suggestions.length > 0 && (
                <View style={styles.suggestionsCard}>
                  <Text style={styles.sectionTitle}>Sugestões de conexão</Text>
                  {suggestions.map((s) => (
                    <View key={s.id} style={styles.suggestionRow}>
                      <TouchableOpacity onPress={() => setProfileUserId(s.id)}>
                        <UserAvatar name={displayNameOf(s)} avatarUrl={s.avatarUrl} size={42} backgroundColor={colors.secondary} color={colors.foreground} />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <View style={styles.suggestionTopRow}>
                          <TouchableOpacity onPress={() => setProfileUserId(s.id)}>
                            <Text style={styles.suggestionName}>{displayNameOf(s)}</Text>
                          </TouchableOpacity>
                          {typeof s.matchScore === "number" ? (
                            <View style={styles.matchBadge}>
                              <Text style={styles.matchBadgeText}>{s.matchScore}% match</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.suggestionInterests} numberOfLines={2}>
                          {s.commonInterests.slice(0, 3).join(" • ") || s.suggestionMessage || "Boa conexão para você"}
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
            </View>
          }
          ListEmptyComponent={
            isLoading ? (
              <View>
                <FeedPostSkeleton styles={styles} />
                <FeedPostSkeleton styles={styles} />
                <FeedPostSkeleton styles={styles} />
              </View>
            ) : isError ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📡</Text>
                <Text style={styles.emptyTitle}>Não conseguimos carregar seu feed</Text>
                <Text style={styles.emptyDesc}>Verifique sua conexão e tente de novo.</Text>
                <TouchableOpacity style={styles.feedRetryBtn} onPress={() => refetch()}>
                  <Text style={styles.feedRetryBtnText}>Tentar de novo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🌐</Text>
                <Text style={styles.emptyTitle}>Seu feed está vazio</Text>
                <Text style={styles.emptyDesc}>Publique algo ou conecte-se com outros usuários para ver conteúdos aqui.</Text>
              </View>
            )
          }
          renderItem={({ item: post }) => (
            <PostCard
              post={{ ...post, commentsCount: post.commentsCount ?? 0 }}
              onLike={() => likePost.mutate(post.id)}
              isLiking={likePost.isPending}
              colors={colors}
              currentUserId={user?.id}
              onOpenProfile={setProfileUserId}
            />
          )}
        />
      </View>
    </View>
  );
}

function PostCard({
  post,
  onLike,
  isLiking,
  colors,
  currentUserId,
  onOpenProfile,
}: {
  post: FeedPost & { commentsCount: number };
  onLike: () => void;
  isLiking: boolean;
  colors: ReturnType<typeof getThemeColors>;
  currentUserId?: string;
  onOpenProfile: (userId: string) => void;
}) {
  const queryClient = useQueryClient();
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
  const [menuVisible, setMenuVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const [currentContent, setCurrentContent] = useState(post.content);
  const isOwner = currentUserId === post.author.id;

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
          username: data.username || "Você",
          displayName: data.displayName || null,
          avatarUrl: data.avatarUrl || null,
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

  async function handleEdit() {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === currentContent) { setEditVisible(false); return; }
    try {
      await api.patch(`/api/posts/${post.id}`, { content: trimmed });
      setCurrentContent(trimmed);
      setEditVisible(false);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    } catch {
      Alert.alert("Erro", "Não foi possível editar o post.");
    }
  }

  function handleDelete() {
    Alert.alert("Apagar post", "Tem certeza que deseja apagar este post?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar", style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/posts/${post.id}`);
            queryClient.invalidateQueries({ queryKey: ["feed"] });
          } catch {
            Alert.alert("Erro", "Não foi possível apagar o post.");
          }
        },
      },
    ]);
  }

  const authorName = displayNameOf(post.author);

  return (
    <View style={styles.postCard}>
      {/* Menu de opções do dono */}
      {isOwner && (
        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <TouchableOpacity style={styles.postMenuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
            <View style={styles.postMenuSheet}>
              <TouchableOpacity style={styles.postMenuItem} onPress={() => { setMenuVisible(false); setEditText(currentContent); setEditVisible(true); }}>
                <Feather name="edit-2" size={16} color={colors.foreground} />
                <Text style={styles.postMenuItemText}>Editar post</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.postMenuItem} onPress={() => { setMenuVisible(false); handleDelete(); }}>
                <Feather name="trash-2" size={16} color={colors.destructive} />
                <Text style={[styles.postMenuItemText, { color: colors.destructive }]}>Apagar post</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Modal de edição */}
      {isOwner && (
        <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
          <TouchableOpacity style={styles.postMenuOverlay} activeOpacity={1} onPress={() => setEditVisible(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.editSheet}>
              <Text style={styles.editSheetTitle}>Editar post</Text>
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                multiline
                maxLength={500}
                autoFocus
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.editCharCount}>{editText.length}/500</Text>
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditVisible(false)}>
                  <Text style={styles.editCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editSaveBtn} onPress={handleEdit}>
                  <Text style={styles.editSaveText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <View style={styles.postHeader}>
        <TouchableOpacity onPress={() => onOpenProfile(post.author.id)}>
          <UserAvatar name={authorName} avatarUrl={post.author.avatarUrl} size={44} backgroundColor={colors.primary} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={styles.postAuthorRow}>
            <TouchableOpacity onPress={() => onOpenProfile(post.author.id)}>
              <Text style={styles.postAuthorName}>{authorName}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
        </View>
        {sentimentEmoji ? (
          <View style={styles.sentimentBadge}>
            <Text style={styles.sentimentEmoji}>{sentimentEmoji}</Text>
            {post.sentimentLabel ? <Text style={styles.sentimentLabel}>{post.sentimentLabel}</Text> : null}
          </View>
        ) : null}
        {isOwner && (
          <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="more-horizontal" size={20} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.postContent}>{currentContent}</Text>
      {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="contain" /> : null}

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
            <Text style={styles.forYouTag}>Por que isso apareceu para você</Text>
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
          <Feather name="heart" size={15} color={liked ? colors.destructive : colors.muted} />
          {likesCount > 0 ? <Text style={styles.actionBtnText}>{likesCount}</Text> : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, expanded && styles.commentBtnActive]}
          onPress={handleToggleComments}
        >
          <Feather name="message-circle" size={15} color={expanded ? colors.primaryDark : colors.muted} />
          {commentsCount > 0 ? <Text style={styles.actionBtnText}>{commentsCount}</Text> : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Feather name="share-2" size={15} color={colors.muted} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[styles.actionBtn, bookmarked && styles.bookmarkBtnActive]}
          onPress={() => setBookmarked((v) => !v)}
        >
          <Feather name="bookmark" size={15} color={bookmarked ? colors.success : colors.muted} />
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
            return (
              <View key={comment.id} style={styles.commentRow}>
                <TouchableOpacity onPress={() => onOpenProfile(comment.userId)}>
                  <UserAvatar name={cName} avatarUrl={comment.avatarUrl} size={28} backgroundColor={colors.secondary} color={colors.foreground} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <View style={styles.commentBubble}>
                    <TouchableOpacity onPress={() => onOpenProfile(comment.userId)}>
                      <Text style={styles.commentName}>{cName}</Text>
                    </TouchableOpacity>
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
    headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    feedModeTabs: { flexDirection: "row", backgroundColor: colors.secondary, borderRadius: 12, padding: 2 },
    feedModeTab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    feedModeTabActive: { backgroundColor: colors.card },
    feedModeText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.muted },
    feedModeTextActive: { color: colors.foreground },
    headerSubtitle: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
    newPostBtn: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    newPostBtnText: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 13, color: "#1A1A1A" },
    content: { padding: 16, gap: 12, paddingBottom: 32 },
    fixedComposerWrap: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, zIndex: 2 },

    // ── Composer trigger row ──
    composerTrigger: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    composerTriggerAvatar: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    composerTriggerAvatarText: { fontFamily: FONTS.display, fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
    composerTriggerPlaceholder: { flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: colors.muted },
    composerTriggerPhotoBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: colors.primary + "22",
      alignItems: "center", justifyContent: "center",
    },

    // ── Composer bottom sheet ──
    composerSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 10,
      maxHeight: "88%",
    },
    composerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
    composerKeyboard: { flex: 1, justifyContent: "flex-end" },
    composerHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: 14,
    },
    composerHeader: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 18, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    composerAvatar: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    composerAvatarText: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: "#1A1A1A" },
    composerName: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 15, color: colors.foreground },
    composerSub: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 1 },
    composerInput: {
      fontFamily: FONTS.sans, fontSize: 16, color: colors.foreground,
      minHeight: 110, maxHeight: 200,
      paddingHorizontal: 18, paddingVertical: 14,
      textAlignVertical: "top",
    },
    composerScroll: { maxHeight: 520 },
    composerScrollContent: { paddingBottom: 2 },
    composerImageWrap: {
      position: "relative",
      marginHorizontal: 18,
      marginBottom: 10,
      borderRadius: 14,
      overflow: "hidden",
    },
    composerImage: { width: "100%", height: 260, maxHeight: 320, backgroundColor: colors.secondary },
    composerImageRemove: {
      position: "absolute", top: 8, right: 8,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 16, padding: 6,
    },
    composerImageLabel: {
      position: "absolute", bottom: 8, left: 8,
      flexDirection: "row", alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
    },
    composerActions: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 14, paddingTop: 10,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    composerActionBtn: {
      alignItems: "center", gap: 3,
      paddingHorizontal: 10, paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: colors.primary + "18",
      minWidth: 64,
    },
    composerActionLabel: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "700", color: colors.primaryDark },
    composerCharCount: { fontFamily: FONTS.mono, fontSize: 12, color: colors.muted },
    composerPublishBtn: {
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingHorizontal: 20, paddingVertical: 10,
    },
    composerPublishDisabled: { opacity: 0.45 },
    composerPublishText: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 14, color: "#1A1A1A" },

    publishBtnDisabled: { opacity: 0.5 },
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
    postMenuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
    postMenuSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 8, paddingBottom: 32 },
    postMenuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
    postMenuItemText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "600", color: colors.foreground },
    editSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 12 },
    editSheetTitle: { fontFamily: FONTS.display, fontSize: 17, fontWeight: "800", color: colors.foreground },
    editInput: { backgroundColor: colors.background, borderRadius: 14, padding: 14, fontSize: 15, fontFamily: FONTS.sans, color: colors.foreground, minHeight: 100, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border },
    editCharCount: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted, textAlign: "right" },
    editActions: { flexDirection: "row", gap: 10 },
    editCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.secondary, alignItems: "center" },
    editCancelText: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.foreground },
    editSaveBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center" },
    editSaveText: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
    postContent: { fontFamily: FONTS.sans, fontSize: 15, color: colors.foreground, lineHeight: 22 },
    postImage: { width: "100%", height: 260, maxHeight: 400, borderRadius: 16, backgroundColor: colors.background },
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
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
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
    feedRetryBtn: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.primary },
    feedRetryBtnText: { fontFamily: FONTS.sans, fontWeight: "700", color: "#1A1A1A" },
    feedFooterLoading: { paddingTop: 4 },
    skeletonCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, gap: 12, borderWidth: 1, borderColor: colors.border },
    skeletonRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    skeletonAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, opacity: 0.18 },
    skeletonLineSm: { height: 10, borderRadius: 4, backgroundColor: colors.muted, opacity: 0.18, width: "40%" },
    skeletonLine: { height: 12, borderRadius: 4, backgroundColor: colors.muted, opacity: 0.18, width: "85%" },
    skeletonLineShort: { height: 12, borderRadius: 4, backgroundColor: colors.muted, opacity: 0.18, width: "60%" },
    skeletonImage: { height: 160, borderRadius: 12, backgroundColor: colors.muted, opacity: 0.12 },
  });
}

function FeedPostSkeleton({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonAvatar} />
        <View style={{ gap: 6, flex: 1 }}>
          <View style={styles.skeletonLineSm} />
          <View style={[styles.skeletonLineSm, { width: "25%" }]} />
        </View>
      </View>
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonLineShort} />
      <View style={styles.skeletonImage} />
    </View>
  );
}
