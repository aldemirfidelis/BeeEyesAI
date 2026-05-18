import { Canvas, Circle, Group, Rect, RoundedRect, Path, Skia } from "@shopify/react-native-skia";
import { useMemo } from "react";
import type { CatalogItem } from "../engine/catalog";

interface Props {
  size: number;
  hat?: CatalogItem | null;
  accessory?: CatalogItem | null;
  body?: CatalogItem | null;
}

/**
 * Render estatico da Bee com outfit aplicado. Usado em loja, guarda-roupa e previews.
 * Reusa a logica visual do BeeSprite mas sem animacoes.
 */
export function BeePreview({ size, hat, accessory, body }: Props) {
  const cx = size / 2;
  const cy = size / 2 + size * 0.04;
  const bodyR = size * 0.32;
  const bodyColor = (body?.data.color as string | undefined) ?? "#fbcb45";
  const bodyHighlight = (body?.data.highlight as string | undefined) ?? "#fff4c2";
  const isRainbow = body?.data.rainbow === true;

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group>
        {/* Sombra */}
        <Group opacity={0.32}>
          <Circle cx={cx} cy={cy + bodyR * 0.78} r={bodyR * 0.72} color="#1a0e02" />
        </Group>

        {/* Antenas */}
        <Circle cx={cx - bodyR * 0.35} cy={cy - bodyR * 0.85} r={bodyR * 0.05} color="#22150b" />
        <Circle cx={cx + bodyR * 0.35} cy={cy - bodyR * 0.85} r={bodyR * 0.05} color="#22150b" />
        <Circle cx={cx - bodyR * 0.35} cy={cy - bodyR * 1.15} r={bodyR * 0.08} color="#22150b" />
        <Circle cx={cx + bodyR * 0.35} cy={cy - bodyR * 1.15} r={bodyR * 0.08} color="#22150b" />

        {/* Asas */}
        <Group opacity={0.7}>
          <Circle cx={cx - bodyR * 0.95} cy={cy - bodyR * 0.65} r={bodyR * 0.62} color="#e8f4ff" />
          <Circle cx={cx + bodyR * 0.95} cy={cy - bodyR * 0.65} r={bodyR * 0.62} color="#e8f4ff" />
        </Group>

        {/* Ferrao */}
        <Circle cx={cx} cy={cy + bodyR * 0.95} r={bodyR * 0.12} color="#22150b" />

        {/* Corpo */}
        {isRainbow ? (
          <>
            <Circle cx={cx} cy={cy} r={bodyR} color="#fb6f8c" />
            <Circle cx={cx} cy={cy} r={bodyR * 0.85} color="#fbcb45" />
            <Circle cx={cx} cy={cy} r={bodyR * 0.7} color="#7fc572" />
            <Circle cx={cx} cy={cy} r={bodyR * 0.55} color="#5b9bd5" />
            <Circle cx={cx} cy={cy} r={bodyR * 0.4} color="#b687d8" />
          </>
        ) : (
          <Circle cx={cx} cy={cy} r={bodyR} color={bodyColor} />
        )}

        {/* Highlight */}
        <Group opacity={0.4}>
          <Circle cx={cx - bodyR * 0.35} cy={cy - bodyR * 0.4} r={bodyR * 0.22} color={bodyHighlight} />
        </Group>

        {/* Listras */}
        {!isRainbow && (
          <>
            <Rect x={cx - bodyR * 0.78} y={cy - bodyR * 0.25} width={bodyR * 1.56} height={bodyR * 0.18} color="#2a1a08" />
            <Rect x={cx - bodyR * 0.78} y={cy + bodyR * 0.05} width={bodyR * 1.56} height={bodyR * 0.18} color="#2a1a08" />
            <Rect x={cx - bodyR * 0.78} y={cy + bodyR * 0.35} width={bodyR * 1.56} height={bodyR * 0.18} color="#2a1a08" />
          </>
        )}

        {/* Bochechas */}
        <Group opacity={0.7}>
          <Circle cx={cx - bodyR * 0.45} cy={cy - bodyR * 0.05} r={bodyR * 0.14} color="#f4838b" />
          <Circle cx={cx + bodyR * 0.45} cy={cy - bodyR * 0.05} r={bodyR * 0.14} color="#f4838b" />
        </Group>

        {/* Olhos (cobertos por accessory se necessario) */}
        {!accessoryCoversEyes(accessory) && (
          <>
            <Circle cx={cx - bodyR * 0.32} cy={cy - bodyR * 0.35} r={bodyR * 0.12} color="#22150b" />
            <Circle cx={cx + bodyR * 0.32} cy={cy - bodyR * 0.35} r={bodyR * 0.12} color="#22150b" />
            <Circle cx={cx - bodyR * 0.28} cy={cy - bodyR * 0.4} r={bodyR * 0.05} color="#ffffff" />
            <Circle cx={cx + bodyR * 0.36} cy={cy - bodyR * 0.4} r={bodyR * 0.05} color="#ffffff" />
          </>
        )}

        {/* Boquinha */}
        <RoundedRect x={cx - bodyR * 0.16} y={cy + bodyR * 0.18} width={bodyR * 0.32} height={bodyR * 0.14} r={bodyR * 0.08} color="#22150b" />

        {/* Accessory (oculos, mascara, etc) */}
        {renderAccessory(accessory, cx, cy, bodyR)}

        {/* Hat por cima de tudo */}
        {renderHat(hat, cx, cy, bodyR)}
      </Group>
    </Canvas>
  );
}

