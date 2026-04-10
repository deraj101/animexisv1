import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import API from "./src/services/api";

import LandingScreen        from "./src/screens/LandingScreen";   // ← NEW
import LoginScreen          from "./src/screens/LoginScreen";
import HomeScreen           from "./src/screens/HomeScreen";
import DetailsScreen        from "./src/screens/DetailsScreen";
import PlayerScreen         from "./src/screens/PlayerScreen";
import GenreScreen          from "./src/screens/GenreScreen";
import ProfileScreen        from "./src/screens/ProfileScreen";
import AdminDashboardScreen from "./src/screens/AdminDashboardScreen";
import NotificationsScreen  from "./src/screens/NotificationsScreen"; // 🔔 NEW
import PublicProfileScreen  from "./src/screens/PublicProfileScreen"; // 👤 NEW
import SubscriptionScreen   from "./src/screens/SubscriptionScreen";  // 💳 NEW
import SubscriptionSuccessScreen from "./src/screens/SubscriptionSuccessScreen"; // ✅ NEW
import AlphabetScreen from "./src/screens/AlphabetScreen"; // 🔠 NEW

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Silently log app visit for analytics
    API.post("/api/anime/visit").catch(() => {});
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#080809", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#DC143C" />
      </View>
    );
  }

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
          <Stack.Screen name="Home"    component={HomeScreen} />
          <Stack.Screen name="Details" component={DetailsScreen} />
          <Stack.Screen name="Genre"   component={GenreScreen} />
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
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const linking = {
    prefixes: ["animexis://", "exp://", "https://animexisv1.vercel.app"],
    config: {
      screens: {
        SubscriptionSuccess: "subscription-success",
      },
    },
  };

  return (
    <AuthProvider>
      <NavigationContainer linking={linking}>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}