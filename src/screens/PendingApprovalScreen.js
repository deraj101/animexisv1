import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";

const C = {
  bg:      "#080809",
  surface: "#111114",
  crimson: "#DC143C",
  white:   "#F2EFF8",
  dim:     "#9090a8",
};

export default function PendingApprovalScreen() {
  const { signOut, refreshSession } = useAuth();

  const handleRefresh = async () => {
    const fresh = await refreshSession();
    if (fresh?.account_status === 'active') {
      // AuthContext.user update will trigger App.js navigation change
    }
  };

  React.useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={["rgba(220,20,60,0.15)", "transparent"]}
        style={styles.gradient}
      />

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="time-outline" size={60} color={C.crimson} />
        </View>

        <Text style={styles.title}>Account Pending</Text>
        <Text style={styles.desc}>
          Your account has been created successfully! However, to ensure a safe community, 
          new accounts must be manually verified by our team.
        </Text>

        <View style={styles.card}>
          <Ionicons name="shield-checkmark-outline" size={20} color={C.crimson} />
          <Text style={styles.cardText}>
            We'll review your account shortly. This usually takes less than 24 hours.
          </Text>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <LinearGradient
            colors={[C.crimson, "#a00020"]}
            style={styles.btnGradient}
          >
            <Ionicons name="refresh-outline" size={20} color={C.white} />
            <Text style={styles.btnText}>Check Status</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Need help? Contact support at</Text>
        <TouchableOpacity onPress={() => Linking.openURL("mailto:support@animexis.app")}>
          <Text style={styles.supportLink}>support@animexis.app</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: "center",
  },
  gradient: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 300,
  },
  content: {
    paddingHorizontal: 30,
    alignItems: "center",
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(220,20,60,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "rgba(220,20,60,0.2)",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: C.white,
    marginBottom: 16,
    textAlign: "center",
  },
  desc: {
    fontSize: 15,
    color: C.dim,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
  },
  card: {
    flexDirection: "row",
    backgroundColor: C.surface,
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    gap: 15,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  cardText: {
    flex: 1,
    color: C.dim,
    fontSize: 13,
    lineHeight: 18,
  },
  refreshBtn: {
    width: "100%",
    height: 54,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  btnGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  btnText: {
    color: C.white,
    fontSize: 16,
    fontWeight: "700",
  },
  signOutBtn: {
    padding: 10,
  },
  signOutText: {
    color: C.dim,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 0, right: 0,
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
  },
  supportLink: {
    color: C.crimson,
    fontSize: 12,
    fontWeight: "600",
  },
});
