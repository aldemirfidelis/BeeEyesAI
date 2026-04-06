import { useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMood } from "@mobile/hooks/useMood";
import MoodSelector from "@mobile/components/MoodSelector";
import { COLORS, FONTS } from "@mobile/lib/theme";

const MOOD_COLORS = ["", "#E53E3E", "#FF8C42", "#888888", "#4CAF50", COLORS.primary];
const MOOD_LABELS = ["", "Muito mal", "Mal", "Normal", "Bem", "Ótimo!"];
const MOOD_MESSAGES = [
  "",
  "Sinto muito que não esteja bem. Estou aqui para te ajudar! 💙",
  "Dias difíceis fazem parte. Vamos trabalhar juntos para melhorar! 💪",
  "Tudo bem ter dias normais. Continue firme! 🙂",
  "Que bom que você está bem! Aproveite esse momento! ✨",
  "Incrível! Você está radiante hoje! Continue assim! 🌟",
];

export default function MoodScreen() {
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const { entries, logMood } = useMood(30);

  async function handleSaveMood() {
    if (!selectedMood) return;
    await logMood.mutateAsync({ mood: selectedMood, note: note || undefined });
    setSaved(true);
    setNote("");
    setTimeout(() => setSaved(false), 3000);
  }

  // Build 30-day calendar grid
  const today = new Date();
  const calendarDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (29 - i));
    return d;
  });

  const moodByDate: Record<string, number> = {};
  for (const entry of entries) {
    const key = new Date(entry.createdAt).toDateString();
    moodByDate[key] = entry.mood;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.header}>Como você está? 💛</Text>

        {/* Mood Selector */}
        <View style={styles.selectorSection}>
          <MoodSelector selectedMood={selectedMood} onSelectMood={setSelectedMood} />
        </View>

        {/* AI response bubble */}
        {selectedMood && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.responseBubble}>
            <Text style={styles.beeEmoji}>🐝</Text>
            <Text style={styles.responseText}>{MOOD_MESSAGES[selectedMood]}</Text>
          </Animated.View>
        )}

        {/* Note input */}
        {selectedMood && !saved && (
          <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.noteSection}>
            <TextInput
              style={styles.noteInput}
              placeholder="Quer falar mais sobre como está se sentindo? (opcional)"
              placeholderTextColor={COLORS.muted}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveMood}
              disabled={logMood.isPending}
            >
              <Text style={styles.saveButtonText}>
                {logMood.isPending ? "Salvando..." : "Registrar Humor"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {saved && (
          <Animated.View entering={FadeInDown} style={styles.savedBadge}>
            <Text style={styles.savedText}>✓ Humor registrado!</Text>
          </Animated.View>
        )}

        {/* 30-day calendar heatmap */}
        <View style={styles.calendarSection}>
          <Text style={styles.calendarTitle}>📅 Últimos 30 dias</Text>
          <View style={styles.grid}>
            {calendarDays.map((d, i) => {
              const key = d.toDateString();
              const mood = moodByDate[key];
              return (
                <View
                  key={i}
                  style={[
                    styles.gridCell,
                    mood ? { backgroundColor: MOOD_COLORS[mood] + "99" } : null,
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.legend}>
            {[1, 2, 3, 4, 5].map((m) => (
              <View key={m} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: MOOD_COLORS[m] }]} />
                <Text style={styles.legendLabel}>{MOOD_LABELS[m]}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 20 },
  header: { fontFamily: FONTS.display, fontSize: 24, fontWeight: "700", color: COLORS.foreground },
  selectorSection: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
  },
  responseBubble: {
    backgroundColor: COLORS.secondary,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderBottomLeftRadius: 4,
  },
  beeEmoji: { fontSize: 24 },
  responseText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: COLORS.foreground,
    lineHeight: 22,
  },
  noteSection: { gap: 10 },
  noteInput: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    fontSize: 14,
    fontFamily: FONTS.sans,
    color: COLORS.foreground,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonText: { fontFamily: FONTS.sans, fontWeight: "700", color: "#1A1A1A", fontSize: 15 },
  savedBadge: {
    backgroundColor: "#4CAF5022",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  savedText: { fontFamily: FONTS.sans, fontWeight: "600", color: "#4CAF50", fontSize: 15 },
  calendarSection: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  calendarTitle: { fontFamily: FONTS.sans, fontWeight: "600", fontSize: 16, color: COLORS.foreground },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  gridCell: {
    width: "12.5%",
    aspectRatio: 1,
    borderRadius: 6,
    backgroundColor: COLORS.secondary,
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted },
});

