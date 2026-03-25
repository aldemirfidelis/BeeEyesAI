import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

interface UserBasic {
  id: string;
  username: string;
  level: number;
  xp: number;
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
    await SecureStore.deleteItemAsync("bee_token");
    set({ token: null, user: null });
  },

  initialize: async () => {
    const token = await SecureStore.getItemAsync("bee_token");
    set({ token: token ?? null, isLoading: false });
  },
}));
