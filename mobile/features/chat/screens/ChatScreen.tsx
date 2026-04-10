import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Keyboard, KeyboardAvoidingView, Linking, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
import AchievementToast from "@mobile/components/AchievementToast";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { type ConnectionRequestMeta, type NetworkDigestMeta, type NewsDigestMeta, isConnectionRequestMeta, isNetworkDigestMeta, isNewsDigestMeta, parseMessageMeta } from "@mobile/lib/social";
import type { EyeExpression } from "@mobile/stores/uiStore";

type ChatRoute = "/(tabs)/feed" | "/(tabs)/missions" | "/(tabs)/communities" | "/(tabs)/inbox";

const QUICK_ACTIONS = [
  { label: "Quero evoluir", kind: "prompt", value: "Quero evoluir hoje. Me diga a acao mais importante agora." },
  { label: "Me cobre hoje", kind: "prompt", value: "Ative modo cobranca. Quero disciplina hoje." },
  { label: "Criar meta", kind: "prompt", value: "Quero transformar minha prioridade em uma meta clara para hoje." },
  { label: "Ver missoes", kind: "route", value: "/(tabs)/missions" as ChatRoute },
  { label: "Buscar noticias", kind: "news", value: "news" },
] as const;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function xpForLevel(level: number) {
  return level * 100 + (level - 1) * 50;
}

