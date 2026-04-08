import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type BeeEyesEmotion =
  | "neutral"
  | "happy"
  | "curious"
  | "attentive"
  | "excited"
  | "thinking"
  | "tired";

export type BeeEyesLegacyExpression =
  | "neutral"
  | "happy"
  | "excited"
  | "curious"
  | "sleepy"
  | "celebrating";

export type BeeEyesExpression = BeeEyesEmotion | BeeEyesLegacyExpression;

export type BeeEyesEvent =
  | "message-received"
  | "user-typing"
  | "mission-complete"
  | "thinking"
  | "idle"
  | "input-focus";

interface BeeEyesProps {
  expression?: BeeEyesExpression;
  emotion?: BeeEyesEmotion;
  event?: BeeEyesEvent | null;
  className?: string;
  inputFocused?: boolean;
  isTyping?: boolean;
  scrollProgress?: number;
  engagementLevel?: number;
  interactive?: boolean;
}

interface EmotionPreset {
  openness: number;
  browLift: number;
  browArch: number;
  browPinch: number;
  movement: number;
  pupilScale: number;
  blink: [number, number];
  tremor: number;
  glow: number;
}

interface MotionPoint {
  x: number;
  y: number;
}

const EYE_SHAPE = "polygon(16% 0%, 84% 0%, 100% 44%, 86% 100%, 14% 100%, 0% 44%)";

