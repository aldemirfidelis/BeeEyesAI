import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, ActivityIndicator, Dimensions, Image, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL_RAW } from "@mobile/lib/api";
import { useChatStore } from "@mobile/stores/chatStore";
import { useUIStore } from "@mobile/stores/uiStore";
import { useAuthStore } from "@mobile/stores/authStore";
import { useChat } from "@mobile/hooks/useChat";
import BeeEyes from "@mobile/components/BeeEyes";
import ChatMessage from "@mobile/components/ChatMessage";
import AchievementToast from "@mobile/components/AchievementToast";
import { UserAvatar } from "@mobile/components/UserAvatar";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { type ChatFeedSummaryPost, type ConnectionRequestMeta, type NetworkDigestMeta, type NewsDigestMeta, isConnectionRequestMeta, isNetworkDigestMeta, isNewsDigestMeta, parseMessageMeta, timeAgo } from "@mobile/lib/social";
import type { IntelligentNotification, NotificationCenterItem, ScoreSnapshot } from "@mobile/lib/intelligence";
import type { EyeExpression } from "@mobile/stores/uiStore";

type AppRoute = "/feed" | "/communities" | "/inbox" | "/notifications" | "/friends" | "/profile";

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Optimized for Whisper: mono reduces noise and file size by 50%, MAX quality preserves speech clarity
const SPEECH_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
};

