import { NativeModules } from "react-native";
import { api } from "@mobile/lib/api";
import {
  inferBeeHouseTaskType,
  type BeeHouseTaskStatus,
  type BeeHouseTaskType,
} from "@shared/bee-house";

export interface BeeHouseTask {
  id: string;
  sourceMessageId?: string | null;
  taskType: BeeHouseTaskType;
  status: BeeHouseTaskStatus;
  beeState: string;
  targetStation: string;
  speechText?: string | null;
  progress: number;
  promptSnippet?: string | null;
  resultSummary?: string | null;
  errorMessage?: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BeeHouseSnapshot {
  profile: Record<string, unknown> | null;
  rooms: Array<Record<string, unknown>>;
  activeRoom: Record<string, unknown> | null;
  layouts: Array<Record<string, unknown>>;
  inventory: Array<Record<string, unknown>>;
  catalog: Array<Record<string, unknown>>;
  outfits: Array<Record<string, unknown>>;
  userOutfits: Array<Record<string, unknown>>;
  activeTask: BeeHouseTask | null;
  bridge: {
    unityGameObject: string;
    receiveTaskMethod: string;
    receiveSnapshotMethod: string;
  };
}

type BeeHouseUnityModule = {
  isAvailable?: () => Promise<boolean> | boolean;
  openHouse?: (payload: string) => Promise<boolean> | boolean;
  sendTask?: (payload: string) => Promise<boolean> | boolean;
};

function getUnityModule(): BeeHouseUnityModule | null {
  return (NativeModules.BeeHouseUnity as BeeHouseUnityModule | undefined) ?? null;
}

export async function getBeeHouseBootstrap() {
  const { data } = await api.get<BeeHouseSnapshot>("/api/bee-house/bootstrap");
  return data;
}

export async function createBeeHouseTask(input: {
  content: string;
  sourceMessageId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const taskType = inferBeeHouseTaskType(input.content);
  const { data } = await api.post<BeeHouseTask>("/api/bee-house/tasks", {
    taskType,
    sourceMessageId: input.sourceMessageId,
    promptSnippet: input.content.slice(0, 800),
    payload: input.payload,
  });
  return data;
}

export async function updateBeeHouseTask(taskId: string, patch: {
  status?: BeeHouseTaskStatus;
  taskType?: BeeHouseTaskType;
  progress?: number;
  sourceMessageId?: string | null;
  speechText?: string | null;
  resultSummary?: string | null;
  errorMessage?: string | null;
  payload?: Record<string, unknown>;
}) {
  const { data } = await api.patch<BeeHouseTask>(`/api/bee-house/tasks/${taskId}`, patch);
  const unity = getUnityModule();
  if (unity?.sendTask) {
    await Promise.resolve(unity.sendTask(JSON.stringify(data))).catch(() => {});
  }
  return data;
}

export async function openBeeHouseUnity(snapshot: BeeHouseSnapshot) {
  const unity = getUnityModule();
  if (!unity?.openHouse) {
    return false;
  }

  return await Promise.resolve(unity.openHouse(JSON.stringify(snapshot)));
}

export async function isBeeHouseUnityAvailable() {
  const unity = getUnityModule();
  if (!unity?.isAvailable) return false;
  return await Promise.resolve(unity.isAvailable()).catch(() => false);
}
