import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "../theme";
import { BlurView } from "expo-blur";
import { useAuth } from "../context/AuthContext";
import AppFooter from "../components/AppFooter";

export default function LibraryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const libraryItems = [
    { id: "history", title: "Watch History", icon: "time-outline", screen: "WatchHistory", color: C.crimson },
    { id: "watchlist", title: "Watchlist", icon: "bookmark-outline", screen: "Watchlist", color: "#f59e0b" },
    { id: "favorites", title: "Favorites", icon: "heart-outline", screen: "Favorites", color: "#ec4899" },
    { id: "downloads", title: "Downloads", icon: "download-outline", screen: "Downloads", color: "#3b82f6" },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "ios" ? 10 : 20) }]}>
        <Text style={styles.headerTitle}>Your Library</Text>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {!user ? (
          <View style={styles.guestContainer}>
            <Ionicons name="lock-closed-outline" size={48} color={C.dim} style={{ marginBottom: 16 }} />
            <Text style={styles.guestTitle}>Login Required</Text>
            <Text style={styles.guestText}>Please login to view your library.</Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate("Login")}>
              <Text style={styles.loginBtnText}>Login Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {libraryItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={styles.listItem}
                activeOpacity={0.7}
                onPress={() => navigation.navigate(item.screen)}
              >
                <View style={[styles.iconContainer, { backgroundColor: `${item.color}15`, borderColor: `${item.color}30` }]}>
                  <Ionicons name={item.icon} size={24} color={item.color} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSubtitle}>View your {item.title.toLowerCase()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={C.dimmer} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ marginTop: 40 }}>
           <AppFooter />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: C.surface,
  },
  headerTitle: {
    color: C.white,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  scrollContent: {
    flexGrow: 1,
  },
  listContainer: {
    padding: 20,
    gap: 16,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
  },
  itemTitle: {
    color: C.white,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  itemSubtitle: {
    color: C.dim,
    fontSize: 13,
  },
  guestContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    marginTop: 60,
  },
  guestTitle: {
    color: C.white,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  guestText: {
    color: C.dim,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  loginBtn: {
    backgroundColor: C.crimson,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginBtnText: {
    color: C.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
