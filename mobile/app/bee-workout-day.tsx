/**
 * bee-workout-day.tsx
 *
 * Tela do treino do dia. Mostra a lista de exercícios do plano ativo para
 * o dia da semana selecionado e permite marcar cada exercício como concluído
 * ou pulado. Ao finalizar, grava uma sessão (POST /api/health/workout-plans/:id/complete).
 *
 * Query params:
 *  - planId: id do plano ativo
 *  - day: chave do dia (ex.: "monday")
 */

import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useUIStore } from "@mobile/stores/uiStore";
import { getThemeColors, FONTS } from "@mobile/lib/theme";
import {
  getActiveWorkoutPlan, completeWorkout,
  type WorkoutPlan, type WeekDay, WEEK_DAYS_PT,
} from "@mobile/services/healthApi";

export default function BeeWorkoutDayScreen() {
  const { themeMode } = useUIStore();
  const colors = getThemeColors(themeMode);
  const params = useLocalSearchParams<{ planId?: string; day?: string }>();
  const day = (params.day as WeekDay) ?? "monday";

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [exerciseStatus, setExerciseStatus] = useState<Record<number, "pending" | "done" | "skipped">>({});
  const [effort, setEffort] = useState<"leve" | "moderado" | "intenso">("moderado");
  const [notes, setNotes] = useState("");
  const [showFinish, setShowFinish] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await getActiveWorkoutPlan();
        if (!p) {
          Alert.alert("Sem plano", "Crie um plano de treino primeiro 🐝");
          router.back();
          return;
        }
        setPlan(p);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dayPlan = plan?.days.find((d) => d.day === day);
  const exercises = dayPlan?.exercises ?? [];
  const completedCount = Object.values(exerciseStatus).filter((s) => s === "done").length;
  const skippedCount = Object.values(exerciseStatus).filter((s) => s === "skipped").length;
  const progress = exercises.length > 0 ? completedCount / exercises.length : 0;

  function startWorkout() {
    setStartedAt(new Date());
  }

  function toggleExercise(idx: number, status: "done" | "skipped") {
    setExerciseStatus((prev) => {
      const cur = prev[idx];
      if (cur === status) {
        const { [idx]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [idx]: status };
    });
  }

  async function finishWorkout() {
    if (!plan || !startedAt) return;
    const durationMs = Date.now() - startedAt.getTime();
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
    setSaving(true);
    try {
      await completeWorkout(plan.id, {
        dayKey: day,
        durationMinutes,
        exercisesCompleted: completedCount,
        exercisesSkipped: skippedCount,
        effortLevel: effort,
        notes: notes || undefined,
        exerciseLog: exercises.map((ex, i) => ({
          name: ex.name,
          done: exerciseStatus[i] === "done",
          skipped: exerciseStatus[i] === "skipped",
        })),
      });
      Alert.alert("Treino concluído!", "Sua sessão foi registrada 🐝✨", [
        { text: "Voltar", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Não consegui salvar sua sessão");
    } finally {
      setSaving(false);
    }
  }

  const styles = makeStyles(colors);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!dayPlan || dayPlan.type === "rest" || exercises.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{WEEK_DAYS_PT[day]}</Text>
        </View>
        <View style={styles.center}>
          <Feather name="zap-off" size={36} color={colors.muted} />
          <Text style={styles.restBig}>Hoje é dia de descanso 🐝</Text>
          <Text style={styles.restSmall}>Recuperação também faz parte da evolução.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{dayPlan.title}</Text>
          <Text style={styles.headerSub}>
            {WEEK_DAYS_PT[day]} · {exercises.length} exercícios
            {dayPlan.focus ? ` · ${dayPlan.focus}` : ""}
          </Text>
        </View>
      </View>

      {/* Progresso */}
      {startedAt && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
          </View>
          <Text style={styles.progressText}>
            {completedCount}/{exercises.length} concluídos
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.list}>
        {exercises.map((ex, idx) => {
          const status = exerciseStatus[idx];
          return (
            <View key={idx} style={[
              styles.exerciseCard,
              status === "done" && styles.exerciseCardDone,
              status === "skipped" && styles.exerciseCardSkipped,
            ]}>
              <View style={styles.exerciseHead}>
                <Text style={[styles.exerciseName, status === "done" && styles.exerciseNameDone]}>
                  {ex.name}
                </Text>
                {status === "done" && <Feather name="check-circle" size={18} color="#10B981" />}
                {status === "skipped" && <Feather name="skip-forward" size={18} color={colors.muted} />}
              </View>
              <View style={styles.exerciseMeta}>
                {ex.muscleGroup && <Text style={styles.metaChip}>{ex.muscleGroup}</Text>}
                {ex.machine && <Text style={styles.metaChip}>{ex.machine}</Text>}
                {ex.equipment && <Text style={styles.metaChip}>{ex.equipment}</Text>}
              </View>
              <View style={styles.exerciseStats}>
                {ex.sets && <Text style={styles.statText}>{ex.sets} séries</Text>}
                {ex.reps && <Text style={styles.statText}>· {ex.reps}</Text>}
                {ex.durationMin && <Text style={styles.statText}>{ex.durationMin} min</Text>}
                {ex.restSeconds ? <Text style={styles.statText}>· descanso {ex.restSeconds}s</Text> : null}
              </View>
              {ex.notes && <Text style={styles.exerciseNotes}>💡 {ex.notes}</Text>}
              {ex.alternatives && ex.alternatives.length > 0 && (
                <Text style={styles.alternatives}>
                  Alternativas: {ex.alternatives.slice(0, 3).join(", ")}
                </Text>
              )}

              {startedAt && (
                <View style={styles.exerciseActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, status === "done" && styles.actionBtnActive]}
                    onPress={() => toggleExercise(idx, "done")}
                    activeOpacity={0.7}
                  >
                    <Feather name="check" size={14} color={status === "done" ? "#fff" : "#10B981"} />
                    <Text style={[styles.actionText, status === "done" && { color: "#fff" }]}>Concluir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, status === "skipped" && styles.actionBtnSkippedActive]}
                    onPress={() => toggleExercise(idx, "skipped")}
                    activeOpacity={0.7}
                  >
                    <Feather name="skip-forward" size={14} color={status === "skipped" ? "#fff" : colors.muted} />
                    <Text style={[styles.actionText, status === "skipped" && { color: "#fff" }]}>Pular</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {!startedAt ? (
          <TouchableOpacity style={styles.startBtn} onPress={startWorkout} activeOpacity={0.85}>
            <Feather name="play" size={18} color="#000" />
            <Text style={styles.startBtnText}>Iniciar treino</Text>
          </TouchableOpacity>
        ) : !showFinish ? (
          <TouchableOpacity style={styles.finishBtn} onPress={() => setShowFinish(true)} activeOpacity={0.85}>
            <Feather name="flag" size={18} color="#fff" />
            <Text style={styles.finishBtnText}>Finalizar treino</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.finishCard}>
            <Text style={styles.finishTitle}>Como foi o esforço?</Text>
            <View style={styles.effortRow}>
              {(["leve", "moderado", "intenso"] as const).map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.effortBtn, effort === e && styles.effortBtnActive]}
                  onPress={() => setEffort(e)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.effortText, effort === e && { color: colors.primary, fontWeight: "800" }]}>
                    {e[0].toUpperCase() + e.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.finishLabel}>Observações (opcional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Como você se sentiu?"
              placeholderTextColor={colors.muted}
              style={styles.finishInput}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={finishWorkout}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#000" />
                : <>
                    <Feather name="check" size={16} color="#000" />
                    <Text style={styles.confirmBtnText}>Salvar sessão</Text>
                  </>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
    backBtn: { padding: 6, borderRadius: 8 },
    headerTitle: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "800", color: colors.foreground },
    headerSub: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },

    restBig: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "700", color: colors.foreground, marginTop: 10 },
    restSmall: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted },

    progressWrap: { paddingHorizontal: 16, paddingBottom: 8, gap: 4 },
    progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: colors.primary },
    progressText: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted, alignSelf: "flex-end" },

    list: { padding: 16, gap: 12, paddingBottom: 40 },
    exerciseCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
    exerciseCardDone: { borderColor: "#10B981", backgroundColor: "#10B98112" },
    exerciseCardSkipped: { opacity: 0.55 },
    exerciseHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    exerciseName: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "700", color: colors.foreground, flex: 1 },
    exerciseNameDone: { textDecorationLine: "line-through" },
    exerciseMeta: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    metaChip: { fontFamily: FONTS.sans, fontSize: 10, color: colors.muted, backgroundColor: colors.border + "44", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    exerciseStats: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 },
    statText: { fontFamily: FONTS.mono, fontSize: 12, color: colors.muted },
    exerciseNotes: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 4, fontStyle: "italic" },
    alternatives: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 2 },
    exerciseActions: { flexDirection: "row", gap: 8, marginTop: 8 },
    actionBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
      paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    },
    actionBtnActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
    actionBtnSkippedActive: { backgroundColor: colors.muted, borderColor: colors.muted },
    actionText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.foreground },

    startBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 },
    startBtnText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: "#000" },
    finishBtn: { backgroundColor: "#10B981", borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 },
    finishBtnText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: "#fff" },

    finishCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10, marginTop: 6 },
    finishTitle: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "800", color: colors.foreground },
    effortRow: { flexDirection: "row", gap: 8 },
    effortBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    effortBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    effortText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted },
    finishLabel: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.muted, marginTop: 4 },
    finishInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, textAlignVertical: "top", minHeight: 64 },
    confirmBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6 },
    confirmBtnText: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "800", color: "#000" },
  });
}
