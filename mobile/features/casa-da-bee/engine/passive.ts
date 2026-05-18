import { useCallback, useEffect, useRef, useState } from "react";
import { isWalkable } from "./maps";
import type { BeeHouseMap, MapItem, Position } from "./types";

const SPAWN_INTERVAL_MS = 42_000;
const MAX_ITEMS = 3;

let nextItemId = 1;

interface SpawnedItem extends MapItem {
  spawnedAt: number;
}

export function usePassivePollen(map: BeeHouseMap, beePosition: () => Position) {
  const [items, setItems] = useState<SpawnedItem[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spawn = useCallback(() => {
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      const bee = beePosition();
      // tenta achar tile walkable longe da Bee (pelo menos 2 tiles)
      for (let attempt = 0; attempt < 24; attempt++) {
        const x = Math.floor(Math.random() * map.width);
        const y = Math.floor(Math.random() * map.height);
        const candidate: Position = { x, y };
        if (!isWalkable(map, candidate)) continue;
        // distancia minima da Bee
        if (Math.abs(x - bee.x) + Math.abs(y - bee.y) < 2) continue;
        // nao spawnar onde ja tem item
        if (prev.some((i) => i.position.x === x && i.position.y === y)) continue;
        // 5% estrela rara (+10), 65% polen, 30% coracao
        const roll = Math.random();
        let type: "pollen" | "heart" | "star";
        let amount: number;
        if (roll < 0.05) {
          type = "star";
          amount = 10;
        } else if (roll < 0.7) {
          type = "pollen";
          amount = 1 + Math.floor(Math.random() * 3);
        } else {
          type = "heart";
          amount = 1;
        }
        return [
          ...prev,
          {
            id: `passive-${nextItemId++}`,
            type,
            position: candidate,
            amount,
            spawnedAt: Date.now(),
          },
        ];
      }
      return prev;
    });
  }, [beePosition, map]);

  const collect = useCallback(
    (id: string): SpawnedItem | null => {
      const target = items.find((i) => i.id === id) ?? null;
      if (target) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
      return target;
    },
    [items],
  );

  useEffect(() => {
    // primeiro spawn em ~8s, depois a cada SPAWN_INTERVAL_MS
    const initialDelay = setTimeout(() => {
      spawn();
      intervalRef.current = setInterval(spawn, SPAWN_INTERVAL_MS);
    }, 8000);
    return () => {
      clearTimeout(initialDelay);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [spawn]);

  return { items, collect };
}
