import { getApiErrorMessage as getSharedApiErrorMessage, isApiEnvelope } from "@shared/api";

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (isApiEnvelope<T>(payload)) {
    if (!payload.ok) {
      throw new Error(payload.error.message);
    }

    return payload.data;
  }

  if (!response.ok) {
    throw new Error((payload as { message?: string } | null)?.message || response.statusText);
  }

  return payload as T;
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  return parseApiResponse<T>(response);
}

export async function apiTryFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> {
  const response = await fetch(input, init);
  if (!response.ok) {
    return null;
  }

  return parseApiResponse<T>(response);
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return getSharedApiErrorMessage(error, fallback);
}
