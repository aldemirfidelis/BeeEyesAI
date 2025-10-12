import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type EyeExpression = "neutral" | "happy" | "excited" | "curious" | "sleepy" | "celebrating";

interface BeeEyesProps {
  expression?: EyeExpression;
  className?: string;
}

export default function BeeEyes({ expression = "neutral", className = "" }: BeeEyesProps) {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 150);
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  const getEyeStyle = () => {
    switch (expression) {
      case "happy":
        return { scaleY: 0.7, y: 2 };
      case "excited":
        return { scale: 1.2, rotate: 0 };
      case "curious":
        return { x: 8, y: -3 };
      case "sleepy":
        return { scaleY: 0.3, y: 6 };
      case "celebrating":
        return { scale: 1.3, rotate: [0, -5, 5, -5, 0] };
      default:
        return {};
    }
  };

  const getPupilStyle = () => {
    switch (expression) {
      case "happy":
      case "celebrating":
        return "bg-primary";
      case "excited":
        return "bg-chart-1";
      case "curious":
        return "bg-chart-2";
      case "sleepy":
        return "bg-muted-foreground";
      default:
        return "bg-foreground";
    }
  };

  return (
    <div className={`relative flex items-center justify-center gap-4 ${className}`}>
      <motion.div
        className="relative"
        animate={expression === "celebrating" ? { rotate: [0, -10, 10, -10, 0] } : {}}
        transition={{ duration: 0.5, repeat: expression === "celebrating" ? Infinity : 0 }}
      >
        <motion.div
          className="relative w-12 h-16 bg-primary/20 rounded-full border-2 border-primary/40"
          animate={blinking ? { scaleY: 0.1 } : getEyeStyle()}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full ${getPupilStyle()}`}
            animate={blinking ? { scaleY: 0 } : {}}
          />
          {expression === "celebrating" && (
            <motion.div
              className="absolute -top-2 -right-2 w-3 h-3 bg-primary rounded-full"
              animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </motion.div>
      </motion.div>

      <motion.div
        className="relative"
        animate={expression === "celebrating" ? { rotate: [0, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.5, repeat: expression === "celebrating" ? Infinity : 0 }}
      >
        <motion.div
          className="relative w-12 h-16 bg-primary/20 rounded-full border-2 border-primary/40"
          animate={blinking ? { scaleY: 0.1 } : getEyeStyle()}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full ${getPupilStyle()}`}
            animate={blinking ? { scaleY: 0 } : {}}
          />
          {expression === "celebrating" && (
            <motion.div
              className="absolute -top-2 -left-2 w-3 h-3 bg-primary rounded-full"
              animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
