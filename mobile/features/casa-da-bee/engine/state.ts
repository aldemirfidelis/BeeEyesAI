import { useCallback, useEffect, useRef, useState } from "react";
import { runOnJS, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { findPath } from "./pathfinding";
import { buildHouseMap, isWalkable } from "./maps";
import {
  DEFAULT_STATS,
  TASK_TARGETS,
  type BeeHouseMap,
  type BeeState,
  type BeeStats,
  type Position,
  type Station,
  type PendingTask,
} from "./types";

const WALK_MS_PER_TILE = 280;
const TASK_WORK_MS = 1800;
const IDLE_RADIUS = 4;

export interface UseBeeGameOptions {
  onTaskAck?: (taskId: string, target: string) => void;
  onTaskDone?: (taskId: string, target: string, reward: number, xp: number) => void;
  onStationInteract?: (station: Station) => void;
  onSpeech?: (message: string) => void;
  onLevelUp?: (newLevel: number) => void;
}

export interface BeeGameApi {
  map: BeeHouseMap;
  stats: BeeStats;
  state: BeeState;
  tileX: SharedValue<number>;
  tileY: SharedValue<number>;
  facing: SharedValue<number>;
  pixelX: SharedValue<number>;
  pixelY: SharedValue<number>;
  walkToTile: (target: Position, then?: () => void) => void;
  walkToStation: (stationId: string, then?: () => void) => void;
  pushTask: (task: PendingTask) => void;
  applyHouseSnapshot: (snapshot: Partial<BeeStats>) => void;
}

const FACING = { down: 0, up: 1, left: 2, right: 3 } as const;

function dirToFacing(from: Position, to: Position): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? FACING.right : FACING.left;
  }
  return dy > 0 ? FACING.down : FACING.up;
}

export function useBeeGame(options: UseBeeGameOptions = {}): BeeGameApi {
  const map = useRef(buildHouseMap()).current;
  const [stats, setStats] = useState<BeeStats>(DEFAULT_STATS);
  const [state, setState] = useState<BeeState>("idle");

  const tileX = useSharedValue<number>(map.start.x);
  const tileY = useSharedValue<number>(map.start.y);
  const facing = useSharedValue<number>(FACING.down);
  const pixelX = useSharedValue<number>(map.start.x);
  const pixelY = useSharedValue<number>(map.start.y);

  const walkChainRef = useRef<{ cancelled: boolean } | null>(null);
  const ambientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelOngoing = useCallback(() => {
    if (walkChainRef.current) walkChainRef.current.cancelled = true;
  }, []);

  const stepTo = useCallback(
    (target: Position) =>
      new Promise<void>((resolve) => {
        facing.value = dirToFacing({ x: tileX.value, y: tileY.value }, target);
        tileX.value = target.x;
        tileY.value = target.y;
        pixelX.value = withTiming(target.x, { duration: WALK_MS_PER_TILE });
        pixelY.value = withTiming(target.y, { duration: WALK_MS_PER_TILE }, (finished) => {
          if (finished) runOnJS(resolve)();
          else runOnJS(resolve)();
        });
      }),
    [facing, pixelX, pixelY, tileX, tileY],
  );

  const walkPath = useCallback(
    async (path: Position[], then?: () => void) => {
      if (path.length === 0) {
        then?.();
        return;
      }
      cancelOngoing();
      const chain = { cancelled: false };
      walkChainRef.current = chain;
      setState("walking");
      for (const step of path) {
        if (chain.cancelled) return;
        await stepTo(step);
      }
      if (chain.cancelled) return;
      setState("idle");
      then?.();
    },
    [cancelOngoing, stepTo],
  );

  const walkToTile = useCallback(
    (target: Position, then?: () => void) => {
      const start: Position = { x: tileX.value, y: tileY.value };
      const path = findPath(map, start, target);
      if (path.length === 0) {
        then?.();
        return;
      }
      walkPath(path, then);
    },
    [map, tileX, tileY, walkPath],
  );

  const walkToStation = useCallback(
    (stationId: string, then?: () => void) => {
      const station = map.stations.find((s) => s.id === stationId);
      if (!station) {
        then?.();
        return;
      }
      walkToTile(station.position, then);
    },
    [map, walkToTile],
  );

  const pushTask = useCallback(
    (task: PendingTask) => {
      const target = TASK_TARGETS[task.target];
      const station = map.stations.find((s) => s.id === target.stationId);
      if (!station) return;

      options.onTaskAck?.(task.id, task.target);

      walkToStation(station.id, () => {
        setState("working");
        options.onSpeech?.(target.arrival);
        setTimeout(() => {
          setState("happy");
          setStats((prev) => {
            const merged: BeeStats = {
              ...prev,
              pollen: prev.pollen + task.reward,
              xp: prev.xp + (task.xp ?? 0),
              mood: "happy",
              location: station.title,
              quest: `${target.label} concluido!`,
            };
            const threshold = merged.level * 100;
            if (merged.xp >= threshold) {
              const newLevel = merged.level + 1;
              options.onLevelUp?.(newLevel);
              return { ...merged, level: newLevel };
            }
            return merged;
          });
          options.onTaskDone?.(task.id, task.target, task.reward, task.xp ?? 0);
          options.onStationInteract?.(station);
          setTimeout(() => setState("idle"), 1200);
        }, TASK_WORK_MS);
      });
    },
    [map, options, walkToStation],
  );

  const applyHouseSnapshot = useCallback(
    (snapshot: Partial<BeeStats>) => {
      setStats((prev) => {
        const merged = { ...prev, ...snapshot };
        // Verifica level-up: cada nivel exige nivel * 100 XP acumulado
        const threshold = merged.level * 100;
        if (merged.xp >= threshold) {
          const newLevel = merged.level + 1;
          options.onLevelUp?.(newLevel);
          return { ...merged, level: newLevel };
        }
        return merged;
      });
    },
    [options],
  );

  useEffect(() => {
    function scheduleAmbient() {
      ambientTimerRef.current = setTimeout(() => {
        if (state === "idle") wanderRandom();
        scheduleAmbient();
      }, 4000 + Math.random() * 3000);
    }

    function wanderRandom() {
      const current = { x: tileX.value, y: tileY.value };
      for (let attempt = 0; attempt < 8; attempt++) {
        const dx = Math.floor(Math.random() * (IDLE_RADIUS * 2 + 1)) - IDLE_RADIUS;
        const dy = Math.floor(Math.random() * (IDLE_RADIUS * 2 + 1)) - IDLE_RADIUS;
        const candidate = { x: current.x + dx, y: current.y + dy };
        if (isWalkable(map, candidate)) {
          walkToTile(candidate);
          return;
        }
      }
    }

    scheduleAmbient();
    return () => {
      if (ambientTimerRef.current) clearTimeout(ambientTimerRef.current);
    };
  }, [map, state, tileX, tileY, walkToTile]);

  return {
    map,
    stats,
    state,
    tileX,
    tileY,
    facing,
    pixelX,
    pixelY,
    walkToTile,
    walkToStation,
    pushTask,
    applyHouseSnapshot,
  };
}
