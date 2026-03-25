import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { FONTS } from "../lib/theme";

interface StreakDisplayProps {
  streak: number;
}

export default function StreakDisplay({ streak }: StreakDisplayProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (streak > 0) {
      rotation.value = withRepeat(
        withSequence(
          withTiming(-10, { duration: 200 }),
          withTiming(10, { duration: 200 }),
          withTiming(-10, { duration: 200 }),
          withTiming(0, { duration: 200 }),
          withTiming(0, { duration: 2000 })
        ),
        -1,
        false
      );
    }
  }, [streak]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <LinearGradient
      colors={["#FF8C42", "#F5C842"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.container}
    >
      <Animated.Text style={[styles.flame, flameStyle]}>🔥</Animated.Text>
      <Text style={styles.count}>{streak}</Text>
      <Text style={styles.label}>dias</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  flame: {
    fontSize: 18,
  },
  count: {
    color: "#1A1A1A",
    fontFamily: FONTS.mono,
    fontWeight: "700",
    fontSize: 18,
  },
  label: {
    color: "#1A1A1A",
    fontFamily: FONTS.sans,
    fontSize: 13,
    fontWeight: "500",
  },
});
