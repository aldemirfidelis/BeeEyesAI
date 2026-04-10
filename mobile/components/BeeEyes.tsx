import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { type EyeExpression } from "../stores/uiStore";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

interface BeeEyesProps {
  expression?: EyeExpression;
  size?: number;
  attentionX?: number;
  attentionY?: number;
}

const EW = 82;
const EH = 88;
const CX = EW / 2;
const CY = EH / 2;
const IRIS_R = 22;
const PUPIL_RX = 13;
const PUPIL_RY = 17;
const LASH_H = 48;

const EXPR: Record<
  EyeExpression,
  { scaleY: number; pupilX: number; pupilY: number; pupilScale: number }
> = {
  neutral: { scaleY: 1, pupilX: 0, pupilY: 0, pupilScale: 1 },
  happy: { scaleY: 0.72, pupilX: 0, pupilY: 2, pupilScale: 0.95 },
  curious: { scaleY: 1.08, pupilX: 5, pupilY: -3, pupilScale: 1.08 },
  excited: { scaleY: 1.14, pupilX: 0, pupilY: -2, pupilScale: 1.18 },
  sleepy: { scaleY: 0.34, pupilX: 0, pupilY: 3, pupilScale: 0.84 },
  celebrating: { scaleY: 1.1, pupilX: 0, pupilY: -3, pupilScale: 1.12 },
};

const LASH_PATHS = [
  "M 10,34 Q -2,20 -6,10",
  "M 18,42 Q 8,26  6,14",
  "M 27,46 Q 20,30 20,18",
  "M 41,48 Q 38,32 40,18",
  "M 55,46 Q 62,30 62,18",
  "M 64,42 Q 74,26 76,14",
  "M 72,34 Q 84,20 88,10",
];

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

