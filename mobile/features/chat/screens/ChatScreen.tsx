import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, ActivityIndicator, Dimensions, Image, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
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
import DailyBriefingModal from "@mobile/components/DailyBriefingModal";
import { UserAvatar } from "@mobile/components/UserAvatar";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { type ConnectionRequestMeta, type NewsDigestMeta, isConnectionRequestMeta, isNewsDigestMeta, parseMessageMeta } from "@mobile/lib/social";
import type { IntelligentNotification, NotificationCenterItem, ScoreSnapshot } from "@mobile/lib/intelligence";
import type { EyeExpression } from "@mobile/stores/uiStore";
import { SponsoredChatCard } from "@mobile/components/SponsoredChatCard";
import { ResearchResultCard, ResearchLoadingCard } from "@mobile/components/ResearchResultCard";
import type { ResearchResult } from "@mobile/components/ResearchResultCard";
import { WorkoutSuggestionCard, type WorkoutSuggestionPlan } from "@mobile/components/WorkoutSuggestionCard";
import { useAdEngine } from "@mobile/hooks/useAdEngine";
import { hideAd } from "@mobile/lib/adService";
import type { SponsoredMessageMeta } from "@mobile/lib/ads";

type AppRoute = "/feed" | "/communities" | "/inbox" | "/notifications" | "/friends" | "/profile";
type BriefingLocation = { latitude: number; longitude: number; city: string | null };

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

