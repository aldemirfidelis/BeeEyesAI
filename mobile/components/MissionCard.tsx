import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS, FONTS } from "../lib/theme";

interface MissionCardProps {
  id: string;
  title: string;
  description?: string;
  xpReward: number;
  completed: boolean;
  onToggle: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function MissionCard({
  id,
  title,
  description,
  xpReward,
  completed,
  onToggle,
  onDelete,
}: MissionCardProps) {
  function handleToggle() {
    if (completed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle(id);
  }

  function handleDelete() {
    if (!onDelete || completed) return;
    onDelete(id);
  }

  return (
    <View style={[styles.card, completed ? styles.cardCompleted : null]}>
      {!completed && onDelete ? (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} hitSlop={8}>
          <Text style={styles.deleteText}>X</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.mainArea} onPress={handleToggle} activeOpacity={0.8}>
        <View style={[styles.checkbox, completed ? styles.checkboxDone : null]}>
          {completed ? <Text style={styles.checkmark}>OK</Text> : null}
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          </View>

          {description ? (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          ) : null}

          <View style={styles.footerRow}>
            <View style={styles.xpBadge}>
              <Text style={styles.xpText}>XP {xpReward}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    backgroundColor: COLORS.card,
    borderRadius: 20,
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
  deleteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.destructive + "18",
    borderWidth: 1,
    borderColor: COLORS.destructive + "55",
  },
  deleteText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.destructive,
  },
  mainArea: {
    padding: 16,
    paddingRight: 52,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
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
    fontSize: 10,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.foreground,
    flex: 1,
  },
  description: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: COLORS.muted,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  xpBadge: {
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  xpText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.foreground,
  },
});
