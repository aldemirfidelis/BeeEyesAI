import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
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
import { api } from "@mobile/lib/api";
import { useAuthStore } from "@mobile/stores/authStore";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";
import { DMConversation, DMMessage, displayNameOf, timeAgo } from "@mobile/lib/social";

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

function ConversationList({
  onSelect, colors, styles, insets,
}: {
  onSelect: (c: DMConversation) => void;
  colors: any; styles: any; insets: any;
}) {
  const { user } = useAuthStore();
  const conversationsQuery = useQuery<DMConversation[]>({
    queryKey: ["dm-conversations"],
    queryFn: () => api.get("/api/dm/conversations").then((r) => r.data),
    refetchInterval: 7000,
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>{user?.displayName || user?.username}</Text>
        <Feather name="edit" size={22} color={colors.foreground} />
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
  const scrollRef = useRef<ScrollView>(null);

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
        <Feather name="more-horizontal" size={22} color={colors.muted} />
      </View>

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
  });
}

