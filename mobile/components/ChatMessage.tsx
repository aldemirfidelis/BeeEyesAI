import { Image, View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { FONTS, getThemeColors } from "../lib/theme";
import { useUIStore } from "../stores/uiStore";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

export default function ChatMessage({ role, content, createdAt }: ChatMessageProps) {
  const isUser = role === "user";
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}
    >
      {!isUser ? (
        <Image source={require("../assets/beeyes-design/bee-icon.png")} style={styles.assistantAvatar} />
      ) : null}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
          {content}
        </Text>
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
  return StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: "84%",
  },
  userContainer: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  assistantContainer: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  assistantAvatar: {
    width: 30,
    height: 30,
    borderRadius: 9,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.primary + "44",
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#4B3508",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark + "33",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
    shadowOpacity: 0.10,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: "#1A1A1A",
    fontFamily: FONTS.sans,
  },
  assistantText: {
    color: colors.foreground,
    fontFamily: FONTS.sans,
  },
  timestamp: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  userTimestamp: {
    textAlign: "right",
  },
  assistantTimestamp: {
    textAlign: "left",
  },
  });
}
