import { create } from "zustand";

export type BeePetState =
  | "idle"
  | "walking"
  | "working"
  | "happy"
  | "sleeping"
  | "celebrating"
  | "thinking";

export type BeePetTarget = "search" | "train" | "calendar" | "study" | "sleep" | null;

interface BeePetStore {
  // Estado visual da Bee
  state: BeePetState;
  target: BeePetTarget;
  speech: string | null;
  // Contadores que motivam visitar a casa
  pendingPollen: number;
  unseenAchievements: number;
  // Timestamp de ultima atividade
  lastTaskAt: number | null;
  lastVisitedHouseAt: number | null;
  // Task ativa (do backend)
  activeTaskId: string | null;
  isWorking: boolean;
  // Outfit equipado (ids dos itens) - sincronizado pela CasaDaBeeNativeScreen
  equippedHatId: string;
  equippedAccessoryId: string;
  equippedBodyId: string;

  // Actions
  setBeeState: (state: BeePetState, target?: BeePetTarget) => void;
  speak: (message: string, durationMs?: number) => void;
  clearSpeech: () => void;
  startTask: (taskId: string, target: BeePetTarget, speech?: string | null) => void;
  finishTask: (pollenEarned: number) => void;
  addPendingPollen: (amount: number) => void;
  resetPendingPollen: () => void;
  markVisitedHouse: () => void;
  setEquippedOutfit: (hatId: string, accessoryId: string, bodyId: string) => void;
}

let speechTimer: ReturnType<typeof setTimeout> | null = null;

export const useBeePetStore = create<BeePetStore>((set, get) => ({
  state: "idle",
  target: null,
  speech: null,
  pendingPollen: 0,
  unseenAchievements: 0,
  lastTaskAt: null,
  lastVisitedHouseAt: null,
  activeTaskId: null,
  isWorking: false,
  equippedHatId: "hat-none",
  equippedAccessoryId: "acc-none",
  equippedBodyId: "body-yellow",

  setBeeState: (state, target) => set({ state, target: target ?? get().target }),
  setEquippedOutfit: (hatId, accessoryId, bodyId) =>
    set({ equippedHatId: hatId, equippedAccessoryId: accessoryId, equippedBodyId: bodyId }),

  speak: (message, durationMs = 4500) => {
    set({ speech: message });
    if (speechTimer) clearTimeout(speechTimer);
    speechTimer = setTimeout(() => {
      set({ speech: null });
      speechTimer = null;
    }, durationMs);
  },

  clearSpeech: () => {
    if (speechTimer) {
      clearTimeout(speechTimer);
      speechTimer = null;
    }
    set({ speech: null });
  },

  startTask: (taskId, target, speech) => {
    set({
      activeTaskId: taskId,
      target,
      state: "walking",
      isWorking: true,
      lastTaskAt: Date.now(),
    });
    if (speech) {
      get().speak(speech);
    } else {
      const speeches: Record<string, string> = {
        search: "Voando pro notebook... 💻",
        train: "Indo treinar! 💪",
        calendar: "Conferindo a agenda 📅",
        study: "Hora de estudar 📚",
        sleep: "Indo descansar 💤",
      };
      const t = target ?? "search";
      get().speak(speeches[t] ?? "Trabalhando pra você...");
    }
    // Transição walking → working após 2s
    setTimeout(() => {
      if (get().activeTaskId === taskId) {
        set({ state: "working" });
      }
    }, 2200);
  },

  finishTask: (pollenEarned) => {
    set({
      activeTaskId: null,
      target: null,
      isWorking: false,
      state: "happy",
      pendingPollen: get().pendingPollen + pollenEarned,
    });
    get().speak(`Pronto! +${pollenEarned} pólen 🎉`);
    setTimeout(() => {
      if (get().state === "happy") set({ state: "idle" });
    }, 3500);
  },

  addPendingPollen: (amount) =>
    set({ pendingPollen: get().pendingPollen + amount }),

  resetPendingPollen: () => set({ pendingPollen: 0 }),

  markVisitedHouse: () =>
    set({ lastVisitedHouseAt: Date.now(), pendingPollen: 0 }),
}));
