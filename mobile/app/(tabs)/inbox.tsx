import { useEffect, useMemo, useRef, useState } from "react";
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
import { useAuthStore } from "../../stores/authStore";
import { FONTS, getThemeColors } from "../../lib/theme";
import { useUIStore } from "../../stores/uiStore";
import { DMConversation, DMMessage, displayNameOf, timeAgo } from "../../lib/social";

function Avatar({ name, size = 46, colors }: { name: string; size?: number; colors: any }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: colors.secondary,
      alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: size * 0.38, fontWeight: "700", color: colors.foreground }}>
        {name[0]?.toUpperCase() ?? "?"}
      </Text>
    </View>
  );
}

interface ContactUser { id: string; username: string; displayName: string | null; level: number; }

function NewMessageModal({ visible, onClose, onSelect, colors, styles }: {
  visible: boolean; onClose: () => void;
  onSelect: (c: DMConversation) => void;
  colors: any; styles: any;
}) {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<ContactUser[]>([]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api.get("/api/connections/accepted")
      .then((r) => setContacts(r.data))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [visible]);

  function handleSelect(u: ContactUser) {
    onClose();
    onSelect({
      user: { id: u.id, username: u.username, displayName: u.displayName, level: u.level },
      lastMessage: "",
      lastMessageAt: new Date().toISOString(),
      lastMessageFromMe: false,
      unreadCount: 0,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.newMsgOverlay}>
        <View style={styles.newMsgSheet}>
          <View style={styles.newMsgHeader}>
            <Text style={styles.newMsgTitle}>Nova mensagem</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primaryDark} style={{ marginTop: 32 }} />
          ) : contacts.length === 0 ? (
            <Text style={styles.newMsgEmpty}>Nenhuma conexão encontrada. Adicione amigos para enviar mensagens.</Text>
          ) : (
            <FlatList
              data={contacts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.newMsgRow} onPress={() => handleSelect(item)} activeOpacity={0.7}>
                  <View style={styles.newMsgAvatar}>
                    <Text style={styles.newMsgAvatarText}>{(item.displayName || item.username)[0].toUpperCase()}</Text>
                  </View>
                  <Text style={styles.newMsgName}>{item.displayName || item.username}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function ConversationList({
  onSelect, colors, styles, insets,
}: {
  onSelect: (c: DMConversation) => void;
  colors: any; styles: any; insets: any;
}) {
  const { user } = useAuthStore();
  const [showNewMsg, setShowNewMsg] = useState(false);
  const conversationsQuery = useQuery<DMConversation[]>({
    queryKey: ["dm-conversations"],
    queryFn: () => api.get("/api/dm/conversations").then((r) => r.data),
    refetchInterval: 7000,
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <NewMessageModal
        visible={showNewMsg}
        onClose={() => setShowNewMsg(false)}
        onSelect={onSelect}
        colors={colors}
        styles={styles}
      />
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>{user?.displayName || user?.username}</Text>
        <TouchableOpacity onPress={() => setShowNewMsg(true)}>
          <Feather name="edit" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <Text style={styles.listSection}>Mensagens</Text>

      {conversationsQuery.isLoading ? (
        <ActivityIndicator color={colors.primaryDark} style={{ marginTop: 40 }} />
      ) : conversationsQuery.data?.length ? (
        <FlatList
          data={conversationsQuery.data}
          keyExtractor={(item) => item.user.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.convRow} onPress={() => onSelect(item)} activeOpacity={0.7}>
              <View style={styles.convAvatarWrap}>
                <Avatar name={displayNameOf(item.user)} size={56} colors={colors} />
                {item.unreadCount > 0 && <View style={styles.onlineDot} />}
              </View>
              <View style={styles.convBody}>
                <View style={styles.convTopRow}>
                  <Text style={[styles.convName, item.unreadCount > 0 && styles.convNameUnread]}>
                    {displayNameOf(item.user)}
                  </Text>
                  <Text style={styles.convTime}>{timeAgo(item.lastMessageAt)}</Text>
                </View>
                <Text style={[styles.convPreview, item.unreadCount > 0 && styles.convPreviewUnread]} numberOfLines={1}>
                  {item.lastMessageFromMe ? "Você: " : ""}{item.lastMessage}
                </Text>
              </View>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      ) : (
        <View style={styles.empty}>
          <Feather name="message-circle" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Nenhuma mensagem ainda</Text>
          <Text style={styles.emptyText}>Conecte-se com amigos para começar a conversar.</Text>
        </View>
      )}
    </View>
  );
}

function ChatScreen({
  conversation, onBack, colors, styles, insets,
}: {
  conversation: DMConversation;
  onBack: () => void;
  colors: any; styles: any; insets: any;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  function handleDeleteConversation() {
    setMenuVisible(false);
    Alert.alert(
      "Apagar conversa",
      `Apagar toda a conversa com ${conversation.user.displayName || conversation.user.username}? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar", style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/dm/${conversation.user.id}`);
              queryClient.invalidateQueries({ queryKey: ["dm-conversations"] });
              onBack();
            } catch {
              Alert.alert("Erro", "Não foi possível apagar a conversa.");
            }
          },
        },
      ]
    );
  }

  const messagesQuery = useQuery<DMMessage[]>({
    queryKey: ["dm-messages", conversation.user.id],
    queryFn: () => api.get(`/api/dm/${conversation.user.id}`).then((r) => r.data),
    refetchInterval: 5000,
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) =>
      api.post(`/api/dm/${conversation.user.id}`, { content }).then((r) => r.data),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["dm-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["dm-messages", conversation.user.id] });
    },
  });

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 200);
  }, [messagesQuery.data]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Avatar name={displayNameOf(conversation.user)} size={38} colors={colors} />
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName}>{displayNameOf(conversation.user)}</Text>
          <Text style={styles.chatHeaderHandle}>@{conversation.user.username}</Text>
        </View>
        <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="more-horizontal" size={22} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteConversation}>
              <Feather name="trash-2" size={18} color={colors.destructive} />
              <Text style={[styles.menuItemText, { color: colors.destructive }]}>Apagar conversa</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messagesQuery.isLoading ? (
            <ActivityIndicator color={colors.primaryDark} style={{ marginTop: 40 }} />
          ) : messagesQuery.data?.length ? (
            messagesQuery.data.map((msg) => {
              const isMe = msg.senderId !== conversation.user.id;
              return (
                <View key={msg.id} style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
                  {!isMe && <Avatar name={displayNameOf(conversation.user)} size={28} colors={colors} />}
                  <View style={[styles.msgColumn, isMe && { alignItems: "flex-end" }]}>
                    <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
                      <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{msg.content}</Text>
                    </View>
                    <Text style={styles.msgTime}>{timeAgo(msg.createdAt)}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Diga oi para {displayNameOf(conversation.user)}! 👋</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 6 }]}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Mensagem..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sendMessage.isPending) && styles.sendBtnDisabled]}
            onPress={() => { if (draft.trim()) sendMessage.mutate(draft.trim()); }}
            disabled={!draft.trim() || sendMessage.isPending}
          >
            <Feather name="send" size={18} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function InboxScreen() {
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<DMConversation | null>(null);

  if (selected) {
    return (
      <ChatScreen
        conversation={selected}
        onBack={() => setSelected(null)}
        colors={colors}
        styles={styles}
        insets={insets}
      />
    );
  }

  return (
    <ConversationList
      onSelect={setSelected}
      colors={colors}
      styles={styles}
      insets={insets}
    />
  );
}

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
    listHeaderTitle: {
      fontFamily: FONTS.display,
      fontSize: 24,
      fontWeight: "800",
      color: colors.foreground,
    },
    listSection: {
      fontFamily: FONTS.sans,
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    convRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 14,
    },
    convAvatarWrap: { position: "relative" },
    onlineDot: {
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: "#22C55E",
      borderWidth: 2,
      borderColor: colors.background,
    },
    convBody: { flex: 1, gap: 3 },
    convTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    convName: {
      fontFamily: FONTS.sans,
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
    },
    convNameUnread: { fontWeight: "800" },
    convTime: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    convPreview: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted },
    convPreviewUnread: { color: colors.foreground, fontWeight: "600" },
    unreadBadge: {
      backgroundColor: colors.primaryDark,
      borderRadius: 999,
      minWidth: 20,
      height: 20,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    unreadBadgeText: {
      fontFamily: FONTS.mono,
      fontSize: 11,
      fontWeight: "700",
      color: "#fff",
    },

    // Chat header
    chatHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    backBtn: { marginRight: 2 },
    chatHeaderInfo: { flex: 1 },
    chatHeaderName: {
      fontFamily: FONTS.sans,
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    chatHeaderHandle: {
      fontFamily: FONTS.sans,
      fontSize: 12,
      color: colors.muted,
    },

    // Messages
    messagesList: { padding: 16, gap: 8 },
    msgRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      marginBottom: 2,
    },
    msgRowMe: { justifyContent: "flex-end" },
    msgRowThem: { justifyContent: "flex-start" },
    msgColumn: { maxWidth: "75%", gap: 3 },
    msgBubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
    msgBubbleMe: {
      backgroundColor: colors.primaryDark,
      borderBottomRightRadius: 4,
    },
    msgBubbleThem: {
      backgroundColor: colors.card,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    msgText: {
      fontFamily: FONTS.sans,
      fontSize: 14,
      lineHeight: 20,
      color: colors.foreground,
    },
    msgTextMe: { color: "#fff" },
    msgTime: {
      fontFamily: FONTS.sans,
      fontSize: 11,
      color: colors.muted,
      paddingHorizontal: 4,
    },

    // Input
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
    input: {
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
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnDisabled: { opacity: 0.4 },

    // Empty
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      gap: 12,
      paddingTop: 80,
    },
    emptyTitle: {
      fontFamily: FONTS.display,
      fontSize: 20,
      fontWeight: "700",
      color: colors.foreground,
      textAlign: "center",
    },
    emptyText: {
      fontFamily: FONTS.sans,
      fontSize: 14,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 20,
    },
    menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "flex-end", justifyContent: "flex-start", paddingTop: 60, paddingRight: 16 },
    menuSheet: { backgroundColor: colors.card, borderRadius: 14, paddingVertical: 4, minWidth: 200, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
    menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
    menuItemText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "600" },
    newMsgOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    newMsgSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 36, maxHeight: "70%" },
    newMsgHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 },
    newMsgTitle: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "800", color: colors.foreground },
    newMsgEmpty: { fontFamily: FONTS.sans, fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 32, lineHeight: 22 },
    newMsgRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    newMsgAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
    newMsgAvatarText: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: colors.foreground },
    newMsgName: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "600", color: colors.foreground },
  });
}
