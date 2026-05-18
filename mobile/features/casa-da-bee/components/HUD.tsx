import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useEffect } from "react";
import type { BeeStats } from "../engine/types";

interface Props {
  stats: BeeStats;
  comboCount?: number;
}

export function HUD({ stats, comboCount = 0 }: Props) {
  const hearts = Math.max(0, Math.min(stats.maxHealth, stats.health));
  const emptyHearts = stats.maxHealth - hearts;
  const xpThreshold = stats.level * 100;
  const progress = Math.min(1, stats.xp / xpThreshold);

  const widthAnim = useSharedValue(0);
  useEffect(() => {
    widthAnim.value = withTiming(progress, { duration: 500 });
  }, [progress, widthAnim]);

  const xpBarStyle = useAnimatedStyle(() => ({
    width: `${widthAnim.value * 100}%`,
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.panel}>
        <View style={styles.row}>
          <Metric label="Pólen" value={String(stats.pollen)} icon="zap" color="#f5b400" />
          <Metric label="XP" value={`${stats.xp}/${xpThreshold}`} icon="star" color="#5b9bd5" />
          <Metric label="Nível" value={String(stats.level)} icon="award" color="#b94a8a" />
        </View>

        {/* XP progress bar */}
        <View style={styles.xpBarBg}>
          <Animated.View style={[styles.xpBarFill, xpBarStyle]} />
        </View>

        <View style={styles.hearts}>
          {Array.from({ length: hearts }).map((_, i) => (
            <Feather key={`f-${i}`} name="heart" size={14} color="#e65050" />
          ))}
          {Array.from({ length: emptyHearts }).map((_, i) => (
            <Feather key={`e-${i}`} name="heart" size={14} color="rgba(91, 58, 36, 0.4)" />
          ))}
          {comboCount >= 2 && (
            <View style={styles.combo}>
              <Feather name="zap" size={11} color="#fff8d6" />
              <Text style={styles.comboText}>COMBO x{comboCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.quest} numberOfLines={2}>
          {stats.quest}
        </Text>
      </View>
    </View>
  );
}

function Metric({ label, value, icon, color }: { label: string; value: string; icon: keyof typeof Feather.glyphMap; color: string }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricHeader}>
        <Feather name={icon} size={12} color={color} />
        <Text style={[styles.metricLabel, { color }]}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    width: undefined,
    maxWidth: 360,
  },
  panel: {
    backgroundColor: "rgba(255, 248, 214, 0.94)",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(87, 61, 28, 0.75)",
    padding: 10,
    gap: 6,
    shadowColor: "#231809",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metricValue: {
    color: "#2a2014",
    fontSize: 16,
    fontWeight: "900",
  },
  hearts: {
    flexDirection: "row",
    gap: 3,
    minHeight: 16,
  },
  quest: {
    color: "#4d3920",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  xpBarBg: {
    height: 6,
    borderRadius: 4,
    backgroundColor: "rgba(87, 61, 28, 0.18)",
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: "#5b9bd5",
    borderRadius: 4,
  },
  combo: {
    marginLeft: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#ec5c5c",
  },
  comboText: {
    color: "#fff8d6",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
