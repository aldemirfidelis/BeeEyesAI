import { create } from "zustand";

export type EyeExpression = "neutral" | "happy" | "excited" | "curious" | "sleepy" | "celebrating";

interface Achievement {
  id: string;
  type: string;
  title: string;
  description: string;
}

interface UIState {
  eyeExpression: EyeExpression;
  achievement: Achievement | null;
  setEyeExpression: (expr: EyeExpression) => void;
  showAchievement: (achievement: Achievement) => void;
  clearAchievement: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  eyeExpression: "neutral",
  achievement: null,

  setEyeExpression: (expr) => set({ eyeExpression: expr }),
  showAchievement: (achievement) => set({ achievement }),
  clearAchievement: () => set({ achievement: null }),
}));
