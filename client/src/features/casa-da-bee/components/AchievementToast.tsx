import { useEffect } from "react";
import type { Achievement } from "../engine/achievements";

interface AchievementToastProps {
  achievement: Achievement;
  onDismiss: () => void;
}

export function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [achievement.id, onDismiss]);

  return (
    <div style={styles.root}>
      <div style={styles.icon}>🏆</div>
      <div style={styles.text}>
        <div style={styles.title}>Conquista desbloqueada!</div>
        <div style={styles.subtitle}>{achievement.title}</div>
        <div style={styles.reward}>+{achievement.rewardPollen} 🟡</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "absolute",
    top: 110,
    right: 16,
    background: "linear-gradient(135deg, #fbcb45, #ec8f1f)",
    border: "3px solid #5a4731",
    borderRadius: 14,
    padding: "10px 14px",
    display: "flex",
    gap: 10,
    alignItems: "center",
    zIndex: 7,
    boxShadow: "0 6px 24px rgba(35,24,9,0.45)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    animation: "slide-in 0.4s ease-out",
  },
  icon: { fontSize: 32 },
  text: { display: "flex", flexDirection: "column", gap: 2 },
  title: { fontSize: 11, fontWeight: 800, color: "#5a3a08", textTransform: "uppercase", letterSpacing: 0.5 },
  subtitle: { fontSize: 13, fontWeight: 900, color: "#2c1a08" },
  reward: { fontSize: 11, fontWeight: 800, color: "#5a3a08" },
};
