import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Alert,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useAuth } from "../context/AuthContext";
import { C } from "../theme";
import API from "../services/api";
import { SkeletonList } from "../components/SkeletonGrid";

const { width } = Dimensions.get("window");

const HistoryItem = React.memo(({ item, onPress }) => {
  const date = new Date(item.watched_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <TouchableOpacity style={styles.historyCard} onPress={() => onPress(item)} activeOpacity={0.8}>
      <Image source={{ uri: item.image }} style={styles.historyImage} contentFit="cover" transition={300} />
      <View style={styles.historyInfo}>
        <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.historySubtitle}>Episode {item.episode_number}</Text>
        <View style={styles.historyFooter}>
          <Ionicons name="time-outline" size={12} color={C.dim} />
          <Text style={styles.historyDate}>{date}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.dim} />
    </TouchableOpacity>
  );
});

export default function WatchHistoryScreen({ navigation }) {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!user?.email) return;
    try {
      const res = await API.get(`/api/anime/watch-history?email=${encodeURIComponent(user.email)}`);
      if (res.data.success) {
        setHistory(res.data.list || []);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleClearHistory = useCallback(async () => {
    const confirmed = Platform.OS === 'web' 
      ? window.confirm("Clear all watch history?")
      : await new Promise(r => Alert.alert("Clear History", "Delete all watch history records?", [
          { text: "Cancel", style: "cancel", onPress: () => r(false) },
          { text: "Clear", style: "destructive", onPress: () => r(true) }
        ]));

    if (!confirmed) return;

    try {
      const res = await API.delete("/api/anime/watch-history", { data: { email: user.email } });
      if (res.data.success) {
        setHistory([]);
        Alert.alert("Success", "Watch history cleared.");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to clear history.");
    }
  }, [user?.email]);

  const handlePress = (item) => {
    navigation.navigate("Details", { id: item.anime_id, title: item.title });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Watch History</Text>
        <TouchableOpacity onPress={handleClearHistory} style={styles.clearBtn} disabled={history.length === 0}>
          <Text style={[styles.clearBtnText, history.length === 0 && { opacity: 0.3 }]}>Clear</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.headerAccent} />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={[C.void, C.bg]} style={StyleSheet.absoluteFill} />
      
      {renderHeader()}

      {loading ? (
        <View style={{ flex: 1 }}>
          <SkeletonList count={8} />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="film-outline" size={64} color={C.surfaceHigh} />
          </View>
          <Text style={styles.emptyTitle}>No History Yet</Text>
          <Text style={styles.emptyText}>Anime you watch will appear here.</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate("Home")}>
            <Text style={styles.browseBtnText}>Start Watching</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item, index) => item._id || index.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <HistoryItem item={item} onPress={handlePress} />}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchHistory(); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 56 },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: "700" },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", backgroundColor: C.surfaceHigh },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  clearBtnText: { color: C.crimson, fontWeight: "600", fontSize: 14 },
  headerAccent: { height: 3, width: 40, backgroundColor: C.crimson, marginLeft: 16, marginTop: -2, borderRadius: 2 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  emptyIconWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.surface, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  emptyTitle: { color: C.white, fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptyText: { color: C.dim, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  browseBtn: { backgroundColor: C.crimson, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  browseBtnText: { color: C.white, fontWeight: "700" },
  listContent: { padding: 16, paddingBottom: 40 },
  historyCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  historyImage: { width: 60, height: 80, borderRadius: 8, backgroundColor: C.surfaceHigh },
  historyInfo: { flex: 1, marginLeft: 14 },
  historyTitle: { color: C.white, fontSize: 15, fontWeight: "600", marginBottom: 4 },
  historySubtitle: { color: C.crimson, fontSize: 13, fontWeight: "500", marginBottom: 6 },
  historyFooter: { flexDirection: "row", alignItems: "center" },
  historyDate: { color: C.dim, fontSize: 11, marginLeft: 4 },
});
