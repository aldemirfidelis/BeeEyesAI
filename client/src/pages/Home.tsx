import { useState, useRef, useEffect, useCallback } from "react";
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
import { Send, Plus, Calendar, TrendingUp, MessageCircle, Globe, UserPlus, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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

const SENTIMENT_EMOJI: Record<string, string> = {
  happy: "😊", motivated: "💪", tired: "😴", sad: "💙",
  neutral: "😐", excited: "🎉", proud: "🏆",
};

// Simple token storage
const getToken = () => localStorage.getItem("bee_token");
const setToken = (t: string) => localStorage.setItem("bee_token", t);
const clearToken = () => localStorage.removeItem("bee_token");

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
  const [mobileTab, setMobileTab] = useState<"chat" | "missions" | "mood" | "feed">("chat");

  // Feed state
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [postText, setPostText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [showPostInput, setShowPostInput] = useState(false);
  const [suggestions, setSuggestions] = useState<ConnectionSuggestion[]>([]);
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Load user data when token is set
  useEffect(() => {
    if (!token) return;
    fetch("/api/me", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then(setUser)
      .catch(() => { clearToken(); setTokenState(null); });

    fetch("/api/messages?limit=50", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then((msgs: any[]) => setMessages(msgs.map((m) => ({ ...m, timestamp: new Date(m.createdAt) }))));

    fetch("/api/missions?completed=false", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then(setMissions);
  }, [token]);

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

  useEffect(() => {
    if (mobileTab === "feed") loadFeed();
  }, [mobileTab, loadFeed]);

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
    const userMsg: Message = { id: Date.now().toString(), role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
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
        onValueChange={(v) => setMobileTab(v as any)}
      >
        <TabsList className="mx-4 mt-4 md:flex hidden">
          <TabsTrigger value="missions" className="flex-1">
            <TrendingUp className="w-4 h-4 mr-2" />
            Missões
          </TabsTrigger>
          <TabsTrigger value="mood" className="flex-1">
            <Calendar className="w-4 h-4 mr-2" />
            Humor
          </TabsTrigger>
          <TabsTrigger value="feed" className="flex-1" onClick={loadFeed}>
            <Globe className="w-4 h-4 mr-2" />
            Feed
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

        <TabsContent value="mood" className="flex-1 overflow-y-auto p-4 mt-0">
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-semibold mb-4">Como você está hoje?</h2>
              <MoodSelector selectedMood={selectedMood} onSelectMood={handleMoodSelect} />
            </div>
            {selectedMood && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                      🐝
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedMood >= 4
                        ? "Que ótimo! Continue assim! 🎉"
                        : selectedMood === 3
                        ? "Tudo bem ter dias normais. Estou aqui para ajudar!"
                        : "Sinto muito que não esteja se sentindo bem. Vamos trabalhar juntos para melhorar isso! 💪"}
                    </p>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="feed" className="flex-1 overflow-y-auto min-h-0 p-4 mt-0">
          <div className="space-y-4">
            {/* Post input toggle */}
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Feed Social</h2>
              <Button size="sm" variant="outline" onClick={() => setShowPostInput((v) => !v)}>
                <Plus className="w-4 h-4 mr-1" />
                {showPostInput ? "Cancelar" : "Publicar"}
              </Button>
            </div>

            {/* New post form */}
            {showPostInput && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-3 space-y-2 border-primary/40">
                  <Textarea
                    placeholder="Compartilhe um momento, conquista ou pensamento..."
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="resize-none text-sm"
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{postText.length}/500</span>
                    <Button
                      size="sm"
                      onClick={handleCreatePost}
                      disabled={!postText.trim() || isPosting}
                    >
                      {isPosting ? "Publicando..." : "Publicar 🐝"}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Connection suggestions */}
            {suggestions.length > 0 && (
              <Card className="p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <UserPlus className="w-3 h-3" /> Sugestões de conexão
                </p>
                {suggestions.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold shrink-0">
                      {(s.displayName || s.username)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{s.displayName || s.username}</p>
                      {s.commonInterests.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">{s.commonInterests.slice(0, 2).join(" · ")}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 shrink-0"
                      onClick={() => handleConnect(s.id)}
                      disabled={connectingIds.has(s.id)}
                    >
                      Conectar
                    </Button>
                  </div>
                ))}
              </Card>
            )}

            {/* Feed posts */}
            {feedLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando feed...</p>
            )}

            {!feedLoading && feed.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <p className="text-2xl">🌐</p>
                <p className="text-sm font-semibold">Feed vazio</p>
                <p className="text-xs text-muted-foreground">Publique algo ou conecte-se com outros usuários.</p>
              </div>
            )}

            <AnimatePresence>
              {feed.map((post) => {
                const authorName = post.author.displayName || post.author.username;
                const sentimentEmoji = post.sentiment ? (SENTIMENT_EMOJI[post.sentiment] ?? "💭") : null;
                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="p-3 space-y-2">
                      {/* Author */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold shrink-0">
                          {authorName[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-semibold truncate">{authorName}</span>
                            <span className="text-xs text-muted-foreground bg-secondary rounded px-1">Nv {post.author.level}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</span>
                        </div>
                        {sentimentEmoji && (
                          <div className="text-right">
                            <span className="text-lg">{sentimentEmoji}</span>
                            {post.sentimentLabel && <p className="text-xs text-muted-foreground">{post.sentimentLabel}</p>}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <p className="text-sm leading-relaxed">{post.content}</p>

                      {/* AI comment */}
                      {post.aiComment && (
                        <div className="bg-primary/10 border-l-2 border-primary rounded-r p-2">
                          <p className="text-xs font-semibold text-primary mb-0.5">🐝 BeeEyes</p>
                          <p className="text-xs text-foreground">{post.aiComment}</p>
                        </div>
                      )}

                      {/* Like */}
                      <button
                        onClick={() => handleLikePost(post.id)}
                        className={`flex items-center gap-1 text-xs font-semibold transition-colors ${post.liked ? "text-red-500" : "text-muted-foreground hover:text-red-400"}`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${post.liked ? "fill-current" : ""}`} />
                        {post.likesCount}
                      </button>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-background">

      {/* ── Chat area ── */}
      <div className={`flex-1 flex flex-col min-h-0 ${mobileTab !== "chat" ? "hidden md:flex" : "flex"}`}>
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-xl font-bold text-primary">bee-eyes</h1>
              {user && <StreakDisplay streak={user.currentStreak} />}
            </div>
            <div className="flex items-center gap-1">
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
      <aside className={`
        md:w-96 md:border-l md:flex md:flex-col bg-card/30 backdrop-blur-sm
        ${mobileTab !== "chat" ? "flex flex-col flex-1 min-h-0" : "hidden md:flex"}
      `}>
        {sidebarContent}
      </aside>

      {/* ── Bottom nav (mobile only) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-sm z-20 flex">
        <button
          onClick={() => setMobileTab("chat")}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${mobileTab === "chat" ? "text-primary" : "text-muted-foreground"}`}
        >
          <MessageCircle className="w-5 h-5" />
          Chat
        </button>
        <button
          onClick={() => { setMobileTab("feed"); loadFeed(); }}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${mobileTab === "feed" ? "text-primary" : "text-muted-foreground"}`}
        >
          <Globe className="w-5 h-5" />
          Feed
        </button>
        <button
          onClick={() => setMobileTab("missions")}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${mobileTab === "missions" ? "text-primary" : "text-muted-foreground"}`}
        >
          <TrendingUp className="w-5 h-5" />
          Missões
        </button>
        <button
          onClick={() => setMobileTab("mood")}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${mobileTab === "mood" ? "text-primary" : "text-muted-foreground"}`}
        >
          <Calendar className="w-5 h-5" />
          Humor
        </button>
      </nav>

      {/* Spacer so content doesn't hide behind bottom nav on mobile */}
      <div className="md:hidden h-16 shrink-0" />

      <AchievementPopup
        title={achievementData.title}
        description={achievementData.description}
        isVisible={showAchievement}
        onClose={() => setShowAchievement(false)}
      />
    </div>
  );
}
