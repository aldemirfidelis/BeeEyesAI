import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, runOnJS } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import type { BeeState } from "../engine/types";

const EMOTIONS_BY_STATE: Record<BeeState, string[]> = {
  idle: ["♡", "♬", "✨", "💭"],
  walking: [],
  working: ["💡", "📝", "⚙"],
  talking: ["💬"],
  sleeping: ["💤"],
  happy: ["✨", "♡", "🌟", "🎉"],
  tired: ["💨", "😮‍💨"],
  confused: ["?", "❓"],
  celebrating: ["🎉", "✨", "🎊"],
};

const SHOW_DURATION_MS = 2200;

interface Props {
  beePixelX: SharedValue<number>;
  beePixelY: SharedValue<number>;
  state: BeeState;
  tileSize: number;
}

export function EmotionBubble({ beePixelX, beePixelY, state, tileSize }: Props) {
  const [emoji, setEmoji] = useState<string | null>(null);
  const t = useSharedValue(0);

  // dispara emocao aleatoria de tempos em tempos
  useEffect(() => {
    const options = EMOTIONS_BY_STATE[state] ?? [];
    if (options.length === 0) {
      setEmoji(null);
      return;
    }

    function spawn() {
      const pick = options[Math.floor(Math.random() * options.length)];
      setEmoji(pick);
      t.value = 0;
      t.value = withSequence(
        withTiming(1, { duration: 280, easing: Easing.out(Easing.back(1.6)) }),
        withTiming(1, { duration: SHOW_DURATION_MS - 280 - 240 }),
        withTiming(0, { duration: 240 }, (finished) => {
          if (finished) runOnJS(setEmoji)(null);
        }),
      );
    }

    // primeiro emoji em 3-8s, depois a cada 6-14s
    const initialDelay = setTimeout(spawn, 3000 + Math.random() * 5000);
    const interval = setInterval(spawn, 6000 + Math.random() * 8000);
    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [state, t]);

  const left = useDerivedValue(() => beePixelX.value + tileSize * 0.35);
  const top = useDerivedValue(() => beePixelY.value - tileSize * 1.0);

  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [
      { translateX: left.value - 14 },
      { translateY: top.value - 14 - t.value * 12 },
      { scale: 0.6 + t.value * 0.4 },
    ],
  }));

  if (!emoji) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.bubble, style]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 22,
  },
});
