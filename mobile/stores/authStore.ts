import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { useUIStore } from "./uiStore";

interface UserBasic {
  id: string;
  username: string;
  email?: string | null;
  displayName?: string | null;
  gender?: string | null;
  level: number;
  xp: number;
  anonymousProfileVisitsEnabled?: boolean;
  bio?: string | null;
  language?: string;
  onboardingCompleted?: boolean;
  avatarUrl?: string | null;
  currentStreak: number;
}

interface AuthState {
  token: string | null;
  user: UserBasic | null;
  isLoading: boolean;
  setToken: (token: string) => void;
  setUser: (user: UserBasic) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true,

  setToken: (token) => set({ token }),
  setUser: (user) => set({ user }),

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync("bee_token");
      await useUIStore.getState().clearProfileImage();
    } finally {
      set({ token: null, user: null });
    }
  },

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync("bee_token");
      set({ token: token ?? null });
    } catch {
      set({ token: null, user: null });
    } finally {
      set({ isLoading: false });
    }
  },
}));