export default function ChatScreen() {
  const [inputValue, setInputValue] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [attention, setAttention] = useState({ x: 0, y: 0 });
  const [lastInteractionAt, setLastInteractionAt] = useState(Date.now());
  const listRef = useRef<any>(null);
  const eyeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attentionResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  const { messages, isTyping, streamingContent, setMessages, addMessage } = useChatStore();
  const { eyeExpression, themeMode, setEyeExpression } = useUIStore();
  const { user } = useAuthStore();
  const { sendMessage } = useChat();
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get("window");

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => () => {
    if (eyeResetTimeoutRef.current) clearTimeout(eyeResetTimeoutRef.current);
    if (attentionResetTimeoutRef.current) clearTimeout(attentionResetTimeoutRef.current);
  }, []);

  const { data: initialMessages } = useQuery({ queryKey: ["messages"], queryFn: () => api.get("/api/messages?limit=50").then((r) => r.data), staleTime: Infinity });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api.get("/api/me").then((r) => r.data), staleTime: 30000 });
  const { data: missions = [] } = useQuery({ queryKey: ["missions"], queryFn: () => api.get("/api/missions").then((r) => r.data), staleTime: 30000 });

  const pulseEyeExpression = useCallback((expression: EyeExpression, fallback: EyeExpression = "neutral", duration = 1600) => {
    setEyeExpression(expression);
    if (eyeResetTimeoutRef.current) clearTimeout(eyeResetTimeoutRef.current);
    eyeResetTimeoutRef.current = setTimeout(() => setEyeExpression(fallback), duration);
  }, [setEyeExpression]);

  const markInteraction = useCallback(() => setLastInteractionAt(Date.now()), []);

  const handleScreenTouch = useCallback((event: any) => {
    const { pageX, pageY } = event?.nativeEvent ?? {};
    if (typeof pageX !== "number" || typeof pageY !== "number") return;
    markInteraction();
    setAttention({
      x: clampNumber((pageX / Math.max(width, 1) - 0.5) * 2, -1, 1),
      y: clampNumber((pageY / Math.max(height, 1) - 0.5) * 2, -1, 1),
    });
    if (attentionResetTimeoutRef.current) clearTimeout(attentionResetTimeoutRef.current);
    attentionResetTimeoutRef.current = setTimeout(() => setAttention({ x: 0, y: 0 }), 1200);
  }, [height, markInteraction, width]);

  const resolveConnection = useMutation({
    mutationFn: async ({ messageId, connectionId, decision }: { messageId: string; connectionId: string; decision: "accept" | "reject" }) => {
      await api.put(`/api/connections/${connectionId}/${decision === "accept" ? "accept" : "reject"}`);
      const content = decision === "accept" ? "Solicitacao aceita. Agora voces podem conversar em Mensagens." : "Solicitacao recusada.";
      const metadata = JSON.stringify({ type: "connection_request_resolved", decision });
      await api.patch(`/api/messages/${messageId}`, { content, metadata });
      return { messageId, content, metadata, decision };
    },
    onSuccess: ({ messageId, content, metadata, decision }) => {
      setMessages(messages.map((message) => (message.id === messageId ? { ...message, content, metadata } : message)));
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      if (decision === "accept") queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  useEffect(() => {
    if (initialMessages && messages.length === 0) setMessages(initialMessages);
  }, [initialMessages, messages.length, setMessages]);

  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await api.get("/api/proactive");
        if (!data?.message) return;
        addMessage({ id: `proactive-${Date.now()}`, role: "assistant", content: data.message, createdAt: new Date().toISOString(), metadata: JSON.stringify({ proactive: true }) });
        pulseEyeExpression("happy", "neutral", 4000);
      } catch {}
    };
    const interval = setInterval(poll, 180000);
    return () => clearInterval(interval);
  }, [addMessage, pulseEyeExpression]);

  useEffect(() => {
    const digest = async () => {
      try {
        const [newsRes, feedRes, suggestionsRes] = await Promise.all([api.get("/api/news"), api.get("/api/feed"), api.get("/api/connections/suggestions?limit=3")]);
        const newsData = newsRes.data ?? { items: [], query: "seus interesses" };
        const feedPosts = Array.isArray(feedRes.data) ? feedRes.data : [];
        const suggestions = Array.isArray(suggestionsRes.data) ? suggestionsRes.data : [];
        if (!newsData.items?.length && !feedPosts.length && !suggestions.length) return;
        addMessage({
          id: `digest-${Date.now()}`,
          role: "assistant",
          content: ["Olha o que voce perde.", feedPosts.length ? `Tem ${feedPosts.length} atualizacao${feedPosts.length > 1 ? "es" : ""} no seu feed.` : null, newsData.items?.length ? `Separei noticias sobre ${newsData.query}.` : null, suggestions.length ? `Tambem achei ${suggestions.length} sugest${suggestions.length > 1 ? "oes" : "ao"} de conexao.` : null].filter(Boolean).join(" "),
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify({ type: "network_digest", query: newsData.query || "seus interesses", newsItems: newsData.items?.slice(0, 3) ?? [], feedPosts: feedPosts.slice(0, 3), suggestions: suggestions.slice(0, 3) } satisfies NetworkDigestMeta),
        });
        pulseEyeExpression("happy", "neutral", 4000);
      } catch {}
    };
    digest();
    const interval = setInterval(digest, 14400000);
    return () => clearInterval(interval);
  }, [addMessage, pulseEyeExpression]);

  useEffect(() => {
    if (!hydratedRef.current) {
      previousMessageCountRef.current = messages.length;
      if (initialMessages || messages.length === 0) hydratedRef.current = true;
      return;
    }
    if (messages.length <= previousMessageCountRef.current) {
      previousMessageCountRef.current = messages.length;
      return;
    }
    const latest = messages[messages.length - 1];
    previousMessageCountRef.current = messages.length;
    markInteraction();
    if (!latest) return;
    if (latest.role === "assistant") pulseEyeExpression("excited", "happy", 1800);
    else setEyeExpression("curious");
  }, [initialMessages, markInteraction, messages, pulseEyeExpression, setEyeExpression]);

  useEffect(() => {
    const interval = setInterval(() => {
      const idleMs = Date.now() - lastInteractionAt;
      if (idleMs >= 75000 && !isTyping && !inputValue.trim()) setEyeExpression("sleepy");
      else if (eyeExpression === "sleepy" && !isTyping) setEyeExpression(messages.length > 0 ? "neutral" : "happy");
    }, 5000);
    return () => clearInterval(interval);
  }, [eyeExpression, inputValue, isTyping, lastInteractionAt, messages.length, setEyeExpression]);

  const missionStats = useMemo(() => {
    const total = Array.isArray(missions) ? missions.length : 0;
    const completed = Array.isArray(missions) ? missions.filter((mission: any) => mission.completed).length : 0;
    return { total, completed, pending: Math.max(total - completed, 0), completionRate: total > 0 ? completed / total : 0 };
  }, [missions]);

  const level = me?.level ?? user?.level ?? 1;
  const xp = me?.xp ?? user?.xp ?? 0;
  const xpGoal = xpForLevel(level);
  const xpProgress = clampNumber(xp / Math.max(xpGoal, 1), 0, 1);
  const streak = me?.currentStreak ?? user?.currentStreak ?? 0;
  const lastActiveHours = me?.lastActiveAt ? Math.max(0, (Date.now() - new Date(me.lastActiveAt).getTime()) / 3600000) : null;
  const focusScore = useMemo(() => Math.round(Math.min(streak / 7, 1) * 35 + missionStats.completionRate * 45 + xpProgress * 20), [missionStats.completionRate, streak, xpProgress]);
  const scoreColor = focusScore < 40 ? colors.destructive : focusScore < 70 ? colors.primaryDark : colors.success;
  const scoreTone = focusScore < 40 ? "Risco" : focusScore < 70 ? "Ritmo" : "Progresso";

  const insightText = useMemo(() => {
    if (lastActiveHours !== null && lastActiveHours >= 20) return `Voce ficou ${Math.round(lastActiveHours)}h longe. Retome com uma acao simples antes de perder ritmo.`;
    if (missionStats.pending > 0 && missionStats.completionRate < 0.34) return `Voce esta ${100 - Math.round(missionStats.completionRate * 100)}% abaixo do ritmo de missoes de hoje.`;
    if (missionStats.completed > 0) return "Bom. Hoje ja existe evidencia de progresso, nao so intencao.";
    if (streak === 0) return "Sua sequencia ainda nao comecou. Uma acao concluida hoje muda esse estado.";
    return "Se quiser, eu transformo sua prioridade atual em uma acao objetiva agora.";
  }, [lastActiveHours, missionStats.completed, missionStats.completionRate, missionStats.pending, streak]);

  const presenceLabel = useMemo(() => {
    if (eyeExpression === "sleepy") return "Modo cansado";
    if (eyeExpression === "celebrating") return "Missao concluida";
    if (eyeExpression === "excited") return "Alta atencao";
    if (eyeExpression === "curious") return "Lendo voce";
    return focusScore >= 70 ? "Engajada" : "Observando";
  }, [eyeExpression, focusScore]);

  const eyeAttention = useMemo(() => ({
    x: clampNumber(attention.x + (isTyping ? 0.08 : 0), -1, 1),
    y: clampNumber(attention.y + (isInputFocused ? 0.5 : 0) + (isTyping ? 0.12 : 0), -1, 1),
  }), [attention.x, attention.y, isInputFocused, isTyping]);

  async function handleSend() {
    const message = inputValue.trim();
    if (!message) return;
    setInputValue("");
    markInteraction();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const commandHandled = await handleSlashCommand(message);
    if (!commandHandled) await sendMessage(message);
  }

  async function handleQuickAction(action: (typeof QUICK_ACTIONS)[number]) {
    markInteraction();
    if (action.kind === "prompt") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sendMessage(action.value);
      return;
    }
    if (action.kind === "route") {
      router.push(action.value);
      return;
    }
    await handleNewsCommand();
  }

  async function handleSlashCommand(raw: string) {
    const command = raw.toLowerCase();
    if (command === "/feed") return injectAssistantShortcut("Abrindo o feed da comunidade para voce.", "/(tabs)/feed");
    if (command === "/missoes" || command === "/missÃµes") return injectAssistantShortcut("Levando voce para suas missoes ativas.", "/(tabs)/missions");
    if (command === "/compartilhar") return injectAssistantShortcut("O atalho de compartilhar abre o feed para voce criar um novo post.", "/(tabs)/feed");
    if (command === "/comunidades") return injectAssistantShortcut("Abrindo as comunidades.", "/(tabs)/communities");
    if (command === "/mensagens" || command === "/inbox") return injectAssistantShortcut("Abrindo sua inbox.", "/(tabs)/inbox");
    if (command === "/noticias" || command === "/notÃ­cias") {
      await handleNewsCommand();
      return true;
    }
    return false;
  }

  function injectAssistantShortcut(content: string, href: ChatRoute) {
    addMessage({ id: `shortcut-${Date.now()}`, role: "assistant", content, createdAt: new Date().toISOString(), metadata: null });
    router.push(href);
    return true;
  }

  async function handleNewsCommand() {
    addMessage({ id: `news-loading-${Date.now()}`, role: "assistant", content: "Buscando noticias para voce...", createdAt: new Date().toISOString(), metadata: null });
    try {
      const { data } = await api.get("/api/news");
      const items = Array.isArray(data?.items) ? data.items : [];
      addMessage({ id: `news-${Date.now()}`, role: "assistant", content: items.length ? `Separei ${items.length} noticias sobre "${data.query}". Toque em uma para resumir.` : "Nao encontrei noticias no momento. Tente novamente mais tarde.", createdAt: new Date().toISOString(), metadata: items.length ? JSON.stringify({ type: "news_digest", query: data.query, items } satisfies NewsDigestMeta) : null });
      pulseEyeExpression("excited", "happy", 2000);
    } catch {
      addMessage({ id: `news-err-${Date.now()}`, role: "assistant", content: "Nao consegui buscar as noticias agora. Verifique sua conexao.", createdAt: new Date().toISOString(), metadata: null });
    }
  }

  const allMessages = [...messages, ...(isTyping && streamingContent ? [{ id: "streaming", role: "assistant" as const, content: `${streamingContent}...`, createdAt: new Date().toISOString(), metadata: null }] : [])];

  return (
    <SafeAreaView style={styles.container} onTouchStart={handleScreenTouch} onTouchMove={handleScreenTouch}>
      <AchievementToast />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.logo}>bee-eyes</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push("/(tabs)/friends")}><Feather name="users" size={20} color={colors.muted} /><Text style={styles.headerIconLabel}>Amigos</Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push("/(tabs)/profile")}><Feather name="user" size={20} color={colors.muted} /><Text style={styles.headerIconLabel}>Perfil</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.mascotArea}>
        <View style={styles.presenceCard}>
          <View style={styles.presenceTopRow}>
            <BeeEyes expression={eyeExpression} size={74} attentionX={eyeAttention.x} attentionY={eyeAttention.y} />
            <View style={styles.metricsPanel}>
              <Text style={styles.presenceLabel}>{presenceLabel}</Text>
              <Text style={styles.scoreValue}>{focusScore}</Text>
              <Text style={[styles.scoreTone, { color: scoreColor }]}>{scoreTone} de foco</Text>
            </View>
          </View>
          <View style={styles.progressMetaRow}>
            <View style={styles.metricBadge}><Text style={styles.metricLabel}>Streak</Text><Text style={styles.metricValue}>{streak}d</Text></View>
            <View style={styles.metricBadge}><Text style={styles.metricLabel}>Missoes</Text><Text style={styles.metricValue}>{missionStats.completed}/{Math.max(missionStats.total, 1)}</Text></View>
            <View style={styles.metricBadge}><Text style={styles.metricLabel}>XP</Text><Text style={styles.metricValue}>{xp}/{xpGoal}</Text></View>
          </View>
          <View style={styles.scoreTrack}><View style={[styles.scoreFill, { width: `${focusScore}%`, backgroundColor: scoreColor }]} /></View>
          <Text style={styles.insightText}>{insightText}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.chatArea} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        {allMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Ola, {user?.displayName || user?.username}!{"\n"}Me diga o que voce quer evoluir ou toque em uma sugestao abaixo.</Text>
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
                  {isConnectionRequestMeta(meta) ? <ConnectionRequestCard styles={styles} pending={resolveConnection.isPending} meta={meta} onAccept={() => resolveConnection.mutate({ messageId: item.id, connectionId: meta.connectionId, decision: "accept" })} onReject={() => resolveConnection.mutate({ messageId: item.id, connectionId: meta.connectionId, decision: "reject" })} /> : null}
                  {isNetworkDigestMeta(meta) ? <NetworkDigestCard meta={meta} styles={styles} /> : null}
                  {isNewsDigestMeta(meta) ? <NewsDigestCard meta={meta} styles={styles} /> : null}
                </View>
              );
            }}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <View style={styles.thoughtStrip}>
          <Text style={styles.thoughtLabel}>Insight</Text>
          <Text style={styles.thoughtText}>{insightText}</Text>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={(value) => { setInputValue(value); markInteraction(); }}
            placeholder="Me diga sua prioridade ou o que esta travando voce..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={1000}
            onSubmitEditing={handleSend}
            onFocus={() => { markInteraction(); setIsInputFocused(true); setEyeExpression("curious"); }}
            onBlur={() => setIsInputFocused(false)}
          />
          <TouchableOpacity style={[styles.sendButton, (!inputValue.trim() || isTyping) && styles.sendButtonDisabled]} onPress={handleSend} disabled={!inputValue.trim() || isTyping}>
            <Text style={styles.sendIcon}>Ir</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((item) => (
            <TouchableOpacity key={item.label} style={styles.quickActionChip} onPress={() => handleQuickAction(item)}>
              <Text style={styles.quickActionText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ConnectionRequestCard({ meta, pending, onAccept, onReject, styles }: { meta: ConnectionRequestMeta; pending: boolean; onAccept: () => void; onReject: () => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle}>Pedido de conexao</Text>
      <Text style={styles.metaText}>{meta.fromName || "Alguem"} quer se conectar com voce.</Text>
      <View style={styles.metaActions}>
        <TouchableOpacity style={styles.metaSecondaryButton} onPress={onReject} disabled={pending}><Text style={styles.metaSecondaryText}>Recusar</Text></TouchableOpacity>
        <TouchableOpacity style={styles.metaPrimaryButton} onPress={onAccept} disabled={pending}><Text style={styles.metaPrimaryText}>{pending ? "..." : "Aceitar"}</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function NetworkDigestCard({ meta, styles }: { meta: NetworkDigestMeta; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle}>Resumo da rede</Text>
      <Text style={styles.metaText}>Busca: {meta.query}</Text>
      {meta.newsItems.slice(0, 2).map((item) => <Text key={item.link} style={styles.metaBullet}>- {item.title}</Text>)}
      {meta.feedPosts.slice(0, 2).map((post) => <Text key={post.id} style={styles.metaBullet}>- {post.author.displayName || post.author.username}: {post.content}</Text>)}
      {meta.suggestions.slice(0, 2).map((suggestion) => <Text key={suggestion.id} style={styles.metaBullet}>- Conexao sugerida: {suggestion.displayName || suggestion.username}</Text>)}
    </View>
  );
}

function NewsDigestCard({ meta, styles }: { meta: NewsDigestMeta; styles: ReturnType<typeof makeStyles> }) {
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const summarize = useCallback(async (link: string, title: string) => {
    setLoading(link);
    try {
      const { data } = await api.post("/api/news/summarize", { url: link, title });
      setSummaries((previous) => ({ ...previous, [link]: data.summary }));
    } catch {
      setSummaries((previous) => ({ ...previous, [link]: "Nao foi possivel resumir este artigo." }));
    } finally {
      setLoading(null);
    }
  }, []);

  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle}>Noticias - {meta.query}</Text>
      {meta.items.map((item) => (
        <View key={item.link} style={styles.newsItem}>
          <Text style={styles.newsTitle}>{item.title}</Text>
          <Text style={styles.newsSource}>{item.source}</Text>
          {summaries[item.link] ? (
            <View style={styles.newsSummaryBlock}>
              <Text style={styles.newsSummary}>{summaries[item.link]}</Text>
              <TouchableOpacity onPress={() => Linking.openURL(item.link)}><Text style={styles.newsReadMore}>Ler mais</Text></TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.newsResumeBtn} onPress={() => summarize(item.link, item.title)} disabled={loading === item.link}>
              <Text style={styles.newsResumeBtnText}>{loading === item.link ? "Resumindo..." : "Resumir"}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
    logo: { fontFamily: FONTS.display, fontSize: 24, color: colors.primaryDark, fontWeight: "700" },
    headerActions: { flexDirection: "row", gap: 12 },
    headerIconBtn: { alignItems: "center", justifyContent: "center", gap: 3 },
    headerIconLabel: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "600", color: colors.muted },
    mascotArea: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    presenceCard: { borderRadius: 24, padding: 16, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, gap: 12 },
    presenceTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    metricsPanel: { flex: 1, alignItems: "flex-end", gap: 2 },
    presenceLabel: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
    scoreValue: { fontFamily: FONTS.display, fontSize: 32, fontWeight: "800", color: colors.foreground },
    scoreTone: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700" },
    progressMetaRow: { flexDirection: "row", gap: 8 },
    metricBadge: { flex: 1, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 4 },
    metricLabel: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
    metricValue: { fontFamily: FONTS.mono, fontSize: 14, fontWeight: "700", color: colors.foreground },
    scoreTrack: { height: 10, borderRadius: 999, backgroundColor: colors.card, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
    scoreFill: { height: "100%", borderRadius: 999 },
    insightText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, color: colors.foreground },
    chatArea: { flex: 1 },
    emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
    emptyText: { fontFamily: FONTS.sans, fontSize: 16, color: colors.muted, textAlign: "center", lineHeight: 26 },
    messageList: { padding: 16 },
    thoughtStrip: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, backgroundColor: colors.card, gap: 2 },
    thoughtLabel: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
    thoughtText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18, color: colors.foreground },
    inputRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
    input: { flex: 1, backgroundColor: colors.background, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, fontFamily: FONTS.sans, color: colors.foreground, maxHeight: 120, borderWidth: 1, borderColor: colors.border },
    sendButton: { minWidth: 48, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
    sendButtonDisabled: { opacity: 0.4 },
    sendIcon: { fontFamily: FONTS.sans, fontSize: 14, color: "#1A1A1A", fontWeight: "800" },
    quickActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, backgroundColor: colors.card },
    quickActionChip: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
    quickActionText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.foreground },
    metaCard: { marginTop: 6, marginBottom: 8, marginLeft: 6, marginRight: 24, padding: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 6 },
    metaTitle: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.foreground },
    metaText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, lineHeight: 18 },
    metaBullet: { fontFamily: FONTS.sans, fontSize: 12, color: colors.foreground, lineHeight: 18 },
    metaActions: { flexDirection: "row", gap: 10, marginTop: 4 },
    metaSecondaryButton: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.secondary, alignItems: "center" },
    metaSecondaryText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.foreground },
    metaPrimaryButton: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center" },
    metaPrimaryText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: "#1A1A1A" },
    newsItem: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
    newsTitle: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "600", color: colors.foreground, lineHeight: 18 },
    newsSource: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted },
    newsSummaryBlock: { gap: 6, marginTop: 4 },
    newsSummary: { fontFamily: FONTS.sans, fontSize: 12, color: colors.foreground, lineHeight: 18, padding: 8, backgroundColor: colors.background, borderRadius: 8 },
    newsReadMore: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.primaryDark, paddingLeft: 2 },
    newsResumeBtn: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.secondary },
    newsResumeBtnText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.primaryDark },
  });
}
