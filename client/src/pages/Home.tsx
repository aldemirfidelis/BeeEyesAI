import { useState, useRef, useEffect, useCallback, type ChangeEvent } from "react";
import DailyBriefingModal from "@/components/DailyBriefingModal";
import MoodSelector from "@/components/MoodSelector";
import AchievementPopup from "@/components/AchievementPopup";
import ThemeToggle from "@/components/ThemeToggle";
import type { BeeEyesEvent, BeeEyesExpression } from "@/components/BeeEyes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Send, Plus, MessageCircle, Globe, UserPlus, Heart, Users, X, ChevronRight, Settings, Camera, Moon, Sun, MessageSquare, Users2, LayoutGrid, RefreshCw, Search, Hexagon } from "lucide-react";
import { MessageFeedback, type FeedbackType, DISLIKE_REASONS } from "@/features/home/chat/MessageFeedback";
import { SendToFeedModal } from "@/features/home/chat/SendToFeedModal";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, getApiErrorMessage } from "@/features/home/shared/api";
import { AuthScreen } from "@/features/home/auth/AuthScreen";
import { OnboardingScreen } from "@/features/home/auth/OnboardingScreen";
import { FeedPanel } from "@/features/home/feed/FeedPanel";
import { ColmeiaPanel } from "@/features/home/colmeia/ColmeiaPanel";
import { FriendsPanel } from "@/features/home/friends/FriendsPanel";
import { InboxPanel } from "@/features/home/chat/InboxPanel";
import { CommunitiesPanel } from "@/features/home/communities/CommunitiesPanel";
import { SettingsScreen } from "@/features/home/settings/SettingsScreen";
import { FriendProfileModal } from "@/features/home/friends/FriendProfileModal";
import { ChatWorkspace } from "@/features/home/chat/ChatWorkspace";
import { applyTheme, onThemeChange, readTheme, resolveInitialTheme, ThemeMode } from "@/lib/theme";
import { fileToCompressedDataUrl, fileToDataUrl, FEED_IMAGE_ACCEPT, isAcceptedFeedImage } from "@/lib/image";
import NewsCard from "@/components/NewsCard";
import CommunityPostCard from "@/components/CommunityPostCard";
import { AdMobSmartAdCard } from "@/components/AdMobSmartAdCard";
import { ResearchResultCard, ResearchLoadingState, ResearchSourceBadge } from "@/components/ResearchResultCard";
import { WorkoutSuggestionCard, type WorkoutSuggestionPlan } from "@/components/WorkoutSuggestionCard";
import { CasaDaBeeFab } from "@/components/CasaDaBeeFab";
import type { Message, User, FeedPost, ConnectionSuggestion, Friend, SearchUser, FriendProfile, Community, CommunityPost, DMConversation, DMMessage, NewsItem, ResearchResult, ResearchMeta } from "@/features/home/types";
import {
  generateBeeAdIntroMessage,
  getEligibleAds,
  hideAd,
  incrementMessageCount,
  loadAdPreferences,
  recordAdView,
} from "@/lib/adService";
import type { SponsoredMessageMeta } from "@/lib/ads";

const SENTIMENT_EMOJI: Record<string, string> = {
  happy: "😊", motivated: "💪", tired: "😴", sad: "💙",
  neutral: "😐", excited: "🎉", proud: "🏆",
};

// Auth via cookie httpOnly (setado pelo backend no login/register/social).
// localStorage não é mais usado para o token — mitiga roubo via XSS.
// O state `tokenState` (useState abaixo) é apenas um booleano disfarçado
// de string: qualquer valor truthy = "logado". Migrações antigas ainda
// limpam o localStorage para garantir que tokens vazios não fiquem residuais.
const LEGACY_TOKEN_KEY = "bee_token";
try { localStorage.removeItem(LEGACY_TOKEN_KEY); } catch { /* SSR/safari */ }

const AUTH_SENTINEL = "cookie-auth";
const setTokenLegacy = (_t: string) => { /* no-op — cookie cuida */ };
const clearTokenLegacy = () => {
  fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
};
const getProfilePhoto = () => localStorage.getItem("bee_profile_photo");
const setProfilePhoto = (url: string) => localStorage.setItem("bee_profile_photo", url);
const clearProfilePhoto = () => localStorage.removeItem("bee_profile_photo");

function authHeaders(): Record<string, string> {
  // Cookie httpOnly bee_token é enviado automaticamente em chamadas same-origin.
  // Mantemos a função para compatibilidade — apenas retorna objeto vazio.
  return {};
}

