import { API_URL_RAW, api } from "@mobile/lib/api";
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
    webViewGlobal?: string;
    receiveStateMethod?: string;
    postMessageTarget?: string;
    unityGameObject?: string;
    receiveTaskMethod?: string;
    receiveSnapshotMethod?: string;
  };
}

export type BeeHouseBridgeTarget = "search" | "train" | "calendar" | "study" | "sleep";

export interface BeeHouseBridgeTaskPayload {
  type: "ai_task";
  id: string;
  taskId: string;
  target: BeeHouseBridgeTarget;
  status: "start";
  reward: number;
  speechText?: string | null;
}

export interface BeeHouseRewardResult {
  task: BeeHouseTask;
  profile: Record<string, unknown> | null;
  reward: {
    pollen: number;
    xp: number;
    alreadyClaimed: boolean;
  };
}

export async function getBeeHouseBootstrap() {
  const { data } = await api.get<BeeHouseSnapshot>("/api/bee-house/bootstrap");
  return data;
}

export function getBeeHouseGameUrl() {
  return `${API_URL_RAW}/casa-da-bee`;
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
  return data;
}

export async function claimBeeHouseTaskReward(taskId: string, reward: {
  rewardPollen: number;
  rewardXp?: number;
  bridgeTarget?: BeeHouseBridgeTarget;
}) {
  const { data } = await api.post<BeeHouseRewardResult>(`/api/bee-house/tasks/${taskId}/reward`, reward);
  return data;
}

export function buildBeeHouseBridgeTask(task: BeeHouseTask): BeeHouseBridgeTaskPayload {
  return {
    type: "ai_task",
    id: task.id,
    taskId: task.id,
    target: toBeeHouseBridgeTarget(task),
    status: "start",
    reward: rewardForTaskType(task.taskType),
    speechText: task.speechText,
  };
}

function toBeeHouseBridgeTarget(task: BeeHouseTask): BeeHouseBridgeTarget {
  if (task.targetStation === "fitness" || task.taskType === "fitness") return "train";
  if (task.targetStation === "calendar" || task.taskType === "calendar") return "calendar";
  if (task.targetStation === "library" || task.taskType === "study") return "study";
  if (task.targetStation === "bed") return "sleep";
  return "search";
}

function rewardForTaskType(taskType: BeeHouseTaskType) {
  if (taskType === "fitness" || taskType === "study") return 14;
  if (taskType === "calendar" || taskType === "shopping") return 12;
  if (taskType === "research") return 15;
  return 10;
}
