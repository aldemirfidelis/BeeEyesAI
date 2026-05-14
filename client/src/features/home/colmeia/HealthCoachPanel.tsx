import { useEffect, useState, useCallback } from "react";
import {
  Activity, Heart, Droplet, ClipboardList, CheckSquare,
  TrendingUp, AlertCircle, Edit3, Plus, Play, X, Save,
  ChevronDown, Target, Check,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────

type WeekDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

type HealthGoal =
  | "saude_geral" | "condicionamento" | "ganho_forca" | "resistencia"
  | "mobilidade" | "perda_gordura" | "hipertrofia" | "retorno_treinos" | "outro";

type FitnessLevel = "iniciante" | "intermediario" | "avancado";

type EquipmentPref = "aparelho" | "halter" | "barra" | "peso_corporal" | "cabo" | "esteira" | "bicicleta" | "eliptico" | "outro" | "misto";

type SplitType = "full_body" | "upper_lower" | "push_pull_legs" | "abc" | "muscle_group" | "cardio_musculacao" | "custom";

interface Exercise {
  name: string;
  machine?: string;
  muscleGroup?: string;
  equipment?: string;
  sets?: number;
  reps?: string;
  durationMin?: number;
  restSeconds?: number;
  notes?: string;
  alternatives?: string[];
}

interface WorkoutDayPlan {
  day: WeekDay;
  title: string;
  focus?: string;
  type: "training" | "rest";
  exercises: Exercise[];
}

interface WorkoutPlan {
  id: string;
  name: string;
  goal: HealthGoal;
  level: FitnessLevel;
  splitType: SplitType;
  trainingDays: WeekDay[];
  restDays: WeekDay[];
  days: WorkoutDayPlan[];
  active: boolean;
}

interface HealthProfile {
  id: string;
  healthGoal: HealthGoal;
  level: FitnessLevel;
  trainingDays: WeekDay[];
  restDays: WeekDay[];
  preferredWorkoutTime: string | null;
  equipmentPreference: EquipmentPref;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
}

interface HealthSummary {
  plan: WorkoutPlan | null;
  summary: {
    plannedThisWeek: number;
    completedThisWeek: number;
    consistencyRatio: number;
    nextWorkoutDay: WeekDay | null;
  };
}

const WEEK_ORDER: WeekDay[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const WEEK_DAYS_PT: Record<WeekDay, string> = {
  monday: "Segunda", tuesday: "Terça", wednesday: "Quarta",
  thursday: "Quinta", friday: "Sexta", saturday: "Sábado", sunday: "Domingo",
};

const WEEK_DAYS_SHORT_PT: Record<WeekDay, string> = {
  monday: "Seg", tuesday: "Ter", wednesday: "Qua",
  thursday: "Qui", friday: "Sex", saturday: "Sáb", sunday: "Dom",
};

const GOAL_LABELS_PT: Record<HealthGoal, string> = {
  saude_geral: "Saúde geral", condicionamento: "Condicionamento",
  ganho_forca: "Ganho de força", resistencia: "Resistência",
  mobilidade: "Mobilidade", perda_gordura: "Perda de gordura",
  hipertrofia: "Hipertrofia", retorno_treinos: "Retorno aos treinos", outro: "Outro",
};

const LEVEL_LABELS_PT: Record<FitnessLevel, string> = {
  iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado",
};

const EQUIPMENT_LABELS_PT: Record<EquipmentPref, string> = {
  misto: "Misto", aparelho: "Aparelho", halter: "Halter", barra: "Barra",
  peso_corporal: "Peso corporal", cabo: "Cabo", esteira: "Esteira",
  bicicleta: "Bicicleta", eliptico: "Elíptico", outro: "Outro",
};

const SPLIT_OPTIONS: Array<{ value: SplitType; label: string; hint: string }> = [
  { value: "full_body", label: "Corpo inteiro", hint: "2-3 dias/sem ou iniciantes" },
  { value: "upper_lower", label: "Superiores e inferiores", hint: "Ideal para 4 dias/sem" },
  { value: "push_pull_legs", label: "Push / Pull / Legs", hint: "5-6 dias/sem" },
  { value: "abc", label: "ABC", hint: "3 treinos rotativos" },
  { value: "cardio_musculacao", label: "Cardio + musculação", hint: "Equilibrado p/ perda de gordura" },
];

function todayWeekDay(): WeekDay {
  const map: WeekDay[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return map[new Date().getDay()];
}

function unwrap<T>(d: any): T {
  return d && typeof d === "object" && "data" in d ? (d.data as T) : (d as T);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await apiRequest("GET", url);
  return unwrap<T>(await res.json());
}
async function patchJson<T>(url: string, body: any): Promise<T> {
  const res = await apiRequest("PATCH", url, body);
  return unwrap<T>(await res.json());
}
async function postJson<T>(url: string, body: any): Promise<T> {
  const res = await apiRequest("POST", url, body);
  return unwrap<T>(await res.json());
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HealthCoachPanel() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [summary, setSummary] = useState<HealthSummary["summary"] | null>(null);

  // Onboarding mínimo
  const [obGoal, setObGoal] = useState<HealthGoal | null>(null);
  const [obLevel, setObLevel] = useState<FitnessLevel | null>(null);
  const [savingOb, setSavingOb] = useState(false);

  // Creation flow
  const [showCreate, setShowCreate] = useState(false);
  const [showWorkout, setShowWorkout] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, sum] = await Promise.all([
        fetchJson<HealthProfile>("/api/health/profile").catch(() => null),
        fetchJson<HealthSummary>("/api/health/summary").catch(() => null),
      ]);
      setProfile(p);
      setActivePlan(sum?.plan ?? null);
      setSummary(sum?.summary ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function completeOnboarding() {
    if (!obGoal || !obLevel) return;
    setSavingOb(true);
    try {
      const updated = await patchJson<HealthProfile>("/api/health/profile", {
        healthGoal: obGoal,
        level: obLevel,
        trainingDays: ["monday", "wednesday", "friday"] as WeekDay[],
        restDays: ["tuesday", "thursday", "saturday", "sunday"] as WeekDay[],
      });
      setProfile(updated);
      setObGoal(null);
      setObLevel(null);
    } finally {
      setSavingOb(false);
    }
  }

  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center h-40">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Onboarding: sem perfil completo
  if (!profile || (!activePlan && !profile.healthGoal)) {
    return (
      <div className="p-5 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/15 flex items-center justify-center">
            <Heart className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-lg font-black">Coach de Saúde 🐝💪</h3>
          <p className="text-sm text-muted-foreground">
            Vamos começar com seu objetivo e nível. Você pode ajustar depois.
          </p>
        </div>

        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2">Objetivo</p>
          <div className="space-y-2">
            {(["saude_geral", "perda_gordura", "hipertrofia", "condicionamento"] as HealthGoal[]).map((g) => (
              <button
                key={g}
                onClick={() => setObGoal(g)}
                className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  obGoal === g ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                }`}
              >
                <Target className={`w-4 h-4 ${obGoal === g ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-semibold flex-1 ${obGoal === g ? "text-primary" : ""}`}>
                  {GOAL_LABELS_PT[g]}
                </span>
                {obGoal === g && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2">Nível</p>
          <div className="space-y-2">
            {(["iniciante", "intermediario", "avancado"] as FitnessLevel[]).map((l) => (
              <button
                key={l}
                onClick={() => setObLevel(l)}
                className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  obLevel === l ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                }`}
              >
                <span className={`text-sm font-semibold flex-1 ${obLevel === l ? "text-primary" : ""}`}>
                  {LEVEL_LABELS_PT[l]}
                </span>
                {obLevel === l && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={completeOnboarding}
          disabled={!obGoal || !obLevel || savingOb}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          {savingOb ? "Salvando..." : "Salvar e continuar"}
        </button>

        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary py-3 text-sm font-bold text-primary"
        >
          <Plus className="w-4 h-4" />
          Criar meu primeiro treino
        </button>

        {showCreate && (
          <CreateWorkoutModal
            initialProfile={profile}
            onClose={() => setShowCreate(false)}
            onSaved={() => { setShowCreate(false); loadAll(); }}
          />
        )}
      </div>
    );
  }

  const todayKey = todayWeekDay();
  const todayPlanDay = activePlan?.days.find((d) => d.day === todayKey);
  const isTrainingToday = todayPlanDay?.type === "training";

  return (
    <div className="p-5 space-y-4">
      {/* Profile / Plano ativo */}
      <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
        <Heart className="w-5 h-5 text-red-500" />
        <div className="flex-1">
          <p className="font-bold text-sm">{activePlan?.name ?? GOAL_LABELS_PT[profile.healthGoal]}</p>
          <p className="text-xs text-muted-foreground">
            {LEVEL_LABELS_PT[profile.level]} · {profile.trainingDays.length}x por semana
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-bold hover:bg-primary/25"
        >
          <Edit3 className="w-3 h-3" />
          {activePlan ? "Editar" : "Criar"}
        </button>
      </div>

      {/* Resumo semanal */}
      {summary && activePlan && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <p className="font-bold text-sm">Sua semana</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/30 rounded-xl py-3 text-center">
              <p className="text-2xl font-black">{summary.completedThisWeek}</p>
              <p className="text-[10px] text-muted-foreground">concluídos</p>
            </div>
            <div className="bg-muted/30 rounded-xl py-3 text-center">
              <p className="text-2xl font-black">{summary.plannedThisWeek}</p>
              <p className="text-[10px] text-muted-foreground">planejados</p>
            </div>
            <div className="bg-muted/30 rounded-xl py-3 text-center">
              <p className="text-2xl font-black">{summary.consistencyRatio}%</p>
              <p className="text-[10px] text-muted-foreground">consistência</p>
            </div>
          </div>
          {summary.consistencyRatio > 0 && summary.consistencyRatio < 100 && (
            <p className="text-xs italic text-muted-foreground">
              Você está construindo consistência aos poucos. Continue 🐝✨
            </p>
          )}
          {summary.consistencyRatio === 100 && (
            <p className="text-xs italic text-muted-foreground">
              Você fechou a semana! 🐝 Dia de descanso também é parte do progresso.
            </p>
          )}
        </div>
      )}

      {/* Treino do dia */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <p className="font-bold text-sm flex-1">Treino de Hoje</p>
          <span className="text-[10px] font-mono text-muted-foreground">{WEEK_DAYS_SHORT_PT[todayKey]}</span>
        </div>

        {!activePlan ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm font-bold text-primary hover:bg-primary/5"
          >
            <Plus className="w-4 h-4" />
            Criar plano de treino
          </button>
        ) : !isTrainingToday ? (
          <div className="text-center py-4">
            <p className="text-sm font-bold text-muted-foreground">😴 Dia de descanso</p>
            <p className="text-xs text-muted-foreground mt-1">Recuperação é parte do treino. Hidrate-se!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-primary">{todayPlanDay?.title}</p>
              <p className="text-xs text-muted-foreground">{todayPlanDay?.exercises.length} exercícios</p>
            </div>
            <button
              onClick={() => setShowWorkout(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
            >
              <Play className="w-4 h-4" />
              Iniciar treino
            </button>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3">
        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          As sugestões da Bee são gerais. Em caso de dor, doença ou restrição, procure um profissional de educação
          física ou de saúde.
        </p>
      </div>

      {showCreate && (
        <CreateWorkoutModal
          initialProfile={profile}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); loadAll(); }}
        />
      )}

      {showWorkout && activePlan && todayPlanDay?.type === "training" && (
        <WorkoutSessionModal
          plan={activePlan}
          dayKey={todayKey}
          onClose={() => setShowWorkout(false)}
          onCompleted={() => { setShowWorkout(false); loadAll(); }}
        />
      )}
    </div>
  );
}

// ── Create workout modal ──────────────────────────────────────────────────────

function CreateWorkoutModal({ initialProfile, onClose, onSaved }: {
  initialProfile: HealthProfile | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Meu treino");
  const [goal, setGoal] = useState<HealthGoal>(initialProfile?.healthGoal ?? "saude_geral");
  const [level, setLevel] = useState<FitnessLevel>(initialProfile?.level ?? "iniciante");
  const [trainingDays, setTrainingDays] = useState<WeekDay[]>(
    (initialProfile?.trainingDays as WeekDay[]) ?? ["monday", "wednesday", "friday"],
  );
  const [equipment, setEquipment] = useState<EquipmentPref>(initialProfile?.equipmentPreference ?? "misto");
  const [splitType, setSplitType] = useState<SplitType | "auto">("auto");
  const [reminderEnabled, setReminderEnabled] = useState(initialProfile?.reminderEnabled ?? false);
  const [time, setTime] = useState(initialProfile?.preferredWorkoutTime ?? "18:30");
  const [reminderMinutes, setReminderMinutes] = useState<number>(initialProfile?.reminderMinutesBefore ?? 30);
  const [saving, setSaving] = useState(false);

  function toggleDay(d: WeekDay) {
    setTrainingDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d)
                       : [...prev, d].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b))
    );
  }

  async function save() {
    if (trainingDays.length === 0) return;
    setSaving(true);
    try {
      await patchJson("/api/health/profile", {
        healthGoal: goal, level, trainingDays,
        restDays: WEEK_ORDER.filter((d) => !trainingDays.includes(d)),
        equipmentPreference: equipment,
        preferredWorkoutTime: time || null,
        reminderEnabled,
        reminderMinutesBefore: reminderMinutes,
      });
      const created = await postJson<WorkoutPlan>("/api/health/workout-plans", {
        name, goal, level, trainingDays,
        equipmentPreference: equipment,
        splitType: splitType === "auto" ? undefined : splitType,
        createdBy: "user",
      });
      if (reminderEnabled && created?.id) {
        try {
          await postJson(`/api/health/workout-plans/${created.id}/sync-calendar`, {
            weeks: 4,
            time: time || "18:30",
            reminderMinutesBefore: reminderMinutes,
          });
        } catch {}
      }
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between sticky top-0 bg-card pb-2 -mt-2 pt-2 border-b border-border">
          <div>
            <h3 className="font-black">Criar plano de treino</h3>
            <p className="text-xs text-muted-foreground">Etapa {step + 1} de 5</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 0 && (
          <div className="space-y-2">
            <p className="text-sm font-bold">Qual seu objetivo principal?</p>
            {(Object.keys(GOAL_LABELS_PT) as HealthGoal[]).filter((g) => g !== "outro").map((g) => (
              <button
                key={g}
                onClick={() => setGoal(g)}
                className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  goal === g ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                }`}
              >
                <Target className={`w-4 h-4 ${goal === g ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-semibold flex-1 ${goal === g ? "text-primary" : ""}`}>
                  {GOAL_LABELS_PT[g]}
                </span>
                {goal === g && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <p className="text-sm font-bold">Qual seu nível hoje?</p>
            {(["iniciante", "intermediario", "avancado"] as FitnessLevel[]).map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  level === l ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                }`}
              >
                <span className={`text-sm font-semibold flex-1 ${level === l ? "text-primary" : ""}`}>
                  {LEVEL_LABELS_PT[l]}
                </span>
                {level === l && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <p className="text-sm font-bold">Quais dias você quer treinar?</p>
            <p className="text-xs text-muted-foreground">Outros dias viram descanso automaticamente.</p>
            {WEEK_ORDER.map((d) => {
              const selected = trainingDays.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                    selected ? "bg-primary border-primary" : "border-border"
                  }`}>
                    {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span className={`text-sm font-semibold flex-1 ${selected ? "text-foreground" : "text-muted-foreground"}`}>
                    {WEEK_DAYS_PT[d]}
                  </span>
                  <span className={`text-[10px] font-bold ${selected ? "text-primary" : "text-muted-foreground"}`}>
                    {selected ? "treino" : "descanso"}
                  </span>
                </button>
              );
            })}
            <p className="text-xs text-center text-muted-foreground pt-1">
              {trainingDays.length} dia{trainingDays.length === 1 ? "" : "s"} por semana
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <p className="text-sm font-bold">Preferência de equipamento</p>
            {(["misto", "aparelho", "halter", "peso_corporal"] as EquipmentPref[]).map((e) => (
              <button
                key={e}
                onClick={() => setEquipment(e)}
                className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  equipment === e ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                }`}
              >
                <span className={`text-sm font-semibold flex-1 ${equipment === e ? "text-primary" : ""}`}>
                  {EQUIPMENT_LABELS_PT[e]}
                </span>
                {equipment === e && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2">
            <p className="text-sm font-bold">Confirmar e salvar</p>
            <label className="text-xs font-bold text-muted-foreground">Nome do plano</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <label className="text-xs font-bold text-muted-foreground mt-2 block">Horário preferido (HH:MM)</label>
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="18:30"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <label className="flex items-center justify-between mt-2 cursor-pointer">
              <span className="text-xs font-bold text-muted-foreground">Lembrete antes do treino</span>
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="w-4 h-4"
              />
            </label>
            {reminderEnabled && (
              <>
                <label className="text-xs font-bold text-muted-foreground">Minutos antes</label>
                <input
                  type="number"
                  value={reminderMinutes}
                  onChange={(e) => setReminderMinutes(parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="text-[10px] italic text-muted-foreground">
                  A Bee vai criar eventos no Calendário e te lembrar antes de cada treino 🐝
                </p>
              </>
            )}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1 mt-2">
              <p className="text-xs font-bold text-primary mb-1">Resumo</p>
              <p className="text-xs">Objetivo: {GOAL_LABELS_PT[goal]}</p>
              <p className="text-xs">Nível: {LEVEL_LABELS_PT[level]}</p>
              <p className="text-xs">Dias: {trainingDays.map((d) => WEEK_DAYS_PT[d]).join(", ")}</p>
              <p className="text-xs">Equipamento: {EQUIPMENT_LABELS_PT[equipment]}</p>
              {splitType !== "auto" && (
                <p className="text-xs">Divisão: {SPLIT_OPTIONS.find((s) => s.value === splitType)?.label}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 sticky bottom-0 bg-card pt-2 -mb-2 pb-2 border-t border-border">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-bold"
            >
              Voltar
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
            >
              Continuar
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar plano"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Workout session modal ─────────────────────────────────────────────────────

function WorkoutSessionModal({ plan, dayKey, onClose, onCompleted }: {
  plan: WorkoutPlan;
  dayKey: WeekDay;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const dayPlan = plan.days.find((d) => d.day === dayKey);
  const exercises = dayPlan?.exercises ?? [];

  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<Record<number, "done" | "skipped">>({});
  const [effort, setEffort] = useState<"leve" | "moderado" | "intenso">("moderado");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const completedCount = Object.values(status).filter((s) => s === "done").length;
  const skippedCount = Object.values(status).filter((s) => s === "skipped").length;
  const progress = exercises.length > 0 ? completedCount / exercises.length : 0;

  async function finish() {
    if (!startedAt) return;
    setSaving(true);
    try {
      const durationMs = Date.now() - startedAt.getTime();
      const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
      await postJson(`/api/health/workout-plans/${plan.id}/complete`, {
        dayKey, durationMinutes,
        exercisesCompleted: completedCount,
        exercisesSkipped: skippedCount,
        effortLevel: effort,
        notes: notes || undefined,
        exerciseLog: exercises.map((ex, i) => ({
          name: ex.name,
          done: status[i] === "done",
          skipped: status[i] === "skipped",
        })),
      });
      onCompleted();
    } finally {
      setSaving(false);
    }
  }

  function toggle(idx: number, s: "done" | "skipped") {
    setStatus((prev) => {
      if (prev[idx] === s) {
        const { [idx]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [idx]: s };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between sticky top-0 bg-card -mt-2 pt-2 pb-2 border-b border-border">
          <div>
            <h3 className="font-black">{dayPlan?.title}</h3>
            <p className="text-xs text-muted-foreground">{WEEK_DAYS_PT[dayKey]} · {exercises.length} exercícios</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {startedAt && (
          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="text-[10px] font-mono text-right text-muted-foreground">
              {completedCount}/{exercises.length} concluídos
            </p>
          </div>
        )}

        <div className="space-y-2">
          {exercises.map((ex, idx) => {
            const s = status[idx];
            return (
              <div
                key={idx}
                className={`rounded-xl border p-3 ${
                  s === "done" ? "border-emerald-500 bg-emerald-500/5"
                  : s === "skipped" ? "opacity-50 border-border"
                  : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-bold flex-1 ${s === "done" ? "line-through" : ""}`}>
                    {ex.name}
                  </p>
                  {s === "done" && <Check className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className="flex gap-1 flex-wrap mt-1">
                  {ex.muscleGroup && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50">{ex.muscleGroup}</span>}
                  {ex.machine && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50">{ex.machine}</span>}
                </div>
                <p className="text-[11px] font-mono text-muted-foreground mt-1">
                  {ex.sets ? `${ex.sets}x ${ex.reps ?? ""}` : ex.durationMin ? `${ex.durationMin} min` : ""}
                  {ex.restSeconds ? ` · descanso ${ex.restSeconds}s` : ""}
                </p>
                {ex.notes && <p className="text-[10px] italic text-muted-foreground mt-1">💡 {ex.notes}</p>}

                {startedAt && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => toggle(idx, "done")}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-bold border ${
                        s === "done" ? "bg-emerald-500 text-white border-emerald-500" : "border-border"
                      }`}
                    >
                      ✓ Concluir
                    </button>
                    <button
                      onClick={() => toggle(idx, "skipped")}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-bold border ${
                        s === "skipped" ? "bg-muted text-white border-muted" : "border-border"
                      }`}
                    >
                      Pular
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!startedAt ? (
          <button
            onClick={() => setStartedAt(new Date())}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
          >
            <Play className="w-4 h-4" />
            Iniciar treino
          </button>
        ) : (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-xs font-bold text-muted-foreground">Como foi o esforço?</p>
            <div className="flex gap-2">
              {(["leve", "moderado", "intenso"] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setEffort(e)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold border ${
                    effort === e ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  {e[0].toUpperCase() + e.slice(1)}
                </button>
              ))}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações (opcional)"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
              rows={3}
            />
            <button
              onClick={finish}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Salvando..." : "Salvar sessão"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
