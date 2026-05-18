import { useEffect } from "react";

interface DialogBoxProps {
  message: string;
  speaker?: string;
  onClose: () => void;
}

export function DialogBox({ message, speaker, onClose }: DialogBoxProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  return (
    <div style={styles.root} onClick={onClose}>
      {speaker && <div style={styles.speaker}>{speaker}</div>}
      <div style={styles.message}>{message}</div>
      <div style={styles.tap}>(toque pra fechar)</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    background: "rgba(255, 248, 214, 0.96)",
    border: "3px solid #5a4731",
    borderRadius: 14,
    padding: "12px 14px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#2c2114",
    zIndex: 6,
    cursor: "pointer",
    boxShadow: "0 6px 24px rgba(35,24,9,0.35)",
  },
  speaker: {
    fontWeight: 900,
    fontSize: 13,
    color: "#7a4f18",
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.35,
  },
  tap: {
    fontSize: 10,
    color: "#7a6440",
    marginTop: 6,
    textAlign: "right",
  },
};
