import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { FONTS, getThemeColors } from "@mobile/lib/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GoalType = "lose_weight" | "gain_muscle" | "maintain" | "improve_fitness";
export type FitnessLevel = "beginner" | "intermediate" | "advanced";

export interface HealthProfile {
  goal: GoalType;
  fitnessLevel: FitnessLevel;
  completedAt: string;
}

export interface Exercise {
  name: string;
  sets?: number;
  reps?: string;
  durationMin?: number;
  notes?: string;
}

export interface WorkoutDay {
  dayOfWeek: number;
  label: string;
  type: "rest" | "training";
  focus?: string;
  exercises: Exercise[];
}

export interface DailyCheckin {
  date: string;
  sleepHours: number;
  mood: 1 | 2 | 3 | 4 | 5;
  energyLevel: 1 | 2 | 3 | 4 | 5;
}

export interface HealthyHabit {
  id: string;
  label: string;
  icon: string;
  completedDates: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SK = "bee_health_";
const WATER_GOAL_ML = 2000;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sevenDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DEFAULT_HABITS: Omit<HealthyHabit, "completedDates">[] = [
  { id: "sleep8",    label: "Dormir 8h",       icon: "moon" },
  { id: "stretch",   label: "Alongar 10min",   icon: "activity" },
  { id: "no_sugar",  label: "Sem açúcar",       icon: "x-circle" },
  { id: "walk",      label: "Caminhar 20min",  icon: "map-pin" },
  { id: "meditate",  label: "Meditar 5min",    icon: "wind" },
];

const GOAL_LABELS: Record<GoalType, string> = {
  lose_weight:     "Perder peso",
  gain_muscle:     "Ganhar músculo",
  maintain:        "Manter forma",
  improve_fitness: "Melhorar condição",
};

const GOAL_ICONS: Record<GoalType, string> = {
  lose_weight:     "trending-down",
  gain_muscle:     "trending-up",
  maintain:        "check-circle",
  improve_fitness: "zap",
};

const LEVEL_LABELS: Record<FitnessLevel, string> = {
  beginner:     "Iniciante",
  intermediate: "Intermediário",
  advanced:     "Avançado",
};

const LEVEL_DESCS: Record<FitnessLevel, string> = {
  beginner:     "Começando agora ou após longa pausa",
  intermediate: "Treinando há 3+ meses com regularidade",
  advanced:     "Treinando há 1+ ano com consistência",
};

const MOOD_EMOJIS = ["😞", "😕", "😐", "😊", "😁"];

// ── Storage helpers ────────────────────────────────────────────────────────────

async function loadJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(SK + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function saveJSON<T>(key: string, value: T): Promise<void> {
  try {
    await SecureStore.setItemAsync(SK + key, JSON.stringify(value));
  } catch {}
}

async function deleteKey(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SK + key);
  } catch {}
}

// ── Workout plan generator ────────────────────────────────────────────────────
// TODO: replace with AI-generated plan via POST /api/health/workout-plan

