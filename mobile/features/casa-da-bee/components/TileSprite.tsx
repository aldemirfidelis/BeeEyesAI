import { Group, Rect, RoundedRect } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { TILES, type TileId } from "../engine/types";
import type { CatalogItem } from "../engine/catalog";

interface Props {
  tile: TileId;
  px: number;
  py: number;
  tileSize: number;
  wallpaper?: CatalogItem | null;
  floor?: CatalogItem | null;
  rug?: CatalogItem | null;
}

const PALETTES: Record<number, { base: string; accent: string; shadow: string; detail?: string }> = {
  [TILES.GRASS]: { base: "#6fbd57", accent: "#8ed46b", shadow: "#4b8f3f", detail: "#4b8f3f" },
  [TILES.PATH]: { base: "#b9824d", accent: "#cc9a63", shadow: "#9c6a3f", detail: "#9c6a3f" },
  [TILES.FLOWER]: { base: "#72bf59", accent: "#fff06d", shadow: "#3e8437", detail: "#ef6f85" },
  [TILES.WATER]: { base: "#367fbc", accent: "#9bd7f1", shadow: "#246596", detail: "#67b8df" },
  [TILES.FLOOR]: { base: "#c99357", accent: "#e1b579", shadow: "#916039", detail: "#a06d3f" },
  [TILES.WALL]: { base: "#6c5138", accent: "#8d7050", shadow: "#4b3827", detail: "#4f3a28" },
  [TILES.RUG]: { base: "#a63f45", accent: "#cf6c55", shadow: "#672a32", detail: "#c95558" },
  [TILES.DOOR]: { base: "#7a4f18", accent: "#caa14e", shadow: "#3c2a12", detail: "#caa14e" },
};

function getPalette(tile: TileId, wallpaper?: CatalogItem | null, floor?: CatalogItem | null, rug?: CatalogItem | null) {
  if (tile === TILES.WALL && wallpaper) {
    const d = wallpaper.data as { base?: string; accent?: string; shadow?: string };
    return {
      base: d.base ?? PALETTES[TILES.WALL].base,
      accent: d.accent ?? PALETTES[TILES.WALL].accent,
      shadow: d.shadow ?? PALETTES[TILES.WALL].shadow,
      detail: d.shadow ?? PALETTES[TILES.WALL].detail,
      stars: (wallpaper.data as { stars?: boolean }).stars === true,
    };
  }
  if (tile === TILES.FLOOR && floor) {
    const d = floor.data as { base?: string; accent?: string; shadow?: string; pattern?: string };
    return {
      base: d.base ?? PALETTES[TILES.FLOOR].base,
      accent: d.accent ?? PALETTES[TILES.FLOOR].accent,
      shadow: d.shadow ?? PALETTES[TILES.FLOOR].shadow,
      detail: d.shadow ?? PALETTES[TILES.FLOOR].detail,
      pattern: d.pattern,
    };
  }
  if (tile === TILES.RUG && rug) {
    const d = rug.data as { color?: string; accent?: string };
    return {
      base: PALETTES[TILES.RUG].base,
      accent: d.accent ?? PALETTES[TILES.RUG].accent,
      shadow: d.color ?? PALETTES[TILES.RUG].shadow,
      detail: PALETTES[TILES.RUG].detail,
    };
  }
  return PALETTES[tile] ?? PALETTES[TILES.FLOOR];
}

