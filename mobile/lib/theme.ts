export type ThemeMode = "light" | "dark";

export type ThemeColors = {
  primary: string;
  primaryDark: string;
  background: string;
  card: string;
  foreground: string;
  muted: string;
  border: string;
  success: string;
  destructive: string;
  secondary: string;
  accent: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
};

const LIGHT_COLORS: ThemeColors = {
  primary: "#F5C842",
  primaryDark: "#D4A017",
  background: "#FFF8E7",
  card: "#FFFFFF",
  foreground: "#1A1A1A",
  muted: "#888888",
  border: "#E8E4E0",
  success: "#4CAF50",
  destructive: "#E53E3E",
  secondary: "#E8E4F0",
  accent: "#F0E6FF",
  chart1: "#F5C842",
  chart2: "#FF8C42",
  chart3: "#4CAF50",
  chart4: "#9B59B6",
  chart5: "#3498DB",
};

const DARK_COLORS: ThemeColors = {
  primary: "#F5C842",
  primaryDark: "#E7B530",
  background: "#141414",
  card: "#1E1E1E",
  foreground: "#F3F3F3",
  muted: "#A3A3A3",
  border: "#2E2E2E",
  success: "#57C26A",
  destructive: "#FF6E6E",
  secondary: "#2B2434",
  accent: "#2D273A",
  chart1: "#F5C842",
  chart2: "#FF9A57",
  chart3: "#57C26A",
  chart4: "#B082FF",
  chart5: "#53AEFF",
};

export function getThemeColors(mode: ThemeMode): ThemeColors {
  return mode === "dark" ? DARK_COLORS : LIGHT_COLORS;
}

export const COLORS = LIGHT_COLORS;

export const FONTS = {
  sans: "System",       // Will be replaced with Nunito once fonts load
  display: "System",    // Will be replaced with Fredoka
  mono: "monospace",    // Will be replaced with JetBrains Mono
};

export const SIZES = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  radius: {
    sm: 8,
    md: 16,
    lg: 24,
    full: 9999,
  },
};
