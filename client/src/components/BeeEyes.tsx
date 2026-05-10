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
  squint: number;   // 0=open, 1=closed
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

const EMOTION_PRESETS: Record<BeeEyesEmotion, EmotionPreset> = {
  neutral:   { squint: 0.00, pupilX: 0,  pupilY: 0,  movement: 0.42, blink: [2800, 5200], glow: 0.02 },
  happy:     { squint: 0.28, pupilX: 0,  pupilY: 3,  movement: 0.34, blink: [2600, 4700], glow: 0.06 },
  curious:   { squint: 0.08, pupilX: 6,  pupilY: -3, movement: 0.54, blink: [2600, 4600], glow: 0.08 },
  attentive: { squint: 0.06, pupilX: 0,  pupilY: -2, movement: 0.48, blink: [3000, 5200], glow: 0.07 },
  excited:   { squint: 0.12, pupilX: 0,  pupilY: -2, movement: 0.58, blink: [2200, 3600], glow: 0.15 },
  thinking:  { squint: 0.15, pupilX: 0,  pupilY: 2,  movement: 0.68, blink: [4200, 6800], glow: 0.03 },
  tired:     { squint: 0.55, pupilX: 0,  pupilY: 3,  movement: 0.18, blink: [2400, 4200], glow: 0.01 },
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
    case "message-received": return { squint: -0.05, pupilY: -2, glow: 0.08 };
    case "user-typing":      return { squint: -0.02, pupilY: 0,  glow: 0.03 };
    case "thinking":         return { squint: 0.08,  pupilY: 2,  glow: 0 };
    case "idle":             return { squint: 0.18,  pupilY: 3,  glow: -0.02 };
    case "input-focus":      return { squint: -0.02, pupilY: 3,  glow: 0.02 };
    default:                 return { squint: 0,     pupilY: 0,  glow: 0 };
  }
}

// Eye geometry constants
const EYE_SIZE   = 48;
const OUTER_R    = EYE_SIZE * 0.46;   // sclera radius
const IRIS_R     = EYE_SIZE * 0.30;   // iris radius
const PUPIL_R    = EYE_SIZE * 0.175;  // pupil radius
const GLINT1_R   = EYE_SIZE * 0.072;  // main sparkle
const GLINT2_R   = EYE_SIZE * 0.038;  // secondary sparkle
const EYE_CX     = EYE_SIZE / 2;
const EYE_CY     = EYE_SIZE / 2;
const EYE_GAP    = EYE_SIZE * 0.46;
const BROW_W     = EYE_SIZE * 0.095;  // brow stroke width
const BROW_Y     = EYE_CY - OUTER_R * 1.18; // brow base Y (above eye, in SVG space)
const BROW_HALF  = OUTER_R * 0.78;    // brow half-width

