import { View, Text, StyleSheet } from "react-native";
import { useEffect, useMemo } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { getThemeColors, FONTS } from "../lib/theme";
import { useUIStore } from "../stores/uiStore";

interface XPProgressProps {
  currentXP: number;
  level: number;
  xpToNextLevel: number;
}

export default function XPProgress({ currentXP, level, xpToNextLevel }: XPProgressProps) {
  const themeMode = useUIStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const progress = Math.min(currentXP / xpToNextLevel, 1);
  const widthAnim = useSharedValue(0);

  useEffect(() => {
    widthAnim.value = withTiming(progress, { duration: 700 });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${widthAnim.value * 100}%`,
  }));

  const pct = Math.round(progress * 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Level badge */}
        <View style={styles.levelBadge}>
          <Text style={styles.levelEmoji}>🏆</Text>
          <View style={styles.levelNumberBubble}>
            <Text style={styles.levelNumber}>{level}</Text>
          </View>
        </View>

        <View style={styles.labelGroup}>
          <Text style={styles.levelLabel}>Nível {level}</Text>
          <Text style={styles.xpLabel}>
            {currentXP.toLocaleString("pt-BR")}{" "}
            <Text style={styles.xpSeparator}>/</Text>{" "}
            {xpToNextLevel.toLocaleString("pt-BR")} XP
          </Text>
        </View>

        <View style={styles.pctBubble}>
          <Text style={styles.pctText}>{pct}%</Text>
        </View>
      </View>

      {/* Track */}
      <View style={styles.track}>
        <Animated.View style={[styles.barContainer, barStyle]}>
          <LinearGradient
            colors={[colors.primary, colors.chart2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {/* Shimmer notch */}
        <View style={styles.trackShine} />
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: {
      gap: 10,
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
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    levelEmoji: {
      fontSize: 22,
    },
    levelNumberBubble: {
      position: "absolute",
      bottom: -4,
      right: -4,
      backgroundColor: colors.primary,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.card,
    },
    levelNumber: {
      fontSize: 10,
      fontFamily: FONTS.mono,
      fontWeight: "800",
      color: "#1A1A1A",
    },
    labelGroup: {
      flex: 1,
    },
    levelLabel: {
      fontFamily: FONTS.display,
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    xpLabel: {
      fontFamily: FONTS.mono,
      fontSize: 11,
      color: colors.muted,
      marginTop: 1,
    },
    xpSeparator: {
      color: colors.border,
    },
    pctBubble: {
      backgroundColor: colors.primary + "22",
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    pctText: {
      fontFamily: FONTS.mono,
      fontSize: 12,
      fontWeight: "700",
      color: colors.primaryDark,
    },
    track: {
      height: 10,
      backgroundColor: colors.secondary,
      borderRadius: 5,
      overflow: "hidden",
      position: "relative",
    },
    barContainer: {
      height: "100%",
      borderRadius: 5,
      overflow: "hidden",
    },
    trackShine: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: 5,
    },
  });
}
