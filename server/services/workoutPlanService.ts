// ── Geração de planos de treino baseados em objetivo/nível/preferências ───────
import {
  EXERCISE_LIBRARY,
  getExerciseById,
  type EquipmentType,
  type ExerciseLevel,
} from "../data/exerciseLibrary";
import type { WorkoutDayPlan } from "../../shared/schema";

export type HealthGoal =
  | "saude_geral"
  | "condicionamento"
  | "ganho_forca"
  | "resistencia"
  | "mobilidade"
  | "perda_gordura"
  | "hipertrofia"
  | "retorno_treinos"
  | "outro";

export type SplitType =
  | "full_body"
  | "upper_lower"
  | "push_pull_legs"
  | "abc"
  | "muscle_group"
  | "cardio_musculacao"
  | "custom";

export const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type WeekDay = typeof WEEK_DAYS[number];

export const WEEKDAY_LABELS_PT: Record<WeekDay, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

export const GOAL_LABELS: Record<HealthGoal, string> = {
  saude_geral: "Saúde geral",
  condicionamento: "Condicionamento",
  ganho_forca: "Ganho de força",
  resistencia: "Resistência",
  mobilidade: "Mobilidade",
  perda_gordura: "Perda de gordura com segurança",
  hipertrofia: "Hipertrofia com segurança",
  retorno_treinos: "Retorno gradual aos treinos",
  outro: "Outro",
};

export const LEVEL_LABELS: Record<ExerciseLevel, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export const SPLIT_LABELS: Record<SplitType, string> = {
  full_body: "Corpo inteiro",
  upper_lower: "Superiores e inferiores",
  push_pull_legs: "Push / Pull / Legs",
  abc: "ABC",
  muscle_group: "Por grupo muscular",
  cardio_musculacao: "Cardio + musculação",
  custom: "Personalizado",
};

interface PickExerciseOptions {
  muscleGroups: string[];
  count: number;
  level: ExerciseLevel;
  equipmentPref?: EquipmentType | "misto";
  avoidIds?: string[];
}

function levelOrder(l: ExerciseLevel): number {
  return l === "iniciante" ? 1 : l === "intermediario" ? 2 : 3;
}

function pickExercises({ muscleGroups, count, level, equipmentPref, avoidIds = [] }: PickExerciseOptions) {
  const maxLevel = levelOrder(level);
  const equipmentMatch = (eq: EquipmentType) => {
    if (!equipmentPref || equipmentPref === "misto") return true;
    return eq === equipmentPref;
  };

  const result: WorkoutDayPlan["exercises"] = [];
  for (const group of muscleGroups) {
    const candidates = EXERCISE_LIBRARY.filter((e) =>
      e.muscleGroup === group &&
      levelOrder(e.level) <= maxLevel &&
      !avoidIds.includes(e.id) &&
      equipmentMatch(e.equipment),
    );
    // Fallback: ignore equipment preference if nothing found
    const pool = candidates.length > 0
      ? candidates
      : EXERCISE_LIBRARY.filter((e) =>
          e.muscleGroup === group &&
          levelOrder(e.level) <= maxLevel &&
          !avoidIds.includes(e.id),
        );
    if (pool.length === 0) continue;
    const pick = pool[Math.min(count - 1, pool.length - 1)];
    if (pick) {
      result.push({
        name: pick.name,
        machine: pick.machine,
        muscleGroup: pick.muscleGroup,
        equipment: pick.equipment,
        sets: pick.defaultSets,
        reps: pick.defaultReps,
        restSeconds: pick.defaultRestSeconds,
        notes: pick.safetyNote,
        alternatives: (pick.alternatives ?? []).map((id) => getExerciseById(id)?.name ?? "").filter(Boolean),
      });
    }
  }
  return result;
}

interface DayTemplate {
  title: string;
  focus: string;
  groups: Array<{ muscle: string; count: number }>;
}

