import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { Achievement } from "../engine/achievements";

interface Props {
  achievement: Achievement | null;
  onDismiss: () => void;
}

const VISIBLE_MS = 3500;

export function AchievementToast({ achievement, onDismiss }: Props) {
  const t = useSharedValue(0);
  const id = achievement?.id;

  useEffect(() => {
    if (!achievement) return;
    t.value = 0;
    t.value = withSequence(
      withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.4)) }),
      withDelay(VISIBLE_MS - 320 - 280, withTiming(0, { duration: 280 }, (finished) => {
        if (finished) runOnJS(onDismiss)();
      })),
    );
  }, [id, achievement, onDismiss, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * -30 }, { scale: 0.94 + t.value * 0.06 }],
  }));

  if (!achievement) return null;

  return (
    <Animated.View style={[styles.container, style]} pointerEvents="none">
      <View style={styles.iconWrap}>
        <Feather name={achievement.icon as keyof typeof Feather.glyphMap} size={22} color="#2a2014" />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>Conquista desbloqueada</Text>
        <Text style={styles.title}>{achievement.title}</Text>
        <Text style={styles.desc} numberOfLines={2}>
          {achievement.description}
        </Text>
      </View>
      <View style={styles.reward}>
        <Feather name="zap" size={13} color="#f5b400" />
        <Text style={styles.rewardText}>+{achievement.rewardPollen}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 80,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255, 248, 214, 0.96)",
    borderWidth: 2,
    borderColor: "rgba(87, 61, 28, 0.75)",
    shadowColor: "#231809",
    shadowOpacity: 0.32,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffd95b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(78, 52, 24, 0.72)",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: "#7a4f18",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    color: "#2c2114",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  desc: {
    color: "#5e4520",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  reward: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(245, 180, 0, 0.15)",
  },
  rewardText: {
    color: "#7a4f18",
    fontSize: 13,
    fontWeight: "900",
  },
});
