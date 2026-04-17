import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from "react-native";
import * as ExpoLinking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { C } from "../theme";
import API from "../services/api";
import DotCircleLoader from "../components/DotCircleLoader";

export default function SubscriptionScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const isPremium = user?.subscription?.toLowerCase() === "premium";

  const handleUpgrade = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const successUrl = Platform.OS === "web" 
        ? `${window.location.origin}/subscription-success`
        : ExpoLinking.createURL("subscription-success");
      const cancelUrl = Platform.OS === "web"
        ? `${window.location.origin}/`
        : ExpoLinking.createURL("");

      const res = await API.post("/api/payments/create-checkout-session", {
        priceId: process.env.EXPO_PUBLIC_STRIPE_PREMIUM_PRICE_ID || "price_default", // Configured in .env
        successUrl,
        cancelUrl,
      });

      if (res.data.success && res.data.url) {
        // Redirect to Stripe Checkout
        if (Platform.OS === "web") {
          window.location.href = res.data.url;
        } else {
          const supported = await Linking.canOpenURL(res.data.url);
          if (supported) {
            await Linking.openURL(res.data.url);
          } else {
            Alert.alert("Error", "Could not open browser for payment.");
          }
        }
      } else {
        Alert.alert("Error", res.data.error || "Failed to initiate payment.");
      }
    } catch (err) {
      console.error("[subscription] error:", err.message);
      Alert.alert("Error", "Something went wrong. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Current Plan Card */}
        <View style={[styles.card, styles.currentPlanCard]}>
          <Text style={styles.cardLabel}>Current Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.planName}>
              {isPremium ? "Premium Member" : "Free Tier"}
            </Text>
            <View style={[styles.badge, isPremium ? styles.premiumBadge : styles.freeBadge]}>
              <Text style={styles.badgeText}>{isPremium ? "ACTIVE" : "FREE"}</Text>
            </View>
          </View>
          {!isPremium && (
            <Text style={styles.cardInfo}>Upgrade to unlock full experience and zero ads.</Text>
          )}
        </View>

        {/* Premium Perks Section */}
        {!isPremium && (
          <View style={styles.perksContainer}>
            <Text style={styles.sectionTitle}>Exclusive Premium Perks</Text>
            {[
              { icon: "infinite-outline", color: "#60A5FA", label: "Zero Advertisements", desc: "Pure anime, no commercial breaks." },
              { icon: "tv-outline",       color: "#FBBF24", label: "Full HD 1080p",     desc: "Highest available streaming quality." },
              { icon: "flash-outline",    color: "#F87171", label: "Early Access",      desc: "Watch new episodes before anyone else." },
              { icon: "people-outline",   color: "#34D399", label: "Multi-Stream",      desc: "Watch on up to 2 devices at once." },
            ].map((p, i) => (
              <View key={i} style={styles.perkItem}>
                <View style={[styles.perkIconWrap, { backgroundColor: p.color + "15" }]}>
                  <Ionicons name={p.icon} size={22} color={p.color} />
                </View>
                <View style={styles.perkTextContent}>
                  <Text style={styles.perkLabel}>{p.label}</Text>
                  <Text style={styles.perkDesc}>{p.desc}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity 
              style={styles.upgradeBtn} 
              onPress={handleUpgrade}
              activeOpacity={0.8}
              disabled={loading}
            >
              <LinearGradient
                colors={["#DC143C", "#A30F2D"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.upgradeBtnGrad}
              >
                {loading ? (
                  <DotCircleLoader size={18} color="#fff" />
                ) : (
                  <>
                    <Text style={styles.upgradeBtnText}>Upgrade Now — ₱149/mo</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.paymentIcons}>
                <Text style={styles.paymentText}>Supports GCash, PayMaya, and Credit Cards</Text>
                <View style={styles.iconRow}>
                   <View style={styles.walletBadge}><Text style={styles.walletText}>GCash</Text></View>
                   <View style={styles.walletBadge}><Text style={styles.walletText}>PayMaya</Text></View>
                   <Ionicons name="card-outline" size={20} color={C.dim} />
                </View>
            </View>
          </View>
        )}

        {isPremium && (
          <View style={styles.activeContainer}>
            <View style={styles.checkWrap}>
              <Ionicons name="checkmark-circle" size={80} color={C.crimson} />
            </View>
            <Text style={styles.activeTitle}>Premium Active</Text>
            <Text style={styles.activeSub}>You have unlocked the full potential of Animexis. Enjoy unlimited, ad-free streaming!</Text>
            
            <TouchableOpacity style={styles.manageBtn} onPress={() => Alert.alert("Management", "Subscription management is coming soon to your profile.")}>
               <Text style={styles.manageBtnText}>Manage Subscription</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: "700" },

  scrollContent: { padding: 20 },
  
  card: {
    backgroundColor: C.surface,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 24,
  },
  currentPlanCard: {
     backgroundColor: "#0d0d0e"
  },
  cardLabel: { color: C.dim, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 8 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  planName: { color: C.white, fontSize: 24, fontWeight: "900" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  premiumBadge: { backgroundColor: C.crimson },
  freeBadge: { backgroundColor: "rgba(255,255,255,0.08)" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  cardInfo: { color: C.dim, fontSize: 13, lineHeight: 18 },

  perksContainer: { gap: 20 },
  sectionTitle: { color: C.white, fontSize: 18, fontWeight: "700", marginBottom: 4 },
  perkItem: { flexDirection: "row", alignItems: "center", gap: 16 },
  perkIconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  perkTextContent: { flex: 1 },
  perkLabel: { color: C.white, fontSize: 16, fontWeight: "600", marginBottom: 2 },
  perkDesc: { color: C.dim, fontSize: 13 },

  upgradeBtn: { marginTop: 12, borderRadius: 16, overflow: "hidden" },
  upgradeBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 10 },
  upgradeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  paymentIcons: { alignItems: "center", marginTop: 16 },
  paymentText: { color: C.dimmer, fontSize: 12, marginBottom: 12 },
  iconRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  walletBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: C.border },
  walletText: { color: C.dim, fontSize: 10, fontWeight: "700" },

  activeContainer: { alignItems: "center", marginTop: 40 },
  checkWrap: { marginBottom: 20 },
  activeTitle: { color: C.white, fontSize: 28, fontWeight: "900", marginBottom: 12 },
  activeSub: { color: C.dim, fontSize: 15, textAlign: "center", lineHeight: 24, paddingHorizontal: 20, marginBottom: 30 },
  manageBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: C.border },
  manageBtnText: { color: C.dim, fontSize: 14, fontWeight: "600" },
});
