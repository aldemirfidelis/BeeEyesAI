import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { COLORS, FONTS } from "../lib/theme";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

export default function ChatMessage({ role, content, createdAt }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}
    >
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

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: "80%",
  },
  userContainer: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  assistantContainer: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: COLORS.secondary,
    borderBottomLeftRadius: 4,
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
    color: COLORS.foreground,
    fontFamily: FONTS.sans,
  },
  timestamp: {
    fontSize: 11,
    color: COLORS.muted,
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
