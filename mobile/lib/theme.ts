export type ThemeMode = "light" | "dark";
export type ThemePreference = "light" | "dark" | "system";

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
  primary: "#F5A623",
  primaryDark: "#D4851A",
  background: "#FAFAF5",
  card: "#FFFFFF",
  foreground: "#1A1A1A",
  muted: "#6B7280",
  border: "#E9DEC8",
  success: "#2F9D68",
  destructive: "#D64545",
  secondary: "#F5F0E8",
  accent: "#E6F4EC",
  chart1: "#FFD700",
  chart2: "#F5A623",
  chart3: "#2F9D68",
  chart4: "#7C62B8",
  chart5: "#2D8BBF",
};

const DARK_COLORS: ThemeColors = {
  primary: "#F5A623",
  primaryDark: "#FFD700",
  background: "#1A1A1A",
  card: "#2D2D2D",
  foreground: "#FFFFFF",
  muted: "#9CA3AF",
  border: "#3A342B",
  success: "#58C98E",
  destructive: "#FF7070",
  secondary: "#1F1F1F",
  accent: "#1E3028",
  chart1: "#FFD700",
  chart2: "#F5A623",
  chart3: "#58C98E",
  chart4: "#A890FF",
  chart5: "#61B8E8",
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
    md: 12,
    lg: 18,
    full: 9999,
  },
};
