import { useState } from "react";

interface OnboardingOverlayProps {
  onComplete: () => void;
}

const STEPS = [
  { emoji: "🐝", title: "Bem-vinda à Casa da Bee!", text: "Esta é a sua amiga Bee. Ela vive aqui e adora visitas." },
  { emoji: "👆", title: "Toque para interagir", text: "Toque em qualquer lugar do mapa pra ela andar até lá. Toque nos móveis pra interagir." },
  { emoji: "🟡", title: "Colete pólen", text: "Pólens aparecem pela casa. Toque pra coletar e use na loja pra personalizar a Bee." },
  { emoji: "🛍️", title: "Personalize", text: "Compre chapéus, acessórios, móveis e mude a decoração da casa. Tudo com pólen." },
  { emoji: "🔥", title: "Volte todo dia", text: "Visitas em sequência rendem cada vez mais pólen. Quanto mais dias seguidos, melhor!" },
];

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const cur = STEPS[step];

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <div style={styles.emoji}>{cur.emoji}</div>
        <div style={styles.title}>{cur.title}</div>
        <div style={styles.text}>{cur.text}</div>
        <div style={styles.dots}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ ...styles.dot, background: i === step ? "#fbcb45" : "rgba(255,255,255,0.3)" }} />
          ))}
        </div>
        <button style={styles.btn} onClick={() => (isLast ? onComplete() : setStep(step + 1))}>
          {isLast ? "Vamos começar!" : "Próximo"}
        </button>
        {!isLast && (
          <button style={styles.skip} onClick={onComplete}>Pular</button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  modal: { background: "#fff8d6", color: "#2c1a08", maxWidth: 360, width: "100%", padding: 24, borderRadius: 18, border: "3px solid #5a4731", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" },
  emoji: { fontSize: 64 },
  title: { fontWeight: 900, fontSize: 18 },
  text: { fontSize: 14, lineHeight: 1.5, color: "#5a3a08" },
  dots: { display: "flex", gap: 6, margin: "8px 0" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  btn: { background: "#ec8f1f", color: "#fff8d6", border: "2px solid #5a4731", padding: "10px 24px", borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: "pointer", width: "100%" },
  skip: { background: "transparent", color: "#5a3a08", border: "none", fontSize: 12, cursor: "pointer", padding: 4 },
};
