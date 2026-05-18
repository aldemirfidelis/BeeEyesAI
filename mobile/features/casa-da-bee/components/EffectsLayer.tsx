import { Group, Circle, RoundedRect, BlurMask } from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { useEffect, useMemo } from "react";
import type { Effect } from "../engine/effects";

const CONFETTI_COLORS = ["#f4b400", "#ec5c5c", "#5da45c", "#5b9bd5", "#b94a8a", "#fbcb45"];

interface Props {
  effects: Effect[];
}

export function EffectsLayer({ effects }: Props) {
  return (
    <Group>
      {effects.map((effect) => {
        if (effect.kind === "particle-burst") {
          return <ParticleBurst key={effect.id} effect={effect} />;
        }
        if (effect.kind === "confetti") {
          return <Confetti key={effect.id} effect={effect} />;
        }
        return null;
      })}
    </Group>
  );
}

function useFadeTimer(durationMs: number) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: durationMs, easing: Easing.out(Easing.cubic) });
  }, [durationMs, t]);
  return t;
}

interface ParticleDef {
  angle: number;
  speed: number;
  size: number;
  delay: number;
}

function makeParticles(count: number): ParticleDef[] {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
    speed: 40 + Math.random() * 50,
    size: 2 + Math.random() * 3,
    delay: Math.random() * 0.15,
  }));
}

function ParticleBurst({ effect }: { effect: Effect }) {
  const duration = effect.payload.durationMs ?? 800;
  const t = useFadeTimer(duration);
  const particles = useMemo(() => makeParticles(effect.payload.count ?? 12), [effect.payload.count]);

  return (
    <Group>
      {particles.map((p, i) => (
        <ParticleDot
          key={i}
          t={t}
          center={{ x: effect.x, y: effect.y }}
          particle={p}
          color={effect.payload.color ?? "#fbe27a"}
        />
      ))}
    </Group>
  );
}

function ParticleDot({
  t,
  center,
  particle,
  color,
}: {
  t: ReturnType<typeof useSharedValue<number>>;
  center: { x: number; y: number };
  particle: ParticleDef;
  color: string;
}) {
  const cx = useDerivedValue(() => {
    const progress = Math.max(0, t.value - particle.delay) / (1 - particle.delay);
    return center.x + Math.cos(particle.angle) * particle.speed * progress;
  });
  const cy = useDerivedValue(() => {
    const progress = Math.max(0, t.value - particle.delay) / (1 - particle.delay);
    return center.y + Math.sin(particle.angle) * particle.speed * progress + progress * progress * 30;
  });
  const opacity = useDerivedValue(() => 1 - t.value);
  const r = useDerivedValue(() => particle.size * (1 - t.value * 0.3));

  return (
    <Group opacity={opacity}>
      <Circle cx={cx} cy={cy} r={r} color={color}>
        <BlurMask blur={1} style="solid" />
      </Circle>
    </Group>
  );
}

interface ConfettiDef {
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

function makeConfetti(count: number): ConfettiDef[] {
  return Array.from({ length: count }, () => ({
    startX: (Math.random() - 0.5) * 40,
    startY: -10,
    vx: (Math.random() - 0.5) * 200,
    vy: -120 - Math.random() * 100,
    size: 4 + Math.random() * 4,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  }));
}

function Confetti({ effect }: { effect: Effect }) {
  const duration = effect.payload.durationMs ?? 1800;
  const t = useFadeTimer(duration);
  const items = useMemo(() => makeConfetti(effect.payload.count ?? 40), [effect.payload.count]);

  return (
    <Group>
      {items.map((c, i) => (
        <ConfettiPiece key={i} t={t} center={{ x: effect.x, y: effect.y }} def={c} />
      ))}
    </Group>
  );
}

function ConfettiPiece({
  t,
  center,
  def,
}: {
  t: ReturnType<typeof useSharedValue<number>>;
  center: { x: number; y: number };
  def: ConfettiDef;
}) {
  const gravity = 350;
  const cx = useDerivedValue(() => center.x + def.startX + def.vx * t.value);
  const cy = useDerivedValue(() => center.y + def.startY + def.vy * t.value + 0.5 * gravity * t.value * t.value);
  const opacity = useDerivedValue(() => Math.max(0, 1 - Math.pow(t.value, 2)));

  return (
    <Group opacity={opacity}>
      <RoundedRect x={cx} y={cy} width={def.size} height={def.size * 1.6} r={1} color={def.color} />
    </Group>
  );
}
