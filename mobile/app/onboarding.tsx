import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef } from "react";
import {
  Alert, Dimensions, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { api, getApiErrorMessage } from "@mobile/lib/api";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useAuthStore } from "@mobile/stores/authStore";
import { useUIStore } from "@mobile/stores/uiStore";
import BeeEyes from "@mobile/components/BeeEyes";

const { width } = Dimensions.get("window");
const TOTAL_STEPS = 3; // 0 = welcome, 1 = goals, 2 = routine, 3 = interests

// â”€â”€ Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ï¿½ï¿½ï¿½â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ï¿½ï¿½ï¿½â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const OBJECTIVES = [
  { emoji: "ðŸ’°", label: "Dinheiro" },
  { emoji: "ðŸ‹ï¸", label: "Treino" },
  { emoji: "ðŸ“š", label: "Estudos" },
  { emoji: "ðŸ’¼", label: "Carreira" },
  { emoji: "â¤ï¸", label: "Relacionamentos" },
  { emoji: "ðŸ§˜", label: "Bem-estar" },
  { emoji: "ðŸš€", label: "NegÃ³cios" },
  { emoji: "ðŸŽ", label: "SaÃºde" },
  { emoji: "ðŸŽ¨", label: "Criatividade" },
  { emoji: "ðŸ ", label: "FamÃ­lia" },
  { emoji: "âœˆï¸", label: "Viagens" },
  { emoji: "ðŸŽ¯", label: "Produtividade" },
];

const WORK_PROFILES = [
  { emoji: "ðŸ‘”", label: "Empregado" },
  { emoji: "ðŸ§‘â€ðŸ’»", label: "AutÃ´nomo" },
  { emoji: "ðŸŽ“", label: "Estudante" },
  { emoji: "ðŸ ", label: "Do lar" },
  { emoji: "ðŸ”", label: "Em transiÃ§Ã£o" },
];

const ACTIVE_PERIODS = [
  { emoji: "ðŸŒ…", label: "ManhÃ£" },
  { emoji: "â˜€ï¸", label: "Tarde" },
  { emoji: "ðŸŒ™", label: "Noite" },
];

const INTERESTS = [
  { emoji: "ðŸ¤–", label: "IA" },
  { emoji: "ðŸ’¹", label: "FinanÃ§as" },
  { emoji: "ðŸƒ", label: "Fitness" },
  { emoji: "ðŸ“°", label: "NotÃ­cias" },
  { emoji: "âš¡", label: "Produtividade" },
  { emoji: "ðŸ§ ", label: "Autoconhecimento" },
  { emoji: "ðŸ’»", label: "Tecnologia" },
  { emoji: "ðŸ“–", label: "Leitura" },
  { emoji: "ðŸŽµ", label: "MÃºsica" },
  { emoji: "ðŸŽ®", label: "Games" },
  { emoji: "ðŸ•", label: "Gastronomia" },
  { emoji: "ðŸŒ¿", label: "Sustentabilidade" },
  { emoji: "ðŸŽ­", label: "Cultura" },
  { emoji: "ðŸ“±", label: "Redes Sociais" },
  { emoji: "ðŸ”¬", label: "CiÃªncia" },
  { emoji: "ðŸ˜ï¸", label: "Comunidades" },
  { emoji: "âœï¸", label: "Escrita" },
  { emoji: "ðŸ“Š", label: "Business" },
  { emoji: "ðŸ§˜", label: "MeditaÃ§Ã£o" },
  { emoji: "ðŸŽ¬", label: "Cinema" },
];

// â”€â”€ Bee expressions per step â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ï¿½ï¿½ï¿½â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BEE_EXPR = ["happy", "excited", "curious", "celebrating"] as const;

