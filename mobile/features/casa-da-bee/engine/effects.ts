import { useCallback, useMemo, useRef, useState } from "react";

export type EffectKind = "particle-burst" | "floating-text" | "confetti";

export interface Effect {
  id: string;
  kind: EffectKind;
  x: number;
  y: number;
  createdAt: number;
  payload: {
    text?: string;
    color?: string;
    icon?: string;
    count?: number;
    durationMs?: number;
  };
}

export interface EffectsApi {
  effects: Effect[];
  spawnParticleBurst: (x: number, y: number, opts?: { color?: string; count?: number; durationMs?: number }) => void;
  spawnFloatingText: (x: number, y: number, text: string, opts?: { color?: string; icon?: string; durationMs?: number }) => void;
  spawnConfetti: (x: number, y: number, opts?: { count?: number; durationMs?: number }) => void;
}

let nextId = 1;

export function useEffectsLayer(): EffectsApi {
  const [effects, setEffects] = useState<Effect[]>([]);
  const timeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: string) => {
    setEffects((prev) => prev.filter((e) => e.id !== id));
    const handle = timeouts.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timeouts.current.delete(id);
    }
  }, []);

  const spawn = useCallback(
    (effect: Effect) => {
      setEffects((prev) => [...prev, effect]);
      const handle = setTimeout(() => remove(effect.id), effect.payload.durationMs ?? 1200);
      timeouts.current.set(effect.id, handle);
    },
    [remove],
  );

  const spawnParticleBurst = useCallback(
    (x: number, y: number, opts?: { color?: string; count?: number; durationMs?: number }) => {
      spawn({
        id: `fx-${nextId++}`,
        kind: "particle-burst",
        x,
        y,
        createdAt: Date.now(),
        payload: {
          color: opts?.color ?? "#fbe27a",
          count: opts?.count ?? 12,
          durationMs: opts?.durationMs ?? 800,
        },
      });
    },
    [spawn],
  );

  const spawnFloatingText = useCallback(
    (x: number, y: number, text: string, opts?: { color?: string; icon?: string; durationMs?: number }) => {
      spawn({
        id: `fx-${nextId++}`,
        kind: "floating-text",
        x,
        y,
        createdAt: Date.now(),
        payload: {
          text,
          icon: opts?.icon,
          color: opts?.color ?? "#fff4c2",
          durationMs: opts?.durationMs ?? 1400,
        },
      });
    },
    [spawn],
  );

  const spawnConfetti = useCallback(
    (x: number, y: number, opts?: { count?: number; durationMs?: number }) => {
      spawn({
        id: `fx-${nextId++}`,
        kind: "confetti",
        x,
        y,
        createdAt: Date.now(),
        payload: {
          count: opts?.count ?? 40,
          durationMs: opts?.durationMs ?? 1800,
        },
      });
    },
    [spawn],
  );

  return useMemo(
    () => ({ effects, spawnParticleBurst, spawnFloatingText, spawnConfetti }),
    [effects, spawnParticleBurst, spawnFloatingText, spawnConfetti],
  );
}
