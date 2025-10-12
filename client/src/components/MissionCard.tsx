import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Target, Zap } from "lucide-react";
import { motion } from "framer-motion";

interface MissionCardProps {
  id: string;
  title: string;
  description?: string;
  xpReward: number;
  completed: boolean;
  onToggle: (id: string) => void;
}

export default function MissionCard({
  id,
  title,
  description,
  xpReward,
  completed,
  onToggle,
}: MissionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className={`p-4 hover-elevate transition-all ${completed ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-3">
          <Checkbox
            checked={completed}
            onCheckedChange={() => onToggle(id)}
            className="mt-1"
            data-testid={`checkbox-mission-${id}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-primary flex-shrink-0" />
              <h3 className={`font-semibold text-sm ${completed ? "line-through" : ""}`}>
                {title}
              </h3>
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mb-2">{description}</p>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                <span className="font-mono">{xpReward} XP</span>
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
