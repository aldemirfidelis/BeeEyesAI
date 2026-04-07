import { useState, useRef, useEffect, useCallback, type ChangeEvent } from "react";
import ChatMessage from "@/components/ChatMessage";
import MissionCard from "@/components/MissionCard";
import XPProgress from "@/components/XPProgress";
import MoodSelector from "@/components/MoodSelector";
import AchievementPopup from "@/components/AchievementPopup";
import BeeEyes from "@/components/BeeEyes";
import StreakDisplay from "@/components/StreakDisplay";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Send, Plus, TrendingUp, MessageCircle, Globe, UserPlus, Heart, Users, X, Flame, Trophy, ChevronRight, Settings, Camera, Moon, Sun, MessageSquare, Users2, LayoutGrid, RefreshCw, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, getApiErrorMessage } from "@/features/home/shared/api";
import { AuthScreen } from "@/features/home/auth/AuthScreen";
import { FeedPanel } from "@/features/home/feed/FeedPanel";
import { MissionsPanel } from "@/features/home/missions/MissionsPanel";
import { FriendsPanel } from "@/features/home/friends/FriendsPanel";
import { InboxPanel } from "@/features/home/chat/InboxPanel";
import { CommunitiesPanel } from "@/features/home/communities/CommunitiesPanel";
import { SettingsScreen } from "@/features/home/settings/SettingsScreen";
import { FriendProfileModal } from "@/features/home/friends/FriendProfileModal";
import { ChatWorkspace } from "@/features/home/chat/ChatWorkspace";
import { applyTheme, onThemeChange, readTheme, resolveInitialTheme, ThemeMode } from "@/lib/theme";
import FeedPostCard from "@/components/FeedPostCard";
import NewsCard from "@/components/NewsCard";
import CommunityPostCard from "@/components/CommunityPostCard";
import type { Message, Mission, User, FeedPost, ConnectionSuggestion, Friend, SearchUser, FriendProfile, Community, CommunityPost, DMConversation, DMMessage, NewsItem, ChatFeedSummaryPost, NetworkDigestMeta } from "@/features/home/types";
import { getAnonymousProfileVisitsUnlockMessage, hasAnonymousProfileVisitsUnlocked } from "@shared/unlocks";

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
  const [mobileTab, setMobileTab] = useState<"chat" | "feed" | "missions" | "friends" | "inbox" | "communities">("chat");
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
  const [newCommunity, setNewCommunity] = useState({ name: "", description: "", category: "geral", emoji: "🐝", imageUrl: "" });
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

  // Chat search state
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");

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
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const dmEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
      .then(setUser)
      .catch(() => { clearToken(); setTokenState(null); });

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

    apiFetch<Mission[]>("/api/missions/seed", { method: "POST", headers: authHeaders() })
      .then(setMissions)
      .catch(() =>
        apiFetch<Mission[]>("/api/missions", { headers: authHeaders() })
          .then(setMissions)
      );
  }, [token]);

  // Refresh missions + user XP (called after any action that may trigger a mission)
  const loadMissions = useCallback(async () => {
    if (!token) return;
    try {
      const [missionsData, meData] = await Promise.all([
        apiFetch<Mission[]>("/api/missions", { headers: authHeaders() }),
        apiFetch<User>("/api/me", { headers: authHeaders() }),
      ]);
      setMissions(missionsData);
      setUser(meData);
    } catch { /* ignore */ }
  }, [token]);

  // Load friends list
  const loadFriends = useCallback(async () => {
    if (!token) return;
    setFriendsLoading(true);
    try {
      setFriends(await apiFetch<Friend[]>("/api/friends", { headers: authHeaders() }));
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
      setTimeout(loadMissions, 1000);
    } catch {
      setDmInput(content);
    } finally {
      setDmSending(false);
    }
  }, [selectedDMUser, dmInput, dmSending, loadDMConversations, loadMissions]);

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

  const handleAnonymousProfileVisitsToggle = useCallback(async (nextValue: boolean) => {
    if (!token || !user) return;
    if (nextValue && !hasAnonymousProfileVisitsUnlocked(user)) {
      setSettingsMessage(getAnonymousProfileVisitsUnlockMessage());
      return;
    }

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
        setTimeout(loadMissions, 1000);
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
        setTimeout(loadMissions, 1000);
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
        setTimeout(loadMissions, 1000);
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
        setTimeout(loadMissions, 1000);
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
        setNewCommunity({ name: "", description: "", category: "geral", emoji: "🐝", imageUrl: "" });
        setTimeout(loadMissions, 1000);
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

  // Poll missions every 8s so auto-completed ones appear quickly
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(loadMissions, 8000);
    return () => clearInterval(interval);
  }, [token, loadMissions]);

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
    isNearBottomRef.current = true;
    setInputValue("");

    if (slashCommand === "/feed") {
      setMobileTab("feed");
      loadFeed();
      injectAssistantMessage("Abrindo o feed para você. 📣");
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
      // Reload in background to get AI comment + mission progress
      setTimeout(loadFeed, 3000);
      setTimeout(loadMissions, 1000);
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
      if (data.liked) setTimeout(loadMissions, 1000);
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

  const handleMissionsCommand = () => {
    const sys = missions.filter((m) => m.type === "system");
    const active = sys.filter((m) => !m.completed);
    const done = sys.filter((m) => m.completed);
    if (sys.length === 0) {
      injectAssistantMessage("Abrindo suas missões na aba ao lado! 🎯");
      setMobileTab("missions");
      return;
    }
    const lines = [
      `🎯 Progresso das missões: ${done.length}/${sys.length} concluídas`,
      ...active.slice(0, 3).map((m) => `▸ ${m.title} (+${m.xpReward} XP)`),
      ...(active.length > 3 ? [`...e mais ${active.length - 3} missões`] : []),
    ];
    injectAssistantMessage(lines.join("\n"));
    setMobileTab("missions");
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
      <AuthScreen
        authMode={authMode}
        authUsername={authUsername}
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
        onPasswordChange={setAuthPassword}
        onDisplayNameChange={setAuthDisplayName}
        onGenderChange={setAuthGender}
        onTogglePassword={() => setAuthShowPassword((value) => !value)}
        onSubmit={handleAuth}
        onGoogleLogin={handleGoogleLogin}
        onClearError={() => {
          setAuthError("");
          setAuthPassword("");
          setAuthDisplayName("");
          setAuthGender("");
        }}
      />
    );
  }

  const sidebarContent = (
    <>
      <div className="p-4 border-b">
        {user && <XPProgress currentXP={user.xp} level={user.level} xpToNextLevel={500} />}
      </div>

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
        <TabsList className="mx-2 mt-3 md:flex hidden gap-0.5">
          <TabsTrigger value="feed" className="flex-1 flex-col gap-0.5 py-2 px-1 h-auto">
            <LayoutGrid className="w-4 h-4" />
            <span className="text-[10px] leading-tight">Feed</span>
          </TabsTrigger>
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

        <TabsContent value="feed" className="flex-1 overflow-y-auto min-h-0 p-0 mt-0">
          <FeedPanel
            feed={feed}
            feedLoading={feedLoading}
            postText={postText}
            isPosting={isPosting}
            showPostInput={showPostInput}
            suggestions={suggestions}
            connectingIds={connectingIds}
            onLoadFeed={loadFeed}
            onTogglePostInput={() => setShowPostInput((value) => !value)}
            onPostTextChange={setPostText}
            onCancelPost={() => { setShowPostInput(false); setPostText(""); }}
            onCreatePost={handleCreatePost}
            onConnect={handleConnect}
            onLikePost={handleLikePost}
            timeAgo={timeAgo}
          />
        </TabsContent>

        <TabsContent value="missions" className="flex-1 overflow-y-auto min-h-0 p-0 mt-0">
          <MissionsPanel user={user} missions={missions} />
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
            timeAgo={timeAgo}
          />
        </TabsContent>

        <TabsContent value="communities" className="flex-1 overflow-y-auto p-0 m-0 relative">
          <CommunitiesPanel
            communities={communities}
            communitiesLoading={communitiesLoading}
            communitySearch={communitySearch}
            selectedCommunity={selectedCommunity}
            communityPosts={communityPosts}
            communityPostsLoading={communityPostsLoading}
            communityPostInput={communityPostInput}
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
            authHeaders={authHeaders}
            timeAgo={timeAgo}
          />
        </TabsContent>

      </Tabs>
    </>
  );

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-background">

      <ChatWorkspace
        mobileTab={mobileTab}
        profilePhotoUrl={profilePhotoUrl}
        user={user}
        eyeExpression={eyeExpression}
        showMsgSearch={showMsgSearch}
        msgSearchQuery={msgSearchQuery}
        messages={messages}
        streamingText={streamingText}
        processingConnectionRequestId={processingConnectionRequestId}
        chatScrollRef={chatScrollRef}
        chatEndRef={chatEndRef}
        inputRef={inputRef}
        inputValue={inputValue}
        isLoading={isLoading}
        postText={postText}
        showInlinePost={showInlinePost}
        isPosting={isPosting}
        messageActionsRenderer={(message) => {
          if (message.role !== "assistant") return null;
          const meta = getMessageMeta(message.metadata);
          if (!meta) return null;

          if (meta.type === "connection_request" && meta.connectionId) {
            const connectionMeta = getConnectionRequestMeta(message.metadata);
            if (!connectionMeta) return null;
            const isBusy = processingConnectionRequestId === connectionMeta.connectionId;
            return (
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs" disabled={!!processingConnectionRequestId} onClick={() => handleConnectionDecision(message.id, connectionMeta.connectionId, "accept")}>
                  {isBusy ? "Processando..." : "Aceitar"}
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!!processingConnectionRequestId} onClick={() => handleConnectionDecision(message.id, connectionMeta.connectionId, "reject")}>
                  Recusar
                </Button>
              </div>
            );
          }

          if ((meta.type === "news" || meta.type === "news_digest") && Array.isArray(meta.items)) {
            return (
              <div className="space-y-2">
                {(meta.items as NewsItem[]).map((item, index) => (
                  <NewsCard key={item.link + "-" + index} title={item.title} link={item.link} source={item.source} authHeaders={authHeaders} />
                ))}
              </div>
            );
          }

          if (meta.type === "feed_summary" && Array.isArray(meta.posts)) {
            return (
              <div className="space-y-2">
                {(meta.posts as ChatFeedSummaryPost[]).map((post) => (
                  <FeedPostCard key={post.id} post={{ ...post, commentsCount: post.commentsCount ?? 0 }} authHeaders={authHeaders} timeAgo={timeAgo} />
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
                      <FeedPostCard key={post.id} post={{ ...post, commentsCount: (post as any).commentsCount ?? 0 }} authHeaders={authHeaders} timeAgo={timeAgo} />
                    ))}
                  </div>
                )}
                {Array.isArray(digest.newsItems) && digest.newsItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Not?cias</p>
                    {digest.newsItems.map((item, index) => (
                      <NewsCard key={item.link + "-" + index} title={item.title} link={item.link} source={item.source} authHeaders={authHeaders} />
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
                          <p className="mt-1 text-xs text-muted-foreground truncate">{suggestion.commonInterests.slice(0, 2).join(" ? ") || "Novo contato para conhecer"}</p>
                        </div>
                        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={connectingIds.has(suggestion.id)} onClick={() => handleConnect(suggestion.id)}>
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
        }}
        onToggleSettings={() => setShowSettingsScreen(true)}
        onToggleSearch={() => { setShowMsgSearch((value) => !value); setMsgSearchQuery(""); }}
        onSearchQueryChange={setMsgSearchQuery}
        onScrollStateChange={() => {
          const el = chatScrollRef.current;
          if (!el) return;
          isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        onInlinePostClose={() => setShowInlinePost(false)}
        onPostTextChange={setPostText}
        onCreatePost={handleCreatePost}
        onInputChange={setInputValue}
        onSendMessage={handleSendMessage}
        onQuickAction={(action) => {
          if (action === "feed") { setMobileTab("feed"); loadFeed(); }
          if (action === "missions") handleMissionsCommand();
          if (action === "news") handleNewsCommand();
          if (action === "inbox") { setMobileTab("inbox"); loadDMConversations(); loadConversationSuggestions(); }
          if (action === "communities") { setMobileTab("communities"); loadCommunities(communitySearch); }
        }}
      />

      {/* ── Sidebar — sempre visível no desktop (384px), full-screen em outras tabs no mobile ── */}
      <aside className={`bg-card/30 backdrop-blur-sm min-h-0 ${
        mobileTab !== "chat"
          ? "flex flex-col flex-1 min-h-0 md:w-96 md:flex-none md:border-l"
          : "hidden md:flex md:w-96 md:border-l md:flex-col"
      }`}>
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
          onClick={() => { setShowSettingsScreen(false); setMobileTab("feed"); loadFeed(); }}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${mobileTab === "feed" ? "text-primary" : "text-muted-foreground"}`}
        >
          <LayoutGrid className="w-5 h-5" />
          Feed
        </button>
        <button
          onClick={() => { setShowSettingsScreen(false); setMobileTab("missions"); }}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${mobileTab === "missions" ? "text-primary" : "text-muted-foreground"}`}
        >
          <TrendingUp className="w-5 h-5" />
          Missões
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

      <SettingsScreen
        show={showSettingsScreen}
        user={user}
        profilePhotoUrl={profilePhotoUrl}
        themeMode={themeMode}
        settingsMessage={settingsMessage}
        anonymousProfileVisitsEnabled={Boolean(user?.anonymousProfileVisitsEnabled)}
        anonymousProfileVisitsUnlocked={hasAnonymousProfileVisitsUnlocked(user)}
        anonymousProfileVisitsUnlockHint={getAnonymousProfileVisitsUnlockMessage()}
        onClose={() => setShowSettingsScreen(false)}
        onSelectProfilePhoto={handleSelectProfilePhoto}
        onRemoveProfilePhoto={handleRemoveProfilePhoto}
        onThemeSelect={handleThemeSelect}
        onAnonymousProfileVisitsToggle={handleAnonymousProfileVisitsToggle}
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
    </div>
  );
}
