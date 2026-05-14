/**
 * bee-create-workout.tsx
 *
 * Fluxo guiado de criação manual de plano de treino:
 *  1) Objetivo
 *  2) Nível
 *  3) Dias de treino (+ descanso automático)
 *  4) Preferência de equipamento
 *  5) Tipo de split (opcional — Bee sugere)
 *  6) Confirmar e salvar
 *
 * O backend gera os exercícios com base nas escolhas.
 */

import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Alert, TextInput, Switch,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useUIStore } from "@mobile/stores/uiStore";
import { getThemeColors, FONTS } from "@mobile/lib/theme";
import {
  createWorkoutPlan, getHealthProfile, updateHealthProfile, syncCalendar,
  type WeekDay, type HealthGoal, type FitnessLevel, type EquipmentPref, type SplitType,
  WEEK_DAYS_PT, GOAL_LABELS_PT, LEVEL_LABELS_PT, EQUIPMENT_LABELS_PT,
} from "@mobile/services/healthApi";

const WEEK_ORDER: WeekDay[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const SPLIT_OPTIONS: { value: SplitType; label: string; hint: string }[] = [
  { value: "full_body", label: "Corpo inteiro", hint: "Ideal para 2-3 dias/sem ou iniciantes" },
  { value: "upper_lower", label: "Superiores e inferiores", hint: "Ideal para 4 dias/sem" },
  { value: "push_pull_legs", label: "Push / Pull / Legs", hint: "Ideal para 5-6 dias/sem" },
  { value: "abc", label: "ABC", hint: "Divisão em 3 treinos rotativos" },
  { value: "cardio_musculacao", label: "Cardio + musculação", hint: "Equilibrado para perda de gordura" },
];

export default function BeeCreateWorkoutScreen() {
  const { themeMode } = useUIStore();
  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("Meu treino");
  const [goal, setGoal] = useState<HealthGoal>("saude_geral");
  const [level, setLevel] = useState<FitnessLevel>("iniciante");
  const [trainingDays, setTrainingDays] = useState<WeekDay[]>(["monday", "wednesday", "friday"]);
  const [equipment, setEquipment] = useState<EquipmentPref>("misto");
  const [splitType, setSplitType] = useState<SplitType | "auto">("auto");
  const [time, setTime] = useState("18:30");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState("30");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await getHealthProfile();
        if (p.healthGoal) setGoal(p.healthGoal);
        if (p.level) setLevel(p.level);
        if (p.trainingDays.length) setTrainingDays(p.trainingDays as WeekDay[]);
        if (p.equipmentPreference) setEquipment(p.equipmentPreference);
        if (p.preferredWorkoutTime) setTime(p.preferredWorkoutTime);
        if (p.reminderEnabled) setReminderEnabled(true);
        if (p.reminderMinutesBefore) setReminderMinutes(String(p.reminderMinutesBefore));
      } catch {}
    })();
  }, []);

  function toggleDay(d: WeekDay) {
    setTrainingDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b))
    );
  }

  async function save() {
    if (trainingDays.length === 0) {
      Alert.alert("Atenção", "Escolha pelo menos 1 dia de treino 🐝");
      return;
    }
    setSaving(true);
    try {
      // Atualiza preferências
      await updateHealthProfile({
        healthGoal: goal,
        level,
        trainingDays,
        restDays: WEEK_ORDER.filter((d) => !trainingDays.includes(d)),
        equipmentPreference: equipment,
        preferredWorkoutTime: time || null,
        reminderEnabled,
        reminderMinutesBefore: parseInt(reminderMinutes, 10) || 30,
      });
      // Cria plano
      const plan = await createWorkoutPlan({
        name,
        goal,
        level,
        trainingDays,
        equipmentPreference: equipment,
        splitType: splitType === "auto" ? undefined : splitType,
        createdBy: "user",
      });

      // Sincroniza calendário/alarmes se o usuário ativou
      let syncMsg = "";
      if (reminderEnabled) {
        try {
          const result = await syncCalendar(plan.id, {
            weeks: 4,
            time: time || "18:30",
            reminderMinutesBefore: parseInt(reminderMinutes, 10) || 30,
          });
          syncMsg = `\n${result.eventsCreated} treinos no calendário + ${result.alarmsCreated} lembretes`;
        } catch {}
      }

      Alert.alert("Pronto! 🐝✨", `Seu plano foi salvo. Bons treinos!${syncMsg}`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Não consegui salvar seu plano");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Criar plano de treino</Text>
          <Text style={styles.headerSub}>Etapa {step + 1} de 6</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {step === 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Qual seu objetivo principal?</Text>
            {(Object.keys(GOAL_LABELS_PT) as HealthGoal[]).filter((g) => g !== "outro").map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.optionCard, goal === g && styles.optionSelected]}
                onPress={() => setGoal(g)}
                activeOpacity={0.75}
              >
                <Feather name="target" size={16} color={goal === g ? colors.primary : colors.muted} />
                <Text style={[styles.optionLabel, goal === g && { color: colors.primary }]}>
                  {GOAL_LABELS_PT[g]}
                </Text>
                {goal === g && <Feather name="check-circle" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Qual seu nível hoje?</Text>
            {(["iniciante", "intermediario", "avancado"] as FitnessLevel[]).map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.optionCard, level === l && styles.optionSelected]}
                onPress={() => setLevel(l)}
                activeOpacity={0.75}
              >
                <Text style={[styles.optionLabel, level === l && { color: colors.primary }]}>
                  {LEVEL_LABELS_PT[l]}
                </Text>
                {level === l && <Feather name="check-circle" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quais dias você quer treinar?</Text>
            <Text style={styles.sectionHint}>Os outros dias viram descanso automaticamente.</Text>
            {WEEK_ORDER.map((d) => {
              const selected = trainingDays.includes(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayRow, selected && styles.dayRowActive]}
                  onPress={() => toggleDay(d)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.dayBox, selected && styles.dayBoxActive]}>
                    {selected && <Feather name="check" size={14} color="#000" />}
                  </View>
                  <Text style={[styles.dayLabel, selected && { color: colors.foreground, fontWeight: "700" }]}>
                    {WEEK_DAYS_PT[d]}
                  </Text>
                  {selected && <Text style={styles.dayBadge}>treino</Text>}
                  {!selected && <Text style={[styles.dayBadge, { color: colors.muted }]}>descanso</Text>}
                </TouchableOpacity>
              );
            })}
            <Text style={styles.daysSummary}>
              {trainingDays.length} dia{trainingDays.length === 1 ? "" : "s"} por semana
            </Text>
          </View>
        )}

        {step === 3 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferência de equipamento</Text>
            {(["misto", "aparelho", "halter", "peso_corporal"] as EquipmentPref[]).map((e) => (
              <TouchableOpacity
                key={e}
                style={[styles.optionCard, equipment === e && styles.optionSelected]}
                onPress={() => setEquipment(e)}
                activeOpacity={0.75}
              >
                <Feather name="box" size={16} color={equipment === e ? colors.primary : colors.muted} />
                <Text style={[styles.optionLabel, equipment === e && { color: colors.primary }]}>
                  {EQUIPMENT_LABELS_PT[e]}
                </Text>
                {equipment === e && <Feather name="check-circle" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 4 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipo de divisão (opcional)</Text>
            <Text style={styles.sectionHint}>Deixe em "Bee escolhe" para a sugestão automática.</Text>
            <TouchableOpacity
              style={[styles.optionCard, splitType === "auto" && styles.optionSelected]}
              onPress={() => setSplitType("auto")}
              activeOpacity={0.75}
            >
              <Feather name="zap" size={16} color={splitType === "auto" ? colors.primary : colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, splitType === "auto" && { color: colors.primary }]}>
                  Bee escolhe pra mim
                </Text>
                <Text style={styles.optionHint}>Recomendado · escolha equilibrada baseada nos seus dados</Text>
              </View>
              {splitType === "auto" && <Feather name="check-circle" size={16} color={colors.primary} />}
            </TouchableOpacity>
            {SPLIT_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[styles.optionCard, splitType === s.value && styles.optionSelected]}
                onPress={() => setSplitType(s.value)}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, splitType === s.value && { color: colors.primary }]}>
                    {s.label}
                  </Text>
                  <Text style={styles.optionHint}>{s.hint}</Text>
                </View>
                {splitType === s.value && <Feather name="check-circle" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 5 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirmar e salvar</Text>

            <Text style={styles.formLabel}>Nome do plano</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex.: Treino para começar"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />

            <Text style={styles.formLabel}>Horário preferido (opcional)</Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />

            <View style={styles.row}>
              <Text style={styles.formLabel}>Lembrete antes do treino?</Text>
              <Switch
                value={reminderEnabled}
                onValueChange={setReminderEnabled}
                thumbColor={reminderEnabled ? colors.primary : undefined}
              />
            </View>
            {reminderEnabled && (
              <>
                <Text style={styles.formLabel}>Minutos antes</Text>
                <TextInput
                  value={reminderMinutes}
                  onChangeText={setReminderMinutes}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </>
            )}

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Resumo</Text>
              <Text style={styles.summaryLine}>Objetivo: {GOAL_LABELS_PT[goal]}</Text>
              <Text style={styles.summaryLine}>Nível: {LEVEL_LABELS_PT[level]}</Text>
              <Text style={styles.summaryLine}>Dias: {trainingDays.map((d) => WEEK_DAYS_PT[d]).join(", ")}</Text>
              <Text style={styles.summaryLine}>Equipamento: {EQUIPMENT_LABELS_PT[equipment]}</Text>
              {splitType !== "auto" && (
                <Text style={styles.summaryLine}>
                  Divisão: {SPLIT_OPTIONS.find((s) => s.value === splitType)?.label}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep((s) => s - 1)} activeOpacity={0.8}>
            <Text style={styles.btnSecondaryText}>Voltar</Text>
          </TouchableOpacity>
        )}
        {step < 5 ? (
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setStep((s) => s + 1)} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>Continuar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnPrimary} onPress={save} activeOpacity={0.85} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.btnPrimaryText}>Salvar plano</Text>}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
    backBtn: { padding: 6, borderRadius: 8 },
    headerTitle: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "800", color: colors.foreground },
    headerSub: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 2 },
    body: { padding: 16, paddingBottom: 96 },
    section: { gap: 10 },
    sectionTitle: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "800", color: colors.foreground, marginBottom: 4 },
    sectionHint: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginBottom: 6 },

    optionCard: {
      padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 10,
    },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + "14" },
    optionLabel: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.foreground, flex: 1 },
    optionHint: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 2 },

    dayRow: {
      flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 10,
    },
    dayRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + "10" },
    dayBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    dayBoxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayLabel: { fontFamily: FONTS.sans, fontSize: 14, color: colors.muted, flex: 1 },
    dayBadge: { fontFamily: FONTS.sans, fontSize: 11, color: colors.primary, fontWeight: "700" },
    daysSummary: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 4, alignSelf: "center" },

    formLabel: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.muted, marginTop: 6 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontFamily: FONTS.sans, fontSize: 14, color: colors.foreground, backgroundColor: colors.card },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
    summaryCard: { backgroundColor: colors.primary + "0F", borderRadius: 14, borderWidth: 1, borderColor: colors.primary + "33", padding: 12, marginTop: 12, gap: 4 },
    summaryTitle: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "800", color: colors.primary, marginBottom: 4 },
    summaryLine: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground },

    footer: { flexDirection: "row", padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    btnPrimary: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    btnPrimaryText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: "#000" },
    btnSecondary: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    btnSecondaryText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "700", color: colors.foreground },
  });
}
