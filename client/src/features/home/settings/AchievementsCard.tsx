import { useMemo, useState } from "react";
import { Award, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MedalGrid, MedalDetail } from "@/components/MedalBadge";
import { MEDAL_CATALOG, TIER_COLORS, type MedalSpec, type MedalTier } from "@/lib/medals";
import type { Achievement } from "@/features/home/types";
import { SettingsCard } from "./SettingsShell";

type MedalFilter = "all" | "earned" | "locked" | MedalTier;

interface AchievementsCardProps {
  earnedTypes: string[];
  achievements: Achievement[];
  onSelect: (spec: MedalSpec | null) => void;
  selectedMedal: MedalSpec | null;
}

export function AchievementsCard({
  earnedTypes,
  achievements,
  onSelect,
  selectedMedal,
}: AchievementsCardProps) {
  const [filter, setFilter] = useState<MedalFilter>("all");

  const filtered = useMemo(() => {
    return MEDAL_CATALOG.filter((m) => {
      const earned = earnedTypes.includes(m.type);
      switch (filter) {
        case "all":
          return true;
        case "earned":
          return earned;
        case "locked":
          return !earned;
        default:
          return m.tier === filter;
      }
    });
  }, [filter, earnedTypes]);

  const filteredTypes = filtered.map((m) => m.type);
  const selectedAchievement = selectedMedal
    ? achievements.find((a) => a.type === selectedMedal.type)
    : null;

  const total = MEDAL_CATALOG.length;
  const earnedCount = earnedTypes.length;
  const percent = total > 0 ? Math.round((earnedCount / total) * 100) : 0;

  const filterButtons: Array<{ value: MedalFilter; label: string; color?: string; count: number }> = [
    { value: "all", label: "Todas", count: total },
    { value: "earned", label: "Conquistadas", count: earnedCount },
    { value: "locked", label: "Bloqueadas", count: total - earnedCount },
    {
      value: "bronze",
      label: "Bronze",
      color: TIER_COLORS.bronze.body,
      count: MEDAL_CATALOG.filter((m) => m.tier === "bronze").length,
    },
    {
      value: "silver",
      label: "Prata",
      color: TIER_COLORS.silver.body,
      count: MEDAL_CATALOG.filter((m) => m.tier === "silver").length,
    },
    {
      value: "gold",
      label: "Ouro",
      color: TIER_COLORS.gold.body,
      count: MEDAL_CATALOG.filter((m) => m.tier === "gold").length,
    },
    {
      value: "diamond",
      label: "Diamante",
      color: TIER_COLORS.diamond.body,
      count: MEDAL_CATALOG.filter((m) => m.tier === "diamond").length,
    },
  ];

  return (
    <>
      <SettingsCard
        icon={<Award className="w-4 h-4" />}
        title="Medalhas"
        description={`${earnedCount} de ${total} conquistas desbloqueadas`}
      >
        {/* Progresso */}
        <div className="rounded-xl border border-border/60 bg-background/40 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-bold">Progresso geral</p>
            <p className="text-[11px] font-mono text-muted-foreground">
              {percent}% · {earnedCount}/{total}
            </p>
          </div>
          <Progress value={percent} className="h-2" />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar medalhas">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
          {filterButtons.map((b) => {
            const active = filter === b.value;
            return (
              <button
                key={b.value}
                onClick={() => setFilter(b.value)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors min-h-[28px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  active
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {b.color ? (
                  <span
                    className="w-2 h-2 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: b.color }}
                  />
                ) : null}
                {b.label}
                <span
                  className={`rounded-full px-1.5 py-0 text-[10px] ${
                    active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {b.count}
                </span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/30 p-6 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Award className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs font-bold">Nenhuma medalha nesta categoria por enquanto 🐝</p>
            <p className="text-[11px] text-muted-foreground">
              Continue interagindo na Bee para desbloquear conquistas.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden -mx-1">
            <MedalGrid
              earnedTypes={earnedTypes}
              onSelect={(spec) => onSelect(spec)}
              filterTypes={filteredTypes}
            />
          </div>
        )}
      </SettingsCard>

      {selectedMedal ? (
        <div
          className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Detalhes da medalha"
          onClick={(e) => {
            if (e.target === e.currentTarget) onSelect(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <MedalDetail
              spec={selectedMedal}
              earned={earnedTypes.includes(selectedMedal.type)}
              unlockedAt={selectedAchievement?.unlockedAt}
            />
            <Button className="mt-5 w-full" onClick={() => onSelect(null)}>
              Fechar
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
