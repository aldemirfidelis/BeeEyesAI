import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { COLORS, FONTS } from "../lib/theme";
import { useUIStore } from "../stores/uiStore";

export default function AchievementToast() {
  const { achievement, clearAchievement } = useUIStore();
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (achievement) {
      translateY.value = withSpring(0, { damping: 15 });
      opacity.value = withTiming(1, { duration: 200 });

      const timer = setTimeout(() => {
        translateY.value = withTiming(-120, { duration: 300 });
        opacity.value = withTiming(0, { duration: 300 }, (done) => {
          if (done) runOnJS(clearAchievement)();
        });
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [achievement]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!achievement) return null;

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🏆</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>🎉 {achievement.title}</Text>
        <Text style={styles.description}>{achievement.description}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: COLORS.primary,
    zIndex: 9999,
  },
  iconContainer: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.foreground,
  },
  description: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
});
