import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

interface Props {
  speaker?: string;
  message: string;
  onDismiss?: () => void;
  visible: boolean;
}

export function DialogBox({ speaker = "Bee", message, onDismiss, visible }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.speaker}>{speaker}</Text>
        <Text style={styles.message}>{message}</Text>
        {onDismiss && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.button} onPress={onDismiss} activeOpacity={0.8}>
              <Feather name="x" size={16} color="#2a2014" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
  },
  panel: {
    minHeight: 90,
    backgroundColor: "rgba(255, 248, 214, 0.95)",
    borderWidth: 2,
    borderColor: "rgba(87, 61, 28, 0.75)",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#231809",
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  speaker: {
    color: "#7a4f18",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  message: {
    color: "#2c2114",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  button: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(78, 52, 24, 0.72)",
    backgroundColor: "#ffd95b",
    alignItems: "center",
    justifyContent: "center",
  },
});
