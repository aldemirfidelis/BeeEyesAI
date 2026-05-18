import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

interface Step {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: "smile",
    title: "Oi! Eu sou a Bee 🐝",
    body: "Essa é a minha casa. Quando você usar o chat, eu trabalho aqui para te ajudar — pesquisas, agendas, treinos.",
  },
  {
    icon: "navigation",
    title: "Toque pra me chamar",
    body: "Toque em qualquer tile do chão e eu vou até lá. Toque em um móvel para interagir.",
  },
  {
    icon: "zap",
    title: "Coleta pólen",
    body: "Conforme você usa o app, pólens aparecem na casa. Toque para coletar e subir de nível.",
  },
];

interface Props {
  visible: boolean;
  onComplete: () => void;
}

export function OnboardingOverlay({ visible, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.18 }],
    opacity: 0.55 + pulse.value * 0.35,
  }));

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      onComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(280)} exiting={FadeOut.duration(220)} style={styles.backdrop}>
      <View style={styles.card}>
        <Animated.View style={[styles.iconWrap, dotStyle]}>
          <Feather name={current.icon} size={28} color="#2a2014" />
        </Animated.View>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>

        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step ? styles.dotActive : null]} />
          ))}
        </View>

        <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={next}>
          <Text style={styles.buttonText}>{isLast ? "Vamos começar" : "Próximo"}</Text>
          <Feather name="arrow-right" size={16} color="#2a2014" />
        </Pressable>
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
    paddingHorizontal: 24,
    zIndex: 50,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff8d6",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(87, 61, 28, 0.75)",
    padding: 22,
    alignItems: "center",
    gap: 10,
    shadowColor: "#231809",
    shadowOpacity: 0.4,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffd95b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(78, 52, 24, 0.72)",
    marginBottom: 4,
  },
  title: {
    color: "#2c2114",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  body: {
    color: "#5e4520",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 6,
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    marginVertical: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(87, 61, 28, 0.25)",
  },
  dotActive: {
    width: 22,
    backgroundColor: "#f5b400",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#ffd95b",
    borderWidth: 2,
    borderColor: "rgba(78, 52, 24, 0.72)",
    marginTop: 6,
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    backgroundColor: "#f5b400",
  },
  buttonText: {
    color: "#2a2014",
    fontSize: 14,
    fontWeight: "900",
  },
});