function accessoryCoversEyes(acc?: CatalogItem | null): boolean {
  if (!acc) return false;
  const v = acc.data.variant as string | undefined;
  return v === "sunglasses" || v === "reading" || v === "mask";
}

function renderAccessory(acc: CatalogItem | null | undefined, cx: number, cy: number, r: number) {
  if (!acc) return null;
  const v = acc.data.variant as string | undefined;
  const color = (acc.data.color as string | undefined) ?? "#2a1a08";

  if (v === "sunglasses" || v === "reading") {
    return (
      <Group>
        <RoundedRect x={cx - r * 0.6} y={cy - r * 0.45} width={r * 0.4} height={r * 0.3} r={r * 0.12} color={color} />
        <RoundedRect x={cx + r * 0.2} y={cy - r * 0.45} width={r * 0.4} height={r * 0.3} r={r * 0.12} color={color} />
        <Rect x={cx - r * 0.2} y={cy - r * 0.35} width={r * 0.4} height={r * 0.04} color={color} />
        {v === "reading" && (
          <>
            {/* Lentes mais claras */}
            <RoundedRect x={cx - r * 0.55} y={cy - r * 0.4} width={r * 0.3} height={r * 0.2} r={r * 0.08} color="rgba(220, 230, 255, 0.6)" />
            <RoundedRect x={cx + r * 0.25} y={cy - r * 0.4} width={r * 0.3} height={r * 0.2} r={r * 0.08} color="rgba(220, 230, 255, 0.6)" />
          </>
        )}
      </Group>
    );
  }

  if (v === "bow") {
    return (
      <Group>
        <Circle cx={cx - r * 0.65} cy={cy - r * 0.75} r={r * 0.16} color={color} />
        <Circle cx={cx - r * 0.85} cy={cy - r * 0.75} r={r * 0.12} color={color} />
        <Circle cx={cx - r * 0.5} cy={cy - r * 0.65} r={r * 0.05} color="#ffffff" />
      </Group>
    );
  }

  if (v === "headphone") {
    return (
      <Group>
        {/* Arco por cima */}
        <Path
          path={(() => {
            const p = Skia.Path.Make();
            p.moveTo(cx - r, cy - r * 0.5);
            p.cubicTo(cx - r, cy - r * 1.3, cx + r, cy - r * 1.3, cx + r, cy - r * 0.5);
            return p;
          })()}
          color={color}
          style="stroke"
          strokeWidth={r * 0.12}
        />
        {/* Earcups */}
        <Circle cx={cx - r * 0.95} cy={cy - r * 0.3} r={r * 0.22} color={color} />
        <Circle cx={cx + r * 0.95} cy={cy - r * 0.3} r={r * 0.22} color={color} />
      </Group>
    );
  }

  if (v === "monocle") {
    return (
      <Group>
        <Circle cx={cx + r * 0.32} cy={cy - r * 0.35} r={r * 0.2} color="rgba(220, 200, 100, 0.5)" />
        <Circle cx={cx + r * 0.32} cy={cy - r * 0.35} r={r * 0.2} color={color} style="stroke" strokeWidth={r * 0.05} />
      </Group>
    );
  }

  if (v === "mask") {
    const accent = (acc.data.accent as string | undefined) ?? color;
    return (
      <Group>
        <RoundedRect x={cx - r * 0.7} y={cy - r * 0.5} width={r * 1.4} height={r * 0.4} r={r * 0.15} color={color} />
        {/* Recortes dos olhos */}
        <Circle cx={cx - r * 0.32} cy={cy - r * 0.32} r={r * 0.12} color={accent} />
        <Circle cx={cx + r * 0.32} cy={cy - r * 0.32} r={r * 0.12} color={accent} />
      </Group>
    );
  }

  return null;
}

