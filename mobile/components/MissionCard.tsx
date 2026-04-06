import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useMemo } from "react";
import { getThemeColors } from "../lib/theme";
import { useUIStore } from "../stores/uiStore";

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
  const themeMode = useUIStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  function handleToggle() {
    if (completed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle(id);
  }

  function handleDelete() {
    if (!onDelete || completed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDelete(id);
  }

  return (
    <View style={[styles.card, completed ? styles.cardCompleted : null]}>
      {!completed && onDelete ? (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} hitSlop={8}>
          <Feather name="x" size={13} color={colors.destructive} />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.mainArea} onPress={handleToggle} activeOpacity={0.75}>
        <View style={[styles.checkbox, completed ? styles.checkboxDone : null]}>
          {completed ? (
            <Feather name="check" size={13} color="#1A1A1A" />
          ) : null}
        </View>

        <View style={styles.content}>
          <Text
            style={[styles.title, completed ? styles.titleDone : null]}
            numberOfLines={2}
          >
            {title}
          </Text>

          {description ? (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          ) : null}

          <View style={styles.footerRow}>
            <View style={styles.xpBadge}>
              <Feather name="zap" size={11} color={colors.primaryDark} style={{ marginRight: 3 }} />
              <Text style={styles.xpText}>{xpReward} XP</Text>
            </View>
            {completed && (
              <View style={styles.doneBadge}>
                <Text style={styles.doneText}>Concluída</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    card: {
      position: "relative",
      backgroundColor: colors.card,
      borderRadius: 20,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    cardCompleted: {
      opacity: 0.55,
    },
    deleteButton: {
      position: "absolute",
      top: 14,
      right: 14,
      zIndex: 2,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.destructive + "18",
      borderWidth: 1,
      borderColor: colors.destructive + "44",
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
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
      flexShrink: 0,
    },
    checkboxDone: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    content: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
      flex: 1,
    },
    titleDone: {
      textDecorationLine: "line-through",
      color: colors.muted,
    },
    description: {
      fontSize: 13,
      color: colors.muted,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 6,
    },
    xpBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary + "22",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    xpText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primaryDark,
    },
    doneBadge: {
      backgroundColor: colors.success + "22",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    doneText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.success,
    },
  });
}
