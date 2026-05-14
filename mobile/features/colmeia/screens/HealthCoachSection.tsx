import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import {
  getHealthProfile, updateHealthProfile, getActiveWorkoutPlan, getHealthSummary,
  type HealthProfile, type WorkoutPlan, type HealthSummary,
  todayWeekDay, WEEK_DAYS_SHORT_PT, GOAL_LABELS_PT, LEVEL_LABELS_PT,
  type WeekDay,
} from "@mobile/services/healthApi";

// ── Types (legacy local) ──────────────────────────────────────────────────────

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

const MOOD_EMOJIS = ["😞", "😕", "😐", "😊", "😁"];

// ── Storage helpers ───────────────────────────────────────────────────────────

async function loadJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(SK + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
async function saveJSON<T>(key: string, value: T): Promise<void> {
  try { await SecureStore.setItemAsync(SK + key, JSON.stringify(value)); } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HealthCoachSection({ colors }: { colors: ReturnType<typeof getThemeColors> }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [summary, setSummary] = useState<HealthSummary["summary"] | null>(null);

  // Local-only: hidratação, hábitos, check-in
  const [habits, setHabits] = useState<HealthyHabit[]>([]);
  const [waterMl, setWaterMl] = useState(0);
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [ciSleep, setCiSleep] = useState(7);
  const [ciMood, setCiMood] = useState<1|2|3|4|5>(3);
  const [ciEnergy, setCiEnergy] = useState<1|2|3|4|5>(3);

  // Onboarding rápido
  const [obGoal, setObGoal] = useState<HealthProfile["healthGoal"] | null>(null);
  const [obLevel, setObLevel] = useState<HealthProfile["level"] | null>(null);

  const today = todayKey();
  const todayKey2 = todayWeekDay();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, sum, h, wl, ci] = await Promise.all([
        getHealthProfile().catch(() => null),
        getHealthSummary().catch(() => null),
        loadJSON<HealthyHabit[]>("habits"),
        loadJSON<{ date: string; amountMl: number }[]>("water_logs"),
        loadJSON<DailyCheckin>("checkin_" + today),
      ]);
      setProfile(p);
      setActivePlan(sum?.plan ?? null);
      setSummary(sum?.summary ?? null);
      setHabits(h ?? DEFAULT_HABITS.map((x) => ({ ...x, completedDates: [] })));
      setWaterMl((wl ?? []).find((l) => l.date === today)?.amountMl ?? 0);
      setCheckin(ci);
      if (ci) { setCiSleep(ci.sleepHours); setCiMood(ci.mood); setCiEnergy(ci.energyLevel); }
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function completeOnboarding() {
    if (!obGoal || !obLevel) return;
    const updated = await updateHealthProfile({
      healthGoal: obGoal,
      level: obLevel,
      trainingDays: ["monday", "wednesday", "friday"] as WeekDay[],
      restDays: ["tuesday", "thursday", "saturday", "sunday"] as WeekDay[],
    });
    setProfile(updated);
    setObGoal(null);
    setObLevel(null);
  }

  async function addWater(ml: number) {
    const newAmount = waterMl + ml;
    setWaterMl(newAmount);
    const logs = (await loadJSON<{ date: string; amountMl: number }[]>("water_logs")) ?? [];
    const idx = logs.findIndex((l) => l.date === today);
    if (idx >= 0) logs[idx].amountMl = newAmount;
    else logs.push({ date: today, amountMl: newAmount });
    await saveJSON("water_logs", logs.filter((l) => l.date >= sevenDaysAgo()));
  }

  async function saveCheckin() {
    const ci: DailyCheckin = { date: today, sleepHours: ciSleep, mood: ciMood, energyLevel: ciEnergy };
    await saveJSON("checkin_" + today, ci);
    setCheckin(ci);
    setShowCheckin(false);
  }

  async function toggleHabit(habitId: string) {
    const updated = habits.map((h) => {
      if (h.id !== habitId) return h;
      const done = h.completedDates.includes(today);
      return { ...h, completedDates: done ? h.completedDates.filter((d) => d !== today) : [...h.completedDates, today] };
    });
    setHabits(updated);
    await saveJSON("habits", updated);
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  // ── Onboarding mínimo (sem perfil completo) ───────────────────────────────

  if (!profile || (!activePlan && !profile.healthGoal)) {
    return (
      <View style={styles.obContainer}>
        <View style={styles.obHeader}>
          <Feather name="heart" size={28} color="#EF4444" />
          <Text style={styles.obTitle}>Coach de Saúde 🐝💪</Text>
          <Text style={styles.obSubtitle}>
            Vamos começar com seu objetivo e nível. Você pode ajustar depois.
          </Text>
        </View>

        <Text style={styles.modalLabel}>Objetivo</Text>
        <View style={styles.obOptions}>
          {(["saude_geral", "perda_gordura", "hipertrofia", "condicionamento"] as const).map((g) => (
            <TouchableOpacity
              key={g}
              activeOpacity={0.75}
              style={[styles.obOptionCard, obGoal === g && styles.obOptionSelected]}
              onPress={() => setObGoal(g)}
            >
              <Feather name="target" size={16} color={obGoal === g ? colors.primary : colors.muted} />
              <Text style={[styles.obOptionLabel, obGoal === g && { color: colors.primary }]}>
                {GOAL_LABELS_PT[g]}
              </Text>
              {obGoal === g && <Feather name="check-circle" size={14} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.modalLabel}>Nível</Text>
        <View style={styles.obOptions}>
          {(["iniciante", "intermediario", "avancado"] as const).map((l) => (
            <TouchableOpacity
              key={l}
              activeOpacity={0.75}
              style={[styles.obOptionCard, obLevel === l && styles.obOptionSelected]}
              onPress={() => setObLevel(l)}
            >
              <Text style={[styles.obOptionLabel, obLevel === l && { color: colors.primary }]}>
                {LEVEL_LABELS_PT[l]}
              </Text>
              {obLevel === l && <Feather name="check-circle" size={14} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.obContinueBtn, (!obGoal || !obLevel) && styles.obContinueBtnDisabled]}
          onPress={completeOnboarding}
          activeOpacity={0.8}
          disabled={!obGoal || !obLevel}
        >
          <Text style={styles.obContinueText}>Salvar e continuar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.obSecondaryBtn}
          onPress={() => router.push("/bee-create-workout")}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color={colors.primary} />
          <Text style={styles.obSecondaryText}>Criar meu primeiro treino</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main Dashboard ────────────────────────────────────────────────────────

  const waterPct = Math.min(waterMl / WATER_GOAL_ML, 1);
  const completedHabitsToday = habits.filter((h) => h.completedDates.includes(today)).length;
  const todayPlanDay = activePlan?.days.find((d) => d.day === todayKey2) ?? null;
  const isTrainingToday = todayPlanDay?.type === "training";

  return (
    <>
      {/* Profile / Plano ativo */}
      <View style={styles.profileCard}>
        <Feather name="heart" size={18} color="#EF4444" />
        <View style={{ flex: 1 }}>
          <Text style={styles.profileGoal}>
            {activePlan?.name ?? GOAL_LABELS_PT[profile.healthGoal]}
          </Text>
          <Text style={styles.profileLevel}>
            {LEVEL_LABELS_PT[profile.level]} · {profile.trainingDays.length}x por semana
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/bee-create-workout")} style={styles.profileBtn} activeOpacity={0.7}>
          <Feather name="edit-3" size={13} color={colors.primary} />
          <Text style={styles.profileBtnText}>{activePlan ? "Editar" : "Criar"}</Text>
        </TouchableOpacity>
      </View>

      {/* Resumo semanal */}
      {summary && activePlan && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Feather name="trending-up" size={16} color="#10B981" />
            <Text style={styles.cardTitle}>Sua semana</Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.completedThisWeek}</Text>
              <Text style={styles.summaryLabel}>concluídos</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.plannedThisWeek}</Text>
              <Text style={styles.summaryLabel}>planejados</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.consistencyRatio}%</Text>
              <Text style={styles.summaryLabel}>consistência</Text>
            </View>
          </View>
          {summary.consistencyRatio > 0 && summary.consistencyRatio < 100 && (
            <Text style={styles.summaryMsg}>Você está construindo consistência aos poucos. Continue 🐝✨</Text>
          )}
          {summary.consistencyRatio === 100 && (
            <Text style={styles.summaryMsg}>Você fechou a semana! 🐝 Dia de descanso é parte do progresso.</Text>
          )}
        </View>
      )}

      {/* Treino do dia */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Feather name="activity" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Treino de Hoje</Text>
          <Text style={styles.dayBadge}>{WEEK_DAYS_SHORT_PT[todayKey2]}</Text>
        </View>

        {!activePlan ? (
          <TouchableOpacity style={styles.emptyAction} onPress={() => router.push("/bee-create-workout")} activeOpacity={0.8}>
            <Feather name="plus-circle" size={18} color={colors.primary} />
            <Text style={styles.emptyActionText}>Criar plano de treino</Text>
          </TouchableOpacity>
        ) : !isTrainingToday ? (
          <View style={styles.restDay}>
            <Feather name="zap-off" size={20} color={colors.muted} />
            <Text style={styles.restText}>Dia de descanso</Text>
            <Text style={styles.restSub}>Recuperação é parte do treino. Hidrate-se!</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.workoutFocus}>{todayPlanDay?.title}</Text>
            <Text style={styles.workoutHint}>
              {todayPlanDay?.exercises.length} exercícios
            </Text>
            <TouchableOpacity
              style={styles.startBtn}
              activeOpacity={0.8}
              onPress={() => router.push({
                pathname: "/bee-workout-day",
                params: { planId: activePlan.id, day: todayKey2 },
              })}
            >
              <Feather name="play" size={16} color="#000" />
              <Text style={styles.startBtnText}>Iniciar treino</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Hidratação */}
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
          {[150, 250, 350, 500].map((ml) => (
            <TouchableOpacity key={ml} style={styles.waterBtn} onPress={() => addWater(ml)} activeOpacity={0.7}>
              <Text style={styles.waterBtnText}>+{ml}ml</Text>
            </TouchableOpacity>
          ))}
        </View>
        {waterMl >= WATER_GOAL_ML && (
          <Text style={styles.waterGoalReached}>Meta atingida! Continue se hidratando 💧</Text>
        )}
      </View>

      {/* Check-in diário */}
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

      {/* Hábitos */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Feather name="check-square" size={16} color="#10B981" />
          <Text style={styles.cardTitle}>Hábitos Saudáveis</Text>
          <Text style={styles.habitCount}>{completedHabitsToday}/{habits.length} hoje</Text>
        </View>
        {habits.map((habit) => {
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

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Feather name="info" size={12} color={colors.muted} />
        <Text style={styles.disclaimerText}>
          As sugestões da Bee são gerais. Em caso de dor, doença ou restrição, procure um profissional de educação física ou de saúde.
        </Text>
      </View>

      {/* Modal check-in */}
      <Modal visible={showCheckin} transparent animationType="slide" onRequestClose={() => setShowCheckin(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Check-in do Dia</Text>

            <Text style={styles.modalLabel}>Horas de sono</Text>
            <View style={styles.sleepRow}>
              {[5, 6, 7, 8, 9, 10].map((h) => (
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
              {[1, 2, 3, 4, 5].map((e) => (
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

    obContainer: { gap: 16 },
    obHeader: { alignItems: "center", gap: 8, paddingVertical: 12 },
    obTitle: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "800", color: colors.foreground },
    obSubtitle: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted, textAlign: "center" },
    obOptions: { gap: 8 },
    obOptionCard: {
      padding: 12, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.card,
      flexDirection: "row", alignItems: "center", gap: 10,
    },
    obOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    obOptionLabel: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.foreground, flex: 1 },
    obContinueBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
    obContinueBtnDisabled: { opacity: 0.4 },
    obContinueText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: "#000" },
    obSecondaryBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: colors.primary,
    },
    obSecondaryText: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.primary },

    card: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
    cardTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
    cardTitle: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "800", color: colors.foreground, flex: 1 },
    dayBadge: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted },

    profileCard: {
      backgroundColor: "#EF4444" + "14", borderRadius: 18, borderWidth: 1,
      borderColor: "#EF4444" + "33", padding: 14,
      flexDirection: "row", alignItems: "center", gap: 10,
    },
    profileGoal: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "800", color: colors.foreground },
    profileLevel: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
    profileBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primary + "22" },
    profileBtnText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.primary, fontWeight: "700" },

    summaryGrid: { flexDirection: "row", gap: 10 },
    summaryItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 12, backgroundColor: colors.background + "44" },
    summaryValue: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "800", color: colors.foreground },
    summaryLabel: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 2 },
    summaryMsg: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, fontStyle: "italic" },

    restDay: { alignItems: "center", gap: 6, paddingVertical: 6 },
    restText: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.muted },
    restSub: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    workoutFocus: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.primary },
    workoutHint: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
    startBtn: {
      backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8,
    },
    startBtnText: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "800", color: "#000" },
    emptyAction: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border,
    },
    emptyActionText: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.primary },

    waterAmount: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted },
    waterBarBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
    waterBarFill: { height: "100%", backgroundColor: "#3B82F6", borderRadius: 4 },
    waterButtons: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    waterBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: "#3B82F622", borderWidth: 1, borderColor: "#3B82F644" },
    waterBtnText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: "#3B82F6" },
    waterGoalReached: { fontFamily: FONTS.sans, fontSize: 12, color: "#10B981", fontWeight: "600", textAlign: "center" },

    checkinDoneBadge: { backgroundColor: "#10B98122", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
    checkinDoneText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: "#10B981" },
    checkinSummary: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
    checkinItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    moodEmoji: { fontSize: 16 },
    checkinValue: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    checkinEditLink: { fontFamily: FONTS.sans, fontSize: 12, color: colors.primary, fontWeight: "600" },
    checkinBtn: { backgroundColor: "#8B5CF618", borderRadius: 12, borderWidth: 1, borderColor: "#8B5CF644", paddingVertical: 12, alignItems: "center" },
    checkinBtnText: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: "#8B5CF6" },

    habitCount: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted },
    habitRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
    habitCheck: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    habitCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },
    habitLabel: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, flex: 1 },
    habitLabelDone: { textDecorationLine: "line-through", color: colors.muted },

    disclaimer: { flexDirection: "row", gap: 6, alignItems: "flex-start", backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12 },
    disclaimerText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, flex: 1, lineHeight: 16 },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, gap: 12 },
    modalHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
    modalTitle: { fontFamily: FONTS.display, fontSize: 20, fontWeight: "800", color: colors.foreground },
    modalLabel: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.muted, marginTop: 4 },
    sleepRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    sleepBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    sleepBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "22" },
    sleepBtnText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted },
    sleepBtnTextActive: { color: colors.primary, fontWeight: "700" },
    moodRow: { flexDirection: "row", gap: 10 },
    moodBtn: { padding: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    moodBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "22" },
    energyRow: { flexDirection: "row", gap: 10 },
    energyBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
    energyBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    saveCheckinBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
    saveCheckinText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: "#000" },
    backLink: { alignSelf: "center", marginTop: 6, padding: 4 },
    backLinkText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted },
  });
}