// Padroes ja calculados (pixels pos relativas 0-1) — diferentes por tipo, mas deterministicos
const DETAIL_PATTERNS: Record<number, Array<[number, number, number, number]>> = {
  [TILES.GRASS]: [
    [0.16, 0.38, 0.06, 0.16], [0.31, 0.56, 0.06, 0.13], [0.66, 0.22, 0.06, 0.16], [0.84, 0.72, 0.06, 0.13],
  ],
  [TILES.PATH]: [
    [0.13, 0.19, 0.22, 0.09], [0.53, 0.16, 0.28, 0.09], [0.25, 0.62, 0.31, 0.09], [0.66, 0.75, 0.19, 0.09],
  ],
  [TILES.FLOWER]: [
    [0.34, 0.38, 0.06, 0.19], [0.34, 0.31, 0.06, 0.06], [0.47, 0.38, 0.06, 0.06], [0.34, 0.44, 0.06, 0.06],
    [0.69, 0.19, 0.06, 0.16], [0.66, 0.16, 0.06, 0.06], [0.78, 0.16, 0.06, 0.06], [0.69, 0.28, 0.06, 0.06],
  ],
  [TILES.WATER]: [
    [0.09, 0.25, 0.38, 0.06], [0.56, 0.5, 0.31, 0.06], [0.25, 0.78, 0.44, 0.06],
  ],
  [TILES.FLOOR]: [], // wood planks tratado separadamente
  [TILES.WALL]: [
    [0, 0.28, 1, 0.06], [0, 0.59, 1, 0.06], [0.22, 0, 0.06, 0.28], [0.66, 0.31, 0.06, 0.28], [0.41, 0.62, 0.06, 0.38],
  ],
  [TILES.RUG]: [],
  [TILES.DOOR]: [],
};

const ACCENT_DOTS: Record<number, Array<[number, number]>> = {
  [TILES.GRASS]: [[0.09, 0.13], [0.41, 0.25], [0.78, 0.16], [0.22, 0.63], [0.59, 0.75], [0.84, 0.56]],
  [TILES.PATH]: [[0.09, 0.13], [0.41, 0.25], [0.78, 0.16], [0.22, 0.63], [0.59, 0.75], [0.84, 0.56]],
  [TILES.FLOWER]: [[0.09, 0.13], [0.41, 0.25], [0.78, 0.16], [0.22, 0.63], [0.59, 0.75], [0.84, 0.56]],
  [TILES.WATER]: [[0.09, 0.13], [0.41, 0.25], [0.78, 0.16], [0.22, 0.63], [0.59, 0.75], [0.84, 0.56]],
  [TILES.WALL]: [],
  [TILES.FLOOR]: [],
  [TILES.RUG]: [],
  [TILES.DOOR]: [],
};

