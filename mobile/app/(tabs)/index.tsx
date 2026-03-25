import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  SafeAreaView,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useChatStore } from "../../stores/chatStore";
import { useUIStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import { useChat } from "../../hooks/useChat";
import BeeEyes from "../../components/BeeEyes";
import ChatMessage from "../../components/ChatMessage";
import StreakDisplay from "../../components/StreakDisplay";
import AchievementToast from "../../components/AchievementToast";
import { COLORS, FONTS } from "../../lib/theme";

export default function ChatScreen() {
  const [inputValue, setInputValue] = useState("");
  const listRef = useRef<FlashList<any>>(null);
  const { messages, isTyping, streamingContent, setMessages } = useChatStore();
  const { eyeExpression } = useUIStore();
  const { user } = useAuthStore();
  const { sendMessage } = useChat();

  // Load initial messages
  const { data: initialMessages } = useQuery({
    queryKey: ["messages"],
    queryFn: () => api.get("/api/messages").then((r) => r.data),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (initialMessages && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Load user for streak
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me").then((r) => r.data),
    staleTime: 30 * 1000,
  });

  async function handleSend() {
    const msg = inputValue.trim();
    if (!msg) return;
    setInputValue("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await sendMessage(msg);
  }

  const allMessages = [
    ...messages,
    ...(isTyping && streamingContent
      ? [{ id: "streaming", role: "assistant" as const, content: streamingContent + "▌", createdAt: new Date().toISOString() }]
      : isTyping
      ? [{ id: "typing", role: "assistant" as const, content: "🐝 ...", createdAt: new Date().toISOString() }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <AchievementToast />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>bee-eyes</Text>
        {me && <StreakDisplay streak={me.currentStreak} />}
      </View>

      {/* BeeEyes character */}
      <View style={styles.mascotArea}>
        <BeeEyes expression={eyeExpression} size={120} />
      </View>

      {/* Chat messages */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {allMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Olá, {user?.username}! 🐝{"\n"}Diga oi para o BeeEyes!
            </Text>
          </View>
        ) : (
          <FlashList
            ref={listRef}
            data={allMessages}
            renderItem={({ item }) => (
              <ChatMessage role={item.role} content={item.content} createdAt={item.createdAt} />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            estimatedItemSize={60}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Mensagem..."
            placeholderTextColor={COLORS.muted}
            multiline
            maxLength={1000}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputValue.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputValue.trim() || isTyping}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  logo: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: COLORS.primary,
    fontWeight: "700",
  },
  mascotArea: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  chatArea: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 26,
  },
  messageList: {
    padding: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FONTS.sans,
    color: COLORS.foreground,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    fontSize: 18,
    color: "#1A1A1A",
    fontWeight: "700",
  },
});
