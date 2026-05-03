import React, { useEffect } from "react";
import { View, ActivityIndicator, LogBox } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import API from "./src/services/api";
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from "react-native";
import { Analytics } from "@vercel/analytics/react";

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
import DownloadsScreen from "./src/screens/DownloadsScreen"; // 📥 NEW
import PendingApprovalScreen from "./src/screens/PendingApprovalScreen"; // 🛡️ NEW



const Stack = createNativeStackNavigator();

LogBox.ignoreLogs(['[expo-av]: Expo AV has been deprecated', 'expo-notifications: Android Push']);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

  // ── PUSH NOTIFICATIONS ──
  useEffect(() => {
    if (!user) return;

    const setupNotifications = async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        try {
          await API.post("/api/stats/push-token", { token });
          console.log("📲 Push token registered successfully.");
        } catch (err) {
          console.log("❌ Push token registration failed:", err.message);
        }
      }
    };

    setupNotifications();

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.animeId) {
        navigation.navigate("Details", { id: data.animeId });
      }
    });

    return () => responseListener.remove();
  }, [user]);

  // ── MOVED LOADING TO AppContent ──


  const ProfileOrAdmin = user?.isAdmin
    ? AdminDashboardScreen
    : ProfileScreen;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Group>
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
        </Stack.Group>
      ) : user.account_status === 'pending' ? (
        <Stack.Group>
          <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
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
          <Stack.Screen name="Downloads" component={DownloadsScreen} options={{ animation: "slide_from_right" }} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'web') return null;
  if (Constants.appOwnership === 'expo') {
    console.log('Skipping push notifications in Expo Go.');
    return null;
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
        console.log("Error getting push token:", e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
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
      {Platform.OS === 'web' && <Analytics />}
    </AuthProvider>
  );
}