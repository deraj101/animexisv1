// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session on app start ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("auth_user");
        if (stored) {
          const parsed = JSON.parse(stored);

          setUser(parsed); // 🟢 Set the user state immediately so the app shows the Home screen

          // 🔄 Re-fetch fresh profile data on every launch to sync subscription status
          try {
            const res = await API.get(`/api/users/public-profile/${parsed.email}`);
            if (res.data.success && res.data.profile) {
              setUser((prev) => {
                if (!prev) return null;
                const freshData = { ...prev, ...res.data.profile };
                AsyncStorage.setItem("auth_user", JSON.stringify(freshData)).catch(() => {});
                return freshData;
              });
            }
          } catch { 
             /* server unreachable — stay with the stored session */ 
          }
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  /**
   * signIn — called by LoginScreen after OTP verify (or bypass).
   * userData must include { email, token }.
   * The token is a JWT issued by the backend and is stored alongside the user
   * so AdminDashboardScreen can attach it to every admin API request.
   */
  const signIn = async (userData) => {
    // Ask the backend whether this account is banned
    try {
      const res = await API.post("/api/auth/check-bypass", { email: userData.email });
      // check-bypass doesn't return ban status — ban check happens at send-otp/verify-otp.
      // If we reach here the server accepted the request (not banned at send-otp time).
    } catch { /* non-critical — if server is unreachable let the user in */ }

    setUser(userData);
    // Store the full object INCLUDING token, name, and profile_image.
    await AsyncStorage.setItem("auth_user", JSON.stringify(userData));
  };

  const signOut = async () => {
    setUser(null);
    await AsyncStorage.removeItem("auth_user");
  };

  /**
   * updateUser — merges partial updates (like name or profile_image)
   * into the existing user state and persists it.
   */
  const updateUser = async (newData) => {
    setUser((prev) => {
      const updated = prev ? { ...prev, ...newData } : null;
      if (updated) {
        AsyncStorage.setItem("auth_user", JSON.stringify(updated)).catch(() => {});
      }
      return updated;
    });
  };

  /**
   * refreshSession — Manually re-fetch profile from the server
   * to sync subscription status (Premium).
   */
  const refreshSession = useCallback(async () => {
    if (!user?.email) return;
    try {
      const res = await API.get(`/api/users/public-profile/${user.email}`);
      if (res.data.success && res.data.profile) {
        let freshData;
        setUser((prev) => {
          if (!prev) return null;
          freshData = { ...prev, ...res.data.profile };
          AsyncStorage.setItem("auth_user", JSON.stringify(freshData)).catch(() => {});
          return freshData;
        });
        return freshData;
      }
    } catch (err) {
      console.error("[AuthContext] Refresh failed:", err.message);
    }
  }, [user]);

  /**
   * checkApprovalStatus — Polls the secure /api/auth/status endpoint
   * to check if the user has been approved, updating local state.
   */
  const checkApprovalStatus = useCallback(async () => {
    if (!user?.email) return null;
    try {
      const res = await API.get('/api/auth/status');
      if (res.data.success) {
        let freshData;
        setUser((prev) => {
          if (!prev) return null;
          freshData = { 
            ...prev, 
            account_status: res.data.account_status,
            is_verified: res.data.is_verified,
            subscription: res.data.subscription
          };
          AsyncStorage.setItem("auth_user", JSON.stringify(freshData)).catch(() => {});
          return freshData;
        });
        return freshData;
      }
    } catch (err) {
      console.error("[AuthContext] Approval check failed:", err.message);
    }
    return null;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, updateUser, refreshSession, checkApprovalStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
