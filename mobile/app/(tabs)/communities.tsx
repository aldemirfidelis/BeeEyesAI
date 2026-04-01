import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Community, CommunityPost, displayNameOf, timeAgo } from "../../lib/social";
import { FONTS, getThemeColors } from "../../lib/theme";
import { useUIStore } from "../../stores/uiStore";

interface CommunityComment {
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

const DEFAULT_COMMUNITY = { name: "", description: "", category: "geral", emoji: "🐝" };

// ── Community List ────────────────────────────────────────────────────────────
function CommunityList({
  onSelect, colors, styles, insets, onOpenCreate,
}: {
  onSelect: (c: Community) => void;
  colors: any; styles: any; insets: any;
  onOpenCreate: () => void;
}) {
  const [search, setSearch] = useState("");

  const communitiesQuery = useQuery<Community[]>({
    queryKey: ["communities", search],
    queryFn: () => api.get(`/api/communities?search=${encodeURIComponent(search)}`).then((r) => r.data),
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>Comunidades</Text>
        <TouchableOpacity style={styles.createBtn} onPress={onOpenCreate}>
          <Feather name="plus" size={18} color="#1A1A1A" />
          <Text style={styles.createBtnText}>Nova</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar comunidade..."
          placeholderTextColor={colors.muted}
        />
      </View>

      {communitiesQuery.isLoading ? (
        <ActivityIndicator color={colors.primaryDark} style={{ marginTop: 40 }} />
      ) : communitiesQuery.data?.length ? (
        <FlatList
          data={communitiesQuery.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.communityRow} onPress={() => onSelect(item)} activeOpacity={0.7}>
              <Text style={styles.communityEmoji}>{item.emoji}</Text>
              <View style={styles.communityBody}>
                <View style={styles.communityTopRow}>
                  <Text style={styles.communityName}>{item.name}</Text>
                  {item.isMember && (
                    <View style={styles.memberBadge}>
                      <Text style={styles.memberBadgeText}>Membro</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.communityMeta}>{item.membersCount} membros • {item.category}</Text>
                {item.description ? (
                  <Text style={styles.communityDesc} numberOfLines={1}>{item.description}</Text>
                ) : null}
              </View>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.empty}>
          <Feather name="users" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Nenhuma comunidade</Text>
          <Text style={styles.emptyText}>Crie ou busque uma comunidade para participar.</Text>
        </View>
      )}
    </View>
  );
}

// ── Community Detail ──────────────────────────────────────────────────────────
function CommunityDetail({
  community, onBack, colors, styles, insets,
}: {
  community: Community;
  onBack: () => void;
  colors: any; styles: any; insets: any;
}) {
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState("");

  const detailQuery = useQuery<Community>({
    queryKey: ["community", community.id],
    queryFn: () => api.get(`/api/communities/${community.id}`).then((r) => r.data),
  });

  const postsQuery = useQuery<CommunityPost[]>({
    queryKey: ["community-posts", community.id],
    queryFn: () => api.get(`/api/communities/${community.id}/posts`).then((r) => r.data),
    refetchInterval: 10000,
  });

  const detail = detailQuery.data || community;

  const joinCommunity = useMutation({
    mutationFn: () => api.post(`/api/communities/${community.id}/join`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["community", community.id] });
    },
  });