function splitTemplates(split: SplitType, dayCount: number): DayTemplate[] {
  switch (split) {
    case "full_body":
      return Array.from({ length: dayCount }, (_, i) => ({
        title: `Treino ${String.fromCharCode(65 + i)} — Corpo inteiro`,
        focus: "Corpo inteiro",
        groups: [
          { muscle: "pernas", count: 2 },
          { muscle: "peito", count: 1 },
          { muscle: "costas", count: 1 },
          { muscle: "ombros", count: 1 },
          { muscle: "abdomen", count: 1 },
        ],
      }));

    case "upper_lower":
      return Array.from({ length: dayCount }, (_, i) => {
        const isUpper = i % 2 === 0;
        return isUpper
          ? {
              title: `Treino ${String.fromCharCode(65 + i)} — Superiores`,
              focus: "Peito, costas, ombros, braços",
              groups: [
                { muscle: "peito", count: 2 },
                { muscle: "costas", count: 2 },
                { muscle: "ombros", count: 1 },
                { muscle: "biceps", count: 1 },
                { muscle: "triceps", count: 1 },
              ],
            }
          : {
              title: `Treino ${String.fromCharCode(65 + i)} — Inferiores`,
              focus: "Pernas, glúteos, abdômen",
              groups: [
                { muscle: "pernas", count: 3 },
                { muscle: "gluteos", count: 1 },
                { muscle: "panturrilha", count: 1 },
                { muscle: "abdomen", count: 1 },
              ],
            };
      });

    case "push_pull_legs": {
      const cycle = [
        {
          title: "Push (peito, ombro, tríceps)",
          focus: "Empurrar",
          groups: [
            { muscle: "peito", count: 2 },
            { muscle: "ombros", count: 2 },
            { muscle: "triceps", count: 1 },
          ],
        },
        {
          title: "Pull (costas, bíceps)",
          focus: "Puxar",
          groups: [
            { muscle: "costas", count: 3 },
            { muscle: "biceps", count: 2 },
          ],
        },
        {
          title: "Legs (pernas)",
          focus: "Pernas e glúteos",
          groups: [
            { muscle: "pernas", count: 3 },
            { muscle: "gluteos", count: 1 },
            { muscle: "panturrilha", count: 1 },
          ],
        },
      ];
      return Array.from({ length: dayCount }, (_, i) => {
        const c = cycle[i % 3];
        return { ...c, title: `Treino ${String.fromCharCode(65 + i)} — ${c.title}` };
      });
    }

    case "abc": {
      const cycle = [
        {
          title: "Peito, ombro e tríceps",
          focus: "Peito, ombros e tríceps",
          groups: [
            { muscle: "peito", count: 2 },
            { muscle: "ombros", count: 1 },
            { muscle: "triceps", count: 1 },
          ],
        },
        {
          title: "Costas e bíceps",
          focus: "Costas e bíceps",
          groups: [
            { muscle: "costas", count: 3 },
            { muscle: "biceps", count: 2 },
          ],
        },
        {
          title: "Pernas e abdômen",
          focus: "Pernas, glúteos e abdômen",
          groups: [
            { muscle: "pernas", count: 3 },
            { muscle: "gluteos", count: 1 },
            { muscle: "abdomen", count: 1 },
          ],
        },
      ];
      return Array.from({ length: dayCount }, (_, i) => {
        const c = cycle[i % 3];
        return { ...c, title: `Treino ${String.fromCharCode(65 + i)} — ${c.title}` };
      });
    }

    case "cardio_musculacao":
      return Array.from({ length: dayCount }, (_, i) => {
        const isCardio = i % 2 === 1;
        return isCardio
          ? {
              title: `Treino ${String.fromCharCode(65 + i)} — Cardio + abdômen`,
              focus: "Cardio e core",
              groups: [
                { muscle: "cardio", count: 1 },
                { muscle: "abdomen", count: 2 },
              ],
            }
          : {
              title: `Treino ${String.fromCharCode(65 + i)} — Musculação geral`,
              focus: "Corpo inteiro",
              groups: [
                { muscle: "pernas", count: 1 },
                { muscle: "peito", count: 1 },
                { muscle: "costas", count: 1 },
                { muscle: "ombros", count: 1 },
              ],
            };
      });

    default:
      return splitTemplates("full_body", dayCount);
  }
}

