import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Platform,
  ScrollView,
  TextInput,
  Animated,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { useAuth } from "../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "../theme";
import API from "../services/api";
import { SkeletonList } from "../components/SkeletonGrid";

const { width } = Dimensions.get("window");
const STATUSES = ['All', 'Watching', 'Plan to Watch', 'Completed', 'On Hold', 'Dropped'];

const WatchlistCard = React.memo(({ item, index, onPress }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay: index * 40, useNativeDriver: true }),
      Animated.spring(slideX, { toValue: 0, tension: 50, friction: 8, delay: index * 40, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX: slideX }] }}>
      <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.8}>
        <Image source={{ uri: item.image }} style={styles.cardImage} contentFit="cover" transition={300} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.status === 'Completed' ? 'rgba(34,197,94,0.12)' : 'rgba(220,20,60,0.12)' }]}>
            <Text style={[styles.statusText, { color: item.status === 'Completed' ? '#22c55e' : C.crimson }]}>{item.status}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.dimmer} />
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function WatchlistScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStatus, setActiveStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState("");

  const fetchWatchlist = useCallback(async () => {
    if (!user?.email) return;
    try {
      const res = await API.get("/api/stats/watchlist");
      if (res.data.success) {
        setWatchlist(res.data.list || []);
      }
    } catch (err) {
      console.error("Failed to fetch watchlist:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const filteredList = useMemo(() => {
    let result = watchlist;
    if (activeStatus !== 'All') {
      result = result.filter(item => item.status === activeStatus);
    }
    if (searchQuery) {
      result = result.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return result;
  }, [watchlist, activeStatus, searchQuery]);

  const handlePress = (item) => {
    navigation.navigate("Details", { id: item.id, title: item.title });
  };

  const renderHeader = () => (
    <BlurView intensity={80} tint="dark" style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Watchlist</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={C.dim} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search in ${activeStatus}...`}
            placeholderTextColor={C.dimmer}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.filterBar}
      >
        {STATUSES.map(s => (
          <TouchableOpacity 
            key={s} 
            onPress={() => setActiveStatus(s)}
            style={[styles.filterChip, activeStatus === s && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, activeStatus === s && styles.filterTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </BlurView>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={[C.void, C.bg]} style={StyleSheet.absoluteFill} />
      
      {loading ? (
        <View style={{ paddingTop: 180 }}>
          <SkeletonList count={10} />
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={() => <View style={{ height: 160 + insets.top }} />}
          renderItem={({ item, index }) => <WatchlistCard item={item} index={index} onPress={handlePress} />}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchWatchlist(); }}
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="bookmark-outline" size={64} color={C.surfaceHigh} />
              </View>
              <Text style={styles.emptyTitle}>{searchQuery ? "No Matches" : "Nothing Here"}</Text>
              <Text style={styles.emptyText}>
                {searchQuery 
                  ? "Try a different search query." 
                  : `Items marked as ${activeStatus} will appear here.`}
              </Text>
              {activeStatus === 'All' && !searchQuery && (
                <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate("Home")}>
                  <Text style={styles.browseBtnText}>Find Anime</Text>
                </TouchableOpacity>
              )}
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
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 20, 
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' 
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 50 },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  backBtn: { 
    width: 38, height: 38, borderRadius: 12, 
    justifyContent: "center", alignItems: "center", 
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  searchContainer: { paddingHorizontal: 16, marginTop: 10 },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    height: 38,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
  },
  searchInput: { flex: 1, color: C.white, fontSize: 14, fontWeight: '500' },
  filterBar: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  filterChip: { 
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' 
  },
  filterChipActive: { backgroundColor: C.crimson, borderColor: C.crimson },
  filterText: { color: C.dim, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: C.white },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40, paddingTop: 100 },
  emptyIconWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.02)', justifyContent: "center", alignItems: "center", marginBottom: 20 },
  emptyTitle: { color: C.white, fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptyText: { color: C.dim, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  browseBtn: { backgroundColor: C.crimson, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  browseBtnText: { color: C.white, fontWeight: "700" },
  listContent: { padding: 16, paddingBottom: 40 },
  card: { 
    flexDirection: "row", alignItems: "center", 
    backgroundColor: C.surface, borderRadius: 14, 
    padding: 10, marginBottom: 10, 
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' 
  },
  cardImage: { width: 44, height: 64, borderRadius: 8, backgroundColor: C.surfaceHigh },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardTitle: { color: C.white, fontSize: 14, fontWeight: "700", marginBottom: 6, letterSpacing: -0.2 },

  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "800", textTransform: 'uppercase', letterSpacing: 0.5 },
});
