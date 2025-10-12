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

  const getEyeShape = () => {
    if (blinking) return "h-1";
    
    switch (expression) {
      case "happy":
        return "h-8";
      case "excited":
        return "h-14";
      case "sleepy":
        return "h-6";
      default:
        return "h-12";
    }
  };

  const getPupilPosition = () => {
    switch (expression) {
      case "curious":
        return "translate-x-2 -translate-y-1";
      case "happy":
        return "translate-y-1";
      case "excited":
        return "translate-y-0";
      default:
        return "";
    }
  };

  const getShinePosition = () => {
    switch (expression) {
      case "celebrating":
      case "excited":
        return "top-2 left-2";
      default:
        return "top-3 left-3";
    }
  };

  return (
    <div className={`relative flex items-center justify-center gap-6 ${className}`}>
      <motion.div
        className="relative"
        animate={expression === "celebrating" ? { rotate: [0, -8, 8, -8, 0], y: [0, -4, 0] } : {}}
        transition={{ duration: 0.6, repeat: expression === "celebrating" ? Infinity : 0 }}
      >
        <div className="relative w-16 h-16 flex items-center justify-center">
          <motion.div
            className={`relative w-14 bg-foreground transition-all ${getEyeShape()}`}
            style={{
              clipPath: blinking 
                ? "polygon(0 50%, 100% 50%, 100% 50%, 0 50%)"
                : "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
              imageRendering: "pixelated",
            }}
          >
            {!blinking && (
              <>
                <motion.div
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-primary transition-transform ${getPupilPosition()}`}
                  style={{
                    clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
                    imageRendering: "pixelated",
                  }}
                />
                <div
                  className={`absolute ${getShinePosition()} w-3 h-3 bg-background`}
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
                    imageRendering: "pixelated",
                  }}
                />
              </>
            )}
          </motion.div>
          
          {expression === "celebrating" && (
            <>
              <motion.div
                className="absolute -top-1 -right-1 w-2 h-2 bg-primary"
                style={{ imageRendering: "pixelated" }}
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <motion.div
                className="absolute -top-2 right-2 w-1.5 h-1.5 bg-chart-1"
                style={{ imageRendering: "pixelated" }}
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
              />
            </>
          )}
        </div>
      </motion.div>

      <motion.div
        className="relative"
        animate={expression === "celebrating" ? { rotate: [0, 8, -8, 8, 0], y: [0, -4, 0] } : {}}
        transition={{ duration: 0.6, repeat: expression === "celebrating" ? Infinity : 0, delay: 0.1 }}
      >
        <div className="relative w-16 h-16 flex items-center justify-center">
          <motion.div
            className={`relative w-14 bg-foreground transition-all ${getEyeShape()}`}
            style={{
              clipPath: blinking 
                ? "polygon(0 50%, 100% 50%, 100% 50%, 0 50%)"
                : "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
              imageRendering: "pixelated",
            }}
          >
            {!blinking && (
              <>
                <motion.div
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-primary transition-transform ${getPupilPosition()}`}
                  style={{
                    clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
                    imageRendering: "pixelated",
                  }}
                />
                <div
                  className={`absolute ${getShinePosition()} w-3 h-3 bg-background`}
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
                    imageRendering: "pixelated",
                  }}
                />
              </>
            )}
          </motion.div>
          
          {expression === "celebrating" && (
            <>
              <motion.div
                className="absolute -top-1 -left-1 w-2 h-2 bg-primary"
                style={{ imageRendering: "pixelated" }}
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.3 }}
              />
              <motion.div
                className="absolute -top-2 left-2 w-1.5 h-1.5 bg-chart-1"
                style={{ imageRendering: "pixelated" }}
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.5 }}
              />
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
