import { useCallback, useMemo, useState } from "react";
import { Switch } from "react-native";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { api } from "@mobile/lib/api";
import { Community, CommunityMember, CommunityPost, displayNameOf, timeAgo } from "@mobile/lib/social";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";
import { useAuthStore } from "@mobile/stores/authStore";
import { UserAvatar } from "@mobile/components/UserAvatar";
import { UserProfileModal } from "@mobile/components/UserProfileModal";

interface CommunityComment {
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

type CommunityFriend = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  level: number;
};

const DEFAULT_COMMUNITY = { name: "", description: "", category: "geral", emoji: "🐝", imageUrl: "", isPrivate: false };

async function pickCommunityImage(onChange: (imageUrl: string) => void) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permissão necessária", "Permita acesso à galeria para escolher a foto da comunidade.");
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return;

  const processed = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 512, height: 512 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );

  if (!processed.base64) {
    Alert.alert("Erro", "Nao foi possivel preparar a foto da comunidade.");
    return;
  }

  onChange(`data:image/jpeg;base64,${processed.base64}`);
}

const MAX_POST_SIDE = 1080;

interface PostImageResult {
  previewUri: string; // URI local para exibição no Image component do RN
  uploadUrl: string;  // data:image/jpeg;base64,... para envio ao servidor
}

async function processPostImage(asset: { uri: string; width?: number; height?: number }): Promise<PostImageResult | null> {
  const w = asset.width ?? MAX_POST_SIDE;
  const h = asset.height ?? MAX_POST_SIDE;
  const resizeOp = w > MAX_POST_SIDE || h > MAX_POST_SIDE
    ? [{ resize: w >= h ? { width: MAX_POST_SIDE } : { height: MAX_POST_SIDE } }]
    : [];
  try {
    const processed = await ImageManipulator.manipulateAsync(
      asset.uri, resizeOp,
      { compress: 0.80, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!processed.base64) return null;
    return { previewUri: processed.uri, uploadUrl: `data:image/jpeg;base64,${processed.base64}` };
  } catch {
    return null;
  }
}

async function pickPostImage(): Promise<PostImageResult | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permissão necessária", "Permita acesso à galeria para anexar uma imagem.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return processPostImage(result.assets[0]);
}

async function takePostPhoto(): Promise<PostImageResult | null> {
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
  return processPostImage(result.assets[0]);
}