function generateWorkoutPlan(goal: GoalType, level: FitnessLevel): WorkoutDay[] {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const s = level === "beginner" ? 2 : level === "intermediate" ? 3 : 4;
  const r = level === "beginner" ? "8-10" : level === "intermediate" ? "10-12" : "12-15";

  if (goal === "lose_weight") {
    return [
      { dayOfWeek: 0, label: days[0], type: "rest", exercises: [] },
      { dayOfWeek: 1, label: days[1], type: "training", focus: "Cardio + Corpo Inteiro", exercises: [
        { name: "Caminhada ou corrida leve", durationMin: 20 },
        { name: "Agachamento livre", sets: s, reps: r },
        { name: "Flexão de braço", sets: s, reps: r },
        { name: "Prancha isométrica", sets: 3, notes: "45s cada" },
      ]},
      { dayOfWeek: 2, label: days[2], type: "rest", exercises: [] },
      { dayOfWeek: 3, label: days[3], type: "training", focus: "Cardio Intervalado", exercises: [
        { name: "Polichinelo", sets: 3, reps: "30 rep" },
        { name: "Burpee", sets: s, reps: "8" },
        { name: "Mountain climber", sets: 3, reps: "20 rep" },
        { name: "Corrida estacionária", durationMin: 3 },
      ]},
      { dayOfWeek: 4, label: days[4], type: "rest", exercises: [] },
      { dayOfWeek: 5, label: days[5], type: "training", focus: "Força + Cardio", exercises: [
        { name: "Agachamento com peso", sets: s, reps: r },
        { name: "Remada curvada", sets: s, reps: r },
        { name: "Supino com halteres", sets: s, reps: r },
        { name: "Caminhada final", durationMin: 15 },
      ]},
      { dayOfWeek: 6, label: days[6], type: "training", focus: "Mobilidade + Cardio Leve", exercises: [
        { name: "Caminhada ao ar livre", durationMin: 30 },
        { name: "Alongamento geral", durationMin: 10 },
      ]},
    ];
  }

  if (goal === "gain_muscle") {
    return [
      { dayOfWeek: 0, label: days[0], type: "rest", exercises: [] },
      { dayOfWeek: 1, label: days[1], type: "training", focus: "Peito e Tríceps", exercises: [
        { name: "Supino plano", sets: s, reps: r },
        { name: "Crucifixo", sets: s, reps: r },
        { name: "Tríceps pulley", sets: s, reps: r },
        { name: "Mergulho no banco", sets: 3, reps: "12" },
      ]},
      { dayOfWeek: 2, label: days[2], type: "training", focus: "Costas e Bíceps", exercises: [
        { name: "Puxada na barra", sets: s, reps: r },
        { name: "Remada curvada", sets: s, reps: r },
        { name: "Rosca direta", sets: s, reps: r },
        { name: "Rosca martelo", sets: 3, reps: "10" },
      ]},
      { dayOfWeek: 3, label: days[3], type: "rest", exercises: [] },
      { dayOfWeek: 4, label: days[4], type: "training", focus: "Pernas e Glúteos", exercises: [
        { name: "Agachamento com barra", sets: s, reps: r },
        { name: "Leg press", sets: s, reps: r },
        { name: "Cadeira extensora", sets: s, reps: r },
        { name: "Panturrilha em pé", sets: 4, reps: "15-20" },
      ]},
      { dayOfWeek: 5, label: days[5], type: "training", focus: "Ombros e Abdômen", exercises: [
        { name: "Desenvolvimento com halteres", sets: s, reps: r },
        { name: "Elevação lateral", sets: s, reps: r },
        { name: "Prancha", sets: 3, notes: "1min cada" },
        { name: "Abdominal infra", sets: 3, reps: "20" },
      ]},
      { dayOfWeek: 6, label: days[6], type: "rest", exercises: [] },
    ];
  }

  // maintain / improve_fitness
  return [
    { dayOfWeek: 0, label: days[0], type: "rest", exercises: [] },
    { dayOfWeek: 1, label: days[1], type: "training", focus: "Corpo Inteiro A", exercises: [
      { name: "Agachamento", sets: s, reps: r },
      { name: "Flexão", sets: s, reps: r },
      { name: "Remada com haltere", sets: s, reps: r },
      { name: "Prancha", sets: 3, notes: "45s" },
    ]},
    { dayOfWeek: 2, label: days[2], type: "training", focus: "Cardio", exercises: [
      { name: "Corrida ou bicicleta", durationMin: 25 },
      { name: "Alongamento", durationMin: 10 },
    ]},
    { dayOfWeek: 3, label: days[3], type: "rest", exercises: [] },
    { dayOfWeek: 4, label: days[4], type: "training", focus: "Corpo Inteiro B", exercises: [
      { name: "Avanço com halteres", sets: s, reps: r },
      { name: "Supino com halteres", sets: s, reps: r },
      { name: "Elevação lateral", sets: s, reps: r },
      { name: "Abdominal", sets: 3, reps: "20" },
    ]},
    { dayOfWeek: 5, label: days[5], type: "training", focus: "Funcional", exercises: [
      { name: "Burpee", sets: 3, reps: "8" },
      { name: "Polichinelo", sets: 3, reps: "30" },
      { name: "Mobilidade geral", durationMin: 15 },
    ]},
    { dayOfWeek: 6, label: days[6], type: "rest", exercises: [] },
  ];
}

