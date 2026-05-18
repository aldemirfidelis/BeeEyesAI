import { useEffect, useState } from "react";

/**
 * Banner que aparece SÓ no Safari iPhone/iPad (não no Android, não no desktop)
 * e oferece instalar a Bee como PWA via "Adicionar à Tela de Início".
 *
 * No Android, esse banner não aparece — o app oficial vem pela Play Store.
 * No desktop e demais browsers iOS (Chrome iOS, Edge iOS), o banner não aparece
 * porque a instalação PWA no iOS só funciona pelo Safari.
 *
 * Persistência: usuário pode dispensar — guardamos a escolha em localStorage
 * por 14 dias.
 */
const DISMISS_KEY = "bee-pwa-install-dismissed-until";
const DISMISS_DAYS = 14;

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream;
  return isiOS;
}

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Safari: tem "Safari" mas NÃO tem "CriOS" (Chrome iOS), "FxiOS" (Firefox iOS), "EdgiOS" (Edge iOS)
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function isAlreadyStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS: navigator.standalone | Outros: display-mode CSS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window.navigator as any).standalone) return true;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return false;
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const until = parseInt(raw, 10);
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function IosInstallPrompt() {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isIosDevice()) return;
    if (!isSafari()) return;
    if (isAlreadyStandalone()) return;
    if (isDismissed()) return;
    // Pequeno delay pra não interromper o load
    const handle = window.setTimeout(() => setShow(true), 1500);
    return () => window.clearTimeout(handle);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      // ignora
    }
  }

  if (!show) return null;

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <span style={styles.bee}>🐝</span>
        </div>
        <h3 style={styles.title}>Instale a Bee no seu iPhone</h3>
        <p style={styles.body}>
          Aproveite a Bee como aplicativo dedicado, com Casa da Bee, chat e tudo
          mais — direto da sua tela inicial.
        </p>

        {!expanded ? (
          <>
            <button
              onClick={() => setExpanded(true)}
              style={{ ...styles.primaryBtn }}
            >
              Como instalar
            </button>
            <button onClick={dismiss} style={styles.linkBtn}>
              Agora não
            </button>
          </>
        ) : (
          <>
            <ol style={styles.steps}>
              <li>
                Toca no botão{" "}
                <strong>
                  Compartilhar <span aria-hidden>⬆</span>
                </strong>{" "}
                na barra de baixo do Safari.
              </li>
              <li>
                Rola e toca em <strong>Adicionar à Tela de Início</strong>.
              </li>
              <li>
                Confirma o nome <strong>Bee</strong> → <strong>Adicionar</strong>.
              </li>
              <li>O ícone aparece na sua home. Toque pra abrir como app.</li>
            </ol>
            <button onClick={dismiss} style={styles.primaryBtn}>
              Entendi, vou instalar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(8, 6, 2, 0.78)",
    zIndex: 999,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "16px",
    paddingBottom: "max(20px, env(safe-area-inset-bottom))",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#fff8d6",
    borderRadius: 18,
    border: "2px solid rgba(87, 61, 28, 0.75)",
    padding: 20,
    boxShadow: "0 12px 40px rgba(35, 24, 9, 0.55)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#2c2114",
    textAlign: "center" as const,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    background: "#ffd95b",
    border: "2px solid rgba(78, 52, 24, 0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px",
  },
  bee: { fontSize: 32, lineHeight: 1 },
  title: {
    fontSize: 20,
    fontWeight: 900,
    margin: "0 0 8px",
    color: "#2c2114",
  },
  body: {
    fontSize: 14,
    lineHeight: 1.45,
    color: "#5e4520",
    margin: "0 0 16px",
    fontWeight: 600,
  },
  steps: {
    textAlign: "left" as const,
    fontSize: 13,
    lineHeight: 1.55,
    color: "#3c2a12",
    paddingLeft: 18,
    margin: "0 0 14px",
  },
  primaryBtn: {
    width: "100%",
    padding: "12px 18px",
    borderRadius: 12,
    border: "2px solid rgba(78, 52, 24, 0.72)",
    background: "#ffd95b",
    color: "#2a2014",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    marginBottom: 8,
  },
  linkBtn: {
    width: "100%",
    padding: "10px 12px",
    background: "transparent",
    color: "#7a4f18",
    border: "none",
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "underline",
    cursor: "pointer",
  },
};
