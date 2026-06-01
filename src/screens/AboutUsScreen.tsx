// @ts-nocheck
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";

const { width: W } = Dimensions.get("window");

export default function AboutUsScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* HERO LOGO */}
        <View style={styles.hero}>
          <LinearGradient
            colors={["rgba(220,20,60,0.15)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.title}>
            ANIME<Text style={{ color: C.crimson }}>XIS</Text>
          </Text>
          <Text style={styles.tagline}>The Ultimate Streaming Experience for True Anime Fans</Text>
        </View>

        {/* CONTENT */}
        <View style={styles.card}>
          <Text style={styles.p}>
            Animexis was built from the ground up by fans, for fans. Our mission is to provide the fastest, smoothest, and most premium animes streaming experience across all devices. We grew completely tired of clunky, outdated sites riddled with intrusive redirects. So we built Animexis.
          </Text>
          <Text style={styles.p}>
            With over 12,000+ episodes synchronized closely with Japan's release schedules, we ensure you never miss a beat on your favorite simulcasts.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="film-outline" size={24} color={C.crimson} style={{ marginBottom: 6 }} />
            <Text style={styles.statVal}>12,000+</Text>
            <Text style={styles.statLabel}>Episodes</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="flash-outline" size={24} color={C.crimson} style={{ marginBottom: 6 }} />
            <Text style={styles.statVal}>2 Hrs</Text>
            <Text style={styles.statLabel}>Sub Release</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="heart-outline" size={24} color={C.crimson} style={{ marginBottom: 6 }} />
            <Text style={styles.statVal}>No</Text>
            <Text style={styles.statLabel}>Redirects</Text>
          </View>
        </View>
        
        {/* FOOTER */}
        <View style={styles.footer}>
           <Text style={styles.footerText}>© 2026 Animexis Media.</Text>
           <Text style={styles.footerText}>Built with ❤️</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: C.white },
  scrollContent: { paddingBottom: 40 },
  hero: { alignItems: "center", paddingVertical: 50, position: "relative", borderBottomWidth: 1, borderBottomColor: C.border },
  logoWrap: { width: 64, height: 64, borderRadius: 16, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.glass, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 32, fontWeight: "900", color: C.white, letterSpacing: 2, marginBottom: 8 },
  tagline: { fontSize: 13, color: C.dim, maxWidth: "70%", textAlign: "center", lineHeight: 20 },
  card: { margin: 20, padding: 24, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  p: { fontSize: 15, color: C.dim, lineHeight: 24, marginBottom: 16 },
  statsRow: { flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20, alignItems: "center" },
  statVal: { fontSize: 18, fontWeight: "800", color: C.white, marginBottom: 2 },
  statLabel: { fontSize: 11, color: C.dimmer, textTransform: "uppercase", fontWeight: "600" },
  footer: { alignItems: "center", marginTop: 40 },
  footerText: { color: C.dimmer, fontSize: 12, marginBottom: 4 }
});
