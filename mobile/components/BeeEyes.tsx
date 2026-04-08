import { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import Svg, {
  Defs, RadialGradient, LinearGradient,
  Stop, ClipPath, Rect, Circle, G, Ellipse,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { type EyeExpression } from "../stores/uiStore";

interface BeeEyesProps {
  expression?: EyeExpression;
  size?: number;
}

// ── Eye dimensions ──────────────────────────────────────────
const EW = 82;   // eye width
const EH = 56;   // eye height
const ER = 28;   // border-radius (pill = EH/2)
const CX = EW / 2;
const CY = EH / 2;
const IRIS_R  = 19;
const PUPIL_R =  9;

// ── Per-expression config ────────────────────────────────────
const EXPR: Record<EyeExpression, {
  scaleY: number;
  pupilX: number;
  pupilY: number;
  browLift: number;
  browRotL: number;
  browRotR: number;
}> = {
  neutral:    { scaleY: 1,    pupilX: 0,  pupilY: 0,  browLift: 0,  browRotL: -4,  browRotR: 4  },
  happy:      { scaleY: 0.72, pupilX: 0,  pupilY: 2,  browLift: -4, browRotL: -8,  browRotR: 8  },
  curious:    { scaleY: 1.08, pupilX: 5,  pupilY: -3, browLift: -6, browRotL: -6,  browRotR: 10 },
  excited:    { scaleY: 1.14, pupilX: 0,  pupilY: -2, browLift: -8, browRotL: -10, browRotR: 10 },
  sleepy:     { scaleY: 0.34, pupilX: 0,  pupilY: 3,  browLift: 3,  browRotL: -2,  browRotR: 2  },
  celebrating:{ scaleY: 1.1,  pupilX: 0,  pupilY: -3, browLift: -10,browRotL: -12, browRotR: 12 },
};

// ─────────────────────────────────────────────────────────────
function Eye({
  side,
  expression,
  blinkScaleY,
  bounceY,
}: {
  side: "left" | "right";
  expression: EyeExpression;
  blinkScaleY: Animated.SharedValue<number>;
  bounceY: Animated.SharedValue<number>;
}) {
  const cfg = EXPR[expression];
  const tilt = side === "left" ? -4 : 4;    // inward tilt for warmth
  const pupilX = CX + cfg.pupilX * (side === "left" ? 1 : 1);
  const pupilY = CY + cfg.pupilY;

  // brow positioning
  const browY     = 2 + cfg.browLift;
  const browRot   = side === "left" ? cfg.browRotL : cfg.browRotR;
  const browCX    = EW / 2 + (side === "left" ? -2 : 2);

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounceY.value }],
  }));

  const blinkStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blinkScaleY.value * cfg.scaleY }],
  }));

  // unique gradient IDs per eye
  const uid = side === "left" ? "L" : "R";

  return (
    <Animated.View style={bounceStyle}>
      {/* Eyebrow */}
      <Svg
        width={EW}
        height={18}
        viewBox={`0 0 ${EW} 18`}
        style={{ marginBottom: 2 }}
      >
        <G
          transform={`translate(${browCX}, ${browY}) rotate(${browRot}) translate(${-22}, ${-3})`}
        >
          <Rect width={44} height={6} rx={3} ry={3} fill="#1A1A2E" opacity={0.85} />
        </G>
      </Svg>

      {/* Eye shell */}
      <Animated.View
        style={[
          blinkStyle,
          {
            transformOrigin: "center",
            transform: [{ rotate: `${tilt}deg` }],
          },
        ]}
      >
        <Svg width={EW} height={EH} viewBox={`0 0 ${EW} ${EH}`}>
          <Defs>
            {/* Shell gradient */}
            <LinearGradient id={`shell${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0"   stopColor="#0F0F1A" />
              <Stop offset="0.5" stopColor="#08080E" />
              <Stop offset="1"   stopColor="#050508" />
            </LinearGradient>

            {/* Iris radial gradient */}
            <RadialGradient id={`iris${uid}`} cx="42%" cy="38%" r="50%" fx="42%" fy="38%">
              <Stop offset="0%"   stopColor="#FFF8CC" />
              <Stop offset="18%"  stopColor="#FFE566" />
              <Stop offset="40%"  stopColor="#FFD020" />
              <Stop offset="62%"  stopColor="#FFC107" />
              <Stop offset="82%"  stopColor="#E8920A" />
              <Stop offset="100%" stopColor="#B36200" />
            </RadialGradient>

            {/* Outer iris glow */}
            <RadialGradient id={`irisGlow${uid}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor="#FFC928" stopOpacity={0.35} />
              <Stop offset="100%" stopColor="#FFC928" stopOpacity={0} />
            </RadialGradient>

            {/* Top eyelid shine */}
            <LinearGradient id={`topShine${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0"   stopColor="white" stopOpacity={0.09} />
              <Stop offset="1"   stopColor="white" stopOpacity={0} />
            </LinearGradient>

            {/* Clip to pill shape */}
            <ClipPath id={`pill${uid}`}>
              <Rect x={0} y={0} width={EW} height={EH} rx={ER} ry={ER} />
            </ClipPath>
          </Defs>

          {/* Outer soft glow ring */}
          <Ellipse cx={CX} cy={CY} rx={EW / 2 + 3} ry={EH / 2 + 3}
            fill={`url(#irisGlow${uid})`} />

          {/* Eye shell — pill */}
          <G clipPath={`url(#pill${uid})`}>
            <Rect x={0} y={0} width={EW} height={EH} fill={`url(#shell${uid})`} />

            {/* Iris outer glow */}
            <Circle cx={CX} cy={CY} r={IRIS_R + 5} fill={`url(#irisGlow${uid})`} />

            {/* Iris */}
            <Circle cx={pupilX} cy={pupilY} r={IRIS_R} fill={`url(#iris${uid})`} />

            {/* Iris inner detail ring */}
            <Circle
              cx={pupilX} cy={pupilY} r={IRIS_R - 6}
              fill="none"
              stroke="rgba(200,120,0,0.3)"
              strokeWidth={1.5}
            />

            {/* Pupil */}
            <Circle cx={pupilX} cy={pupilY} r={PUPIL_R} fill="#050508" />

            {/* Primary highlight */}
            <Circle
              cx={pupilX - IRIS_R * 0.38}
              cy={pupilY - IRIS_R * 0.42}
              r={5}
              fill="white"
              opacity={0.97}
            />

            {/* Secondary highlight */}
            <Circle
              cx={pupilX - IRIS_R * 0.18}
              cy={pupilY - IRIS_R * 0.2}
              r={2.5}
              fill="white"
              opacity={0.55}
            />

            {/* Tiny catch-light */}
            <Circle
              cx={pupilX + IRIS_R * 0.3}
              cy={pupilY + IRIS_R * 0.28}
              r={1.5}
              fill="white"
              opacity={0.28}
            />

            {/* Top eyelid shine */}
            <Rect x={0} y={0} width={EW} height={20} fill={`url(#topShine${uid})`} rx={ER} />

            {/* Bottom inner glow */}
            <Ellipse
              cx={CX} cy={EH - 4}
              rx={EW * 0.3} ry={5}
              fill="#FFC107"
              opacity={0.08}
            />
          </G>
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
export default function BeeEyes({ expression = "neutral", size = 120 }: BeeEyesProps) {
  const blinkScaleY      = useSharedValue(1);
  const bounceY          = useSharedValue(0);
  const sparkle1Opacity  = useSharedValue(0);
  const sparkle2Opacity  = useSharedValue(0);
  const sparkle3Opacity  = useSharedValue(0);
  const blinkTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Blink loop ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const scheduleBlink = () => {
      const delay = 2800 + Math.random() * 2400;
      blinkTimeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        blinkScaleY.value = withSequence(
          withTiming(0.05, { duration: 80, easing: Easing.out(Easing.quad) }),
          withTiming(1,    { duration: 80, easing: Easing.in(Easing.quad) }),
        );
        scheduleBlink();
      }, delay);
    };

    scheduleBlink();
    return () => {
      cancelled = true;
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
    };
  }, []);

  // ── Expression reactions ──────────────────────────────────
  useEffect(() => {
    if (expression === "celebrating" || expression === "excited") {
      bounceY.value = withRepeat(
        withSequence(
          withTiming(-10, { duration: 280, easing: Easing.out(Easing.quad) }),
          withTiming(0,   { duration: 280, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
      sparkle1Opacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 350 }), withTiming(0, { duration: 350 })),
        -1, false,
      );
      sparkle2Opacity.value = withDelay(
        180,
        withRepeat(
          withSequence(withTiming(1, { duration: 350 }), withTiming(0, { duration: 350 })),
          -1, false,
        ),
      );
      sparkle3Opacity.value = withDelay(
        360,
        withRepeat(
          withSequence(withTiming(1, { duration: 350 }), withTiming(0, { duration: 350 })),
          -1, false,
        ),
      );
    } else {
      cancelAnimation(bounceY);
      cancelAnimation(sparkle1Opacity);
      cancelAnimation(sparkle2Opacity);
      cancelAnimation(sparkle3Opacity);
      bounceY.value         = withSpring(0, { damping: 12 });
      sparkle1Opacity.value = withTiming(0, { duration: 200 });
      sparkle2Opacity.value = withTiming(0, { duration: 200 });
      sparkle3Opacity.value = withTiming(0, { duration: 200 });
    }
  }, [expression]);

  const scale          = size / 140;
  const containerW     = (EW * 2 + 20) * scale;   // two eyes + gap
  const containerH     = (EH + 28)     * scale;   // eye + brow height

  const sparkle1Style  = useAnimatedStyle(() => ({ opacity: sparkle1Opacity.value }));
  const sparkle2Style  = useAnimatedStyle(() => ({ opacity: sparkle2Opacity.value }));
  const sparkle3Style  = useAnimatedStyle(() => ({ opacity: sparkle3Opacity.value }));

  return (
    <View style={[styles.container, { width: containerW, height: containerH }]}>
      <View
        style={{
          transform: [{ scale }],
          width:  EW * 2 + 20,
          height: EH + 28,
          flexDirection: "row",
          gap: 20,
          alignItems: "flex-end",
        }}
      >
        <Eye side="left"  expression={expression} blinkScaleY={blinkScaleY} bounceY={bounceY} />
        <Eye side="right" expression={expression} blinkScaleY={blinkScaleY} bounceY={bounceY} />
      </View>

      {/* Sparkles */}
      {(expression === "celebrating" || expression === "excited") && (
        <>
          <Animated.View style={[styles.sparkle, { top: -2, left: containerW * 0.18 }, sparkle1Style]}>
            <Svg width={14} height={14} viewBox="0 0 14 14">
              <Circle cx={7} cy={7} r={5} fill="#FFD020" />
              <Circle cx={7} cy={7} r={2} fill="white" opacity={0.7} />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.sparkle, { top: 4, right: containerW * 0.14 }, sparkle2Style]}>
            <Svg width={10} height={10} viewBox="0 0 10 10">
              <Circle cx={5} cy={5} r={4} fill="#FFC107" />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.sparkle, { top: 0, left: containerW * 0.5 }, sparkle3Style]}>
            <Svg width={8} height={8} viewBox="0 0 8 8">
              <Circle cx={4} cy={4} r={3} fill="rgba(255,255,255,0.9)" />
            </Svg>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  sparkle: {
    position: "absolute",
  },
});