// ── Community List ────────────────────────────────────────────────────────────
function CommunityList({
  onSelect, colors, styles, insets, onOpenCreate, onOpenProfile,
}: {
  onSelect: (c: Community) => void;
  colors: any; styles: any; insets: any;
  onOpenCreate: () => void;
  onOpenProfile: (userId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [membersSheet, setMembersSheet] = useState<Community | null>(null);

  const listMembersQuery = useQuery<CommunityMember[]>({
    queryKey: ["community-members-list", membersSheet?.id],
    queryFn: () => api.get(`/api/communities/${membersSheet!.id}/members`).then((r) => r.data),
    enabled: Boolean(membersSheet),
  });

  const communitiesQuery = useQuery<Community[]>({
    queryKey: ["communities", search],
    queryFn: () => api.get(`/api/communities?search=${encodeURIComponent(search)}`).then((r) => r.data),
  });
  const visibleCommunities = (communitiesQuery.data ?? []).filter((item) => {
    const name = item.name.trim().toLowerCase();
    return !name.startsWith("crew") && !name.startsWith("com");
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Members sheet from list */}
      <Modal visible={Boolean(membersSheet)} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setMembersSheet(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMembersSheet(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.membersSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.membersHeader}>
              <Text style={styles.modalTitle}>
                {membersSheet?.name} · {(listMembersQuery.data ?? []).length} membros
              </Text>
              <TouchableOpacity onPress={() => setMembersSheet(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {(listMembersQuery.isPending || listMembersQuery.isFetching) ? (
              <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: 32 }} />
            ) : listMembersQuery.isError ? (
              <Text style={[styles.memberRole, { textAlign: "center", paddingVertical: 24 }]}>Erro ao carregar membros.</Text>
            ) : (listMembersQuery.data ?? []).length === 0 ? (
              <Text style={[styles.memberRole, { textAlign: "center", paddingVertical: 24 }]}>Nenhum membro encontrado.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {(listMembersQuery.data ?? []).map((member) => (
                  <View key={member.id} style={styles.memberRow}>
                    <TouchableOpacity onPress={() => onOpenProfile(member.id)}>
                      <UserAvatar name={member.displayName || member.username} avatarUrl={member.avatarUrl} size={36} backgroundColor={member.role === "owner" ? colors.primary : colors.secondary} color={colors.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => onOpenProfile(member.id)}>
                      <Text style={styles.memberName}>{member.displayName || member.username}</Text>
                      <Text style={styles.memberRole}>{member.role === "owner" ? "👑 Fundador" : "Membro"}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
      ) : visibleCommunities.length ? (
        <FlatList
          data={visibleCommunities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.communityRow} onPress={() => onSelect(item)} activeOpacity={0.7}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.communityAvatar} />
              ) : (
                <Text style={styles.communityEmoji}>{item.emoji}</Text>
              )}
              <View style={styles.communityBody}>
                <View style={styles.communityTopRow}>
                  <Text style={styles.communityName}>{item.name}</Text>
                  {item.isMember && (
                    <View style={styles.memberBadge}>
                      <Text style={styles.memberBadgeText}>Membro</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); setMembersSheet(item); }} hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}>
                  <Text style={[styles.communityMeta, { color: colors.primaryDark }]}>
                    {item.membersCount} membros 👥 • {item.category}
                  </Text>
                </TouchableOpacity>
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
  community, onBack, colors, styles, insets, currentUserId, onOpenProfile,
}: {
  community: Community;
  onBack: () => void;
  colors: any; styles: any; insets: any;
  currentUserId?: string;
  onOpenProfile: (userId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [editForm, setEditForm] = useState({ name: community.name, description: community.description || "", imageUrl: community.imageUrl || "" });
  const [pickingImage, setPickingImage] = useState(false);
  const [postImagePreview, setPostImagePreview] = useState(""); // URI local para exibição
  const [postImageUrl, setPostImageUrl] = useState("");         // base64 para upload
  const [processingImage, setProcessingImage] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedInviteIds, setSelectedInviteIds] = useState<Set<string>>(new Set());

  function clearPostImage() {
    setPostImagePreview("");
    setPostImageUrl("");
  }

  const detailQuery = useQuery<Community>({
    queryKey: ["community", community.id],
    queryFn: () => api.get(`/api/communities/${community.id}`).then((r) => r.data),
  });

  const friendsQuery = useQuery<CommunityFriend[]>({
    queryKey: ["friends"],
    queryFn: () => api.get(`/api/friends`).then((r) => r.data),
    enabled: showInviteModal,
  });

  const sendInvites = useMutation({
    mutationFn: (userIds: string[]) => api.post(`/api/communities/${community.id}/invite`, { userIds }).then((r) => r.data),
    onSuccess: () => {
      setShowInviteModal(false);
      setSelectedInviteIds(new Set());
      Alert.alert("Sucesso", "Convites enviados com sucesso!");
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível enviar convites.");
    },
  });

  const postsQuery = useQuery<CommunityPost[]>({
    queryKey: ["community-posts", community.id],
    queryFn: () => api.get(`/api/communities/${community.id}/posts`).then((r) => r.data),
    refetchInterval: 10000,
  });
  const membersQuery = useQuery<CommunityMember[]>({
    queryKey: ["community-members", community.id],
    queryFn: () => api.get(`/api/communities/${community.id}/members`).then((r) => r.data),
    enabled: showMembers,
    staleTime: 0,
  });

  const detail = detailQuery.data || community;
  const isOwner = detail.memberRole === "owner";

  const joinCommunity = useMutation({
    mutationFn: () => api.post(`/api/communities/${community.id}/join`).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["community", community.id] });
      if (data?.status === "pending") {
        Alert.alert("Solicitação enviada", "O fundador da comunidade receberá sua solicitação de entrada.");
      }
    },
  });

  const pendingRequestsQuery = useQuery<{ id: string; username: string; displayName: string | null; avatarUrl?: string | null; requestedAt: string }[]>({
    queryKey: ["community-requests", community.id],
    queryFn: () => api.get(`/api/communities/${community.id}/requests`).then((r) => r.data),
    enabled: isOwner && !!detail.isPrivate,
    staleTime: 30000,
  });

  const approveRequest = useMutation({
    mutationFn: (userId: string) => api.post(`/api/communities/${community.id}/requests/${userId}/approve`).then((r) => r.data),
    onSuccess: (_, userId) => {
      queryClient.setQueryData<{ id: string; username: string; displayName: string | null; requestedAt: string }[]>(
        ["community-requests", community.id],
        (prev = []) => prev.filter((r) => r.id !== userId)
      );
      queryClient.invalidateQueries({ queryKey: ["community", community.id] });
    },
  });

  const rejectRequest = useMutation({
    mutationFn: (userId: string) => api.delete(`/api/communities/${community.id}/requests/${userId}`).then((r) => r.data),
    onSuccess: (_, userId) => {
      queryClient.setQueryData<{ id: string; username: string; displayName: string | null; requestedAt: string }[]>(
        ["community-requests", community.id],
        (prev = []) => prev.filter((r) => r.id !== userId)
      );
    },
  });

  const leaveCommunity = useMutation({
    mutationFn: () => api.post(`/api/communities/${community.id}/leave`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["community", community.id] });
      onBack();
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível sair da comunidade.");
    },
  });

  function handleLeave() {
    if (isOwner) {
      Alert.alert(
        "Opções do fundador",
        "Você é o fundador desta comunidade.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Apagar comunidade",
            style: "destructive",
            onPress: () =>
              Alert.alert(
                "Apagar comunidade",
                `Apagar "${detail.name}" permanentemente? Esta ação não pode ser desfeita.`,
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Apagar",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await api.delete(`/api/communities/${community.id}`);
                        queryClient.invalidateQueries({ queryKey: ["communities"] });
                        onBack();
                      } catch {
                        Alert.alert("Erro", "Não foi possível apagar a comunidade.");
                      }
                    },
                  },
                ]
              ),
          },
        ]
      );
      return;
    }
    Alert.alert(
      "Sair da comunidade",
      `Tem certeza que deseja sair de "${detail.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: () => leaveCommunity.mutate() },
      ]
    );
  }

  const createPost = useMutation({
    mutationFn: ({ content, imageUrl }: { content: string; imageUrl?: string }) =>
      api.post(`/api/communities/${community.id}/posts`, { content, imageUrl: imageUrl || null }).then((r) => r.data),
    onSuccess: () => {
      setNewPost("");
      clearPostImage();
      queryClient.invalidateQueries({ queryKey: ["community-posts", community.id] });
    },
    onError: (error: any) => {
      Alert.alert("Erro", error?.response?.data?.message || "Nao foi possivel publicar.");
    },
  });

  const saveCommunity = useMutation({
    mutationFn: () =>
      api.patch(`/api/communities/${community.id}`, {
        name: editForm.name,
        description: editForm.description || null,
        imageUrl: editForm.imageUrl || null,
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["community", community.id] });
      setShowEditModal(false);
    },
    onError: (error: any) => {
      Alert.alert("Erro", error?.response?.data?.message || "Nao foi possivel salvar.");
    },
  });

  const deletePost = useMutation({
    mutationFn: (postId: string) => api.delete(`/api/communities/posts/${postId}`).then((r) => r.data),
    onSuccess: (_, postId) => {
      queryClient.setQueryData<CommunityPost[]>(["community-posts", community.id], (prev = []) => prev.filter((post) => post.id !== postId));
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível apagar a mensagem.");
    },
  });

  const handlePickImage = useCallback(async () => {
    setPickingImage(true);
    try {
      await pickCommunityImage((imageUrl) => setEditForm((prev) => ({ ...prev, imageUrl })));
    } finally {
      setPickingImage(false);
    }
  }, []);

  const openEditModal = useCallback(() => {
    setEditForm({ name: detail.name, description: detail.description || "", imageUrl: detail.imageUrl || "" });
    setShowEditModal(true);
  }, [detail]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Edit community modal */}
      <Modal visible={showEditModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
            style={styles.modalSheetScroll}
            contentContainerStyle={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={styles.modalTitle}>Editar comunidade</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Feather name="x" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Photo picker */}
            <TouchableOpacity style={styles.editPhotoBtn} onPress={handlePickImage} disabled={pickingImage}>
              {editForm.imageUrl ? (
                <Image source={{ uri: editForm.imageUrl }} style={styles.editPhotoPreview} />
              ) : (
                <View style={styles.editPhotoPlaceholder}>
                  <Feather name="camera" size={24} color={colors.muted} />
                  <Text style={styles.editPhotoLabel}>Adicionar foto</Text>
                </View>
              )}
              <View style={styles.editPhotoBadge}>
                <Feather name="edit-2" size={12} color="#1A1A1A" />
              </View>
            </TouchableOpacity>
            {editForm.imageUrl ? (
              <TouchableOpacity onPress={() => setEditForm((prev) => ({ ...prev, imageUrl: "" }))} style={{ alignSelf: "center", marginTop: 4 }}>
                <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: colors.muted }}>Remover imagem</Text>
              </TouchableOpacity>
            ) : null}

            <TextInput
              style={styles.modalInput}
              value={editForm.name}
              onChangeText={(v) => setEditForm((prev) => ({ ...prev, name: v }))}
              placeholder="Nome da comunidade"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              value={editForm.description}
              onChangeText={(v) => setEditForm((prev) => ({ ...prev, description: v }))}
              placeholder="Descrição (opcional)"
              placeholderTextColor={colors.muted}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={() => setShowEditModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimary, (!editForm.name.trim() || saveCommunity.isPending) && { opacity: 0.5 }]}
                onPress={() => saveCommunity.mutate()}
                disabled={!editForm.name.trim() || saveCommunity.isPending}
              >
                <Text style={styles.modalPrimaryText}>{saveCommunity.isPending ? "Salvando..." : "Salvar"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Invite friends modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => { setShowInviteModal(false); setSelectedInviteIds(new Set()); }}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setShowInviteModal(false); setSelectedInviteIds(new Set()); }}>
          <TouchableOpacity activeOpacity={1} style={styles.membersSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.membersHeader}>
              <Text style={styles.modalTitle}>Convidar para {detail.name}</Text>
              <TouchableOpacity onPress={() => { setShowInviteModal(false); setSelectedInviteIds(new Set()); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {(friendsQuery.isPending || friendsQuery.isFetching) ? (
              <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: 32 }} />
            ) : friendsQuery.isError ? (
              <Text style={[styles.memberRole, { textAlign: "center", paddingVertical: 24 }]}>Erro ao carregar amigos.</Text>
            ) : (friendsQuery.data ?? []).length === 0 ? (
              <Text style={[styles.memberRole, { textAlign: "center", paddingVertical: 24 }]}>Você ainda não tem amigos para convidar.</Text>
            ) : (
              <View style={{ flexShrink: 1, paddingBottom: 16 }}>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                  {(friendsQuery.data ?? []).map((friend) => {
                    const isSelected = selectedInviteIds.has(friend.id);
                    return (
                      <TouchableOpacity key={friend.id} style={styles.memberRow} onPress={() => {
                        const next = new Set(selectedInviteIds);
                        if (isSelected) next.delete(friend.id);
                        else next.add(friend.id);
                        setSelectedInviteIds(next);
                      }}>
                        <UserAvatar name={friend.displayName || friend.username} avatarUrl={friend.avatarUrl} size={36} backgroundColor={colors.secondary} color={colors.foreground} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>{friend.displayName || friend.username}</Text>
                          <Text style={styles.memberRole}>@{friend.username}</Text>
                        </View>
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <Feather name="check" size={14} color={colors.primary} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.modalPrimary, { marginTop: 16 }, (selectedInviteIds.size === 0 || sendInvites.isPending) && { opacity: 0.5 }]}
                  onPress={() => sendInvites.mutate(Array.from(selectedInviteIds))}
                  disabled={selectedInviteIds.size === 0 || sendInvites.isPending}
                >
                  <Text style={styles.modalPrimaryText}>{sendInvites.isPending ? "Enviando..." : `Convidar ${selectedInviteIds.size > 0 ? selectedInviteIds.size : ""} amigos`}</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Members bottom sheet */}
      <Modal visible={showMembers} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setShowMembers(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMembers(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.membersSheet}>
            {/* Handle */}
            <View style={styles.sheetHandle} />
            <View style={styles.membersHeader}>
              <Text style={styles.modalTitle}>Membros ({(membersQuery.data ?? []).length})</Text>
              <TouchableOpacity onPress={() => setShowMembers(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {(membersQuery.isPending || membersQuery.isFetching) ? (
              <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: 32 }} />
            ) : membersQuery.isError ? (
              <Text style={[styles.memberRole, { textAlign: "center", paddingVertical: 24 }]}>Erro ao carregar membros.</Text>
            ) : (membersQuery.data ?? []).length === 0 ? (
              <Text style={[styles.memberRole, { textAlign: "center", paddingVertical: 24 }]}>Nenhum membro encontrado.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {(membersQuery.data ?? []).map((member) => (
                  <View key={member.id} style={styles.memberRow}>
                    <TouchableOpacity onPress={() => onOpenProfile(member.id)}>
                      <UserAvatar name={member.displayName || member.username} avatarUrl={member.avatarUrl} size={36} backgroundColor={member.role === "owner" ? colors.primary : colors.secondary} color={colors.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => onOpenProfile(member.id)}>
                      <Text style={styles.memberName}>{member.displayName || member.username}</Text>
                      <Text style={styles.memberRole}>{member.role === "owner" ? "👑 Fundador" : "Membro"}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
        {detail.imageUrl ? (
          <Image source={{ uri: detail.imageUrl }} style={styles.detailAvatarImg} />
        ) : (
          <Text style={styles.detailEmoji}>{detail.emoji}</Text>
        )}
        <TouchableOpacity style={styles.detailHeaderInfo} onPress={() => setShowMembers(true)} activeOpacity={0.7}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary + "18", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" }}>
            <Text style={styles.detailName} numberOfLines={1}>{detail.name}</Text>
            <Feather name="users" size={13} color={colors.primaryDark} />
          </View>
          <Text style={[styles.detailMeta, { color: colors.primaryDark, marginTop: 2 }]}>{detail.membersCount} membros • ver todos ↓</Text>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity onPress={openEditModal} style={styles.editIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="edit-2" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.joinBtn,
            detail.isMember && styles.leaveBtn,
            detail.memberStatus === "pending" && styles.pendingBtn,
          ]}
          onPress={() => {
            if (detail.memberStatus === "pending") {
              Alert.alert("Solicitação pendente", "Sua solicitação está aguardando aprovação do fundador.");
              return;
            }
            detail.isMember ? handleLeave() : joinCommunity.mutate();
          }}
          disabled={joinCommunity.isPending || leaveCommunity.isPending}
        >
          <Text style={[styles.joinBtnText, detail.isMember && styles.leaveBtnText, detail.memberStatus === "pending" && styles.pendingBtnText]}>
            {detail.memberStatus === "pending" ? "⏳ Pendente" : detail.isMember ? "Sair" : detail.isPrivate ? "🔒 Solicitar" : "Entrar"}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.postsList}>
          {detail.description ? (
            <Text style={styles.detailDesc}>{detail.description}</Text>
          ) : null}

          {detail.isMember && (
            <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInviteModal(true)}>
              <Feather name="user-plus" size={16} color={colors.primaryDark} />
              <Text style={styles.inviteBtnText}>Convidar amigos</Text>
            </TouchableOpacity>
          )}

          {isOwner && detail.isPrivate && (pendingRequestsQuery.data?.length ?? 0) > 0 && (
            <View style={styles.requestsSection}>
              <Text style={styles.requestsTitle}>🔔 Solicitações ({pendingRequestsQuery.data!.length})</Text>
              {pendingRequestsQuery.data!.map((req) => {
                const name = req.displayName || req.username;
                return (
                  <View key={req.id} style={styles.requestRow}>
                    <UserAvatar name={name} avatarUrl={req.avatarUrl} size={32} backgroundColor={colors.primary} color="#1A1A1A" />
                    <Text style={styles.requestName} numberOfLines={1}>{name}</Text>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => approveRequest.mutate(req.id)} disabled={approveRequest.isPending}>
                      <Text style={styles.approveBtnText}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectRequest.mutate(req.id)} disabled={rejectRequest.isPending}>
                      <Text style={styles.rejectBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

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
                currentUserId={currentUserId}
                canDelete={currentUserId === post.userId || isOwner}
                onDelete={(postId) => deletePost.mutate(postId)}
                onOpenProfile={onOpenProfile}
              />
            ))
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Sem posts ainda. Seja o primeiro! 👇</Text>
            </View>
          )}
        </ScrollView>

        {detail.isMember && (
          <View style={[styles.composeWrapper, { paddingBottom: insets.bottom + 6 }]}>
            {/* Image preview with remove button */}
            {postImagePreview ? (
              <View style={styles.imagePreviewRow}>
                <Image source={{ uri: postImagePreview }} style={styles.imagePreviewFull} resizeMode="contain" />
                <TouchableOpacity
                  style={styles.imageRemoveBtn}
                  onPress={clearPostImage}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Input row */}
            <View style={styles.inputRow}>
              {/* Camera/gallery picker */}
              <TouchableOpacity
                style={[styles.attachBtn, processingImage && { opacity: 0.5 }]}
                disabled={processingImage}
                onPress={() =>
                  Alert.alert(
                    "Adicionar imagem",
                    "Escolha de onde quer pegar a foto",
                    [
                      {
                        text: "📷 Câmera",
                        onPress: async () => {
                          setProcessingImage(true);
                          try {
                            const r = await takePostPhoto();
                            if (r) { setPostImagePreview(r.previewUri); setPostImageUrl(r.uploadUrl); }
                          } finally { setProcessingImage(false); }
                        },
                      },
                      {
                        text: "🖼 Galeria",
                        onPress: async () => {
                          setProcessingImage(true);
                          try {
                            const r = await pickPostImage();
                            if (r) { setPostImagePreview(r.previewUri); setPostImageUrl(r.uploadUrl); }
                          } finally { setProcessingImage(false); }
                        },
                      },
                      { text: "Cancelar", style: "cancel" },
                    ],
                  )
                }
              >
                <Feather
                  name={processingImage ? "loader" : "image"}
                  size={18}
                  color={postImagePreview ? colors.primaryDark : colors.muted}
                />
              </TouchableOpacity>

              <TextInput
                style={styles.postInput}
                value={newPost}
                onChangeText={setNewPost}
                placeholder={postImagePreview ? "Adicione uma legenda..." : "Compartilhe algo..."}
                placeholderTextColor={colors.muted}
                multiline
                maxLength={500}
              />

              <TouchableOpacity
                style={[styles.sendBtn, ((!newPost.trim() && !postImagePreview) || createPost.isPending) && styles.sendBtnDisabled]}
                onPress={() => {
                  if (newPost.trim() || postImageUrl) {
                    createPost.mutate({
                      content: newPost.trim() || "📸",
                      imageUrl: postImageUrl,
                    });
                  }
                }}
                disabled={(!newPost.trim() && !postImagePreview) || createPost.isPending}
              >
                <Feather name="send" size={18} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CommunitiesScreen() {
  const { user } = useAuthStore();
  const themeMode = useUIStore((state) => state.themeMode);
  const insets = useSafeAreaInsets();
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Community | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [communityForm, setCommunityForm] = useState(DEFAULT_COMMUNITY);
  const [pickingCreateImage, setPickingCreateImage] = useState(false);

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

  const handlePickCreateImage = useCallback(async () => {
    setPickingCreateImage(true);
    try {
      await pickCommunityImage((imageUrl) => setCommunityForm((prev) => ({ ...prev, imageUrl })));
    } finally {
      setPickingCreateImage(false);
    }
  }, []);

  return (
    <>
      {selected ? (
        <CommunityDetail
          community={selected}
          onBack={() => setSelected(null)}
          colors={colors}
          styles={styles}
          insets={insets}
          currentUserId={user?.id}
          onOpenProfile={setProfileUserId}
        />
      ) : (
        <CommunityList
          onSelect={setSelected}
          colors={colors}
          styles={styles}
          insets={insets}
          onOpenCreate={() => setShowCreateModal(true)}
          onOpenProfile={setProfileUserId}
        />
      )}

      <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />

      <Modal visible={showCreateModal} animationType="slide" transparent statusBarTranslucent>
        <View style={{ flex: 1 }}>
          {/* Dimmer — toque fora fecha o modal */}
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCreateModal(false)}
          />
          {/* KAV só envolve o sheet — empurra o conteúdo acima do teclado */}
          <KeyboardAvoidingView
            style={styles.modalKeyboardSheet}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              showsVerticalScrollIndicator={false}
              style={styles.modalSheetScroll}
              contentContainerStyle={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}
            >
              <View style={styles.sheetHandle} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <Text style={styles.modalTitle}>Nova comunidade</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x" size={22} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.editPhotoBtn} onPress={handlePickCreateImage} disabled={pickingCreateImage}>
                {communityForm.imageUrl ? (
                  <Image source={{ uri: communityForm.imageUrl }} style={styles.editPhotoPreview} />
                ) : (
                  <View style={styles.editPhotoPlaceholder}>
                    <Feather name="camera" size={24} color={colors.muted} />
                    <Text style={styles.editPhotoLabel}>{pickingCreateImage ? "Carregando..." : "Adicionar foto"}</Text>
                  </View>
                )}
                <View style={styles.editPhotoBadge}>
                  <Feather name="edit-2" size={12} color="#1A1A1A" />
                </View>
              </TouchableOpacity>
              {communityForm.imageUrl ? (
                <TouchableOpacity onPress={() => setCommunityForm((prev) => ({ ...prev, imageUrl: "" }))} style={{ alignSelf: "center", marginTop: -6 }}>
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: colors.muted }}>Remover imagem</Text>
                </TouchableOpacity>
              ) : null}
              <TextInput
                style={styles.modalInput}
                value={communityForm.name}
                onChangeText={(v) => setCommunityForm((p) => ({ ...p, name: v }))}
                placeholder="Nome da comunidade"
                placeholderTextColor={colors.muted}
                returnKeyType="next"
              />
              <TextInput
                style={[styles.modalInput, { display: "none" }]}
                value={communityForm.emoji}
                onChangeText={(v) => setCommunityForm((p) => ({ ...p, emoji: v || "🐝" }))}
                placeholder="Emoji (ex: 🐝)"
                placeholderTextColor={colors.muted}
                returnKeyType="next"
              />
              <TextInput
                style={styles.modalInput}
                value={communityForm.category}
                onChangeText={(v) => setCommunityForm((p) => ({ ...p, category: v || "geral" }))}
                placeholder="Categoria (ex: estudo, treino...)"
                placeholderTextColor={colors.muted}
                returnKeyType="next"
              />
              <TextInput
                style={[styles.modalInput, styles.modalTextarea]}
                value={communityForm.description}
                onChangeText={(v) => setCommunityForm((p) => ({ ...p, description: v }))}
                placeholder="Descrição (opcional)"
                placeholderTextColor={colors.muted}
                multiline
                returnKeyType="done"
              />
              <View style={styles.privacyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyLabel}>🔒 Comunidade privada</Text>
                  <Text style={styles.privacySub}>Novos membros precisam de aprovação</Text>
                </View>
                <Switch
                  value={communityForm.isPrivate}
                  onValueChange={(v) => setCommunityForm((p) => ({ ...p, isPrivate: v }))}
                  trackColor={{ false: "#E5E7EB", true: "#F59E0B" }}
                  thumbColor="#fff"
                />
              </View>
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
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function CommunityPostCard({
  post, colors, communityName, communityEmoji, currentUserId, canDelete, onDelete, onOpenProfile,
}: {
  post: CommunityPost;
  colors: ReturnType<typeof getThemeColors>;
  communityName: string;
  communityEmoji: string;
  currentUserId?: string;
  canDelete?: boolean;
  onDelete: (postId: string) => void;
  onOpenProfile: (userId: string) => void;
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
  const [menuVisible, setMenuVisible] = useState(false);
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

  function handleDelete() {
    Alert.alert("Apagar mensagem", "Apagar esta mensagem da comunidade?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: () => onDelete(post.id) },
    ]);
  }

  return (
    <View style={styles.postCard}>
      {canDelete ? (
        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <TouchableOpacity style={styles.postMenuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
            <View style={styles.postMenuSheet}>
              <TouchableOpacity style={styles.postMenuItem} onPress={() => { setMenuVisible(false); handleDelete(); }}>
                <Feather name="trash-2" size={16} color={colors.destructive} />
                <Text style={[styles.postMenuItemText, { color: colors.destructive }]}>Apagar mensagem</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      ) : null}
      <View style={styles.postHeader}>
        <TouchableOpacity onPress={() => onOpenProfile(post.userId)}>
          <UserAvatar name={authorName} avatarUrl={post.avatarUrl} size={36} backgroundColor={colors.secondary} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => onOpenProfile(post.userId)}>
          <Text style={styles.postAuthor}>{authorName}</Text>
          <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
        </TouchableOpacity>
        {canDelete ? (
          <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="more-horizontal" size={20} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.postContent}>{post.content}</Text>
      {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="contain" /> : null}

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
              <TouchableOpacity onPress={() => onOpenProfile(comment.userId)}>
                <UserAvatar name={displayNameOf(comment)} avatarUrl={comment.avatarUrl} size={28} backgroundColor={colors.secondary} color={colors.foreground} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <View style={styles.commentBubble}>
                  <TouchableOpacity onPress={() => onOpenProfile(comment.userId)}>
                    <Text style={styles.commentName}>{displayNameOf(comment)}</Text>
                  </TouchableOpacity>
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
    listHeaderTitle: { flex: 1, fontFamily: FONTS.display, fontSize: 24, fontWeight: "800", color: colors.foreground },
    createBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
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
    communityAvatar: { width: 42, height: 42, borderRadius: 21 },
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
    detailAvatarImg: { width: 38, height: 38, borderRadius: 19 },
    editIconBtn: { padding: 4 },
    editPhotoBtn: {
      alignSelf: "center",
      width: 88, height: 88,
      borderRadius: 44,
      overflow: "hidden",
      marginBottom: 12,
      position: "relative",
    },
    editPhotoPreview: { width: 88, height: 88, borderRadius: 44 },
    editPhotoPlaceholder: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: colors.secondary,
      borderWidth: 2, borderColor: colors.border,
      borderStyle: "dashed",
      alignItems: "center", justifyContent: "center", gap: 4,
    },
    editPhotoLabel: { fontFamily: FONTS.sans, fontSize: 10, color: colors.muted },
    editPhotoBadge: {
      position: "absolute", bottom: 2, right: 2,
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
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
    pendingBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.muted },
    pendingBtnText: { color: colors.muted },
    requestsSection: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      gap: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: "#F59E0B44",
    },
    requestsTitle: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 13, color: colors.foreground, marginBottom: 4 },
    requestRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    requestAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    requestAvatarText: { fontFamily: FONTS.display, fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
    requestName: { flex: 1, fontFamily: FONTS.sans, fontSize: 13, fontWeight: "600", color: colors.foreground },
    approveBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" },
    approveBtnText: { fontSize: 15, color: "#059669", fontWeight: "700" },
    rejectBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
    rejectBtnText: { fontSize: 15, color: "#EF4444", fontWeight: "700" },
    privacyRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 4,
    },
    privacyLabel: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 14, color: colors.foreground },
    privacySub: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
    // Posts
    inviteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.primary + "1A",
      paddingVertical: 12,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + "33",
    },
    inviteBtnText: {
      fontFamily: FONTS.sans,
      fontWeight: "700",
      fontSize: 14,
      color: colors.primaryDark,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxSelected: {
      backgroundColor: colors.primary + "33",
      borderColor: colors.primary,
    },
    postsList: { padding: 16, gap: 12 },
    composeWrapper: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    imagePreviewRow: {
      position: "relative",
      marginHorizontal: 14,
      marginTop: 10,
      marginBottom: 6,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: colors.background,
    },
    imagePreviewFull: {
      width: "100%",
      height: 200,
      backgroundColor: colors.secondary,
    },
    imagePreviewThumb: {
      width: 56,
      height: 42,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    imagePreviewInfo: { flex: 1, gap: 2 },
    imagePreviewLabel: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.foreground },
    imagePreviewSub: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted },
    imageRemoveBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    attachBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
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
    postImage: { width: "100%", height: 190, borderRadius: 14, backgroundColor: colors.background },
    postActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    postMenuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
    postMenuSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 8, paddingBottom: 32 },
    postMenuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
    postMenuItemText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "600", color: colors.foreground },
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
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
    modalKeyboardSheet: { flex: 1, justifyContent: "flex-end" },
    modalSheetScroll: { maxHeight: "88%" },
    modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
    membersSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 12 },
    sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
    membersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    memberRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
    memberAvatarText: { fontFamily: FONTS.display, fontWeight: "700", color: colors.foreground },
    memberName: { fontFamily: FONTS.sans, fontWeight: "700", fontSize: 13, color: colors.foreground },
    memberRole: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
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
