export type ThemeMode = "light" | "dark";

const THEME_KEY = "theme";
const THEME_EVENT = "bee-theme-changed";

export function resolveInitialTheme(): ThemeMode {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: ThemeMode) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

export function readTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" ? "dark" : "light";
}

export function onThemeChange(listener: (theme: ThemeMode) => void) {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ThemeMode>;
    listener(customEvent.detail);
  };
  window.addEventListener(THEME_EVENT, handler);
  return () => window.removeEventListener(THEME_EVENT, handler);
}