// Per-emotion brow: archY = how much control pt deviates from BROW_Y (negative = arch up), ty = animate Y offset
const BROW_CONFIGS: Record<BeeEyesEmotion | "sleepy" | "celebrating", { leftArch: number; rightArch: number; ty: number }> = {
  neutral:     { leftArch: -3,  rightArch: -3,  ty: 0  },
  happy:       { leftArch: -8,  rightArch: -8,  ty: -2 },
  curious:     { leftArch: -10, rightArch: -3,  ty: -2 },
  attentive:   { leftArch: -5,  rightArch: -5,  ty: -1 },
  excited:     { leftArch: -11, rightArch: -11, ty: -4 },
  thinking:    { leftArch: 2,   rightArch: -7,  ty: 0  },
  tired:       { leftArch: 2,   rightArch: 2,   ty: 2  },
  sleepy:      { leftArch: 2,   rightArch: 2,   ty: 3  },
  celebrating: { leftArch: -12, rightArch: -12, ty: -5 },
};

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
  const shouldIdle = isIdle && !inputFocused && !isTyping;
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
  const squintFrac = clamp(
    preset.squint + eventAdj.squint + (isBlinking ? 0.97 : 0) - normalizedEngagement * 0.03 - (inputFocused ? 0.02 : 0) - (isTyping ? 0.02 : 0),
    0, 0.98,
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

  const basePupilX = clamp(pointerX + glanceX + tremor.x + clickNudge.x + typingBiasX, -6, 6);
  const basePupilY = clamp(pointerY + glanceY + tremor.y + clickNudge.y + scrollY + focusY + preset.pupilY + eventAdj.pupilY, -5, 5);

  // ── Shell / aura animations ──────────────────────────────
  const auraAnimate =
    activeEvent === "message-received"
      ? { opacity: [0.2, 0.48, 0.2], scale: [1, 1.05, 1] }
      : { opacity: [0.12 + glowStrength * 0.5, 0.22 + glowStrength, 0.12 + glowStrength * 0.5], scale: [1, 1.03, 1] };

  const auraTransition = { duration: 2.8, repeat: Infinity, ease: "easeInOut" };

  const shellAnimate =
    activeEvent === "message-received"
      ? { y: [0, -2.5, 0], scale: [1, 1.02, 1] }
      : activeEvent === "user-typing"
        ? { x: [0, 2, -1.5, 0] }
        : {};

  const shellTransition =
    activeEvent === "message-received"
      ? { duration: 0.55, ease: "easeInOut" }
      : activeEvent === "user-typing"
        ? { duration: 0.45, ease: "easeInOut" }
        : { duration: 0.3 };

  const floatAmplitude = shouldIdle ? 1.2 : 2.8 + normalizedEngagement * 1.4;
  const floatDuration  = shouldIdle ? 6.2 : effectiveEmotion === "thinking" ? 5 : 4;

  const bc = BROW_CONFIGS[effectiveEmotion] ?? BROW_CONFIGS.neutral;

  // Lid Y for squint: at squintFrac=0 → clipY = EYE_CY - OUTER_R (full eye open)
  //                   at squintFrac=1 → clipY = EYE_CY + OUTER_R (eye fully closed)
  const lidY = EYE_CY - OUTER_R + OUTER_R * 2 * squintFrac;

  return (
    <div className={cn("relative flex items-center justify-center", className)} aria-hidden="true">
      <motion.div
        className="relative"
        style={{ paddingTop: EYE_SIZE * 0.34 }}
        animate={{ y: [0, -floatAmplitude, 0] }}
        transition={{ duration: floatDuration, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Ambient aura */}
        <motion.div
          className="absolute left-0 right-0 rounded-full blur-2xl pointer-events-none"
          style={{
            height: EYE_SIZE * 0.6,
            top: "50%",
            transform: "translateY(-50%)",
            background: "radial-gradient(ellipse, rgba(245,200,66,0.28) 0%, transparent 70%)",
          }}
          animate={auraAnimate}
          transition={auraTransition}
        />

        <div style={{ display: "flex", alignItems: "center", gap: EYE_GAP }}>
          {(["left", "right"] as const).map((side) => {
            const pX = clamp(
              basePupilX + preset.pupilX * (side === "left" ? 1 : -1) * 0.3 + (side === "left" ? -0.4 : 0.4),
              -(IRIS_R - PUPIL_R) * 0.7,
              (IRIS_R - PUPIL_R) * 0.7,
            );
            const pY = clamp(
              basePupilY + (side === "left" ? -0.3 : 0.2),
              -(IRIS_R - PUPIL_R) * 0.65,
              (IRIS_R - PUPIL_R) * 0.65,
            );

            const archY = side === "left" ? bc.leftArch : bc.rightArch;
            const browCtrlY = BROW_Y + archY; // control pt of quadratic bezier

            const gradId = `irisg-${side}`;
            const clipId = `lid-${side}`;

            return (
              <motion.div
                key={side}
                animate={shellAnimate}
                transition={shellTransition}
                style={{ position: "relative", width: EYE_SIZE, height: EYE_SIZE }}
              >
                <svg
                  width={EYE_SIZE}
                  height={EYE_SIZE}
                  viewBox={`0 0 ${EYE_SIZE} ${EYE_SIZE}`}
                  style={{ overflow: "visible" }}
                >
                  <defs>
                    <radialGradient id={gradId} cx="40%" cy="35%" r="65%">
                      <stop offset="0%"   stopColor="#FFE566" />
                      <stop offset="45%"  stopColor="#F5A623" />
                      <stop offset="100%" stopColor="#D4851A" />
                    </radialGradient>
                    <clipPath id={clipId}>
                      <rect x={EYE_CX - OUTER_R - 2} y={lidY} width={(OUTER_R + 2) * 2} height={(OUTER_R + 2) * 2} />
                    </clipPath>
                  </defs>

                  {/* Eyebrow */}
                  <motion.path
                    d={`M ${EYE_CX - BROW_HALF} ${BROW_Y} Q ${EYE_CX} ${browCtrlY} ${EYE_CX + BROW_HALF} ${BROW_Y}`}
                    fill="none"
                    stroke="#8B5E0A"
                    strokeWidth={BROW_W}
                    strokeLinecap="round"
                    animate={{ y: bc.ty }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                  />

                  {/* Sclera */}
                  <circle
                    cx={EYE_CX}
                    cy={EYE_CY}
                    r={OUTER_R}
                    fill="#F5EED8"
                    style={{ filter: `drop-shadow(0 3px 10px rgba(0,0,0,0.20))${glowStrength > 0.05 ? ` drop-shadow(0 0 ${4 + glowStrength * 12}px rgba(245,200,66,${glowStrength * 0.55}))` : ""}` }}
                  />

                  {/* Lid-clipped: iris + pupil + sparkles */}
                  <g clipPath={`url(#${clipId})`}>
                    {/* Iris */}
                    <circle cx={EYE_CX} cy={EYE_CY} r={IRIS_R} fill={`url(#${gradId})`} />
                    {/* Iris depth ring */}
                    <circle cx={EYE_CX} cy={EYE_CY} r={IRIS_R * 0.62} fill="#D4851A" opacity="0.25" />
                    {/* Pupil */}
                    <circle cx={EYE_CX + pX} cy={EYE_CY + pY} r={PUPIL_R} fill="#1A1005" />
                    {/* Main sparkle */}
                    <circle
                      cx={EYE_CX + pX + PUPIL_R * 0.42}
                      cy={EYE_CY + pY - PUPIL_R * 0.50}
                      r={GLINT1_R}
                      fill="white"
                      opacity="0.95"
                    />
                    {/* Secondary sparkle */}
                    <circle
                      cx={EYE_CX + pX - PUPIL_R * 0.30}
                      cy={EYE_CY + pY - PUPIL_R * 0.62}
                      r={GLINT2_R}
                      fill="white"
                      opacity="0.60"
                    />
                  </g>

                  {/* Sclera rim */}
                  <circle cx={EYE_CX} cy={EYE_CY} r={OUTER_R} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
                </svg>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
