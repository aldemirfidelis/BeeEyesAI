import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeOutUp, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { COLORS, FONTS } from "../lib/theme";

interface MissionCardProps {
  id: string;
  title: string;
  description?: string;
  xpReward: number;
  completed: boolean;
  onToggle: (id: string) => void;
}

export default function MissionCard({
  id, title, description, xpReward, completed, onToggle,
}: MissionCardProps) {
  const checkScale = useSharedValue(1);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  function handleToggle() {
    if (completed) return;
    checkScale.value = withSpring(1.3, {}, () => {
      checkScale.value = withSpring(1);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle(id);
  }

  return (
    <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutUp.duration(200)}>
      <TouchableOpacity
        style={[styles.card, completed && styles.cardCompleted]}
        onPress={handleToggle}
        activeOpacity={0.8}
      >
        <Animated.View style={[styles.checkbox, completed && styles.checkboxDone, checkStyle]}>
          {completed && <Text style={styles.checkmark}>✓</Text>}
        </Animated.View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.targetIcon}>🎯</Text>
            <Text style={[styles.title, completed && styles.titleDone]} numberOfLines={2}>
              {title}
            </Text>
          </View>
          {description && (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          )}
          <View style={styles.xpBadge}>
            <Text style={styles.xpText}>⚡ {xpReward} XP</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardCompleted: {
    opacity: 0.6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: "#1A1A1A",
    fontWeight: "700",
    fontSize: 14,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  targetIcon: {
    fontSize: 14,
  },
  title: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.foreground,
    flex: 1,
  },
  titleDone: {
    textDecorationLine: "line-through",
    color: COLORS.muted,
  },
  description: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: COLORS.muted,
  },
  xpBadge: {
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  xpText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.foreground,
  },
});
