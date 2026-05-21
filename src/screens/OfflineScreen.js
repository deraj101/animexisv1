import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";

export default function OfflineScreen({ navigation }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideUp, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsing icon animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Background gradient overlay */}
      <LinearGradient
        colors={["rgba(220,20,60,0.06)", "transparent", "rgba(220,20,60,0.03)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeIn,
            transform: [{ translateY: slideUp }],
          },
        ]}
      >
        {/* Icon with glow */}
        <View style={styles.iconContainer}>
          <View style={styles.iconGlow} />
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <View style={styles.iconCircle}>
              <Ionicons name="cloud-offline-outline" size={48} color={C.crimson} />
            </View>
          </Animated.View>
        </View>

        <Text style={styles.title}>You're Offline</Text>
        <Text style={styles.subtitle}>
          No internet connection detected.{"\n"}
          Your downloaded episodes are still available!
        </Text>

        {/* Go to Downloads button */}
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => navigation.navigate("Downloads")}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[C.crimson, "#a00020"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.downloadGradient}
          >
            <Ionicons name="download-outline" size={20} color="white" />
            <Text style={styles.downloadText}>Go to Downloads</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Retry button */}
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            // Force re-check manually via network API instead of blind routing
            // App.js also handles this via interval
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={16} color={C.dim} />
          <Text style={styles.retryText}>Retry Connection</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom decoration */}
      <View style={styles.bottomDecor}>
        <View style={styles.decorLine} />
        <Text style={styles.decorText}>ANIMEXIS</Text>
        <View style={styles.decorLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  iconContainer: {
    position: "relative",
    marginBottom: 28,
  },
  iconGlow: {
    position: "absolute",
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 999,
    backgroundColor: "rgba(220,20,60,0.08)",
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.crimsonBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: C.white,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    color: C.dim,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  downloadButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    width: "100%",
  },
  downloadGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    paddingHorizontal: 30,
    gap: 10,
  },
  downloadText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.glass,
    backgroundColor: C.surface,
  },
  retryText: {
    color: C.dim,
    fontSize: 14,
    fontWeight: "600",
  },
  bottomDecor: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 50 : 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  decorLine: {
    width: 30,
    height: 1,
    backgroundColor: C.glass,
  },
  decorText: {
    color: C.dimmer,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
  },
});
