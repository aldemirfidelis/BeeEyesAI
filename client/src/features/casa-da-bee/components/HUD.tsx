import type { BeeStats } from "../engine/types";

interface HUDProps {
  stats: BeeStats;
  streakCount: number;
  streakClaimedToday: boolean;
  timeOfDayLabel: string;
  onOpenShop: () => void;
  onOpenStreak: () => void;
  onOpenMiniGame: () => void;
  onClose: () => void;
}

export function HUD({
  stats,
  streakCount,
  streakClaimedToday,
  timeOfDayLabel,
  onOpenShop,
  onOpenStreak,
  onOpenMiniGame,
  onClose,
}: HUDProps) {
  const xpThreshold = stats.level * 100;
  const xpPct = Math.min(100, (stats.xp / xpThreshold) * 100);

  return (
    <div style={styles.root}>
      <button style={styles.closeBtn} onClick={onClose} aria-label="Voltar">
        ←
      </button>

      <div style={styles.statsRow}>
        <div style={styles.stat} title="Pólen">
          <span style={styles.icon}>🟡</span>
          <span style={styles.statText}>{stats.pollen}</span>
        </div>
        <div style={styles.stat} title="Nível">
          <span style={styles.icon}>⭐</span>
          <span style={styles.statText}>Lv {stats.level}</span>
        </div>
        <div style={{ ...styles.stat, flex: 1, minWidth: 100 }}>
          <div style={styles.xpBarOuter}>
            <div style={{ ...styles.xpBarInner, width: `${xpPct}%` }} />
            <span style={styles.xpLabel}>{stats.xp} / {xpThreshold} XP</span>
          </div>
        </div>
      </div>

      <div style={styles.actionsRow}>
        <button style={{ ...styles.actionBtn, background: streakClaimedToday ? "#5e4520" : "#ec8f1f" }} onClick={onOpenStreak}>
          🔥 {streakCount}
        </button>
        <button style={styles.actionBtn} onClick={onOpenShop}>
          🛍️ Loja
        </button>
        <button style={styles.actionBtn} onClick={onOpenMiniGame}>
          🎮 Jogar
        </button>
        <div style={styles.timeOfDay} title={timeOfDayLabel}>
          {timeOfDayLabel}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: "10px 12px",
    background: "linear-gradient(180deg, rgba(35,24,9,0.92) 0%, rgba(35,24,9,0.65) 75%, transparent 100%)",
    color: "#fff8d6",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: 800,
    zIndex: 5,
  },
  closeBtn: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "rgba(255,248,214,0.94)",
    color: "#2a2014",
    border: "2px solid rgba(87,61,28,0.65)",
    fontSize: 20,
    fontWeight: 900,
    cursor: "pointer",
  },
  statsRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginLeft: 48,
    marginTop: 2,
    flexWrap: "wrap",
  },
  stat: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "rgba(0,0,0,0.45)",
    padding: "4px 10px",
    borderRadius: 14,
    fontSize: 13,
  },
  icon: { fontSize: 14 },
  statText: { whiteSpace: "nowrap" },
  xpBarOuter: {
    position: "relative",
    height: 16,
    width: "100%",
    background: "rgba(0,0,0,0.5)",
    borderRadius: 8,
    overflow: "hidden",
  },
  xpBarInner: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    background: "linear-gradient(90deg, #fbcb45, #ec8f1f)",
    transition: "width 0.4s ease-out",
  },
  xpLabel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    color: "#fff",
    textShadow: "0 1px 2px rgba(0,0,0,0.7)",
  },
  actionsRow: {
    display: "flex",
    gap: 8,
    marginTop: 8,
    marginLeft: 48,
    alignItems: "center",
    flexWrap: "wrap",
  },
  actionBtn: {
    background: "#ec8f1f",
    color: "#fff8d6",
    border: "2px solid rgba(87,61,28,0.6)",
    padding: "5px 12px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  timeOfDay: {
    marginLeft: "auto",
    fontSize: 11,
    background: "rgba(0,0,0,0.4)",
    padding: "4px 9px",
    borderRadius: 12,
  },
};
