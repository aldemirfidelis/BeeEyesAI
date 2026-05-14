import { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Circle, Polygon, G, Text as SvgText, Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { MEDAL_BY_TYPE, MEDAL_CATALOG, TIER_COLORS, type MedalSpec, type MedalTier } from "../lib/medals";

// ── Helpers ───────────────────────────────────────────────────────────────────

function starPoints(cx: number, cy: number, outerR: number, innerR: number, points: number): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(" ");
}

// ── Medal SVG ─────────────────────────────────────────────────────────────────

interface MedalSvgProps {
  spec: MedalSpec;
  size: number;
  locked?: boolean;
}

function MedalSvg({ spec, size, locked = false }: MedalSvgProps) {
  const c = TIER_COLORS[spec.tier];
  const half = size / 2;
  const outerStar = half * 0.94;
  const innerStar = half * 0.68;
  const bodyR     = half * 0.64;
  const ringR     = half * 0.52;
  const shineR    = half * 0.32;
  const fontSize  = size * 0.34;

  const starPts = useMemo(
    () => starPoints(half, half, outerStar, innerStar, 8),
    [half, outerStar, innerStar]
  );

  const outer  = locked ? "#9E9E9E" : c.outer;
  const body   = locked ? "#BDBDBD" : c.body;
  const ring   = locked ? "#E0E0E0" : c.shine;
  const shine  = locked ? "#F5F5F5" : c.shine;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id={`shine-${spec.type}`} cx="40%" cy="35%" r="55%">
          <Stop offset="0%" stopColor={shine} stopOpacity={locked ? "0.5" : "0.9"} />
          <Stop offset="100%" stopColor={body} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Outer star burst */}
      <Polygon points={starPts} fill={outer} opacity={locked ? 0.5 : 1} />

      {/* Medal body */}
      <Circle cx={half} cy={half} r={bodyR} fill={body} opacity={locked ? 0.6 : 1} />

      {/* Inner ring */}
      <Circle cx={half} cy={half} r={ringR} fill="none"
        stroke={outer} strokeWidth={size * 0.028} opacity={locked ? 0.4 : 0.6} />

      {/* Radial shine overlay */}
      <Circle cx={half} cy={half} r={bodyR} fill={`url(#shine-${spec.type})`} />

      {/* Emoji icon */}
      <SvgText
        x={half}
        y={half + fontSize * 0.36}
        fontSize={fontSize}
        textAnchor="middle"
        opacity={locked ? 0.4 : 1}
      >
        {spec.icon}
      </SvgText>

      {/* Lock overlay for locked medals */}
      {locked && (
        <SvgText
          x={half}
          y={half * 1.85}
          fontSize={size * 0.18}
          textAnchor="middle"
          opacity={0.55}
        >
          🔒
        </SvgText>
      )}
    </Svg>
  );
}

// ── Medal Badge (single item) ─────────────────────────────────────────────────

interface MedalBadgeProps {
  type: string;
  earned?: boolean;
  unlockedAt?: string | null;
  size?: number;
  onPress?: (spec: MedalSpec) => void;
}

export function MedalBadge({ type, earned = false, unlockedAt, size = 64, onPress }: MedalBadgeProps) {
  const spec = MEDAL_BY_TYPE[type];
  if (!spec) return null;

  const tierLabel: Record<MedalTier, string> = {
    bronze: "Bronze", silver: "Prata", gold: "Ouro",
    diamond: "Diamante", special: "Especial",
  };

  return (
    <TouchableOpacity
      style={[styles.badgeWrap, { opacity: earned ? 1 : 0.38 }]}
      onPress={() => onPress?.(spec)}
      activeOpacity={0.75}
    >
      <MedalSvg spec={spec} size={size} locked={!earned} />
      <Text style={[styles.badgeName, { color: earned ? "#1A1A1A" : "#9E9E9E" }]} numberOfLines={2}>
        {spec.title}
      </Text>
      {earned && (
        <Text style={styles.tierLabel}>{tierLabel[spec.tier]}</Text>
      )}
    </TouchableOpacity>
  );
}

// ── Medal Grid (profile section) ─────────────────────────────────────────────

interface MedalGridProps {
  earnedTypes: string[];
  onPress?: (spec: MedalSpec) => void;
  filterTypes?: string[];
}

export function MedalGrid({ earnedTypes, onPress, filterTypes }: MedalGridProps) {
  const earnedSet = useMemo(() => new Set(earnedTypes), [earnedTypes]);
  const filterSet = useMemo(() => (filterTypes ? new Set(filterTypes) : null), [filterTypes]);

  // Sort: earned first, then locked
  const sorted = useMemo(() => {
    const pool = filterSet
      ? MEDAL_CATALOG.filter((m) => filterSet.has(m.type))
      : MEDAL_CATALOG;
    return [
      ...pool.filter((m) => earnedSet.has(m.type)),
      ...pool.filter((m) => !earnedSet.has(m.type)),
    ];
  }, [earnedSet, filterSet]);

  return (
    <View style={styles.grid}>
      {sorted.map((spec) => (
        <MedalBadge
          key={spec.type}
          type={spec.type}
          earned={earnedSet.has(spec.type)}
          size={72}
          onPress={onPress}
        />
      ))}
    </View>
  );
}

// ── Medal Detail Card (used in modal/bottom sheet) ────────────────────────────

interface MedalDetailProps {
  spec: MedalSpec;
  earned: boolean;
  unlockedAt?: string | null;
}

export function MedalDetail({ spec, earned, unlockedAt }: MedalDetailProps) {
  const tierLabel: Record<MedalTier, string> = {
    bronze: "Bronze", silver: "Prata", gold: "Ouro",
    diamond: "Diamante", special: "Especial",
  };
  const tierBg: Record<MedalTier, string> = {
    bronze: "#FBE9D0", silver: "#F5F5F5", gold: "#FFFDE7",
    diamond: "#E1F5FE", special: "#FFFDE7",
  };
  const tierFg: Record<MedalTier, string> = {
    bronze: "#A0522D", silver: "#616161", gold: "#B8860B",
    diamond: "#0277BD", special: "#1A1A1A",
  };

  return (
    <View style={styles.detailWrap}>
      <MedalSvg spec={spec} size={100} locked={!earned} />
      <Text style={styles.detailTitle}>{spec.title}</Text>
      <View style={[styles.tierPill, { backgroundColor: tierBg[spec.tier] }]}>
        <Text style={[styles.tierPillText, { color: tierFg[spec.tier] }]}>
          {tierLabel[spec.tier]}
        </Text>
      </View>
      <Text style={styles.detailDesc}>
        {earned ? spec.description : `🔒 ${spec.hint}`}
      </Text>
      {earned && unlockedAt && (
        <Text style={styles.detailDate}>
          Conquistada em {new Date(unlockedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badgeWrap: {
    alignItems: "center",
    gap: 4,
    width: 90,
  },
  badgeName: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 14,
  },
  tierLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#B8860B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
  },
  detailWrap: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
  },
  tierPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  tierPillText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailDesc: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    lineHeight: 20,
  },
  detailDate: {
    fontSize: 12,
    color: "#9E9E9E",
    marginTop: 4,
  },
});
