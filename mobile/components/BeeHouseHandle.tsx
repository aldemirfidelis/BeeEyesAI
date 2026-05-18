import { Canvas, Group, Path, Rect, RoundedRect, Circle, Skia, vec, LinearGradient } from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useEffect, useMemo } from "react";

interface Props {
  size?: number;
  /** Pulsa pra chamar atenção (ex: quando tem pólen pendente) */
  pulse?: boolean;
}

/**
 * Ícone procedural de uma casinha de favo com a Bee aparecendo na porta.
 * Renderizado em Skia (web + mobile).
 *
 * Usado como handle do BeeHouseDrawer e como ícone de atalho do chat.
 */
export function BeeHouseHandle({ size = 48, pulse = false }: Props) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [t]);

  // Bee balança suavemente na porta
  const beeBobY = useDerivedValue(() => Math.sin(t.value * Math.PI * 2) * (size * 0.025));
  const beeY = useDerivedValue(() => size * 0.6 + beeBobY.value);
  const beeX = size * 0.5;
  const beeR = size * 0.12;

  // Antenas mexem
  const antYL = useDerivedValue(() => size * 0.48 + beeBobY.value);
  const antYR = useDerivedValue(() => size * 0.48 + beeBobY.value);

  // Pulse halo (quando ativo)
  const haloR = useDerivedValue(() => (pulse ? size * 0.46 + t.value * size * 0.06 : 0));
  const haloAlpha = useDerivedValue(() => (pulse ? 0.4 - t.value * 0.35 : 0));

  // Path da casa (telhado triangular + corpo retangular)
  const housePath = useMemo(() => {
    const p = Skia.Path.Make();
    // Telhado
    p.moveTo(size * 0.1, size * 0.42);
    p.lineTo(size * 0.5, size * 0.1);
    p.lineTo(size * 0.9, size * 0.42);
    p.close();
    return p;
  }, [size]);

  // Path da porta arqueada
  const doorPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(size * 0.36, size * 0.85);
    p.lineTo(size * 0.36, size * 0.55);
    p.cubicTo(size * 0.36, size * 0.45, size * 0.64, size * 0.45, size * 0.64, size * 0.55);
    p.lineTo(size * 0.64, size * 0.85);
    p.close();
    return p;
  }, [size]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group>
        {/* Halo pulse atras */}
        {pulse && (
          <Group opacity={haloAlpha}>
            <Circle cx={size / 2} cy={size / 2} r={haloR} color="#fbcb45" />
          </Group>
        )}

        {/* Sombra da casa */}
        <Group opacity={0.18}>
          <Rect x={size * 0.12} y={size * 0.88} width={size * 0.76} height={size * 0.04} color="#231809" />
        </Group>

        {/* Corpo da casa (mel/dourado com leve gradiente) */}
        <Rect x={size * 0.18} y={size * 0.42} width={size * 0.64} height={size * 0.48} color="#f5b400">
          <LinearGradient
            start={vec(size / 2, size * 0.42)}
            end={vec(size / 2, size * 0.9)}
            colors={["#ffd95b", "#e09a00"]}
          />
        </Rect>

        {/* Telhado (marrom telha) */}
        <Path path={housePath} color="#7a4f18" />
        {/* Sombra do telhado */}
        <Path path={housePath} color="#5b3a24" opacity={0.3} />

        {/* Janelas redondas em favo */}
        <Circle cx={size * 0.3} cy={size * 0.6} r={size * 0.06} color="#231809" />
        <Circle cx={size * 0.7} cy={size * 0.6} r={size * 0.06} color="#231809" />
        <Circle cx={size * 0.3} cy={size * 0.6} r={size * 0.038} color="#fff4c2" />
        <Circle cx={size * 0.7} cy={size * 0.6} r={size * 0.038} color="#fff4c2" />

        {/* Porta arqueada */}
        <Path path={doorPath} color="#3c2a12" />
        <Path
          path={(() => {
            const p = Skia.Path.Make();
            p.moveTo(size * 0.4, size * 0.88);
            p.lineTo(size * 0.4, size * 0.58);
            p.cubicTo(size * 0.4, size * 0.5, size * 0.6, size * 0.5, size * 0.6, size * 0.58);
            p.lineTo(size * 0.6, size * 0.88);
            p.close();
            return p;
          })()}
          color="#2a1a08"
        />

        {/* Chaminé com fumacinha */}
        <Rect x={size * 0.68} y={size * 0.18} width={size * 0.1} height={size * 0.18} color="#5b3a24" />

        {/* Bee na porta */}
        <Group>
          {/* Asinhas atras (transparentes) */}
          <Circle cx={useDerivedValue(() => beeX - beeR * 1.0)} cy={useDerivedValue(() => beeY.value - beeR * 0.4)} r={beeR * 0.7} color="#e8f4ff" opacity={0.7} />
          <Circle cx={useDerivedValue(() => beeX + beeR * 1.0)} cy={useDerivedValue(() => beeY.value - beeR * 0.4)} r={beeR * 0.7} color="#e8f4ff" opacity={0.7} />

          {/* Antenas */}
          <Rect x={useDerivedValue(() => beeX - beeR * 0.4)} y={antYL} width={1.5} height={beeR * 0.4} color="#22150b" />
          <Rect x={useDerivedValue(() => beeX + beeR * 0.4)} y={antYR} width={1.5} height={beeR * 0.4} color="#22150b" />
          <Circle cx={useDerivedValue(() => beeX - beeR * 0.35)} cy={useDerivedValue(() => antYL.value - 1)} r={beeR * 0.18} color="#22150b" />
          <Circle cx={useDerivedValue(() => beeX + beeR * 0.45)} cy={useDerivedValue(() => antYR.value - 1)} r={beeR * 0.18} color="#22150b" />

          {/* Corpo amarelo */}
          <Circle cx={beeX} cy={beeY} r={beeR} color="#fbcb45" />

          {/* Listras */}
          <Rect x={useDerivedValue(() => beeX - beeR * 0.95)} y={useDerivedValue(() => beeY.value - beeR * 0.3)} width={beeR * 1.9} height={beeR * 0.22} color="#2a1a08" />
          <Rect x={useDerivedValue(() => beeX - beeR * 0.95)} y={useDerivedValue(() => beeY.value + beeR * 0.1)} width={beeR * 1.9} height={beeR * 0.22} color="#2a1a08" />

          {/* Olhinhos */}
          <Circle cx={useDerivedValue(() => beeX - beeR * 0.3)} cy={useDerivedValue(() => beeY.value - beeR * 0.45)} r={beeR * 0.12} color="#22150b" />
          <Circle cx={useDerivedValue(() => beeX + beeR * 0.3)} cy={useDerivedValue(() => beeY.value - beeR * 0.45)} r={beeR * 0.12} color="#22150b" />
        </Group>

        {/* Quadro de moldura geral (cantos arredondados sutis) */}
        <RoundedRect x={0} y={0} width={size} height={size} r={size * 0.16} color="transparent" />
      </Group>
    </Canvas>
  );
}
