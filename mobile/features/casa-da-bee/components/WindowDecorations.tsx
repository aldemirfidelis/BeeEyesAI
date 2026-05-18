import { Group, Circle, Rect, RadialGradient, vec, BlurMask } from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useEffect, useMemo } from "react";
import type { TimeOfDay } from "../engine/dayNight";

interface Props {
  tileSize: number;
  offsetX: number;
  offsetY: number;
  mapWidth: number;
  timeOfDay: TimeOfDay;
}

/**
 * Renderiza 2 janelas na parede de cima da casa, mostrando céu animado
 * (sol/lua/estrelas) conforme a hora do dia.
 */
export function WindowDecorations({ tileSize, offsetX, offsetY, mapWidth, timeOfDay }: Props) {
  // Posicoes das janelas — na parede de cima (y=0), x=4 e x=11
  const windows = useMemo(
    () => [
      { x: 4, y: 0 },
      { x: 11, y: 0 },
    ].filter((w) => w.x < mapWidth),
    [mapWidth],
  );

  return (
    <Group>
      {windows.map((w, i) => (
        <Window
          key={`win-${i}`}
          px={offsetX + w.x * tileSize}
          py={offsetY + w.y * tileSize}
          tileSize={tileSize}
          timeOfDay={timeOfDay}
        />
      ))}
    </Group>
  );
}

function Window({ px, py, tileSize, timeOfDay }: { px: number; py: number; tileSize: number; timeOfDay: TimeOfDay }) {
  const sky = getSkyColors(timeOfDay);
  const innerPad = tileSize * 0.13;

  return (
    <Group>
      {/* Moldura externa (madeira escura) */}
      <Rect x={px + innerPad - 2} y={py + innerPad - 2} width={tileSize - innerPad * 2 + 4} height={tileSize - innerPad * 2 + 4} color="#3c2a12" />

      {/* Céu de fundo com gradiente */}
      <Rect x={px + innerPad} y={py + innerPad} width={tileSize - innerPad * 2} height={tileSize - innerPad * 2}>
        <RadialGradient
          c={vec(px + tileSize / 2, py + tileSize * 0.7)}
          r={tileSize * 0.9}
          colors={sky.gradient}
          positions={[0, 1]}
        />
      </Rect>

      {/* Sol/Lua */}
      {timeOfDay === "night" || timeOfDay === "dusk" ? (
        <Moon px={px} py={py} tileSize={tileSize} timeOfDay={timeOfDay} />
      ) : (
        <Sun px={px} py={py} tileSize={tileSize} timeOfDay={timeOfDay} />
      )}

      {/* Estrelas à noite */}
      {timeOfDay === "night" && (
        <>
          <Rect x={px + tileSize * 0.25} y={py + tileSize * 0.25} width={1.5} height={1.5} color="#fff" />
          <Rect x={px + tileSize * 0.65} y={py + tileSize * 0.3} width={1.5} height={1.5} color="#fff" />
          <Rect x={px + tileSize * 0.45} y={py + tileSize * 0.4} width={2} height={2} color="#fbe27a" />
          <Rect x={px + tileSize * 0.75} y={py + tileSize * 0.5} width={1.5} height={1.5} color="#fff" />
          <Rect x={px + tileSize * 0.3} y={py + tileSize * 0.55} width={1.5} height={1.5} color="#fff" />
        </>
      )}

      {/* Cruz de divisão (madeira clara) */}
      <Rect x={px + tileSize / 2 - 1} y={py + innerPad} width={2} height={tileSize - innerPad * 2} color="#7a5230" />
      <Rect x={px + innerPad} y={py + tileSize / 2 - 1} width={tileSize - innerPad * 2} height={2} color="#7a5230" />

      {/* Brilho interno (vidro) */}
      <Rect x={px + innerPad + 1} y={py + innerPad + 1} width={tileSize * 0.15} height={tileSize * 0.15} color="rgba(255, 255, 255, 0.18)" />
    </Group>
  );
}

function Sun({ px, py, tileSize, timeOfDay }: { px: number; py: number; tileSize: number; timeOfDay: TimeOfDay }) {
  // Sol pulsa suavemente
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = withRepeat(withTiming(1, { duration: 2400 }), -1, true);
  }, [phase]);

  // Posição varia com a hora do dia
  const positions: Record<TimeOfDay, { x: number; y: number }> = {
    dawn: { x: 0.25, y: 0.5 },
    morning: { x: 0.35, y: 0.35 },
    noon: { x: 0.5, y: 0.25 },
    afternoon: { x: 0.65, y: 0.35 },
    dusk: { x: 0.75, y: 0.5 },
    night: { x: 0.5, y: 0.5 },
  };
  const pos = positions[timeOfDay] ?? positions.noon;

  const cx = px + tileSize * pos.x;
  const cy = py + tileSize * pos.y;
  const sunR = useDerivedValue(() => tileSize * 0.12 + phase.value * tileSize * 0.015);
  const haloR = useDerivedValue(() => tileSize * 0.2 + phase.value * tileSize * 0.04);

  const color = timeOfDay === "dawn" ? "#ff9358" : timeOfDay === "afternoon" ? "#ffb84d" : "#ffe27a";

  return (
    <Group>
      <Group opacity={0.55}>
        <Circle cx={cx} cy={cy} r={haloR} color={color}>
          <BlurMask blur={4} style="solid" />
        </Circle>
      </Group>
      <Circle cx={cx} cy={cy} r={sunR} color={color} />
    </Group>
  );
}

function Moon({ px, py, tileSize, timeOfDay }: { px: number; py: number; tileSize: number; timeOfDay: TimeOfDay }) {
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = withRepeat(withTiming(1, { duration: 3600 }), -1, true);
  }, [phase]);

  const cx = px + tileSize * (timeOfDay === "dusk" ? 0.3 : 0.6);
  const cy = py + tileSize * (timeOfDay === "dusk" ? 0.45 : 0.35);
  const moonR = useDerivedValue(() => tileSize * 0.11 + phase.value * tileSize * 0.01);
  const haloR = useDerivedValue(() => tileSize * 0.18 + phase.value * tileSize * 0.03);

  return (
    <Group>
      <Group opacity={0.5}>
        <Circle cx={cx} cy={cy} r={haloR} color="#dde4ee">
          <BlurMask blur={4} style="solid" />
        </Circle>
      </Group>
      <Circle cx={cx} cy={cy} r={moonR} color="#f4f0d8" />
      {/* Cratera */}
      <Circle cx={cx + tileSize * 0.03} cy={cy - tileSize * 0.02} r={tileSize * 0.025} color="#d6cea3" />
    </Group>
  );
}

function getSkyColors(t: TimeOfDay): { gradient: [string, string] } {
  switch (t) {
    case "dawn":
      return { gradient: ["#ffaa68", "#ffd9a8"] };
    case "morning":
      return { gradient: ["#87ceeb", "#cfeaf8"] };
    case "noon":
      return { gradient: ["#5eb0e0", "#a8d5f0"] };
    case "afternoon":
      return { gradient: ["#7fb8d8", "#ffd9a8"] };
    case "dusk":
      return { gradient: ["#e6735a", "#4a3478"] };
    case "night":
      return { gradient: ["#0c1024", "#1a1f3c"] };
    default:
      return { gradient: ["#5eb0e0", "#a8d5f0"] };
  }
}
