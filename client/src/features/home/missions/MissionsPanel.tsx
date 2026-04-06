import type { Mission, User } from "@/features/home/types";

interface MissionsPanelProps {
  user: User | null;
  missions: Mission[];
}

export function MissionsPanel({ user, missions }: MissionsPanelProps) {
  const tierMeta: Record<number, { label: string; emoji: string; color: string }> = {
    1: { label: "Boas-vindas", emoji: "👋", color: "#F59E0B" },
    2: { label: "Social", emoji: "🤝", color: "#3B82F6" },
    3: { label: "Conectado", emoji: "💬", color: "#8B5CF6" },
    4: { label: "Criador", emoji: "🚀", color: "#10B981" },
  };
  const levelUnlocks: Record<number, { icon: string; label: string }> = {
    2: { icon: "📨", label: "Mensagens diretas desbloqueadas" },
    3: { icon: "👻", label: "Visita anônima de perfil" },
    4: { icon: "🏅", label: "Badge exclusiva no perfil" },
    5: { icon: "🤖", label: "Modo IA avançado" },
  };
  const xpForLevel = (level: number) => level * 100 + (level - 1) * 50;
  const currentLevel = user?.level ?? 1;
  const currentXp = user?.xp ?? 0;
  const xpNeeded = xpForLevel(currentLevel);
  const progress = Math.min(currentXp / xpNeeded, 1);

  const systemMissions = missions.filter((mission) => mission.type === "system");
  const totalDone = systemMissions.filter((mission) => mission.completed).length;
  const byTier: Record<number, Mission[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const mission of systemMissions) {
    if (byTier[mission.tier]) {
      byTier[mission.tier].push(mission);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Missões</h2>
          <p className="text-xs text-muted-foreground mt-1">Progressão, desbloqueios e retenção orientada a valor.</p>
        </div>
        <span className="text-xs text-muted-foreground">{totalDone}/{systemMissions.length} concluídas</span>
      </div>

      {user && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center font-bold text-lg text-primary-foreground shrink-0">
              {currentLevel}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Nível {currentLevel}</p>
              <p className="text-xs text-muted-foreground font-mono">{currentXp} / {xpNeeded} XP</p>
            </div>
            <span className="text-xs font-bold text-primary">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
          {levelUnlocks[currentLevel + 1] && (
            <p className="text-xs text-muted-foreground bg-secondary/60 rounded-lg px-3 py-2">
              {levelUnlocks[currentLevel + 1].icon} Próximo desbloqueio no nível {currentLevel + 1}: <strong>{levelUnlocks[currentLevel + 1].label}</strong>
            </p>
          )}
        </div>
      )}

      {Object.entries(levelUnlocks)
        .filter(([level]) => Number(level) <= currentLevel)
        .map(([level, info]) => (
          <div key={level} className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/8 px-3 py-2">
            <span className="text-base">{info.icon}</span>
            <span className="text-xs font-semibold text-green-600">{info.label}</span>
          </div>
        ))}

      {[1, 2, 3, 4].map((tier) => {
        const tierMissions = byTier[tier];
        if (tierMissions.length === 0) {
          return null;
        }
        const meta = tierMeta[tier];
        const allDone = tierMissions.every((mission) => mission.completed);
        return (
          <div key={tier} className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
              <span className="text-sm font-semibold flex-1">{meta.emoji} {meta.label}</span>
              {allDone && <span className="text-xs font-bold text-green-600">Completo</span>}
            </div>
            <div className="divide-y divide-border">
              {tierMissions.map((mission) => (
                <div key={mission.id} className={`flex items-center gap-3 px-4 py-3 ${mission.completed ? "opacity-50" : ""}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${mission.completed ? "bg-green-500 border-green-500" : "border-border"}`}>
                    {mission.completed && <span className="text-white text-[10px] font-black">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${mission.completed ? "line-through text-muted-foreground" : ""}`}>{mission.title}</p>
                    {mission.description && <p className="text-xs text-muted-foreground mt-0.5">{mission.description}</p>}
                  </div>
                  <span className={`text-xs font-bold font-mono shrink-0 px-2 py-1 rounded-lg ${mission.completed ? "text-green-600 bg-green-500/10" : "text-primary bg-primary/10"}`}>
                    +{mission.xpReward} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {systemMissions.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Carregando missões...</p>}
    </div>
  );
}
