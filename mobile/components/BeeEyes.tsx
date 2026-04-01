import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Polygon, Circle, Rect, G } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { type EyeExpression } from "../stores/uiStore";
import { COLORS } from "../lib/theme";

interface BeeEyesProps {
  expression?: EyeExpression;
  size?: number;
}

const AnimatedG = Animated.createAnimatedComponent(G);

// Hexagon points for eye shape (normalized to 56x56 space)
const HEX_POINTS = "14,0 42,0 56,28 42,56 14,56 0,28";
// Octagon points for pupil (normalized to 28x28 space)
const OCT_POINTS = "8,0 20,0 28,8 28,20 20,28 8,28 0,20 0,8";

function Eye({
  x,
  expression,
  blinkScale,
  bounceY,
}: {
  x: number;
  expression: EyeExpression;
  blinkScale: { value: number };
  bounceY: { value: number };
}) {
  const pupilX = expression === "curious" ? 8 : 0;
  const pupilY =
    expression === "happy" ? 4 :
    expression === "curious" ? -4 :
    expression === "excited" ? -2 : 0;

  const eyeScaleY =
    expression === "sleepy" ? 0.35 :
    expression === "happy" ? 0.55 : 1;

  const blinkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blinkScale.value * eyeScaleY }],
  }));

  const bounceAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounceY.value }],
  }));

  return (
    <Animated.View style={[{ position: "absolute", left: x, top: 0 }, bounceAnimStyle]}>
      <Animated.View style={[{ transformOrigin: "center" }, blinkAnimStyle]}>
        <Svg width={56} height={56} viewBox="0 0 56 56">
          {/* Eye body (hexagon) */}
          <Polygon
            points={HEX_POINTS}
            fill={COLORS.foreground}
          />
          {/* Pupil (octagon) */}
          <G transform={`translate(${14 + pupilX}, ${14 + pupilY})`}>
            <Polygon points={OCT_POINTS} fill={COLORS.primary} />
          </G>
          {/* Shine dot */}
          <Rect
            x={expression === "celebrating" || expression === "excited" ? 8 : 12}
            y={expression === "celebrating" || expression === "excited" ? 8 : 12}
            width={10}
            height={10}
            fill="white"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

export default function BeeEyes({ expression = "neutral", size = 120 }: BeeEyesProps) {
  const blinkScale = useSharedValue(1);
  const bounceY = useSharedValue(0);
  const sparkle1Opacity = useSharedValue(0);
  const sparkle2Opacity = useSharedValue(0);

  // Blink animation
  useEffect(() => {
    const blink = () => {
      blinkScale.value = withSequence(
        withTiming(0.05, { duration: 80 }),
        withTiming(1, { duration: 80 })
      );
    };
    const scheduleNextBlink = () => {
      const delay = 3000 + Math.random() * 2000;
      setTimeout(() => {
        blink();
        scheduleNextBlink();
      }, delay);
    };
    scheduleNextBlink();
  }, []);

  // Celebrating bounce + sparkles
  useEffect(() => {
    if (expression === "celebrating") {
      bounceY.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 300, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      );
      sparkle1Opacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 400 })),
        -1,
        false
      );
      sparkle2Opacity.value = withDelay(
        200,
        withRepeat(
          withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 400 })),
          -1,
          false
        )
      );
    } else {
      cancelAnimation(bounceY);
      cancelAnimation(sparkle1Opacity);
      cancelAnimation(sparkle2Opacity);
      bounceY.value = withTiming(0, { duration: 200 });
      sparkle1Opacity.value = 0;
      sparkle2Opacity.value = 0;
    }
  }, [expression]);

  const scale = size / 120;
  const containerWidth = 120 * scale;
  const containerHeight = 64 * scale;

  const sparkle1Style = useAnimatedStyle(() => ({ opacity: sparkle1Opacity.value }));
  const sparkle2Style = useAnimatedStyle(() => ({ opacity: sparkle2Opacity.value }));

  return (
    <View style={[styles.container, { width: containerWidth, height: containerHeight + 16 }]}>
      <View style={{ transform: [{ scale }], width: 120, height: 64 }}>
        {/* Left eye */}
        <Eye x={0} expression={expression} blinkScale={blinkScale} bounceY={bounceY} />
        {/* Right eye */}
        <Eye x={64} expression={expression} blinkScale={blinkScale} bounceY={bounceY} />
      </View>

      {/* Celebrating sparkles */}
      {expression === "celebrating" && (
        <>
          <Animated.View style={[styles.sparkle, { top: 0, left: containerWidth * 0.25 }, sparkle1Style]}>
            <Svg width={12} height={12} viewBox="0 0 12 12">
              <Polygon points="6,0 7.5,4.5 12,6 7.5,7.5 6,12 4.5,7.5 0,6 4.5,4.5" fill={COLORS.primary} />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.sparkle, { top: 4, right: containerWidth * 0.15 }, sparkle2Style]}>
            <Svg width={8} height={8} viewBox="0 0 8 8">
              <Polygon points="4,0 5,3 8,4 5,5 4,8 3,5 0,4 3,3" fill={COLORS.chart2} />
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
