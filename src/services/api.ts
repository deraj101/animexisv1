// @ts-nocheck
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const requireApiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error('Missing EXPO_PUBLIC_API_URL. Set it to your deployed API URL before running the app.');
  }
  return url;
};

export const BASE_URL = requireApiUrl();
console.log('[API] Using baseURL:', BASE_URL);

const API = axios.create({ 
  baseURL: BASE_URL,
  timeout: 60000 // 60s default (handles Render spin-up)
});

// Dedicated instance for slow tasks (downloads, scraping)
export const API_LONG = axios.create({
  baseURL: BASE_URL,
  timeout: 60000 // 60s for Downloads/Slow tasks
});

// ── Attach JWT to every request automatically ─────────────────────────────────
const attachToken = async (config) => {
  try {
    const raw = await AsyncStorage.getItem("auth_user");
    if (raw) {
      const { token } = JSON.parse(raw);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch { /* ignore */ }
  return config;
};

API.interceptors.request.use(attachToken);
API_LONG.interceptors.request.use(attachToken);

// ── Debug Logger ──────────────────────────────────────────────────────────────
const errorLog = (err) => {
  if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") {
    return Promise.reject(err);
  }
  // Suppress expected 401 polling errors so they don't spam the terminal
  const isExpected401 = err.response?.status === 401 && err.config?.url?.includes('/api/auth/usage-status');
  if (!isExpected401) {
    console.error(`[API ERROR] ${err.config?.method?.toUpperCase()} ${err.config?.url}:`, err.message);
  }
  return Promise.reject(err);
};

API.interceptors.response.use(res => res, errorLog);
API_LONG.interceptors.response.use(res => res, errorLog);

export default API;