async function getBriefingLocation(): Promise<BriefingLocation | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }).catch(() => Location.getLastKnownPositionAsync());

    if (!position) return null;

    let city: string | null = null;
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const cityName = place?.city || place?.subregion || place?.district || null;
      city = [cityName, place?.region].filter(Boolean).join(", ") || null;
    } catch {
      city = null;
    }

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      city,
    };
  } catch {
    return null;
  }
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

  const [inputValue, setInputValue] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
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
  const { eyeExpression, themeMode, profileImageUri, setEyeExpression } = useUIStore();
  const { user } = useAuthStore();
  const { sendMessage } = useChat();
  const { onAfterAssistantResponse } = useAdEngine(
    user ? { level: user.level, xp: user.xp } : null,
  );
  const adCheckIdRef = useRef<string | null>(null);
  const [dailyBriefing, setDailyBriefing] = useState<{
    text: string;
    weather: { temp: number; tempMin: number; tempMax: number; description: string; precipitationChance: number } | null;
    city: string | null;
    date: string;
    dayOfWeek: string;
  } | null>(null);
  const [showDailyBriefing, setShowDailyBriefing] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get("window");

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      setIsKeyboardVisible(true);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setIsKeyboardVisible(false);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => () => {
    if (eyeResetTimeoutRef.current) clearTimeout(eyeResetTimeoutRef.current);
    if (attentionResetTimeoutRef.current) clearTimeout(attentionResetTimeoutRef.current);
    if (meteringIntervalRef.current) clearInterval(meteringIntervalRef.current);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchDailyBriefing = async () => {
      try {
        const location = await getBriefingLocation();
        const r = await api.get("/api/daily-briefing", {
          params: location
            ? {
                lat: location.latitude,
                lon: location.longitude,
                city: location.city ?? undefined,
              }
            : undefined,
        });
        if (cancelled) return;
        const data = r.data as { shouldShow: boolean; briefing?: any };
        if (data.shouldShow && data.briefing) {
          setDailyBriefing(data.briefing);
          setShowDailyBriefing(true);
        }
      } catch {}
    };

    fetchDailyBriefing();
    return () => { cancelled = true; };
  }, [user?.id]);

  const dismissDailyBriefing = useCallback(() => {
    setShowDailyBriefing(false);
    setDailyBriefing(null);
    api.post("/api/daily-briefing/dismiss").catch(() => {});
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
  const unreadNotificationCount = Array.isArray(notificationCenter)
    ? notificationCenter.filter((item) => !item.read).length
    : 0;
  const currentUserName = me?.displayName || user?.displayName || me?.username || user?.username || "Usuario";
  const currentUserAvatarUrl = me?.avatarUrl || user?.avatarUrl || profileImageUri || null;

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


  // BeeAds — inject sponsored card after AI responses when eligible
  useEffect(() => {
    if (isTyping) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant" || lastMsg.id === "streaming") return;
    let rawMeta: Record<string, unknown> = {};
    try { rawMeta = JSON.parse(lastMsg.metadata || "{}"); } catch { /* ignore */ }
    if (rawMeta.type === "sponsored" || rawMeta.appTip || rawMeta.proactive) return;
    if (adCheckIdRef.current === lastMsg.id) return;
    adCheckIdRef.current = lastMsg.id;
    onAfterAssistantResponse(chatMessages, lastMsg.id, addMessage);
  }, [chatMessages, isTyping, onAfterAssistantResponse, addMessage]);

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
  const visibleMessages = msgSearchQuery.trim()
    ? allMessages.filter((message) => message.content.toLowerCase().includes(msgSearchQuery.trim().toLowerCase()))
    : allMessages;

  function handleAssistantLike() {
    pulseEyeExpression("happy", "neutral", 1400);
  }

  function handleAssistantDislike() {
    addMessage({
      id: `feedback-${Date.now()}`,
      role: "assistant",
      content: "Anotado. Essa resposta saiu meio pão de ontem, vou caprichar mais na próxima.",
      createdAt: new Date().toISOString(),
      metadata: JSON.stringify({ feedback: "dislike" }),
    });
    pulseEyeExpression("curious", "neutral", 1800);
  }

  async function handleAssistantShare(content: string) {
    try {
      await api.post("/api/posts", { content: `Mensagem da Bee:\n\n${content}`, imageUrl: null });
      addMessage({
        id: `shared-${Date.now()}`,
        role: "assistant",
        content: "Compartilhei isso no Feed. Dei uma ajeitada para ficar com cara de post.",
        createdAt: new Date().toISOString(),
        metadata: JSON.stringify({ sharedToFeed: true }),
      });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    } catch {
      try {
        await Share.share({ message: content });
      } catch {
        Alert.alert("Não consegui compartilhar", "Tente novamente em instantes.");
      }
    }
  }

  function handleSponsoredHide(messageId: string, adId: string) {
    setMessages(chatMessages.filter((m) => m.id !== messageId));
    hideAd(adId).catch(() => {});
  }

  function handleSponsoredNotRelevant(messageId: string, _adId: string) {
    setMessages(chatMessages.filter((m) => m.id !== messageId));
  }

  function handleSponsoredReport(messageId: string, _adId: string) {
    setMessages(chatMessages.filter((m) => m.id !== messageId));
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]} onTouchStart={handleScreenTouch} onTouchMove={handleScreenTouch}>
      <HoneycombBackdrop colors={colors} />
      <AchievementToast />
      {dailyBriefing && (
        <DailyBriefingModal
          visible={showDailyBriefing}
          briefing={dailyBriefing}
          userName={user?.displayName || user?.username || ""}
          onStart={dismissDailyBriefing}
          onDismiss={dismissDailyBriefing}
        />
      )}
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

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brandMark}>
          <Image source={require("../../../assets/beeyes-design/bee-icon.png")} style={styles.brandIcon} />
          <View>
            <Text style={styles.logo}>bee-eyes</Text>
            <View style={styles.brandOnline}>
              <View style={styles.brandOnlineDot} />
              <Text style={styles.brandStatus}>Online</Text>
            </View>
          </View>
        </View>

        {/* BeeEyes absolutely centered in header */}
        <View style={styles.headerEyes} pointerEvents="none">
          <BeeEyes
            expression={eyeExpression}
            size={isKeyboardVisible ? 44 : 58}
            attentionX={eyeAttention.x}
            attentionY={eyeAttention.y}
          />
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push("/notifications")}
            style={styles.headerIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="bell" size={20} color={colors.muted} />
            {unreadNotificationCount > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{Math.min(unreadNotificationCount, 9)}</Text>
              </View>
            ) : null}
            <Text style={styles.headerIconLabel}>Alertas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/friends")}
            style={styles.headerIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="users" size={20} color={colors.muted} />
            <Text style={styles.headerIconLabel}>Amigos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/profile")}
            style={styles.headerIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <UserAvatar
              name={currentUserName}
              avatarUrl={currentUserAvatarUrl}
              size={22}
              backgroundColor={colors.primary}
              color="#1A1A1A"
            />
            <Text style={styles.headerIconLabel}>Perfil</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchToolbar}>
        <TouchableOpacity
          style={styles.searchToggle}
          onPress={() => {
            setShowMsgSearch((value) => !value);
            setMsgSearchQuery("");
          }}
        >
          <Feather name="search" size={14} color={colors.muted} />
          <Text style={styles.searchToggleText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {showMsgSearch ? (
        <View style={styles.searchPanel}>
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput
            autoFocus
            style={styles.searchInput}
            value={msgSearchQuery}
            onChangeText={setMsgSearchQuery}
            placeholder="Buscar nas mensagens..."
            placeholderTextColor={colors.muted}
          />
          {msgSearchQuery ? (
            <TouchableOpacity onPress={() => setMsgSearchQuery("")}>
              <Text style={styles.searchClear}>Limpar</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => { setShowMsgSearch(false); setMsgSearchQuery(""); }}>
            <Feather name="x" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={[styles.chatArea, { paddingTop: 0, paddingBottom: isKeyboardVisible ? 6 : Platform.OS === "ios" ? 86 : 76 }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {allMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t("chat_empty", { name: user?.displayName || user?.username })}</Text>
          </View>
        ) : (
          <FlashList
            ref={listRef}
            data={visibleMessages}
            renderItem={({ item }) => {
              const meta = parseMessageMeta(item.metadata);
              let rawMeta: Record<string, unknown> = {};
              try { rawMeta = JSON.parse(item.metadata || "{}"); } catch { /* ignore */ }
              if (rawMeta.appTip === true) {
                return <AppTipCard content={item.content} createdAt={item.createdAt} styles={styles} />;
              }
              if (rawMeta.type === "sponsored") {
                return (
                  <SponsoredChatCard
                    meta={rawMeta as unknown as SponsoredMessageMeta}
                    onHide={(adId) => handleSponsoredHide(item.id, adId)}
                    onNotRelevant={(adId) => handleSponsoredNotRelevant(item.id, adId)}
                    onReport={(adId) => handleSponsoredReport(item.id, adId)}
                  />
                );
              }
              return (
                <View>
                  <ChatMessage
                    role={item.role}
                    content={item.content}
                    createdAt={item.createdAt}
                    userName={currentUserName}
                    userAvatarUrl={currentUserAvatarUrl}
                    actions={item.role === "assistant" && item.id !== "streaming" ? (
                      <View style={styles.assistantActionRow}>
                        <TouchableOpacity style={styles.assistantActionBtn} onPress={handleAssistantLike}>
                          <Feather name="thumbs-up" size={13} color={colors.muted} />
                          <Text style={styles.assistantActionText}>Curti</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.assistantActionBtn} onPress={handleAssistantDislike}>
                          <Feather name="thumbs-down" size={13} color={colors.muted} />
                          <Text style={styles.assistantActionText}>Não curti</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.assistantActionBtn} onPress={() => handleAssistantShare(item.content)}>
                          <Feather name="share-2" size={13} color={colors.muted} />
                          <Text style={styles.assistantActionText}>Feed</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  />
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
                  {isNewsDigestMeta(meta) ? <NewsDigestCard meta={meta} styles={styles} /> : null}
                  {rawMeta.type === "research" && Array.isArray((rawMeta as any).results) ? (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      {((rawMeta as any).results as ResearchResult[]).map((result) => (
                        <ResearchResultCard
                          key={result.id}
                          result={result}
                          colors={colors}
                          onSaveToWishlist={async (r) => {
                            try {
                              const token = await (await import("expo-secure-store")).getItemAsync("bee_token");
                              await fetch(`${API_URL_RAW}/api/wishlist/items`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                body: JSON.stringify({ title: r.title, description: r.description, originalUrl: r.url, category: r.category, sourceType: "research" }),
                              });
                            } catch { /* ignore */ }
                          }}
                        />
                      ))}
                    </View>
                  ) : null}
                  {rawMeta.type === "workout_suggestion" && (rawMeta as any).plan ? (
                    <WorkoutSuggestionCard plan={(rawMeta as any).plan as WorkoutSuggestionPlan} colors={colors} />
                  ) : null}
                  {rawMeta.type === "welcome" ? (
                    <View style={styles.welcomeActionsContainer}>
                      {[
                        { label: "📅 Organizar meu dia", prompt: "Bee, me ajude a organizar meu dia de hoje." },
                        { label: "📚 Plano de estudos", prompt: "Bee, monte um plano de estudos para mim." },
                        { label: "💪 Rotina de saúde", prompt: "Bee, me ajude a montar uma rotina de saúde simples para minha semana." },
                        { label: "⏰ Criar lembrete", prompt: "Bee, me ajude a criar um lembrete." },
                        { label: "📋 Planejar semana", prompt: "Bee, me ajude a planejar minha semana." },
                      ].map(({ label, prompt }) => (
                        <TouchableOpacity
                          key={label}
                          style={styles.welcomeActionBtn}
                          onPress={() => sendMessage(prompt)}
                          disabled={isTyping}
                        >
                          <Text style={styles.welcomeActionText}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            }}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            ListHeaderComponent={
              <View style={styles.dateChipWrap}>
                <Text style={styles.dateChip}>Hoje, 10:24</Text>
              </View>
            }
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
          <View style={[styles.recordingRow, isKeyboardVisible && styles.composerKeyboard]}>
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
          <View style={[styles.inputRow, isKeyboardVisible && styles.composerKeyboard]}>
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

function HoneycombBackdrop({ colors }: { colors: ReturnType<typeof getThemeColors> }) {
  const rows = Array.from({ length: 9 });
  const cells = Array.from({ length: 5 });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {rows.map((_, row) => (
        <View key={row} style={[stylesBackdrop.row, { top: row * 104, left: row % 2 === 0 ? -34 : -78 }]}>
          {cells.map((__, cell) => (
            <View
              key={cell}
              style={[
                stylesBackdrop.cell,
                {
                  borderColor: colors.primary + "0E",
                  backgroundColor: colors.primary + "08",
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
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

const stylesBackdrop = StyleSheet.create({
  row: {
    position: "absolute",
    flexDirection: "row",
    gap: 0,
  },
  cell: {
    width: 88,
    height: 52,
    borderWidth: 1,
    transform: [{ rotate: "30deg" }],
    marginRight: -8,
  },
});

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card + "EE", shadowColor: "#4B3508", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 10, position: "relative" },
    brandMark: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, zIndex: 1 },
    brandIcon: { width: 36, height: 36, borderRadius: 11, borderWidth: 2, borderColor: colors.primary + "88" },
    logo: { fontFamily: FONTS.display, fontSize: 20, color: colors.foreground, fontWeight: "900", letterSpacing: -0.2 },
    brandOnline: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
    brandOnlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
    brandStatus: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "800", color: colors.primary, textTransform: "uppercase" },
    headerEyes: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 0 },
    headerActions: { flexDirection: "row", gap: 4, zIndex: 1 },
    headerIconBtn: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary + "55", borderWidth: 0 },
    headerIconLabel: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "600", color: colors.muted },
    headerBadge: { position: "absolute", top: -7, right: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: colors.destructive },
    headerBadgeText: { fontFamily: FONTS.mono, fontSize: 10, fontWeight: "800", color: "#FFFFFF" },
    mascotBar: { height: 0, overflow: "hidden" },
    mascotBarKeyboard: {},
    mascotBarCenter: {},
    presenceLabelCompact: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
    insightBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.primary },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: "75%", borderWidth: 1, borderColor: colors.border },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 16 },
    modalTitle: { fontFamily: FONTS.display, fontSize: 20, fontWeight: "800", color: colors.foreground, marginBottom: 16 },
    presenceLabel: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
    scoreValue: { fontFamily: FONTS.display, fontSize: 32, fontWeight: "800", color: colors.foreground },
    scoreTone: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700" },
    progressMetaRow: { flexDirection: "row", gap: 8 },
    metricBadge: { flex: 1, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, gap: 4 },
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
    dateChipWrap: { alignItems: "center", marginBottom: 18 },
    dateChip: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.muted, backgroundColor: colors.card + "CC", borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, overflow: "hidden" },
    searchToolbar: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 2, backgroundColor: colors.background + "00" },
    searchToggle: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.card + "AA", borderWidth: 1, borderColor: colors.border },
    searchToggleText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.muted },
    searchPanel: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 18, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.card + "F0", borderWidth: 1, borderColor: colors.border },
    searchInput: { flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: colors.foreground, paddingVertical: 2 },
    searchClear: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.primaryDark },
    messageList: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: 24, paddingTop: 4, paddingBottom: 10 },
    assistantActionRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    assistantActionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.card + "DD", borderWidth: 1, borderColor: colors.border },
    assistantActionText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.muted },
    welcomeActionsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4 },
    welcomeActionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.primary + "1A", borderWidth: 1, borderColor: colors.primary + "66" },
    welcomeActionText: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "600", color: colors.primaryDark },
    inputRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 14, marginBottom: 8, paddingHorizontal: 6, paddingVertical: 5, gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.card + "F2", shadowColor: "#4B3508", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 22, elevation: 12 },
    composerKeyboard: { marginBottom: 4 },
    input: { flex: 1, backgroundColor: "transparent", paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: FONTS.sans, color: colors.foreground, maxHeight: 110 },
    sendButton: { minWidth: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.24, shadowRadius: 14, elevation: 6 },
    sendButtonDisabled: { opacity: 0.4 },
    micButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
    micButtonRecording: { backgroundColor: colors.destructive },
    recordingRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 24, backgroundColor: colors.card, minHeight: 64 },
    recCancelBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    recInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
    recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.destructive },
    recTimer: { fontFamily: FONTS.mono, fontSize: 15, fontWeight: "700", color: colors.foreground, minWidth: 36 },
    recWaveform: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, height: 32 },
    recWaveBar: { width: 3, borderRadius: 2, backgroundColor: colors.destructive },
    recSendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    transcriptionError: { fontFamily: FONTS.sans, fontSize: 12, color: colors.destructive, paddingHorizontal: 16, paddingBottom: 4 },
    tipCard: { marginTop: 6, marginBottom: 8, marginLeft: 6, marginRight: 24, padding: 14, borderRadius: 16, backgroundColor: colors.primary + "18", borderWidth: 1.5, borderColor: colors.primary + "55", gap: 8 },
    tipHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    tipBee: { fontSize: 16 },
    tipLabel: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.primaryDark, flex: 1 },
    tipTime: { fontFamily: FONTS.mono, fontSize: 10, color: colors.muted },
    tipText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 20, color: colors.foreground },
    metaCard: { marginTop: 6, marginBottom: 8, marginLeft: 6, marginRight: 24, padding: 12, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 6, shadowColor: "#4B3508", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    metaTitle: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.foreground },
    metaText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, lineHeight: 18 },
    metaBullet: { fontFamily: FONTS.sans, fontSize: 12, color: colors.foreground, lineHeight: 18 },
    metaActions: { flexDirection: "row", gap: 10, marginTop: 4 },
    metaSecondaryButton: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.secondary, alignItems: "center", borderWidth: 1, borderColor: colors.border },
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
