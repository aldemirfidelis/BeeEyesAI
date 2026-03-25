import { useState, useRef, useEffect } from "react";
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
import { Send, Plus, Calendar, TrendingUp, Settings, LogIn, MessageCircle } from "lucide-react";
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

// Simple token storage
const getToken = () => localStorage.getItem("bee_token");
const setToken = (t: string) => localStorage.setItem("bee_token", t);
const clearToken = () => localStorage.removeItem("bee_token");

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  const [mobileTab, setMobileTab] = useState<"chat" | "missions" | "mood">("chat");

  // Auth form state
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

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

    const interval = setInterval(poll, 3 * 60 * 1000); // poll every 3 min
    return () => clearInterval(interval);
  }, [token]);

  const handleAuth = async () => {
    setAuthError("");
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.message || "Erro"); return; }
      setToken(data.token);
      setTokenState(data.token);
      setUser(data.user);
      // Welcome message
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `Olá ${data.user.username}! Eu sou o BeeEyes 🐝, seu melhor amigo AI. Como posso te ajudar hoje?`,
        timestamp: new Date(),
      }]);
    } catch {
      setAuthError("Erro de conexão");
    }
  };

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

              // Refresh user XP/level
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

      // Ask AI to react with a joke about giving up
      setEyeExpression("curious");
      setIsLoading(true);
      setStreamingText("");

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: `[SISTEMA] O usuário acabou de desistir e deletar a missão "${title}". Faça uma piada curta e bem-humorada sobre ele ter desistido, sem julgá-lo de verdade. Tom leve e carinhoso.` }),
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

  // Auth screen
  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Card className="p-8 w-full max-w-sm space-y-4">
          <div className="text-center space-y-2">
            <BeeEyes expression="happy" />
            <h1 className="font-bold text-2xl text-primary mt-4">bee-eyes</h1>
            <p className="text-sm text-muted-foreground">Seu assistente pessoal 🐝</p>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Usuário"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            />
            <Input
              type="password"
              placeholder="Senha"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            />
            {authError && <p className="text-sm text-destructive">{authError}</p>}
            <Button className="w-full" onClick={handleAuth}>
              <LogIn className="w-4 h-4 mr-2" />
              {authMode === "login" ? "Entrar" : "Criar conta"}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}
            >
              {authMode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
            </Button>
          </div>
        </Card>
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
      >
        <TabsList className="mx-4 mt-4 md:flex hidden">
          <TabsTrigger value="missions" className="flex-1" data-testid="tab-missions">
            <TrendingUp className="w-4 h-4 mr-2" />
            Missões
          </TabsTrigger>
          <TabsTrigger value="mood" className="flex-1" data-testid="tab-mood">
            <Calendar className="w-4 h-4 mr-2" />
            Humor
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
              <Button variant="ghost" size="icon" onClick={() => { clearToken(); setTokenState(null); setUser(null); setMessages([]); }}>
                <Settings className="w-5 h-5" />
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
