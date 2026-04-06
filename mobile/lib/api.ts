import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { getApiErrorMessage as getSharedApiErrorMessage } from "@shared/api";

function normalizeApiUrl(value?: string): string {
  const raw = value?.trim() || "http://10.0.2.2:5000";
  return raw.replace(/\/+$/, "");
}

const API_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

export interface ApiClientError extends Error {
  code?: string;
  requestId?: string;
  details?: unknown;
  status?: number;
}

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("bee_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync("bee_token");
    }

    const normalized = new Error(
      getSharedApiErrorMessage(err.response?.data, err.message || "Falha de requisição"),
    ) as ApiClientError;
    normalized.code = err.response?.data?.error?.code ?? err.response?.data?.code;
    normalized.requestId = err.response?.data?.error?.requestId ?? err.response?.data?.requestId;
    normalized.details = err.response?.data?.error?.details ?? err.response?.data?.details;
    normalized.status = err.response?.status;

    return Promise.reject(normalized);
  }
);

export const API_URL_RAW = API_URL;

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return getSharedApiErrorMessage(error, fallback);
}
