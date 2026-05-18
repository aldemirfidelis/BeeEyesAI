export type TimeOfDay = "dawn" | "morning" | "noon" | "afternoon" | "dusk" | "night";

export interface DayNightConfig {
  label: string;
  vignetteColors: [string, string, string];
  ambientTint: string;
  lightStrength: number;
}

export const DAY_NIGHT_PRESETS: Record<TimeOfDay, DayNightConfig> = {
  dawn: {
    label: "Amanhecer",
    vignetteColors: ["rgba(255, 200, 130, 0)", "rgba(255, 160, 120, 0.08)", "rgba(50, 30, 60, 0.55)"],
    ambientTint: "rgba(255, 180, 130, 0.05)",
    lightStrength: 0.55,
  },
  morning: {
    label: "Manhã",
    vignetteColors: ["rgba(255, 240, 200, 0)", "rgba(255, 220, 160, 0.04)", "rgba(40, 30, 20, 0.18)"],
    ambientTint: "rgba(255, 240, 200, 0.03)",
    lightStrength: 0.95,
  },
  noon: {
    label: "Tarde",
    vignetteColors: ["rgba(255, 250, 220, 0)", "rgba(255, 240, 180, 0.02)", "rgba(20, 15, 5, 0.12)"],
    ambientTint: "rgba(255, 250, 220, 0)",
    lightStrength: 1,
  },
  afternoon: {
    label: "Tarde",
    vignetteColors: ["rgba(255, 220, 160, 0)", "rgba(255, 190, 130, 0.06)", "rgba(60, 35, 15, 0.28)"],
    ambientTint: "rgba(255, 200, 150, 0.05)",
    lightStrength: 0.85,
  },
  dusk: {
    label: "Entardecer",
    vignetteColors: ["rgba(255, 160, 100, 0)", "rgba(220, 100, 90, 0.1)", "rgba(40, 20, 60, 0.55)"],
    ambientTint: "rgba(220, 130, 100, 0.08)",
    lightStrength: 0.5,
  },
  night: {
    label: "Noite",
    vignetteColors: ["rgba(180, 200, 255, 0)", "rgba(120, 140, 220, 0.08)", "rgba(8, 10, 26, 0.78)"],
    ambientTint: "rgba(120, 150, 220, 0.06)",
    lightStrength: 0.3,
  },
};

export function getTimeOfDay(hour: number = new Date().getHours()): TimeOfDay {
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "noon";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 19) return "dusk";
  return "night";
}
