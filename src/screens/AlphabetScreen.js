import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { BlurView } from "expo-blur";
import API from "../services/api";
import { C } from "../theme";
import AppFooter from "../components/AppFooter";
import AnimeCard from "../components/AnimeCard";
import DotCircleLoader from "../components/DotCircleLoader";


// ─── RESPONSIVE GRID ──────────────────────────────────────────────────────────
const getCardDimensions = (width) => {
  if (width >= 1200) return { cols: 6, cardWidth: (width - 20) / 6 - 12 };
  if (width >= 992)  return { cols: 5, cardWidth: (width - 20) / 5 - 12 };
  if (width >= 768)  return { cols: 4, cardWidth: (width - 20) / 4 - 12 };
  return { cols: 2, cardWidth: (width - 20) / 2 - 12 };
};

// ─── ALPHABET SCREEN ──────────────────────────────────────────────────────────
export default function AlphabetScreen({ route, navigation }) {
  const { letter } = route.params;
  const { width } = useWindowDimensions();

  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadMore, setLoadMore] = useState(false);
  const [page,     setPage]     = useState(1);
  const [hasMore,  setHasMore]  = useState(true);

  const { cols, cardWidth } = getCardDimensions(width);

  const fetchByLetter = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadMore(true);
      const res = await API.get(`/api/anime/alphabet/${encodeURIComponent(letter)}?page=${pageNum}`);
      const data = res.data.results || [];

      if (append) setResults(prev => [...prev, ...data]);
      else setResults(data);

      setHasMore(res.data.hasNextPage);
    } catch (e) {
      console.warn("Alphabet fetch failed:", e.message);
    } finally {
      setLoading(false);
      setLoadMore(false);
    }
  }, [letter]);

  useEffect(() => { fetchByLetter(1); }, [fetchByLetter]);

  const handleLoadMore = useCallback(() => {
    if (loadMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchByLetter(next, true);
  }, [loadMore, hasMore, page, fetchByLetter]);

  const navigateToDetails = useCallback((item) => {
    const id = item.slug || item.id;
    navigation.navigate("Details", { id, title: item.title });
  }, [navigation]);

  const renderFooter = () => (
    <View>
      {loadMore && (
        <View style={{ alignItems: "center", marginVertical: 20 }}>
          <DotCircleLoader size={28} color={C.crimson} />
        </View>
      )}
      <AppFooter />
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      
      <BlurView intensity={90} tint="dark" style={styles.header}>
        <LinearGradient
          colors={["rgba(220,20,60,0.15)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <View style={styles.breadcrumb}>
               <Text style={styles.breadcrumbText}>LIBRARY</Text>
               <Ionicons name="chevron-forward" size={10} color={C.dimmer} />
               <Text style={styles.breadcrumbActive}>ALPHABETICAL</Text>
            </View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>Discovering <Text style={{ color: C.crimson }}>{letter}</Text></Text>
              {results.length > 0 && (
                <View style={styles.resultBadge}>
                   <Text style={styles.resultBadgeText}>{results.length}{hasMore ? "+" : ""} Series</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </BlurView>

      {loading ? (
        <View style={styles.centered}>
          <DotCircleLoader size={54} color={C.crimson} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, i) => `${item.slug || i}`}
          renderItem={({ item, index }) => (
            <AnimeCard item={item} cardWidth={cardWidth} index={index} onPress={navigateToDetails} containerStyle={{ margin: 6 }} />
          )}
          numColumns={cols}
          key={cols}
          contentContainerStyle={styles.grid}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { paddingTop: 48, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
  headerContent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 14 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", justifyContent: "center", alignItems: "center" },
  headerInfo: { flex: 1, justifyContent: "center" },
  breadcrumb: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  breadcrumbText: { color: C.dimmer, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  breadcrumbActive: { color: C.dim, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  headerTitle: { color: C.white, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  resultBadge: {
    backgroundColor: "rgba(220,20,60,0.12)",
    borderWidth: 1,
    borderColor: "rgba(220,20,60,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  resultBadgeText: { color: C.crimson, fontSize: 10, fontWeight: "800" },
  grid: { paddingTop: 20, paddingHorizontal: 10, paddingBottom: 0, flexGrow: 1 },
  cardImageWrap: { borderRadius: 16, overflow: "hidden", backgroundColor: C.surfaceHigh },
  cardImage: { width: "100%", height: "100%" },
  placeholderGradient: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  placeholderLetter: { color: C.white, fontSize: 48, fontWeight: "900", opacity: 0.25 },
  cardContent: { paddingVertical: 8, paddingHorizontal: 4 },
  cardTitle: { color: C.white, fontSize: 13, fontWeight: "600", textAlign: "center" },
  cardSub: { color: C.dim, fontSize: 11, textAlign: "center", marginTop: 2 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: C.dim, fontSize: 14 },
  glowBorder: {
    position: "absolute",
    top: -2, left: -2,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.crimson,
    shadowColor: C.crimson,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 8,
    zIndex: -1
  },
});
