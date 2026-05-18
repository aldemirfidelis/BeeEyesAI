import { Group, Rect, Circle, RadialGradient, vec, BlurMask } from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import { useEffect, useMemo } from "react";
import { DAY_NIGHT_PRESETS, type TimeOfDay } from "../engine/dayNight";

interface Props {
  width: number;
  height: number;
  timeOfDay: TimeOfDay;
}

interface Particle {
  baseX: number;
  baseY: number;
  amplitudeX: number;
  amplitudeY: number;
  phaseX: number;
  phaseY: number;
  radius: number;
  speedX: number;
  speedY: number;
  alpha: number;
}

function createParticles(count: number, width: number, height: number): Particle[] {
  const list: Particle[] = [];
  for (let i = 0; i < count; i++) {
    list.push({
      baseX: Math.random() * width,
      baseY: Math.random() * height,
      amplitudeX: 12 + Math.random() * 18,
      amplitudeY: 8 + Math.random() * 14,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      radius: 1.5 + Math.random() * 2,
      speedX: 0.4 + Math.random() * 0.4,
      speedY: 0.3 + Math.random() * 0.4,
      alpha: 0.45 + Math.random() * 0.45,
    });
  }
  return list;
}

function ParticleDot({ particle, tick }: { particle: Particle; tick: SharedValue<number> }) {
  const cx = useDerivedValue(
    () => particle.baseX + Math.sin(tick.value * Math.PI * 2 * particle.speedX + particle.phaseX) * particle.amplitudeX,
  );
  const cy = useDerivedValue(
    () => particle.baseY + Math.cos(tick.value * Math.PI * 2 * particle.speedY + particle.phaseY) * particle.amplitudeY,
  );
  return (
    <Group opacity={particle.alpha}>
      <Circle cx={cx} cy={cy} r={particle.radius} color="#fbe27a">
        <BlurMask blur={2} style="solid" />
      </Circle>
    </Group>
  );
}

export function AmbientFX({ width, height, timeOfDay }: Props) {
  const particles = useMemo(() => createParticles(14, width, height), [width, height]);
  const tick = useSharedValue(0);
  const config = DAY_NIGHT_PRESETS[timeOfDay];

  useEffect(() => {
    tick.value = withRepeat(withTiming(1, { duration: 6000 }), -1, false);
  }, [tick]);

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width / 2, height / 2)}
          r={Math.max(width, height) * 0.65}
          colors={config.vignetteColors}
          positions={[0, 0.55, 1]}
        />
      </Rect>
      {/* tint suave da hora */}
      <Rect x={0} y={0} width={width} height={height} color={config.ambientTint} />

      {particles.map((p, i) => (
        <ParticleDot key={`p-${i}`} particle={p} tick={tick} />
      ))}
    </Group>
  );
}
