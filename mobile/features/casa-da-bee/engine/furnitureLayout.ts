import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import type { Position } from "./types";

const STORAGE_KEY = "bee-house-furniture-layout-v1";

export type FurnitureLayout = Record<string, Position>;

export function useFurnitureLayout() {
  const [layout, setLayout] = useState<FurnitureLayout>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (raw) setLayout(JSON.parse(raw) as FurnitureLayout);
      } catch {
        // ignora
      }
      setLoaded(true);
    })();
  }, []);

  const move = useCallback(async (stationId: string, position: Position) => {
    setLayout((prev) => {
      const next = { ...prev, [stationId]: position };
      SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const reset = useCallback(async () => {
    setLayout({});
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } catch {
      // ignora
    }
  }, []);

  const getPosition = useCallback(
    (stationId: string, defaultPosition: Position): Position => {
      return layout[stationId] ?? defaultPosition;
    },
    [layout],
  );

  return { layout, loaded, move, reset, getPosition };
}
