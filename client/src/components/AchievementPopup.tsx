import { motion, AnimatePresence } from "framer-motion";
import { Award, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AchievementPopupProps {
  title: string;
  description: string;
  isVisible: boolean;
  onClose: () => void;
}

export default function AchievementPopup({
  title,
  description,
  isVisible,
  onClose,
}: AchievementPopupProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: 100 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: "spring", damping: 15 }}
          className="fixed top-4 right-4 z-50 bg-card border-2 border-primary rounded-2xl shadow-2xl p-4 max-w-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-base mb-1">🎉 {title}</h3>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="flex-shrink-0 -mt-1 -mr-1"
              data-testid="button-close-achievement"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