  const leaveCommunity = useMutation({
    mutationFn: () => api.post(`/api/communities/${community.id}/leave`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["community", community.id] });
    },
  });

  const createPost = useMutation({
    mutationFn: (content: string) =>
      api.post(`/api/communities/${community.id}/posts`, { content }).then((r) => r.data),
    onSuccess: () => {
      setNewPost("");
      queryClient.invalidateQueries({ queryKey: ["community-posts", community.id] });
    },
    onError: (error: any) => {
      Alert.alert("Erro", error?.response?.data?.message || "Nao foi possivel publicar.");
    },
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.detailEmoji}>{detail.emoji}</Text>
        <View style={styles.detailHeaderInfo}>
          <Text style={styles.detailName} numberOfLines={1}>{detail.name}</Text>
          <Text style={styles.detailMeta}>{detail.membersCount} membros • {detail.category}</Text>
        </View>
        <TouchableOpacity
          style={[styles.joinBtn, detail.isMember && styles.leaveBtn]}
          onPress={() => detail.isMember ? leaveCommunity.mutate() : joinCommunity.mutate()}
          disabled={joinCommunity.isPending || leaveCommunity.isPending}
        >
          <Text style={[styles.joinBtnText, detail.isMember && styles.leaveBtnText]}>
            {detail.isMember ? "Sair" : "Entrar"}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.postsList}>
          {detail.description ? (
            <Text style={styles.detailDesc}>{detail.description}</Text>
          ) : null}

          {postsQuery.isLoading ? (
            <ActivityIndicator color={colors.primaryDark} style={{ marginTop: 24 }} />
          ) : postsQuery.data?.length ? (
            postsQuery.data.map((post) => (
              <CommunityPostCard
                key={post.id}
                post={post}
                colors={colors}
                communityName={detail.name}
                communityEmoji={detail.emoji}
              />
            ))
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Sem posts ainda. Seja o primeiro! 👇</Text>
            </View>
          )}
        </ScrollView>

        {detail.isMember && (
          <View style={[styles.inputRow, { paddingBottom: insets.bottom + 6 }]}>
            <TextInput
              style={styles.postInput}
              value={newPost}
              onChangeText={setNewPost}
              placeholder="Compartilhe algo..."
              placeholderTextColor={colors.muted}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!newPost.trim() || createPost.isPending) && styles.sendBtnDisabled]}
              onPress={() => { if (newPost.trim()) createPost.mutate(newPost.trim()); }}
              disabled={!newPost.trim() || createPost.isPending}
            >
              <Feather name="send" size={18} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CommunitiesScreen() {
  const themeMode = useUIStore((state) => state.themeMode);
  const insets = useSafeAreaInsets();
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Community | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [communityForm, setCommunityForm] = useState(DEFAULT_COMMUNITY);

  const createCommunity = useMutation({
    mutationFn: () => api.post("/api/communities", communityForm).then((r) => r.data),
    onSuccess: (created) => {
      setShowCreateModal(false);
      setCommunityForm(DEFAULT_COMMUNITY);
      setSelected(created);
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error: any) => {
      Alert.alert("Erro", error?.response?.data?.message || "Nao foi possivel criar a comunidade.");
    },
  });

  return (
    <>
      {selected ? (
        <CommunityDetail
          community={selected}
          onBack={() => setSelected(null)}
          colors={colors}
          styles={styles}
          insets={insets}
        />
      ) : (
        <CommunityList
          onSelect={setSelected}
          colors={colors}
          styles={styles}
          insets={insets}
          onOpenCreate={() => setShowCreateModal(true)}
        />
      )}

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nova comunidade</Text>
            <TextInput
              style={styles.modalInput}
              value={communityForm.name}
              onChangeText={(v) => setCommunityForm((p) => ({ ...p, name: v }))}
              placeholder="Nome"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={styles.modalInput}
              value={communityForm.emoji}
              onChangeText={(v) => setCommunityForm((p) => ({ ...p, emoji: v || "🐝" }))}
              placeholder="Emoji"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={styles.modalInput}
              value={communityForm.category}
              onChangeText={(v) => setCommunityForm((p) => ({ ...p, category: v || "geral" }))}
              placeholder="Categoria"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              value={communityForm.description}
              onChangeText={(v) => setCommunityForm((p) => ({ ...p, description: v }))}
              placeholder="Descrição"
              placeholderTextColor={colors.muted}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimary, (!communityForm.name.trim() || createCommunity.isPending) && { opacity: 0.5 }]}
                onPress={() => createCommunity.mutate()}
                disabled={!communityForm.name.trim() || createCommunity.isPending}
              >
                <Text style={styles.modalPrimaryText}>{createCommunity.isPending ? "Criando..." : "Criar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function CommunityPostCard({
  post, colors, communityName, communityEmoji,
}: {
  post: CommunityPost;
  colors: ReturnType<typeof getThemeColors>;
  communityName: string;
  communityEmoji: string;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [liked, setLiked] = useState(post.liked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [expanded, setExpanded] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [recommended, setRecommended] = useState(false);
  const authorName = displayNameOf(post);

  async function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikesCount((c) => c + (next ? 1 : -1));
    try {
      const { data } = await api.post(`/api/communities/posts/${post.id}/like`);
      setLiked(data.liked);
      setLikesCount(data.likesCount);
    } catch {
      setLiked(!next);
      setLikesCount((c) => c + (next ? -1 : 1));
    }
  }

  async function handleToggleComments() {
    if (!expanded && !commentsLoaded) {
      setCommentsLoading(true);
      try {
        const { data } = await api.get(`/api/communities/posts/${post.id}/comments`);
        setComments(data);
        setCommentsLoaded(true);
      } finally {
        setCommentsLoading(false);
      }
    }
    setExpanded((v) => !v);
  }

  async function handleCommentLike(commentId: string) {
    setComments((prev) =>
      prev.map((c) => c.id === commentId ? { ...c, liked: !c.liked, likesCount: c.likesCount + (c.liked ? -1 : 1) } : c)
    );
    try {
      const { data } = await api.post(`/api/communities/comments/${commentId}/like`);
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, liked: data.liked, likesCount: data.likesCount } : c));
    } catch { }
  }

  async function handleSendComment() {
    if (!commentInput.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/api/communities/posts/${post.id}/comments`, { content: commentInput.trim() });
      setComments((prev) => [...prev, data]);
      setCommentsCount((c) => c + 1);
      setCommentInput("");
      setCommentsLoaded(true);
    } finally {
      setSending(false);
    }
  }

  async function handleRecommend() {
    if (recommending || recommended) return;
    setRecommending(true);
    try {
      await api.post(`/api/communities/posts/${post.id}/recommend`, { communityId: post.communityId, communityName, communityEmoji, content: post.content });
      setRecommended(true);
    } finally {
      setRecommending(false);
    }
  }

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.postAvatar}>
          <Text style={styles.postAvatarText}>{authorName[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.postAuthor}>{authorName}</Text>
          <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      <Text style={styles.postContent}>{post.content}</Text>

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Text style={styles.actionBtnText}>{liked ? "❤️" : "🤍"} {likesCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleToggleComments}>
          <Text style={styles.actionBtnText}>💬 {commentsCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRecommend} disabled={recommending || recommended}>
          <Text style={styles.actionBtnText}>{recommended ? "✅" : recommending ? "..." : "📌"}</Text>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.commentsSection}>
          {commentsLoading && <Text style={styles.commentHint}>Carregando...</Text>}
          {!commentsLoading && comments.length === 0 && <Text style={styles.commentHint}>Nenhum comentário ainda.</Text>}
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
              placeholder="Comentar..."
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity
              style={[styles.commentSendBtn, (!commentInput.trim() || sending) && { opacity: 0.5 }]}
              onPress={handleSendComment}
              disabled={!commentInput.trim() || sending}
            >
              <Text style={styles.commentSendBtnText}>{sending ? "..." : "Enviar"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },

    // List
    listHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    listHeaderTitle: { fontFamily: FONTS.display, fontSize: 24, fontWeight: "800", color: colors.foreground },
    createBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
    },
    createBtnText: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 13, color: "#1A1A1A" },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      color: colors.foreground,
      fontFamily: FONTS.sans,
      fontSize: 14,
    },
    communityRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    communityEmoji: { fontSize: 32, width: 42, textAlign: "center" },
    communityBody: { flex: 1, gap: 3 },
    communityTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    communityName: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "700", color: colors.foreground, flex: 1 },
    memberBadge: {
      backgroundColor: colors.primary + "33",
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    memberBadgeText: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "700", color: colors.primaryDark },
    communityMeta: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    communityDesc: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },

    // Detail header
    detailHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    backBtnText: {
      fontFamily: FONTS.sans,
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    detailEmoji: { fontSize: 28 },
    detailHeaderInfo: { flex: 1 },
    detailName: { fontFamily: FONTS.sans, fontSize: 16, fontWeight: "700", color: colors.foreground },
    detailMeta: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    detailDesc: {
      fontFamily: FONTS.sans,
      fontSize: 13,
      color: colors.muted,
      lineHeight: 20,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    joinBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    joinBtnText: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 13, color: "#1A1A1A" },
    leaveBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.destructive + "66" },
    leaveBtnText: { color: colors.destructive },

    // Posts
    postsList: { padding: 16, gap: 12 },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    postInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 100,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingVertical: 11,
      fontFamily: FONTS.sans,
      fontSize: 14,
      color: colors.foreground,
    },
    sendBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    sendBtnDisabled: { opacity: 0.4 },
    postCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    postHeader: { flexDirection: "row", gap: 10, alignItems: "center" },
    postAvatar: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.secondary,
      alignItems: "center", justifyContent: "center",
    },
    postAvatarText: { fontFamily: FONTS.display, fontWeight: "700", color: colors.foreground },
    postAuthor: { fontFamily: FONTS.sans, fontWeight: "700", color: colors.foreground, fontSize: 13 },
    postTime: { fontFamily: FONTS.sans, color: colors.muted, fontSize: 11 },
    postContent: { fontFamily: FONTS.sans, color: colors.foreground, fontSize: 14, lineHeight: 21 },
    postActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    actionBtn: {
      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
      backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border,
    },
    actionBtnText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.foreground },
    commentsSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 10 },
    commentHint: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, textAlign: "center" },
    commentRow: { flexDirection: "row", gap: 8 },
    commentAvatar: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: colors.secondary,
      alignItems: "center", justifyContent: "center", marginTop: 2,
    },
    commentAvatarText: { fontFamily: FONTS.display, fontSize: 12, fontWeight: "700", color: colors.foreground },
    commentBubble: {
      backgroundColor: colors.background, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 10, paddingVertical: 8,
    },
    commentName: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 12, color: colors.foreground, marginBottom: 2 },
    commentText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, lineHeight: 18 },
    commentFooter: { flexDirection: "row", gap: 12, paddingLeft: 4, paddingTop: 4 },
    commentFooterText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted },
    commentComposer: { flexDirection: "row", gap: 8, paddingTop: 4 },
    commentInput: {
      flex: 1, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.background, borderRadius: 12,
      paddingHorizontal: 12, paddingVertical: 10,
      fontFamily: FONTS.sans, color: colors.foreground,
    },
    commentSendBtn: { borderRadius: 12, paddingHorizontal: 12, justifyContent: "center", backgroundColor: colors.primary },
    commentSendBtnText: { fontFamily: FONTS.sans, fontWeight: "700", color: "#1A1A1A" },

    // Empty
    empty: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12, paddingTop: 60 },
    emptyTitle: { fontFamily: FONTS.display, fontSize: 20, fontWeight: "700", color: colors.foreground, textAlign: "center" },
    emptyText: { fontFamily: FONTS.sans, fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
    modalTitle: { fontFamily: FONTS.display, fontSize: 22, color: colors.foreground, fontWeight: "700" },
    modalInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 14,
      backgroundColor: colors.background, color: colors.foreground,
      paddingHorizontal: 14, paddingVertical: 12, fontFamily: FONTS.sans,
    },
    modalTextarea: { minHeight: 80, textAlignVertical: "top" },
    modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
    modalSecondary: { flex: 1, borderRadius: 14, backgroundColor: colors.secondary, paddingVertical: 14, alignItems: "center" },
    modalSecondaryText: { fontFamily: FONTS.sans, fontWeight: "700", color: colors.foreground },
    modalPrimary: { flex: 1, borderRadius: 14, backgroundColor: colors.primary, paddingVertical: 14, alignItems: "center" },
    modalPrimaryText: { fontFamily: FONTS.sans, fontWeight: "700", color: "#1A1A1A" },
  });
}
