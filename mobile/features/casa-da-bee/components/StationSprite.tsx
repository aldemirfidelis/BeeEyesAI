import { Group, RoundedRect, Rect, Circle, Path, Skia } from "@shopify/react-native-skia";
import { useMemo } from "react";
import type { Station } from "../engine/types";
import type { CatalogItem } from "../engine/catalog";

interface Props {
  station: Station;
  tileSize: number;
  offsetX: number;
  offsetY: number;
  bedVariant?: CatalogItem | null;
  deskVariant?: CatalogItem | null;
  rugVariant?: CatalogItem | null;
}

const BASE_COLORS = {
  bed: { primary: "#7099d0", secondary: "#dde4ee", accent: "#3e5380" },
  desk: { primary: "#5a4731", secondary: "#a2cdff", accent: "#3f3522" },
  agenda: { primary: "#d9c45a", secondary: "#ffffff", accent: "#7d6a1f" },
  training: { primary: "#cf6c55", secondary: "#fae4ce", accent: "#84352c" },
  wardrobe: { primary: "#8b5e3f", secondary: "#f3d28d", accent: "#503521" },
  plant: { primary: "#5da45c", secondary: "#a0e07f", accent: "#385f33" },
} as const;

export function StationSprite({ station, tileSize, offsetX, offsetY, bedVariant, deskVariant, rugVariant }: Props) {
  const px = offsetX + station.position.x * tileSize;
  const py = offsetY + station.position.y * tileSize;

  // Decide qual renderer chamar baseado em station.id + variant
  if (station.id === "bed") {
    return <BedSprite px={px} py={py} tileSize={tileSize} variant={bedVariant} />;
  }
  if (station.id === "desk") {
    return <DeskSprite px={px} py={py} tileSize={tileSize} variant={deskVariant} />;
  }
  if (station.id === "agenda") return <AgendaSprite px={px} py={py} tileSize={tileSize} />;
  if (station.id === "training") return <TrainingSprite px={px} py={py} tileSize={tileSize} />;
  if (station.id === "wardrobe") return <WardrobeSprite px={px} py={py} tileSize={tileSize} />;
  if (station.id === "plant") return <PlantSprite px={px} py={py} tileSize={tileSize} />;
  return null;
}

