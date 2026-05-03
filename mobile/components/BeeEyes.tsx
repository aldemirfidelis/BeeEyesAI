import { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Polygon, Rect, G, Path } from "react-native-svg";
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
  type SharedValue,
} from "react-native-reanimated";
import { type EyeExpression } from "../stores/uiStore";
import { COLORS } from "../lib/theme";

interface BeeEyesProps {
  expression?: EyeExpression;
  size?: number;
  attentionX?: number;
  attentionY?: number;
}

// Hexagon points for eye body (56×56 space)
const HEX_POINTS = "14,0 42,0 56,28 42,56 14,56 0,28";
// Octagon points for pupil (28×28 space)
const OCT_POINTS = "8,0 20,0 28,8 28,20 20,28 8,28 0,20 0,8";

function clampN(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

// Per-expression vertical scale + pupil offset + eyebrow config
const EXPR: Record<EyeExpression, {
  scaleY: number;
  pupilX: number;
  pupilY: number;
  browLeft: { rotate: number; translateY: number; opacity: number };
  browRight: { rotate: number; translateY: number; opacity: number };
}> = {
  neutral: {
    scaleY: 1,    pupilX: 0, pupilY: 0,
    browLeft:  { rotate: -6,  translateY: 0,  opacity: 1   },
    browRight: { rotate:  6,  translateY: 0,  opacity: 1   },
  },
  happy: {
    scaleY: 0.55, pupilX: 0, pupilY: 4,
    browLeft:  { rotate:  12, translateY: -3, opacity: 1   },
    browRight: { rotate: -12, translateY: -3, opacity: 1   },
  },
  curious: {
    scaleY: 1.08, pupilX: 8, pupilY: -4,
    browLeft:  { rotate: -18, translateY: -6, opacity: 1   },
    browRight: { rotate:   6, translateY: -1, opacity: 1   },
  },
  excited: {
    scaleY: 1.14, pupilX: 0, pupilY: -2,
    browLeft:  { rotate:  14, translateY: -5, opacity: 1   },
    browRight: { rotate: -14, translateY: -5, opacity: 1   },
  },
  sleepy: {
    scaleY: 0.32, pupilX: 0, pupilY: 4,
    browLeft:  { rotate: -10, translateY:  4, opacity: 0.6 },
    browRight: { rotate:  10, translateY:  4, opacity: 0.6 },
  },
  celebrating: {
    scaleY: 1.1,  pupilX: 0, pupilY: -3,
    browLeft:  { rotate:  18, translateY: -7, opacity: 1   },
    browRight: { rotate: -18, translateY: -7, opacity: 1   },
  },
};

function Eyebrow({
  side,
  expression,
}: {
  side: "left" | "right";
  expression: EyeExpression;
}) {
  const cfg = side === "left" ? EXPR[expression].browLeft : EXPR[expression].browRight;

  const browStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withTiming(cfg.translateY, { duration: 220 }) }],
    opacity: withTiming(cfg.opacity, { duration: 180 }),
  }));

  return (
    <Animated.View style={[{ width: 56, height: 14, alignItems: "center", justifyContent: "flex-end" }, browStyle]}>
      <Svg width={56} height={14} viewBox="0 0 56 14">
        <Path
          d={`M 10 10 Q 28 ${cfg.rotate > 0 ? 3 : cfg.rotate < -8 ? 1 : 5} 46 10`}
          fill="none"
          stroke={COLORS.foreground}
          strokeWidth={5.5}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

function Eye({
  side,
  expression,
  blinkScale,
  bounceY,
  attentionX,
  attentionY,
}: {
  side: "left" | "right";
  expression: EyeExpression;
  blinkScale: SharedValue<number>;
  bounceY: SharedValue<number>;
  attentionX: number;
  attentionY: number;
}) {
  const cfg = EXPR[expression];

  const pX = clampN(cfg.pupilX + attentionX * 6, -8, 8);
  const pY = clampN(cfg.pupilY + attentionY * 4, -6, 6);

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounceY.value }],
  }));

  // Eye only — eyebrow is separate, NOT affected by blinkScale
  const blinkStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blinkScale.value * cfg.scaleY }],
  }));

  const isCelebrating = expression === "celebrating" || expression === "excited";

  return (
    <Animated.View style={[{ alignItems: "center" }, bounceStyle]}>
      {/* Eyebrow — outside blinkStyle, always visible */}
      <Eyebrow side={side} expression={expression} />

      {/* Eye body — affected by blink + expression scaleY */}
      <Animated.View style={blinkStyle}>
        <Svg width={56} height={56} viewBox="0 0 56 56">
          {/* Eye body — hexagon */}
          <Polygon points={HEX_POINTS} fill={COLORS.foreground} />

          {/* Pupil — octagon (amber) */}
          <G transform={`translate(${14 + pX}, ${14 + pY})`}>
            <Polygon points={OCT_POINTS} fill={COLORS.primary} />
          </G>

          {/* Shine */}
          <Rect
            x={isCelebrating ? 8 : 12}
            y={isCelebrating ? 8 : 12}
            width={10}
            height={10}
            rx={2}
            fill="white"
            opacity={0.9}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

export default function BeeEyes({
  expression = "neutral",
  size = 120,
  attentionX = 0,
  attentionY = 0,
}: BeeEyesProps) {
  const blinkScale = useSharedValue(1);
  const bounceY = useSharedValue(0);
  const sparkle1Opacity = useSharedValue(0);
  const sparkle2Opacity = useSharedValue(0);
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Blink loop
  useEffect(() => {
    let cancelled = false;

    const scheduleBlink = () => {
      const delay = 2800 + Math.random() * 2800;
      blinkTimeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        blinkScale.value = withSequence(
          withTiming(0.05, { duration: 80, easing: Easing.out(Easing.quad) }),
          withTiming(1,    { duration: 85, easing: Easing.in(Easing.quad) }),
        );
        scheduleBlink();
      }, delay);
    };

    scheduleBlink();
    return () => {
      cancelled = true;
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
    };
  }, [blinkScale]);

  // Celebrating / excited bounce + sparkles
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
        withSequence(withTiming(1, { duration: 380 }), withTiming(0, { duration: 380 })),
        -1,
        false,
      );
      sparkle2Opacity.value = withDelay(
        190,
        withRepeat(
          withSequence(withTiming(1, { duration: 380 }), withTiming(0, { duration: 380 })),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(bounceY);
      cancelAnimation(sparkle1Opacity);
      cancelAnimation(sparkle2Opacity);
      bounceY.value = withSpring(0, { damping: 12 });
      sparkle1Opacity.value = withTiming(0, { duration: 200 });
      sparkle2Opacity.value = withTiming(0, { duration: 200 });
    }
  }, [bounceY, expression, sparkle1Opacity, sparkle2Opacity]);

  const scale = size / 120;
  // Height is now taller to accommodate eyebrows above the eyes
  const eyeH = 56 + 14; // eye (56) + eyebrow area (14)
  const containerW = 120 * scale;
  const containerH = eyeH * scale;

  const sparkle1Style = useAnimatedStyle(() => ({ opacity: sparkle1Opacity.value }));
  const sparkle2Style = useAnimatedStyle(() => ({ opacity: sparkle2Opacity.value }));

  return (
    <View style={[styles.container, { width: containerW, height: containerH + 8 }]}>
      <View
        style={{
          transform: [{ scale }],
          width: 120,
          height: eyeH,
          flexDirection: "row",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        <Eye
          side="left"
          expression={expression}
          blinkScale={blinkScale}
          bounceY={bounceY}
          attentionX={attentionX}
          attentionY={attentionY}
        />
        <Eye
          side="right"
          expression={expression}
          blinkScale={blinkScale}
          bounceY={bounceY}
          attentionX={attentionX}
          attentionY={attentionY}
        />
      </View>

      {(expression === "celebrating" || expression === "excited") && (
        <>
          <Animated.View style={[styles.sparkle, { top: 0, left: containerW * 0.22 }, sparkle1Style]}>
            <Svg width={12} height={12} viewBox="0 0 12 12">
              <Polygon points="6,0 7.5,4.5 12,6 7.5,7.5 6,12 4.5,7.5 0,6 4.5,4.5" fill={COLORS.primary} />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.sparkle, { top: 4, right: containerW * 0.12 }, sparkle2Style]}>
            <Svg width={9} height={9} viewBox="0 0 9 9">
              <Polygon points="4.5,0 5.5,3 9,4.5 5.5,6 4.5,9 3.5,6 0,4.5 3.5,3" fill={COLORS.chart2 ?? COLORS.primary} />
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
