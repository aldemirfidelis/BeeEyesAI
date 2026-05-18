import { useEffect, useState } from "react";

/**
 * Botão discreto que leva pra Casa da Bee Skia.
 * Renderizado pelo Home.tsx apenas quando logado e na aba chat.
 *
 * Aparência: pílula pequena top-right com casinha + Bee em SVG.
 * Posicionado abaixo do header pra não sobrepor a nav inferior.
 */
export function CasaDaBeeFab() {
  const [hovered, setHovered] = useState(false);
  const [bobAnim, setBobAnim] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setBobAnim((n) => n + 1), 700);
    return () => clearInterval(interval);
  }, []);

  const beeOffsetY = bobAnim % 2 === 0 ? 0 : -1.5;

  return (
    <a
      href="/casa-da-bee"
      style={{ ...styles.fab, transform: hovered ? "scale(1.05)" : "scale(1)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Entrar na Casa da Bee"
      title="Entrar na Casa da Bee"
    >
      <svg width="32" height="32" viewBox="0 0 100 100" style={styles.svg}>
        {/* Telhado */}
        <path d="M 10 42 L 50 10 L 90 42 Z" fill="#7a4f18" />
        <path d="M 10 42 L 50 10 L 90 42 Z" fill="#5b3a24" opacity="0.3" />
        {/* Sombra base */}
        <rect x="12" y="88" width="76" height="4" fill="#231809" opacity="0.18" />
        {/* Corpo da casa (gradiente mel) */}
        <defs>
          <linearGradient id="house-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd95b" />
            <stop offset="1" stopColor="#e09a00" />
          </linearGradient>
        </defs>
        <rect x="18" y="42" width="64" height="48" fill="url(#house-grad)" />
        {/* Janelas em favo */}
        <circle cx="30" cy="60" r="6" fill="#231809" />
        <circle cx="70" cy="60" r="6" fill="#231809" />
        <circle cx="30" cy="60" r="3.8" fill="#fff4c2" />
        <circle cx="70" cy="60" r="3.8" fill="#fff4c2" />
        {/* Porta arqueada */}
        <path d="M 36 88 L 36 58 Q 36 48 50 48 Q 64 48 64 58 L 64 88 Z" fill="#3c2a12" />
        <path d="M 40 88 L 40 60 Q 40 50 50 50 Q 60 50 60 60 L 60 88 Z" fill="#2a1a08" />
        {/* Chaminé */}
        <rect x="68" y="18" width="10" height="18" fill="#5b3a24" />
        {/* Bee na porta */}
        <g transform={`translate(0, ${beeOffsetY})`}>
          {/* Asas */}
          <ellipse cx="40" cy="65" rx="6" ry="6" fill="#e8f4ff" opacity="0.7" />
          <ellipse cx="60" cy="65" rx="6" ry="6" fill="#e8f4ff" opacity="0.7" />
          {/* Antenas */}
          <line x1="46" y1="62" x2="44" y2="55" stroke="#22150b" strokeWidth="1.5" />
          <line x1="54" y1="62" x2="56" y2="55" stroke="#22150b" strokeWidth="1.5" />
          <circle cx="44" cy="54" r="1.8" fill="#22150b" />
          <circle cx="56" cy="54" r="1.8" fill="#22150b" />
          {/* Corpo */}
          <circle cx="50" cy="68" r="10" fill="#fbcb45" />
          {/* Listras */}
          <rect x="40" y="65" width="20" height="2.2" fill="#2a1a08" />
          <rect x="40" y="69" width="20" height="2.2" fill="#2a1a08" />
          {/* Olhos */}
          <circle cx="47" cy="64" r="1.2" fill="#22150b" />
          <circle cx="53" cy="64" r="1.2" fill="#22150b" />
        </g>
      </svg>
      <span style={styles.label}>Casa da Bee</span>
    </a>
  );
}

const styles: Record<string, React.CSSProperties> = {
  fab: {
    position: "fixed",
    top: 84,
    right: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px 4px 4px",
    borderRadius: 24,
    background: "rgba(255, 248, 214, 0.92)",
    border: "1.5px solid rgba(87, 61, 28, 0.55)",
    color: "#2a2014",
    textDecoration: "none",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: 800,
    fontSize: 11,
    cursor: "pointer",
    boxShadow: "0 3px 10px rgba(35, 24, 9, 0.18)",
    zIndex: 50,
    transition: "transform 0.18s ease-out",
  },
  svg: {
    display: "block",
  },
  label: {
    whiteSpace: "nowrap",
  },
};