// ── HealthCoachSection ────────────────────────────────────────────────────────

export function HealthCoachSection({ colors }: { colors: ReturnType<typeof getThemeColors> }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading]           = useState(true);
  const [profile, setProfile]           = useState<HealthProfile | null>(null);
  const [workoutPlan, setWorkoutPlan]   = useState<WorkoutDay[]>([]);
  const [habits, setHabits]             = useState<HealthyHabit[]>([]);
  const [waterMl, setWaterMl]           = useState(0);
  const [checkin, setCheckin]           = useState<DailyCheckin | null>(null);
  const [workoutExpanded, setWorkoutExpanded] = useState(false);

  // Onboarding
  const [obStep, setObStep]     = useState(0);
  const [selGoal, setSelGoal]   = useState<GoalType | null>(null);
  const [selLevel, setSelLevel] = useState<FitnessLevel | null>(null);

  // Check-in modal
  const [showCheckin, setShowCheckin] = useState(false);
  const [ciSleep, setCiSleep]         = useState(7);
  const [ciMood, setCiMood]           = useState<1|2|3|4|5>(3);
  const [ciEnergy, setCiEnergy]       = useState<1|2|3|4|5>(3);

  const today = todayKey();
  const todayDow = new Date().getDay();
  const todayWorkout = workoutPlan.find(d => d.dayOfWeek === todayDow) ?? null;

  useEffect(() => {
    (async () => {
      const [p, wp, h, wl, ci] = await Promise.all([
        loadJSON<HealthProfile>("profile"),
        loadJSON<WorkoutDay[]>("workout_plan"),
        loadJSON<HealthyHabit[]>("habits"),
        loadJSON<{ date: string; amountMl: number }[]>("water_logs"),
        loadJSON<DailyCheckin>("checkin_" + today),
      ]);
      setProfile(p);
      setWorkoutPlan(wp ?? []);
      setHabits(h ?? DEFAULT_HABITS.map(h => ({ ...h, completedDates: [] })));
      setWaterMl((wl ?? []).find(l => l.date === today)?.amountMl ?? 0);
      setCheckin(ci);
      if (ci) { setCiSleep(ci.sleepHours); setCiMood(ci.mood); setCiEnergy(ci.energyLevel); }
      setLoading(false);
    })();
  }, [today]);

  async function completeOnboarding() {
    if (!selGoal || !selLevel) return;
    const newProfile: HealthProfile = { goal: selGoal, fitnessLevel: selLevel, completedAt: new Date().toISOString() };
    const plan = generateWorkoutPlan(selGoal, selLevel);
    const defaultHabits = DEFAULT_HABITS.map(h => ({ ...h, completedDates: [] }));
    await Promise.all([
      saveJSON("profile", newProfile),
      saveJSON("workout_plan", plan),
      saveJSON("habits", defaultHabits),
    ]);
    setProfile(newProfile);
    setWorkoutPlan(plan);
    setHabits(defaultHabits);
  }

  async function addWater(ml: number) {
    const newAmount = waterMl + ml;
    setWaterMl(newAmount);
    const logs = (await loadJSON<{ date: string; amountMl: number }[]>("water_logs")) ?? [];
    const idx = logs.findIndex(l => l.date === today);
    if (idx >= 0) logs[idx].amountMl = newAmount;
    else logs.push({ date: today, amountMl: newAmount });
    await saveJSON("water_logs", logs.filter(l => l.date >= sevenDaysAgo()));
  }

  async function saveCheckin() {
    const ci: DailyCheckin = { date: today, sleepHours: ciSleep, mood: ciMood, energyLevel: ciEnergy };
    await saveJSON("checkin_" + today, ci);
    setCheckin(ci);
    setShowCheckin(false);
  }

  async function toggleHabit(habitId: string) {
    const updated = habits.map(h => {
      if (h.id !== habitId) return h;
      const done = h.completedDates.includes(today);
      return { ...h, completedDates: done ? h.completedDates.filter(d => d !== today) : [...h.completedDates, today] };
    });
    setHabits(updated);
    await saveJSON("habits", updated);
  }

  async function resetProfile() {
    await Promise.all([deleteKey("profile"), deleteKey("workout_plan")]);
    setProfile(null);
    setWorkoutPlan([]);
    setObStep(0);
    setSelGoal(null);
    setSelLevel(null);
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  // ── Onboarding ────────────────────────────────────────────────────────────

  if (!profile) {
    return (
      <View style={styles.obContainer}>
        <View style={styles.obHeader}>
          <Feather name="heart" size={28} color="#EF4444" />
          <Text style={styles.obTitle}>Coach de Saúde</Text>
          <Text style={styles.obSubtitle}>
            {obStep === 0 ? "Qual é o seu objetivo principal?" : "Qual é o seu nível de condicionamento?"}
          </Text>
        </View>

        {obStep === 0 && (
          <View style={styles.obOptions}>
            {(["lose_weight", "gain_muscle", "maintain", "improve_fitness"] as GoalType[]).map(g => (
              <TouchableOpacity
                key={g}
                activeOpacity={0.75}
                style={[styles.obOptionCard, selGoal === g && styles.obOptionSelected]}
                onPress={() => setSelGoal(g)}
              >
                <Feather name={GOAL_ICONS[g] as any} size={22} color={selGoal === g ? colors.primary : colors.muted} />
                <Text style={[styles.obOptionLabel, selGoal === g && { color: colors.primary }]}>
                  {GOAL_LABELS[g]}
                </Text>
                {selGoal === g && <Feather name="check-circle" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.obContinueBtn, !selGoal && styles.obContinueBtnDisabled]}
              onPress={() => selGoal && setObStep(1)}
              activeOpacity={0.8}
            >
              <Text style={styles.obContinueText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        )}

        {obStep === 1 && (
          <View style={styles.obOptions}>
            {(["beginner", "intermediate", "advanced"] as FitnessLevel[]).map(l => (
              <TouchableOpacity
                key={l}
                activeOpacity={0.75}
                style={[styles.obOptionCard, selLevel === l && styles.obOptionSelected]}
                onPress={() => setSelLevel(l)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.obOptionLabel, selLevel === l && { color: colors.primary }]}>
                    {LEVEL_LABELS[l]}
                  </Text>
                  <Text style={[styles.obOptionDesc, selLevel === l && { color: colors.primary + "BB" }]}>
                    {LEVEL_DESCS[l]}
                  </Text>
                </View>
                {selLevel === l && <Feather name="check-circle" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.obContinueBtn, !selLevel && styles.obContinueBtnDisabled]}
              onPress={completeOnboarding}
              activeOpacity={0.8}
            >
              <Text style={styles.obContinueText}>Criar meu plano</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setObStep(0)} style={styles.backLink}>
              <Text style={styles.backLinkText}>← Voltar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ── Main Dashboard ────────────────────────────────────────────────────────

  const waterPct = Math.min(waterMl / WATER_GOAL_ML, 1);
  const completedHabitsToday = habits.filter(h => h.completedDates.includes(today)).length;

  return (
    <>
      {/* Profile header */}
      <View style={styles.profileCard}>
        <Feather name="heart" size={16} color="#EF4444" />
        <View style={{ flex: 1 }}>
          <Text style={styles.profileGoal}>{GOAL_LABELS[profile.goal]}</Text>
          <Text style={styles.profileLevel}>{LEVEL_LABELS[profile.fitnessLevel]}</Text>
        </View>
        <TouchableOpacity onPress={resetProfile} style={styles.resetBtn} activeOpacity={0.7}>
          <Feather name="settings" size={13} color={colors.muted} />
          <Text style={styles.resetBtnText}>Redefinir</Text>
        </TouchableOpacity>
      </View>

      {/* Today's workout */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeaderRow}
          activeOpacity={todayWorkout?.type === "training" ? 0.7 : 1}
          onPress={() => todayWorkout?.type === "training" && setWorkoutExpanded(v => !v)}
        >
          <View style={styles.cardTitleRow}>
            <Feather name="activity" size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>Treino de Hoje</Text>
            <Text style={styles.dayBadge}>{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][todayDow]}</Text>
          </View>
          {todayWorkout?.type === "training" && (
            <Feather name={workoutExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
          )}
        </TouchableOpacity>

        {!todayWorkout || todayWorkout.type === "rest" ? (
          <View style={styles.restDay}>
            <Feather name="zap-off" size={20} color={colors.muted} />
            <Text style={styles.restText}>Dia de descanso</Text>
            <Text style={styles.restSub}>Recuperação é parte do treino. Hidrate-se!</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.workoutFocus}>{todayWorkout.focus}</Text>
            {workoutExpanded
              ? todayWorkout.exercises.map((ex, i) => (
                  <View key={i} style={styles.exerciseRow}>
                    <View style={styles.exerciseBullet} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseName}>{ex.name}</Text>
                      <Text style={styles.exerciseDetails}>
                        {ex.sets && ex.reps ? `${ex.sets}x ${ex.reps}` :
                         ex.durationMin ? `${ex.durationMin} min` : ""}
                        {ex.notes ? `  ·  ${ex.notes}` : ""}
                      </Text>
                    </View>
                  </View>
                ))
              : (
                <Text style={styles.workoutHint}>
                  {todayWorkout.exercises.length} exercícios · toque para expandir
                </Text>
              )
            }
          </View>
        )}
      </View>

      {/* Water tracker */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Feather name="droplet" size={16} color="#3B82F6" />
          <Text style={styles.cardTitle}>Hidratação</Text>
          <Text style={styles.waterAmount}>{waterMl}ml / {WATER_GOAL_ML}ml</Text>
        </View>
        <View style={styles.waterBarBg}>
          <View style={[styles.waterBarFill, { width: `${Math.round(waterPct * 100)}%` as any }]} />
        </View>
        <View style={styles.waterButtons}>
          {[150, 250, 350, 500].map(ml => (
            <TouchableOpacity key={ml} style={styles.waterBtn} onPress={() => addWater(ml)} activeOpacity={0.7}>
              <Text style={styles.waterBtnText}>+{ml}ml</Text>
            </TouchableOpacity>
          ))}
        </View>
        {waterMl >= WATER_GOAL_ML && (
          <Text style={styles.waterGoalReached}>Meta atingida! Continue se hidratando 💧</Text>
        )}
      </View>

      {/* Daily check-in */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Feather name="clipboard" size={16} color="#8B5CF6" />
          <Text style={styles.cardTitle}>Check-in Diário</Text>
          {checkin && (
            <View style={styles.checkinDoneBadge}>
              <Text style={styles.checkinDoneText}>Feito ✓</Text>
            </View>
          )}
        </View>
        {checkin ? (
          <View style={styles.checkinSummary}>
            <View style={styles.checkinItem}>
              <Feather name="moon" size={13} color={colors.muted} />
              <Text style={styles.checkinValue}>{checkin.sleepHours}h sono</Text>
            </View>
            <View style={styles.checkinItem}>
              <Text style={styles.moodEmoji}>{MOOD_EMOJIS[checkin.mood - 1]}</Text>
              <Text style={styles.checkinValue}>Humor</Text>
            </View>
            <View style={styles.checkinItem}>
              <Feather name="zap" size={13} color={colors.muted} />
              <Text style={styles.checkinValue}>Energia {checkin.energyLevel}/5</Text>
            </View>
            <TouchableOpacity onPress={() => setShowCheckin(true)}>
              <Text style={styles.checkinEditLink}>Editar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.checkinBtn} onPress={() => setShowCheckin(true)} activeOpacity={0.8}>
            <Text style={styles.checkinBtnText}>Como foi hoje?</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Healthy habits */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Feather name="check-square" size={16} color="#10B981" />
          <Text style={styles.cardTitle}>Hábitos Saudáveis</Text>
          <Text style={styles.habitCount}>{completedHabitsToday}/{habits.length} hoje</Text>
        </View>
        {habits.map(habit => {
          const done = habit.completedDates.includes(today);
          return (
            <TouchableOpacity key={habit.id} style={styles.habitRow} activeOpacity={0.7} onPress={() => toggleHabit(habit.id)}>
              <View style={[styles.habitCheck, done && styles.habitCheckDone]}>
                {done && <Feather name="check" size={11} color="#fff" />}
              </View>
              <Feather name={habit.icon as any} size={14} color={done ? colors.primary : colors.muted} />
              <Text style={[styles.habitLabel, done && styles.habitLabelDone]}>{habit.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Safety disclaimer */}
      <View style={styles.disclaimer}>
        <Feather name="info" size={12} color={colors.muted} />
        <Text style={styles.disclaimerText}>
          As sugestões são orientativas. Em caso de dor, condição médica ou dúvida, procure um profissional de saúde.
        </Text>
      </View>

      {/* Check-in modal */}
      <Modal visible={showCheckin} transparent animationType="slide" onRequestClose={() => setShowCheckin(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Check-in do Dia</Text>

            <Text style={styles.modalLabel}>Horas de sono</Text>
            <View style={styles.sleepRow}>
              {[5, 6, 7, 8, 9, 10].map(h => (
                <TouchableOpacity
                  key={h}
                  style={[styles.sleepBtn, ciSleep === h && styles.sleepBtnActive]}
                  onPress={() => setCiSleep(h)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.sleepBtnText, ciSleep === h && styles.sleepBtnTextActive]}>{h}h</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Humor</Text>
            <View style={styles.moodRow}>
              {MOOD_EMOJIS.map((emoji, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.moodBtn, ciMood === i + 1 && styles.moodBtnActive]}
                  onPress={() => setCiMood((i + 1) as 1|2|3|4|5)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.moodEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Nível de energia</Text>
            <View style={styles.energyRow}>
              {[1, 2, 3, 4, 5].map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.energyBtn, ciEnergy >= e && styles.energyBtnActive]}
                  onPress={() => setCiEnergy(e as 1|2|3|4|5)}
                  activeOpacity={0.75}
                >
                  <Feather name="zap" size={14} color={ciEnergy >= e ? colors.primary : colors.muted} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveCheckinBtn} onPress={saveCheckin} activeOpacity={0.8}>
              <Text style={styles.saveCheckinText}>Salvar check-in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backLink} onPress={() => setShowCheckin(false)}>
              <Text style={styles.backLinkText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },

    // Onboarding
    obContainer: { gap: 20 },
    obHeader: { alignItems: "center", gap: 8, paddingVertical: 12 },
    obTitle: { fontFamily: FONTS.display, fontSize: 24, fontWeight: "800", color: colors.foreground },
    obSubtitle: { fontFamily: FONTS.sans, fontSize: 14, color: colors.muted, textAlign: "center" },
    obOptions: { gap: 10 },
    obOptionCard: {
      padding: 16, borderRadius: 16, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.card,
      flexDirection: "row", alignItems: "center", gap: 12,
    },
    obOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    obOptionLabel: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "700", color: colors.foreground },
    obOptionDesc: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
    obContinueBtn: {
      backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 14, alignItems: "center", marginTop: 4,
    },
    obContinueBtnDisabled: { opacity: 0.4 },
    obContinueText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: "#000" },
    backLink: { alignSelf: "center", marginTop: 6, padding: 4 },
    backLinkText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted },

    // Cards
    card: {
      backgroundColor: colors.card, borderRadius: 18, borderWidth: 1,
      borderColor: colors.border, padding: 14, gap: 10,
    },
    cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
    cardTitle: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "800", color: colors.foreground, flex: 1 },
    dayBadge: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted },

    // Profile
    profileCard: {
      backgroundColor: "#EF4444" + "14", borderRadius: 18, borderWidth: 1,
      borderColor: "#EF4444" + "33", padding: 14,
      flexDirection: "row", alignItems: "center", gap: 10,
    },
    profileGoal: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "800", color: colors.foreground },
    profileLevel: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
    resetBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
    resetBtnText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },

    // Workout
    restDay: { alignItems: "center", gap: 6, paddingVertical: 6 },
    restText: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.muted },
    restSub: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    workoutFocus: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.primary },
    exerciseRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 2 },
    exerciseBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary + "66", marginTop: 6 },
    exerciseName: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, fontWeight: "600" },
    exerciseDetails: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted },
    workoutHint: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },

    // Water
    waterAmount: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted },
    waterBarBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
    waterBarFill: { height: "100%", backgroundColor: "#3B82F6", borderRadius: 4 },
    waterButtons: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    waterBtn: {
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
      backgroundColor: "#3B82F622", borderWidth: 1, borderColor: "#3B82F644",
    },
    waterBtnText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: "#3B82F6" },
    waterGoalReached: { fontFamily: FONTS.sans, fontSize: 12, color: "#10B981", fontWeight: "600", textAlign: "center" },

    // Check-in
    checkinDoneBadge: { backgroundColor: "#10B98122", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
    checkinDoneText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: "#10B981" },
    checkinSummary: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
    checkinItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    moodEmoji: { fontSize: 16 },
    checkinValue: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    checkinEditLink: { fontFamily: FONTS.sans, fontSize: 12, color: colors.primary, fontWeight: "600" },
    checkinBtn: {
      backgroundColor: "#8B5CF618", borderRadius: 12, borderWidth: 1,
      borderColor: "#8B5CF644", paddingVertical: 12, alignItems: "center",
    },
    checkinBtnText: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: "#8B5CF6" },

    // Habits
    habitCount: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted },
    habitRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
    habitCheck: {
      width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
      borderColor: colors.border, alignItems: "center", justifyContent: "center",
    },
    habitCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },
    habitLabel: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, flex: 1 },
    habitLabelDone: { textDecorationLine: "line-through", color: colors.muted },

    // Disclaimer
    disclaimer: {
      flexDirection: "row", gap: 6, alignItems: "flex-start",
      backgroundColor: colors.card, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, padding: 12,
    },
    disclaimerText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, flex: 1, lineHeight: 16 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: 24, paddingBottom: 40, gap: 12,
    },
    modalHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
    modalTitle: { fontFamily: FONTS.display, fontSize: 20, fontWeight: "800", color: colors.foreground },
    modalLabel: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.muted, marginTop: 4 },
    sleepRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    sleepBtn: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    },
    sleepBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "22" },
    sleepBtnText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted },
    sleepBtnTextActive: { color: colors.primary, fontWeight: "700" },
    moodRow: { flexDirection: "row", gap: 10 },
    moodBtn: {
      padding: 8, borderRadius: 10, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.card,
    },
    moodBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "22" },
    energyRow: { flexDirection: "row", gap: 10 },
    energyBtn: {
      width: 44, height: 44, borderRadius: 10, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.card,
      alignItems: "center", justifyContent: "center",
    },
    energyBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    saveCheckinBtn: {
      backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 14, alignItems: "center", marginTop: 8,
    },
    saveCheckinText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: "#000" },
  });
}
