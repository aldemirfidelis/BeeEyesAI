import { api } from "../lib/api";

export type WeekDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export type HealthGoal =
  | "saude_geral" | "condicionamento" | "ganho_forca" | "resistencia"
  | "mobilidade" | "perda_gordura" | "hipertrofia" | "retorno_treinos" | "outro";

export type FitnessLevel = "iniciante" | "intermediario" | "avancado";

export type EquipmentPref = "aparelho" | "halter" | "barra" | "peso_corporal" | "cabo" | "esteira" | "bicicleta" | "eliptico" | "outro" | "misto";

export type SplitType = "full_body" | "upper_lower" | "push_pull_legs" | "abc" | "muscle_group" | "cardio_musculacao" | "custom";

export interface Exercise {
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

export interface WorkoutDayPlan {
  day: WeekDay;
  title: string;
  focus?: string;
  type: "training" | "rest";
  exercises: Exercise[];
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  goal: HealthGoal;
  level: FitnessLevel;
  splitType: SplitType;
  trainingDays: WeekDay[];
  restDays: WeekDay[];
  days: WorkoutDayPlan[];
  active: boolean;
  createdBy: "user" | "bee";
  createdAt: string;
  updatedAt: string;
}

export interface HealthProfile {
  id: string;
  userId: string;
  healthGoal: HealthGoal;
  level: FitnessLevel;
  trainingDays: WeekDay[];
  restDays: WeekDay[];
  preferredWorkoutTime: string | null;
  equipmentPreference: EquipmentPref;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  avoidExercises: string[];
  notes: string | null;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  workoutPlanId: string | null;
  dayKey: WeekDay;
  date: string;
  completed: boolean;
  durationMinutes: number | null;
  exercisesCompleted: number;
  exercisesSkipped: number;
  effortLevel: string | null;
  mood: string | null;
  notes: string | null;
  exerciseLog: Array<{ name: string; done: boolean; skipped?: boolean }>;
}

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  machine?: string;
  level: string;
  description: string;
  defaultSets: number;
  defaultReps: string;
  defaultRestSeconds: number;
  safetyNote: string;
  alternatives?: string[];
}

export const WEEK_DAYS_PT: Record<WeekDay, string> = {
  monday: "Segunda", tuesday: "Terça", wednesday: "Quarta",
  thursday: "Quinta", friday: "Sexta", saturday: "Sábado", sunday: "Domingo",
};

export const WEEK_DAYS_SHORT_PT: Record<WeekDay, string> = {
  monday: "Seg", tuesday: "Ter", wednesday: "Qua",
  thursday: "Qui", friday: "Sex", saturday: "Sáb", sunday: "Dom",
};

export const GOAL_LABELS_PT: Record<HealthGoal, string> = {
  saude_geral: "Saúde geral",
  condicionamento: "Condicionamento",
  ganho_forca: "Ganho de força",
  resistencia: "Resistência",
  mobilidade: "Mobilidade",
  perda_gordura: "Perda de gordura",
  hipertrofia: "Hipertrofia",
  retorno_treinos: "Retorno aos treinos",
  outro: "Outro",
};

export const LEVEL_LABELS_PT: Record<FitnessLevel, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export const EQUIPMENT_LABELS_PT: Record<EquipmentPref, string> = {
  misto: "Misto",
  aparelho: "Aparelho",
  halter: "Halter",
  barra: "Barra",
  peso_corporal: "Peso corporal",
  cabo: "Cabo/polia",
  esteira: "Esteira",
  bicicleta: "Bicicleta",
  eliptico: "Elíptico",
  outro: "Outro",
};

