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
  scaleY: number;
  pupilX: number;
  pupilY: number;
  movement: number;
  blink: [number, number];
  glow: number;
}

interface MotionPoint {
  x: number;
  y: number;
}

// Hexagon points for eye body (56×56 space)
const HEX_POINTS = "14,0 42,0 56,28 42,56 14,56 0,28";
// Octagon points for pupil (28×28 space)
const OCT_POINTS = "8,0 20,0 28,8 28,20 20,28 8,28 0,20 0,8";

const EMOTION_PRESETS: Record<BeeEyesEmotion, EmotionPreset> = {
  neutral:   { scaleY: 1.0,  pupilX: 0,  pupilY: 0,  movement: 0.42, blink: [2800, 5200], glow: 0.02 },
  happy:     { scaleY: 0.55, pupilX: 0,  pupilY: 4,  movement: 0.34, blink: [2600, 4700], glow: 0.06 },
  curious:   { scaleY: 1.08, pupilX: 8,  pupilY: -4, movement: 0.54, blink: [2600, 4600], glow: 0.08 },
  attentive: { scaleY: 1.06, pupilX: 0,  pupilY: -2, movement: 0.48, blink: [3000, 5200], glow: 0.07 },
  excited:   { scaleY: 1.14, pupilX: 0,  pupilY: -2, movement: 0.58, blink: [2200, 3600], glow: 0.15 },
  thinking:  { scaleY: 0.82, pupilX: 0,  pupilY: 2,  movement: 0.68, blink: [4200, 6800], glow: 0.03 },
  tired:     { scaleY: 0.32, pupilX: 0,  pupilY: 4,  movement: 0.18, blink: [2400, 4200], glow: 0.01 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mapExpressionToEmotion(expression: BeeEyesExpression): BeeEyesEmotion {
  switch (expression) {
    case "sleepy":      return "tired";
    case "celebrating": return "excited";
    default:            return expression as BeeEyesEmotion;
  }
}

function getEventAdjustments(event: BeeEyesEvent | null) {
  switch (event) {
    case "message-received": return { scaleY: 0.1,  pupilY: -2, glow: 0.08 };
    case "user-typing":      return { scaleY: 0.04, pupilY: 0,  glow: 0.03 };
    case "mission-complete": return { scaleY: 0.14, pupilY: -3, glow: 0.24 };
    case "thinking":         return { scaleY: -0.1, pupilY: 2,  glow: 0 };
    case "idle":             return { scaleY: -0.2, pupilY: 3,  glow: -0.02 };
    case "input-focus":      return { scaleY: 0.04, pupilY: 4,  glow: 0.02 };
    default:                 return { scaleY: 0,    pupilY: 0,  glow: 0 };
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
  const eventAdj = getEventAdjustments(activeEvent);

  // ── Interactivity ────────────────────────────────────────
  useEffect(() => {
    if (!interactive) return;

    const markActivity = () => {
      lastActivityRef.current = Date.now();
      setIsIdle(false);
    };

    const updatePointer = (clientX: number, clientY: number) => {
      const x = ((clientX / window.innerWidth) * 2 - 1) * 0.95;
      const y = ((clientY / window.innerHeight) * 2 - 1) * 0.95;
      const next = { x, y };
      pointerRef.current = next;
      setPointer(next);
    };

    const handlePointerMove = (e: MouseEvent) => { markActivity(); updatePointer(e.clientX, e.clientY); };
    const handleTouchStart  = (e: TouchEvent)  => { markActivity(); const t = e.touches[0]; if (t) updatePointer(t.clientX, t.clientY); };
    const handleClick       = () => {
      markActivity();
      setClickNudge({ x: pointerRef.current.x * 1.8, y: pointerRef.current.y * 1.1 });
      if (clickResetRef.current) window.clearTimeout(clickResetRef.current);
      clickResetRef.current = window.setTimeout(() => setClickNudge({ x: 0, y: 0 }), 150);
    };

    const idleInterval = window.setInterval(() => {
      setIsIdle(Date.now() - lastActivityRef.current > 18000);
    }, 500);

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", markActivity);
    window.addEventListener("wheel", markActivity, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });

    return () => {
      window.clearInterval(idleInterval);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", markActivity);
      window.removeEventListener("wheel", markActivity);
      window.removeEventListener("touchstart", handleTouchStart);
      if (clickResetRef.current) window.clearTimeout(clickResetRef.current);
    };
  }, [interactive]);

  // ── Blink ────────────────────────────────────────────────
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
          const cluster = effectiveEmotion === "excited" ? 0.22 : effectiveEmotion === "tired" ? 0.08 : 0.14;
          scheduleBlink(Math.random() < cluster ? 160 + Math.random() * 140 : undefined);
        }, 110 + Math.random() * 80);
      }, delay ?? min + Math.random() * (max - min));
    };

    scheduleBlink();
    return () => {
      cancelled = true;
      if (waitTimer)  window.clearTimeout(waitTimer);
      if (blinkTimer) window.clearTimeout(blinkTimer);
    };
  }, [effectiveEmotion, preset.blink]);

  // ── Glance ───────────────────────────────────────────────
  useEffect(() => {
    let timer: number | null = null;
    const thinking = effectiveEmotion === "thinking" || activeEvent === "thinking";

    const scheduleGlance = () => {
      setGlance({
        x: (Math.random() * 2 - 1) * (thinking ? 1 : 0.55),
        y: (Math.random() * 2 - 1) * (thinking ? 0.3 : 0.14),
      });
      timer = window.setTimeout(scheduleGlance, thinking ? 900 + Math.random() * 1400 : 2200 + Math.random() * 2600);
    };

    scheduleGlance();
    return () => {
      if (timer) window.clearTimeout(timer);
      setGlance({ x: 0, y: 0 });
    };
  }, [activeEvent, effectiveEmotion]);

  // ── Tremor ───────────────────────────────────────────────
  const tremorIntensity = Math.max(
    0.02 + (isTyping ? 0.024 : 0) + (inputFocused ? 0.018 : 0),
    0,
  );

  useEffect(() => {
    if (tremorIntensity <= 0.002) { setTremor({ x: 0, y: 0 }); return; }
    const interval = window.setInterval(() => {
      setTremor({ x: (Math.random() * 2 - 1) * tremorIntensity * 9, y: (Math.random() * 2 - 1) * tremorIntensity * 5 });
    }, 90);
    return () => window.clearInterval(interval);
  }, [tremorIntensity]);

  // ── Derived values ───────────────────────────────────────
  const eyeScaleY = clamp(
    (preset.scaleY + eventAdj.scaleY + normalizedEngagement * 0.04 + (inputFocused ? 0.02 : 0) + (isTyping ? 0.03 : 0)) * (isBlinking ? 0.05 : 1),
    0.05, 1.2,
  );

  const glowStrength = clamp(
    preset.glow + eventAdj.glow + normalizedEngagement * 0.05 + (isTyping ? 0.02 : 0),
    0, 0.38,
  );

  const pointerX    = interactive ? pointer.x * (4 + normalizedEngagement * 3) * preset.movement : 0;
  const pointerY    = interactive ? pointer.y * (3 + normalizedEngagement * 2) * preset.movement : 0;
  const glanceX     = glance.x * (effectiveEmotion === "thinking" ? 7 : 3);
  const glanceY     = glance.y * (effectiveEmotion === "thinking" ? 3 : 1.5);
  const scrollY     = (scrollProgress - 0.5) * 4;
  const focusY      = inputFocused ? 4 : 0;
  const typingBiasX = isTyping ? 1.2 : 0;

  const basePupilX = clamp(pointerX + glanceX + tremor.x + clickNudge.x + typingBiasX, -8, 8);
  const basePupilY = clamp(pointerY + glanceY + tremor.y + clickNudge.y + scrollY + focusY + preset.pupilY + eventAdj.pupilY, -6, 6);

  // ── Shell / aura animations ──────────────────────────────
  const auraAnimate =
    activeEvent === "mission-complete"
      ? { opacity: [0.35, 0.85, 0.35], scale: [1, 1.14, 1] }
      : activeEvent === "message-received"
        ? { opacity: [0.2, 0.48, 0.2], scale: [1, 1.05, 1] }
        : { opacity: [0.12 + glowStrength * 0.5, 0.22 + glowStrength, 0.12 + glowStrength * 0.5], scale: [1, 1.03, 1] };

  const auraTransition =
    activeEvent === "mission-complete"
      ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
      : { duration: 2.8, repeat: Infinity, ease: "easeInOut" };

  const shellAnimate =
    activeEvent === "mission-complete"
      ? { y: [0, -6, 0], scale: [1, 1.04, 1], rotate: [0, -1.2, 1.2, 0] }
      : activeEvent === "message-received"
        ? { y: [0, -2.5, 0], scale: [1, 1.02, 1] }
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

  const floatAmplitude = shouldIdle ? 1.2 : 2.8 + normalizedEngagement * 1.4;
  const floatDuration  = shouldIdle ? 6.2 : effectiveEmotion === "thinking" ? 5 : 4;

  const glowColor  = `rgba(245, 200, 66, ${0.1 + glowStrength * 0.5})`;

  const isCelebrating = effectiveEmotion === "excited" || activeEvent === "mission-complete";

  return (
    <div className={cn("relative flex items-center justify-center", className)} aria-hidden="true">
      <motion.div
        className="relative flex items-center gap-2 px-3 py-3"
        animate={{ y: [0, -floatAmplitude, 0] }}
        transition={{ duration: floatDuration, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Ambient aura */}
        <motion.div
          className="absolute inset-x-2 top-1/2 h-8 -translate-y-1/2 rounded-full blur-2xl"
          style={{ background: "radial-gradient(ellipse, rgba(245,200,66,0.3) 0%, transparent 72%)" }}
          animate={auraAnimate}
          transition={auraTransition}
        />

        {(["left", "right"] as const).map((side) => {
          const pX = clamp(basePupilX + preset.pupilX * (side === "left" ? 1 : -1) * 0.3 + (side === "left" ? -0.5 : 0.5), -8, 8);
          const pY = clamp(basePupilY + (side === "left" ? -0.3 : 0.2), -6, 6);

          return (
            <motion.div
              key={side}
              className="relative"
              animate={shellAnimate}
              transition={shellTransition}
            >
              <motion.div
                style={{ transformOrigin: "center center" }}
                animate={{ scaleY: eyeScaleY }}
                transition={{ duration: isBlinking ? 0.08 : 0.28, ease: "easeInOut" }}
              >
                <svg
                  width="56"
                  height="56"
                  viewBox="0 0 56 56"
                  style={{
                    display: "block",
                    filter: glowStrength > 0.04
                      ? `drop-shadow(0 0 ${4 + glowStrength * 10}px ${glowColor})`
                      : undefined,
                  }}
                >
                  {/* Eye body — hexagon */}
                  <polygon points={HEX_POINTS} fill="#1a1a1a" />
                  {/* Pupil — octagon amber */}
                  <g transform={`translate(${14 + pX}, ${14 + pY})`}>
                    <polygon points={OCT_POINTS} fill="#F5C842" />
                  </g>
                  {/* Shine */}
                  <rect
                    x={isCelebrating ? 8 : 12}
                    y={isCelebrating ? 8 : 12}
                    width={10}
                    height={10}
                    rx={2}
                    fill="white"
                    opacity={0.9}
                  />
                </svg>
              </motion.div>

              {/* Mission-complete sparkles */}
              {activeEvent === "mission-complete" && (
                <>
                  <motion.div
                    className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full blur-[1px]"
                    style={{ background: "rgba(245,200,66,0.9)" }}
                    animate={{ opacity: [0, 1, 0], y: [0, -10, -18], scale: [0.8, 1.2, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, ease: "easeOut", delay: side === "left" ? 0 : 0.18 }}
                  />
                  <motion.div
                    className="absolute left-1 top-2 h-2 w-2 rounded-full"
                    style={{ background: "rgba(255,255,255,0.92)" }}
                    animate={{ opacity: [0, 1, 0], y: [0, -8, -14], x: [0, side === "left" ? -4 : 4, 0], scale: [0.6, 1.1, 0.2] }}
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