// ============ BED ============
function BedSprite({ px, py, tileSize, variant }: { px: number; py: number; tileSize: number; variant?: CatalogItem | null }) {
  const id = variant?.id ?? "bed-default";
  const pad = tileSize * 0.08;
  const w = tileSize - pad * 2;
  const h = tileSize - pad * 2;
  const r = tileSize * 0.04;

  const color = (variant?.data.color as string | undefined) ?? BASE_COLORS.bed.primary;
  const accent = (variant?.data.accent as string | undefined) ?? BASE_COLORS.bed.secondary;
  const dark = BASE_COLORS.bed.accent;

  if (id === "bed-royal") {
    // Cama com dossel e coroinha
    return (
      <Group>
        {/* Base */}
        <RoundedRect x={px + pad} y={py + pad + h * 0.45} width={w} height={h * 0.55} r={r} color={color} />
        {/* Cabeceira alta */}
        <RoundedRect x={px + pad} y={py + pad} width={w} height={h * 0.5} r={r * 1.5} color={accent} />
        {/* Coroinha no topo */}
        <Path
          path={(() => {
            const p = Skia.Path.Make();
            const cx = px + tileSize / 2;
            p.moveTo(cx - tileSize * 0.15, py + pad + h * 0.1);
            p.lineTo(cx - tileSize * 0.1, py + pad);
            p.lineTo(cx - tileSize * 0.05, py + pad + h * 0.07);
            p.lineTo(cx, py + pad - tileSize * 0.02);
            p.lineTo(cx + tileSize * 0.05, py + pad + h * 0.07);
            p.lineTo(cx + tileSize * 0.1, py + pad);
            p.lineTo(cx + tileSize * 0.15, py + pad + h * 0.1);
            p.close();
            return p;
          })()}
          color={accent}
        />
        {/* Travesseiro */}
        <RoundedRect x={px + pad + w * 0.1} y={py + pad + h * 0.5} width={w * 0.4} height={h * 0.2} r={r * 0.8} color="#ffffff" />
        {/* Coberta detalhe */}
        <Rect x={px + pad} y={py + pad + h * 0.7} width={w} height={tileSize * 0.04} color={accent} />
      </Group>
    );
  }

  if (id === "bed-treehouse") {
    // Cama em forma de tronco com folhas
    return (
      <Group>
        {/* Tronco/base */}
        <RoundedRect x={px + pad} y={py + pad + h * 0.45} width={w} height={h * 0.55} r={r * 2} color={dark} />
        <RoundedRect x={px + pad + w * 0.06} y={py + pad + h * 0.52} width={w * 0.88} height={h * 0.4} r={r} color={color} />
        {/* Folhas no topo */}
        <Circle cx={px + tileSize * 0.3} cy={py + pad + h * 0.3} r={tileSize * 0.18} color={color} />
        <Circle cx={px + tileSize * 0.7} cy={py + pad + h * 0.28} r={tileSize * 0.2} color={color} />
        <Circle cx={px + tileSize * 0.5} cy={py + pad + h * 0.18} r={tileSize * 0.22} color={accent} />
        {/* Aneis do tronco */}
        <Rect x={px + pad + w * 0.1} y={py + pad + h * 0.65} width={w * 0.8} height={tileSize * 0.025} color={dark} />
        <Rect x={px + pad + w * 0.1} y={py + pad + h * 0.8} width={w * 0.8} height={tileSize * 0.025} color={dark} />
      </Group>
    );
  }

  if (id === "bed-cloud") {
    // Cama nuvem flutuante (5 circulos)
    return (
      <Group>
        <Circle cx={px + tileSize * 0.25} cy={py + tileSize * 0.55} r={tileSize * 0.18} color="#ffffff" opacity={0.92} />
        <Circle cx={px + tileSize * 0.75} cy={py + tileSize * 0.55} r={tileSize * 0.18} color="#ffffff" opacity={0.92} />
        <Circle cx={px + tileSize * 0.4} cy={py + tileSize * 0.5} r={tileSize * 0.16} color="#ffffff" opacity={0.95} />
        <Circle cx={px + tileSize * 0.6} cy={py + tileSize * 0.45} r={tileSize * 0.2} color="#ffffff" opacity={0.95} />
        <RoundedRect x={px + tileSize * 0.15} y={py + tileSize * 0.55} width={tileSize * 0.7} height={tileSize * 0.32} r={tileSize * 0.16} color="#ffffff" opacity={0.94} />
        {/* Brilho azul claro */}
        <RoundedRect x={px + tileSize * 0.2} y={py + tileSize * 0.6} width={tileSize * 0.6} height={tileSize * 0.08} r={tileSize * 0.04} color={color} opacity={0.4} />
      </Group>
    );
  }

  // bed-default
  return (
    <Group>
      <RoundedRect x={px + pad} y={py + pad} width={w} height={h} r={r} color={color} />
      <RoundedRect x={px + pad + 2} y={py + pad + 2} width={w * 0.4} height={h * 0.35} r={r * 0.8} color={accent} />
      <RoundedRect x={px + pad} y={py + h * 0.5 + pad} width={w} height={h * 0.5 - 1} r={r * 0.6} color={dark} />
      <Rect x={px + pad} y={py + h - 2 + pad} width={w} height={2} color={dark} />
    </Group>
  );
}

