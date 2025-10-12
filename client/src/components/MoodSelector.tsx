import { motion } from "framer-motion";
import { Smile, Meh, Frown, Heart, Zap } from "lucide-react";

interface MoodSelectorProps {
  selectedMood: number | null;
  onSelectMood: (mood: number) => void;
}

const moods = [
  { value: 1, icon: Frown, color: "text-destructive", label: "Muito mal" },
  { value: 2, icon: Meh, color: "text-chart-2", label: "Mal" },
  { value: 3, icon: Smile, color: "text-muted-foreground", label: "Normal" },
  { value: 4, icon: Heart, color: "text-chart-3", label: "Bem" },
  { value: 5, icon: Zap, color: "text-primary", label: "Muito bem" },
];

export default function MoodSelector({ selectedMood, onSelectMood }: MoodSelectorProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {moods.map(({ value, icon: Icon, color, label }) => (
        <motion.button
          key={value}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelectMood(value)}
          className={`relative p-3 rounded-2xl transition-all hover-elevate ${
            selectedMood === value
              ? "bg-primary text-primary-foreground"
              : "bg-secondary"
          }`}
          data-testid={`button-mood-${value}`}
          aria-label={label}
        >
          <Icon className={`w-6 h-6 ${selectedMood === value ? "" : color}`} />
          {selectedMood === value && (
            <motion.div
              layoutId="mood-indicator"
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary-foreground rounded-full"
            />
          )}
        </motion.button>
      ))}
    </div>
  );
}
