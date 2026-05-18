import { useEffect, useRef, useState } from "react";

/**
 * Página /casa-da-bee-skia (Vite/client antigo).
 *
 * Renderiza a Casa da Bee Skia (PWA Expo) dentro de um iframe full-screen.
 * É o "atalho" que coloca a nova Casa visualmente disponível no site web sem
 * precisar duplicar todo o código React Native em React Web.
 *
 * O iframe aponta diretamente pra rota `/pwa/casa-da-bee` da PWA Expo.
 * Como ambos compartilham o mesmo domínio (beeyes.net), não há restrição CORS.
 */
export default function CasaDaBeeSkia() {
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Trava o scroll do body enquanto a página está aberta
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, []);

  return (
    <div style={styles.root}>
      {!loaded && (
        <div style={styles.loading}>
          <div style={styles.bee}>🐝</div>
          <div style={styles.loadingTitle}>Carregando Casa da Bee...</div>
          <div style={styles.loadingSub}>
            Primeira vez pode demorar uns segundos enquanto o motor 2D
            carrega.
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src="/pwa/casa-da-bee"
        style={{
          ...styles.iframe,
          opacity: loaded ? 1 : 0,
        }}
        onLoad={() => setLoaded(true)}
        allow="fullscreen; camera; microphone; geolocation"
        title="Casa da Bee"
      />

      <a href="/" style={styles.closeBtn} aria-label="Voltar pro site">
        ←
      </a>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "fixed",
    inset: 0,
    background: "#160f04",
    zIndex: 1,
  },
  iframe: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: 0,
    transition: "opacity 0.4s ease-out",
  },
  loading: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff8d6",
    gap: 10,
    padding: 24,
    textAlign: "center",
  },
  bee: { fontSize: 56, animation: "bee-bounce 1.4s ease-in-out infinite" },
  loadingTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#2c2114",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  loadingSub: {
    fontSize: 13,
    color: "#5e4520",
    fontWeight: 600,
    maxWidth: 320,
    lineHeight: 1.4,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  closeBtn: {
    position: "fixed",
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "rgba(255, 248, 214, 0.94)",
    border: "2px solid rgba(87, 61, 28, 0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    color: "#2a2014",
    textDecoration: "none",
    zIndex: 10,
    fontWeight: 900,
    boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
  },
};
