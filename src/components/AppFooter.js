/**
 * AppFooter.js
 *
 * The shared footer with A-Z selection and Legal links.
 */
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { C } from "../theme";
import LegalModal from "./LegalModal";

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LINKS = [
  { label: "About Us",           screen: "AboutUs" },
  { label: "Feedback & Bugs",    screen: "Feedback" },
  { label: "Terms & Conditions", page: "terms"     },
  { label: "Privacy Policy",     page: "privacy"   },
  { label: "Terms of Use",       page: "use"       },
];

export default function AppFooter() {
  const [legalPage, setLegalPage] = useState(null);
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <>
      <View style={[styles.footer, isDesktop && { gap: 8, paddingBottom: 16, paddingTop: 12 }]}>
        {/* A-Z List Searching */}
        <View style={[styles.alphabetSection, isDesktop && { paddingBottom: 12, marginBottom: 8 }]}>
           <Text style={styles.alphabetLabel}>A-Z LIST Searching</Text>
           <View style={styles.alphabetRow}>
              {ALPHABET.map((char) => (
                <TouchableOpacity
                  key={char}
                  style={styles.alphaBtn}
                  onPress={() => navigation.navigate("Alphabet", { letter: char })}
                >
                  <Text style={styles.alphaText}>{char}</Text>
                </TouchableOpacity>
              ))}
           </View>
        </View>

        {/* Logo */}
        <View style={styles.logoRow}>
          <Text style={styles.logoText}>
            ANIME<Text style={{ color: C.crimson }}>XIS</Text>
          </Text>
        </View>

        {/* Links */}
        <View style={styles.linkRow}>
          {LINKS.map(({ label, page, screen }, i) => (
            <React.Fragment key={label}>
              <TouchableOpacity
                onPress={() => {
                  if (screen) navigation.navigate(screen);
                  else if (page) setLegalPage(page);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.link}>{label}</Text>
              </TouchableOpacity>
              {i < LINKS.length - 1 && (
                <Text style={styles.dot}>·</Text>
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Copyright */}
        <Text style={styles.copy}>© 2026 Animexis. All rights reserved.</Text>

        {/* Filler to cover ScrollView padding gap (Native only to prevent scroll bloat on Web) */}
        {Platform.OS !== 'web' && (
          <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, height: 400, backgroundColor: C.surface }} />
        )}
      </View>

      <LegalModal page={legalPage} onClose={() => setLegalPage(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 16,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    marginTop: 0,
    backgroundColor: C.surface,
  },
  alphabetSection: {
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  alphabetLabel: {
    color: C.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 16,
    textTransform: "uppercase",
  },
  alphabetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  alphaBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  alphaText: {
    color: C.dim,
    fontSize: 10,
    fontWeight: "700",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
  },
  logoIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontWeight: "800",
    fontSize: 14,
    color: C.white,
    letterSpacing: 1.5,
  },
  linkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  link: {
    color: C.dimmer,
    fontSize: 11,
    fontWeight: "600",
  },
  dot: {
    color: C.dimmer,
    fontSize: 11,
    opacity: 0.4,
  },
  copy: {
    color: C.dim,
    fontSize: 12,
    opacity: 1,
    marginTop: 4,
  },
});