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
import { Badge } from "@/components/ui/badge";
import { Send, Plus, Calendar, TrendingUp, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

//todo: remove mock functionality
const mockMessages = [
  {
    id: "1",
    role: "assistant" as const,
    content: "Olá! Eu sou o bee-eyes, seu assistente pessoal! 🐝 Como posso te ajudar hoje?",
    timestamp: new Date(Date.now() - 300000),
  },
];

//todo: remove mock functionality
const mockMissions = [
  {
    id: "1",
    title: "Beber 8 copos de água",
    description: "Mantenha-se hidratado ao longo do dia",
    xpReward: 20,
    completed: false,
  },
  {
    id: "2",
    title: "Meditar por 10 minutos",
    description: "Pratique mindfulness",
    xpReward: 30,
    completed: false,
  },
  {
    id: "3",
    title: "Exercício matinal",
    description: "30 minutos de atividade física",
    xpReward: 50,
    completed: false,
  },
];

export default function Home() {
  const [messages, setMessages] = useState(mockMessages);
  const [inputValue, setInputValue] = useState("");
  const [missions, setMissions] = useState(mockMissions);
  const [eyeExpression, setEyeExpression] = useState<any>("neutral");
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [showAchievement, setShowAchievement] = useState(false);
  const [currentXP, setCurrentXP] = useState(150);
  const [level, setLevel] = useState(3);
  const [streak, setStreak] = useState(5);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setEyeExpression("curious");

    setTimeout(() => {
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: "Entendi! Vou te ajudar com isso. Que tal criarmos uma missão para acompanhar seu progresso?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setEyeExpression("happy");
    }, 1000);
  };

  const handleToggleMission = (id: string) => {
    const mission = missions.find((m) => m.id === id);
    if (!mission || mission.completed) return;

    setMissions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m))
    );

    setEyeExpression("celebrating");
    setCurrentXP((prev) => prev + mission.xpReward);
    setShowAchievement(true);

    setTimeout(() => {
      setEyeExpression("happy");
    }, 2000);

    setTimeout(() => {
      setShowAchievement(false);
    }, 4000);
  };

  const handleMoodSelect = (mood: number) => {
    setSelectedMood(mood);
    if (mood >= 4) {
      setEyeExpression("excited");
    } else if (mood <= 2) {
      setEyeExpression("curious");
    } else {
      setEyeExpression("neutral");
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <h1 className="font-display text-2xl font-bold text-primary">bee-eyes</h1>
              <StreakDisplay streak={streak} />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="icon" data-testid="button-settings">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-center py-6 border-b bg-gradient-to-b from-primary/5 to-transparent">
            <BeeEyes expression={eyeExpression} />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                />
              ))}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>

          <div className="border-t p-4 bg-card/50 backdrop-blur-sm">
            <div className="flex gap-2 max-w-4xl mx-auto">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Digite sua mensagem..."
                className="flex-1"
                data-testid="input-chat-message"
              />
              <Button onClick={handleSendMessage} size="icon" data-testid="button-send-message">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <aside className="w-96 border-l bg-card/30 backdrop-blur-sm flex flex-col">
        <div className="p-4 border-b">
          <XPProgress currentXP={currentXP} level={level} xpToNextLevel={500} />
        </div>

        <Tabs defaultValue="missions" className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-4">
            <TabsTrigger value="missions" className="flex-1" data-testid="tab-missions">
              <TrendingUp className="w-4 h-4 mr-2" />
              Missões
            </TabsTrigger>
            <TabsTrigger value="mood" className="flex-1" data-testid="tab-mood">
              <Calendar className="w-4 h-4 mr-2" />
              Humor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="missions" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Missões Diárias</h2>
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
                />
              ))}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="mood" className="flex-1 overflow-y-auto p-4 mt-0">
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-lg font-semibold mb-4">Como você está hoje?</h2>
                <MoodSelector selectedMood={selectedMood} onSelectMood={handleMoodSelect} />
              </div>

              {selectedMood && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                        🐝
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {selectedMood >= 4
                            ? "Que ótimo! Continue assim! 🎉"
                            : selectedMood === 3
                            ? "Tudo bem ter dias normais. Estou aqui para ajudar!"
                            : "Sinto muito que não esteja se sentindo bem. Vamos trabalhar juntos para melhorar isso! 💪"}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Histórico
                </h3>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-md bg-primary/20"
                      title={`Dia ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </aside>

      <AchievementPopup
        title="Missão Completa!"
        description="Você ganhou XP e está mais perto do próximo nível!"
        isVisible={showAchievement}
        onClose={() => setShowAchievement(false)}
      />
    </div>
  );
}
