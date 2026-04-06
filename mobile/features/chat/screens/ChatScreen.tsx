import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  Linking,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@mobile/lib/api";
import { useChatStore } from "@mobile/stores/chatStore";
import { useUIStore } from "@mobile/stores/uiStore";
import { useAuthStore } from "@mobile/stores/authStore";
import { useChat } from "@mobile/hooks/useChat";
import BeeEyes from "@mobile/components/BeeEyes";
import ChatMessage from "@mobile/components/ChatMessage";
import StreakDisplay from "@mobile/components/StreakDisplay";
import AchievementToast from "@mobile/components/AchievementToast";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import {
  ConnectionRequestMeta,
  NetworkDigestMeta,
  NewsDigestMeta,
  isConnectionRequestMeta,
  isNetworkDigestMeta,
  isNewsDigestMeta,
  parseMessageMeta,
} from "@mobile/lib/social";

type ChatRoute = "/(tabs)/feed" | "/(tabs)/missions" | "/(tabs)/communities" | "/(tabs)/inbox";

export default function ChatScreen() {
  const [inputValue, setInputValue] = useState("");
  const listRef = useRef<any>(null);
  const { messages, isTyping, streamingContent, setMessages, addMessage } = useChatStore();
  const { eyeExpression, themeMode, setEyeExpression } = useUIStore();
  const { user } = useAuthStore();
  const { sendMessage } = useChat();
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => sub.remove();
  }, []);

  const { data: initialMessages } = useQuery({
    queryKey: ["messages"],
    queryFn: () => api.get("/api/messages?limit=50").then((r) => r.data),
    staleTime: Infinity,
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me").then((r) => r.data),
    staleTime: 30 * 1000,
  });

  const resolveConnection = useMutation({
    mutationFn: async ({
      messageId,
      connectionId,
      decision,
    }: {
      messageId: string;
      connectionId: string;
      decision: "accept" | "reject";
    }) => {
      const endpoint = decision === "accept" ? "accept" : "reject";
      await api.put(`/api/connections/${connectionId}/${endpoint}`);
      const content =
        decision === "accept"
          ? "Solicitacao aceita. Agora voces podem conversar em Mensagens."
          : "Solicitacao recusada.";
      const metadata = JSON.stringify({ type: "connection_request_resolved", decision });
      await api.patch(`/api/messages/${messageId}`, { content, metadata });
      return { messageId, content, metadata, decision };
    },
    onSuccess: ({ messageId, content, metadata, decision }) => {
      setMessages(
        messages.map((message) =>
          message.id === messageId ? { ...message, content, metadata } : message,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      if (decision === "accept") {
        queryClient.invalidateQueries({ queryKey: ["friends"] });
      }
    },
  });

  useEffect(() => {
    if (initialMessages && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length, setMessages]);

  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await api.get("/api/proactive");
        if (!data?.message) return;
        addMessage({
          id: `proactive-${Date.now()}`,
          role: "assistant",
          content: data.message,
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify({ proactive: true }),
        });
        setEyeExpression("happy");
        setTimeout(() => setEyeExpression("neutral"), 4000);
      } catch {
        // ignore polling errors
      }
    };

    const interval = setInterval(poll, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [addMessage, setEyeExpression]);

  useEffect(() => {
    const handleAutomaticNetworkDigest = async () => {
      try {
        const [newsRes, feedRes, suggestionsRes] = await Promise.all([
          api.get("/api/news"),
          api.get("/api/feed"),
          api.get("/api/connections/suggestions?limit=3"),
        ]);

        const newsData = newsRes.data ?? { items: [], query: "seus interesses" };
        const feedPosts = Array.isArray(feedRes.data) ? feedRes.data : [];
        const suggestions = Array.isArray(suggestionsRes.data) ? suggestionsRes.data : [];
        const hasNews = Array.isArray(newsData.items) && newsData.items.length > 0;
        const hasFeed = feedPosts.length > 0;
        const hasSuggestions = suggestions.length > 0;

        if (!hasNews && !hasFeed && !hasSuggestions) return;

        const content = [
          "Olha o que voce perde.",
          hasFeed ? `Tem ${feedPosts.length} atualizacao${feedPosts.length > 1 ? "es" : ""} no seu feed.` : null,
          hasNews ? `Separei noticias sobre ${newsData.query}.` : null,
          hasSuggestions ? `Tambem achei ${suggestions.length} sugest${suggestions.length > 1 ? "oes" : "ao"} de conexao.` : null,
        ]
          .filter(Boolean)
          .join(" ");

        addMessage({
          id: `digest-${Date.now()}`,
          role: "assistant",
          content,
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify({
            type: "network_digest",
            query: newsData.query || "seus interesses",
            newsItems: hasNews ? newsData.items.slice(0, 3) : [],
            feedPosts: hasFeed ? feedPosts.slice(0, 3) : [],
            suggestions: hasSuggestions ? suggestions.slice(0, 3) : [],
          } satisfies NetworkDigestMeta),
        });

        setEyeExpression("happy");
        setTimeout(() => setEyeExpression("neutral"), 4000);
      } catch {
        // ignore digest failures
      }
    };

    handleAutomaticNetworkDigest();
    const interval = setInterval(handleAutomaticNetworkDigest, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [addMessage, setEyeExpression]);

  async function handleSend() {
    const msg = inputValue.trim();
    if (!msg) return;
    setInputValue("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const commandHandled = await handleSlashCommand(msg);
    if (commandHandled) return;

    await sendMessage(msg);
  }

  async function handleSlashCommand(raw: string) {
    const command = raw.toLowerCase();
    if (command === "/feed") {
      injectAssistantShortcut("Abrindo o feed da comunidade para voce.", "/(tabs)/feed");
      return true;
    }
    if (command === "/missoes" || command === "/missões") {
      injectAssistantShortcut("Levando voce para suas missoes ativas.", "/(tabs)/missions");
      return true;
    }
    if (command === "/compartilhar") {
      injectAssistantShortcut("O atalho de compartilhar abre o feed para voce criar um novo post.", "/(tabs)/feed");
      return true;
    }
    if (command === "/comunidades") {
      injectAssistantShortcut("Abrindo as comunidades.", "/(tabs)/communities");
      return true;
    }
    if (command === "/mensagens" || command === "/inbox") {
      injectAssistantShortcut("Abrindo sua inbox.", "/(tabs)/inbox");
      return true;
    }
    if (command === "/noticias" || command === "/notícias") {
      await handleNewsCommand();
      return true;
    }
    return false;
  }

  function injectAssistantShortcut(content: string, href: ChatRoute) {
    addMessage({
      id: `shortcut-${Date.now()}`,
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
      metadata: null,
    });
    router.push(href);
  }

  async function handleNewsCommand() {
    addMessage({
      id: `news-loading-${Date.now()}`,
      role: "assistant",
      content: "Buscando noticias para voce...",
      createdAt: new Date().toISOString(),
      metadata: null,
    });
    try {
      const { data } = await api.get("/api/news");
      const items = Array.isArray(data?.items) ? data.items : [];
      addMessage({
        id: `news-${Date.now()}`,
        role: "assistant",
        content: items.length
          ? `Separei ${items.length} noticias sobre "${data.query}". Toque em uma para resumir!`
          : "Nao encontrei noticias no momento. Tente novamente mais tarde.",
        createdAt: new Date().toISOString(),
        metadata: items.length
          ? JSON.stringify({ type: "news_digest", query: data.query, items } satisfies NewsDigestMeta)
          : null,
      });
    } catch {
      addMessage({
        id: `news-err-${Date.now()}`,
        role: "assistant",
        content: "Nao consegui buscar as noticias agora. Verifique sua conexao.",
        createdAt: new Date().toISOString(),
        metadata: null,
      });
    }
  }

  const allMessages = [
    ...messages,
    ...(isTyping && streamingContent
      ? [{ id: "streaming", role: "assistant" as const, content: `${streamingContent}▌`, createdAt: new Date().toISOString(), metadata: null }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <AchievementToast />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.logo}>bee-eyes</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push("/(tabs)/friends")}>
            <Feather name="users" size={20} color={colors.muted} />
            <Text style={styles.headerIconLabel}>Amigos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push("/(tabs)/profile")}>
            <Feather name="user" size={20} color={colors.muted} />
            <Text style={styles.headerIconLabel}>Perfil</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mascotArea}>
        <BeeEyes expression={eyeExpression} size={70} />
      </View>

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {allMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Ola, {user?.displayName || user?.username}!{"\n"}Use comandos como `/feed`, `/missoes`, `/inbox` e `/comunidades`.
            </Text>
          </View>
        ) : (
          <FlashList
            ref={listRef}
            data={allMessages}
            renderItem={({ item }) => {
              const meta = parseMessageMeta(item.metadata);
              return (
                <View>
                  <ChatMessage role={item.role} content={item.content} createdAt={item.createdAt} />
                  {isConnectionRequestMeta(meta) ? (
                    <ConnectionRequestCard
                      styles={styles}
                      pending={resolveConnection.isPending}
                      meta={meta}
                      onAccept={() =>
                        resolveConnection.mutate({
                          messageId: item.id,
                          connectionId: meta.connectionId,
                          decision: "accept",
                        })
                      }
                      onReject={() =>
                        resolveConnection.mutate({
                          messageId: item.id,
                          connectionId: meta.connectionId,
                          decision: "reject",
                        })
                      }
                    />
                  ) : null}
                  {isNetworkDigestMeta(meta) ? (
                    <NetworkDigestCard meta={meta} styles={styles} />
                  ) : null}
                  {isNewsDigestMeta(meta) ? (
                    <NewsDigestCard meta={meta} styles={styles} />
                  ) : null}
                </View>
              );
            }}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Mensagem..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={1000}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputValue.trim() || isTyping) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputValue.trim() || isTyping}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActions}>
          {(
            [
              { label: "/feed", action: () => router.push("/(tabs)/feed") },
              { label: "/missoes", action: () => router.push("/(tabs)/missions") },
              { label: "/inbox", action: () => router.push("/(tabs)/inbox") },
              { label: "/comunidades", action: () => router.push("/(tabs)/communities") },
              { label: "/noticias", action: () => handleNewsCommand() },
            ] as const
          ).map((item) => (
            <TouchableOpacity key={item.label} style={styles.quickActionChip} onPress={item.action}>
              <Text style={styles.quickActionText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ConnectionRequestCard({
  meta,
  pending,
  onAccept,
  onReject,
  styles,
}: {
  meta: ConnectionRequestMeta;
  pending: boolean;
  onAccept: () => void;
  onReject: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle}>Pedido de conexao</Text>
      <Text style={styles.metaText}>{meta.fromName || "Alguem"} quer se conectar com voce.</Text>
      <View style={styles.metaActions}>
        <TouchableOpacity style={styles.metaSecondaryButton} onPress={onReject} disabled={pending}>
          <Text style={styles.metaSecondaryText}>Recusar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.metaPrimaryButton} onPress={onAccept} disabled={pending}>
          <Text style={styles.metaPrimaryText}>{pending ? "..." : "Aceitar"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function NetworkDigestCard({
  meta,
  styles,
}: {
  meta: NetworkDigestMeta;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle}>Resumo da rede</Text>
      <Text style={styles.metaText}>Busca: {meta.query}</Text>
      {meta.newsItems.slice(0, 2).map((item) => (
        <Text key={item.link} style={styles.metaBullet}>• {item.title}</Text>
      ))}
      {meta.feedPosts.slice(0, 2).map((post) => (
        <Text key={post.id} style={styles.metaBullet}>• {post.author.displayName || post.author.username}: {post.content}</Text>
      ))}
      {meta.suggestions.slice(0, 2).map((suggestion) => (
        <Text key={suggestion.id} style={styles.metaBullet}>• Conexao sugerida: {suggestion.displayName || suggestion.username}</Text>
      ))}
    </View>
  );
}

function NewsDigestCard({
  meta,
  styles,
}: {
  meta: NewsDigestMeta;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const summarize = useCallback(async (link: string, title: string) => {
    setLoading(link);
    try {
      const { data } = await api.post("/api/news/summarize", { url: link, title });
      setSummaries((prev) => ({ ...prev, [link]: data.summary }));
    } catch {
      setSummaries((prev) => ({ ...prev, [link]: "Nao foi possivel resumir este artigo." }));
    } finally {
      setLoading(null);
    }
  }, []);

  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle}>📰 Noticias — {meta.query}</Text>
      {meta.items.map((item) => (
        <View key={item.link} style={styles.newsItem}>
          <Text style={styles.newsTitle}>{item.title}</Text>
          <Text style={styles.newsSource}>{item.source}</Text>
          {summaries[item.link] ? (
            <View style={styles.newsSummaryBlock}>
              <Text style={styles.newsSummary}>{summaries[item.link]}</Text>
              <TouchableOpacity onPress={() => Linking.openURL(item.link)}>
                <Text style={styles.newsReadMore}>Ler mais →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.newsResumeBtn}
              onPress={() => summarize(item.link, item.title)}
              disabled={loading === item.link}
            >
              <Text style={styles.newsResumeBtnText}>
                {loading === item.link ? "Resumindo..." : "Resumir"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    logo: {
      fontFamily: FONTS.display,
      fontSize: 24,
      color: colors.primaryDark,
      fontWeight: "700",
    },
    headerActions: {
      flexDirection: "row",
      gap: 12,
    },
    headerIconBtn: {
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    headerIconLabel: {
      fontFamily: FONTS.sans,
      fontSize: 10,
      fontWeight: "600",
      color: colors.muted,
    },
    mascotArea: {
      alignItems: "center",
      paddingVertical: 10,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    chatArea: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    emptyText: {
      fontFamily: FONTS.sans,
      fontSize: 16,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 26,
    },
    messageList: {
      padding: 16,
    },
    metaCard: {
      marginTop: 6,
      marginBottom: 8,
      marginLeft: 6,
      marginRight: 24,
      padding: 12,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    metaTitle: {
      fontFamily: FONTS.sans,
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    metaText: {
      fontFamily: FONTS.sans,
      fontSize: 12,
      color: colors.muted,
      lineHeight: 18,
    },
    metaBullet: {
      fontFamily: FONTS.sans,
      fontSize: 12,
      color: colors.foreground,
      lineHeight: 18,
    },
    metaActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    metaSecondaryButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.secondary,
      alignItems: "center",
    },
    metaSecondaryText: {
      fontFamily: FONTS.sans,
      fontSize: 12,
      fontWeight: "700",
      color: colors.foreground,
    },
    metaPrimaryButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
    },
    metaPrimaryText: {
      fontFamily: FONTS.sans,
      fontSize: 12,
      fontWeight: "700",
      color: "#1A1A1A",
    },
    quickActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 8,
      backgroundColor: colors.card,
    },
    quickActionChip: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    quickActionText: {
      fontFamily: FONTS.sans,
      fontSize: 10,
      fontWeight: "700",
      color: colors.muted,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    input: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: FONTS.sans,
      color: colors.foreground,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
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
    newsItem: {
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 4,
    },
    newsTitle: {
      fontFamily: FONTS.sans,
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
      lineHeight: 18,
    },
    newsSource: {
      fontFamily: FONTS.sans,
      fontSize: 11,
      color: colors.muted,
    },
    newsSummaryBlock: {
      gap: 6,
      marginTop: 4,
    },
    newsSummary: {
      fontFamily: FONTS.sans,
      fontSize: 12,
      color: colors.foreground,
      lineHeight: 18,
      padding: 8,
      backgroundColor: colors.background,
      borderRadius: 8,
    },
    newsReadMore: {
      fontFamily: FONTS.sans,
      fontSize: 12,
      fontWeight: "700",
      color: colors.primaryDark,
      paddingLeft: 2,
    },
    newsResumeBtn: {
      alignSelf: "flex-start",
      marginTop: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.secondary,
    },
    newsResumeBtnText: {
      fontFamily: FONTS.sans,
      fontSize: 11,
      fontWeight: "700",
      color: colors.primaryDark,
    },
  });
}