function suggestedSplitFor(goal: HealthGoal, dayCount: number): SplitType {
  if (dayCount <= 3) return "full_body";
  if (dayCount === 4) return "upper_lower";
  if (goal === "hipertrofia" || goal === "ganho_forca") return "push_pull_legs";
  if (goal === "perda_gordura" || goal === "condicionamento") return "cardio_musculacao";
  return "abc";
}

export interface BuildPlanInput {
  trainingDays: WeekDay[];
  restDays?: WeekDay[];
  goal: HealthGoal;
  level: ExerciseLevel;
  equipmentPreference?: EquipmentType | "misto";
  splitType?: SplitType;
  avoidExercises?: string[];
  name?: string;
}

export interface BuildPlanOutput {
  name: string;
  goal: HealthGoal;
  level: ExerciseLevel;
  splitType: SplitType;
  trainingDays: WeekDay[];
  restDays: WeekDay[];
  days: WorkoutDayPlan[];
}

export function buildWorkoutPlan(input: BuildPlanInput): BuildPlanOutput {
  const trainingDays = input.trainingDays.length ? input.trainingDays : ["monday", "wednesday", "friday"] as WeekDay[];
  const restDays = (input.restDays && input.restDays.length)
    ? input.restDays
    : WEEK_DAYS.filter((d) => !trainingDays.includes(d)) as WeekDay[];

  const split = input.splitType ?? suggestedSplitFor(input.goal, trainingDays.length);
  const templates = splitTemplates(split, trainingDays.length);

  const days: WorkoutDayPlan[] = [];

  // Restdays first
  for (const d of restDays) {
    days.push({ day: d, title: "Descanso", focus: "Recuperação", type: "rest", exercises: [] });
  }

  // Trainingdays
  trainingDays.forEach((day, i) => {
    const tpl = templates[i] ?? templates[0];
    const exercises = pickExercises({
      muscleGroups: tpl.groups.flatMap((g) => Array(g.count).fill(g.muscle)),
      count: 1,
      level: input.level,
      equipmentPref: input.equipmentPreference,
      avoidIds: input.avoidExercises ?? [],
    });
    days.push({
      day,
      title: tpl.title,
      focus: tpl.focus,
      type: "training",
      exercises,
    });
  });

  // Sort by week-day order
  days.sort((a, b) => WEEK_DAYS.indexOf(a.day as WeekDay) - WEEK_DAYS.indexOf(b.day as WeekDay));

  const baseName = input.name ?? `Treino ${trainingDays.length}x por semana`;

  return {
    name: baseName,
    goal: input.goal,
    level: input.level,
    splitType: split,
    trainingDays,
    restDays,
    days,
  };
}

// ── Resumo amigável da semana ─────────────────────────────────────────────────

export function buildWeeklySummary(plan: BuildPlanOutput, sessions: Array<{ dayKey: string; date: Date; completed: boolean }>) {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const recent = sessions.filter((s) => s.date >= weekStart);
  const completed = recent.filter((s) => s.completed).length;
  const planned = plan.trainingDays.length;
  return {
    plannedThisWeek: planned,
    completedThisWeek: completed,
    consistencyRatio: planned > 0 ? Math.round((completed / planned) * 100) : 0,
    nextWorkoutDay: nextTrainingDayFromToday(plan.trainingDays as WeekDay[]),
  };
}

function nextTrainingDayFromToday(trainingDays: WeekDay[]): WeekDay | null {
  if (!trainingDays.length) return null;
  const today = new Date().getDay(); // 0=Sun..6=Sat
  const map = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  for (let i = 0; i < 7; i++) {
    const day = map[(today + i) % 7];
    if (trainingDays.includes(day as WeekDay)) return day as WeekDay;
  }
  return trainingDays[0];
}
