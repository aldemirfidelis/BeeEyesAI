import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { COLORS, FONTS } from "../lib/theme";

const MOODS = [
  { value: 1, emoji: "😢", label: "Muito mal", color: "#E53E3E" },
  { value: 2, emoji: "😕", label: "Mal", color: "#FF8C42" },
  { value: 3, emoji: "😐", label: "Normal", color: "#888888" },
  { value: 4, emoji: "🥰", label: "Bem", color: "#4CAF50" },
  { value: 5, emoji: "🤩", label: "Ótimo!", color: COLORS.primary },
];

interface MoodSelectorProps {
  selectedMood: number | null;
  onSelectMood: (mood: number) => void;
}

function MoodButton({
  mood,
  selected,
  onPress,
}: {
  mood: typeof MOODS[0];
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress() {
    scale.value = withSpring(1.2, {}, () => { scale.value = withSpring(1); });
    onPress();
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View style={[styles.button, selected && { backgroundColor: mood.color + "22" }, animStyle]}>
        <Text style={styles.emoji}>{mood.emoji}</Text>
        <Text style={[styles.label, selected && { color: mood.color, fontWeight: "600" }]}>
          {mood.label}
        </Text>
        {selected && <View style={[styles.dot, { backgroundColor: mood.color }]} />}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function MoodSelector({ selectedMood, onSelectMood }: MoodSelectorProps) {
  return (
    <View style={styles.container}>
      {MOODS.map((mood) => (
        <MoodButton
          key={mood.value}
          mood={mood}
          selected={selectedMood === mood.value}
          onPress={() => onSelectMood(mood.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.secondary,
    borderRadius: 16,
    padding: 12,
    gap: 4,
    minWidth: 60,
  },
  emoji: {
    fontSize: 28,
  },
  label: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: COLORS.muted,
    textAlign: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
});