const EMOTION_PRESETS: Record<BeeEyesEmotion, EmotionPreset> = {
  neutral: { openness: 0.92, browLift: -2, browArch: 10, browPinch: 1, movement: 0.42, pupilScale: 1, blink: [2800, 5200], tremor: 0.02, glow: 0.02 },
  happy: { openness: 0.88, browLift: -7, browArch: 15, browPinch: -2, movement: 0.34, pupilScale: 1.05, blink: [2600, 4700], tremor: 0.015, glow: 0.06 },
  curious: { openness: 1.02, browLift: -11, browArch: 18, browPinch: -1, movement: 0.54, pupilScale: 1.12, blink: [2600, 4600], tremor: 0.03, glow: 0.08 },
  attentive: { openness: 1.06, browLift: -9, browArch: 14, browPinch: 3, movement: 0.48, pupilScale: 1.08, blink: [3000, 5200], tremor: 0.04, glow: 0.07 },
  excited: { openness: 1.12, browLift: -14, browArch: 20, browPinch: -4, movement: 0.58, pupilScale: 1.2, blink: [2200, 3600], tremor: 0.05, glow: 0.15 },
  thinking: { openness: 0.82, browLift: -3, browArch: 8, browPinch: 8, movement: 0.68, pupilScale: 0.96, blink: [4200, 6800], tremor: 0.03, glow: 0.03 },
  tired: { openness: 0.58, browLift: 2, browArch: 5, browPinch: -2, movement: 0.18, pupilScale: 0.9, blink: [2400, 4200], tremor: 0.008, glow: 0.01 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mapExpressionToEmotion(expression: BeeEyesExpression): BeeEyesEmotion {
  switch (expression) {
    case "sleepy":
      return "tired";
    case "celebrating":
      return "excited";
    default:
      return expression;
  }
}

function getEventAdjustments(event: BeeEyesEvent | null) {
  switch (event) {
    case "message-received":
      return { openness: 0.12, pupilScale: 0.14, browLift: -4, browPinch: -1, tremor: 0.025, glow: 0.08 };
    case "user-typing":
      return { openness: 0.06, pupilScale: 0.06, browLift: -1, browPinch: 1, tremor: 0.02, glow: 0.03 };
    case "mission-complete":
      return { openness: 0.15, pupilScale: 0.18, browLift: -6, browPinch: -3, tremor: 0.03, glow: 0.24 };
    case "thinking":
      return { openness: -0.08, pupilScale: -0.02, browLift: 1, browPinch: 4, tremor: 0.015, glow: 0 };
    case "idle":
      return { openness: -0.22, pupilScale: -0.1, browLift: 3, browPinch: -2, tremor: 0, glow: -0.02 };
    case "input-focus":
      return { openness: 0.05, pupilScale: 0.03, browLift: -2, browPinch: 0, tremor: 0.015, glow: 0.02 };
    default:
      return { openness: 0, pupilScale: 0, browLift: 0, browPinch: 0, tremor: 0, glow: 0 };
  }
}

export default function BeeEyes({
  expression = "neutral",
  emotion,
  event = null,
  className = "",
  inputFocused = false,
  isTyping = false,
  scrollProgress = 0.5,
  engagementLevel = 0,
  interactive = true,
}: BeeEyesProps) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [pointer, setPointer] = useState<MotionPoint>({ x: 0, y: 0 });
  const [glance, setGlance] = useState<MotionPoint>({ x: 0.12, y: -0.04 });
  const [tremor, setTremor] = useState<MotionPoint>({ x: 0, y: 0 });
  const [clickNudge, setClickNudge] = useState<MotionPoint>({ x: 0, y: 0 });
  const [isIdle, setIsIdle] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const clickResetRef = useRef<number | null>(null);
  const pointerRef = useRef<MotionPoint>({ x: 0, y: 0 });

  const normalizedEngagement = clamp(engagementLevel, 0, 1);
  const baseEmotion = emotion ?? mapExpressionToEmotion(expression);
  const shouldIdle = isIdle && !inputFocused && !isTyping && event !== "mission-complete";
  const activeEvent = shouldIdle ? "idle" : event;
  const effectiveEmotion: BeeEyesEmotion =
    shouldIdle ? "tired" : activeEvent === "thinking" ? "thinking" : baseEmotion;

  const preset = EMOTION_PRESETS[effectiveEmotion];
  const eventAdjustments = getEventAdjustments(activeEvent);

  useEffect(() => {
    if (!interactive) return;

    const markActivity = () => {
      lastActivityRef.current = Date.now();
      setIsIdle(false);
    };

    const updatePointer = (clientX: number, clientY: number) => {
      const x = ((clientX / window.innerWidth) * 2 - 1) * 0.95;
      const y = ((clientY / window.innerHeight) * 2 - 1) * 0.95;
      const nextPointer = { x, y };
      pointerRef.current = nextPointer;
      setPointer(nextPointer);
    };

    const handlePointerMove = (event: MouseEvent) => {
      markActivity();
      updatePointer(event.clientX, event.clientY);
    };

    const handleTouchStart = (event: TouchEvent) => {
      markActivity();
      const touch = event.touches[0];
      if (touch) updatePointer(touch.clientX, touch.clientY);
    };

    const handleClick = () => {
      markActivity();
      setClickNudge({ x: pointerRef.current.x * 1.8, y: pointerRef.current.y * 1.1 });
      if (clickResetRef.current) window.clearTimeout(clickResetRef.current);
      clickResetRef.current = window.setTimeout(() => setClickNudge({ x: 0, y: 0 }), 150);
    };

    const handleActivity = () => {
      markActivity();
    };

    const idleInterval = window.setInterval(() => {
      setIsIdle(Date.now() - lastActivityRef.current > 18000);
    }, 500);

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("wheel", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });

    return () => {
      window.clearInterval(idleInterval);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("wheel", handleActivity);
      window.removeEventListener("touchstart", handleTouchStart);
      if (clickResetRef.current) window.clearTimeout(clickResetRef.current);
    };
  }, [interactive]);

  useEffect(() => {
    let cancelled = false;
    let waitTimer: number | null = null;
    let blinkTimer: number | null = null;

    const scheduleBlink = (delay?: number) => {
      const [min, max] = preset.blink;
      waitTimer = window.setTimeout(() => {
        if (cancelled) return;
        setIsBlinking(true);
        blinkTimer = window.setTimeout(() => {
          if (cancelled) return;
          setIsBlinking(false);
          const clusterChance = effectiveEmotion === "excited" ? 0.22 : effectiveEmotion === "tired" ? 0.08 : 0.14;
          scheduleBlink(Math.random() < clusterChance ? 160 + Math.random() * 140 : undefined);
        }, 110 + Math.random() * 80);
      }, delay ?? min + Math.random() * (max - min));
    };

    scheduleBlink();

    return () => {
      cancelled = true;
      if (waitTimer) window.clearTimeout(waitTimer);
      if (blinkTimer) window.clearTimeout(blinkTimer);
    };
  }, [effectiveEmotion, preset.blink]);

  useEffect(() => {
    let timer: number | null = null;

    const thinkingMode = effectiveEmotion === "thinking" || activeEvent === "thinking";

    const scheduleGlance = () => {
      const amplitudeX = thinkingMode ? 1 : 0.55;
      const amplitudeY = thinkingMode ? 0.3 : 0.14;
      setGlance({
        x: (Math.random() * 2 - 1) * amplitudeX,
        y: (Math.random() * 2 - 1) * amplitudeY,
      });

      timer = window.setTimeout(
        scheduleGlance,
        thinkingMode ? 900 + Math.random() * 1400 : 2200 + Math.random() * 2600,
      );
    };

    scheduleGlance();

    return () => {
      if (timer) window.clearTimeout(timer);
      setGlance({ x: 0, y: 0 });
    };
  }, [activeEvent, effectiveEmotion]);

  const tremorIntensity = Math.max(
    preset.tremor + eventAdjustments.tremor,
    inputFocused ? 0.018 : 0,
    isTyping ? 0.024 : 0,
  );

  useEffect(() => {
    if (tremorIntensity <= 0.002) {
      setTremor({ x: 0, y: 0 });
      return;
    }

    const interval = window.setInterval(() => {
      setTremor({
        x: (Math.random() * 2 - 1) * tremorIntensity * 9,
        y: (Math.random() * 2 - 1) * tremorIntensity * 5,
      });
    }, 90);

    return () => window.clearInterval(interval);
  }, [tremorIntensity]);

  const openness = clamp(
    (preset.openness + eventAdjustments.openness + normalizedEngagement * 0.04 + (inputFocused ? 0.02 : 0) + (isTyping ? 0.03 : 0)) *
      (isBlinking ? 0.08 : 1),
    0.07,
    1.24,
  );

  const pupilScale = clamp(
    preset.pupilScale + eventAdjustments.pupilScale + normalizedEngagement * 0.08 + (inputFocused ? 0.03 : 0) + (isTyping ? 0.04 : 0),
    0.78,
    1.42,
  );

  const glowStrength = clamp(
    preset.glow + eventAdjustments.glow + normalizedEngagement * 0.05 + (isTyping ? 0.02 : 0),
    0,
    0.38,
  );

  const browLift = preset.browLift + eventAdjustments.browLift + (inputFocused ? -1 : 0);
  const browPinch = preset.browPinch + eventAdjustments.browPinch + (inputFocused ? 1 : 0);
  const browArch = preset.browArch + (activeEvent === "mission-complete" ? 4 : 0);

  const pointerX = interactive ? pointer.x * (5 + normalizedEngagement * 3.5) * preset.movement : 0;
  const pointerY = interactive ? pointer.y * (3.8 + normalizedEngagement * 2) * preset.movement : 0;
  const glanceX = glance.x * (effectiveEmotion === "thinking" ? 7.5 : 3.4);
  const glanceY = glance.y * (effectiveEmotion === "thinking" ? 3.2 : 1.7);
  const scrollY = (scrollProgress - 0.5) * 5.5;
  const focusY = inputFocused ? 6.5 : 0;
  const typingBiasX = isTyping ? 1.5 : 0;

  const basePupilX = clamp(pointerX + glanceX + tremor.x + clickNudge.x + typingBiasX, -12, 12);
  const basePupilY = clamp(pointerY + glanceY + tremor.y + clickNudge.y + scrollY + focusY, -9, 11);

  const auraAnimate =
    activeEvent === "mission-complete"
      ? { opacity: [0.35, 0.8, 0.35], scale: [1, 1.12, 1] }
      : activeEvent === "message-received"
        ? { opacity: [0.2, 0.45, 0.2], scale: [1, 1.04, 1] }
        : { opacity: [0.14 + glowStrength * 0.5, 0.22 + glowStrength, 0.14 + glowStrength * 0.5], scale: [1, 1.03, 1] };

  const auraTransition =
    activeEvent === "mission-complete"
      ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
      : { duration: 2.8, repeat: Infinity, ease: "easeInOut" };

  const shellAnimate =
    activeEvent === "mission-complete"
      ? { y: [0, -5, 0], scale: [1, 1.04, 1], rotate: [0, -1.2, 1.2, 0] }
      : activeEvent === "message-received"
        ? { y: [0, -2, 0], scale: [1, 1.02, 1] }
        : activeEvent === "user-typing"
          ? { x: [0, 2, -1.5, 0] }
          : {};

  const shellTransition =
    activeEvent === "mission-complete"
      ? { duration: 0.8, ease: "easeInOut" }
      : activeEvent === "message-received"
        ? { duration: 0.55, ease: "easeInOut" }
        : activeEvent === "user-typing"
          ? { duration: 0.45, ease: "easeInOut" }
          : { duration: 0.3 };

  const floatAmplitude = shouldIdle ? 1.4 : 2.6 + normalizedEngagement * 1.5;
  const floatDuration = shouldIdle ? 5.8 : effectiveEmotion === "thinking" ? 4.8 : 3.8;

  return (
    <div className={cn("relative flex items-center justify-center", className)} aria-hidden="true">
      <motion.div
        className="relative flex items-end gap-6 px-4 py-6"
        animate={{ y: [0, -floatAmplitude, 0] }}
        transition={{ duration: floatDuration, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className="absolute inset-x-6 top-1/2 h-16 -translate-y-1/2 rounded-full bg-primary/20 blur-2xl"
          animate={auraAnimate}
          transition={auraTransition}
          style={{ opacity: 0.14 + glowStrength }}
        />

        {(["left", "right"] as const).map((side) => {
          const personalityLift = side === "left" ? -2.2 : 0.8;
          const browY = browLift + personalityLift;
          const browRotate =
            side === "left"
              ? -(browArch + 4) - browPinch * 0.7
              : browArch + 4 + browPinch * 0.7;
          const browX = side === "left" ? 7 + browPinch * 0.45 : -7 - browPinch * 0.45;
          const pupilX = clamp(basePupilX + (side === "left" ? -0.8 : 0.8), -12, 12);
          const pupilY = clamp(basePupilY + (side === "left" ? -0.3 : 0.3), -9, 11);

          return (
            <motion.div
              key={side}
              className="relative h-[96px] w-[96px]"
              animate={shellAnimate}
              transition={shellTransition}
            >
              <motion.div
                className="absolute left-1/2 top-0 h-[7px] w-[58px] -translate-x-1/2 rounded-full bg-foreground/90"
                animate={{ x: browX, y: browY, rotate: browRotate, width: 54 + normalizedEngagement * 6 + (side === "left" ? 2 : 0) }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                style={{
                  boxShadow: activeEvent === "mission-complete" ? "0 0 12px rgba(255, 199, 58, 0.18)" : "none",
                }}
              />

              <motion.div
                className="absolute bottom-0 left-1/2 h-[66px] w-[88px] -translate-x-1/2 overflow-hidden"
                style={{
                  clipPath: EYE_SHAPE,
                  background:
                    "radial-gradient(circle at 50% 45%, rgba(255, 200, 45, 0.14), rgba(17, 18, 24, 0.04) 42%, rgba(17, 18, 24, 0.98) 92%)",
                  boxShadow: `0 16px 32px rgba(15, 15, 20, 0.14), 0 0 ${12 + glowStrength * 40}px rgba(255, 196, 40, ${0.1 + glowStrength * 0.35})`,
                }}
                animate={{ scaleY: openness, scaleX: 0.98 + normalizedEngagement * 0.02 }}
                transition={{ duration: isBlinking ? 0.11 : 0.38, ease: "easeInOut" }}
              >
                <div
                  className="absolute inset-[5px] opacity-95"
                  style={{
                    clipPath: EYE_SHAPE,
                    background:
                      "linear-gradient(180deg, rgba(24, 25, 33, 0.98) 0%, rgba(13, 14, 19, 0.96) 70%, rgba(9, 10, 14, 1) 100%)",
                  }}
                />

                <motion.div
                  className="absolute left-1/2 top-1/2 h-[36px] w-[36px] -translate-x-1/2 -translate-y-1/2"
                  animate={{ x: pupilX, y: pupilY, scale: pupilScale }}
                  transition={{ duration: effectiveEmotion === "thinking" ? 0.9 : 0.36, ease: "easeOut" }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
                      background:
                        "radial-gradient(circle at 38% 35%, #fff3a1 0%, #ffd451 24%, #ffc124 60%, #ffad10 100%)",
                      boxShadow: `0 0 ${18 + glowStrength * 26}px rgba(255, 196, 40, ${0.18 + glowStrength * 0.42})`,
                    }}
                  />
                  <div
                    className="absolute inset-[7px] opacity-65"
                    style={{
                      clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
                      background: "radial-gradient(circle at 50% 50%, rgba(255, 245, 210, 0.76), rgba(255, 197, 40, 0.18) 70%, transparent 100%)",
                    }}
                  />
                  <div className="absolute left-[7px] top-[6px] h-[8px] w-[8px] rounded-full bg-white/95 shadow-[0_0_10px_rgba(255,255,255,0.35)]" />
                  <div className="absolute left-[15px] top-[12px] h-[4px] w-[4px] rounded-full bg-white/65" />
                </motion.div>

                <div className="absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-white/8 to-transparent opacity-70" />
                <div className="absolute inset-x-4 bottom-[5px] h-[5px] rounded-full bg-primary/8 blur-sm" />
              </motion.div>

              {activeEvent === "mission-complete" && (
                <>
                  <motion.div
                    className="absolute right-1 top-4 h-2.5 w-2.5 rounded-full bg-primary/80 blur-[1px]"
                    animate={{ opacity: [0, 1, 0], y: [0, -10, -16], scale: [0.8, 1.15, 0.4] }}
                    transition={{ duration: 1, repeat: Infinity, ease: "easeOut", delay: side === "left" ? 0 : 0.18 }}
                  />
                  <motion.div
                    className="absolute left-3 top-7 h-1.5 w-1.5 rounded-full bg-white/90"
                    animate={{ opacity: [0, 1, 0], y: [0, -8, -12], x: [0, side === "left" ? -4 : 4, 0], scale: [0.7, 1.1, 0.2] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut", delay: side === "left" ? 0.25 : 0.4 }}
                  />
                </>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