export default function ChatScreen() {
  const { t } = useTranslation();

  const QUICK_ACTIONS = [
    { label: t("chat_quick_evolve"), kind: "prompt", value: "Quero evoluir hoje. Me diga a acao mais importante agora." },
    { label: t("chat_quick_hold_me"), kind: "prompt", value: "Ative modo cobranca. Quero disciplina hoje." },
    { label: t("chat_quick_set_goal"), kind: "prompt", value: "Quero transformar minha prioridade em uma meta clara para hoje." },
    { label: t("chat_quick_news"), kind: "news", value: "news" },
  ] as const;

  const [inputValue, setInputValue] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartRef = useRef<number>(0);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveHeights = useRef(Array.from({ length: 6 }, () => new Animated.Value(4))).current;
  const [showInsight, setShowInsight] = useState(false);
  const [attention, setAttention] = useState({ x: 0, y: 0 });
  const [lastInteractionAt, setLastInteractionAt] = useState(Date.now());
  const listRef = useRef<any>(null);
  const eyeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attentionResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  const isAtBottomRef = useRef(true);
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
    if (meteringIntervalRef.current) clearInterval(meteringIntervalRef.current);
  }, []);

  const { data: initialMessages } = useQuery({ queryKey: ["messages"], queryFn: () => api.get("/api/messages?limit=50").then((r) => r.data), staleTime: Infinity });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api.get("/api/me").then((r) => r.data), staleTime: 30000 });
  const { data: score } = useQuery<ScoreSnapshot>({
    queryKey: ["score"],
    queryFn: () => api.get("/api/score").then((r) => r.data),
    staleTime: 30000,
    refetchInterval: 45000,
  });
  const { data: notifications = [] } = useQuery<IntelligentNotification[]>({
    queryKey: ["intelligent-notifications"],
    queryFn: () => api.get("/api/notifications/intelligent").then((r) => r.data),
    staleTime: 45000,
    refetchInterval: 90000,
  });
  const { data: notificationCenter = [] } = useQuery<NotificationCenterItem[]>({
    queryKey: ["notifications-center"],
    queryFn: () => api.get("/api/notifications/center").then((r) => r.data),
    staleTime: 45000,
    refetchInterval: 90000,
  });
  const chatMessages = Array.isArray(messages) ? messages : [];
  const intelligentNotifications = Array.isArray(notifications) ? notifications : [];
  const notificationItems = Array.isArray(notificationCenter) ? notificationCenter : [];
  const unreadNotificationCount = notificationItems.filter((item) => !item.read).length;

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
      const content = decision === "accept" ? t("chat_connection_accepted") : t("chat_connection_rejected");
      const metadata = JSON.stringify({ type: "connection_request_resolved", decision });
      await api.patch(`/api/messages/${messageId}`, { content, metadata });
      return { messageId, content, metadata, decision };
    },
    onSuccess: ({ messageId, content, metadata, decision }) => {
      setMessages(chatMessages.map((message) => (message.id === messageId ? { ...message, content, metadata } : message)));
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      if (decision === "accept") queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const resolveHolidayAlarm = useMutation({
    mutationFn: async ({ messageId, meta, decision }: { messageId: string; meta: any; decision: "create" | "skip" }) => {
      const alarmDraft = meta?.alarmDraft;
      const holidayName = meta?.holiday?.name ?? "feriado";
      if (!alarmDraft) throw new Error("Alarme inválido");

      if (decision === "create") {
        await api.post("/api/colmeia/alarms", alarmDraft);
      }

      const content = decision === "create"
        ? `Combinado. Criei o despertador mesmo sendo ${holidayName}.`
        : `Tudo bem. Não criei esse despertador para ${holidayName}.`;
      const metadata = JSON.stringify({ type: "holiday_alarm_resolved", decision });
      await api.patch(`/api/messages/${messageId}`, { content, metadata });
      return { messageId, content, metadata };
    },
    onSuccess: ({ messageId, content, metadata }) => {
      setMessages(chatMessages.map((message) => (message.id === messageId ? { ...message, content, metadata } : message)));
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["colmeia-alarms"] });
    },
  });

  const resolveAlarmReactivation = useMutation({
    mutationFn: async ({ messageId, meta, decision }: { messageId: string; meta: any; decision: "activate" | "keep_paused" }) => {
      const alarmId = meta?.alarmId;
      const title = meta?.title ?? "alarme";
      if (!alarmId) throw new Error("Alarme invalido");

      if (decision === "activate") {
        await api.patch(`/api/colmeia/alarms/${alarmId}`, { active: true });
      }

      const content = decision === "activate"
        ? `Combinado. Reativei o alarme "${title}".`
        : `Tudo bem. Mantive o alarme "${title}" pausado.`;
      const metadata = JSON.stringify({ type: "reactivate_alarm_resolved", decision, alarmId });
      await api.patch(`/api/messages/${messageId}`, { content, metadata });
      return { messageId, content, metadata };
    },
    onSuccess: ({ messageId, content, metadata }) => {
      setMessages(chatMessages.map((message) => (message.id === messageId ? { ...message, content, metadata } : message)));
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["colmeia-alarms"] });
    },
  });

  useEffect(() => {
    if (Array.isArray(initialMessages) && chatMessages.length === 0) setMessages(initialMessages);
  }, [initialMessages, chatMessages.length, setMessages]);

  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await api.get("/api/proactive");
        if (!data?.message) return;
        addMessage({
          id: data.id ?? `proactive-${Date.now()}`,
          role: "assistant",
          content: data.message,
          createdAt: data.createdAt ?? new Date().toISOString(),
          metadata: data.metadata ?? JSON.stringify({ proactive: true }),
        });
        pulseEyeExpression("happy", "neutral", 4000);
      } catch {}
    };
    const interval = setInterval(poll, 180000);
    return () => clearInterval(interval);
  }, [addMessage, pulseEyeExpression]);

  // App usage tips — fires after 8 min on first load, then every 4 hours
  useEffect(() => {
    const fetchTip = async () => {
      try {
        const { data } = await api.get("/api/app-tip");
        if (!data?.tip) return;
        addMessage({
          id: `tip-${Date.now()}`,
          role: "assistant",
          content: data.tip,
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify({ appTip: true }),
        });
        pulseEyeExpression("happy", "neutral", 3000);
      } catch {}
    };
    const delay = setTimeout(fetchTip, 8 * 60 * 1000);
    const interval = setInterval(fetchTip, 4 * 60 * 60 * 1000);
    return () => { clearTimeout(delay); clearInterval(interval); };
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
      previousMessageCountRef.current = chatMessages.length;
      if (initialMessages || chatMessages.length === 0) hydratedRef.current = true;
      return;
    }
    if (chatMessages.length <= previousMessageCountRef.current) {
      previousMessageCountRef.current = chatMessages.length;
      return;
    }
    const latest = chatMessages[chatMessages.length - 1];
    previousMessageCountRef.current = chatMessages.length;
    markInteraction();
    if (!latest) return;
    if (latest.role === "assistant") pulseEyeExpression("excited", "happy", 1800);
    else setEyeExpression("curious");
  }, [initialMessages, markInteraction, chatMessages, pulseEyeExpression, setEyeExpression]);

  useEffect(() => {
    const interval = setInterval(() => {
      const idleMs = Date.now() - lastInteractionAt;
      if (idleMs >= 75000 && !isTyping && !inputValue.trim()) setEyeExpression("sleepy");
      else if (eyeExpression === "sleepy" && !isTyping) setEyeExpression(chatMessages.length > 0 ? "neutral" : "happy");
    }, 5000);
    return () => clearInterval(interval);
  }, [eyeExpression, inputValue, isTyping, lastInteractionAt, chatMessages.length, setEyeExpression]);

  const lastActiveHours = me?.lastActiveAt ? Math.max(0, (Date.now() - new Date(me.lastActiveAt).getTime()) / 3600000) : null;
  const focusScore = score?.focusScore ?? 0;
  const consistencyScore = score?.consistencyScore ?? 0;
  const disciplineScore = score?.disciplineScore ?? 0;
  const scoreColor = focusScore < 40 ? colors.destructive : focusScore < 70 ? colors.primaryDark : colors.success;
  const scoreTone = score?.scoreTone ?? (focusScore < 40 ? "Risco" : focusScore < 70 ? "Ritmo" : "Progresso");

  const fallbackInsightText = useMemo(() => {
    if (lastActiveHours !== null && lastActiveHours >= 20) return `Voce ficou ${Math.round(lastActiveHours)}h longe. Retome com uma acao simples antes de perder ritmo.`;
    if ((me?.currentStreak ?? 0) === 0) return "Sua sequencia ainda nao comecou. Uma acao concluida hoje muda esse estado.";
    return "Se quiser, eu transformo sua prioridade atual em uma acao objetiva agora.";
  }, [lastActiveHours, me?.currentStreak]);
  const insightText = score?.insight ?? fallbackInsightText;

  const presenceLabel = useMemo(() => {
    if (eyeExpression === "sleepy") return t("chat_mode_sleepy");
    if (eyeExpression === "celebrating") return t("chat_mode_high_attention");
    if (eyeExpression === "excited") return t("chat_mode_high_attention");
    if (eyeExpression === "curious") return t("chat_mode_reading");
    return focusScore >= 70 ? t("chat_mode_engaged") : t("chat_mode_observing");
  }, [eyeExpression, focusScore]);

  const eyeAttention = useMemo(() => ({
    x: clampNumber(attention.x + (isTyping ? 0.08 : 0), -1, 1),
    y: clampNumber(attention.y + (isInputFocused ? 0.5 : 0) + (isTyping ? 0.12 : 0), -1, 1),
  }), [attention.x, attention.y, isInputFocused, isTyping]);

  async function handleMicPress() {
    if (isTranscribing) return;

    if (isRecording) {
      // Enforce minimum 1 second to avoid Whisper hallucinations on silent audio
      const elapsed = Date.now() - recordingStartRef.current;
      if (elapsed < 1000) return;

      if (meteringIntervalRef.current) {
        clearInterval(meteringIntervalRef.current);
        meteringIntervalRef.current = null;
      }

      try {
        await recordingRef.current?.stopAndUnloadAsync();
        const uri = recordingRef.current?.getURI() ?? null;
        recordingRef.current = null;
        setIsRecording(false);
        // Restore audio mode so other app audio works normally on iOS
        Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});

        if (!uri) return;
        setIsTranscribing(true);
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const token = await SecureStore.getItemAsync("bee_token");
          const res = await fetch(`${API_URL_RAW}/api/transcribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ audio: base64, mimeType: "audio/m4a" }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.text) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await sendMessage(data.text);
            } else {
              setTranscriptionError(true);
              setTimeout(() => setTranscriptionError(false), 3000);
            }
          }
        } finally {
          setIsTranscribing(false);
        }
      } catch {
        recordingRef.current = null;
        setIsRecording(false);
        setIsTranscribing(false);
      }
      return;
    }

    setTranscriptionError(false);
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const { recording } = await Audio.Recording.createAsync(SPEECH_RECORDING_OPTIONS);
      recordingRef.current = recording;
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Drive waveform bars from real mic metering (dBFS: -50..0 → 0..1)
      meteringIntervalRef.current = setInterval(async () => {
        if (!recordingRef.current) return;
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording && status.metering != null) {
            const normalized = Math.max(0, Math.min(1, (status.metering + 50) / 50));
            waveHeights.forEach((h) => {
              h.setValue(4 + normalized * (0.7 + Math.random() * 0.6) * 22);
            });
          }
        } catch {}
      }, 80);
    } catch {
      setIsRecording(false);
    }
  }

  // Timer counter
  useEffect(() => {
    if (!isRecording) { setRecordingSeconds(0); return; }
    const timer = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  // Pulsing red dot
  useEffect(() => {
    if (!isRecording) { pulseAnim.setValue(1); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.15, duration: 550, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 550, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isRecording]);

  // Waveform bars — reset to idle when not recording; updated by metering polling during recording
  useEffect(() => {
    if (!isRecording) waveHeights.forEach(h => h.setValue(4));
  }, [isRecording, waveHeights]);

  async function handleCancelRecording() {
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }
    try { await recordingRef.current?.stopAndUnloadAsync(); } catch {}
    recordingRef.current = null;
    setIsRecording(false);
    Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleSend() {
    const message = inputValue.trim();
    if (!message) return;
    setInputValue("");
    markInteraction();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isAtBottomRef.current = true;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
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
    await handleNewsCommand();
  }

  async function handleSlashCommand(raw: string) {
    const command = raw.toLowerCase();
    if (command === "/feed") return injectAssistantShortcut("Abrindo o feed da comunidade para voce.", "/feed");
    if (command === "/compartilhar") return injectAssistantShortcut("O atalho de compartilhar abre o feed para voce criar um novo post.", "/feed");
    if (command === "/comunidades") return injectAssistantShortcut("Abrindo as comunidades.", "/communities");
    if (command === "/mensagens" || command === "/inbox") return injectAssistantShortcut("Abrindo sua inbox.", "/inbox");
    if (command === "/noticias" || command === "/notÃ­cias") {
      await handleNewsCommand();
      return true;
    }
    return false;
  }

  function injectAssistantShortcut(content: string, href: AppRoute) {
    addMessage({ id: `shortcut-${Date.now()}`, role: "assistant", content, createdAt: new Date().toISOString(), metadata: null });
    router.push(href);
    return true;
  }

  async function handleNewsCommand() {
    addMessage({ id: `news-loading-${Date.now()}`, role: "assistant", content: t("chat_fetching_news"), createdAt: new Date().toISOString(), metadata: null });
    try {
      const { data } = await api.get("/api/news");
      const items = Array.isArray(data?.items) ? data.items : [];
      addMessage({ id: `news-${Date.now()}`, role: "assistant", content: items.length ? t("chat_news_found", { count: items.length, query: data.query }) : t("chat_news_not_found"), createdAt: new Date().toISOString(), metadata: items.length ? JSON.stringify({ type: "news_digest", query: data.query, items } satisfies NewsDigestMeta) : null });
      pulseEyeExpression("excited", "happy", 2000);
    } catch {
      addMessage({ id: `news-err-${Date.now()}`, role: "assistant", content: t("chat_news_error"), createdAt: new Date().toISOString(), metadata: null });
    }
  }

  const allMessages = [...chatMessages, ...(isTyping && streamingContent ? [{ id: "streaming", role: "assistant" as const, content: `${streamingContent}...`, createdAt: new Date().toISOString(), metadata: null }] : [])];

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]} onTouchStart={handleScreenTouch} onTouchMove={handleScreenTouch}>
      <AchievementToast />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.logo}>bee-eyes</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push("/notifications")}>
            <View>
              <Feather name="bell" size={20} color={colors.muted} />
              {unreadNotificationCount > 0 ? (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{Math.min(unreadNotificationCount, 9)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.headerIconLabel}>{t("chat_alerts")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push("/friends")}><Feather name="users" size={20} color={colors.muted} /><Text style={styles.headerIconLabel}>{t("chat_friends")}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push("/profile")}><Feather name="user" size={20} color={colors.muted} /><Text style={styles.headerIconLabel}>{t("chat_profile")}</Text></TouchableOpacity>
        </View>
      </View>
      {/* Compact mascot bar */}
      <View style={styles.mascotBar}>
        <BeeEyes expression={eyeExpression} size={62} attentionX={eyeAttention.x} attentionY={eyeAttention.y} />
      </View>

      {/* Insight modal */}
      <Modal visible={showInsight} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setShowInsight(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowInsight(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{t("chat_insight_modal")}</Text>
              <View style={styles.progressMetaRow}>
                <View style={styles.metricBadge}><Text style={styles.metricLabel}>{t("chat_mode_observing")}</Text><Text style={styles.metricValue}>{focusScore}%</Text></View>
              </View>
              <View style={[styles.scoreTrack, { marginTop: 12 }]}><View style={[styles.scoreFill, { width: `${focusScore}%`, backgroundColor: scoreColor }]} /></View>
              <View style={[styles.secondaryScoreRow, { marginTop: 8 }]}>
                <Text style={styles.secondaryScoreText}>{consistencyScore}% constancia</Text>
                <Text style={styles.secondaryScoreText}>{disciplineScore}% disciplina</Text>
              </View>
              <Text style={[styles.insightText, { marginTop: 14 }]}>{insightText}</Text>
              {intelligentNotifications.length > 0 ? (
                <View style={[styles.notificationStack, { marginTop: 12 }]}>
                  {intelligentNotifications.map((notification) => (
                    <View
                      key={notification.id}
                      style={[
                        styles.notificationCard,
                        notification.tone === "danger"
                          ? styles.notificationDanger
                          : notification.tone === "positive"
                          ? styles.notificationPositive
                          : styles.notificationWarning,
                      ]}
                    >
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      <Text style={styles.notificationBody}>{notification.body}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <KeyboardAvoidingView style={styles.chatArea} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        {allMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t("chat_empty", { name: user?.displayName || user?.username })}</Text>
          </View>
        ) : (
          <FlashList
            ref={listRef}
            data={allMessages}
            renderItem={({ item }) => {
              const meta = parseMessageMeta(item.metadata);
              let rawMeta: Record<string, unknown> = {};
              try { rawMeta = JSON.parse(item.metadata || "{}"); } catch { /* ignore */ }
              if (rawMeta.appTip === true) {
                return <AppTipCard content={item.content} createdAt={item.createdAt} styles={styles} />;
              }
              return (
                <View>
                  <ChatMessage role={item.role} content={item.content} createdAt={item.createdAt} />
                  {isConnectionRequestMeta(meta) ? <ConnectionRequestCard styles={styles} pending={resolveConnection.isPending} meta={meta} onAccept={() => resolveConnection.mutate({ messageId: item.id, connectionId: meta.connectionId, decision: "accept" })} onReject={() => resolveConnection.mutate({ messageId: item.id, connectionId: meta.connectionId, decision: "reject" })} /> : null}
                  {rawMeta.type === "holiday_alarm_confirmation" ? (
                    <HolidayAlarmCard
                      styles={styles}
                      pending={resolveHolidayAlarm.isPending}
                      onCreate={() => resolveHolidayAlarm.mutate({ messageId: item.id, meta: rawMeta, decision: "create" })}
                      onSkip={() => resolveHolidayAlarm.mutate({ messageId: item.id, meta: rawMeta, decision: "skip" })}
                    />
                  ) : null}
                  {rawMeta.type === "reactivate_alarm_confirmation" ? (
                    <AlarmReactivationCard
                      styles={styles}
                      pending={resolveAlarmReactivation.isPending}
                      onActivate={() => resolveAlarmReactivation.mutate({ messageId: item.id, meta: rawMeta, decision: "activate" })}
                      onKeepPaused={() => resolveAlarmReactivation.mutate({ messageId: item.id, meta: rawMeta, decision: "keep_paused" })}
                    />
                  ) : null}
                  {isNetworkDigestMeta(meta) ? <NetworkDigestCard meta={meta} styles={styles} /> : null}
                  {isNewsDigestMeta(meta) ? <NewsDigestCard meta={meta} styles={styles} /> : null}
                </View>
              );
            }}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              isAtBottomRef.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 80;
            }}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (isAtBottomRef.current) listRef.current?.scrollToEnd({ animated: true });
            }}
          />
        )}

        {transcriptionError && (
          <Text style={styles.transcriptionError}>
            Não entendi o áudio. Fale mais alto ou por mais tempo.
          </Text>
        )}

        {isRecording || isTranscribing ? (
          <View style={styles.recordingRow}>
            {/* Cancel — trash icon */}
            <TouchableOpacity
              onPress={handleCancelRecording}
              disabled={isTranscribing}
              style={styles.recCancelBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="trash-2" size={20} color={isTranscribing ? colors.muted : colors.destructive} />
            </TouchableOpacity>

            {/* Pulsing dot + timer */}
            <View style={styles.recInfo}>
              <Animated.View style={[styles.recDot, { opacity: pulseAnim }]} />
              <Text style={styles.recTimer}>
                {`${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`}
              </Text>
            </View>

            {/* Waveform bars */}
            <View style={styles.recWaveform}>
              {waveHeights.map((h, i) => (
                <Animated.View
                  key={i}
                  style={[styles.recWaveBar, { height: h, opacity: isTranscribing ? 0.3 : 1 }]}
                />
              ))}
            </View>

            {/* Send / processing */}
            <TouchableOpacity
              onPress={handleMicPress}
              disabled={isTranscribing}
              style={styles.recSendBtn}
            >
              {isTranscribing ? (
                <ActivityIndicator size="small" color="#1A1A1A" />
              ) : (
                <Feather name="send" size={18} color="#1A1A1A" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputValue}
              onChangeText={(value) => { setInputValue(value); markInteraction(); }}
              placeholder={t("chat_placeholder")}
              placeholderTextColor={colors.muted}
              multiline
              maxLength={1000}
              onSubmitEditing={handleSend}
              onFocus={() => { markInteraction(); setIsInputFocused(true); setEyeExpression("curious"); }}
              onBlur={() => setIsInputFocused(false)}
            />
            <TouchableOpacity style={styles.micButton} onPress={handleMicPress}>
              <Feather name="mic" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sendButton, (!inputValue.trim() || isTyping) && styles.sendButtonDisabled]} onPress={handleSend} disabled={!inputValue.trim() || isTyping}>
              <Feather name="send" size={18} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AppTipCard({ content, createdAt, styles }: { content: string; createdAt: string; styles: ReturnType<typeof makeStyles> }) {
  const text = content.replace(/^💡\s*Dica:\s*/i, "");
  return (
    <View style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <Text style={styles.tipBee}>🐝</Text>
        <Text style={styles.tipLabel}>Dica da Bee</Text>
        <Text style={styles.tipTime}>{new Date(createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text>
      </View>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

function ConnectionRequestCard({ meta, pending, onAccept, onReject, styles }: { meta: ConnectionRequestMeta; pending: boolean; onAccept: () => void; onReject: () => void; styles: ReturnType<typeof makeStyles> }) {
  const { t } = useTranslation();
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle}>{t("chat_connection_request")}</Text>
      <Text style={styles.metaText}>{t("chat_wants_to_connect", { name: meta.fromName || "Alguem" })}</Text>
      <View style={styles.metaActions}>
        <TouchableOpacity style={styles.metaSecondaryButton} onPress={onReject} disabled={pending}><Text style={styles.metaSecondaryText}>{t("chat_reject")}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.metaPrimaryButton} onPress={onAccept} disabled={pending}><Text style={styles.metaPrimaryText}>{pending ? "..." : t("chat_accept")}</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function HolidayAlarmCard({ pending, onCreate, onSkip, styles }: { pending: boolean; onCreate: () => void; onSkip: () => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle}>Despertador em feriado</Text>
      <Text style={styles.metaText}>Escolha se quer manter esse aviso no Relogio.</Text>
      <View style={styles.metaActions}>
        <TouchableOpacity style={styles.metaSecondaryButton} onPress={onSkip} disabled={pending}><Text style={styles.metaSecondaryText}>Nao despertar</Text></TouchableOpacity>
        <TouchableOpacity style={styles.metaPrimaryButton} onPress={onCreate} disabled={pending}><Text style={styles.metaPrimaryText}>{pending ? "..." : "Despertar"}</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function AlarmReactivationCard({ pending, onActivate, onKeepPaused, styles }: { pending: boolean; onActivate: () => void; onKeepPaused: () => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle}>Reativar alarme?</Text>
      <Text style={styles.metaText}>Esse alarme recorrente ficou pausado hoje.</Text>
      <View style={styles.metaActions}>
        <TouchableOpacity style={styles.metaSecondaryButton} onPress={onKeepPaused} disabled={pending}><Text style={styles.metaSecondaryText}>Manter pausado</Text></TouchableOpacity>
        <TouchableOpacity style={styles.metaPrimaryButton} onPress={onActivate} disabled={pending}><Text style={styles.metaPrimaryText}>{pending ? "..." : "Reativar"}</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function NetworkDigestCard({ meta, styles }: { meta: NetworkDigestMeta; styles: ReturnType<typeof makeStyles> }) {
  const { t } = useTranslation();
  const feedPosts = Array.isArray(meta.feedPosts) ? meta.feedPosts.slice(0, 3) : [];
  const newsItems = Array.isArray(meta.newsItems) ? meta.newsItems.slice(0, 2) : [];
  const suggestions = Array.isArray(meta.suggestions) ? meta.suggestions.slice(0, 2) : [];

  return (
    <View style={styles.digestCard}>
      <View style={styles.digestHeader}>
        <Text style={styles.metaTitle}>{t("chat_network_summary")}</Text>
        <TouchableOpacity style={styles.digestOpenButton} onPress={() => router.push("/feed")}>
          <Feather name="arrow-right" size={14} color="#1A1A1A" />
          <Text style={styles.digestOpenButtonText}>Feed</Text>
        </TouchableOpacity>
      </View>

      {feedPosts.length > 0 ? (
        <View style={styles.digestSection}>
          <Text style={styles.digestSectionLabel}>Feed</Text>
          {feedPosts.map((post) => <FeedDigestPostCard key={post.id} post={post} styles={styles} />)}
        </View>
      ) : null}

      {newsItems.length > 0 ? (
        <View style={styles.digestSection}>
          <Text style={styles.digestSectionLabel}>Noticias</Text>
          {newsItems.map((item) => <Text key={item.link} style={styles.metaBullet}>- {item.title}</Text>)}
        </View>
      ) : null}

      {suggestions.length > 0 ? (
        <View style={styles.digestSection}>
          <Text style={styles.digestSectionLabel}>Rede</Text>
          {suggestions.map((suggestion) => <Text key={suggestion.id} style={styles.metaBullet}>- {t("chat_connection_suggestion")} {suggestion.displayName || suggestion.username}</Text>)}
        </View>
      ) : null}
    </View>
  );
}

function FeedDigestPostCard({ post, styles }: { post: ChatFeedSummaryPost; styles: ReturnType<typeof makeStyles> }) {
  const authorName = post.author.displayName || post.author.username;
  return (
    <TouchableOpacity style={styles.feedDigestPost} activeOpacity={0.85} onPress={() => router.push("/feed")}>
      <View style={styles.feedDigestHeader}>
        <UserAvatar name={authorName} avatarUrl={post.author.avatarUrl} size={32} backgroundColor="#FBBF24" color="#1A1A1A" />
        <View style={{ flex: 1 }}>
          <View style={styles.feedDigestAuthorRow}>
            <Text style={styles.feedDigestAuthor} numberOfLines={1}>{authorName}</Text>
          </View>
          <Text style={styles.feedDigestTime}>{timeAgo(post.createdAt)}</Text>
        </View>
        {post.sentimentLabel ? (
          <View style={styles.feedDigestMood}>
            <Text style={styles.feedDigestMoodText}>{post.sentimentLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.feedDigestContent} numberOfLines={4}>{post.content}</Text>
      {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.feedDigestImage} resizeMode="contain" /> : null}

      {post.aiComment ? (
        <View style={styles.feedDigestAi}>
          <Text style={styles.feedDigestAiLabel}>BeeEyes</Text>
          <Text style={styles.feedDigestAiText} numberOfLines={3}>{post.aiComment}</Text>
        </View>
      ) : null}

      <View style={styles.feedDigestActions}>
        <View style={styles.feedDigestAction}>
          <Feather name="heart" size={14} color={post.liked ? "#EF4444" : "#6B7280"} />
          <Text style={styles.feedDigestActionText}>{post.likesCount || ""}</Text>
        </View>
        <View style={styles.feedDigestAction}>
          <Feather name="message-circle" size={14} color="#6B7280" />
          <Text style={styles.feedDigestActionText}>{post.commentsCount || ""}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function NewsDigestCard({ meta, styles }: { meta: NewsDigestMeta; styles: ReturnType<typeof makeStyles> }) {
  const { t } = useTranslation();
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const summarize = useCallback(async (link: string, title: string) => {
    setLoading(link);
    try {
      const { data } = await api.post("/api/news/summarize", { url: link, title });
      setSummaries((previous) => ({ ...previous, [link]: data.summary }));
    } catch {
      setSummaries((previous) => ({ ...previous, [link]: t("chat_summary_error") }));
    } finally {
      setLoading(null);
    }
  }, [t]);

  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle}>{t("chat_news_title", { query: meta.query })}</Text>
      {meta.items.map((item) => (
        <View key={item.link} style={styles.newsItem}>
          <Text style={styles.newsTitle}>{item.title}</Text>
          <Text style={styles.newsSource}>{item.source}</Text>
          {summaries[item.link] ? (
            <View style={styles.newsSummaryBlock}>
              <Text style={styles.newsSummary}>{summaries[item.link]}</Text>
              <TouchableOpacity onPress={() => Linking.openURL(item.link)}><Text style={styles.newsReadMore}>{t("chat_read_more")}</Text></TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.newsResumeBtn} onPress={() => summarize(item.link, item.title)} disabled={loading === item.link}>
              <Text style={styles.newsResumeBtnText}>{loading === item.link ? t("chat_summarizing") : t("chat_summarize")}</Text>
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
    headerActions: { flexDirection: "row", gap: 4 },
    headerIconBtn: { alignItems: "center", justifyContent: "center", gap: 3 },
    headerIconLabel: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "600", color: colors.muted },
    headerBadge: { position: "absolute", top: -7, right: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: colors.destructive },
    headerBadgeText: { fontFamily: FONTS.mono, fontSize: 10, fontWeight: "800", color: "#FFFFFF" },
    mascotBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    mascotBarCenter: { flex: 1, gap: 2 },
    presenceLabelCompact: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
    insightBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.primary },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: "75%" },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 16 },
    modalTitle: { fontFamily: FONTS.display, fontSize: 20, fontWeight: "800", color: colors.foreground, marginBottom: 16 },
    presenceLabel: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
    scoreValue: { fontFamily: FONTS.display, fontSize: 32, fontWeight: "800", color: colors.foreground },
    scoreTone: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700" },
    progressMetaRow: { flexDirection: "row", gap: 8 },
    metricBadge: { flex: 1, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 4 },
    metricLabel: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
    metricValue: { fontFamily: FONTS.mono, fontSize: 14, fontWeight: "700", color: colors.foreground },
    scoreTrack: { height: 10, borderRadius: 999, backgroundColor: colors.card, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
    scoreFill: { height: "100%", borderRadius: 999 },
    secondaryScoreRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    secondaryScoreText: { fontFamily: FONTS.mono, fontSize: 11, fontWeight: "700", color: colors.muted },
    insightText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, color: colors.foreground },
    notificationStack: { marginTop: 10, gap: 8 },
    notificationCard: { borderRadius: 16, padding: 12, borderWidth: 1, gap: 4 },
    notificationWarning: { backgroundColor: colors.background, borderColor: colors.border },
    notificationDanger: { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "55" },
    notificationPositive: { backgroundColor: colors.success + "14", borderColor: colors.success + "44" },
    notificationTitle: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.foreground },
    notificationBody: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 18, color: colors.foreground },
    chatArea: { flex: 1 },
    emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
    emptyText: { fontFamily: FONTS.sans, fontSize: 16, color: colors.muted, textAlign: "center", lineHeight: 26 },
    messageList: { padding: 16 },
    inputRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
    input: { flex: 1, backgroundColor: colors.background, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, fontFamily: FONTS.sans, color: colors.foreground, maxHeight: 120, borderWidth: 1, borderColor: colors.border },
    sendButton: { minWidth: 48, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
    sendButtonDisabled: { opacity: 0.4 },
    micButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
    micButtonRecording: { backgroundColor: colors.destructive },
    recordingRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card, minHeight: 64 },
    recCancelBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    recInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
    recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.destructive },
    recTimer: { fontFamily: FONTS.mono, fontSize: 15, fontWeight: "700", color: colors.foreground, minWidth: 36 },
    recWaveform: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, height: 32 },
    recWaveBar: { width: 3, borderRadius: 2, backgroundColor: colors.destructive },
    recSendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    transcriptionError: { fontFamily: FONTS.sans, fontSize: 12, color: colors.destructive, paddingHorizontal: 16, paddingBottom: 4 },
    tipCard: { marginTop: 6, marginBottom: 8, marginLeft: 6, marginRight: 24, padding: 14, borderRadius: 18, backgroundColor: colors.primary + "18", borderWidth: 1.5, borderColor: colors.primary + "55", gap: 8 },
    tipHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    tipBee: { fontSize: 16 },
    tipLabel: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.primaryDark, flex: 1 },
    tipTime: { fontFamily: FONTS.mono, fontSize: 10, color: colors.muted },
    tipText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 20, color: colors.foreground },
    metaCard: { marginTop: 6, marginBottom: 8, marginLeft: 6, marginRight: 24, padding: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 6 },
    metaTitle: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.foreground },
    metaText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, lineHeight: 18 },
    metaBullet: { fontFamily: FONTS.sans, fontSize: 12, color: colors.foreground, lineHeight: 18 },
    digestCard: { marginTop: 6, marginBottom: 8, marginLeft: 6, marginRight: 18, padding: 12, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 12 },
    digestHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    digestOpenButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.primary },
    digestOpenButtonText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "800", color: "#1A1A1A" },
    digestSection: { gap: 8 },
    digestSectionLabel: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "800", color: colors.muted, textTransform: "uppercase" },
    feedDigestPost: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, overflow: "hidden" },
    feedDigestHeader: { flexDirection: "row", alignItems: "center", gap: 9, padding: 10, paddingBottom: 8 },
    feedDigestAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    feedDigestAvatarText: { fontFamily: FONTS.display, fontSize: 13, fontWeight: "800", color: "#1A1A1A" },
    feedDigestAuthorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    feedDigestAuthor: { flex: 1, fontFamily: FONTS.sans, fontSize: 13, fontWeight: "800", color: colors.foreground },
    feedDigestLevel: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 7, backgroundColor: colors.secondary },
    feedDigestLevelText: { fontFamily: FONTS.mono, fontSize: 9, fontWeight: "800", color: colors.foreground },
    feedDigestTime: { fontFamily: FONTS.sans, fontSize: 10, color: colors.muted, marginTop: 1 },
    feedDigestMood: { maxWidth: 86, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primary + "18", borderWidth: 1, borderColor: colors.primary + "44" },
    feedDigestMoodText: { fontFamily: FONTS.sans, fontSize: 9, fontWeight: "700", color: colors.primaryDark },
    feedDigestContent: { paddingHorizontal: 10, paddingBottom: 9, fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18, color: colors.foreground },
    feedDigestImage: { width: "100%", height: 190, backgroundColor: colors.secondary },
    feedDigestAi: { margin: 10, marginTop: 9, padding: 9, borderRadius: 12, backgroundColor: colors.card, borderLeftWidth: 3, borderLeftColor: colors.primary, gap: 3 },
    feedDigestAiLabel: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "800", color: colors.primaryDark },
    feedDigestAiText: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 17, color: colors.foreground },
    feedDigestActions: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border },
    feedDigestAction: { flexDirection: "row", alignItems: "center", gap: 4 },
    feedDigestActionText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.muted },
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
