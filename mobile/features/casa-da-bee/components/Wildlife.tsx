import { Group, Circle, BlurMask } from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import { useEffect, useMemo } from "react";

interface Props {
  width: number;
  height: number;
}

interface Butterfly {
  baseX: number;
  baseY: number;
  ampX: number;
  ampY: number;
  speedX: number;
  speedY: number;
  phaseX: number;
  phaseY: number;
  size: number;
  color: string;
}

const COLORS = ["#f4838b", "#9ccaff", "#fbe27a", "#b687d8", "#7fc572"];

function createButterflies(count: number, width: number, height: number): Butterfly[] {
  return Array.from({ length: count }, () => ({
    baseX: width * (0.15 + Math.random() * 0.7),
    baseY: height * (0.2 + Math.random() * 0.6),
    ampX: 40 + Math.random() * 60,
    ampY: 25 + Math.random() * 40,
    speedX: 0.25 + Math.random() * 0.3,
    speedY: 0.3 + Math.random() * 0.4,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    size: 3 + Math.random() * 2.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
}

export function Wildlife({ width, height }: Props) {
  const butterflies = useMemo(() => createButterflies(4, width, height), [width, height]);
  const tick = useSharedValue(0);
  const flutter = useSharedValue(0);

  useEffect(() => {
    tick.value = withRepeat(withTiming(1, { duration: 12000 }), -1, false);
    flutter.value = withRepeat(withTiming(1, { duration: 220 }), -1, true);
  }, [flutter, tick]);

  return (
    <Group>
      {butterflies.map((b, i) => (
        <Butterfly key={`bf-${i}`} butterfly={b} tick={tick} flutter={flutter} />
      ))}
    </Group>
  );
}

function Butterfly({
  butterfly,
  tick,
  flutter,
}: {
  butterfly: Butterfly;
  tick: SharedValue<number>;
  flutter: SharedValue<number>;
}) {
  const cx = useDerivedValue(
    () => butterfly.baseX + Math.sin(tick.value * Math.PI * 2 * butterfly.speedX + butterfly.phaseX) * butterfly.ampX,
  );
  const cy = useDerivedValue(
    () => butterfly.baseY + Math.cos(tick.value * Math.PI * 2 * butterfly.speedY + butterfly.phaseY) * butterfly.ampY,
  );

  // Asas pulsam rapido
  const wingR = useDerivedValue(() => butterfly.size * (0.7 + Math.abs(Math.sin(flutter.value * Math.PI * 2)) * 0.5));
  const leftX = useDerivedValue(() => cx.value - butterfly.size * 0.7);
  const rightX = useDerivedValue(() => cx.value + butterfly.size * 0.7);

  return (
    <Group opacity={0.85}>
      {/* Asas */}
      <Circle cx={leftX} cy={cy} r={wingR} color={butterfly.color}>
        <BlurMask blur={0.5} style="solid" />
      </Circle>
      <Circle cx={rightX} cy={cy} r={wingR} color={butterfly.color}>
        <BlurMask blur={0.5} style="solid" />
      </Circle>
      {/* Corpo */}
      <Circle cx={cx} cy={cy} r={butterfly.size * 0.32} color="#2a1a08" />
    </Group>
  );
}
