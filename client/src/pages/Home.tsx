import { useState, useRef, useEffect, useCallback, type ChangeEvent } from "react";
import BeeEyes from "@/components/BeeEyes";
import ChatMessage from "@/components/ChatMessage";
import MissionCard from "@/components/MissionCard";
import XPProgress from "@/components/XPProgress";
import MoodSelector from "@/components/MoodSelector";
import AchievementPopup from "@/components/AchievementPopup";
import StreakDisplay from "@/components/StreakDisplay";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Send, Plus, TrendingUp, MessageCircle, Globe, UserPlus, Heart, Users, X, Flame, Trophy, ChevronRight, Settings, Camera, Moon, Sun, MessageSquare, Users2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { applyTheme, onThemeChange, readTheme, resolveInitialTheme, ThemeMode } from "@/lib/theme";
import FeedPostCard from "@/components/FeedPostCard";
import NewsCard from "@/components/NewsCard";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: string | null;
}

interface Mission {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  completed: boolean;
}

interface User {
  id: string;
  username: string;
  level: number;
  xp: number;
  currentStreak: number;
}

interface FeedPost {
  id: string;
  userId: string;
  content: string;
  sentiment: string | null;
  sentimentLabel: string | null;
  aiComment: string | null;
  createdAt: string;
  author: { id: string; username: string; displayName: string | null; level: number };
  likesCount: number;
  liked: boolean;
}

interface ConnectionSuggestion {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
  commonInterests: string[];
}

interface Friend {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
  currentStreak: number;
  lastActiveAt: string | null;
  personality: { interests: string } | null;
}

interface SearchUser {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
  currentStreak: number;
  connectionStatus: "none" | "pending" | "accepted";
}

interface FriendProfile {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    level: number;
    xp: number;
    currentStreak: number;
    lastActiveAt: string | null;
  };
  recentPosts: FeedPost[];
  interests: string[];
  activeMissionsCount: number;
}

interface Community {
  id: string;
  name: string;
  description: string | null;
  category: string;
  emoji: string;
  ownerId: string;
  membersCount: number;
  createdAt: string;
  isMember?: boolean;
  memberRole?: string;
}

interface CommunityPost {
  id: string;
  communityId: string;
  userId: string;
  content: string;
  createdAt: string;
  username: string;
  displayName: string | null;
}

interface DMConversation {
  user: { id: string; username: string; displayName: string | null; level: number };
  lastMessage: string;
  lastMessageAt: string;
  lastMessageFromMe: boolean;
  unreadCount: number;
}

interface DMMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
}

interface NewsItem {
  title: string;
  link: string;
  source: string;
}

interface ChatFeedSummaryPost {
  id: string;
  content: string;
  createdAt: string;
  likesCount: number;
  liked: boolean;
  commentsCount: number;
  aiComment?: string | null;
  sentimentLabel?: string | null;
  sentiment?: string | null;
  author: { id: string; username: string; displayName: string | null; level: number };
}

interface NetworkDigestMeta {
  type: "network_digest";
  query: string;
  newsItems: NewsItem[];
  feedPosts: ChatFeedSummaryPost[];
  suggestions: ConnectionSuggestion[];
}

const SENTIMENT_EMOJI: Record<string, string> = {
  happy: "😊", motivated: "💪", tired: "😴", sad: "💙",
  neutral: "😐", excited: "🎉", proud: "🏆",
};

