import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Use env var if available (Vercel/Production), fallback to local IP for Expo Go
const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://10.124.88.17:3000';
console.log('[API] Using baseURL:', baseURL);

const API = axios.create({ 
  baseURL,
  timeout: 30000 // 30s default
});

// Dedicated instance for slow scraping tasks
export const API_LONG = axios.create({
  baseURL,
  timeout: 60000 // 60s for AnimePahe/Downloads
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
  console.error(`[API ERROR] ${err.config?.method?.toUpperCase()} ${err.config?.url}:`, err.message);
  return Promise.reject(err);
};

API.interceptors.response.use(res => res, errorLog);
API_LONG.interceptors.response.use(res => res, errorLog);

export default API;