import { Image, View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { FONTS, getThemeColors } from "../lib/theme";
import { useUIStore } from "../stores/uiStore";
import { UserAvatar } from "./UserAvatar";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  userName?: string;
  userAvatarUrl?: string | null;
}

export default function ChatMessage({ role, content, createdAt, userName = "Usuario", userAvatarUrl }: ChatMessageProps) {
  const isUser = role === "user";
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}
    >
      <View style={[styles.row, isUser && styles.userRow]}>
        {!isUser ? (
          <Image source={require("../assets/beeyes-design/bee-icon.png")} style={styles.assistantAvatar} />
        ) : null}

        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
            {content}
          </Text>
        </View>

        {isUser ? (
          <UserAvatar
            name={userName}
            avatarUrl={userAvatarUrl}
            size={30}
            backgroundColor={colors.primary}
            color="#1A1A1A"
            style={styles.userAvatar}
          />
        ) : null}
      </View>

      {createdAt && (
        <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.assistantTimestamp]}>
          {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      )}
    </Animated.View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  const isDark = colors.background === "#1A1A1A";

  return StyleSheet.create({
    container: {
      marginVertical: 6,
      width: "100%",
    },
    userContainer: {
      alignItems: "flex-end",
    },
    assistantContainer: {
      alignItems: "flex-start",
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      maxWidth: "88%",
    },
    userRow: {
      justifyContent: "flex-end",
    },
    assistantAvatar: {
      width: 32,
      height: 32,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.primary + "44",
    },
    userAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      shadowColor: colors.primaryDark,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.24,
      shadowRadius: 10,
      elevation: 5,
    },
    bubble: {
      borderRadius: 16,
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderWidth: 1,
      shadowColor: "#4B3508",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.10,
      shadowRadius: 14,
      elevation: 4,
      maxWidth: "100%",
    },
    userBubble: {
      backgroundColor: "#F5A623",
      borderColor: "#D98A00",
      borderBottomRightRadius: 5,
    },
    assistantBubble: {
      backgroundColor: isDark ? "#2D2D2D" : "#FFFFFF",
      borderColor: isDark ? "#3A3A3A" : "#E8DDC8",
      borderBottomLeftRadius: 5,
    },
    text: {
      fontSize: 15,
      lineHeight: 22,
    },
    userText: {
      color: "#1A1A1A",
      fontFamily: FONTS.sans,
      fontWeight: "700",
    },
    assistantText: {
      color: isDark ? "#FFFFFF" : "#1A1A1A",
      fontFamily: FONTS.sans,
    },
    timestamp: {
      fontSize: 11,
      color: colors.muted,
      marginTop: 3,
      paddingHorizontal: 40,
    },
    userTimestamp: {
      textAlign: "right",
    },
    assistantTimestamp: {
      textAlign: "left",
    },
  });
}
