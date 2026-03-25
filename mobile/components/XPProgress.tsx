import { View, Text, StyleSheet } from "react-native";
import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, FONTS } from "../lib/theme";

interface XPProgressProps {
  currentXP: number;
  level: number;
  xpToNextLevel: number;
}

export default function XPProgress({ currentXP, level, xpToNextLevel }: XPProgressProps) {
  const progress = Math.min(currentXP / xpToNextLevel, 1);
  const widthAnim = useSharedValue(0);

  useEffect(() => {
    widthAnim.value = withTiming(progress, { duration: 600 });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${widthAnim.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelEmoji}>🏆</Text>
          <Text style={styles.levelNumber}>{level}</Text>
        </View>
        <View>
          <Text style={styles.levelLabel}>Nível {level}</Text>
          <Text style={styles.xpLabel}>
            {currentXP}/{xpToNextLevel} XP
          </Text>
        </View>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.barContainer, barStyle]}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.chart2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  levelEmoji: {
    fontSize: 20,
  },
  levelNumber: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.primary,
    color: "#1A1A1A",
    fontSize: 10,
    fontFamily: FONTS.mono,
    fontWeight: "700",
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: "center",
    lineHeight: 18,
  },
  levelLabel: {
    fontFamily: FONTS.display,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.foreground,
  },
  xpLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.muted,
  },
  track: {
    height: 12,
    backgroundColor: COLORS.secondary,
    borderRadius: 6,
    overflow: "hidden",
  },
  barContainer: {
    height: "100%",
    borderRadius: 6,
    overflow: "hidden",
  },
});
