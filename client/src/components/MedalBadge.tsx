import { useMemo } from "react";
import { MEDAL_BY_TYPE, MEDAL_CATALOG, TIER_COLORS, type MedalSpec } from "@/lib/medals";

function starPoints(cx: number, cy: number, outerR: number, innerR: number, points: number) {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function MedalSvg({ spec, locked, size = 72 }: { spec: MedalSpec; locked?: boolean; size?: number }) {
  const colors = TIER_COLORS[spec.tier];
  const half = size / 2;
  const points = useMemo(() => starPoints(half, half, half * 0.92, half * 0.66, 8), [half]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <polygon points={points} fill={locked ? "#BDBDBD" : colors.ring} opacity={locked ? 0.45 : 1} />
      <circle cx={half} cy={half} r={half * 0.62} fill={locked ? "#D4D4D4" : colors.body} />
      <circle cx={half} cy={half} r={half * 0.48} fill="none" stroke={locked ? "#A3A3A3" : colors.ring} strokeWidth={2} opacity={0.7} />
      <circle cx={half * 0.78} cy={half * 0.72} r={half * 0.22} fill="#fff" opacity={locked ? 0.25 : 0.45} />
      <text x={half} y={half + size * 0.12} textAnchor="middle" fontSize={size * 0.34} opacity={locked ? 0.35 : 1}>
        {locked ? "🔒" : spec.icon}
      </text>
    </svg>
  );
}

export function MedalBadge({ spec, earned, onClick }: { spec: MedalSpec; earned: boolean; onClick?: (spec: MedalSpec) => void }) {
  const colors = TIER_COLORS[spec.tier];
  return (
    <button type="button" onClick={() => onClick?.(spec)} className={`text-center rounded-xl border p-2 transition-colors ${earned ? "bg-card hover:bg-secondary/40" : "bg-secondary/20 opacity-60"}`}>
      <div className="flex justify-center">
        <MedalSvg spec={spec} locked={!earned} />
      </div>
      <p className="mt-1 text-[11px] font-semibold leading-tight">{spec.title}</p>
      {earned && <p className="mt-0.5 text-[10px] font-bold uppercase" style={{ color: colors.text }}>{spec.tier}</p>}
    </button>
  );
}

export function MedalGrid({ earnedTypes, onSelect, filterTypes }: { earnedTypes: string[]; onSelect?: (spec: MedalSpec) => void; filterTypes?: string[] }) {
  const earnedSet = useMemo(() => new Set(earnedTypes), [earnedTypes]);
  const filterSet = useMemo(() => (filterTypes ? new Set(filterTypes) : null), [filterTypes]);
  const sorted = useMemo(() => {
    const filtered = filterSet
      ? MEDAL_CATALOG.filter((medal) => filterSet.has(medal.type))
      : MEDAL_CATALOG;
    return [
      ...filtered.filter((medal) => earnedSet.has(medal.type)),
      ...filtered.filter((medal) => !earnedSet.has(medal.type)),
    ];
  }, [earnedSet, filterSet]);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
      {sorted.map((spec) => (
        <MedalBadge key={spec.type} spec={spec} earned={earnedSet.has(spec.type)} onClick={onSelect} />
      ))}
    </div>
  );
}

export function MedalDetail({ spec, earned, unlockedAt }: { spec: MedalSpec; earned: boolean; unlockedAt?: string | null }) {
  const colors = TIER_COLORS[spec.tier];
  return (
    <div className="text-center space-y-3">
      <div className="flex justify-center">
        <MedalSvg spec={spec} locked={!earned} size={96} />
      </div>
      <div>
        <h3 className="text-lg font-black">{spec.title}</h3>
        <span className="inline-flex mt-2 rounded-full px-3 py-1 text-xs font-bold uppercase" style={{ color: colors.text, backgroundColor: colors.bg }}>
          {spec.tier}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{earned ? spec.description : spec.hint}</p>
      {earned && unlockedAt && <p className="text-xs text-muted-foreground">Conquistada em {new Date(unlockedAt).toLocaleDateString("pt-BR")}</p>}
    </div>
  );
}

export function findMedal(type: string) {
  return MEDAL_BY_TYPE[type];
}