// Simple token storage
const getToken = () => localStorage.getItem("bee_token");
const setToken = (t: string) => localStorage.setItem("bee_token", t);
const clearToken = () => localStorage.removeItem("bee_token");
const getProfilePhoto = () => localStorage.getItem("bee_profile_photo");
const setProfilePhoto = (url: string) => localStorage.setItem("bee_profile_photo", url);
const clearProfilePhoto = () => localStorage.removeItem("bee_profile_photo");

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function Home() {
  const [token, setTokenState] = useState<string | null>(getToken);
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [eyeExpression, setEyeExpression] = useState<any>("neutral");
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [showAchievement, setShowAchievement] = useState(false);
  const [achievementData, setAchievementData] = useState({ title: "", description: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [mobileTab, setMobileTab] = useState<"chat" | "missions" | "friends" | "inbox" | "communities">("chat");
  const [showSettingsScreen, setShowSettingsScreen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");

  // Feed state
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [postText, setPostText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [showPostInput, setShowPostInput] = useState(false);
  const [suggestions, setSuggestions] = useState<ConnectionSuggestion[]>([]);
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set());

  // Friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [friendProfileLoading, setFriendProfileLoading] = useState(false);

  // Communities state
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communitySearch, setCommunitySearch] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState<(Community & { isMember: boolean; memberRole?: string }) | null>(null);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityPostsLoading, setCommunityPostsLoading] = useState(false);
  const [communityPostInput, setCommunityPostInput] = useState("");
  const [communityPostSending, setCommunityPostSending] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [newCommunity, setNewCommunity] = useState({ name: "", description: "", category: "geral", emoji: "🐝" });
  const [creatingCommunity, setCreatingCommunity] = useState(false);
  const [communityJoining, setCommunityJoining] = useState<string | null>(null);
  const [friendSearch, setFriendSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchConnecting, setSearchConnecting] = useState<Set<string>>(new Set());

  // Direct messages state
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([]);
  const [dmLoading, setDmLoading] = useState(false);
  const [selectedDMUser, setSelectedDMUser] = useState<{ id: string; username: string; displayName: string | null; level: number } | null>(null);
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const [processingConnectionRequestId, setProcessingConnectionRequestId] = useState<string | null>(null);

  // Auth form state
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authGender, setAuthGender] = useState("");
  const [authError, setAuthError] = useState("");
  const [authShowPassword, setAuthShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

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
    fetch("/api/me", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then(setUser)
      .catch(() => { clearToken(); setTokenState(null); });

    fetch("/api/messages?limit=50", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then((msgs: any[]) =>
        setMessages(
          msgs.map((m) => ({
            ...m,
            metadata: m.metadata ?? null,
            timestamp: new Date(m.createdAt),
          })),
        ),
      );

    fetch("/api/missions?completed=false", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then(setMissions);
  }, [token]);

  // Load friends list
  const loadFriends = useCallback(async () => {
    if (!token) return;
    setFriendsLoading(true);
    try {
      const res = await fetch("/api/friends", { headers: authHeaders() });
      if (res.ok) setFriends(await res.json());
    } catch { /* ignore */ }
    finally { setFriendsLoading(false); }
  }, [token]);

  const loadDMConversations = useCallback(async () => {
    if (!token) return;
    setDmLoading(true);
    try {
      const res = await fetch("/api/dm/conversations", { headers: authHeaders() });
      if (res.ok) {
        const list: DMConversation[] = await res.json();
        setDmConversations(list);
      }
    } catch {
      // ignore
    } finally {
      setDmLoading(false);
    }
  }, [token]);

  const openDMThread = useCallback(async (target: { id: string; username: string; displayName: string | null; level: number }) => {
    setSelectedDMUser(target);
    try {
      const res = await fetch(`/api/dm/${target.id}`, { headers: authHeaders() });
      if (res.ok) {
        const data: DMMessage[] = await res.json();
        setDmMessages(data);
      } else {
        setDmMessages([]);
      }
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
      const res = await fetch(`/api/dm/${selectedDMUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Falha ao enviar");
      const created: DMMessage = await res.json();
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

  const openDMWithUser = useCallback((target: { id: string; username: string; displayName: string | null; level: number }) => {
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
        setSelectedFriend({ user: { id: friendId, username: "—", displayName: null, level: 1, xp: 0, currentStreak: 0, lastActiveAt: null }, recentPosts: [], interests: [], activeMissionsCount: 0 });
      }
    } catch {
      setSelectedFriend({ user: { id: friendId, username: "—", displayName: null, level: 1, xp: 0, currentStreak: 0, lastActiveAt: null }, recentPosts: [], interests: [], activeMissionsCount: 0 });
    } finally {
      setFriendProfileLoading(false);
    }
  };

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleFriendSearch = (q: string) => {
    setFriendSearch(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
        if (res.ok) setSearchResults(await res.json());
      } catch { /* ignore */ }
      finally { setSearchLoading(false); }
    }, 350);
  };

  const handleSearchConnect = async (targetUserId: string) => {
    if (searchConnecting.has(targetUserId)) return;
    setSearchConnecting((prev) => new Set(prev).add(targetUserId));
    try {
      await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ targetUserId }),
      });
      setSearchResults((prev) =>
        prev.map((u) => u.id === targetUserId ? { ...u, connectionStatus: "pending" as const } : u)
      );
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

      if (decision === "accept") {
        loadFriends();
      }

      const resolvedContent =
        decision === "accept"
          ? "Solicitacao aceita. Agora voces podem conversar em Mensagens."
          : "Solicitacao recusada.";
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
    } finally {
      setProcessingConnectionRequestId(null);
    }
  };

  // Load feed when user switches to feed tab
  const loadFeed = useCallback(async () => {
    if (!token) return;
    setFeedLoading(true);
    try {
      const [feedRes, suggestionsRes] = await Promise.all([
        fetch("/api/feed", { headers: authHeaders() }),
        fetch("/api/connections/suggestions?limit=3", { headers: authHeaders() }),
      ]);
      if (feedRes.ok) setFeed(await feedRes.json());
      if (suggestionsRes.ok) setSuggestions(await suggestionsRes.json());
    } catch { /* ignore */ }
    finally { setFeedLoading(false); }
  }, [token]);

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
      if (cRes.ok) setSelectedCommunity(await cRes.json());
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
        setCommunities((prev) => prev.map((c) => c.id === communityId ? { ...c, isMember: true, membersCount: c.membersCount + 1 } : c));
        if (selectedCommunity?.id === communityId) setSelectedCommunity((prev) => prev ? { ...prev, isMember: true, memberRole: "member" } : prev);
      }
    } finally {
      setCommunityJoining(null);
    }
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
    if (!communityPostInput.trim() || !selectedCommunity || communityPostSending) return;
    setCommunityPostSending(true);
    try {
      const res = await fetch(`/api/communities/${selectedCommunity.id}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: communityPostInput.trim() }),
      });
      if (res.ok) {
        const post = await res.json();
        setCommunityPosts((prev) => [post, ...prev]);
        setCommunityPostInput("");
      }
    } finally {
      setCommunityPostSending(false);
    }
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
        setNewCommunity({ name: "", description: "", category: "geral", emoji: "🐝" });
      }
    } finally {
      setCreatingCommunity(false);
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
    if (mobileTab === "friends") loadFriends();
    if (mobileTab === "inbox") {
      loadDMConversations();
      loadConversationSuggestions();
    }
    if (mobileTab === "communities") {
      loadCommunities(communitySearch);
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

  // Proactive messages polling
  useEffect(() => {
    if (!token) return;
    const poll = async () => {
      try {
        const res = await fetch("/api/proactive", { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: "assistant",
            content: data.message,
            timestamp: new Date(),
          }]);
          setEyeExpression("happy");
          setTimeout(() => setEyeExpression("neutral"), 4000);
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(poll, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    handleAutomaticNetworkDigest();
    const interval = setInterval(handleAutomaticNetworkDigest, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

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
    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    const name = data.user.displayName || data.user.username;
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: `Olá ${name}! Eu sou a BeeEyes 🐝, sua melhor amiga AI. Como posso te ajudar hoje?`,
      timestamp: new Date(),
    }]);
  };

  const handleAuth = async () => {
    setAuthError("");
    setAuthLoading(true);
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    try {
      const body: any = { username: authUsername, password: authPassword };
      if (authMode === "register") {
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
    if (pw.length < 6) return { label: "Fraca", color: "#E53E3E", w: "25%" };
    if (pw.length < 10) return { label: "Média", color: "#F5A623", w: "55%" };
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) return { label: "Forte", color: "#4CAF50", w: "100%" };
    return { label: "Boa", color: "#4CAF50", w: "80%" };
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !token) return;

    const content = inputValue.trim();
    const slashCommand = content.toLowerCase();
    const userMsg: Message = { id: Date.now().toString(), role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    if (slashCommand === "/feed") {
      handleFeedCommand();
      return;
    }
    if (slashCommand === "/missões" || slashCommand === "/missoes") {
      handleMissionsCommand();
      return;
    }
    if (slashCommand === "/notícias" || slashCommand === "/noticias") {
      handleNewsCommand();
      return;
    }
    if (slashCommand === "/compartilhar") {
      handleShareCommand();
      return;
    }

    setEyeExpression("curious");
    setIsLoading(true);
    setStreamingText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setMessages((prev) => [...prev, {
          id: Date.now().toString(),
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
        }]);
        setEyeExpression("neutral");
        setIsLoading(false);
        return;
      }

      if (!res.ok) throw new Error("Erro na resposta");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let assistantMsgId = (Date.now() + 1).toString();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "chunk") {
              accumulated += event.text;
              setStreamingText(accumulated);
              setEyeExpression("happy");
            } else if (event.type === "done") {
              setMessages((prev) => [...prev, {
                id: assistantMsgId,
                role: "assistant",
                content: event.cleanText ?? accumulated,
                timestamp: new Date(),
              }]);
              setStreamingText("");
              setEyeExpression("happy");
              fetch("/api/me", { headers: authHeaders() })
                .then((r) => r.json()).then(setUser).catch(() => {});
            } else if (event.type === "mission_created") {
              setMissions((prev) => [...prev, event.mission]);
            } else if (event.type === "achievement_unlocked") {
              setAchievementData({ title: event.achievement.title, description: event.achievement.description });
              setShowAchievement(true);
              setEyeExpression("celebrating");
              setTimeout(() => { setShowAchievement(false); setEyeExpression("happy"); }, 4000);
            } else if (event.type === "error") {
              setStreamingText("");
              setMessages((prev) => [...prev, {
                id: assistantMsgId,
                role: "assistant",
                content: "Desculpe, ocorreu um erro. Tente novamente.",
                timestamp: new Date(),
              }]);
            }
          } catch { /* skip malformed lines */ }
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
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleLogout = () => {
    clearToken();
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
        setSettingsMessage("Nao foi possivel processar a imagem.");
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
          setSettingsMessage("Nao foi possivel preparar a imagem.");
          return;
        }

        ctx.drawImage(image, sx, sy, side, side, 0, 0, targetSize, targetSize);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);

        setProfilePhoto(compressedDataUrl);
        setProfilePhotoUrl(compressedDataUrl);
        setSettingsMessage("Foto atualizada com recorte e compressao.");
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
    setSettingsMessage("Foto de perfil removida.");
  };

  const handleThemeSelect = (mode: ThemeMode) => {
    applyTheme(mode);
    setThemeMode(readTheme());
    setSettingsMessage(`Tema ${mode === "dark" ? "escuro" : "claro"} aplicado.`);
  };

  const handleToggleMission = async (id: string) => {
    const mission = missions.find((m) => m.id === id);
    if (!mission || mission.completed) return;
    try {
      const res = await fetch(`/api/missions/${id}/complete`, {
        method: "PUT",
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setMissions((prev) => prev.map((m) => m.id === id ? { ...m, completed: true } : m));
      if (data.user) setUser(data.user);
      setEyeExpression("celebrating");
      setAchievementData({ title: "Missão Completa!", description: `+${mission.xpReward} XP ganhos!` });
      setShowAchievement(true);
      setTimeout(() => { setEyeExpression("happy"); setShowAchievement(false); }, 4000);
    } catch { /* ignore */ }
  };

  const handleDeleteMission = async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/missions/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) return;
      setMissions((prev) => prev.filter((m) => m.id !== id));

      setEyeExpression("curious");
      setIsLoading(true);
      setStreamingText("");

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: `[SISTEMA] O usuário acabou de desistir e deletar a missão "${title}". Faça uma piada curta e bem-humorada sobre ele ter desistido, sem julgá-lo de verdade. Tom leve e carinhoso.`, isSystem: true }),
      });

      if (!chatRes.ok) { setIsLoading(false); return; }

      const reader = chatRes.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      const msgId = Date.now().toString();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "chunk") { accumulated += event.text; setStreamingText(accumulated); setEyeExpression("happy"); }
            else if (event.type === "done") {
              setMessages((prev) => [...prev, { id: msgId, role: "assistant", content: event.cleanText ?? accumulated, timestamp: new Date() }]);
              setStreamingText("");
              setEyeExpression("happy");
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  const handleMoodSelect = (mood: number) => {
    setSelectedMood(mood);
    if (mood >= 4) setEyeExpression("excited");
    else if (mood <= 2) setEyeExpression("curious");
    else setEyeExpression("neutral");
  };

  const handleCreatePost = async () => {
    if (!postText.trim() || isPosting) return;
    setIsPosting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: postText.trim() }),
      });
      if (!res.ok) return;
      const newPost = await res.json();
      // Optimistic update: prepend immediately, AI comment arrives on next refresh
      setFeed((prev) => [{
        ...newPost,
        author: { id: user!.id, username: user!.username, displayName: null, level: user!.level },
        likesCount: 0,
        liked: false,
      }, ...prev]);
      setPostText("");
      setShowPostInput(false);
      // Reload in background to get AI comment
      setTimeout(loadFeed, 3000);
    } catch { /* ignore */ }
    finally { setIsPosting(false); }
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
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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

  const handleFeedCommand = async () => {
    injectAssistantMessage("Carregando o feed dos seus amigos... 📣");
    try {
      const res = await fetch("/api/feed", { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const posts = await res.json();
      setFeed(posts);
      if (posts.length === 0) {
        injectAssistantMessage("Seu feed está vazio. Conecte-se com mais pessoas para ver as novidades delas!");
        return;
      }
      injectAssistantMessage(`📣 Feed dos seus amigos — ${posts.length} publicações recentes`, { type: "feed_summary", posts: posts.slice(0, 5) });
    } catch {
      injectAssistantMessage("Não consegui carregar o feed agora.");
    }
  };

  const handleMissionsCommand = () => {
    const active = missions.filter((m) => !m.completed);
    const done = missions.filter((m) => m.completed);
    if (missions.length === 0) {
      injectAssistantMessage("Você ainda não tem missões. Crie uma na aba Missões ou me peça uma sugestão!");
      return;
    }
    const lines = [
      `🎯 Suas missões (${active.length} ativas, ${done.length} concluídas):`,
      ...active.map((m) => `▸ ${m.title} — ${m.xpReward} XP`),
      ...(done.length > 0 ? [`\n✅ Concluídas: ${done.map((m) => m.title).join(", ")}`] : []),
    ];
    injectAssistantMessage(lines.join("\n"));
  };

  const [showInlinePost, setShowInlinePost] = useState(false);

  const handleShareCommand = () => {
    setShowInlinePost((v) => !v);
  };

  async function handleAutomaticNetworkDigest() {
    if (!token) return;

    try {
      const [newsRes, feedRes, suggestionsRes] = await Promise.all([
        fetch("/api/news", { headers: authHeaders() }),
        fetch("/api/feed?limit=5", { headers: authHeaders() }),
        fetch("/api/connections/suggestions?limit=3", { headers: authHeaders() }),
      ]);

      const newsData = newsRes.ok ? await newsRes.json() : { items: [], query: "seus interesses" };
      const feedPosts = feedRes.ok ? await feedRes.json() : [];
      const suggestedConnections = suggestionsRes.ok ? await suggestionsRes.json() : [];

      setFeed(feedPosts);
      setSuggestions(suggestedConnections);

      const hasNews = Array.isArray(newsData.items) && newsData.items.length > 0;
      const hasFeed = Array.isArray(feedPosts) && feedPosts.length > 0;
      const hasSuggestions = Array.isArray(suggestedConnections) && suggestedConnections.length > 0;

      if (!hasNews && !hasFeed && !hasSuggestions) return;

      const content = [
        "Olha o que você perde.",
        hasFeed ? `Tem ${feedPosts.length} atualização${feedPosts.length > 1 ? "ões" : ""} no seu feed.` : null,
        hasNews ? `Separei notícias sobre ${newsData.query}.` : null,
        hasSuggestions ? `Também achei ${suggestedConnections.length} sugest${suggestedConnections.length > 1 ? "ões" : "ão"} de conexão.` : null,
      ].filter(Boolean).join(" ");

      injectAssistantMessage(content, {
        type: "network_digest",
        query: newsData.query || "seus interesses",
        newsItems: hasNews ? newsData.items.slice(0, 3) : [],
        feedPosts: hasFeed ? feedPosts.slice(0, 3) : [],
        suggestions: hasSuggestions ? suggestedConnections.slice(0, 3) : [],
      } satisfies NetworkDigestMeta);

      setEyeExpression("happy");
      setTimeout(() => setEyeExpression("neutral"), 4000);
    } catch {
      // ignore automatic digest failures
    }
  }

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
      <div className="flex h-screen overflow-hidden bg-white">

        {/* ── Left hero (desktop only) ── */}
        <div className="hidden md:flex md:w-[42%] flex-col items-center justify-center relative overflow-hidden"
          style={{ background: "linear-gradient(160deg, #FFF8E7 0%, #FFE566 50%, #F5C842 100%)" }}>
          <svg className="absolute top-0 right-0 opacity-10" width={200} height={200} viewBox="0 0 200 200">
            <path d="M50 10 L90 10 L110 45 L90 80 L50 80 L30 45 Z" fill="#D4A017" />
            <path d="M110 60 L150 60 L170 95 L150 130 L110 130 L90 95 Z" fill="#D4A017" />
            <path d="M20 110 L60 110 L80 145 L60 180 L20 180 L0 145 Z" fill="#D4A017" />
          </svg>
          <svg className="absolute bottom-0 left-0 opacity-10" width={160} height={160} viewBox="0 0 160 160">
            <path d="M60 10 L100 10 L120 45 L100 80 L60 80 L40 45 Z" fill="#D4A017" />
            <path d="M10 70 L50 70 L70 105 L50 140 L10 140 L-10 105 Z" fill="#D4A017" />
          </svg>

          <motion.div animate={{ y: [-12, 0, -12] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}>
            <BeeEyes expression={authMode === "register" ? "excited" : "happy"} />
          </motion.div>

          <motion.div className="text-center mt-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">bee-eyes</h1>
            <p className="text-sm mt-2 font-medium" style={{ color: "#7A5500" }}>
              {authMode === "register" ? "Comece sua jornada hoje 🚀" : "Sua melhor amiga com IA 🐝"}
            </p>
          </motion.div>

          <motion.div className="flex gap-2 mt-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            {["Chat inteligente", "Feed social", "Missões diárias"].map((f) => (
              <span key={f} className="text-xs px-3 py-1 rounded-full bg-black/10 text-gray-800 font-medium">{f}</span>
            ))}
          </motion.div>
        </div>

        {/* ── Right form ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-y-auto bg-white">
          <motion.div className="md:hidden mb-6" animate={{ y: [-8, 0, -8] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <BeeEyes expression={authMode === "register" ? "excited" : "happy"} />
            <p className="text-center text-lg font-black text-gray-900 mt-3">bee-eyes</p>
          </motion.div>

          <motion.div
            key={authMode}
            className="w-full max-w-sm"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-7">
              <h2 className="text-2xl font-black text-gray-900">
                {authMode === "login" ? "Olá de novo! 👋" : "Criar conta 🎉"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {authMode === "login" ? "Entre para continuar sua jornada" : "É rápido, grátis e a BeeEyes te espera!"}
              </p>
            </div>

            {/* Social buttons */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                disabled={googleLoading}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
                onClick={handleGoogleLogin}
              >
                {googleLoading ? (
                  <span className="text-xs text-gray-500">Aguarde...</span>
                ) : (
                  <>
                    <svg width={18} height={18} viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                  </>
                )}
              </button>
              <button
                disabled
                className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-400 cursor-not-allowed opacity-50"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Apple
              </button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">ou com e-mail</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="space-y-4 mb-6">
              {authMode === "register" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nome de exibição (opcional)</label>
                    <Input
                      placeholder="Como você quer ser chamado?"
                      value={authDisplayName}
                      onChange={(e) => setAuthDisplayName(e.target.value)}
                      className="h-12 rounded-xl border-2 border-gray-200 focus:border-yellow-400 bg-gray-50 text-base"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Gênero (opcional)</label>
                    <select
                      value={authGender}
                      onChange={(e) => setAuthGender(e.target.value)}
                      className="w-full h-12 px-3 rounded-xl border-2 border-gray-200 focus:border-yellow-400 bg-gray-50 text-base text-gray-800 outline-none"
                    >
                      <option value="">Prefiro não informar</option>
                      <option value="masculino">Masculino</option>
                      <option value="feminino">Feminino</option>
                      <option value="nao-binario">Não-binário</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Usuário</label>
                <Input
                  placeholder="seu_usuario"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                  className="h-12 rounded-xl border-2 border-gray-200 focus:border-yellow-400 bg-gray-50 text-base"
                  autoCapitalize="none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Senha</label>
                <div className="relative">
                  <Input
                    type={authShowPassword ? "text" : "password"}
                    placeholder={authMode === "register" ? "mínimo 6 caracteres" : "••••••••"}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                    className="h-12 rounded-xl border-2 border-gray-200 focus:border-yellow-400 bg-gray-50 text-base pr-12"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => setAuthShowPassword(!authShowPassword)}
                  >
                    {authShowPassword ? (
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22" strokeLinecap="round"/></svg>
                    ) : (
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx={12} cy={12} r={3}/></svg>
                    )}
                  </button>
                </div>
                {strength && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-1 rounded-full transition-all duration-300" style={{ width: strength.w, backgroundColor: strength.color }} />
                    </div>
                    <span className="text-xs font-semibold" style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                )}
              </div>
            </div>

            {authError && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-destructive mb-4 text-center bg-red-50 py-2 px-3 rounded-lg">
                {authError}
              </motion.p>
            )}

            <button
              onClick={handleAuth}
              disabled={authLoading}
              className="w-full h-13 py-4 rounded-xl font-black text-gray-900 text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-yellow-200"
              style={{ background: "linear-gradient(90deg, #FFD700, #F5C842, #E8B800)" }}
            >
              {authLoading ? "Aguarde..." : authMode === "login" ? "Entrar  →" : "Criar conta  🐝"}
            </button>

            {authMode === "register" && (
              <p className="text-center text-xs text-muted-foreground mt-3">
                Ao criar uma conta você concorda com os{" "}
                <span className="text-yellow-600 font-semibold cursor-pointer hover:underline">Termos de Uso</span>
              </p>
            )}

            <button
              className="w-full mt-5 text-sm text-muted-foreground hover:text-gray-800 transition-colors"
              onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); setAuthPassword(""); setAuthDisplayName(""); setAuthGender(""); }}
            >
              {authMode === "login"
                ? <>Não tem conta? <span className="font-bold text-yellow-600">Criar conta ↗</span></>
                : <>Já tem conta? <span className="font-bold text-yellow-600">Entrar ↗</span></>
              }
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <>
      <div className="p-4 border-b">
        {user && <XPProgress currentXP={user.xp} level={user.level} xpToNextLevel={500} />}
      </div>

      <Tabs
        value={mobileTab === "chat" ? "missions" : mobileTab}
        className="flex-1 flex flex-col min-h-0"
        onValueChange={(v) => {
          setMobileTab(v as any);
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
        <TabsList className="mx-2 mt-3 md:flex hidden gap-0.5">
          <TabsTrigger value="missions" className="flex-1 flex-col gap-0.5 py-2 px-1 h-auto">
            <TrendingUp className="w-4 h-4" />
            <span className="text-[10px] leading-tight">Missões</span>
          </TabsTrigger>
          <TabsTrigger value="friends" className="flex-1 flex-col gap-0.5 py-2 px-1 h-auto">
            <Users className="w-4 h-4" />
            <span className="text-[10px] leading-tight">Amigos</span>
          </TabsTrigger>
          <TabsTrigger value="inbox" className="flex-1 flex-col gap-0.5 py-2 px-1 h-auto">
            <MessageSquare className="w-4 h-4" />
            <span className="text-[10px] leading-tight">Mensagens</span>
          </TabsTrigger>
          <TabsTrigger value="communities" className="flex-1 flex-col gap-0.5 py-2 px-1 h-auto">
            <Users2 className="w-4 h-4" />
            <span className="text-[10px] leading-tight">Comunidades</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="missions" className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3 mt-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Missões</h2>
            <Button size="sm" variant="outline" data-testid="button-add-mission">
              <Plus className="w-4 h-4 mr-1" />
              Nova
            </Button>
          </div>
          <AnimatePresence mode="popLayout">
            {missions.map((mission) => (
              <MissionCard
                key={mission.id}
                id={mission.id}
                title={mission.title}
                description={mission.description}
                xpReward={mission.xpReward}
                completed={mission.completed}
                onToggle={handleToggleMission}
                onDelete={handleDeleteMission}
              />
            ))}
            {missions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma missão ainda. Peça ao BeeEyes para criar uma! 🐝
              </p>
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="friends" className="flex-1 overflow-y-auto min-h-0 p-4 mt-0">
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Amigos</h2>

            {/* Search bar */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Buscar pessoas no BeeEyes..."
                value={friendSearch}
                onChange={(e) => handleFriendSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Search results */}
            {friendSearch.trim() && (
              <div className="space-y-2">
                {searchResults.length === 0 && !searchLoading && (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhum usuário encontrado.</p>
                )}
                {searchResults.map((u) => {
                  const name = u.displayName || u.username;
                  return (
                    <Card key={u.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <button className="flex-1 flex items-center gap-3 text-left" onClick={() => openFriendProfile(u.id)}>
                          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold shrink-0">
                            {name[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold truncate">{name}</span>
                              <span className="text-xs text-muted-foreground bg-secondary rounded px-1 shrink-0">Nv {u.level}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">@{u.username}</span>
                          </div>
                        </button>
                        {u.connectionStatus === "accepted" ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-green-600 font-semibold">Amigos</span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2"
                              onClick={() => openDMWithUser({ id: u.id, username: u.username, displayName: u.displayName, level: u.level })}
                            >
                              Enviar mensagem
                            </Button>
                          </div>
                        ) : u.connectionStatus === "pending" ? (
                          <span className="text-xs text-muted-foreground shrink-0">Pendente</span>
                        ) : (
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2 shrink-0"
                            onClick={() => handleSearchConnect(u.id)}
                            disabled={searchConnecting.has(u.id)}>
                            <UserPlus className="w-3 h-3 mr-1" />Conectar
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Friends list (only when not searching) */}
            {!friendSearch.trim() && (
              <>
                {friendsLoading && (
                  <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
                )}
                {!friendsLoading && friends.length === 0 && (
                  <div className="text-center py-8 space-y-2">
                    <p className="text-3xl">👥</p>
                    <p className="text-sm font-semibold">Nenhum amigo ainda</p>
                    <p className="text-xs text-muted-foreground">Use a busca para encontrar pessoas!</p>
                  </div>
                )}
                {friends.map((friend) => {
                  const name = friend.displayName || friend.username;
                  const interests: string[] = (() => { try { return JSON.parse(friend.personality?.interests || "[]"); } catch { return []; } })();
                  const lastActive = friend.lastActiveAt ? timeAgo(friend.lastActiveAt) : null;
                  return (
                    <Card key={friend.id} className="p-3 hover:border-primary/50 transition-colors group">
                      <div className="w-full text-left cursor-pointer" onClick={() => openFriendProfile(friend.id)}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-base font-bold shrink-0">
                            {name[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{name}</span>
                              <span className="text-xs text-muted-foreground bg-secondary rounded px-1">Nv {friend.level}</span>
                              {friend.currentStreak > 0 && (
                                <span className="text-xs text-orange-500 flex items-center gap-0.5">
                                  <Flame className="w-3 h-3" />{friend.currentStreak}d
                                </span>
                              )}
                            </div>
                            {interests.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate">{interests.slice(0, 3).join(" · ")}</p>
                            )}
                            {lastActive && (
                              <p className="text-xs text-muted-foreground">Ativo {lastActive}</p>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 px-3"
                          onClick={() =>
                            openDMWithUser({
                              id: friend.id,
                              username: friend.username,
                              displayName: friend.displayName,
                              level: friend.level,
                            })
                          }
                        >
                          Enviar mensagem
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        </TabsContent>


        <TabsContent value="inbox" className="flex-1 overflow-hidden min-h-0 p-0 mt-0">
          <div className="h-full flex min-h-0 overflow-hidden">
            <div
              className={`${
                selectedDMUser ? "hidden md:flex md:w-[360px] lg:w-[400px]" : "flex w-full md:w-[360px] lg:w-[400px]"
              } flex-col border-r min-h-0 bg-card/20`}
            >
              <div className="p-3 border-b">
                <h2 className="font-display text-lg font-semibold">Mensagens</h2>
                <p className="text-xs text-muted-foreground">Converse com amigos conectados e pessoas com interesses em comum.</p>
              </div>

              <div className="p-3 border-b space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Pessoas para conversar</p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {suggestions.slice(0, 5).map((s) => (
                    <button
                      key={`sug-${s.id}`}
                      onClick={() => openDMThread({ id: s.id, username: s.username, displayName: s.displayName, level: s.level })}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-secondary/50 transition-colors flex items-center gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                        {(s.displayName || s.username)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{s.displayName || s.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.commonInterests.slice(0, 2).join(" · ") || "Novo contato"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {dmLoading && <p className="text-xs text-muted-foreground text-center py-4">Carregando conversas...</p>}
                {!dmLoading && dmConversations.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Ainda nao ha conversas. Inicie uma nova conversa acima.</p>
                )}
                {dmConversations.map((c) => {
                  const name = c.user.displayName || c.user.username;
                  return (
                    <button
                      key={c.user.id}
                      onClick={() => openDMThread(c.user)}
                      className={`w-full text-left p-2 rounded-xl transition-colors ${selectedDMUser?.id === c.user.id ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/50"}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-xs font-black text-primary-foreground">
                          {name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold truncate">{name}</p>
                            {c.unreadCount > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">{c.unreadCount}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.lastMessageFromMe ? "Voce: " : ""}{c.lastMessage}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`flex-1 min-w-0 ${selectedDMUser ? "flex" : "hidden md:flex"} flex-col min-h-0`}>
              {selectedDMUser ? (
                <>
                  <div className="p-3 border-b flex items-center gap-2 bg-card/40">
                    <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setSelectedDMUser(null)}>
                      Voltar
                    </Button>
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                      {(selectedDMUser.displayName || selectedDMUser.username)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{selectedDMUser.displayName || selectedDMUser.username}</p>
                      <p className="text-xs text-muted-foreground">Nivel {selectedDMUser.level}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {dmMessages.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">Envie a primeira mensagem desta conversa.</p>
                    )}
                    {dmMessages.map((m) => {
                      const fromMe = m.senderId === user?.id;
                      return (
                        <div key={m.id} className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${fromMe ? "bg-primary text-primary-foreground" : "bg-secondary/70"}`}>
                            {m.content}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3 border-t flex items-end gap-2 bg-card/40">
                    <Textarea
                      value={dmInput}
                      onChange={(e) => setDmInput(e.target.value)}
                      rows={2}
                      placeholder="Mensagem..."
                      className="flex-1 resize-none text-sm min-h-[52px] max-h-40"
                      maxLength={1500}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendDMMessage();
                        }
                      }}
                    />
                    <Button onClick={sendDMMessage} disabled={!dmInput.trim() || dmSending}>
                      Enviar
                    </Button>
                  </div>
                </>
              ) : (
                <div className="hidden md:flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Selecione uma conversa para começar.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="communities" className="flex-1 overflow-y-auto p-0 m-0 relative">
          {/* Community detail overlay */}
          {(communityPostsLoading || selectedCommunity) && (
            <div className="absolute inset-0 z-20 bg-background overflow-y-auto">
              <div className="sticky top-0 z-10 bg-background border-b border-border/40 px-4 py-3 flex items-center gap-3">
                <button onClick={() => setSelectedCommunity(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
                {selectedCommunity && (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-2xl">{selectedCommunity.emoji}</span>
                    <div>
                      <h2 className="font-bold text-sm">{selectedCommunity.name}</h2>
                      <p className="text-xs text-muted-foreground">{selectedCommunity.membersCount} membros</p>
                    </div>
                    <div className="ml-auto">
                      {selectedCommunity.memberRole === "owner" ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">Fundador</span>
                      ) : selectedCommunity.isMember ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={communityJoining === selectedCommunity.id} onClick={() => handleLeaveCommunity(selectedCommunity.id)}>Sair</Button>
                      ) : (
                        <Button size="sm" className="h-7 text-xs" disabled={communityJoining === selectedCommunity.id} onClick={() => handleJoinCommunity(selectedCommunity.id)}>Entrar</Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {communityPostsLoading && (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                </div>
              )}

              {selectedCommunity && !communityPostsLoading && (
                <div className="p-4 space-y-4">
                  {selectedCommunity.description && (
                    <p className="text-sm text-muted-foreground bg-secondary/30 rounded-xl px-4 py-3">{selectedCommunity.description}</p>
                  )}

                  {/* Post input */}
                  {selectedCommunity.isMember && (
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Escreva algo para a comunidade..."
                        className="text-sm resize-none min-h-[60px]"
                        value={communityPostInput}
                        onChange={(e) => setCommunityPostInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendCommunityPost(); } }}
                      />
                      <Button size="sm" className="self-end h-9 px-3" disabled={!communityPostInput.trim() || communityPostSending} onClick={handleSendCommunityPost}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Posts */}
                  <div className="space-y-3">
                    {communityPosts.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">Nenhuma publicação ainda. Seja o primeiro!</p>
                    )}
                    {communityPosts.map((post) => (
                      <div key={post.id} className="bg-secondary/30 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                            {(post.displayName || post.username)[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{post.displayName || post.username}</p>
                            <p className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed">{post.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Create community modal */}
          {showCreateCommunity && (
            <div className="absolute inset-0 z-30 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">Nova Comunidade</h3>
                  <button onClick={() => setShowCreateCommunity(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input placeholder="Emoji" className="w-16 text-center text-xl" value={newCommunity.emoji} onChange={(e) => setNewCommunity((p) => ({ ...p, emoji: e.target.value }))} maxLength={2} />
                    <Input placeholder="Nome da comunidade *" className="flex-1" value={newCommunity.name} onChange={(e) => setNewCommunity((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <Textarea placeholder="Descrição (opcional)" className="resize-none text-sm" rows={3} value={newCommunity.description} onChange={(e) => setNewCommunity((p) => ({ ...p, description: e.target.value }))} />
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={newCommunity.category} onChange={(e) => setNewCommunity((p) => ({ ...p, category: e.target.value }))}>
                    <option value="geral">Geral</option>
                    <option value="tecnologia">Tecnologia</option>
                    <option value="música">Música</option>
                    <option value="esportes">Esportes</option>
                    <option value="jogos">Jogos</option>
                    <option value="arte">Arte</option>
                    <option value="cinema">Cinema & Séries</option>
                    <option value="livros">Livros</option>
                    <option value="culinária">Culinária</option>
                    <option value="viagens">Viagens</option>
                    <option value="saúde">Saúde & Bem-estar</option>
                    <option value="humor">Humor</option>
                  </select>
                </div>
                <Button className="w-full" disabled={!newCommunity.name.trim() || creatingCommunity} onClick={handleCreateCommunity}>
                  {creatingCommunity ? "Criando..." : "Criar Comunidade"}
                </Button>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b border-border/40 px-4 py-3 flex items-center gap-2">
            <Input
              placeholder="Buscar comunidades..."
              className="flex-1 h-8 text-sm"
              value={communitySearch}
              onChange={(e) => { setCommunitySearch(e.target.value); loadCommunities(e.target.value); }}
            />
            <Button size="sm" className="h-8 px-3 text-xs gap-1" onClick={() => setShowCreateCommunity(true)}>
              <Plus className="w-3 h-3" /> Criar
            </Button>
          </div>

          {/* My communities section */}
          {communities.filter((c) => c.isMember).length > 0 && (
            <div className="px-4 pt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">MINHAS COMUNIDADES</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {communities.filter((c) => c.isMember).map((c) => (
                  <button key={c.id} onClick={() => openCommunity(c.id)} className="flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-secondary/50 transition-colors w-16">
                    <span className="text-2xl">{c.emoji}</span>
                    <p className="text-xs text-center leading-tight line-clamp-2">{c.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All communities */}
          <div className="px-4 pt-4 pb-6 space-y-3">
            {communities.filter((c) => !c.isMember).length > 0 && (
              <p className="text-xs font-semibold text-muted-foreground">DESCOBRIR COMUNIDADES</p>
            )}
            {communitiesLoading && (
              <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
            )}
            {!communitiesLoading && communities.filter((c) => !c.isMember).length === 0 && communities.filter((c) => c.isMember).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">Nenhuma comunidade encontrada.<br/>Que tal criar a primeira?</p>
            )}
            {communities.filter((c) => !c.isMember).map((c) => (
              <div key={c.id} className="bg-secondary/30 rounded-xl p-4 flex items-start gap-3 cursor-pointer hover:bg-secondary/50 transition-colors" onClick={() => openCommunity(c.id)}>
                <span className="text-3xl">{c.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{c.category} · {c.membersCount} {c.membersCount === 1 ? "membro" : "membros"}</p>
                    </div>
                    <Button size="sm" className="h-7 text-xs flex-shrink-0" disabled={communityJoining === c.id} onClick={(e) => { e.stopPropagation(); handleJoinCommunity(c.id); }}>
                      {communityJoining === c.id ? "..." : "Entrar"}
                    </Button>
                  </div>
                  {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

      </Tabs>
    </>
  );

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-background">

      {/* ── Chat area ── */}
      <div
        className={`flex-1 flex flex-col min-h-0 ${
          mobileTab === "chat" ? "flex" : (mobileTab === "inbox" || mobileTab === "communities") ? "hidden" : "hidden md:flex"
        }`}
      >
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-xl font-bold text-primary">bee-eyes</h1>
              <button
                type="button"
                onClick={() => setShowSettingsScreen(true)}
                className="w-9 h-9 rounded-full border border-border overflow-hidden bg-primary/20 flex items-center justify-center shrink-0"
                aria-label="Abrir configuracoes de perfil"
              >
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold">
                    {(user?.username || "?")[0].toUpperCase()}
                  </span>
                )}
              </button>
              {user && <StreakDisplay streak={user.currentStreak} />}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" onClick={() => setShowSettingsScreen(true)}>
                Configuracoes
              </Button>
              <ThemeToggle />
              <Button variant="outline" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center justify-center py-4 border-b bg-gradient-to-b from-primary/5 to-transparent shrink-0">
            <BeeEyes expression={eyeExpression} />
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                  actions={(() => {
                    if (message.role !== "assistant") return null;
                    const meta = getMessageMeta(message.metadata);
                    if (!meta) return null;

                    if (meta.type === "connection_request" && meta.connectionId) {
                      const connectionMeta = getConnectionRequestMeta(message.metadata);
                      if (!connectionMeta) return null;
                      const isBusy = processingConnectionRequestId === connectionMeta.connectionId;
                      return (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            disabled={!!processingConnectionRequestId}
                            onClick={() => handleConnectionDecision(message.id, connectionMeta.connectionId, "accept")}
                          >
                            {isBusy ? "Processando..." : "Aceitar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={!!processingConnectionRequestId}
                            onClick={() => handleConnectionDecision(message.id, connectionMeta.connectionId, "reject")}
                          >
                            Recusar
                          </Button>
                        </div>
                      );
                    }

                    if (meta.type === "news" && Array.isArray(meta.items)) {
                      return (
                        <div className="space-y-2">
                          {(meta.items as NewsItem[]).map((item, index) => (
                            <NewsCard
                              key={`${item.link}-${index}`}
                              title={item.title}
                              link={item.link}
                              source={item.source}
                              authHeaders={authHeaders}
                            />
                          ))}
                        </div>
                      );
                    }

                    if (meta.type === "feed_summary" && Array.isArray(meta.posts)) {
                      return (
                        <div className="space-y-2">
                          {(meta.posts as ChatFeedSummaryPost[]).map((post) => (
                            <FeedPostCard
                              key={post.id}
                              post={{ ...post, commentsCount: post.commentsCount ?? 0 }}
                              authHeaders={authHeaders}
                              timeAgo={timeAgo}
                            />
                          ))}
                          <div className="flex justify-end">
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowInlinePost(true)}>
                              Compartilhar algo
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    if (meta.type === "network_digest") {
                      const digest = meta as NetworkDigestMeta;
                      return (
                        <div className="space-y-3">
                          {Array.isArray(digest.feedPosts) && digest.feedPosts.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feed</p>
                              {digest.feedPosts.map((post) => (
                                <FeedPostCard
                                  key={post.id}
                                  post={{ ...post, commentsCount: (post as any).commentsCount ?? 0 }}
                                  authHeaders={authHeaders}
                                  timeAgo={timeAgo}
                                />
                              ))}
                            </div>
                          )}

                          {Array.isArray(digest.newsItems) && digest.newsItems.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notícias</p>
                              {digest.newsItems.map((item, index) => (
                                <NewsCard
                                  key={`${item.link}-${index}`}
                                  title={item.title}
                                  link={item.link}
                                  source={item.source}
                                  authHeaders={authHeaders}
                                />
                              ))}
                            </div>
                          )}

                          {Array.isArray(digest.suggestions) && digest.suggestions.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rede</p>
                              {digest.suggestions.map((suggestion) => (
                                <div key={suggestion.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold">{suggestion.displayName || suggestion.username}</p>
                                    <p className="mt-1 text-xs text-muted-foreground truncate">
                                      {suggestion.commonInterests.slice(0, 2).join(" · ") || "Novo contato para conhecer"}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    disabled={connectingIds.has(suggestion.id)}
                                    onClick={() => handleConnect(suggestion.id)}
                                  >
                                    Conectar
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return null;
                  })()}
                />
              ))}
              {streamingText && (
                <ChatMessage
                  key="streaming"
                  role="assistant"
                  content={streamingText + "▌"}
                  timestamp={new Date()}
                />
              )}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>

          <div className="border-t p-3 md:p-4 bg-card/50 backdrop-blur-sm shrink-0 pb-safe">
            {showInlinePost && (
              <div className="max-w-4xl mx-auto mb-3 rounded-2xl border border-border bg-background/80 p-3 space-y-3">
                <Textarea
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="Compartilhe uma atualização rápida com seus amigos..."
                  className="min-h-[88px] resize-none text-sm"
                  maxLength={500}
                />
                <div className="flex justify-between gap-2">
                  <Button variant="ghost" className="text-xs" onClick={() => setShowInlinePost(false)}>
                    Fechar
                  </Button>
                  <Button className="text-xs" disabled={!postText.trim() || isPosting} onClick={handleCreatePost}>
                    {isPosting ? "Publicando..." : "Publicar"}
                  </Button>
                </div>
              </div>
            )}

            <div className="max-w-4xl mx-auto mb-3 flex flex-wrap gap-2">
              {[
                { label: "/feed", onClick: handleFeedCommand },
                { label: "/missões", onClick: handleMissionsCommand },
                { label: "/notícias", onClick: handleNewsCommand },
                { label: "/compartilhar", onClick: handleShareCommand },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  {action.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 max-w-4xl mx-auto">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Digite sua mensagem..."
                className="flex-1"
                disabled={isLoading}
                autoFocus
                data-testid="input-chat-message"
              />
              <Button onClick={handleSendMessage} size="icon" disabled={isLoading} data-testid="button-send-message">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sidebar (desktop) ── */}
      <aside
        className={`bg-card/30 backdrop-blur-sm min-h-0 ${
          mobileTab === "chat"
            ? "hidden md:flex md:w-96 md:border-l md:flex-col"
            : (mobileTab === "inbox" || mobileTab === "communities")
              ? "flex flex-1 min-w-0 flex-col"
              : "flex flex-col flex-1 min-h-0 md:w-96 md:border-l md:flex"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* ── Bottom nav (mobile only) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-sm z-20 flex">
        <button
          onClick={() => { setShowSettingsScreen(false); setMobileTab("chat"); }}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${mobileTab === "chat" ? "text-primary" : "text-muted-foreground"}`}
        >
          <MessageCircle className="w-5 h-5" />
          Chat
        </button>
        <button
          onClick={() => { setShowSettingsScreen(false); setMobileTab("missions"); }}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${mobileTab === "missions" ? "text-primary" : "text-muted-foreground"}`}
        >
          <TrendingUp className="w-5 h-5" />
          Missões
        </button>
        <button
          onClick={() => { setShowSettingsScreen(false); setMobileTab("friends"); loadFriends(); }}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${mobileTab === "friends" ? "text-primary" : "text-muted-foreground"}`}
        >
          <Users className="w-5 h-5" />
          Amigos
        </button>
        <button
          onClick={() => { setShowSettingsScreen(false); setMobileTab("inbox"); loadDMConversations(); loadConversationSuggestions(); }}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${mobileTab === "inbox" ? "text-primary" : "text-muted-foreground"}`}
        >
          <MessageSquare className="w-5 h-5" />
          Msg
        </button>
        <button
          onClick={() => { setShowSettingsScreen(false); setMobileTab("communities"); loadCommunities(communitySearch); }}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${mobileTab === "communities" ? "text-primary" : "text-muted-foreground"}`}
        >
          <Users2 className="w-5 h-5" />
          Grupos
        </button>
        <button
          onClick={() => setShowSettingsScreen(true)}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${showSettingsScreen ? "text-primary" : "text-muted-foreground"}`}
        >
          <Settings className="w-5 h-5" />
          Config.
        </button>
      </nav>

      {/* Spacer so content doesn't hide behind bottom nav on mobile */}
      <div className="md:hidden h-16 shrink-0" />

      <input
        ref={photoFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleProfileFileChange}
      />

      <AnimatePresence>
        {showSettingsScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background"
          >
            <div className="h-full overflow-y-auto">
              <div className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur-sm">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    <h2 className="font-display text-lg font-semibold">Configuracoes</h2>
                  </div>
                  <Button variant="outline" onClick={() => setShowSettingsScreen(false)}>Fechar</Button>
                </div>
              </div>

              <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold">Foto de perfil</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {profilePhotoUrl ? (
                      <img src={profilePhotoUrl} alt="Foto de perfil" className="w-16 h-16 rounded-full object-cover border" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-lg font-black text-primary-foreground">
                        {(user?.username || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Selecione uma imagem do seu computador. O app aplica recorte central e compressao automaticamente.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleSelectProfilePhoto}>Escolher do computador</Button>
                    <Button className="flex-1" variant="outline" onClick={handleRemoveProfilePhoto}>Remover</Button>
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    {themeMode === "dark" ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
                    <p className="text-sm font-semibold">Aparencia</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Escolha entre modo claro e modo escuro.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={themeMode === "light" ? "default" : "outline"} onClick={() => handleThemeSelect("light")}>
                      Modo claro
                    </Button>
                    <Button variant={themeMode === "dark" ? "default" : "outline"} onClick={() => handleThemeSelect("dark")}>
                      Modo escuro
                    </Button>
                  </div>
                </Card>

                <Card className="p-4 space-y-2">
                  <p className="text-sm font-semibold">Outras configuracoes</p>
                  <p className="text-xs text-muted-foreground">Notificacoes personalizadas (em breve)</p>
                  <p className="text-xs text-muted-foreground">Privacidade e seguranca (em breve)</p>
                  <p className="text-xs text-muted-foreground">Idioma e acessibilidade (em breve)</p>
                </Card>

                {settingsMessage && (
                  <p className="text-xs rounded-lg border border-primary/40 bg-primary/10 p-2 text-primary">{settingsMessage}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Friend Profile Modal ── */}
      <AnimatePresence>
        {(friendProfileLoading || selectedFriend) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedFriend(null)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-background border shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {friendProfileLoading && (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-muted-foreground">Carregando perfil...</p>
                </div>
              )}

              {selectedFriend && !friendProfileLoading && (() => {
                const { user: f, recentPosts, interests, activeMissionsCount } = selectedFriend;
                const name = f.displayName || f.username;
                const canSendMessage = isFriendUser(f.id);
                return (
                  <div className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-2xl font-black">
                          {name[0].toUpperCase()}
                        </div>
                        <div>
                          <h2 className="font-display text-xl font-bold">{name}</h2>
                          <p className="text-sm text-muted-foreground">@{f.username}</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedFriend(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {canSendMessage && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          openDMWithUser({
                            id: f.id,
                            username: f.username,
                            displayName: f.displayName,
                            level: f.level,
                          })
                        }
                      >
                        Enviar mensagem
                      </Button>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-secondary/50 rounded-xl p-3 text-center">
                        <Trophy className="w-4 h-4 mx-auto mb-1 text-primary" />
                        <p className="text-sm font-bold">Nv {f.level}</p>
                        <p className="text-xs text-muted-foreground">Nível</p>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-3 text-center">
                        <Flame className="w-4 h-4 mx-auto mb-1 text-orange-500" />
                        <p className="text-sm font-bold">{f.currentStreak}d</p>
                        <p className="text-xs text-muted-foreground">Streak</p>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-3 text-center">
                        <TrendingUp className="w-4 h-4 mx-auto mb-1 text-green-500" />
                        <p className="text-sm font-bold">{activeMissionsCount}</p>
                        <p className="text-xs text-muted-foreground">Missões</p>
                      </div>
                    </div>

                    {/* Interests */}
                    {interests.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">INTERESSES</p>
                        <div className="flex flex-wrap gap-1.5">
                          {interests.slice(0, 8).map((i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-medium">{i}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent posts */}
                    {recentPosts.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">PUBLICAÇÕES RECENTES</p>
                        <div className="space-y-2">
                          {recentPosts.map((post) => (
                            <div key={post.id} className="bg-secondary/30 rounded-xl p-3 space-y-1.5">
                              <p className="text-sm leading-relaxed">{post.content}</p>
                              {post.aiComment && (
                                <div className="border-l-2 border-primary pl-2">
                                  <p className="text-xs text-muted-foreground">🐝 {post.aiComment}</p>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                {post.sentimentLabel && (
                                  <span className="text-xs text-muted-foreground">{post.sentimentLabel}</span>
                                )}
                                <span className="text-xs text-muted-foreground ml-auto">{timeAgo(post.createdAt)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {recentPosts.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">{name} ainda não publicou nada.</p>
                    )}

                    {f.lastActiveAt && (
                      <p className="text-xs text-muted-foreground text-center">Último acesso: {timeAgo(f.lastActiveAt)}</p>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AchievementPopup
        title={achievementData.title}
        description={achievementData.description}
        isVisible={showAchievement}
        onClose={() => setShowAchievement(false)}
      />
    </div>
  );
}
