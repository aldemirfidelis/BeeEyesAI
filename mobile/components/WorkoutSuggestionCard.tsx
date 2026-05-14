/**
 * WorkoutSuggestionCard.tsx
 *
 * Card exibido no chat quando a Bee gera uma sugestão de plano de treino.
 * Permite ao usuário salvar com um toque ou ver os detalhes.
 */
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import {
  createWorkoutPlan,
  type WorkoutDayPlan, type WeekDay, type HealthGoal, type FitnessLevel, type SplitType,
  WEEK_DAYS_PT, GOAL_LABELS_PT, LEVEL_LABELS_PT,
} from "@mobile/services/healthApi";

export interface WorkoutSuggestionPlan {
  name: string;
  goal: HealthGoal;
  level: FitnessLevel;
  splitType: SplitType;
  trainingDays: WeekDay[];
  restDays: WeekDay[];
  days: WorkoutDayPlan[];
}

interface Props {
  plan: WorkoutSuggestionPlan;
  colors: ReturnType<typeof getThemeColors>;
  onSaved?: () => void;
}

export function WorkoutSuggestionCard({ plan, colors, onSaved }: Props) {
  const styles = makeStyles(colors);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await createWorkoutPlan({
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
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Não consegui salvar o plano");
    } finally {
      setSaving(false);
    }
  }

  const trainingDays = plan.days.filter((d) => d.type === "training");

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Feather name="activity" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{plan.name}</Text>
          <Text style={styles.subtitle}>
            {GOAL_LABELS_PT[plan.goal]} · {LEVEL_LABELS_PT[plan.level]} · {plan.trainingDays.length}x/sem
          </Text>
        </View>
      </View>

      {/* Dias */}
      <View style={styles.daysRow}>
        {plan.trainingDays.map((d) => (
          <View key={d} style={styles.dayChip}>
            <Text style={styles.dayChipText}>{WEEK_DAYS_PT[d].slice(0, 3)}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.7} style={styles.expandRow}>
        <Text style={styles.expandText}>
          {expanded ? "Ocultar exercícios" : `Ver ${trainingDays.length} treinos`}
        </Text>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
      </TouchableOpacity>

      {expanded && (
        <ScrollView style={{ maxHeight: 260 }}>
          {trainingDays.map((d) => (
            <View key={d.day} style={styles.dayDetail}>
              <Text style={styles.dayDetailTitle}>{WEEK_DAYS_PT[d.day]} — {d.title}</Text>
              {d.exercises.slice(0, 6).map((ex, i) => (
                <Text key={i} style={styles.exerciseLine}>
                  • {ex.name}
                  {ex.sets ? ` · ${ex.sets}x${ex.reps ?? ""}` : ex.durationMin ? ` · ${ex.durationMin}min` : ""}
                </Text>
              ))}
              {d.exercises.length > 6 && (
                <Text style={styles.moreText}>+ {d.exercises.length - 6} exercícios</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btnPrimary, saved && styles.btnPrimaryDone]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving || saved}
        >
          <Feather name={saved ? "check" : "save"} size={14} color="#000" />
          <Text style={styles.btnPrimaryText}>
            {saved ? "Salvo!" : saving ? "Salvando..." : "Salvar plano"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => router.push("/bee-create-workout")}
          activeOpacity={0.85}
        >
          <Feather name="edit-3" size={14} color={colors.primary} />
          <Text style={styles.btnSecondaryText}>Editar</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>
        Sugestões da Bee são gerais. Adapte ao seu corpo e consulte um profissional se precisar 🐝
      </Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card, borderRadius: 16, borderWidth: 1,
      borderColor: colors.border, padding: 14, gap: 10, marginVertical: 4,
    },
    header: { flexDirection: "row", alignItems: "center", gap: 10 },
    headerIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + "22", alignItems: "center", justifyContent: "center" },
    title: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "800", color: colors.foreground },
    subtitle: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 2 },
    daysRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    dayChip: { backgroundColor: colors.primary + "1A", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    dayChipText: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "700", color: colors.primary },
    expandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    expandText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    dayDetail: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border + "55" },
    dayDetailTitle: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.primary, marginBottom: 4 },
    exerciseLine: { fontFamily: FONTS.sans, fontSize: 12, color: colors.foreground, paddingVertical: 1 },
    moreText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, fontStyle: "italic" },
    actions: { flexDirection: "row", gap: 8 },
    btnPrimary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10 },
    btnPrimaryDone: { backgroundColor: "#10B981" },
    btnPrimaryText: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "800", color: "#000" },
    btnSecondary: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.primary },
    btnSecondaryText: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.primary },
    disclaimer: { fontFamily: FONTS.sans, fontSize: 10, color: colors.muted, lineHeight: 14, fontStyle: "italic" },
  });
}
