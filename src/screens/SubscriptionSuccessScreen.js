import React, { useEffect } from "react";
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

export default function SubscriptionSuccessScreen({ navigation }) {
  const { user } = useAuth(); // We'll assume the webhook has upgraded them by now

  // Disable back button to prevent returning to payment page
  useEffect(() => {
    const backAction = () => {
      navigation.replace("Home");
      return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, []);

  const handleContinue = () => {
    navigation.replace("Home");
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
            colors={["#DC143C", "#A30F2D"]}
            style={styles.iconCircle}
          >
            <Ionicons name="sparkles" size={50} color="#fff" />
          </LinearGradient>
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </View>
        </View>

        <Text style={styles.title}>Welcome to Premium!</Text>
        <Text style={styles.subtitle}>
          Your payment was successful. You now have unlimited, ad-free access to the entire Animexis catalog.
        </Text>

        <View style={styles.divider} />

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={C.dim} />
          <Text style={styles.infoText}>
            It may take a few moments for your "Premium" badge to appear everywhere as your profile synchronizes.
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#DC143C", "#A30F2D"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.btnGrad}
          >
            <Text style={styles.btnText}>Start Watching</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
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
    shadowColor: "#DC143C", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 10
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

  button: { width: "100%", borderRadius: 16, overflow: "hidden" },
  btnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 12 },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
