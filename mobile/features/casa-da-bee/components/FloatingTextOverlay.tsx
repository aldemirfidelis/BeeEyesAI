import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { Effect } from "../engine/effects";

interface Props {
  effects: Effect[];
}

export function FloatingTextOverlay({ effects }: Props) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {effects
        .filter((e) => e.kind === "floating-text")
        .map((effect) => (
          <FloatingText key={effect.id} effect={effect} />
        ))}
    </View>
  );
}

function FloatingText({ effect }: { effect: Effect }) {
  const t = useSharedValue(0);
  const duration = effect.payload.durationMs ?? 1400;

  useEffect(() => {
    t.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
  }, [duration, t]);

  const text = effect.payload.text ?? "";
  const color = effect.payload.color ?? "#fff4c2";

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -t.value * 42 }, { scale: 1 + Math.max(0, 0.18 - Math.abs(t.value - 0.1) * 0.4) }],
    opacity: 1 - Math.pow(t.value, 2.2),
  }));

  return (
    <Animated.View style={[styles.bubble, { left: effect.x, top: effect.y }, style]}>
      {effect.payload.icon && (
        <Feather name={effect.payload.icon as keyof typeof Feather.glyphMap} size={13} color={color} />
      )}
      <Text style={[styles.text, { color }]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(20, 14, 5, 0.78)",
    transform: [{ translateX: -30 }],
  },
  text: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
});