// â”€â”€ Main screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function OnboardingScreen() {
  const themeMode = useUIStore((state) => state.themeMode);
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);
  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);

  const [step, setStep] = useState(0);
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>([]);
  const [workProfile, setWorkProfile] = useState("");
  const [activePeriods, setActivePeriods] = useState<string[]>([]);
  const [routine, setRoutine] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const firstName = user?.displayName?.split(" ")[0] || user?.username || "vocÃª";

  // â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ï¿½ï¿½â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function animateToStep(nextStep: number, direction: "forward" | "back" = "forward") {
    const outX = direction === "forward" ? -30 : 30;
    const inX = direction === "forward" ? 30 : -30;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: outX, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(inX);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }

  function handleNext() {
    if (step === 0) { animateToStep(1); return; }
    if (step === 1) {
      if (selectedObjectives.length === 0) {
        Alert.alert("Escolha pelo menos 1 objetivo", "Isso ajuda a Bee a entender o que Ã© mais importante para vocÃª.");
        return;
      }
      animateToStep(2);
      return;
    }
    if (step === 2) {
      if (!workProfile) {
        Alert.alert("Qual seu perfil?", "Selecione o que melhor descreve sua situaÃ§Ã£o atual.");
        return;
      }
      if (!routine.trim()) {
        Alert.alert("Conte sobre sua rotina", "Uma frase jÃ¡ basta â€” isso personaliza muito as respostas da Bee.");
        return;
      }
      animateToStep(3);
      return;
    }
    if (step === 3) {
      handleFinish();
    }
  }

  function handleBack() {
    if (step > 0) animateToStep(step - 1, "back");
  }

  // â”€â”€ Toggle helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ï¿½ï¿½â”€â”€

  function toggleObjective(label: string) {
    setSelectedObjectives((prev) =>
      prev.includes(label) ? prev.filter((o) => o !== label) : prev.length < 3 ? [...prev, label] : prev,
    );
  }

  function togglePeriod(label: string) {
    setActivePeriods((prev) =>
      prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label],
    );
  }

  function toggleInterest(label: string) {
    setSelectedInterests((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : prev.length < 8 ? [...prev, label] : prev,
    );
  }

  // â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ï¿½ï¿½ï¿½â”€

  async function handleFinish() {
    if (selectedInterests.length === 0) {
      Alert.alert("Escolha pelo menos 1 interesse", "Isso ajuda a Bee a personalizar respostas e conteudos.");
      return;
    }
    setSaving(true);
    try {
      const routineText = [
        workProfile ? `Perfil: ${workProfile}` : "",
        activePeriods.length > 0 ? `Mais ativo(a): ${activePeriods.join(", ")}` : "",
        routine.trim(),
      ].filter(Boolean).join(" | ");

      const { data } = await api.post("/api/me/onboarding", {
        objectives: selectedObjectives,
        workProfile,
        activePeriod: activePeriods,
        routine: routineText,
        interests: selectedInterests,
      });
      setUser(data);
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("Erro", getApiErrorMessage(error, "NÃ£o foi possÃ­vel salvar suas preferÃªncias."));
    } finally {
      setSaving(false);
    }
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar â€” hidden on welcome */}
      {step > 0 && (
        <View style={styles.progressBar}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[styles.progressSegment, step >= s && styles.progressSegmentActive]}
            />
          ))}
        </View>
      )}

      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Bee mascot */}
          <LinearGradient
            colors={["#FFF8E7", "#FFE566", "#FFD940"]}
            style={styles.heroGradient}
          >
            <BeeEyes expression={BEE_EXPR[step]} size={step === 0 ? 100 : 72} />
          </LinearGradient>

          {/* â”€â”€ Step 0: Welcome â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.greeting}>Oi, {firstName}! ðŸ</Text>
              <Text style={styles.title}>Vamos ajustar a Bee para vocÃª</Text>
              <Text style={styles.subtitle}>
                Em 3 passos rÃ¡pidos eu aprendo o que importa para vocÃª â€” seus objetivos, sua rotina e seus interesses.
              </Text>
              <Text style={styles.subtitle}>
                Com isso, minhas respostas e alertas ficam muito mais uteis e relevantes para a sua vida real.
              </Text>
              <View style={styles.featureList}>
                {[
                  { emoji: "ðŸŽ¯", text: "Apoio personalizado para seus objetivos" },
                  { emoji: "ðŸ’¬", text: "Conversas que fazem sentido para vocÃª" },
                  { emoji: "âš¡", text: "Alertas e dicas alinhados Ã  sua rotina" },
                ].map((item) => (
                  <View key={item.text} style={styles.featureRow}>
                    <Text style={styles.featureEmoji}>{item.emoji}</Text>
                    <Text style={styles.featureText}>{item.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* â”€â”€ Step 1: Objectives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ï¿½ï¿½â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepLabel}>Passo 1 de 3</Text>
              <Text style={styles.title}>Quais seus principais objetivos?</Text>
              <Text style={styles.subtitle}>
                Escolha atÃ© 3 que mais representam o que vocÃª quer conquistar agora.
              </Text>
              <View style={styles.grid}>
                {OBJECTIVES.map((item) => {
                  const active = selectedObjectives.includes(item.label);
                  const disabled = !active && selectedObjectives.length >= 3;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.goalChip,
                        active && styles.goalChipActive,
                        disabled && styles.goalChipDisabled,
                      ]}
                      onPress={() => toggleObjective(item.label)}
                      disabled={disabled}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.goalEmoji}>{item.emoji}</Text>
                      <Text style={[styles.goalLabel, active && styles.goalLabelActive]}>
                        {item.label}
                      </Text>
                      {active && <Text style={styles.checkmark}>âœ“</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {selectedObjectives.length > 0 && (
                <Text style={styles.selectionHint}>
                  Selecionado{selectedObjectives.length > 1 ? "s" : ""}: {selectedObjectives.join(", ")}
                </Text>
              )}
            </View>
          )}

          {/* â”€â”€ Step 2: Routine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepLabel}>Passo 2 de 3</Text>
              <Text style={styles.title}>Como Ã© a sua rotina?</Text>
              <Text style={styles.subtitle}>
                Essas informaÃ§Ãµes ajudam a Bee a entender seu contexto e propor aÃ§Ãµes no momento certo.
              </Text>

              <Text style={styles.sectionTitle}>Seu perfil</Text>
              <View style={styles.chipRow}>
                {WORK_PROFILES.map((item) => {
                  const active = workProfile === item.label;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setWorkProfile(active ? "" : item.label)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.pillEmoji}>{item.emoji}</Text>
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>Quando vocÃª Ã© mais ativo(a)?</Text>
              <View style={styles.chipRow}>
                {ACTIVE_PERIODS.map((item) => {
                  const active = activePeriods.includes(item.label);
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => togglePeriod(item.label)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.pillEmoji}>{item.emoji}</Text>
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>Descreva seu dia a dia</Text>
              <TextInput
                style={styles.textArea}
                value={routine}
                onChangeText={setRoutine}
                placeholder="Ex.: trabalho de manhÃ£ em home office, estudo Ã  noite, treino 3x por semana..."
                placeholderTextColor={colors.muted}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, routine.length >= 270 && { color: colors.primaryDark }]}>
                {routine.length}/300
              </Text>
            </View>
          )}

          {/* â”€â”€ Step 3: Interests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ï¿½ï¿½ï¿½â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepLabel}>Passo 3 de 3</Text>
              <Text style={styles.title}>O que te interessa?</Text>
              <Text style={styles.subtitle}>
                Escolha ate 8 temas. Isso define o conteudo que a Bee traz para voce.
              </Text>
              <View style={styles.interestGrid}>
                {INTERESTS.map((item) => {
                  const active = selectedInterests.includes(item.label);
                  const disabled = !active && selectedInterests.length >= 8;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.interestChip,
                        active && styles.interestChipActive,
                        disabled && styles.interestChipDisabled,
                      ]}
                      onPress={() => toggleInterest(item.label)}
                      disabled={disabled}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.interestEmoji}>{item.emoji}</Text>
                      <Text style={[styles.interestLabel, active && styles.interestLabelActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.selectionHint}>
                {selectedInterests.length}/8 selecionados
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* â”€â”€ Bottom navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ï¿½ï¿½ï¿½â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>â† Voltar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, step === 0 && styles.nextButtonFull, saving && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={saving}
        >
          <LinearGradient
            colors={["#FFD940", "#F5C842", "#E8B800"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextButtonGradient}
          >
            <Text style={styles.nextButtonText}>
              {saving
                ? "Salvando..."
                : step === 0
                ? "Vamos comeÃ§ar! ðŸ"
                : step === 3
                ? "Entrar no BeeEyes ðŸš€"
                : "PrÃ³ximo â†’"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    progressBar: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 4,
    },
    progressSegment: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    progressSegmentActive: {
      backgroundColor: colors.primaryDark,
    },

    heroGradient: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 28,
      marginHorizontal: -24,
      marginTop: -8,
      marginBottom: 4,
    },

    content: { padding: 24, paddingBottom: 16, gap: 0 },
    stepContent: { gap: 14 },

    greeting: {
      fontFamily: FONTS.display,
      fontSize: 20,
      fontWeight: "700",
      color: colors.primaryDark,
    },
    stepLabel: {
      fontFamily: FONTS.mono,
      fontSize: 11,
      fontWeight: "700",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    title: {
      fontFamily: FONTS.display,
      fontSize: 26,
      fontWeight: "800",
      color: colors.foreground,
      lineHeight: 32,
    },
    subtitle: {
      fontFamily: FONTS.sans,
      fontSize: 14,
      lineHeight: 21,
      color: colors.muted,
    },

    featureList: { gap: 10, marginTop: 4 },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    featureEmoji: { fontSize: 20, width: 28 },
    featureText: { fontFamily: FONTS.sans, fontSize: 14, color: colors.foreground, flex: 1, lineHeight: 20 },

    sectionTitle: {
      fontFamily: FONTS.sans,
      fontSize: 14,
      fontWeight: "800",
      color: colors.foreground,
      marginTop: 4,
    },

    // Goals grid (2-col)
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    goalChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      minWidth: (width - 48 - 10) / 2,
    },
    goalChipActive: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.primary + "22",
    },
    goalChipDisabled: { opacity: 0.35 },
    goalEmoji: { fontSize: 18 },
    goalLabel: {
      fontFamily: FONTS.sans,
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      flex: 1,
    },
    goalLabelActive: { color: colors.primaryDark },
    checkmark: { fontSize: 13, color: colors.primaryDark, fontWeight: "800" },
    selectionHint: {
      fontFamily: FONTS.sans,
      fontSize: 12,
      color: colors.primaryDark,
      fontWeight: "700",
    },

    // Pills
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    pillActive: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.primary + "22",
    },
    pillEmoji: { fontSize: 14 },
    pillText: {
      fontFamily: FONTS.sans,
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    pillTextActive: { color: colors.primaryDark },

    // Routine text area
    textArea: {
      minHeight: 100,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      color: colors.foreground,
      padding: 14,
      fontFamily: FONTS.sans,
      fontSize: 14,
      lineHeight: 21,
    },
    charCount: {
      fontFamily: FONTS.mono,
      fontSize: 11,
      color: colors.muted,
      textAlign: "right",
      marginTop: -8,
    },

    // Interests grid
    interestGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    interestChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    interestChipActive: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.primary + "22",
    },
    interestChipDisabled: { opacity: 0.35 },
    interestEmoji: { fontSize: 14 },
    interestLabel: {
      fontFamily: FONTS.sans,
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    interestLabelActive: { color: colors.primaryDark },

    // Footer navigation
    footer: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 24,
      paddingBottom: 12,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    backButton: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      justifyContent: "center",
    },
    backButtonText: {
      fontFamily: FONTS.sans,
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    nextButton: {
      flex: 1,
      borderRadius: 14,
      overflow: "hidden",
      shadowColor: "#F5C842",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
    nextButtonFull: { flex: 1 },
    nextButtonDisabled: { opacity: 0.6 },
    nextButtonGradient: {
      paddingVertical: 15,
      alignItems: "center",
    },
    nextButtonText: {
      fontFamily: FONTS.sans,
      fontSize: 16,
      fontWeight: "800",
      color: "#1A1A1A",
    },
  });
}
