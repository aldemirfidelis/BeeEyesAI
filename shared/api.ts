export interface ApiMeta {
  requestId: string;
  [key: string]: unknown;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  ok: false;
  error: ApiErrorPayload;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function isApiSuccess<T>(value: ApiResponse<T>): value is ApiSuccess<T> {
  return value.ok;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isApiEnvelope<T>(value: unknown): value is ApiResponse<T> {
  return isObject(value) && "ok" in value;
}

export function extractApiErrorPayload(value: unknown): ApiErrorPayload | null {
  if (!isObject(value)) {
    return null;
  }

  const nested = value.error;
  if (isObject(nested) && typeof nested.message === "string" && typeof nested.code === "string") {
    return {
      code: nested.code,
      message: nested.message,
      details: nested.details,
      requestId: typeof nested.requestId === "string" ? nested.requestId : undefined,
    };
  }

  if (typeof value.message === "string" && typeof value.code === "string") {
    return {
      code: value.code,
      message: value.message,
      details: value.details,
      requestId: typeof value.requestId === "string" ? value.requestId : undefined,
    };
  }

  return null;
}

export function getApiErrorMessage(value: unknown, fallback: string) {
  return extractApiErrorPayload(value)?.message ?? fallback;
}
