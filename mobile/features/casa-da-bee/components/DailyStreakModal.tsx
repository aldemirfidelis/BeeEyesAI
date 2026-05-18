import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useEffect } from "react";
import { Feather } from "@expo/vector-icons";

interface Props {
  visible: boolean;
  streakDay: number; // 1..7 (qual dia a vai reclamar AGORA)
  rewards: readonly number[];
  claimed: boolean;
  onClaim: () => void;
  onClose: () => void;
}

export function DailyStreakModal({ visible, streakDay, rewards, claimed, onClaim, onClose }: Props) {
  const pulse = useSharedValue(0);
  const claimAnim = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [pulse]);

  useEffect(() => {
    if (claimed) {
      claimAnim.value = withSequence(
        withTiming(1, { duration: 380 }),
        withTiming(0.95, { duration: 220 }),
      );
    }
  }, [claimed, claimAnim]);

  const todayStyle = useAnimatedStyle(() => ({
    transform: [{ scale: claimed ? 1 + claimAnim.value * 0.06 : 1 + pulse.value * 0.06 }],
  }));

  if (!visible) return null;

  return (
    <Animated.View entering={FadeIn.duration(280)} exiting={FadeOut.duration(220)} style={styles.backdrop}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Feather name="calendar" size={20} color="#7a4f18" />
          <Text style={styles.headerLabel}>RECOMPENSA DIÁRIA</Text>
        </View>
        <Text style={styles.title}>{claimed ? "Pólen coletado! 🎉" : `Dia ${streakDay} de visita`}</Text>
        <Text style={styles.subtitle}>
          {claimed
            ? "Volta amanhã para manter sua sequência!"
            : streakDay === 7
              ? "Você completou a semana! +60 pólen 💛"
              : `Volte todo dia: ${rewards.slice(streakDay - 1, streakDay + 2).join(" → ")} pólen`}
        </Text>

        <View style={styles.daysRow}>
          {rewards.map((reward, i) => {
            const dayNum = i + 1;
            const isCurrent = dayNum === streakDay;
            const isPast = dayNum < streakDay || (claimed && isCurrent);
            return (
              <Animated.View
                key={i}
                style={[
                  styles.day,
                  isPast && styles.dayPast,
                  isCurrent && !claimed && styles.dayCurrent,
                  isCurrent && !claimed ? todayStyle : null,
                ]}
              >
                {isPast ? (
                  <Feather name="check" size={14} color="#fff8d6" />
                ) : (
                  <>
                    <Feather name="zap" size={11} color={isCurrent ? "#2a2014" : "#7a4f18"} />
                    <Text style={[styles.dayReward, isCurrent && { color: "#2a2014" }]}>{reward}</Text>
                  </>
                )}
              </Animated.View>
            );
          })}
        </View>

        {claimed ? (
          <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={onClose}>
            <Text style={styles.buttonText}>Fechar</Text>
          </Pressable>
        ) : (
          <Pressable style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPressed]} onPress={onClaim}>
            <Feather name="zap" size={16} color="#2a2014" />
            <Text style={styles.buttonText}>Coletar +{rewards[Math.min(streakDay - 1, rewards.length - 1)]} pólen</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 6, 2, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    zIndex: 60,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff8d6",
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(87, 61, 28, 0.75)",
    padding: 22,
    alignItems: "stretch",
    gap: 10,
    shadowColor: "#231809",
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
  headerLabel: { color: "#7a4f18", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  title: { color: "#2c2114", fontSize: 22, fontWeight: "900", textAlign: "center" },
  subtitle: { color: "#5e4520", fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 19, paddingHorizontal: 8 },
  daysRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 12, gap: 4 },
  day: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgba(87, 61, 28, 0.12)",
    borderWidth: 2,
    borderColor: "rgba(87, 61, 28, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  dayPast: { backgroundColor: "#7a4f18", borderColor: "#5b3a24" },
  dayCurrent: { backgroundColor: "#ffd95b", borderColor: "rgba(78, 52, 24, 0.72)" },
  dayReward: { fontSize: 10, fontWeight: "900", color: "#7a4f18" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(78, 52, 24, 0.72)",
    backgroundColor: "rgba(87, 61, 28, 0.1)",
    marginTop: 4,
  },
  buttonPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(78, 52, 24, 0.72)",
    backgroundColor: "#ffd95b",
    marginTop: 4,
  },
  buttonPressed: { transform: [{ translateY: 2 }] },
  buttonText: { color: "#2a2014", fontSize: 14, fontWeight: "900" },
});