function renderHat(hat: CatalogItem | null | undefined, cx: number, cy: number, r: number) {
  if (!hat) return null;
  const v = hat.data.variant as string | undefined;
  if (!v || v === "none") return null;
  const color = (hat.data.color as string | undefined) ?? "#2a1a08";
  const accent = (hat.data.accent as string | undefined) ?? color;

  if (v === "crown") {
    return (
      <Group>
        {/* base */}
        <Rect x={cx - r * 0.65} y={cy - r * 1.45} width={r * 1.3} height={r * 0.25} color={color} />
        {/* picos */}
        <Path
          path={(() => {
            const p = Skia.Path.Make();
            p.moveTo(cx - r * 0.65, cy - r * 1.45);
            p.lineTo(cx - r * 0.4, cy - r * 1.85);
            p.lineTo(cx - r * 0.15, cy - r * 1.5);
            p.lineTo(cx, cy - r * 1.95);
            p.lineTo(cx + r * 0.15, cy - r * 1.5);
            p.lineTo(cx + r * 0.4, cy - r * 1.85);
            p.lineTo(cx + r * 0.65, cy - r * 1.45);
            p.close();
            return p;
          })()}
          color={color}
        />
        {/* gemas */}
        <Circle cx={cx} cy={cy - r * 1.6} r={r * 0.1} color={accent} />
      </Group>
    );
  }

  if (v === "cap") {
    return (
      <Group>
        <RoundedRect x={cx - r * 0.75} y={cy - r * 1.45} width={r * 1.5} height={r * 0.5} r={r * 0.3} color={color} />
        {/* aba */}
        <RoundedRect x={cx - r * 0.2} y={cy - r * 1.0} width={r * 1.1} height={r * 0.18} r={r * 0.08} color={color} />
      </Group>
    );
  }

  if (v === "top") {
    return (
      <Group>
        <Rect x={cx - r * 0.85} y={cy - r * 1.0} width={r * 1.7} height={r * 0.12} color={color} />
        <Rect x={cx - r * 0.55} y={cy - r * 1.85} width={r * 1.1} height={r * 0.85} color={color} />
        <Rect x={cx - r * 0.55} y={cy - r * 1.4} width={r * 1.1} height={r * 0.12} color={accent} />
      </Group>
    );
  }

  if (v === "chef") {
    return (
      <Group>
        {/* base cilindrica */}
        <Rect x={cx - r * 0.55} y={cy - r * 1.2} width={r * 1.1} height={r * 0.3} color={color} />
        {/* topo redondo (chef hat puffy) */}
        <Circle cx={cx} cy={cy - r * 1.45} r={r * 0.7} color={color} />
        <Circle cx={cx - r * 0.35} cy={cy - r * 1.5} r={r * 0.35} color={color} />
        <Circle cx={cx + r * 0.35} cy={cy - r * 1.5} r={r * 0.35} color={color} />
      </Group>
    );
  }

  if (v === "bandana") {
    return (
      <Group>
        {/* corpo da bandana */}
        <Path
          path={(() => {
            const p = Skia.Path.Make();
            p.moveTo(cx - r * 0.7, cy - r * 1.05);
            p.lineTo(cx + r * 0.7, cy - r * 1.05);
            p.lineTo(cx + r * 0.8, cy - r * 0.7);
            p.lineTo(cx - r * 0.8, cy - r * 0.7);
            p.close();
            return p;
          })()}
          color={color}
        />
        {/* no atrás */}
        <Path
          path={(() => {
            const p = Skia.Path.Make();
            p.moveTo(cx + r * 0.75, cy - r * 0.95);
            p.lineTo(cx + r * 1.2, cy - r * 0.75);
            p.lineTo(cx + r * 1.0, cy - r * 0.4);
            p.lineTo(cx + r * 0.65, cy - r * 0.6);
            p.close();
            return p;
          })()}
          color={color}
        />
      </Group>
    );
  }

  if (v === "flower") {
    return (
      <Group>
        {/* flor central */}
        <Circle cx={cx - r * 0.5} cy={cy - r * 1.15} r={r * 0.18} color={color} />
        <Circle cx={cx - r * 0.3} cy={cy - r * 1.35} r={r * 0.18} color={color} />
        <Circle cx={cx - r * 0.65} cy={cy - r * 1.35} r={r * 0.18} color={color} />
        <Circle cx={cx - r * 0.5} cy={cy - r * 1.55} r={r * 0.18} color={color} />
        <Circle cx={cx - r * 0.5} cy={cy - r * 1.35} r={r * 0.12} color={accent} />
        {/* folhinha */}
        <Circle cx={cx + r * 0.35} cy={cy - r * 1.05} r={r * 0.16} color={accent} />
      </Group>
    );
  }

  if (v === "halo") {
    return (
      <Group>
        <Circle cx={cx} cy={cy - r * 1.2} r={r * 0.6} color={color} style="stroke" strokeWidth={r * 0.13} />
        <Circle cx={cx} cy={cy - r * 1.2} r={r * 0.6} color={color} style="stroke" strokeWidth={r * 0.06} opacity={0.5} />
      </Group>
    );
  }

  return null;
}
