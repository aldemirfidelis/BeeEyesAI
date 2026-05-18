import { useEffect, useRef, useState } from "react";

interface MiniGameModalProps {
  onClose: () => void;
  onReward: (pollen: number) => void;
}

interface Pollen {
  id: number;
  x: number;
  y: number;
  vy: number;
  collected: boolean;
}

const GAME_DURATION_MS = 30_000;
const SPAWN_INTERVAL_MS = 600;

export function MiniGameModal({ onClose, onReward }: MiniGameModalProps) {
  const [phase, setPhase] = useState<"intro" | "playing" | "ended">("intro");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS / 1000);
  const pollensRef = useRef<Pollen[]>([]);
  const nextIdRef = useRef(1);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (phase !== "playing") return;
    const startTs = Date.now();
    let spawnTs = startTs;
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTs;
      const remaining = Math.max(0, (GAME_DURATION_MS - elapsed) / 1000);
      setTimeLeft(remaining);

      // Spawn
      if (now - spawnTs >= SPAWN_INTERVAL_MS) {
        spawnTs = now;
        const w = areaRef.current?.clientWidth ?? 300;
        const x = Math.random() * (w - 40) + 20;
        pollensRef.current.push({ id: nextIdRef.current++, x, y: -30, vy: 1 + Math.random() * 1.5, collected: false });
      }

      // Move
      const areaH = areaRef.current?.clientHeight ?? 400;
      pollensRef.current = pollensRef.current
        .map((p) => ({ ...p, y: p.y + p.vy * 2.5 }))
        .filter((p) => p.y < areaH + 30 && !p.collected);

      forceTick((n) => n + 1);

      if (elapsed >= GAME_DURATION_MS) {
        clearInterval(interval);
        setPhase("ended");
      }
    }, 16);
    return () => clearInterval(interval);
  }, [phase]);

  function start() {
    pollensRef.current = [];
    setScore(0);
    setTimeLeft(GAME_DURATION_MS / 1000);
    setPhase("playing");
  }

  function tap(id: number) {
    const p = pollensRef.current.find((p) => p.id === id);
    if (!p || p.collected) return;
    p.collected = true;
    setScore((s) => s + 1);
  }

  function finish() {
    const reward = score * 2;
    onReward(reward);
    onClose();
  }

  return (
    <div style={styles.backdrop} onClick={phase === "ended" ? finish : undefined}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.title}>🎮 Caça ao Pólen</div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {phase === "intro" && (
          <div style={styles.intro}>
            <div style={styles.introText}>
              Toque nos pólens que caem antes que cheguem ao chão.
              Cada pólen vale <b>2 🟡</b>. Você tem 30 segundos.
            </div>
            <button style={styles.startBtn} onClick={start}>Começar</button>
          </div>
        )}

        {phase === "playing" && (
          <>
            <div style={styles.statusBar}>
              <span>🟡 {score}</span>
              <span>⏱ {Math.ceil(timeLeft)}s</span>
            </div>
            <div ref={areaRef} style={styles.gameArea}>
              {pollensRef.current.map((p) => (
                <button
                  key={p.id}
                  onClick={() => tap(p.id)}
                  style={{ ...styles.pollen, left: p.x, top: p.y }}
                  aria-label="pollen"
                >
                  🟡
                </button>
              ))}
            </div>
          </>
        )}

        {phase === "ended" && (
          <div style={styles.intro}>
            <div style={styles.endTitle}>Fim de jogo!</div>
            <div style={styles.endStats}>
              <div>Pólens coletados: <b>{score}</b></div>
              <div>Recompensa: <b>+{score * 2} 🟡</b></div>
            </div>
            <button style={styles.startBtn} onClick={finish}>Receber recompensa</button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  modal: { width: "100%", maxWidth: 360, height: 500, maxHeight: "90vh", background: "#22150b", color: "#fff8d6", borderRadius: 16, border: "3px solid #5a4731", display: "flex", flexDirection: "column", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "2px solid #5a4731" },
  title: { fontWeight: 900, fontSize: 14 },
  closeBtn: { marginLeft: "auto", background: "transparent", border: "none", color: "#fff8d6", fontSize: 16, cursor: "pointer" },
  intro: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24, textAlign: "center" },
  introText: { fontSize: 13, lineHeight: 1.5 },
  startBtn: { padding: "12px 24px", background: "#fbcb45", color: "#2c1a08", border: "2px solid #5a4731", borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: "pointer" },
  statusBar: { display: "flex", justifyContent: "space-between", padding: "8px 14px", background: "rgba(0,0,0,0.3)", fontWeight: 900, fontSize: 13 },
  gameArea: { position: "relative", flex: 1, overflow: "hidden", background: "linear-gradient(180deg, #5b3a24, #22150b)" },
  pollen: { position: "absolute", width: 32, height: 32, background: "transparent", border: "none", fontSize: 24, cursor: "pointer", padding: 0 },
  endTitle: { fontSize: 22, fontWeight: 900 },
  endStats: { fontSize: 14, lineHeight: 2 },
};
