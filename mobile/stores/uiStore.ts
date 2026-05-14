import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";
import type { ThemeMode, ThemePreference } from "../lib/theme";

function resolveFromPreference(pref: ThemePreference): ThemeMode {
  if (pref === "light" || pref === "dark") return pref;
  const sys = Appearance.getColorScheme?.();
  return sys === "dark" ? "dark" : "light";
}

export type EyeExpression = "neutral" | "happy" | "excited" | "curious" | "sleepy" | "celebrating";

interface Achievement {
  id: string;
  type: string;
  title: string;
  description: string;
}

export interface PendingDMUser {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
  avatarUrl?: string | null;
}

interface UIState {
  eyeExpression: EyeExpression;
  achievement: Achievement | null;
  themeMode: ThemeMode;
  themePreference: ThemePreference;
  profileImageUri: string | null;
  isPreferencesReady: boolean;
  pendingDMUser: PendingDMUser | null;
  setEyeExpression: (expr: EyeExpression) => void;
  showAchievement: (achievement: Achievement) => void;
  clearAchievement: () => void;
  initializePreferences: (serverAvatarUrl?: string | null) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
  setProfileImageUri: (uri: string | null) => Promise<void>;
  clearProfileImage: () => Promise<void>;
  setPendingDMUser: (user: PendingDMUser | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  eyeExpression: "neutral",
  achievement: null,
  themeMode: "light",
  themePreference: "light",
  profileImageUri: null,
  isPreferencesReady: false,
  pendingDMUser: null,

  setEyeExpression: (expr) => set({ eyeExpression: expr }),
  setPendingDMUser: (user) => set({ pendingDMUser: user }),
  showAchievement: (achievement) => set({ achievement }),
  clearAchievement: () => set({ achievement: null }),

  initializePreferences: async (serverAvatarUrl?: string | null) => {
    try {
      const [savedThemePref, savedThemeMode, savedProfileImageUri] = await Promise.all([
        SecureStore.getItemAsync("bee_theme_preference"),
        SecureStore.getItemAsync("bee_theme_mode"),
        SecureStore.getItemAsync("bee_profile_image_uri"),
      ]);

      let themePreference: ThemePreference;
      if (savedThemePref === "light" || savedThemePref === "dark" || savedThemePref === "system") {
        themePreference = savedThemePref;
      } else if (savedThemeMode === "light" || savedThemeMode === "dark") {
        themePreference = savedThemeMode;
      } else {
        themePreference = "light";
      }
      const themeMode: ThemeMode = resolveFromPreference(themePreference);
      const profileImageUri = savedProfileImageUri || serverAvatarUrl || null;

      if (serverAvatarUrl && !savedProfileImageUri) {
        await SecureStore.setItemAsync("bee_profile_image_uri", serverAvatarUrl);
      }

      set({ themeMode, themePreference, profileImageUri });

      // Listener para mudanças do sistema quando preferência é "system"
      Appearance.addChangeListener?.(({ colorScheme }) => {
        if (useUIStore.getState().themePreference === "system") {
          const next: ThemeMode = colorScheme === "dark" ? "dark" : "light";
          set({ themeMode: next });
        }
      });
    } finally {
      set({ isPreferencesReady: true });
    }
  },

  setThemeMode: async (mode) => {
    await SecureStore.setItemAsync("bee_theme_mode", mode);
    await SecureStore.setItemAsync("bee_theme_preference", mode);
    set({ themeMode: mode, themePreference: mode });
  },

  setThemePreference: async (pref) => {
    await SecureStore.setItemAsync("bee_theme_preference", pref);
    const resolved = resolveFromPreference(pref);
    await SecureStore.setItemAsync("bee_theme_mode", resolved);
    set({ themeMode: resolved, themePreference: pref });
  },

  setProfileImageUri: async (uri) => {
    if (uri) {
      await SecureStore.setItemAsync("bee_profile_image_uri", uri);
    } else {
      await SecureStore.deleteItemAsync("bee_profile_image_uri");
    }
    set({ profileImageUri: uri });
  },

  clearProfileImage: async () => {
    await SecureStore.deleteItemAsync("bee_profile_image_uri");
    set({ profileImageUri: null });
  },
}));