// ============ DESK ============
function DeskSprite({ px, py, tileSize, variant }: { px: number; py: number; tileSize: number; variant?: CatalogItem | null }) {
  const id = variant?.id ?? "desk-default";
  const pad = tileSize * 0.08;
  const w = tileSize - pad * 2;
  const h = tileSize - pad * 2;
  const r = tileSize * 0.04;

  const color = (variant?.data.color as string | undefined) ?? BASE_COLORS.desk.primary;
  const accent = (variant?.data.accent as string | undefined) ?? BASE_COLORS.desk.secondary;

  if (id === "desk-gamer") {
    // Mesa gamer com monitor RGB
    return (
      <Group>
        {/* Tampo escuro */}
        <RoundedRect x={px + pad} y={py + pad + h * 0.5} width={w} height={h * 0.12} r={r * 0.4} color={color} />
        {/* Monitor curvado */}
        <RoundedRect x={px + pad - 1} y={py + pad + 2} width={w + 2} height={h * 0.46} r={r * 0.8} color="#0a0a0a" />
        {/* Tela */}
        <Rect x={px + pad + 4} y={py + pad + 6} width={w - 8} height={h * 0.36} color={accent} />
        {/* RGB stripe topo */}
        <Rect x={px + pad - 1} y={py + pad + 0} width={(w + 2) * 0.3} height={tileSize * 0.04} color="#b94a8a" />
        <Rect x={px + pad - 1 + (w + 2) * 0.3} y={py + pad + 0} width={(w + 2) * 0.3} height={tileSize * 0.04} color="#5b9bd5" />
        <Rect x={px + pad - 1 + (w + 2) * 0.6} y={py + pad + 0} width={(w + 2) * 0.4} height={tileSize * 0.04} color="#5fc775" />
        {/* Pe do monitor */}
        <Rect x={px + tileSize * 0.45} y={py + pad + h * 0.46} width={tileSize * 0.1} height={h * 0.08} color="#0a0a0a" />
        {/* Pernas */}
        <Rect x={px + pad + 2} y={py + pad + h * 0.62} width={2} height={h * 0.36} color={color} />
        <Rect x={px + pad + w - 4} y={py + pad + h * 0.62} width={2} height={h * 0.36} color={color} />
      </Group>
    );
  }

  if (id === "desk-vintage") {
    // Escrivaninha vintage com gavetas
    return (
      <Group>
        <RoundedRect x={px + pad} y={py + pad + h * 0.4} width={w} height={h * 0.6} r={r} color={color} />
        {/* Tampo claro */}
        <RoundedRect x={px + pad - 2} y={py + pad + h * 0.36} width={w + 4} height={h * 0.1} r={r * 0.6} color={accent} />
        {/* Gavetas */}
        <Rect x={px + pad + 3} y={py + pad + h * 0.55} width={w - 6} height={2} color="#3c2a12" />
        <Rect x={px + pad + 3} y={py + pad + h * 0.75} width={w - 6} height={2} color="#3c2a12" />
        {/* Macanetas */}
        <Circle cx={px + tileSize / 2} cy={py + pad + h * 0.66} r={tileSize * 0.025} color={accent} />
        <Circle cx={px + tileSize / 2} cy={py + pad + h * 0.86} r={tileSize * 0.025} color={accent} />
        {/* Livro em cima */}
        <RoundedRect x={px + pad + w * 0.1} y={py + pad + h * 0.2} width={w * 0.35} height={h * 0.17} r={r * 0.3} color="#a63f45" />
        <Rect x={px + pad + w * 0.1} y={py + pad + h * 0.22} width={w * 0.35} height={tileSize * 0.02} color="#7a4f18" />
      </Group>
    );
  }

  // desk-default
  return (
    <Group>
      <RoundedRect x={px + pad} y={py + pad} width={w} height={h} r={r} color={color} />
      <RoundedRect x={px + pad} y={py + pad + h * 0.45} width={w} height={h * 0.12} r={r * 0.4} color="#3f3522" />
      <RoundedRect x={px + tileSize * 0.2} y={py + pad + 4} width={w * 0.6} height={h * 0.4} r={r * 0.6} color="#1c2937" />
      <Rect x={px + tileSize * 0.24} y={py + pad + 7} width={w * 0.52} height={h * 0.3} color={accent} />
      <Rect x={px + tileSize * 0.48} y={py + pad + h * 0.4} width={tileSize * 0.04} height={h * 0.08} color="#1c2937" />
      <Rect x={px + pad + 2} y={py + pad + h * 0.55} width={2} height={h * 0.4} color="#3f3522" />
      <Rect x={px + pad + w - 4} y={py + pad + h * 0.55} width={2} height={h * 0.4} color="#3f3522" />
    </Group>
  );
}

