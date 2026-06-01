// @ts-nocheck
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { C } from "../theme";
import API from "../services/api";
import DotCircleLoader from "../components/DotCircleLoader";

export default function SubscriptionSuccessScreen({ navigation, route }) {
  const { refreshSession } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(false);

  const sessionId = route?.params?.session_id;

  // 1. Verification Logic
  useEffect(() => {
    let interval;
    let attempts = 0;
    const maxAttempts = 15; // 30 seconds total

    const checkStatus = async () => {
      if (!sessionId) {
        setError("Missing payment session. Please check your subscription status from your profile.");
        setIsVerifying(false);
        return;
      }

      try {
        const res = await API.get(`/api/payments/sync-session/${sessionId}`);
        if (res.data.success && res.data.status === "pending_approval") {
          setPendingApproval(true);
          setIsVerifying(false);
          clearInterval(interval);
        } else if (res.data.success && res.data.subscription === "premium") {
          await refreshSession();
          setIsVerifying(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.warn("[Success] Sync failed, retrying...", err.message);
      }

      attempts++;
      if (attempts >= maxAttempts) {
        setIsVerifying(false);
        setError("Verification is taking longer than usual. If your payment went through, it will appear in the admin review queue shortly.");
        clearInterval(interval);
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 2500);

    return () => clearInterval(interval);
  }, [sessionId, refreshSession]);

  const goHome = useCallback(() => {
    const parent = navigation.getParent?.();
    if (parent) {
      parent.navigate("HomeTab", { screen: "HomeRoot" });
      return;
    }

    navigation.navigate("MainTabs", {
      screen: "HomeTab",
      params: { screen: "HomeRoot" },
    });
  }, [navigation]);

  // 2. Back Handler
  useEffect(() => {
    const backAction = () => {
      goHome();
      return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [goHome]);

  const handleContinue = () => {
    goHome();
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[C.bg, "#0d0d0e"]}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={isVerifying ? ["#334155", "#1e293b"] : ["#DC143C", "#A30F2D"]}
            style={styles.iconCircle}
          >
            {isVerifying ? (
              <DotCircleLoader size={40} color={C.white} />
            ) : (
              <Ionicons name="sparkles" size={50} color="#fff" />
            )}
          </LinearGradient>
          {!isVerifying && !error && (
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={20} color="#fff" />
            </View>
          )}
        </View>

        <Text style={styles.title}>
          {isVerifying ? "Verifying Payment..." : error ? "Payment Status Unknown" : pendingApproval ? "Payment Under Review" : "Welcome to Premium!"}
        </Text>
        <Text style={styles.subtitle}>
          {isVerifying 
            ? "We're confirming your subscription with Xendit. This usually takes a few seconds..." 
            : error
              ? "We could not confirm the payment status right now."
              : pendingApproval
              ? "Your payment was received. An admin will verify it before premium is activated on your account."
              : "Your payment was approved. You now have unlimited, ad-free access to the entire Animexis catalog."
          }
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={C.crimson} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!isVerifying && <View style={styles.divider} />}

        {!isVerifying && (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={C.dim} />
            <Text style={styles.infoText}>
              {pendingApproval
                ? "You can keep using Animexis while your payment is reviewed. Premium unlocks after admin approval."
                : "Your journey starts now. Your premium badge and borders are now active on your profile."}
            </Text>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.button, isVerifying && { opacity: 0.6 }]} 
          onPress={handleContinue}
          disabled={isVerifying}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#DC143C", "#A30F2D"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.btnGrad}
          >
            <Text style={styles.btnText}>
              {isVerifying ? "Please Wait..." : pendingApproval ? "Back to Home" : "Start Watching"}
            </Text>
            {!isVerifying && <Ionicons name="arrow-forward" size={18} color="#fff" />}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" },
  content: { width: "90%", alignItems: "center", padding: 30 },
  
  iconContainer: { marginBottom: 30, position: "relative" },
  iconCircle: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: "center", justifyContent: "center",
    boxShadow: '0 10px 15px rgba(220,20,60,0.3)'
  },
  checkBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#10B981", borderWidth: 4, borderColor: C.bg,
    alignItems: "center", justifyContent: "center"
  },

  title: { color: C.white, fontSize: 32, fontWeight: "900", textAlign: "center", marginBottom: 16 },
  subtitle: { color: C.dim, fontSize: 16, textAlign: "center", lineHeight: 24, marginBottom: 40 },
  
  divider: { width: "100%", height: 1, backgroundColor: C.border, marginBottom: 30 },
  
  infoBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, marginBottom: 40
  },
  infoText: { flex: 1, color: C.dim, fontSize: 13, lineHeight: 18 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(220, 20, 60, 0.05)", padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(220, 20, 60, 0.2)", marginBottom: 30
  },
  errorText: { flex: 1, color: C.dim, fontSize: 13, lineHeight: 18 },

  button: { width: "100%", borderRadius: 16, overflow: "hidden" },
  btnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 12 },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
