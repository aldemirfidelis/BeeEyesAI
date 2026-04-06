import axios from "axios";
import * as SecureStore from "expo-secure-store";

function normalizeApiUrl(value?: string): string {
  const raw = value?.trim() || "http://10.0.2.2:5000";
  return raw.replace(/\/+$/, "");
}

const API_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

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
    return Promise.reject(err);
  }
);

export const API_URL_RAW = API_URL;
