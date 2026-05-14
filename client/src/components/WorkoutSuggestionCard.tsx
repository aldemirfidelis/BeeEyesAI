import { useState } from "react";
import { Activity, ChevronDown, ChevronUp, Save, Check, Edit3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type WeekDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

const WEEK_DAYS_PT: Record<WeekDay, string> = {
  monday: "Seg", tuesday: "Ter", wednesday: "Qua",
  thursday: "Qui", friday: "Sex", saturday: "Sáb", sunday: "Dom",
};

const WEEK_DAYS_FULL_PT: Record<WeekDay, string> = {
  monday: "Segunda", tuesday: "Terça", wednesday: "Quarta",
  thursday: "Quinta", friday: "Sexta", saturday: "Sábado", sunday: "Domingo",
};

const GOAL_LABELS: Record<string, string> = {
  saude_geral: "Saúde geral", condicionamento: "Condicionamento",
  ganho_forca: "Ganho de força", resistencia: "Resistência",
  mobilidade: "Mobilidade", perda_gordura: "Perda de gordura",
  hipertrofia: "Hipertrofia", retorno_treinos: "Retorno aos treinos",
};

const LEVEL_LABELS: Record<string, string> = {
  iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado",
};

interface Exercise {
  name: string;
  machine?: string;
  muscleGroup?: string;
  sets?: number;
  reps?: string;
  durationMin?: number;
}

interface DayPlan {
  day: WeekDay;
  title: string;
  type: "training" | "rest";
  exercises: Exercise[];
}

export interface WorkoutSuggestionPlan {
  name: string;
  goal: string;
  level: string;
  splitType: string;
  trainingDays: WeekDay[];
  restDays: WeekDay[];
  days: DayPlan[];
}

interface Props {
  plan: WorkoutSuggestionPlan;
  onSaved?: () => void;
}

export function WorkoutSuggestionCard({ plan, onSaved }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await apiRequest("POST", "/api/health/workout-plans", {
        name: plan.name,
        goal: plan.goal,
        level: plan.level,
        splitType: plan.splitType,
        trainingDays: plan.trainingDays,
        restDays: plan.restDays,
        days: plan.days,
        createdBy: "bee",
      });
      setSaved(true);
      onSaved?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const trainingDays = plan.days.filter((d) => d.type === "training");

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
          <Activity className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm">{plan.name}</p>
          <p className="text-xs text-muted-foreground">
            {GOAL_LABELS[plan.goal] ?? plan.goal} · {LEVEL_LABELS[plan.level] ?? plan.level} · {plan.trainingDays.length}x/sem
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {plan.trainingDays.map((d) => (
          <span key={d} className="px-2 py-1 rounded-md bg-primary/10 text-[10px] font-bold text-primary">
            {WEEK_DAYS_PT[d]}
          </span>
        ))}
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground"
      >
        <span>{expanded ? "Ocultar exercícios" : `Ver ${trainingDays.length} treinos`}</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {trainingDays.map((d) => (
            <div key={d.day} className="border-t border-border/50 pt-2">
              <p className="text-xs font-bold text-primary mb-1">
                {WEEK_DAYS_FULL_PT[d.day]} — {d.title}
              </p>
              {d.exercises.slice(0, 6).map((ex, i) => (
                <p key={i} className="text-xs">
                  • {ex.name}
                  {ex.sets ? ` · ${ex.sets}x${ex.reps ?? ""}` : ex.durationMin ? ` · ${ex.durationMin}min` : ""}
                </p>
              ))}
              {d.exercises.length > 6 && (
                <p className="text-[10px] italic text-muted-foreground">+ {d.exercises.length - 6} exercícios</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition ${
            saved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground disabled:opacity-50"
          }`}
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Salvo!" : saving ? "Salvando..." : "Salvar plano"}
        </button>
      </div>

      <p className="text-[10px] italic text-muted-foreground">
        Sugestões da Bee são gerais. Adapte ao seu corpo e consulte um profissional se precisar 🐝
      </p>
    </div>
  );
}