function unwrap<T>(data: any): T {
  if (data && typeof data === "object" && "data" in data) return data.data as T;
  return data as T;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getHealthProfile(): Promise<HealthProfile> {
  const { data } = await api.get("/api/health/profile");
  return unwrap<HealthProfile>(data);
}

export async function updateHealthProfile(patch: Partial<HealthProfile>): Promise<HealthProfile> {
  const { data } = await api.patch("/api/health/profile", patch);
  return unwrap<HealthProfile>(data);
}

// ── Workout plans ─────────────────────────────────────────────────────────────

export async function listWorkoutPlans(): Promise<WorkoutPlan[]> {
  const { data } = await api.get("/api/health/workout-plans");
  const u = unwrap<{ plans: WorkoutPlan[] }>(data);
  return u.plans;
}

export async function getActiveWorkoutPlan(): Promise<WorkoutPlan | null> {
  const { data } = await api.get("/api/health/workout-plans/active");
  const u = unwrap<{ plan: WorkoutPlan | null }>(data);
  return u.plan;
}

export interface CreatePlanInput {
  name?: string;
  goal?: HealthGoal;
  level?: FitnessLevel;
  splitType?: SplitType;
  trainingDays: WeekDay[];
  restDays?: WeekDay[];
  equipmentPreference?: EquipmentPref;
  avoidExercises?: string[];
  createdBy?: "user" | "bee";
  days?: WorkoutDayPlan[];
}

export async function createWorkoutPlan(input: CreatePlanInput): Promise<WorkoutPlan> {
  const { data } = await api.post("/api/health/workout-plans", input);
  return unwrap<WorkoutPlan>(data);
}

export async function updateWorkoutPlan(id: string, patch: Partial<WorkoutPlan>): Promise<WorkoutPlan> {
  const { data } = await api.put(`/api/health/workout-plans/${id}`, patch);
  return unwrap<WorkoutPlan>(data);
}

export async function deleteWorkoutPlan(id: string): Promise<void> {
  await api.delete(`/api/health/workout-plans/${id}`);
}

export async function syncCalendar(id: string, opts?: { weeks?: number; time?: string; reminderMinutesBefore?: number | null }): Promise<{ eventsCreated: number; alarmsCreated: number; weeks: number }> {
  const { data } = await api.post(`/api/health/workout-plans/${id}/sync-calendar`, opts ?? {});
  return unwrap(data);
}

export async function completeWorkout(id: string, payload: {
  dayKey: WeekDay;
  durationMinutes?: number;
  exercisesCompleted?: number;
  exercisesSkipped?: number;
  effortLevel?: "leve" | "moderado" | "intenso";
  mood?: string;
  notes?: string;
  exerciseLog?: Array<{ name: string; done: boolean; skipped?: boolean }>;
}): Promise<WorkoutSession> {
  const { data } = await api.post(`/api/health/workout-plans/${id}/complete`, payload);
  return unwrap<WorkoutSession>(data);
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function listSessions(days = 30): Promise<WorkoutSession[]> {
  const { data } = await api.get(`/api/health/sessions?days=${days}`);
  const u = unwrap<{ sessions: WorkoutSession[] }>(data);
  return u.sessions;
}

// ── Summary ───────────────────────────────────────────────────────────────────

export interface HealthSummary {
  plan: WorkoutPlan | null;
  summary: {
    plannedThisWeek: number;
    completedThisWeek: number;
    consistencyRatio: number;
    nextWorkoutDay: WeekDay | null;
  };
  recentSessions: WorkoutSession[];
}

export async function getHealthSummary(): Promise<HealthSummary> {
  const { data } = await api.get("/api/health/summary");
  return unwrap<HealthSummary>(data);
}

// ── Exercise library ──────────────────────────────────────────────────────────

export interface ExerciseLibraryResponse {
  exercises: ExerciseLibraryItem[];
  muscleGroups: Record<string, string>;
  equipmentTypes: Record<string, string>;
  goals: Record<string, string>;
  levels: Record<string, string>;
  splits: Record<string, string>;
  weekDays: Record<string, string>;
}

export async function getExerciseLibrary(filter?: { muscle?: string; equipment?: string }): Promise<ExerciseLibraryResponse> {
  const params = new URLSearchParams();
  if (filter?.muscle) params.set("muscle", filter.muscle);
  if (filter?.equipment) params.set("equipment", filter.equipment);
  const qs = params.toString();
  const { data } = await api.get(`/api/health/exercises${qs ? `?${qs}` : ""}`);
  return unwrap<ExerciseLibraryResponse>(data);
}

export async function getExerciseAlternatives(id: string, equipment?: string): Promise<ExerciseLibraryItem[]> {
  const qs = equipment ? `?equipment=${equipment}` : "";
  const { data } = await api.get(`/api/health/exercises/${id}/alternatives${qs}`);
  const u = unwrap<{ alternatives: ExerciseLibraryItem[] }>(data);
  return u.alternatives;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function dayOfWeekToKey(dow: number): WeekDay {
  // JS Date.getDay(): 0=Sun..6=Sat → map to our keys
  const map: WeekDay[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return map[dow] ?? "monday";
}

export function todayWeekDay(): WeekDay {
  return dayOfWeekToKey(new Date().getDay());
}
