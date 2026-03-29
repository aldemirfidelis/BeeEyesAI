import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { ThemeMode } from "../lib/theme";

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
  themeMode: ThemeMode;
  profileImageUri: string | null;
  isPreferencesReady: boolean;
  setEyeExpression: (expr: EyeExpression) => void;
  showAchievement: (achievement: Achievement) => void;
  clearAchievement: () => void;
  initializePreferences: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setProfileImageUri: (uri: string | null) => Promise<void>;
}

export const useUIStore = create<UIState>((set) => ({
  eyeExpression: "neutral",
  achievement: null,
  themeMode: "light",
  profileImageUri: null,
  isPreferencesReady: false,

  setEyeExpression: (expr) => set({ eyeExpression: expr }),
  showAchievement: (achievement) => set({ achievement }),
  clearAchievement: () => set({ achievement: null }),

  initializePreferences: async () => {
    try {
      const [savedThemeMode, savedProfileImageUri] = await Promise.all([
        SecureStore.getItemAsync("bee_theme_mode"),
        SecureStore.getItemAsync("bee_profile_image_uri"),
      ]);

      const themeMode: ThemeMode = savedThemeMode === "dark" ? "dark" : "light";
      set({
        themeMode,
        profileImageUri: savedProfileImageUri || null,
      });
    } finally {
      set({ isPreferencesReady: true });
    }
  },

  setThemeMode: async (mode) => {
    await SecureStore.setItemAsync("bee_theme_mode", mode);
    set({ themeMode: mode });
  },

  setProfileImageUri: async (uri) => {
    if (uri) {
      await SecureStore.setItemAsync("bee_profile_image_uri", uri);
    } else {
      await SecureStore.deleteItemAsync("bee_profile_image_uri");
    }
    set({ profileImageUri: uri });
  },
}));
