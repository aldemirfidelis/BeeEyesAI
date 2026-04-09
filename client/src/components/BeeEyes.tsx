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

const EMOTION_PRESETS: Record<BeeEyesEmotion, EmotionPreset> = {
  neutral:   { openness: 0.92, browLift: -2,  browArch: 10, browPinch: 1,  movement: 0.42, pupilScale: 1,    blink: [2800, 5200], tremor: 0.02,  glow: 0.02 },
  happy:     { openness: 0.88, browLift: -7,  browArch: 15, browPinch: -2, movement: 0.34, pupilScale: 1.05, blink: [2600, 4700], tremor: 0.015, glow: 0.06 },
  curious:   { openness: 1.02, browLift: -11, browArch: 18, browPinch: -1, movement: 0.54, pupilScale: 1.12, blink: [2600, 4600], tremor: 0.03,  glow: 0.08 },
  attentive: { openness: 1.06, browLift: -9,  browArch: 14, browPinch: 3,  movement: 0.48, pupilScale: 1.08, blink: [3000, 5200], tremor: 0.04,  glow: 0.07 },
  excited:   { openness: 1.12, browLift: -14, browArch: 20, browPinch: -4, movement: 0.58, pupilScale: 1.2,  blink: [2200, 3600], tremor: 0.05,  glow: 0.15 },
  thinking:  { openness: 0.82, browLift: -3,  browArch: 8,  browPinch: 8,  movement: 0.68, pupilScale: 0.96, blink: [4200, 6800], tremor: 0.03,  glow: 0.03 },
  tired:     { openness: 0.58, browLift: 2,   browArch: 5,  browPinch: -2, movement: 0.18, pupilScale: 0.9,  blink: [2400, 4200], tremor: 0.008, glow: 0.01 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mapExpressionToEmotion(expression: BeeEyesExpression): BeeEyesEmotion {
  switch (expression) {
    case "sleepy":     return "tired";
    case "celebrating": return "excited";
    default:            return expression as BeeEyesEmotion;
  }
}

function getEventAdjustments(event: BeeEyesEvent | null) {
  switch (event) {
    case "message-received": return { openness: 0.12,  pupilScale: 0.14,  browLift: -4, browPinch: -1, tremor: 0.025, glow: 0.08 };
    case "user-typing":      return { openness: 0.06,  pupilScale: 0.06,  browLift: -1, browPinch: 1,  tremor: 0.02,  glow: 0.03 };
    case "mission-complete": return { openness: 0.15,  pupilScale: 0.18,  browLift: -6, browPinch: -3, tremor: 0.03,  glow: 0.24 };
    case "thinking":         return { openness: -0.08, pupilScale: -0.02, browLift: 1,  browPinch: 4,  tremor: 0.015, glow: 0 };
    case "idle":             return { openness: -0.22, pupilScale: -0.1,  browLift: 3,  browPinch: -2, tremor: 0,     glow: -0.02 };
    case "input-focus":      return { openness: 0.05,  pupilScale: 0.03,  browLift: -2, browPinch: 0,  tremor: 0.015, glow: 0.02 };
    default:                 return { openness: 0,     pupilScale: 0,     browLift: 0,  browPinch: 0,  tremor: 0,     glow: 0 };
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
    preset.tremor + eventAdjustments.tremor,
    inputFocused ? 0.018 : 0,
    isTyping ? 0.024 : 0,
  );

  useEffect(() => {
    if (tremorIntensity <= 0.002) { setTremor({ x: 0, y: 0 }); return; }
    const interval = window.setInterval(() => {
      setTremor({ x: (Math.random() * 2 - 1) * tremorIntensity * 9, y: (Math.random() * 2 - 1) * tremorIntensity * 5 });
    }, 90);
    return () => window.clearInterval(interval);
  }, [tremorIntensity]);

  // ── Derived values ───────────────────────────────────────
  const openness = clamp(
    (preset.openness + eventAdjustments.openness + normalizedEngagement * 0.04 + (inputFocused ? 0.02 : 0) + (isTyping ? 0.03 : 0)) * (isBlinking ? 0.06 : 1),
    0.06, 1.2,
  );

  const pupilScale = clamp(
    preset.pupilScale + eventAdjustments.pupilScale + normalizedEngagement * 0.08 + (inputFocused ? 0.03 : 0) + (isTyping ? 0.04 : 0),
    0.72, 1.4,
  );

  const glowStrength = clamp(
    preset.glow + eventAdjustments.glow + normalizedEngagement * 0.05 + (isTyping ? 0.02 : 0),
    0, 0.38,
  );

  const browLift  = preset.browLift  + eventAdjustments.browLift  + (inputFocused ? -1 : 0);
  const browPinch = preset.browPinch + eventAdjustments.browPinch + (inputFocused ?  1 : 0);
  const browArch  = preset.browArch  + (activeEvent === "mission-complete" ? 4 : 0);

  const pointerX    = interactive ? pointer.x * (5 + normalizedEngagement * 3.5) * preset.movement : 0;
  const pointerY    = interactive ? pointer.y * (3.8 + normalizedEngagement * 2) * preset.movement : 0;
  const glanceX     = glance.x * (effectiveEmotion === "thinking" ? 7.5 : 3.4);
  const glanceY     = glance.y * (effectiveEmotion === "thinking" ? 3.2 : 1.7);
  const scrollY     = (scrollProgress - 0.5) * 5.5;
  const focusY      = inputFocused ? 6.5 : 0;
  const typingBiasX = isTyping ? 1.5 : 0;

  const basePupilX = clamp(pointerX + glanceX + tremor.x + clickNudge.x + typingBiasX, -11, 11);
  const basePupilY = clamp(pointerY + glanceY + tremor.y + clickNudge.y + scrollY + focusY, -8, 10);

  // ── Aura / shell animations ──────────────────────────────
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

  // ── Glow colors per state ────────────────────────────────
  const glowColor  = `rgba(255, 196, 40, ${0.08 + glowStrength * 0.42})`;
  const glowRadius = 20 + glowStrength * 52;

  return (
    <div className={cn("relative flex items-center justify-center", className)} aria-hidden="true">
      <motion.div
        className="relative flex items-end gap-7 px-5 py-7"
        animate={{ y: [0, -floatAmplitude, 0] }}
        transition={{ duration: floatDuration, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Ambient aura behind both eyes */}
        <motion.div
          className="absolute inset-x-4 top-1/2 h-14 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(255,196,40,0.22) 0%, transparent 72%)" }}
          animate={auraAnimate}
          transition={auraTransition}
        />

        {(["left", "right"] as const).map((side) => {
          const personalityLift = side === "left" ? -2.5 : 0.8;
          const browY      = browLift + personalityLift;
          const browRotate = side === "left"
            ? -(browArch + 3) - browPinch * 0.6
            :   browArch + 3  + browPinch * 0.6;
          const browX      = side === "left" ?  6 + browPinch * 0.4 : -6 - browPinch * 0.4;
          const eyeTilt    = side === "left" ? -4 : 4;          // inward tilt for warmth
          const pupilX     = clamp(basePupilX + (side === "left" ? -0.6 : 0.6), -11, 11);
          const pupilY     = clamp(basePupilY + (side === "left" ? -0.3 : 0.2), -8, 10);

          return (
            <motion.div
              key={side}
              className="relative flex flex-col items-center"
              style={{ width: 96 }}
              animate={shellAnimate}
              transition={shellTransition}
            >
              {/* ── Eyebrow ── */}
              <motion.div
                style={{
                  height: 6,
                  borderRadius: 6,
                  background: "#8B5E1A",
                  opacity: 0.90,
                  marginBottom: 10,
                }}
                animate={{
                  x: browX,
                  y: browY,
                  rotate: browRotate,
                  width: 48 + normalizedEngagement * 6 + (side === "left" ? 2 : 0),
                }}
                transition={{ duration: 0.42, ease: "easeInOut" }}
              />

              {/* ── Sclera wrapper ── */}
              <div className="relative">
                {/* ── Sclera (esclera branca oval) ── */}
                <motion.div
                  className="overflow-hidden"
                  style={{
                    width: 88,
                    height: 92,
                    borderRadius: "50%",
                    background: "white",
                    border: "2px solid #E0E0E0",
                    boxShadow: `0 0 ${glowRadius}px ${glowColor}`,
                    rotate: `${eyeTilt}deg`,
                  }}
                  animate={{ scaleY: openness, scaleX: 0.97 + normalizedEngagement * 0.03 }}
                  transition={{ duration: isBlinking ? 0.1 : 0.36, ease: "easeInOut" }}
                >
                  {/* Iris + pupil group */}
                  <motion.div
                    className="absolute left-1/2 top-1/2"
                    style={{ width: 56, height: 56, x: "-50%", y: "-50%" }}
                    animate={{ x: `calc(-50% + ${pupilX}px)`, y: `calc(-50% + ${pupilY + 4}px)`, scale: pupilScale }}
                    transition={{ duration: effectiveEmotion === "thinking" ? 0.88 : 0.34, ease: "easeOut" }}
                  >
                    {/* Outer iris glow */}
                    <div style={{ position: "absolute", inset: -4, borderRadius: "50%", background: `radial-gradient(circle, rgba(255,216,77,${0.22 + glowStrength * 0.3}) 0%, transparent 72%)`, filter: "blur(4px)" }} />
                    {/* Iris */}
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #FFD84D 0%, #F5A800 60%, #C87A00 100%)", boxShadow: `0 0 ${10 + glowStrength * 18}px rgba(255,216,77,${0.3 + glowStrength * 0.3})` }} />
                    {/* Pupil */}
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 30, height: 30, borderRadius: "50%", background: "radial-gradient(circle at 38% 32%, #5C3A1E 0%, #2A1A0A 100%)" }} />
                    {/* Reflexo principal */}
                    <div style={{ position: "absolute", top: "14%", left: "12%", width: 12, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.90)" }} />
                    {/* Reflexo secundário */}
                    <div style={{ position: "absolute", top: "50%", left: "58%", width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.55)" }} />
                  </motion.div>
                </motion.div>

                {/* ── Mission-complete sparkles ── */}
                {activeEvent === "mission-complete" && (
                  <>
                    <motion.div
                      className="absolute right-1 top-4 h-2.5 w-2.5 rounded-full blur-[1px]"
                      style={{ background: "rgba(255,210,50,0.9)" }}
                      animate={{ opacity: [0, 1, 0], y: [0, -10, -18], scale: [0.8, 1.2, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeOut", delay: side === "left" ? 0 : 0.18 }}
                    />
                    <motion.div
                      className="absolute left-3 top-7 h-2 w-2 rounded-full"
                      style={{ background: "rgba(255,255,255,0.92)" }}
                      animate={{ opacity: [0, 1, 0], y: [0, -8, -14], x: [0, side === "left" ? -4 : 4, 0], scale: [0.6, 1.1, 0.2] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut", delay: side === "left" ? 0.25 : 0.4 }}
                    />
                    <motion.div
                      className="absolute right-4 top-10 h-1.5 w-1.5 rounded-full"
                      style={{ background: "rgba(255,196,40,0.8)" }}
                      animate={{ opacity: [0, 1, 0], y: [0, -12, -20], scale: [0.5, 1, 0.1] }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: "easeOut", delay: side === "left" ? 0.5 : 0.1 }}
                    />
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
