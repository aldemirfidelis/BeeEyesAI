import { useCallback, useEffect, useRef, useState } from "react";
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

export interface BeePixel {
  x: number;        // tile coord (int) onde a Bee esta logicamente
  y: number;
  pixelX: number;   // posicao animada em tile-units (float)
  pixelY: number;
  facing: number;   // 0=down, 1=up, 2=left, 3=right
}

export interface BeeGameApi {
  map: BeeHouseMap;
  stats: BeeStats;
  state: BeeState;
  getBeePixel: () => BeePixel;
  walkToTile: (target: Position, then?: () => void) => void;
  walkToStation: (stationId: string, then?: () => void) => void;
  pushTask: (task: PendingTask) => void;
  applyHouseSnapshot: (snapshot: Partial<BeeStats>) => void;
  setStats: React.Dispatch<React.SetStateAction<BeeStats>>;
}

export const FACING = { down: 0, up: 1, left: 2, right: 3 } as const;

function dirToFacing(from: Position, to: Position): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? FACING.right : FACING.left;
  return dy > 0 ? FACING.down : FACING.up;
}

export function useBeeGame(options: UseBeeGameOptions = {}): BeeGameApi {
  const map = useRef(buildHouseMap()).current;
  const [stats, setStats] = useState<BeeStats>(DEFAULT_STATS);
  const [state, setState] = useState<BeeState>("idle");

  // Posicao da Bee armazenada em ref pra animacao por rAF nao re-renderizar React
  const beePixel = useRef<BeePixel>({
    x: map.start.x,
    y: map.start.y,
    pixelX: map.start.x,
    pixelY: map.start.y,
    facing: FACING.down,
  });

  const walkChainRef = useRef<{ cancelled: boolean } | null>(null);
  const ambientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelOngoing = useCallback(() => {
    if (walkChainRef.current) walkChainRef.current.cancelled = true;
  }, []);

  const stepTo = useCallback((target: Position): Promise<void> => {
    return new Promise((resolve) => {
      const startX = beePixel.current.pixelX;
      const startY = beePixel.current.pixelY;
      const startTs = performance.now();
      beePixel.current.facing = dirToFacing({ x: beePixel.current.x, y: beePixel.current.y }, target);
      beePixel.current.x = target.x;
      beePixel.current.y = target.y;

      function tick() {
        const elapsed = performance.now() - startTs;
        const t = Math.min(1, elapsed / WALK_MS_PER_TILE);
        // easing leve (easeOutQuad)
        const eased = 1 - (1 - t) * (1 - t);
        beePixel.current.pixelX = startX + (target.x - startX) * eased;
        beePixel.current.pixelY = startY + (target.y - startY) * eased;
        if (t < 1) requestAnimationFrame(tick);
        else {
          beePixel.current.pixelX = target.x;
          beePixel.current.pixelY = target.y;
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }, []);

  const walkPath = useCallback(
    async (path: Position[], then?: () => void) => {
      if (path.length === 0) { then?.(); return; }
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
      const start: Position = { x: beePixel.current.x, y: beePixel.current.y };
      const path = findPath(map, start, target);
      if (path.length === 0) { then?.(); return; }
      walkPath(path, then);
    },
    [map, walkPath],
  );

  const walkToStation = useCallback(
    (stationId: string, then?: () => void) => {
      const station = map.stations.find((s) => s.id === stationId);
      if (!station) { then?.(); return; }
      // anda ate o tile adjacente walkable mais perto (a propria posicao da station eh um block)
      const adjacents: Position[] = [
        { x: station.position.x - 1, y: station.position.y },
        { x: station.position.x + 1, y: station.position.y },
        { x: station.position.x, y: station.position.y - 1 },
        { x: station.position.x, y: station.position.y + 1 },
      ].filter((p) => isWalkable(map, p));
      const target = adjacents[0] ?? station.position;
      walkToTile(target, then);
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

  // Wander ambiente: a cada 4-7s, se idle, anda pra um tile aleatorio proximo
  useEffect(() => {
    function wanderRandom() {
      const current = { x: beePixel.current.x, y: beePixel.current.y };
      for (let attempt = 0; attempt < 8; attempt++) {
        const dx = Math.floor(Math.random() * (IDLE_RADIUS * 2 + 1)) - IDLE_RADIUS;
        const dy = Math.floor(Math.random() * (IDLE_RADIUS * 2 + 1)) - IDLE_RADIUS;
        const candidate = { x: current.x + dx, y: current.y + dy };
        if (isWalkable(map, candidate)) { walkToTile(candidate); return; }
      }
    }
    function scheduleAmbient() {
      ambientTimerRef.current = setTimeout(() => {
        if (state === "idle") wanderRandom();
        scheduleAmbient();
      }, 4000 + Math.random() * 3000);
    }
    scheduleAmbient();
    return () => { if (ambientTimerRef.current) clearTimeout(ambientTimerRef.current); };
  }, [map, state, walkToTile]);

  const getBeePixel = useCallback(() => beePixel.current, []);

  return {
    map,
    stats,
    state,
    getBeePixel,
    walkToTile,
    walkToStation,
    pushTask,
    applyHouseSnapshot,
    setStats,
  };
}
