import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

// ── Attach JWT to every request automatically ─────────────────────────────────
API.interceptors.request.use(async (config) => {
  try {
    const raw = await AsyncStorage.getItem("auth_user");
    if (raw) {
      const { token } = JSON.parse(raw);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch { /* ignore — request will proceed without auth header */ }
  return config;
});

export default API;