function cleanAIText(text: string): string {
  return text
    .replace(/\{"(?:achievement|fetch_news|create_event|log_finance|save_note)"\s*:\s*\{[\s\S]*?\}\s*\}/g, "")
    .replace(/\{"(?:achievement|fetch_news|create_event|log_finance|save_note)"[\s\S]*$/g, "")
    .trim();
}

function timeAgo(dateInput: string | Date): string {
  const diff = Date.now() - new Date(dateInput).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function Home() {
  // Inicia null; o useEffect logo abaixo tenta /api/me para detectar sessão via cookie httpOnly.
  const [token, setTokenState] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Hidrata sessão a partir do cookie httpOnly no mount.
  useEffect(() => {
    let cancelled = false;
    apiFetch<User>("/api/me")
      .then((u) => {
        if (cancelled) return;
        setTokenState(AUTH_SENTINEL);
        setUser(u);
      })
      .catch(() => { /* não logado */ })
      .finally(() => { if (!cancelled) setAuthChecked(true); });
    return () => { cancelled = true; };
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedReplyMessage, setSelectedReplyMessage] = useState<Message | null>(null);
  const [eyeExpression, setEyeExpression] = useState<BeeEyesExpression>("neutral");
  const [eyeEvent, setEyeEvent] = useState<BeeEyesEvent | null>(null);
  const [eyeInputFocused, setEyeInputFocused] = useState(false);
  const [eyeIsTyping, setEyeIsTyping] = useState(false);
  const [eyeScrollProgress, setEyeScrollProgress] = useState(0.5);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [showAchievement, setShowAchievement] = useState(false);
  const [achievementData, setAchievementData] = useState({ title: "", description: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchIntent, setResearchIntent] = useState<string | null>(null);
  const pendingResearchRef = useRef<{ intent: string; results: ResearchResult[] } | null>(null);
  const pendingWorkoutRef = useRef<any>(null);
  const [mobileTab, setMobileTab] = useState<"chat" | "feed" | "colmeia" | "friends" | "inbox" | "communities">("chat");
  const [showSettingsScreen, setShowSettingsScreen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");

  // Feed state
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const feedLoadedAtRef = useRef<number>(0);
  const FEED_PAGE_LIMIT = 20;
  const FEED_STALE_MS = 60_000;
  const [feedMode, setFeedMode] = useState<"for-you" | "friends">("for-you");
  const [postText, setPostText] = useState("");
  const [postImagePreviewUrl, setPostImagePreviewUrl] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [pickingPostImage, setPickingPostImage] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [showPostInput, setShowPostInput] = useState(false);
  const [colmeiaRefreshKey, setColmeiaRefreshKey] = useState(0);
  const [suggestions, setSuggestions] = useState<ConnectionSuggestion[]>([]);
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set());

  // Friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [friendProfileLoading, setFriendProfileLoading] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<{ connectionId: string; user: { id: string; username: string; displayName: string | null; level: number; avatarUrl?: string | null } }[]>([]);
  const [sentRequests, setSentRequests] = useState<{ connectionId: string; user: { id: string; username: string; displayName: string | null; level: number; avatarUrl?: string | null } }[]>([]);
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(new Set());

  // Communities state
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communitySearch, setCommunitySearch] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState<(Community & { isMember: boolean; memberRole?: string }) | null>(null);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityPostsLoading, setCommunityPostsLoading] = useState(false);
  const [communityPostInput, setCommunityPostInput] = useState("");
  const [communityPostImageUrl, setCommunityPostImageUrl] = useState("");
  const [pickingCommunityPostImage, setPickingCommunityPostImage] = useState(false);
  const [communityPostSending, setCommunityPostSending] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [newCommunity, setNewCommunity] = useState({ name: "", description: "", category: "geral", emoji: "🐝", imageUrl: "", isPrivate: false });
  const [pendingRequests, setPendingRequests] = useState<{ id: string; username: string; displayName: string | null; requestedAt: string }[]>([]);
  const [creatingCommunity, setCreatingCommunity] = useState(false);
  const [communityJoining, setCommunityJoining] = useState<string | null>(null);
  const [friendSearch, setFriendSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchConnecting, setSearchConnecting] = useState<Set<string>>(new Set());

  // Direct messages state
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([]);
  const [dmLoading, setDmLoading] = useState(false);
  const [selectedDMUser, setSelectedDMUser] = useState<{ id: string; username: string; displayName: string | null; level: number; avatarUrl?: string | null } | null>(null);
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const [processingConnectionRequestId, setProcessingConnectionRequestId] = useState<string | null>(null);

  // Chat search state
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");

  // Auth form state
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authGender, setAuthGender] = useState("");
  const [authError, setAuthError] = useState("");
  const [authShowPassword, setAuthShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Daily briefing state
  const [dailyBriefing, setDailyBriefing] = useState<{
    text: string;
    weather: { temp: number; tempMin: number; tempMax: number; description: string; precipitationChance: number } | null;
    city: string | null;
    date: string;
    dayOfWeek: string;
  } | null>(null);
  const [showDailyBriefing, setShowDailyBriefing] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const dmEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const feedImageInputRef = useRef<HTMLInputElement>(null);
  const feedCameraInputRef = useRef<HTMLInputElement>(null);
  const communityPostImageInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const eyeEventTimeoutRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const adCheckIdRef = useRef<string | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Ad injection — runs after each completed assistant response
  useEffect(() => {
    if (isLoading) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return;

    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(lastMsg.metadata ?? "{}"); } catch { /* skip */ }
    if (meta.type === "sponsored" || meta.type === "news" || meta.type === "news_digest") return;

    if (adCheckIdRef.current === lastMsg.id) return;
    adCheckIdRef.current = lastMsg.id;

    if (!user) { incrementMessageCount(); return; }

    const userForAds = { level: user.level, xp: user.xp };
    const recentMsgs = messages.slice(-4).map((m) => ({ role: m.role, content: m.content }));
    const contextTopics = messages.slice(-4).flatMap((m) => m.content.toLowerCase().split(/\s+/).slice(0, 10));

    const ads = getEligibleAds(userForAds, contextTopics, recentMsgs, 3);
    if (ads.length === 0) { incrementMessageCount(); return; }

    const introMsg = generateBeeAdIntroMessage();
    const prefs = loadAdPreferences();
    void (async () => {
      try {
        const res = await fetch("/api/ad-impressions/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            anchorMessageId: lastMsg.id,
            adId: ads[0].id,
            beeIntroMessage: introMsg,
            isPersonalized: prefs.allowPersonalizedAds,
            ad: ads[0],
            ads,
            groupTitle: ads.length > 1 ? "Anúncios que podem te interessar" : undefined,
            layoutType: ads.length > 1 ? "carousel" : undefined,
            source: "web_chat",
          }),
        });
        if (!res.ok) return;

        const data = await res.json();
        const persisted = data?.message;
        if (!persisted?.id) return;

        for (const ad of ads) recordAdView(ad.id);
        const msg: Message = {
          id: persisted.id,
          role: "assistant",
          content: persisted.content,
          timestamp: new Date(persisted.createdAt),
          metadata: persisted.metadata,
        };
        setMessages((prev) => prev.some((item) => item.id === msg.id) ? prev : [...prev, msg]);
        isNearBottomRef.current = true;
        setEyeExpression("attentive");
        pulseEyeEvent("message-received", 1500);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } catch {
        // Nunca exibe anúncio que não foi persistido.
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading, user]);

  const clearPostImage = useCallback(() => {
    setPostImagePreviewUrl("");
    setPostImageUrl("");
  }, []);

  const pulseEyeEvent = useCallback((event: BeeEyesEvent, duration = 1400) => {
    setEyeEvent(event);
    if (eyeEventTimeoutRef.current) window.clearTimeout(eyeEventTimeoutRef.current);
    eyeEventTimeoutRef.current = window.setTimeout(() => {
      setEyeEvent((current) => (current === event ? null : current));
      eyeEventTimeoutRef.current = null;
    }, duration);
  }, []);

  const handleEyeInputChange = useCallback((value: string) => {
    setInputValue(value);
    const hasText = value.trim().length > 0;
    setEyeIsTyping(hasText);

    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    if (hasText) {
      pulseEyeEvent("user-typing", 900);
      typingTimeoutRef.current = window.setTimeout(() => {
        setEyeIsTyping(false);
        typingTimeoutRef.current = null;
      }, 850);
    } else {
      typingTimeoutRef.current = null;
    }
  }, [pulseEyeEvent]);

  const handleEyeInputFocusChange = useCallback((focused: boolean) => {
    setEyeInputFocused(focused);
    if (focused) pulseEyeEvent("input-focus", 1200);
  }, [pulseEyeEvent]);

  useEffect(() => () => {
    if (eyeEventTimeoutRef.current) window.clearTimeout(eyeEventTimeoutRef.current);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingText]);

  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmMessages]);

  useEffect(() => {
    const initialTheme = resolveInitialTheme();
    applyTheme(initialTheme);
    setThemeMode(initialTheme);
    const savedPhoto = getProfilePhoto() || "";
    setProfilePhotoUrl(savedPhoto);

    return onThemeChange((nextTheme) => {
      setThemeMode(nextTheme);
    });
  }, []);

  // Load user data when token is set
  useEffect(() => {
    if (!token) return;
    apiFetch<User>("/api/me", { headers: authHeaders() })
      .then((u) => {
        setUser(u);
        if ((u as any).avatarUrl) {
          setProfilePhotoUrl((u as any).avatarUrl);
          setProfilePhoto((u as any).avatarUrl);
        } else {
          const local = getProfilePhoto();
          if (local) setProfilePhotoUrl(local);
        }
      })
      .catch(() => { clearTokenLegacy(); setTokenState(null); });

    apiFetch<any[]>("/api/messages?limit=50", { headers: authHeaders() })
      .then((msgs: any[]) => {
        const normalized = msgs.map((m) => ({
          ...m,
          metadata: m.metadata ?? null,
          timestamp: new Date(m.createdAt),
        }));
        messagesRef.current = normalized;
        setMessages(normalized);
      });

  }, [token]);

  // Check daily briefing once user is loaded
  useEffect(() => {
    if (!token || !user) return;

    function fetchBriefing(lat?: number, lon?: number) {
      const url = lat !== undefined && lon !== undefined
        ? `/api/daily-briefing?lat=${lat}&lon=${lon}`
        : "/api/daily-briefing";
      apiFetch<{ shouldShow: boolean; briefing?: any }>(url, { headers: authHeaders() })
        .then((res) => {
          if (res.shouldShow && res.briefing) {
            setDailyBriefing(res.briefing);
            setShowDailyBriefing(true);
          }
        })
        .catch(() => { /* briefing is non-critical */ });
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchBriefing(pos.coords.latitude, pos.coords.longitude),
        () => fetchBriefing(),
        { timeout: 4000 }
      );
    } else {
      fetchBriefing();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  const dismissDailyBriefing = useCallback(() => {
    setShowDailyBriefing(false);
    setDailyBriefing(null);
    apiFetch("/api/daily-briefing/dismiss", {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
  }, []);

  // Load friends list
  const loadFriends = useCallback(async () => {
    if (!token) return;
    setFriendsLoading(true);
    try {
      const [friendsList, incoming, sent] = await Promise.all([
        apiFetch<Friend[]>("/api/friends", { headers: authHeaders() }),
        apiFetch<{ connectionId: string; user: { id: string; username: string; displayName: string | null; level: number } }[]>("/api/connections/incoming", { headers: authHeaders() }).catch(() => []),
        apiFetch<{ connectionId: string; user: { id: string; username: string; displayName: string | null; level: number } }[]>("/api/connections/sent", { headers: authHeaders() }).catch(() => []),
      ]);
      setFriends(friendsList);
      setIncomingRequests(incoming);
      setSentRequests(sent);
    } catch { /* ignore */ }
    finally { setFriendsLoading(false); }
  }, [token]);

  const loadDMConversations = useCallback(async () => {
    if (!token) return;
    setDmLoading(true);
    try {
      setDmConversations(await apiFetch<DMConversation[]>("/api/dm/conversations", { headers: authHeaders() }));
    } catch {
      // ignore
    } finally {
      setDmLoading(false);
    }
  }, [token]);

  const openDMThread = useCallback(async (target: { id: string; username: string; displayName: string | null; level: number }) => {
    setSelectedDMUser(target);
    try {
      setDmMessages(await apiFetch<DMMessage[]>(`/api/dm/${target.id}`, { headers: authHeaders() }));
    } catch {
      setDmMessages([]);
    }
    loadDMConversations();
  }, [loadDMConversations]);

  const sendDMMessage = useCallback(async () => {
    if (!selectedDMUser || !dmInput.trim() || dmSending) return;
    setDmSending(true);
    const content = dmInput.trim();
    setDmInput("");
    try {
      const created = await apiFetch<DMMessage>(`/api/dm/${selectedDMUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content }),
      });
      setDmMessages((prev) => [...prev, created]);
      loadDMConversations();
    } catch {
      setDmInput(content);
    } finally {
      setDmSending(false);
    }
  }, [selectedDMUser, dmInput, dmSending, loadDMConversations]);

  const isFriendUser = useCallback((targetUserId: string) => {
    return friends.some((f) => f.id === targetUserId);
  }, [friends]);

  const openDMWithUser = useCallback((target: { id: string; username: string; displayName: string | null; level: number; avatarUrl?: string | null }) => {
    setShowSettingsScreen(false);
    setMobileTab("inbox");
    setSelectedFriend(null);
    openDMThread(target);
  }, [openDMThread]);

  const openFriendProfile = async (friendId: string) => {
    setFriendProfileLoading(true);
    setSelectedFriend(null);
    try {
      const res = await fetch(`/api/users/${friendId}/profile`, { headers: authHeaders() });
      if (res.ok) {
        setSelectedFriend(await res.json());
        fetch(`/api/users/${friendId}/visit`, { method: "POST", headers: authHeaders() }).catch(() => {});
      } else {
        // mantém modal aberto com estado vazio para não fechar abruptamente
        setSelectedFriend({ user: { id: friendId, username: "—", displayName: null, level: 1, xp: 0, currentStreak: 0, lastActiveAt: null }, recentPosts: [], interests: [] });
      }
    } catch {
      setSelectedFriend({ user: { id: friendId, username: "—", displayName: null, level: 1, xp: 0, currentStreak: 0, lastActiveAt: null }, recentPosts: [], interests: [] });
    } finally {
      setFriendProfileLoading(false);
    }
  };

  const handleAnonymousProfileVisitsToggle = useCallback(async (nextValue: boolean) => {
    if (!token || !user) return;
    try {
      const updatedUser = await apiFetch<User>("/api/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ anonymousProfileVisitsEnabled: nextValue }),
      });
      setUser(updatedUser);
      setSettingsMessage(nextValue ? "Navegação anônima ativada." : "Navegação anônima desativada.");
    } catch (error) {
      setSettingsMessage(getApiErrorMessage(error, "Não foi possível atualizar sua preferência agora."));
    }
  }, [token, user]);

  const handleStrangerMessagesToggle = useCallback(async (nextValue: boolean) => {
    if (!token || !user) return;
    try {
      const updatedUser = await apiFetch<User>("/api/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ allowMessagesFromStrangers: nextValue }),
      });
      setUser(updatedUser);
      setSettingsMessage(
        nextValue
          ? "Você passa a receber DMs de qualquer pessoa."
          : "Apenas amigos conectados podem te enviar DMs agora.",
      );
    } catch (error) {
      setSettingsMessage(getApiErrorMessage(error, "Não foi possível atualizar sua preferência agora."));
    }
  }, [token, user]);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSearchResults = useCallback(async (query?: string) => {
    const searchQuery = (query ?? friendSearch).trim();
    if (!token || !searchQuery) {
      if (!searchQuery) setSearchResults([]);
      return;
    }
    try {
      setSearchResults(await apiFetch<SearchUser[]>(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, { headers: authHeaders() }));
    } catch { /* ignore */ }
  }, [friendSearch, token]);

  const handleFriendSearch = (q: string) => {
    setFriendSearch(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        await refreshSearchResults(q);
      } catch { /* ignore */ }
      finally { setSearchLoading(false); }
    }, 350);
  };

  const handleSearchConnect = async (targetUserId: string) => {
    if (searchConnecting.has(targetUserId)) return;
    setSearchConnecting((prev) => new Set(prev).add(targetUserId));
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ targetUserId }),
      });
      if (res.ok || res.status === 409) {
        setSearchResults((prev) =>
          prev.map((u) => u.id === targetUserId ? { ...u, connectionStatus: "pending" as const } : u)
        );
        // Re-fetch search to get accurate server-side status
        if (friendSearch.trim()) {
          setTimeout(async () => {
            await refreshSearchResults(friendSearch);
          }, 1500);
        }
      }
    } catch { /* ignore */ }
    finally { setSearchConnecting((prev) => { const s = new Set(prev); s.delete(targetUserId); return s; }); }
  };

  const handleAcceptRequest = async (connectionId: string) => {
    setProcessingRequestIds((prev) => new Set(prev).add(connectionId));
    try {
      await fetch(`/api/connections/${connectionId}/accept`, { method: "PUT", headers: authHeaders() });
      setIncomingRequests((prev) => prev.filter((r) => r.connectionId !== connectionId));
      loadFriends();
    } catch { /* ignore */ }
    finally { setProcessingRequestIds((prev) => { const s = new Set(prev); s.delete(connectionId); return s; }); }
  };

  const handleRejectFriendRequest = async (connectionId: string) => {
    setProcessingRequestIds((prev) => new Set(prev).add(connectionId));
    try {
      await fetch(`/api/connections/${connectionId}/reject`, { method: "PUT", headers: authHeaders() });
      setIncomingRequests((prev) => prev.filter((r) => r.connectionId !== connectionId));
    } catch { /* ignore */ }
    finally { setProcessingRequestIds((prev) => { const s = new Set(prev); s.delete(connectionId); return s; }); }
  };

  const [removingFriendIds, setRemovingFriendIds] = useState<Set<string>>(new Set());

  const handleRemoveFriend = async (friendId: string) => {
    if (!window.confirm("Remover este amigo?")) return;
    setRemovingFriendIds((prev) => new Set(prev).add(friendId));
    try {
      await fetch(`/api/connections/with/${friendId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch { /* ignore */ }
    finally { setRemovingFriendIds((prev) => { const s = new Set(prev); s.delete(friendId); return s; }); }
  };

  const handleCancelRequest = async (targetUserId: string) => {
    if (searchConnecting.has(targetUserId)) return;
    setSearchConnecting((prev) => new Set(prev).add(targetUserId));
    try {
      await fetch(`/api/connections/to/${targetUserId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      setSearchResults((prev) =>
        prev.map((u) => u.id === targetUserId ? { ...u, connectionStatus: "none" as const } : u)
      );
      setSentRequests((prev) => prev.filter((r) => r.user.id !== targetUserId));
    } catch { /* ignore */ }
    finally { setSearchConnecting((prev) => { const s = new Set(prev); s.delete(targetUserId); return s; }); }
  };

  const getConnectionRequestMeta = (metadata?: string | null) => {
    if (!metadata) return null;
    try {
      const parsed = JSON.parse(metadata);
      if (parsed?.type === "connection_request" && parsed?.connectionId) return parsed as {
        type: "connection_request";
        connectionId: string;
        fromUserId?: string;
        fromName?: string;
      };
      return null;
    } catch {
      return null;
    }
  };

  const getMessageMeta = (metadata?: string | null) => {
    if (!metadata) return null;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  };

  const handleConnectionDecision = async (messageId: string, connectionId: string, decision: "accept" | "reject") => {
    if (processingConnectionRequestId) return;
    setProcessingConnectionRequestId(connectionId);
    try {
      const endpoint = decision === "accept" ? "accept" : "reject";
      const res = await fetch(`/api/connections/${connectionId}/${endpoint}`, {
        method: "PUT",
        headers: authHeaders(),
      });
      if (!res.ok) return;

      const resolvedContent =
        decision === "accept"
          ? "Solicitação aceita! Agora vocês podem conversar em Mensagens."
          : "Solicitação recusada.";
      const resolvedMetadata = JSON.stringify({ type: "connection_request_resolved", decision });

      await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: resolvedContent, metadata: resolvedMetadata }),
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, metadata: resolvedMetadata, content: resolvedContent }
            : m,
        ),
      );

      if (decision === "accept") {
        loadFriends();
        refreshSearchResults();
        // Re-fetch messages so the "X aceitou sua solicitação" message appears for the requester
        setTimeout(() => {
          fetch("/api/messages?limit=50", { headers: authHeaders() })
            .then((r) => r.ok ? r.json() : [])
            .then((serverMsgs: any[]) => {
              setMessages((prev) => {
                const existingIds = new Set(prev.map((m) => m.id));
                const newOnes = serverMsgs
                  .filter((m) => !existingIds.has(m.id))
                  .map((m) => ({ ...m, metadata: m.metadata ?? null, timestamp: new Date(m.createdAt) }));
                if (newOnes.length === 0) return prev;
                return [...prev, ...newOnes].sort(
                  (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
              });
            })
            .catch(() => {});
        }, 1000);
      }
    } finally {
      setProcessingConnectionRequestId(null);
    }
  };

  const handleHolidayAlarmDecision = async (messageId: string, meta: any, decision: "create" | "skip") => {
    const alarmDraft = meta?.alarmDraft;
    const holidayName = meta?.holiday?.name ?? "feriado";
    if (!alarmDraft) return;

    try {
      if (decision === "create") {
        const res = await fetch("/api/colmeia/alarms", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(alarmDraft),
        });
        if (!res.ok) return;
        setColmeiaRefreshKey((value) => value + 1);
      }

      const resolvedContent = decision === "create"
        ? `Combinado. Criei o despertador mesmo sendo ${holidayName}.`
        : `Tudo bem. Não criei esse despertador para ${holidayName}.`;
      const resolvedMetadata = JSON.stringify({ type: "holiday_alarm_resolved", decision });

      await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: resolvedContent, metadata: resolvedMetadata }),
      });

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? { ...message, content: resolvedContent, metadata: resolvedMetadata }
            : message,
        ),
      );
    } catch {
      // ignore
    }
  };

  const handleAlarmReactivationDecision = async (messageId: string, meta: any, decision: "activate" | "keep_paused") => {
    const alarmId = meta?.alarmId;
    const title = meta?.title ?? "alarme";
    if (!alarmId) return;

    try {
      if (decision === "activate") {
        const res = await fetch(`/api/colmeia/alarms/${alarmId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ active: true }),
        });
        if (!res.ok) return;
        setColmeiaRefreshKey((value) => value + 1);
      }

      const resolvedContent = decision === "activate"
        ? `Combinado. Reativei o alarme "${title}".`
        : `Tudo bem. Mantive o alarme "${title}" pausado.`;
      const resolvedMetadata = JSON.stringify({ type: "reactivate_alarm_resolved", decision, alarmId });

      await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: resolvedContent, metadata: resolvedMetadata }),
      });

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? { ...message, content: resolvedContent, metadata: resolvedMetadata }
            : message,
        ),
      );
    } catch {
      // ignore
    }
  };

  // Load feed when user switches to feed tab. Cache de 60s entre visitas para evitar
  // refetch a cada toque na tab; force=true ignora o cache (pull-to-refresh, novo post).
  const loadFeed = useCallback(async (force = false) => {
    if (!token) return;
    if (!force && feed.length > 0 && Date.now() - feedLoadedAtRef.current < FEED_STALE_MS) {
      return;
    }
    setFeedLoading(true);
    setFeedError(null);
    try {
      const [feedRes, suggestionsRes] = await Promise.all([
        fetch(`/api/feed?mode=${feedMode}&limit=${FEED_PAGE_LIMIT}`, { headers: authHeaders() }),
        fetch("/api/connections/suggestions?limit=3", { headers: authHeaders() }),
      ]);
      if (feedRes.ok) {
        const items = (await feedRes.json()) as FeedPost[];
        setFeed(items);
        const nextCursor = feedRes.headers.get("x-feed-next-cursor");
        setFeedCursor(nextCursor);
        setFeedHasMore(!!nextCursor);
        feedLoadedAtRef.current = Date.now();
      } else {
        setFeedError("Não foi possível carregar o feed.");
      }
      if (suggestionsRes.ok) setSuggestions(await suggestionsRes.json());
    } catch {
      setFeedError("Sem conexão. Verifique a rede e tente de novo.");
    }
    finally { setFeedLoading(false); }
  }, [token, feedMode, feed.length]);

  // Trocar entre "Amigos" e "Para Você" invalida o cache atual.
  useEffect(() => {
    feedLoadedAtRef.current = 0;
    setFeed([]);
    setFeedCursor(null);
    setFeedHasMore(false);
  }, [feedMode]);

  const loadMoreFeed = useCallback(async () => {
    if (!token || feedLoadingMore || !feedHasMore || !feedCursor) return;
    setFeedLoadingMore(true);
    try {
      const res = await fetch(`/api/feed?mode=${feedMode}&limit=${FEED_PAGE_LIMIT}&cursor=${encodeURIComponent(feedCursor)}`, { headers: authHeaders() });
      if (res.ok) {
        const items = (await res.json()) as FeedPost[];
        setFeed((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...items.filter((it) => !seen.has(it.id))];
        });
        const nextCursor = res.headers.get("x-feed-next-cursor");
        setFeedCursor(nextCursor);
        setFeedHasMore(!!nextCursor);
      }
    } catch { /* ignore */ }
    finally { setFeedLoadingMore(false); }
  }, [token, feedMode, feedCursor, feedHasMore, feedLoadingMore]);

  const loadCommunities = useCallback(async (search = "") => {
    if (!token) return;
    setCommunitiesLoading(true);
    try {
      const res = await fetch(`/api/communities?search=${encodeURIComponent(search)}`, { headers: authHeaders() });
      if (res.ok) setCommunities(await res.json());
    } finally {
      setCommunitiesLoading(false);
    }
  }, [token]);

  const openCommunity = async (id: string) => {
    setCommunityPostsLoading(true);
    setSelectedCommunity(null);
    setCommunityPosts([]);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/communities/${id}`, { headers: authHeaders() }),
        fetch(`/api/communities/${id}/posts`, { headers: authHeaders() }),
      ]);
      if (cRes.ok) {
        const community = await cRes.json();
        setSelectedCommunity(community);
        if (community.isPrivate && community.memberRole === "owner") {
          loadPendingRequests(id);
        } else {
          setPendingRequests([]);
        }
      }
      if (pRes.ok) setCommunityPosts(await pRes.json());
    } finally {
      setCommunityPostsLoading(false);
    }
  };

  const handleJoinCommunity = async (communityId: string) => {
    setCommunityJoining(communityId);
    try {
      const res = await fetch(`/api/communities/${communityId}/join`, { method: "POST", headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "pending") {
          setCommunities((prev) => prev.map((c) => c.id === communityId ? { ...c, memberStatus: "pending" } : c));
          if (selectedCommunity?.id === communityId) setSelectedCommunity((prev) => prev ? { ...prev, memberStatus: "pending" } : prev);
        } else {
          setCommunities((prev) => prev.map((c) => c.id === communityId ? { ...c, isMember: true, membersCount: c.membersCount + 1 } : c));
          if (selectedCommunity?.id === communityId) setSelectedCommunity((prev) => prev ? { ...prev, isMember: true, memberRole: "member" } : prev);
        }
      }
    } finally {
      setCommunityJoining(null);
    }
  };

  const loadPendingRequests = async (communityId: string) => {
    try {
      const res = await fetch(`/api/communities/${communityId}/requests`, { headers: authHeaders() });
      if (res.ok) setPendingRequests(await res.json());
    } catch { /* ignore */ }
  };

  const handleApproveRequest = async (communityId: string, userId: string) => {
    await fetch(`/api/communities/${communityId}/requests/${userId}/approve`, { method: "POST", headers: authHeaders() });
    setPendingRequests((prev) => prev.filter((r) => r.id !== userId));
    if (selectedCommunity?.id === communityId) setSelectedCommunity((prev) => prev ? { ...prev, membersCount: prev.membersCount + 1 } : prev);
  };

  const handleRejectRequest = async (communityId: string, userId: string) => {
    await fetch(`/api/communities/${communityId}/requests/${userId}`, { method: "DELETE", headers: authHeaders() });
    setPendingRequests((prev) => prev.filter((r) => r.id !== userId));
  };

  const handleLeaveCommunity = async (communityId: string) => {
    setCommunityJoining(communityId);
    try {
      const res = await fetch(`/api/communities/${communityId}/leave`, { method: "POST", headers: authHeaders() });
      if (res.ok) {
        setCommunities((prev) => prev.map((c) => c.id === communityId ? { ...c, isMember: false, membersCount: Math.max(c.membersCount - 1, 1) } : c));
        if (selectedCommunity?.id === communityId) setSelectedCommunity((prev) => prev ? { ...prev, isMember: false, memberRole: undefined } : prev);
      }
    } finally {
      setCommunityJoining(null);
    }
  };

  const handleSendCommunityPost = async () => {
    if ((!communityPostInput.trim() && !communityPostImageUrl) || !selectedCommunity || communityPostSending) return;
    setCommunityPostSending(true);
    try {
      const res = await fetch(`/api/communities/${selectedCommunity.id}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: communityPostInput.trim() || "Imagem compartilhada", imageUrl: communityPostImageUrl || null }),
      });
      if (res.ok) {
        const post = await res.json();
        setCommunityPosts((prev) => [post, ...prev]);
        setCommunityPostInput("");
        setCommunityPostImageUrl("");
      }
    } finally {
      setCommunityPostSending(false);
    }
  };

  const handleDeleteCommunityPost = async (postId: string) => {
    const res = await fetch(`/api/communities/posts/${postId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Não foi possível apagar a mensagem.");
    setCommunityPosts((prev) => prev.filter((post) => post.id !== postId));
  };

  const handleCreateCommunity = async () => {
    if (!newCommunity.name.trim() || creatingCommunity) return;
    setCreatingCommunity(true);
    try {
      const res = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(newCommunity),
      });
      if (res.ok) {
        const community = await res.json();
        setCommunities((prev) => [{ ...community, isMember: true }, ...prev]);
        setShowCreateCommunity(false);
        setNewCommunity({ name: "", description: "", category: "geral", emoji: "🐝", imageUrl: "", isPrivate: false });
      }
    } finally {
      setCreatingCommunity(false);
    }
  };

  // Community edit state
  const [editingCommunity, setEditingCommunity] = useState<{ id: string; name: string; description: string; imageUrl: string } | null>(null);
  const [savingCommunity, setSavingCommunity] = useState(false);

  const handleOpenEditCommunity = () => {
    if (!selectedCommunity) return;
    setEditingCommunity({
      id: selectedCommunity.id,
      name: selectedCommunity.name,
      description: selectedCommunity.description ?? "",
      imageUrl: selectedCommunity.imageUrl ?? "",
    });
  };

  const handleSaveEditCommunity = async () => {
    if (!editingCommunity || savingCommunity) return;
    setSavingCommunity(true);
    try {
      const res = await fetch(`/api/communities/${editingCommunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: editingCommunity.name,
          description: editingCommunity.description || null,
          imageUrl: editingCommunity.imageUrl || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCommunities((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c));
        setSelectedCommunity((prev) => prev ? { ...prev, ...updated } : prev);
        setEditingCommunity(null);
      }
    } finally {
      setSavingCommunity(false);
    }
  };

  const loadConversationSuggestions = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/connections/suggestions?limit=6", { headers: authHeaders() });
      if (res.ok) setSuggestions(await res.json());
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    if (mobileTab === "feed") loadFeed();
    if (mobileTab === "friends") loadFriends();
    if (mobileTab === "inbox") {
      loadDMConversations();
      loadConversationSuggestions();
    }
    if (mobileTab === "communities") {
      loadCommunities(communitySearch);
      loadFriends();
    }
  }, [mobileTab, loadFeed, loadFriends, loadDMConversations, loadConversationSuggestions, loadCommunities]);

  useEffect(() => {
    if (!token || mobileTab !== "inbox") return;
    const timer = setInterval(() => {
      loadDMConversations();
      if (selectedDMUser) {
        fetch(`/api/dm/${selectedDMUser.id}`, { headers: authHeaders() })
          .then((r) => (r.ok ? r.json() : []))
          .then((data: DMMessage[]) => setDmMessages(data))
          .catch(() => {});
      }
    }, 7000);
    return () => clearInterval(timer);
  }, [token, mobileTab, selectedDMUser, loadDMConversations]);

  // Poll for new server-side messages (connection requests, acceptances, etc.)
  useEffect(() => {
    if (!token) return;
    const connectionMessageTypes = new Set([
      "connection_request",
      "connection_request_resolved",
      "connection_accepted",
    ]);

    const pollMessages = async () => {
      try {
        const res = await fetch("/api/messages?limit=50", { headers: authHeaders() });
        if (!res.ok) return;
        const serverMsgs: any[] = await res.json();
        const previousMessages = messagesRef.current;
        const matchedPreviousIds = new Set<string>();
        let shouldRefreshConnections = false;

        const normalized = serverMsgs.map((m) => {
          const incoming: Message = {
            ...m,
            metadata: m.metadata ?? null,
            timestamp: new Date(m.createdAt),
          };

          const existingById = previousMessages.find((msg) => msg.id === incoming.id);
          const optimisticMatch = existingById ?? previousMessages.find((msg) =>
            !matchedPreviousIds.has(msg.id) &&
            msg.role === incoming.role &&
            msg.content === incoming.content &&
            Math.abs(new Date(msg.timestamp).getTime() - incoming.timestamp.getTime()) < 30000
          );

          if (optimisticMatch) matchedPreviousIds.add(optimisticMatch.id);

          const changed =
            !optimisticMatch ||
            optimisticMatch.id !== incoming.id ||
            optimisticMatch.content !== incoming.content ||
            optimisticMatch.metadata !== incoming.metadata;

          if (changed && incoming.metadata) {
            try {
              const meta = JSON.parse(incoming.metadata);
              if (connectionMessageTypes.has(meta?.type)) shouldRefreshConnections = true;
            } catch { /* ignore */ }
          }

          return incoming;
        });

        const leftovers = previousMessages.filter((msg) =>
          !matchedPreviousIds.has(msg.id) &&
          !normalized.some((incoming) => incoming.id === msg.id)
        );

        const merged = [...leftovers, ...normalized].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        messagesRef.current = merged;
        setMessages(merged);

        if (shouldRefreshConnections) {
          loadFriends();
          refreshSearchResults();
        }
      } catch { /* ignore */ }
    };
    pollMessages();
    const interval = setInterval(pollMessages, 5000);
    return () => clearInterval(interval);
  }, [token, loadFriends, refreshSearchResults]);

  // Proactive messages polling
  useEffect(() => {
    if (!token) return;
    const poll = async () => {
      try {
        const res = await fetch("/api/proactive", { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => {
            const id = data.id ?? Date.now().toString();
            if (prev.some((message) => message.id === id)) return prev;
            return [...prev, {
              id,
              role: "assistant",
              content: data.message,
              metadata: data.metadata ?? null,
              timestamp: data.createdAt ? new Date(data.createdAt) : new Date(),
            }];
          });
          setEyeExpression("attentive");
          pulseEyeEvent("message-received", 1600);
          setTimeout(() => setEyeExpression("neutral"), 4000);
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(poll, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [pulseEyeEvent, token]);

  // Load Google GIS script once
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const handleGoogleLogin = () => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setAuthError("Configure VITE_GOOGLE_CLIENT_ID no .env para ativar o login com Google.");
      return;
    }
    setGoogleLoading(true);
    const google = (window as any).google;
    if (!google) { setAuthError("Google não carregado. Tente novamente."); setGoogleLoading(false); return; }
    google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: async (response: any) => {
        if (!response.access_token) { setGoogleLoading(false); return; }
        try {
          const res = await fetch("/api/auth/social", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "google", accessToken: response.access_token }),
          });
          const data = await res.json();
          if (!res.ok) { setAuthError(data.message || "Erro com Google"); return; }
          finishAuth(data);
        } catch { setAuthError("Erro de conexão com Google"); }
        finally { setGoogleLoading(false); }
      },
      error_callback: () => setGoogleLoading(false),
    }).requestAccessToken();
  };

  const finishAuth = (data: any) => {
    // Cookie httpOnly já foi setado pelo backend. Marcamos a sessão como ativa no state.
    setTokenLegacy(data.token);
    setTokenState(AUTH_SENTINEL);
    setUser(data.user);
    const name = data.user.displayName || data.user.username;
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: `Oi, ${name}! Eu sou a Bee, sua assistente digital de rotina e evolução. Quer organizar seu dia, revisar seus treinos ou continuar de onde paramos?`,
      timestamp: new Date(),
    }]);
    setEyeExpression("happy");
    pulseEyeEvent("message-received", 1800);
  };

  const handleAuth = async () => {
    setAuthError("");
    setAuthLoading(true);
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    try {
      const body: any = { username: authUsername, password: authPassword };
      if (authMode === "register") {
        body.email = authEmail;
        if (authDisplayName.trim()) body.displayName = authDisplayName.trim();
        if (authGender) body.gender = authGender;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.message || "Erro"); return; }
      finishAuth(data);
    } catch {
      setAuthError("Erro de conexão");
    } finally {
      setAuthLoading(false);
    }
  };

  function pwStrength(pw: string) {
    if (!pw) return null;
    if (pw.length < 8) return { label: "Fraca", color: "#E53E3E", w: "25%" };
    if (pw.length < 10) return { label: "Média", color: "#F5A623", w: "55%" };
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) return { label: "Forte", color: "#4CAF50", w: "100%" };
    return { label: "Boa", color: "#4CAF50", w: "80%" };
  }

  const handlePasswordResetRequest = async (emailOrUsername: string) => {
    const email = emailOrUsername.includes("@")
      ? emailOrUsername
      : window.prompt("Digite o e-mail cadastrado na sua conta BeeEyes") || "";
    if (!email.trim()) return;
    setAuthError("");
    try {
      await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setAuthError("Se o e-mail existir, enviaremos um link de recuperação.");
    } catch {
      setAuthError("Erro de conexão");
    }
  };

  const handleSendMessage = async (voiceText?: string) => {
    const content = (typeof voiceText === "string" ? voiceText : inputValue).trim();
    if (!content || isLoading || !token) return;
    const slashCommand = content.toLowerCase();

    if (slashCommand === "/feed") {
      setInputValue("");
      setMobileTab("feed");
      loadFeed();
      return;
    }

    if (slashCommand === "/compartilhar") {
      setInputValue("");
      setShowPostInput(true);
      setMobileTab("feed");
      loadFeed();
      return;
    }

    const replyTarget = selectedReplyMessage;
    const replyPayload = replyTarget
      ? {
          repliedToMessageId: replyTarget.id,
          repliedToMessageContent: replyTarget.content.slice(0, 1000),
          repliedToMessageRole: replyTarget.role,
          repliedToMessageCreatedAt: replyTarget.timestamp instanceof Date ? replyTarget.timestamp.toISOString() : replyTarget.repliedToMessageCreatedAt ?? null,
        }
      : {};
    const userMsg: Message = { id: Date.now().toString(), role: "user", content, timestamp: new Date(), ...replyPayload };
    setMessages((prev) => [...prev, userMsg]);
    isNearBottomRef.current = true;
    setInputValue("");
    setSelectedReplyMessage(null);
    setEyeIsTyping(false);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    setEyeExpression("attentive");
    pulseEyeEvent("user-typing", 900);

    if (slashCommand === "/notícias" || slashCommand === "/noticias") {
      handleNewsCommand();
      return;
    }
    if (slashCommand === "/inbox" || slashCommand === "/mensagens") {
      setMobileTab("inbox");
      loadDMConversations();
      loadConversationSuggestions();
      injectAssistantMessage("Abrindo suas mensagens. 💬");
      return;
    }
    if (slashCommand === "/comunidades") {
      setMobileTab("communities");
      loadCommunities(communitySearch);
      injectAssistantMessage("Abrindo comunidades. 👥");
      return;
    }

    setEyeExpression("thinking");
    pulseEyeEvent("thinking", 1800);
    setIsLoading(true);
    setStreamingText("");
    setResearchLoading(false);
    setResearchIntent(null);
    pendingResearchRef.current = null;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content, ...replyPayload }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setMessages((prev) => [...prev, {
          id: Date.now().toString(),
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
        }]);
        setEyeExpression("attentive");
        pulseEyeEvent("message-received", 1500);
        setIsLoading(false);
        return;
      }

      if (!res.ok) throw new Error("Erro na resposta");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let assistantMsgId = (Date.now() + 1).toString();
      // Buffer for incomplete SSE lines split across TCP chunks
      let lineBuffer = "";

      const processLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        try {
          const event = JSON.parse(line.slice(6));
          handleSseEvent(event);
        } catch { /* skip malformed */ }
      };

      const handleSseEvent = (event: any) => {

            if (event.type === "chunk") {
              const isFirstChunk = accumulated.length === 0;
              accumulated += event.text;
              setStreamingText(cleanAIText(accumulated));
              setEyeExpression("attentive");
              if (isFirstChunk) pulseEyeEvent("message-received", 1400);
            } else if (event.type === "research_start") {
              setResearchLoading(true);
              setResearchIntent(event.intent ?? null);
            } else if (event.type === "research_results") {
              setResearchLoading(false);
              if (event.results?.length > 0) {
                pendingResearchRef.current = { intent: event.intent, results: event.results };
              }
            } else if (event.type === "workout_suggestion") {
              pendingWorkoutRef.current = event.plan;
            } else if (event.type === "done") {
              const pending = pendingResearchRef.current;
              const finalMetadata = event.metadata
                ?? (pending ? JSON.stringify({ type: "research", intent: pending.intent, results: pending.results }) : null);
              setMessages((prev) => {
                const withFinal = [...prev, {
                  id: event.id ?? assistantMsgId,
                  role: "assistant" as const,
                  content: cleanAIText(event.cleanText ?? accumulated),
                  timestamp: new Date(),
                  metadata: finalMetadata,
                }];
                // Append workout suggestion as a separate assistant message
                if (pendingWorkoutRef.current) {
                  withFinal.push({
                    id: `workout-${Date.now()}`,
                    role: "assistant" as const,
                    content: "Aqui está minha sugestão de treino para você 🐝💪",
                    timestamp: new Date(),
                    metadata: JSON.stringify({ type: "workout_suggestion", plan: pendingWorkoutRef.current }),
                  });
                }
                return withFinal;
              });
              pendingWorkoutRef.current = null;
              pendingResearchRef.current = null;
              setResearchLoading(false);
              setResearchIntent(null);
              setStreamingText("");
              setEyeExpression("happy");
              pulseEyeEvent("message-received", 1800);
              fetch("/api/me", { headers: authHeaders() })
                .then((r) => r.json()).then(setUser).catch(() => {});
            } else if (event.type === "event_created") {
              setColmeiaRefreshKey((value) => value + 1);
              setAchievementData({ title: "Evento criado! 📅", description: event.event?.title ?? "Evento adicionado ao calendário." });
              setShowAchievement(true);
              setTimeout(() => setShowAchievement(false), 3500);
            } else if (event.type === "finance_logged") {
              setColmeiaRefreshKey((value) => value + 1);
              const tx = event.transaction;
              const label = tx?.type === "income" ? "Receita" : "Despesa";
              const amount = tx ? `R$ ${(tx.amountCents / 100).toFixed(2)}` : "";
              setAchievementData({ title: `${label} registrada! 💰`, description: [tx?.description, amount].filter(Boolean).join(" — ") });
              setShowAchievement(true);
              setTimeout(() => setShowAchievement(false), 3500);
            } else if (event.type === "note_saved") {
              setColmeiaRefreshKey((value) => value + 1);
              const note = event.note;
              setAchievementData({ title: "Nota salva! 📝", description: note?.title ?? (note?.content?.slice(0, 60) + (note?.content?.length > 60 ? "…" : "")) });
              setShowAchievement(true);
              setTimeout(() => setShowAchievement(false), 3500);
            } else if (event.type === "alarm_created") {
              setColmeiaRefreshKey((value) => value + 1);
              setAchievementData({ title: "Despertador criado!", description: event.alarm?.title ?? "Aviso adicionado ao Relógio." });
              setShowAchievement(true);
              setTimeout(() => setShowAchievement(false), 3500);
            } else if (event.type === "error") {
              setStreamingText("");
              setMessages((prev) => [...prev, {
                id: assistantMsgId,
                role: "assistant",
                content: "Desculpe, ocorreu um erro. Tente novamente.",
                timestamp: new Date(),
              }]);
            }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Flush any remaining buffered content
          if (lineBuffer) processLine(lineBuffer);
          break;
        }

        const text = decoder.decode(value, { stream: true });
        // Append new bytes to the buffer and split on newlines
        lineBuffer += text;
        const lines = lineBuffer.split("\n");
        // The last element may be an incomplete line — keep it in the buffer
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          processLine(line);
        }
      }
    } catch {
      setStreamingText("");
      setMessages((prev) => [...prev, {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: "Desculpe, ocorreu um erro de conexão. Tente novamente.",
        timestamp: new Date(),
      }]);
      setEyeExpression("neutral");
      pulseEyeEvent("message-received", 1200);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleLogout = () => {
    clearTokenLegacy();
    setTokenState(null);
    setUser(null);
    setMessages([]);
  };

  const handleSelectProfilePhoto = () => {
    photoFileInputRef.current?.click();
  };

  const handleProfileFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSettingsMessage("Selecione um arquivo de imagem valido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        setSettingsMessage("Não foi possível processar a imagem.");
        return;
      }

      const image = new Image();
      image.onload = () => {
        const side = Math.min(image.width, image.height);
        const sx = Math.floor((image.width - side) / 2);
        const sy = Math.floor((image.height - side) / 2);
        const targetSize = 512;

        const canvas = document.createElement("canvas");
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setSettingsMessage("Não foi possível preparar a imagem.");
          return;
        }

        ctx.drawImage(image, sx, sy, side, side, 0, 0, targetSize, targetSize);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);

        setProfilePhoto(compressedDataUrl);
        setProfilePhotoUrl(compressedDataUrl);
        apiFetch("/api/me/avatar", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ avatarUrl: compressedDataUrl }) }).catch(() => {});
        setSettingsMessage("Foto atualizada com recorte e compressão.");
      };
      image.onerror = () => {
        setSettingsMessage("Falha ao carregar o arquivo selecionado.");
      };
      image.src = result;
    };
    reader.onerror = () => {
      setSettingsMessage("Falha ao ler o arquivo da imagem.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleRemoveProfilePhoto = () => {
    clearProfilePhoto();
    setProfilePhotoUrl("");
    apiFetch("/api/me/avatar", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ avatarUrl: null }) }).catch(() => {});
    setSettingsMessage("Foto de perfil removida.");
  };

  const handleThemeSelect = (mode: ThemeMode) => {
    applyTheme(mode);
    setThemeMode(readTheme());
    setSettingsMessage(`Tema ${mode === "dark" ? "escuro" : "claro"} aplicado.`);
  };

  const handleFeedImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isAcceptedFeedImage(file)) {
      setSettingsMessage("Formato não suportado. Use JPEG, PNG, WebP, BMP ou GIF.");
      return;
    }
    setPostImagePreviewUrl("");
    setPostImageUrl("");
    setPickingPostImage(true);
    try {
      let imageUrl: string;
      try {
        imageUrl = await fileToCompressedDataUrl(file, 1080, 0.75);
      } catch {
        imageUrl = await fileToDataUrl(file);
      }
      setPostImageUrl(imageUrl);
      setPostImagePreviewUrl(imageUrl);
    } catch (error) {
      clearPostImage();
      setSettingsMessage(getApiErrorMessage(error, "Não foi possível preparar a foto."));
    } finally {
      setPickingPostImage(false);
    }
  };

  const handleCommunityPostImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPickingCommunityPostImage(true);
    try {
      let imageUrl: string;
      try {
        imageUrl = await fileToCompressedDataUrl(file, 1080, 0.80);
      } catch {
        imageUrl = await fileToDataUrl(file);
      }
      setCommunityPostImageUrl(imageUrl);
    } catch (error) {
      setSettingsMessage(getApiErrorMessage(error, "Não foi possível preparar a imagem."));
    } finally {
      setPickingCommunityPostImage(false);
    }
  };

  const handleMoodSelect = (mood: number) => {
    setSelectedMood(mood);
    if (mood >= 4) setEyeExpression("excited");
    else if (mood <= 2) setEyeExpression("curious");
    else setEyeExpression("neutral");
  };

  const handleCreatePost = async () => {
    if ((!postText.trim() && !postImageUrl) || isPosting) return;
    setIsPosting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: postText.trim() || "Imagem compartilhada", imageUrl: postImageUrl || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSettingsMessage(body?.message || body?.error?.message || `Erro ${res.status}: falha ao publicar`);
        return;
      }
      const newPost = await res.json();
      // Optimistic update: prepend immediately, AI comment arrives on next refresh
      setFeed((prev) => [{
        ...newPost,
        author: { id: user!.id, username: user!.username, displayName: null, level: user!.level },
        likesCount: 0,
        liked: false,
      }, ...prev]);
      setPostText("");
      clearPostImage();
      setShowPostInput(false);
      // AI comment chega no próximo carregamento natural — sem refetch agressivo.
    } catch (err) {
      setSettingsMessage(err instanceof Error ? err.message : "Erro ao publicar. Tente novamente.");
    }
    finally { setIsPosting(false); }
  };

  const handleEditPost = async (postId: string, content: string) => {
    const res = await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error("Não foi possível editar o post.");
    setFeed((prev) => prev.map((p) => p.id === postId ? { ...p, content } : p));
  };

  const handleDeletePost = async (postId: string) => {
    const res = await fetch(`/api/posts/${postId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Não foi possível apagar o post.");
    setFeed((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleLikePost = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setFeed((prev) => prev.map((p) => p.id === postId ? { ...p, liked: data.liked, likesCount: data.likesCount } : p));
    } catch { /* ignore */ }
  };

  const injectAssistantMessage = (content: string, metadata?: object) => {
    const msg = {
      id: `cmd-${Date.now()}`,
      role: "assistant" as const,
      content,
      timestamp: new Date(),
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    };
    setMessages((prev) => [...prev, msg]);
    isNearBottomRef.current = true;
    setEyeExpression("attentive");
    pulseEyeEvent("message-received", 1500);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  function handleSponsoredHide(messageId: string, adId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    hideAd(adId);
  }

  function handleSponsoredNotRelevant(messageId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  function handleSponsoredReport(messageId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  // ── Feedback em mensagens da Bee (Curtir / Não curti / Enviar para o Feed) ──
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackType>>({});
  const [feedbackBusy, setFeedbackBusy] = useState<Record<string, boolean>>({});
  const [feedbackToast, setFeedbackToast] = useState<{ tone: "success" | "info" | "error"; text: string } | null>(null);
  const [draftModal, setDraftModal] = useState<{ messageId: string | null; content: string } | null>(null);
  const [draftSubmitting, setDraftSubmitting] = useState(false);

  function pushFeedbackToast(tone: "success" | "info" | "error", text: string) {
    setFeedbackToast({ tone, text });
    window.setTimeout(() => setFeedbackToast(null), 3000);
  }

  // Sincroniza estado dos botões ao carregar mensagens
  useEffect(() => {
    const assistantIds = messages.filter((m) => m.role === "assistant" && !m.id.startsWith("temp-") && !m.id.startsWith("feedback-") && !m.id.startsWith("shared-")).map((m) => m.id);
    if (!token || assistantIds.length === 0) return;
    fetch("/api/messages/feedback/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ ids: assistantIds }),
    })
      .then((r) => r.ok ? r.json() : [])
      .then((rows: Array<{ messageId: string; feedbackType: FeedbackType }>) => {
        if (!Array.isArray(rows)) return;
        setFeedbackMap((prev) => {
          const next = { ...prev };
          for (const r of rows) next[r.messageId] = r.feedbackType;
          return next;
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, token]);

  const submitFeedback = async (messageId: string, type: FeedbackType, reason?: string) => {
    if (feedbackBusy[messageId]) return;
    setFeedbackBusy((p) => ({ ...p, [messageId]: true }));
    // Optimistic
    setFeedbackMap((p) => ({ ...p, [messageId]: type }));
    try {
      const res = await fetch(`/api/messages/${messageId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ type, reason }),
      });
      if (!res.ok) throw new Error("feedback failed");
      if (type === "like") {
        pushFeedbackToast("success", "A Bee vai lembrar que esse tipo de resposta foi útil 💛");
      } else {
        const label = DISLIKE_REASONS.find((r) => r.value === reason)?.label;
        pushFeedbackToast("info", label
          ? `Obrigada pelo feedback (${label.toLowerCase()}). Vou tentar melhorar nas próximas.`
          : "Obrigada pelo feedback. Vou tentar melhorar nas próximas respostas.");
      }
    } catch {
      // rollback
      setFeedbackMap((p) => {
        const next = { ...p };
        delete next[messageId];
        return next;
      });
      pushFeedbackToast("error", "Não consegui salvar seu feedback agora.");
    } finally {
      setFeedbackBusy((p) => ({ ...p, [messageId]: false }));
    }
  };

  const undoFeedback = async (messageId: string) => {
    if (feedbackBusy[messageId]) return;
    const previous = feedbackMap[messageId];
    setFeedbackBusy((p) => ({ ...p, [messageId]: true }));
    setFeedbackMap((p) => {
      const next = { ...p };
      delete next[messageId];
      return next;
    });
    try {
      await fetch(`/api/messages/${messageId}/feedback`, { method: "DELETE", headers: authHeaders() });
      pushFeedbackToast("info", "Feedback desfeito.");
    } catch {
      if (previous) setFeedbackMap((p) => ({ ...p, [messageId]: previous }));
      pushFeedbackToast("error", "Não consegui desfazer agora.");
    } finally {
      setFeedbackBusy((p) => ({ ...p, [messageId]: false }));
    }
  };

  const openDraftModal = (messageId: string, content: string) => {
    setDraftModal({ messageId, content });
  };

  const publishDraft = async (data: { sourceMessageId: string | null; title: string; content: string; category: string | null; hashtags: string; privacy: "public" | "friends" | "private"; publishNow: boolean }) => {
    setDraftSubmitting(true);
    try {
      const draftRes = await fetch("/api/feed-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          sourceMessageId: data.sourceMessageId,
          title: data.title,
          content: data.content,
          category: data.category,
          hashtags: data.hashtags,
          privacy: data.privacy,
        }),
      });
      if (!draftRes.ok) throw new Error("draft failed");
      const draft = await draftRes.json();

      if (data.publishNow) {
        const pubRes = await fetch(`/api/feed-drafts/${draft.id}/publish`, {
          method: "POST",
          headers: authHeaders(),
        });
        if (!pubRes.ok) throw new Error("publish failed");
        pushFeedbackToast("success", "Publicado no Feed 🐝");
        loadFeed(true);
      } else {
        pushFeedbackToast("success", "Rascunho salvo.");
      }
      setDraftModal(null);
    } catch {
      pushFeedbackToast("error", "Não consegui enviar para o Feed agora.");
    } finally {
      setDraftSubmitting(false);
    }
  };

  const handleNewsCommand = async () => {
    injectAssistantMessage("Buscando notícias para você... 📰");
    try {
      const res = await fetch("/api/news", { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const { items, query } = await res.json();
      if (items.length === 0) {
        injectAssistantMessage("Não encontrei notícias agora. Tente novamente em breve.");
        return;
      }
      injectAssistantMessage(`📰 Notícias de hoje — sobre **${query}**`, { type: "news", items });
    } catch {
      injectAssistantMessage("Não consegui buscar notícias agora. Tente novamente.");
    }
  };

  const handleConnect = async (targetUserId: string) => {
    if (connectingIds.has(targetUserId)) return;
    setConnectingIds((prev) => new Set(prev).add(targetUserId));
    try {
      await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ targetUserId }),
      });
      setSuggestions((prev) => prev.filter((s) => s.id !== targetUserId));
    } catch { /* ignore */ }
    finally {
      setConnectingIds((prev) => { const s = new Set(prev); s.delete(targetUserId); return s; });
    }
  };

  // Auth screen
  if (!token) {
    const strength = authMode === "register" ? pwStrength(authPassword) : null;
    return (
      <AuthScreen
        authMode={authMode}
        authUsername={authUsername}
        authEmail={authEmail}
        authPassword={authPassword}
        authDisplayName={authDisplayName}
        authGender={authGender}
        authError={authError}
        authShowPassword={authShowPassword}
        authLoading={authLoading}
        googleLoading={googleLoading}
        strength={strength}
        onAuthModeChange={setAuthMode}
        onUsernameChange={setAuthUsername}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onDisplayNameChange={setAuthDisplayName}
        onGenderChange={setAuthGender}
        onTogglePassword={() => setAuthShowPassword((value) => !value)}
        onSubmit={handleAuth}
        onGoogleLogin={handleGoogleLogin}
        onPasswordResetRequest={handlePasswordResetRequest}
        onClearError={() => {
          setAuthError("");
          setAuthPassword("");
          setAuthEmail("");
          setAuthDisplayName("");
          setAuthGender("");
        }}
      />
    );
  }

  if (user && user.onboardingCompleted === false) {
    return <OnboardingScreen authHeaders={authHeaders} onComplete={setUser} />;
  }

  const sidebarContent = (
    <>
      <Tabs
        value={mobileTab === "chat" ? "feed" : mobileTab}
        className="flex-1 flex flex-col min-h-0"
        onValueChange={(v) => {
          setMobileTab(v as any);
          if (v === "feed") loadFeed();
          if (v === "friends") loadFriends();
          if (v === "inbox") {
            loadDMConversations();
            loadConversationSuggestions();
          }
          if (v === "communities") {
            loadCommunities(communitySearch);
          }
        }}
      >

        <TabsList className="mx-3 mt-3 md:flex hidden gap-1 h-auto p-1.5">
          <TabsTrigger value="feed" className="flex-1 flex-col gap-1 py-2 px-1 h-auto">
            <LayoutGrid className="w-4 h-4" />
            <span className="text-[10px] leading-tight">Feed</span>
          </TabsTrigger>
          <TabsTrigger value="colmeia" className="flex-1 flex-col gap-1 py-2 px-1 h-auto">
            <Hexagon className="w-4 h-4" />
            <span className="text-[10px] leading-tight">Colmeia</span>
          </TabsTrigger>
          <TabsTrigger value="friends" className="flex-1 flex-col gap-1 py-2 px-1 h-auto">
            <Users className="w-4 h-4" />
            <span className="text-[10px] leading-tight">Amigos</span>
          </TabsTrigger>
          <TabsTrigger value="inbox" className="flex-1 flex-col gap-1 py-2 px-1 h-auto">
            <MessageSquare className="w-4 h-4" />
            <span className="text-[10px] leading-tight">Mensagens</span>
          </TabsTrigger>
          <TabsTrigger value="communities" className="flex-1 flex-col gap-1 py-2 px-1 h-auto">
            <Users2 className="w-4 h-4" />
            <span className="text-[10px] leading-tight">Comunidades</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="flex-1 overflow-y-auto min-h-0 p-0 mt-0">
          <FeedPanel
            feed={feed}
            feedLoading={feedLoading}
            feedLoadingMore={feedLoadingMore}
            feedHasMore={feedHasMore}
            feedError={feedError}
            feedMode={feedMode}
            postText={postText}
            postImagePreviewUrl={postImagePreviewUrl}
            postImageUrl={postImageUrl}
            pickingPostImage={pickingPostImage}
            isPosting={isPosting}
            showPostInput={showPostInput}
            suggestions={suggestions}
            connectingIds={connectingIds}
            onLoadFeed={() => loadFeed(true)}
            onLoadMore={loadMoreFeed}
            onFeedModeChange={setFeedMode}
            onTogglePostInput={() => setShowPostInput((value) => !value)}
            onPostTextChange={setPostText}
            onPickPostImage={(capture) => capture ? feedCameraInputRef.current?.click() : feedImageInputRef.current?.click()}
            onRemovePostImage={clearPostImage}
            onCancelPost={() => { setShowPostInput(false); setPostText(""); clearPostImage(); }}
            onCreatePost={handleCreatePost}
            onConnect={handleConnect}
            onLikePost={handleLikePost}
            onEditPost={handleEditPost}
            onDeletePost={handleDeletePost}
            onOpenFriendProfile={openFriendProfile}
            currentUser={user}
            timeAgo={timeAgo}
            authHeaders={authHeaders}
          />
        </TabsContent>

        <TabsContent value="colmeia" className="flex-1 overflow-y-auto min-h-0 p-0 mt-0">
          <ColmeiaPanel key={colmeiaRefreshKey} authHeaders={authHeaders} />
        </TabsContent>

        <TabsContent value="friends" className="flex-1 overflow-y-auto min-h-0 p-0 mt-0">
          <FriendsPanel
            user={user}
            friends={friends}
            friendsLoading={friendsLoading}
            friendSearch={friendSearch}
            searchResults={searchResults}
            searchLoading={searchLoading}
            searchConnecting={searchConnecting}
            onFriendSearchChange={handleFriendSearch}
            onOpenFriendProfile={openFriendProfile}
            onSearchConnect={handleSearchConnect}
            onCancelRequest={handleCancelRequest}
            onRemoveFriend={handleRemoveFriend}
            removingFriendIds={removingFriendIds}
            incomingRequests={incomingRequests}
            sentRequests={sentRequests}
            onAcceptRequest={handleAcceptRequest}
            onRejectRequest={handleRejectFriendRequest}
            processingRequestIds={processingRequestIds}
            onOpenDMWithUser={openDMWithUser}
            timeAgo={timeAgo}
          />
        </TabsContent>


        <TabsContent value="inbox" className="flex-1 overflow-hidden min-h-0 p-0 mt-0 relative">
          <InboxPanel
            user={user}
            selectedDMUser={selectedDMUser}
            dmMessages={dmMessages}
            dmInput={dmInput}
            dmSending={dmSending}
            dmLoading={dmLoading}
            dmConversations={dmConversations}
            suggestions={suggestions}
            dmEndRef={dmEndRef}
            onBack={() => setSelectedDMUser(null)}
            onInputChange={setDmInput}
            onSend={sendDMMessage}
            onOpenThread={openDMThread}
            onDeleteConversation={async (userId, name) => {
              if (!window.confirm(`Apagar toda a conversa com ${name}?`)) return;
              try {
                await apiFetch(`/api/dm/${userId}`, { method: "DELETE", headers: authHeaders() });
                setDmConversations((prev) => prev.filter((c) => c.user.id !== userId));
                if (selectedDMUser?.id === userId) setSelectedDMUser(null);
              } catch {
                alert("Não foi possível apagar a conversa.");
              }
            }}
            timeAgo={timeAgo}
          />
        </TabsContent>

        <TabsContent value="communities" className="flex-1 min-h-0 overflow-hidden p-0 m-0 relative">
          <CommunitiesPanel
            communities={communities}
            communitiesLoading={communitiesLoading}
            communitySearch={communitySearch}
            selectedCommunity={selectedCommunity}
            currentUserId={user?.id}
            communityPosts={communityPosts}
            communityPostsLoading={communityPostsLoading}
            communityPostInput={communityPostInput}
            communityPostImageUrl={communityPostImageUrl}
            pickingCommunityPostImage={pickingCommunityPostImage}
            communityPostSending={communityPostSending}
            showCreateCommunity={showCreateCommunity}
            newCommunity={newCommunity}
            creatingCommunity={creatingCommunity}
            communityJoining={communityJoining}
            onCommunitySearchChange={(value) => { setCommunitySearch(value); loadCommunities(value); }}
            onOpenCommunity={openCommunity}
            onJoinCommunity={handleJoinCommunity}
            onLeaveCommunity={handleLeaveCommunity}
            onCloseCommunity={() => setSelectedCommunity(null)}
            onCommunityPostInputChange={setCommunityPostInput}
            onPickCommunityPostImage={() => communityPostImageInputRef.current?.click()}
            onRemoveCommunityPostImage={() => setCommunityPostImageUrl("")}
            onSendCommunityPost={handleSendCommunityPost}
            onShowCreateCommunity={setShowCreateCommunity}
            onNewCommunityChange={setNewCommunity}
            onCreateCommunity={handleCreateCommunity}
            editingCommunity={editingCommunity}
            savingCommunity={savingCommunity}
            onOpenEditCommunity={handleOpenEditCommunity}
            onEditCommunityChange={setEditingCommunity}
            onSaveEditCommunity={handleSaveEditCommunity}
            onCancelEditCommunity={() => setEditingCommunity(null)}
            onDeleteCommunity={async (communityId, name) => {
              if (!window.confirm(`Apagar a comunidade "${name}"? Esta ação não pode ser desfeita.`)) return;
              try {
                await apiFetch(`/api/communities/${communityId}`, { method: "DELETE", headers: authHeaders() });
                setCommunities((prev) => prev.filter((c) => c.id !== communityId));
                setSelectedCommunity(null);
              } catch {
                alert("Não foi possível apagar a comunidade.");
              }
            }}
            onDeleteCommunityPost={handleDeleteCommunityPost}
            pendingRequests={pendingRequests}
            friends={friends}
            friendsLoading={friendsLoading}
            onApproveRequest={handleApproveRequest}
            onRejectRequest={handleRejectRequest}
            onInviteToCommunity={async (communityId, userIds) => {
              try {
                await apiFetch(`/api/communities/${communityId}/invite`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...authHeaders() },
                  body: JSON.stringify({ userIds }),
                });
                alert("Convites enviados com sucesso!");
              } catch {
                alert("Não foi possível enviar os convites.");
              }
            }}
            onOpenFriendProfile={openFriendProfile}
            authHeaders={authHeaders}
            timeAgo={timeAgo}
          />
        </TabsContent>

      </Tabs>
    </>
  );

  return (
    <div className="bee-app-shell beeyes-bg-hex-pattern-light dark:beeyes-bg-hex-pattern flex flex-col md:flex-row h-[100dvh] bg-background text-foreground overflow-hidden">

      <ChatWorkspace
        mobileTab={mobileTab}
        profilePhotoUrl={profilePhotoUrl}
        user={user}
        authHeaders={authHeaders}
        onGoToFriends={() => setMobileTab("friends")}
        eyeExpression={eyeExpression}
        eyeEvent={eyeEvent}
        eyeInputFocused={eyeInputFocused}
        eyeIsTyping={eyeIsTyping}
        eyeScrollProgress={eyeScrollProgress}
        eyeEngagementLevel={0}
        showMsgSearch={showMsgSearch}
        msgSearchQuery={msgSearchQuery}
        messages={messages}
        streamingText={streamingText}
        researchLoadingSlot={researchLoading && researchIntent ? <ResearchLoadingState intent={researchIntent} /> : null}
        processingConnectionRequestId={processingConnectionRequestId}
        chatScrollRef={chatScrollRef}
        chatEndRef={chatEndRef}
        inputRef={inputRef}
        inputValue={inputValue}
        isLoading={isLoading}
        selectedReplyMessage={selectedReplyMessage}
        messageActionsRenderer={(message) => {
          if (message.role !== "assistant") return null;
          // Pula mensagens sintéticas (ex.: feedback, shared, streaming) sem id de banco
          const isPersisted = !!message.id && !message.id.startsWith("temp-") && !message.id.startsWith("feedback-") && !message.id.startsWith("shared-") && message.id !== "streaming";
          const baseActions = isPersisted ? (
            <MessageFeedback
              current={feedbackMap[message.id] ?? null}
              busy={!!feedbackBusy[message.id]}
              onLike={() => { pulseEyeEvent("message-received", 900); submitFeedback(message.id, "like"); }}
              onDislike={(reason) => submitFeedback(message.id, "dislike", reason)}
              onUndo={() => undoFeedback(message.id)}
              onSendToFeed={() => openDraftModal(message.id, message.content)}
            />
          ) : null;
          const meta = getMessageMeta(message.metadata);
          if (!meta) return baseActions;

          if (meta.type === "connection_request" && meta.connectionId) {
            const connectionMeta = getConnectionRequestMeta(message.metadata);
            if (!connectionMeta) return baseActions;
            const isBusy = processingConnectionRequestId === connectionMeta.connectionId;
            return (
              <div className="space-y-2">
                {baseActions}
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 text-xs" disabled={!!processingConnectionRequestId} onClick={() => handleConnectionDecision(message.id, connectionMeta.connectionId, "accept")}>
                    {isBusy ? "Processando..." : "Aceitar"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!!processingConnectionRequestId} onClick={() => handleConnectionDecision(message.id, connectionMeta.connectionId, "reject")}>
                    Recusar
                  </Button>
                </div>
              </div>
            );
          }

          if (meta.type === "holiday_alarm_confirmation" && meta.alarmDraft) {
            return (
              <div className="space-y-2">
                {baseActions}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="h-8 text-xs" onClick={() => handleHolidayAlarmDecision(message.id, meta, "create")}>
                    Despertar mesmo assim
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleHolidayAlarmDecision(message.id, meta, "skip")}>
                    Não despertar no feriado
                  </Button>
                </div>
              </div>
            );
          }

          if (meta.type === "reactivate_alarm_confirmation" && meta.alarmId) {
            return (
              <div className="space-y-2">
                {baseActions}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="h-8 text-xs" onClick={() => handleAlarmReactivationDecision(message.id, meta, "activate")}>
                    Reativar alarme
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleAlarmReactivationDecision(message.id, meta, "keep_paused")}>
                    Manter pausado
                  </Button>
                </div>
              </div>
            );
          }

          if ((meta.type === "news" || meta.type === "news_digest") && Array.isArray(meta.items)) {
            return (
              <div className="space-y-2">
                {baseActions}
                {(meta.items as NewsItem[]).map((item, index) => (
                  <NewsCard key={item.link + "-" + index} title={item.title} link={item.link} source={item.source} authHeaders={authHeaders} />
                ))}
              </div>
            );
          }

          if (meta.type === "workout_suggestion" && (meta as any).plan) {
            return (
              <div className="space-y-2">
                {baseActions}
                <WorkoutSuggestionCard
                  plan={(meta as any).plan as WorkoutSuggestionPlan}
                  onSaved={() => {
                    setColmeiaRefreshKey((value) => value + 1);
                    setAchievementData({ title: "Plano salvo! 🐝💪", description: "Veja em Saúde > Coach de Saúde" });
                    setShowAchievement(true);
                    setTimeout(() => setShowAchievement(false), 3000);
                  }}
                />
              </div>
            );
          }

          if (meta.type === "research" && Array.isArray((meta as ResearchMeta).results)) {
            const research = meta as ResearchMeta;
            return (
              <div className="space-y-2">
                {baseActions}
                <ResearchSourceBadge count={research.results.length} intent={research.intent} />
                {research.results.map((result) => (
                  <ResearchResultCard
                    key={result.id}
                    result={result}
                    authHeaders={authHeaders}
                    onSaveToWishlist={async (r) => {
                      try {
                        const resp = await fetch("/api/wishlist/items", {
                          method: "POST",
                          headers: { ...authHeaders(), "Content-Type": "application/json" },
                          body: JSON.stringify({ title: r.title, description: r.description, originalUrl: r.url, category: r.category, sourceType: "research" }),
                        });
                        const data = await resp.json().catch(() => null);
                        setAchievementData({ title: "Salvo! 🐝", description: data?.message ?? "Adicionado à Lista de Desejos." });
                        setShowAchievement(true);
                        setTimeout(() => setShowAchievement(false), 3000);
                      } catch { /* ignore */ }
                    }}
                  />
                ))}
              </div>
            );
          }

          return baseActions;
        }}
        messageRenderer={(message) => {
          const meta = getMessageMeta(message.metadata);
          if (meta?.type === "sponsored" || meta?.type === "sponsored_group") {
            return (
              <AdMobSmartAdCard
                messageId={message.id}
                meta={meta as SponsoredMessageMeta}
                onHide={(adId) => handleSponsoredHide(message.id, adId)}
                onNotRelevant={() => handleSponsoredNotRelevant(message.id)}
                onReport={() => handleSponsoredReport(message.id)}
              />
            );
          }
          return null;
        }}
        onToggleSettings={() => setShowSettingsScreen(true)}
        onReplyToMessage={(message) => {
          setSelectedReplyMessage(message);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        onCancelReply={() => setSelectedReplyMessage(null)}
        onToggleSearch={() => { setShowMsgSearch((value) => !value); setMsgSearchQuery(""); }}
        onSearchQueryChange={setMsgSearchQuery}
        onScrollStateChange={() => {
          const el = chatScrollRef.current;
          if (!el) return;
          isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          const maxScroll = Math.max(el.scrollHeight - el.clientHeight, 1);
          setEyeScrollProgress(el.scrollTop / maxScroll);
        }}
        onInputChange={handleEyeInputChange}
        onInputFocusChange={handleEyeInputFocusChange}
        onSendMessage={handleSendMessage}
        onSendVoiceMessage={(text) => handleSendMessage(text)}
        onOpenUserProfile={openFriendProfile}
      />

      {/* ── Sidebar — sempre visível no desktop (384px), full-screen em outras tabs no mobile ── */}
      <aside className={`bee-surface beeyes-glass-light dark:beeyes-glass min-h-0 md:m-3 md:ml-0 md:rounded-[1.75rem] overflow-hidden ${
        mobileTab !== "chat"
          ? "flex flex-col flex-1 min-h-0 md:w-[420px] md:flex-none"
          : "hidden md:flex md:w-[420px] md:flex-col"
      }`}>
        {sidebarContent}
      </aside>

      {/* ── Bottom nav (mobile only) ── */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 rounded-[1.75rem] border border-primary/15 bg-card/92 shadow-2xl backdrop-blur-xl z-40 flex overflow-visible beeyes-nav-glass-light dark:beeyes-nav-glass">
        {([
          { tab: "feed",        label: "Feed",        icon: <LayoutGrid    className="w-5 h-5" />, onClick: () => { setShowSettingsScreen(false); setMobileTab("feed"); loadFeed(); } },
          { tab: "colmeia",     label: "Colmeia",     icon: <Hexagon       className="w-5 h-5" />, onClick: () => { setShowSettingsScreen(false); setMobileTab("colmeia"); } },
          { tab: "chat",        label: "Chat",        icon: <MessageCircle className="w-6 h-6" />, onClick: () => { setShowSettingsScreen(false); setMobileTab("chat"); } },
          { tab: "inbox",       label: "Mensagens",   icon: <MessageSquare className="w-5 h-5" />, onClick: () => { setShowSettingsScreen(false); setMobileTab("inbox"); loadDMConversations(); loadConversationSuggestions(); } },
          { tab: "communities", label: "Comunidades", icon: <Users2        className="w-5 h-5" />, onClick: () => { setShowSettingsScreen(false); setMobileTab("communities"); loadCommunities(communitySearch); } },
        ] as const).map(({ tab, label, icon, onClick }) => (
          <button
            key={tab}
            onClick={onClick}
            className={`relative flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${mobileTab === tab ? "text-primary" : "text-muted-foreground"} ${tab === "chat" ? "overflow-visible" : ""}`}
          >
            <span className={`flex items-center justify-center rounded-xl transition-all ${
              tab === "chat"
                ? `-mt-8 h-14 w-14 rounded-full border-[6px] border-background ${mobileTab === tab ? "beeyes-gradient-bg text-white beeyes-glow shadow-xl" : "bg-card text-muted-foreground shadow-lg"}`
                : `h-8 w-10 ${mobileTab === tab ? "beeyes-gradient-bg text-[#1A1A1A] beeyes-glow shadow-sm" : ""}`
            }`}>
              {icon}
            </span>
            <span className="text-[9px] leading-tight w-full text-center px-0.5">{label}</span>
          </button>
        ))}
      </nav>

      {/* Spacer so content doesn't hide behind bottom nav on mobile */}
      <div className="md:hidden h-20 shrink-0" />

      <input
        ref={photoFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleProfileFileChange}
      />
      <input
        ref={feedImageInputRef}
        type="file"
        accept={FEED_IMAGE_ACCEPT}
        className="hidden"
        onChange={handleFeedImageChange}
      />
      <input
        ref={feedCameraInputRef}
        type="file"
        accept={FEED_IMAGE_ACCEPT}
        capture="environment"
        className="hidden"
        onChange={handleFeedImageChange}
      />
      <input
        ref={communityPostImageInputRef}
        type="file"
        accept={FEED_IMAGE_ACCEPT}
        className="hidden"
        onChange={handleCommunityPostImageChange}
      />

      <SettingsScreen
        show={showSettingsScreen}
        user={user}
        profilePhotoUrl={profilePhotoUrl}
        themeMode={themeMode}
        settingsMessage={settingsMessage}
        anonymousProfileVisitsEnabled={Boolean(user?.anonymousProfileVisitsEnabled)}
        allowMessagesFromStrangers={user?.allowMessagesFromStrangers !== false}
        authHeaders={authHeaders}
        onClose={() => setShowSettingsScreen(false)}
        onUserUpdate={setUser}
        onSelectProfilePhoto={handleSelectProfilePhoto}
        onRemoveProfilePhoto={handleRemoveProfilePhoto}
        onThemeSelect={handleThemeSelect}
        onAnonymousProfileVisitsToggle={handleAnonymousProfileVisitsToggle}
        onStrangerMessagesToggle={handleStrangerMessagesToggle}
        onLogout={handleLogout}
      />

      <FriendProfileModal
        open={friendProfileLoading || !!selectedFriend}
        loading={friendProfileLoading}
        selectedFriend={selectedFriend}
        currentUser={user}
        isFriendUser={isFriendUser}
        onClose={() => setSelectedFriend(null)}
        onOpenDMWithUser={openDMWithUser}
        timeAgo={timeAgo}
      />

      <AchievementPopup
        title={achievementData.title}
        description={achievementData.description}
        isVisible={showAchievement}
        onClose={() => setShowAchievement(false)}
      />

      {showDailyBriefing && dailyBriefing && (
        <DailyBriefingModal
          briefing={dailyBriefing}
          userName={user?.displayName || user?.username || ""}
          onStart={dismissDailyBriefing}
          onDismiss={dismissDailyBriefing}
        />
      )}

      <SendToFeedModal
        open={!!draftModal}
        sourceMessageId={draftModal?.messageId ?? null}
        sourceContent={draftModal?.content ?? ""}
        submitting={draftSubmitting}
        onCancel={() => setDraftModal(null)}
        onPublish={publishDraft}
      />

      {feedbackToast ? (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] rounded-xl border shadow-lg px-3 py-2.5 text-xs font-medium backdrop-blur-md ${
            feedbackToast.tone === "success"
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : feedbackToast.tone === "error"
              ? "border-destructive/40 bg-destructive/15 text-destructive"
              : "border-primary/40 bg-primary/15 text-primary"
          }`}
          role="status"
          aria-live="polite"
        >
          {feedbackToast.text}
        </div>
      ) : null}
      {mobileTab === "chat" ? <CasaDaBeeFab /> : null}
    </div>
  );
}
