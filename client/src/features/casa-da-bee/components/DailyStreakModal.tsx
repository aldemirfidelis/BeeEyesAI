interface DailyStreakModalProps {
  count: number;
  rewards: readonly number[];
  claimedToday: boolean;
  nextReward: number;
  onClaim: () => void;
  onClose: () => void;
}

export function DailyStreakModal({ count, rewards, claimedToday, nextReward, onClaim, onClose }: DailyStreakModalProps) {
  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>🔥 Visitas em Sequência</div>
        <div style={styles.subtitle}>
          {claimedToday ? `Voce ja coletou hoje. Volta amanha pra continuar a sequencia!` : `Sequencia atual: ${count} dia${count !== 1 ? "s" : ""}`}
        </div>

        <div style={styles.grid}>
          {rewards.map((reward, idx) => {
            const dayN = idx + 1;
            const isClaimed = dayN < count || (dayN === count && claimedToday);
            const isCurrent = dayN === count + 1 || (dayN === count && !claimedToday);
            return (
              <div key={idx} style={{ ...styles.day, background: isClaimed ? "#5fc775" : isCurrent ? "#fbcb45" : "rgba(255,255,255,0.08)" }}>
                <div style={styles.dayLabel}>Dia {dayN}</div>
                <div style={styles.dayReward}>🟡 {reward}</div>
                {isClaimed && <div style={styles.check}>✓</div>}
              </div>
            );
          })}
        </div>

        <button
          style={{ ...styles.claimBtn, background: claimedToday ? "#5e4520" : "#ec8f1f", cursor: claimedToday ? "default" : "pointer" }}
          disabled={claimedToday}
          onClick={onClaim}
        >
          {claimedToday ? "Já coletado hoje" : `Coletar +${nextReward} pólen`}
        </button>
        <button style={styles.closeBtn} onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  modal: { width: "100%", maxWidth: 360, background: "#22150b", color: "#fff8d6", borderRadius: 16, border: "3px solid #5a4731", padding: 16, display: "flex", flexDirection: "column", gap: 10 },
  header: { fontSize: 16, fontWeight: 900, textAlign: "center" },
  subtitle: { fontSize: 12, color: "rgba(255,248,214,0.75)", textAlign: "center", lineHeight: 1.4 },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, margin: "8px 0" },
  day: { padding: "8px 2px", borderRadius: 8, textAlign: "center", position: "relative", border: "1px solid rgba(255,255,255,0.1)" },
  dayLabel: { fontSize: 9, fontWeight: 800, color: "#2c1a08" },
  dayReward: { fontSize: 11, fontWeight: 900, color: "#2c1a08", marginTop: 2 },
  check: { position: "absolute", top: 1, right: 3, color: "#2c1a08", fontWeight: 900, fontSize: 11 },
  claimBtn: { padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 14, color: "#fff8d6", border: "2px solid #5a4731" },
  closeBtn: { padding: 8, borderRadius: 10, background: "transparent", border: "1px solid rgba(255,248,214,0.3)", color: "#fff8d6", fontSize: 12, cursor: "pointer" },
};
