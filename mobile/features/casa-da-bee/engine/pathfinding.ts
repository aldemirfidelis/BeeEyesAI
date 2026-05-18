import { isWalkable } from "./maps";
import type { BeeHouseMap, Position } from "./types";

interface Node {
  position: Position;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

function key(p: Position): string {
  return `${p.x}:${p.y}`;
}

function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const NEIGHBORS: Position[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

export function findPath(map: BeeHouseMap, start: Position, goal: Position): Position[] {
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!isWalkable(map, goal)) {
    const fallback = nearestWalkable(map, goal);
    if (!fallback) return [];
    return findPath(map, start, fallback);
  }

  const open = new Map<string, Node>();
  const closed = new Set<string>();
  const startNode: Node = { position: start, g: 0, h: heuristic(start, goal), f: 0, parent: null };
  startNode.f = startNode.g + startNode.h;
  open.set(key(start), startNode);

  while (open.size > 0) {
    let current: Node | null = null;
    for (const node of open.values()) {
      if (!current || node.f < current.f) current = node;
    }
    if (!current) break;
    if (current.position.x === goal.x && current.position.y === goal.y) {
      return reconstruct(current);
    }

    open.delete(key(current.position));
    closed.add(key(current.position));

    for (const offset of NEIGHBORS) {
      const next: Position = { x: current.position.x + offset.x, y: current.position.y + offset.y };
      const nextKey = key(next);
      if (closed.has(nextKey)) continue;
      if (!isWalkable(map, next)) continue;

      const tentativeG = current.g + 1;
      const existing = open.get(nextKey);
      if (!existing || tentativeG < existing.g) {
        const h = heuristic(next, goal);
        const node: Node = {
          position: next,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        };
        open.set(nextKey, node);
      }
    }
  }

  return [];
}

function reconstruct(node: Node): Position[] {
  const path: Position[] = [];
  let cur: Node | null = node;
  while (cur && cur.parent) {
    path.unshift(cur.position);
    cur = cur.parent;
  }
  return path;
}

function nearestWalkable(map: BeeHouseMap, target: Position): Position | null {
  for (const offset of NEIGHBORS) {
    const candidate: Position = { x: target.x + offset.x, y: target.y + offset.y };
    if (isWalkable(map, candidate)) return candidate;
  }
  return null;
}
