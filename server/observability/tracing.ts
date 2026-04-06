import { appendJsonLine, readJsonLines } from "./persistence";

export interface RequestTrace {
  traceId: string;
  requestId: string;
  method: string;
  path: string;
  route?: string;
  statusCode: number;
  durationMs: number;
  userId: string | null;
  timestamp: string;
}

export function recordRequestTrace(trace: RequestTrace) {
  appendJsonLine("traces.jsonl", trace);
}

export function readRecentTraces(limit = 100) {
  return readJsonLines<RequestTrace>("traces.jsonl", limit);
}
