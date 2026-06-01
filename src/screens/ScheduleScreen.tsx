// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Platform,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import API from "../services/api";
import { C } from "../theme";

const { width } = Dimensions.get("window");

function getCountdownText(targetTimeStr) {
  if (!targetTimeStr) return null;
  // Convert "YYYY-MM-DD HH:mm:ss" to "YYYY-MM-DDTHH:mm:ss" for bulletproof native parsing
  const safeTimeStr = targetTimeStr.includes('T') ? targetTimeStr : targetTimeStr.replace(' ', 'T');
  const target = new Date(safeTimeStr);
  const now = new Date();
  const diffMs = target - now;

  if (diffMs <= 0) {
    return "Available Now";
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (diffHours > 24) {
    return `In ${Math.ceil(diffHours / 24)} days`;
  }
  if (diffHours > 0) {
    return `In ${diffHours}h ${mins}m`;
  }
  return `In ${mins}m`;
}

// Live Countdown Timer hook
function useCountdown(targetTimeStr) {
  const [text, setText] = useState(() => getCountdownText(targetTimeStr));

  useEffect(() => {
    setText(getCountdownText(targetTimeStr));
    const interval = setInterval(() => {
      setText(getCountdownText(targetTimeStr));
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [targetTimeStr]);

  return text;
}

// Render schedule item card
function ScheduleItemCard({ item, onPress }) {
  const countdown = useCountdown(item.time);
  const isReleased = item.status?.toLowerCase() === "released";

  const formattedTime = useMemo(() => {
    if (!item.time) return null;
    const safeTimeStr = item.time.includes('T') ? item.time : item.time.replace(' ', 'T');
    const d = new Date(safeTimeStr);
    return isNaN(d) ? "Unknown Time" : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [item.time]);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => onPress(item)}>
      {/* Background Poster Image */}
      <View style={styles.posterContainer}>
        <Image
          source={{ uri: item.image || "https://placehold.co/150x210/111115/DC143C?text=N/A" }}
          style={styles.posterImage}
          contentFit="cover"
          transition={300}
        />
        <LinearGradient
          colors={["rgba(8,8,9,0.2)", "rgba(8,8,9,0.95)"]}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Status Overlay Badge */}
        <View style={[styles.statusBadge, isReleased ? styles.badgeReleased : styles.badgeScheduled]}>
          <Text style={styles.statusText}>{item.status || "Scheduled"}</Text>
        </View>
      </View>

      {/* Info Panel */}
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        
        <View style={styles.metaRow}>
          <Ionicons name="film-outline" size={14} color={C.dim} />
          <Text style={styles.metaText}>{item.episode || "Upcoming Ep"}</Text>
        </View>

        {formattedTime && (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={C.dim} />
            <Text style={styles.metaText}>{formattedTime}</Text>
          </View>
        )}

        {countdown && (
          <View style={styles.countdownContainer}>
            <View style={[styles.liveDot, isReleased ? styles.dotGreen : styles.dotOrange]} />
            <Text style={[styles.countdownText, isReleased ? styles.txtGreen : styles.txtOrange]}>
              {countdown}
            </Text>
          </View>
        )}

        {/* Watch CTA Button */}
        <TouchableOpacity style={styles.watchBtn} onPress={() => onPress(item)}>
          <Ionicons name={isReleased ? "play-circle" : "alert-circle-outline"} size={16} color={C.white} />
          <Text style={styles.watchBtnText}>{isReleased ? "Watch Now" : "Details"}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function ScheduleScreen({ navigation }) {
  const [schedule, setSchedule] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await API.get("/api/anime/schedule");
      if (res?.data?.success && res.data.results) {
        setSchedule(res.data.results);
      }
    } catch (err) {
      console.warn("Failed to fetch schedule:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const filteredSchedule = useMemo(() => {
    if (!searchQuery) return schedule;
    return schedule.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [schedule, searchQuery]);

  const handlePress = (item) => {
    navigation.navigate("Details", { id: item.slug || item.id, title: item.title });
  };

  const renderHeader = () => (
    <BlurView intensity={85} tint="dark" style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Release Schedule</Text>
          <Text style={styles.headerSubtitle}>Synchronized Live with Releases</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.controlsRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={C.dim} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search scheduled releases..."
            placeholderTextColor={C.dimmer}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>
    </BlurView>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={[C.void, C.bg]} style={StyleSheet.absoluteFill} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.crimson} />
          <Text style={styles.loadingText}>Syncing schedule...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSchedule}
          keyExtractor={(item, index) => item.id || index.toString()}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={() => <View style={{ height: 140 }} />}
          renderItem={({ item }) => (
            <ScheduleItemCard item={item} onPress={handlePress} />
          )}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchSchedule();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="calendar-outline" size={64} color={C.surfaceHigh} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? "No Matches Found" : "Schedule Empty"}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? "Try searching for another anime title."
                  : "No scheduled releases found for today. Check back later!"}
              </Text>
            </View>
          }
        />
      )}

      {renderHeader()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === "ios" ? 50 : 25,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
  },
  headerTitleContainer: { flex: 1, alignItems: "center" },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  headerSubtitle: { color: C.dim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  controlsRow: { flexDirection: "row", paddingHorizontal: 16, marginTop: 5 },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  searchInput: { flex: 1, color: C.white, fontSize: 14, fontWeight: "500" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: C.dim, fontSize: 14, fontWeight: "600", marginTop: 12 },
  listContent: { padding: 16, paddingBottom: 40 },
  
  // Card Styles
  card: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    marginBottom: 16,
    overflow: "hidden",
    height: 160,
  },
  posterContainer: {
    width: 110,
    height: "100%",
    position: "relative",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeReleased: {
    backgroundColor: "rgba(46, 204, 113, 0.15)",
    borderColor: "rgba(46, 204, 113, 0.3)",
  },
  badgeScheduled: {
    backgroundColor: "rgba(230, 126, 34, 0.15)",
    borderColor: "rgba(230, 126, 34, 0.3)",
  },
  statusText: {
    color: C.white,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoContainer: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  title: {
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    color: C.dim,
    fontSize: 12,
    fontWeight: "600",
  },
  countdownContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotGreen: { backgroundColor: "#2ecc71" },
  dotOrange: { backgroundColor: "#e67e22" },
  countdownText: {
    fontSize: 12,
    fontWeight: "800",
  },
  txtGreen: { color: "#2ecc71" },
  txtOrange: { color: "#e67e22" },
  watchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.crimson,
    borderRadius: 10,
    height: 32,
    marginTop: 8,
  },
  watchBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "700",
  },

  // Empty Container Styles
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: { color: C.white, fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptyText: { color: C.dim, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
