import { Flame } from "lucide-react";
import { motion } from "framer-motion";

interface StreakDisplayProps {
  streak: number;
}

export default function StreakDisplay({ streak }: StreakDisplayProps) {
  return (
    <motion.div
      className="flex items-center gap-2 bg-gradient-to-r from-chart-2 to-chart-1 text-white px-4 py-2 rounded-full"
      animate={streak > 0 ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        animate={streak > 0 ? { rotate: [0, -10, 10, -10, 0] } : {}}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
      >
        <Flame className="w-5 h-5" />
      </motion.div>
      <span className="font-mono font-bold text-lg">{streak}</span>
      <span className="text-sm font-medium">dias</span>
    </motion.div>
  );
}
