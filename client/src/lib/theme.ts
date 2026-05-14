export type ThemeMode = "light" | "dark";
export type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "theme";
const THEME_PREF_KEY = "theme_preference";
const THEME_EVENT = "bee-theme-changed";

function systemPreference(): ThemeMode {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readPreference(): ThemePreference {
  const stored = typeof window !== "undefined" ? localStorage.getItem(THEME_PREF_KEY) : null;
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  // Fallback to legacy key
  const legacy = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
  if (legacy === "light" || legacy === "dark") return legacy;
  return "system";
}

export function resolveInitialTheme(): ThemeMode {
  const pref = readPreference();
  if (pref === "system") return systemPreference();
  return pref;
}

export function applyTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

export function setPreference(pref: ThemePreference) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_PREF_KEY, pref);
  const resolved = pref === "system" ? systemPreference() : pref;
  applyTheme(resolved);
}

export function readTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" ? "dark" : "light";
}

export function onThemeChange(listener: (theme: ThemeMode) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ThemeMode>;
    listener(customEvent.detail);
  };
  window.addEventListener(THEME_EVENT, handler);

  // Also listen to OS-level changes when preference is "system"
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const mqHandler = () => {
    if (readPreference() === "system") {
      const next = systemPreference();
      applyTheme(next);
    }
  };
  mq.addEventListener?.("change", mqHandler);

  return () => {
    window.removeEventListener(THEME_EVENT, handler);
    mq.removeEventListener?.("change", mqHandler);
  };
}