// ============ AGENDA ============
function AgendaSprite({ px, py, tileSize }: { px: number; py: number; tileSize: number }) {
  const pad = tileSize * 0.08;
  const w = tileSize - pad * 2;
  const h = tileSize - pad * 2;
  const r = tileSize * 0.04;
  const colors = BASE_COLORS.agenda;
  return (
    <Group>
      <RoundedRect x={px + pad} y={py + pad} width={w} height={h} r={r} color={colors.primary} />
      <Circle cx={px + pad + w * 0.2} cy={py + pad + 4} r={2} color={colors.accent} />
      <Circle cx={px + pad + w * 0.8} cy={py + pad + 4} r={2} color={colors.accent} />
      <RoundedRect x={px + pad + 2} y={py + pad + 6} width={w - 4} height={h - 8} r={r * 0.4} color={colors.secondary} />
      <Rect x={px + pad + 6} y={py + pad + h * 0.35} width={w - 12} height={1.5} color="#999" />
      <Rect x={px + pad + 6} y={py + pad + h * 0.55} width={w - 12} height={1.5} color="#999" />
      <Rect x={px + pad + 6} y={py + pad + h * 0.75} width={w * 0.5} height={1.5} color="#999" />
    </Group>
  );
}

// ============ TRAINING ============
function TrainingSprite({ px, py, tileSize }: { px: number; py: number; tileSize: number }) {
  const pad = tileSize * 0.08;
  const w = tileSize - pad * 2;
  const h = tileSize - pad * 2;
  const r = tileSize * 0.04;
  const colors = BASE_COLORS.training;
  const cx = px + tileSize / 2;
  const cy = py + tileSize / 2;
  return (
    <Group>
      <RoundedRect x={px + pad} y={py + pad} width={w} height={h} r={r} color={colors.primary} />
      <Rect x={cx - w * 0.4} y={cy - 3} width={w * 0.8} height={6} color={colors.accent} />
      <RoundedRect x={cx - w * 0.45} y={cy - h * 0.18} width={w * 0.12} height={h * 0.36} r={r * 0.5} color={colors.accent} />
      <RoundedRect x={cx + w * 0.33} y={cy - h * 0.18} width={w * 0.12} height={h * 0.36} r={r * 0.5} color={colors.accent} />
    </Group>
  );
}

// ============ WARDROBE ============
function WardrobeSprite({ px, py, tileSize }: { px: number; py: number; tileSize: number }) {
  const pad = tileSize * 0.08;
  const w = tileSize - pad * 2;
  const h = tileSize - pad * 2;
  const r = tileSize * 0.04;
  const colors = BASE_COLORS.wardrobe;
  const cx = px + tileSize / 2;
  const cy = py + tileSize / 2;
  return (
    <Group>
      <RoundedRect x={px + pad} y={py + pad} width={w} height={h} r={r} color={colors.primary} />
      <Rect x={cx - 0.5} y={py + pad} width={1} height={h} color={colors.accent} />
      <Circle cx={cx - w * 0.18} cy={cy} r={2} color={colors.secondary} />
      <Circle cx={cx + w * 0.18} cy={cy} r={2} color={colors.secondary} />
      <Rect x={px + pad} y={py + pad} width={w} height={h * 0.1} color={colors.accent} />
    </Group>
  );
}

// ============ PLANT ============
function PlantSprite({ px, py, tileSize }: { px: number; py: number; tileSize: number }) {
  const pad = tileSize * 0.08;
  const w = tileSize - pad * 2;
  const h = tileSize - pad * 2;
  const r = tileSize * 0.04;
  const colors = BASE_COLORS.plant;
  const cx = px + tileSize / 2;
  return (
    <Group>
      <RoundedRect x={px + pad + w * 0.2} y={py + pad + h * 0.55} width={w * 0.6} height={h * 0.4} r={r * 0.5} color="#8b5e3f" />
      <Rect x={cx - 1} y={py + pad + h * 0.4} width={2} height={h * 0.2} color={colors.accent} />
      <Circle cx={cx - w * 0.18} cy={py + pad + h * 0.42} r={tileSize * 0.16} color={colors.primary} />
      <Circle cx={cx + w * 0.18} cy={py + pad + h * 0.42} r={tileSize * 0.16} color={colors.primary} />
      <Circle cx={cx} cy={py + pad + h * 0.3} r={tileSize * 0.18} color={colors.secondary} />
    </Group>
  );
}
