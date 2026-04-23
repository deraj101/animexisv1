import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import API from "./src/services/api";

import LandingScreen from "./src/screens/LandingScreen";   // ← NEW
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import DetailsScreen from "./src/screens/DetailsScreen";
import PlayerScreen from "./src/screens/PlayerScreen";
import GenreScreen from "./src/screens/GenreScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import * as Linking from "expo-linking";
import AdminDashboardScreen from "./src/screens/AdminDashboardScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen"; // 🔔 NEW
import PublicProfileScreen from "./src/screens/PublicProfileScreen"; // 👤 NEW
import SubscriptionScreen from "./src/screens/SubscriptionScreen";  // 💳 NEW
import SubscriptionSuccessScreen from "./src/screens/SubscriptionSuccessScreen"; // ✅ NEW
import AlphabetScreen from "./src/screens/AlphabetScreen"; // 🔠 NEW
import AboutUsScreen from "./src/screens/AboutUsScreen"; // ℹ️ NEW
import FeedbackScreen from "./src/screens/FeedbackScreen"; // 📝 NEW
import WatchHistoryScreen from "./src/screens/WatchHistoryScreen"; // 🎬 NEW
import FavoritesScreen from "./src/screens/FavoritesScreen"; // ❤️ NEW
import WatchlistScreen from "./src/screens/WatchlistScreen"; // 🔖 NEW



const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Silently log app visit for analytics
    API.post("/api/anime/visit").catch(() => { });
  }, []);

  // 🔥 Heartbeat: Keep user "Active Now" while using the app
  useEffect(() => {
    if (!user) return;

    // Send initial heartbeat
    API.get("/api/auth/heartbeat").catch(() => { });

    // Repeat every 3 minutes (Active window is 5m in backend)
    const interval = setInterval(() => {
      API.get("/api/auth/heartbeat").catch((err) => {
        console.log("[heartbeat] failed:", err.message);
      });
    }, 180000); // 3 * 60 * 1000

    return () => clearInterval(interval);
  }, [user]);

  // ── MOVED LOADING TO AppContent ──


  const ProfileOrAdmin = user?.isAdmin
    ? AdminDashboardScreen
    : ProfileScreen;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        // ── UNAUTHENTICATED: Landing → Login ──────────────────────────────────
        // Landing is the first screen. Both "Log In" and "Start Free Trial"
        // buttons call navigation.navigate("Login") which goes straight to
        // LoginScreen (email input → OTP flow).
        <>
          <Stack.Screen
            name="Landing"
            component={LandingScreen}
            options={{ animation: "fade" }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ animation: "slide_from_right" }}
          />
        </>
      ) : (
        // ── AUTHENTICATED ─────────────────────────────────────────────────────
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Details" component={DetailsScreen} />
          <Stack.Screen name="Genre" component={GenreScreen} />
          <Stack.Screen name="Alphabet" component={AlphabetScreen} />
          <Stack.Screen name="Profile" component={ProfileOrAdmin} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen
            name="PublicProfile"
            component={PublicProfileScreen}
            options={{ presentation: "transparentModal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="Player"
            component={PlayerScreen}
            options={{ presentation: "transparentModal" }}
          />
          <Stack.Screen name="Subscription" component={SubscriptionScreen} />
          <Stack.Screen name="SubscriptionSuccess" component={SubscriptionSuccessScreen} />
          <Stack.Screen name="AboutUs" component={AboutUsScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="WatchHistory" component={WatchHistoryScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Watchlist" component={WatchlistScreen} options={{ animation: "slide_from_right" }} />


        </>
      )}
    </Stack.Navigator>
  );
}

function AppContent({ linking }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#080809", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#DC143C" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const prefix = Linking.createURL("/");
  const linking = {
    prefixes: [prefix, "animexis://", "https://animexisv1.vercel.app"],
    config: {
      screens: {
        SubscriptionSuccess: "subscription-success",
      },
    },
  };

  return (
    <AuthProvider>
      <AppContent linking={linking} />
    </AuthProvider>
  );
}