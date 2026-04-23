import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Alert,
  Platform,
  TextInput,
  Animated,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { useAuth } from "../context/AuthContext";
import { C } from "../theme";
import * as Stats from "../services/Userstats";
import DotCircleLoader from "../components/DotCircleLoader";
import AnimeCard from "../components/AnimeCard";

const { width } = Dimensions.get("window");



export default function FavoritesScreen({ navigation }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent"); // 'recent' or 'az'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user?.email) return;
    try {
      const list = await Stats.getFavorites(user.email);
      setFavorites(list || []);
    } catch (err) {
      console.error("Failed to fetch favorites:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const filteredAndSorted = useMemo(() => {
    let result = [...favorites];
    if (searchQuery) {
      result = result.filter(f => f.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (sortBy === 'az') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }
    return result;
  }, [favorites, searchQuery, sortBy]);

  const handleRemove = useCallback(async (item) => {
    try {
      await Stats.toggleFavorite(user.email, item);
      setFavorites(prev => prev.filter(f => f.id !== item.id));
    } catch {
      Alert.alert("Error", "Failed to remove favorite.");
    }
  }, [user?.email]);

  const handlePress = (item) => {
    navigation.navigate("Details", { id: item.id, title: item.title });
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear Favorites",
      "Are you sure you want to remove all favorites?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
          style: "destructive", 
          onPress: async () => {
            // Logic to clear all favorites would go here
            // For now, let's just show a mock success
            Alert.alert("Coming Soon", "Multi-delete is being implemented.");
          } 
        }
      ]
    );
  };

  const renderHeader = () => (
    <BlurView intensity={80} tint="dark" style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>My Favorites</Text>
          <Text style={styles.headerSubtitle}>{favorites.length} {favorites.length === 1 ? 'anime' : 'animes'}</Text>
        </View>
        <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
          <Ionicons name="trash-outline" size={20} color={C.dim} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.controlsRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={C.dim} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your list..."
            placeholderTextColor={C.dimmer}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
        <TouchableOpacity 
          style={styles.sortBtn} 
          onPress={() => setSortBy(sortBy === 'recent' ? 'az' : 'recent')}
        >
          <Ionicons name={sortBy === 'recent' ? "time-outline" : "text-outline"} size={20} color={C.crimson} />
        </TouchableOpacity>
      </View>
    </BlurView>
  );

  const gridColumns = width >= 1200 ? 6 : width >= 992 ? 5 : width >= 768 ? 4 : 2;
  const gridGap = 10;
  const gridCardWidth = (width - 32 - (gridColumns - 1) * gridGap) / gridColumns;
  const gridCardHeight = gridCardWidth * 1.4;

  return (

    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={[C.void, C.bg]} style={StyleSheet.absoluteFill} />
      
      {loading ? (
        <View style={styles.center}>
          <DotCircleLoader size={40} color={C.crimson} />
        </View>
      ) : (
        <FlatList
          data={filteredAndSorted}
          keyExtractor={(item) => item.id}
          key={gridColumns}
          numColumns={gridColumns}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={{ gap: gridGap }}
          ListHeaderComponent={() => <View style={{ height: 140 }} />}

          renderItem={({ item, index }) => (
            <View style={{ position: 'relative', marginBottom: gridGap }}>
              <AnimeCard 
                item={item} 
                index={index} 
                onPress={handlePress} 
                cardWidth={gridCardWidth}
                cardHeight={gridCardHeight}
                inGrid={true}
                containerStyle={{ marginLeft: 0, marginBottom: 0 }}
              />
              <TouchableOpacity 
                style={styles.removeBtnOverlay} 
                onPress={() => handleRemove(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="heart" size={16} color={C.crimson} />
              </TouchableOpacity>
            </View>
          )}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchFavorites(); }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="heart-dislike-outline" size={64} color={C.surfaceHigh} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? "No Matches Found" : "Your Heart is Empty"}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery 
                  ? "Try searching for something else in your favorites." 
                  : "Save anime you love to find them easily later."}
              </Text>
              {!searchQuery && (
                <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate("Home")}>
                  <Text style={styles.browseBtnText}>Explore Anime</Text>
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
    position: 'absolute', 
    top: 0, left: 0, right: 0, 
    zIndex: 10, 
    paddingTop: Platform.OS === 'ios' ? 50 : 20, 
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)'
  },
  headerTop: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    paddingHorizontal: 16, 
    height: 56 
  },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  headerSubtitle: { color: C.dim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  backBtn: { 
    width: 40, height: 40, borderRadius: 12, 
    justifyContent: "center", alignItems: "center", 
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  clearBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  controlsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 5 },
  searchBar: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    height: 40,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
  },
  searchInput: { flex: 1, color: C.white, fontSize: 14, fontWeight: '500' },
  sortBtn: { 
    width: 40, height: 40, borderRadius: 12, 
    backgroundColor: 'rgba(220,20,60,0.1)', 
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(220,20,60,0.2)'
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40, paddingTop: 100 },
  emptyIconWrap: { 
    width: 120, height: 120, borderRadius: 60, 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    justifyContent: "center", alignItems: "center", 
    marginBottom: 20 
  },
  emptyTitle: { color: C.white, fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptyText: { color: C.dim, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  browseBtn: { backgroundColor: C.crimson, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  browseBtnText: { color: C.white, fontWeight: "700" },
  listContent: { padding: 16, paddingBottom: 40 },
  removeBtnOverlay: { 
    position: "absolute", top: 8, right: 8, 
    width: 28, height: 28, borderRadius: 14, 
    backgroundColor: "rgba(0,0,0,0.6)", 
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 10
  },
});
