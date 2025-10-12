import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

interface XPProgressProps {
  currentXP: number;
  level: number;
  xpToNextLevel: number;
}

export default function XPProgress({ currentXP, level, xpToNextLevel }: XPProgressProps) {
  const progress = (currentXP / xpToNextLevel) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {level}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">Nível {level}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {currentXP}/{xpToNextLevel} XP
            </p>
          </div>
        </div>
      </div>

      <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-chart-1 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