function Eye({
  side,
  expression,
  blinkScaleY,
  bounceY,
  roamX,
  roamY,
  focusX,
  focusY,
  pupilScale,
}: {
  side: "left" | "right";
  expression: EyeExpression;
  blinkScaleY: SharedValue<number>;
  bounceY: SharedValue<number>;
  roamX: SharedValue<number>;
  roamY: SharedValue<number>;
  focusX: SharedValue<number>;
  focusY: SharedValue<number>;
  pupilScale: SharedValue<number>;
}) {
  const cfg = EXPR[expression];
  const tilt = side === "left" ? -3 : 3;
  const baseX = CX + cfg.pupilX;
  const baseY = CY + cfg.pupilY;
  const uid = side === "left" ? "L" : "R";
  const mirror = side === "right" ? `scale(-1, 1) translate(-${EW}, 0)` : undefined;

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounceY.value }],
  }));

  const blinkStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt}deg` }, { scaleY: blinkScaleY.value * cfg.scaleY }],
  }));

  const irisAnimatedProps = useAnimatedProps(() => ({
    cx: baseX + clamp(roamX.value + focusX.value, -8, 8),
    cy: baseY + clamp(roamY.value + focusY.value, -6, 6),
  }));

  const pupilAnimatedProps = useAnimatedProps(() => ({
    cx: baseX + clamp(roamX.value + focusX.value, -8, 8),
    cy: baseY + clamp(roamY.value + focusY.value, -6, 6),
    rx: PUPIL_RX * cfg.pupilScale * pupilScale.value,
    ry: PUPIL_RY * cfg.pupilScale * pupilScale.value,
  }));

  const highlightAnimatedProps = useAnimatedProps(() => ({
    cx: baseX + clamp(roamX.value + focusX.value, -8, 8) - IRIS_R * 0.36,
    cy: baseY + clamp(roamY.value + focusY.value, -6, 6) - IRIS_R * 0.38,
  }));

  return (
    <Animated.View style={bounceStyle}>
      <Svg
        width={EW}
        height={LASH_H}
        viewBox={`0 0 ${EW} ${LASH_H}`}
        style={{ marginBottom: -2 }}
      >
        <G stroke="#1A1A1A" strokeWidth={3.5} strokeLinecap="round" fill="none" transform={mirror}>
          {LASH_PATHS.map((d, index) => (
            <Path key={index} d={d} />
          ))}
        </G>
      </Svg>

      <Animated.View style={blinkStyle}>
        <Svg width={EW} height={EH} viewBox={`0 0 ${EW} ${EH}`}>
          <Defs>
            <RadialGradient id={`iris${uid}`} cx="38%" cy="35%" r="60%" fx="38%" fy="35%">
              <Stop offset="0%" stopColor="#C8E8DC" />
              <Stop offset="45%" stopColor="#8CC4A8" />
              <Stop offset="100%" stopColor="#5FA88A" />
            </RadialGradient>

            <ClipPath id={`oval${uid}`}>
              <Ellipse cx={CX} cy={CY} rx={EW / 2 - 2} ry={EH / 2 - 2} />
            </ClipPath>
          </Defs>

          <Ellipse cx={CX} cy={CY} rx={EW / 2 - 1.5} ry={EH / 2 - 1.5} fill="white" />

          <G clipPath={`url(#oval${uid})`}>
            <AnimatedCircle animatedProps={irisAnimatedProps} cy={baseY} r={IRIS_R} fill={`url(#iris${uid})`} />
            <AnimatedEllipse animatedProps={pupilAnimatedProps} fill="#0D0D0D" />
            <AnimatedEllipse animatedProps={highlightAnimatedProps} rx={5} ry={7} fill="white" opacity={0.95} />
          </G>

          <Ellipse
            cx={CX}
            cy={CY}
            rx={EW / 2 - 1.5}
            ry={EH / 2 - 1.5}
            fill="none"
            stroke="#1A1A1A"
            strokeWidth={3}
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
  const blinkScaleY = useSharedValue(1);
  const bounceY = useSharedValue(0);
  const sparkle1Opacity = useSharedValue(0);
  const sparkle2Opacity = useSharedValue(0);
  const sparkle3Opacity = useSharedValue(0);
  const roamX = useSharedValue(0);
  const roamY = useSharedValue(0);
  const focusX = useSharedValue(0);
  const focusY = useSharedValue(0);
  const pupilScale = useSharedValue(EXPR[expression].pupilScale);
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 3000;
      blinkTimeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        blinkScaleY.value = withSequence(
          withTiming(0.05, { duration: 85, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 90, easing: Easing.in(Easing.quad) }),
        );
        scheduleBlink();
      }, delay);
    };

    scheduleBlink();
    return () => {
      cancelled = true;
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
    };
  }, [blinkScaleY]);

  useEffect(() => {
    let cancelled = false;

    const scheduleRoam = () => {
      const delay = 1600 + Math.random() * 1800;
      roamTimeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        roamX.value = withTiming((Math.random() - 0.5) * 6, { duration: 420 });
        roamY.value = withTiming((Math.random() - 0.5) * 4, { duration: 420 });
        scheduleRoam();
      }, delay);
    };

    scheduleRoam();
    return () => {
      cancelled = true;
      if (roamTimeoutRef.current) clearTimeout(roamTimeoutRef.current);
    };
  }, [roamX, roamY]);

  useEffect(() => {
    focusX.value = withTiming(clamp(attentionX * 7, -7, 7), { duration: 180 });
    focusY.value = withTiming(clamp(attentionY * 5, -5, 5), { duration: 180 });
  }, [attentionX, attentionY, focusX, focusY]);

  useEffect(() => {
    pupilScale.value = withTiming(EXPR[expression].pupilScale, { duration: 220 });

    if (expression === "celebrating" || expression === "excited") {
      bounceY.value = withRepeat(
        withSequence(
          withTiming(-10, { duration: 280, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
      sparkle1Opacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 350 }), withTiming(0, { duration: 350 })),
        -1,
        false,
      );
      sparkle2Opacity.value = withDelay(
        180,
        withRepeat(
          withSequence(withTiming(1, { duration: 350 }), withTiming(0, { duration: 350 })),
          -1,
          false,
        ),
      );
      sparkle3Opacity.value = withDelay(
        360,
        withRepeat(
          withSequence(withTiming(1, { duration: 350 }), withTiming(0, { duration: 350 })),
          -1,
          false,
        ),
      );
      return;
    }

    cancelAnimation(bounceY);
    cancelAnimation(sparkle1Opacity);
    cancelAnimation(sparkle2Opacity);
    cancelAnimation(sparkle3Opacity);
    bounceY.value = withSpring(0, { damping: 12 });
    sparkle1Opacity.value = withTiming(0, { duration: 200 });
    sparkle2Opacity.value = withTiming(0, { duration: 200 });
    sparkle3Opacity.value = withTiming(0, { duration: 200 });
  }, [
    bounceY,
    expression,
    pupilScale,
    sparkle1Opacity,
    sparkle2Opacity,
    sparkle3Opacity,
  ]);

  const scale = size / 140;
  const containerW = (EW * 2 + 20) * scale;
  const containerH = (EH + LASH_H + 4) * scale;

  const sparkle1Style = useAnimatedStyle(() => ({ opacity: sparkle1Opacity.value }));
  const sparkle2Style = useAnimatedStyle(() => ({ opacity: sparkle2Opacity.value }));
  const sparkle3Style = useAnimatedStyle(() => ({ opacity: sparkle3Opacity.value }));

  return (
    <View style={[styles.container, { width: containerW, height: containerH }]}>
      <View
        style={{
          transform: [{ scale }],
          width: EW * 2 + 20,
          height: EH + LASH_H + 4,
          flexDirection: "row",
          gap: 20,
          alignItems: "flex-end",
        }}
      >
        <Eye
          side="left"
          expression={expression}
          blinkScaleY={blinkScaleY}
          bounceY={bounceY}
          roamX={roamX}
          roamY={roamY}
          focusX={focusX}
          focusY={focusY}
          pupilScale={pupilScale}
        />
        <Eye
          side="right"
          expression={expression}
          blinkScaleY={blinkScaleY}
          bounceY={bounceY}
          roamX={roamX}
          roamY={roamY}
          focusX={focusX}
          focusY={focusY}
          pupilScale={pupilScale}
        />
      </View>

      {(expression === "celebrating" || expression === "excited") && (
        <>
          <Animated.View style={[styles.sparkle, { top: -2, left: containerW * 0.18 }, sparkle1Style]}>
            <Svg width={14} height={14} viewBox="0 0 14 14">
              <Circle cx={7} cy={7} r={5} fill="#8CC4A8" />
              <Circle cx={7} cy={7} r={2} fill="white" opacity={0.7} />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.sparkle, { top: 4, right: containerW * 0.14 }, sparkle2Style]}>
            <Svg width={10} height={10} viewBox="0 0 10 10">
              <Circle cx={5} cy={5} r={4} fill="#5FA88A" />
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