export function TileSprite({ tile, px, py, tileSize, wallpaper, floor, rug }: Props) {
  const palette = useMemo(() => getPalette(tile, wallpaper, floor, rug), [tile, wallpaper, floor, rug]);

  const detailRects = useMemo(() => {
    const pattern = DETAIL_PATTERNS[tile] ?? [];
    return pattern.map(([rx, ry, rw, rh], i) => (
      <Rect
        key={`d-${i}`}
        x={px + rx * tileSize}
        y={py + ry * tileSize}
        width={rw * tileSize}
        height={rh * tileSize}
        color={palette.detail ?? palette.shadow}
      />
    ));
  }, [palette.detail, palette.shadow, px, py, tile, tileSize]);

  const accentDots = useMemo(() => {
    const dots = ACCENT_DOTS[tile] ?? [];
    return dots.map(([rx, ry], i) => (
      <Rect
        key={`a-${i}`}
        x={px + rx * tileSize}
        y={py + ry * tileSize}
        width={tileSize * 0.06}
        height={tileSize * 0.06}
        color={palette.accent}
      />
    ));
  }, [palette.accent, px, py, tile, tileSize]);

  // Borda inferior/direita pra dar sensacao de relevo
  const edge = (
    <>
      <Rect x={px} y={py + tileSize - 1} width={tileSize} height={1} color="rgba(32, 26, 18, 0.16)" />
      <Rect x={px + tileSize - 1} y={py} width={1} height={tileSize} color="rgba(32, 26, 18, 0.16)" />
    </>
  );

  if (tile === TILES.FLOOR) {
    const floorPattern = (palette as { pattern?: string }).pattern;
    // Checker: tile com 4 quadradinhos alternados
    if (floorPattern === "checker") {
      return (
        <Group>
          <Rect x={px} y={py} width={tileSize / 2} height={tileSize / 2} color={palette.base} />
          <Rect x={px + tileSize / 2} y={py} width={tileSize / 2} height={tileSize / 2} color={palette.accent} />
          <Rect x={px} y={py + tileSize / 2} width={tileSize / 2} height={tileSize / 2} color={palette.accent} />
          <Rect x={px + tileSize / 2} y={py + tileSize / 2} width={tileSize / 2} height={tileSize / 2} color={palette.base} />
          {edge}
        </Group>
      );
    }
    // Default: pranchas de madeira horizontais
    const planks = [];
    for (let row = 7; row < 32; row += 8) {
      planks.push(
        <Rect key={`p-${row}`} x={px} y={py + (row / 32) * tileSize} width={tileSize} height={tileSize * 0.06} color={palette.shadow} />,
      );
      const offsetX = (row / 8) % 2 ? 0.31 : 0.06;
      planks.push(
        <Rect
          key={`pa-${row}`}
          x={px + offsetX * tileSize}
          y={py + (row / 32) * tileSize - tileSize * 0.09}
          width={tileSize * 0.41}
          height={tileSize * 0.06}
          color={palette.accent}
        />,
      );
    }
    return (
      <Group>
        <Rect x={px} y={py} width={tileSize} height={tileSize} color={palette.base} />
        {planks}
        {edge}
      </Group>
    );
  }

  if (tile === TILES.WALL) {
    const hasStars = (palette as { stars?: boolean }).stars === true;
    return (
      <Group>
        <Rect x={px} y={py} width={tileSize} height={tileSize} color={palette.base} />
        {hasStars ? (
          <>
            {/* Estrelinhas dispersas em vez de tijolos */}
            <Rect x={px + tileSize * 0.18} y={py + tileSize * 0.22} width={tileSize * 0.07} height={tileSize * 0.07} color="#fff" />
            <Rect x={px + tileSize * 0.62} y={py + tileSize * 0.32} width={tileSize * 0.05} height={tileSize * 0.05} color="#fff" />
            <Rect x={px + tileSize * 0.35} y={py + tileSize * 0.72} width={tileSize * 0.06} height={tileSize * 0.06} color="#fbe27a" />
            <Rect x={px + tileSize * 0.78} y={py + tileSize * 0.65} width={tileSize * 0.04} height={tileSize * 0.04} color="#fff" />
            <Rect x={px + tileSize * 0.06} y={py + tileSize * 0.58} width={tileSize * 0.04} height={tileSize * 0.04} color="#fbe27a" />
          </>
        ) : (
          detailRects
        )}
        {/* Reflexo no topo */}
        <Rect x={px + tileSize * 0.03} y={py + tileSize * 0.03} width={tileSize * 0.94} height={tileSize * 0.06} color={palette.accent} />
        {edge}
      </Group>
    );
  }

  if (tile === TILES.RUG) {
    return (
      <Group>
        <Rect x={px} y={py} width={tileSize} height={tileSize} color={palette.base} />
        <RoundedRect
          x={px + tileSize * 0.09}
          y={py + tileSize * 0.09}
          width={tileSize * 0.82}
          height={tileSize * 0.82}
          r={tileSize * 0.12}
          color={palette.shadow}
        />
        <RoundedRect
          x={px + tileSize * 0.13}
          y={py + tileSize * 0.13}
          width={tileSize * 0.74}
          height={tileSize * 0.74}
          r={tileSize * 0.1}
          color={palette.accent}
        />
        {edge}
      </Group>
    );
  }

  if (tile === TILES.DOOR) {
    return (
      <Group>
        <Rect x={px} y={py} width={tileSize} height={tileSize} color={palette.shadow} />
        <RoundedRect
          x={px + tileSize * 0.13}
          y={py + tileSize * 0.06}
          width={tileSize * 0.74}
          height={tileSize * 0.88}
          r={tileSize * 0.22}
          color={palette.accent}
        />
        {/* Macaneta */}
        <Rect x={px + tileSize * 0.72} y={py + tileSize * 0.5} width={tileSize * 0.08} height={tileSize * 0.08} color={palette.shadow} />
      </Group>
    );
  }

  return (
    <Group>
      <Rect x={px} y={py} width={tileSize} height={tileSize} color={palette.base} />
      {detailRects}
      {accentDots}
      {edge}
    </Group>
  );
}
