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
  primary: "#F6C94A",
  primaryDark: "#B98005",
  background: "#FFF9EA",
  card: "#FFFFFF",
  foreground: "#241D0F",
  muted: "#756B5D",
  border: "#E7DCC6",
  success: "#2F9D68",
  destructive: "#D64545",
  secondary: "#F4E9CF",
  accent: "#E6F4EC",
  chart1: "#F6C94A",
  chart2: "#EC8A2E",
  chart3: "#2F9D68",
  chart4: "#7C62B8",
  chart5: "#2D8BBF",
};

const DARK_COLORS: ThemeColors = {
  primary: "#F6C94A",
  primaryDark: "#F0B72F",
  background: "#141007",
  card: "#201A10",
  foreground: "#F7EFD9",
  muted: "#B9AC92",
  border: "#342B1B",
  success: "#58C98E",
  destructive: "#FF7070",
  secondary: "#2B2418",
  accent: "#1E3028",
  chart1: "#F6C94A",
  chart2: "#FF9C55",
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
