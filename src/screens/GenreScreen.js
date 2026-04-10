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
  if (width >= 1200) return { cols: 6, cardWidth: (width - 48) / 6 - 12 };
  if (width >= 992)  return { cols: 5, cardWidth: (width - 48) / 5 - 12 };
  if (width >= 768)  return { cols: 4, cardWidth: (width - 48) / 4 - 12 };
  return { cols: 3, cardWidth: (width - 48) / 3 - 12 };
};

// ─── GENRE SCREEN ─────────────────────────────────────────────────────────────
export default function GenreScreen({ route, navigation }) {
  const { slug, title: genreTitle } = route.params;
  const { width } = useWindowDimensions();

  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadMore, setLoadMore] = useState(false);
  const [error,    setError]    = useState(null);
  const [page,     setPage]     = useState(1);
  const [hasMore,  setHasMore]  = useState(true);

  const headerOpacity = useRef(new Animated.Value(0)).current;

  const { cols, cardWidth } = getCardDimensions(width);

  // Fade-in header
  useEffect(() => {
    Animated.timing(headerOpacity, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start();
  }, []);

  const fetchGenre = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadMore(true);
      setError(null);

      const res  = await API.get(`/api/anime/genre/${slug}?page=${pageNum}`);
      const data = res.data.results || res.data.anime || [];

      if (append) setResults(prev => [...prev, ...data]);
      else        setResults(data);

      setHasMore(data.length >= 20);
    } catch {
      setError("Failed to load genre anime.");
    } finally {
      setLoading(false);
      setLoadMore(false);
    }
  }, [slug]);

  useEffect(() => { fetchGenre(1); }, [fetchGenre]);

  const handleLoadMore = useCallback(() => {
    if (loadMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchGenre(next, true);
  }, [loadMore, hasMore, page, fetchGenre]);

  const navigateToDetails = useCallback((item) => {
    const id = item.slug || item.id || item.url?.split("/").pop() || null;
    if (!id) return;
    navigation.navigate("Details", { id, title: item.title || "Unknown" });
  }, [navigation]);

  const renderFooter = useCallback(() => {
    return (
      <>
        {loadMore && (
          <View style={styles.footerLoader}>
            <DotCircleLoader size={24} color={C.crimson} />
          </View>
        )}
        <AppFooter />
      </>
    );
  }, [loadMore]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyBox}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="film-outline" size={36} color={C.dim} />
        </View>
        <Text style={styles.emptyTitle}>Nothing here yet</Text>
        <Text style={styles.emptyText}>No anime found for this genre.</Text>
      </View>
    );
  }, [loading]);

  const renderItem = useCallback(({ item, index }) => (
    <AnimeCard
      item={item}
      cardWidth={cardWidth}
      onPress={navigateToDetails}
      index={index}
      containerStyle={{ margin: 6 }}
    />
  ), [cardWidth, navigateToDetails]);

  const keyExtractor = useCallback((item, i) =>
    `${item.slug || item.id || i}`, []);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* ── HEADER ── */}
      <Animated.View style={[styles.headerWrapper, { opacity: headerOpacity }]}>
        <BlurView intensity={90} tint="dark" style={styles.header}>
          {/* Top glass accent line */}
          <LinearGradient
            colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerAccentLine}
          />
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={20} color={C.white} />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>{genreTitle || slug}</Text>
              {results.length > 0 && (
                <View style={styles.countBadge}>
                  <Ionicons name="layers-outline" size={10} color={C.crimson} style={{ marginRight: 4 }} />
                  <Text style={styles.countText}>
                    {results.length}{hasMore ? "+" : ""}
                  </Text>
                </View>
              )}
            </View>

            {/* Sort/Filter button placeholder */}
            <TouchableOpacity style={styles.filterBtn}>
              <Ionicons name="options-outline" size={18} color={C.dim} />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      {/* ── LOADING ── */}
      {loading && (
        <View style={styles.centered}>
          <View style={styles.loaderRing}>
            <DotCircleLoader size={54} color={C.crimson} />
          </View>
          <Text style={styles.loadingText}>Loading {genreTitle}…</Text>
        </View>
      )}

      {/* ── ERROR ── */}
      {!loading && error && (
        <View style={styles.centered}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle" size={40} color={C.crimson} />
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchGenre(1)}>
            <Ionicons name="refresh" size={15} color={C.white} style={{ marginRight: 6 }} />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── GRID ── */}
      {!loading && !error && (
        <FlatList
          data={results}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={cols}
          key={cols}
          contentContainerStyle={styles.grid}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          updateCellsBatchingPeriod={50}
        />
      )}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Header ──
  headerWrapper: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 10,
  },
  header: {
    overflow: "hidden",
  },
  headerAccentLine: {
    height: 2,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBtn: {
    width: 38, height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    color: C.white,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  countText: {
    color: C.dim,
    fontSize: 11,
    fontWeight: "700",
  },

  // ── Grid ──
  grid: {
    paddingTop: 116,
    paddingHorizontal: 10,
    paddingBottom: 0,
    flexGrow: 1,
  },

  // ── States ──
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingTop: 100,
  },
  loaderRing: {
    width: 64, height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: C.dim,
    fontSize: 13,
  },
  errorIconWrap: {
    width: 76, height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  errorTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
  },
  errorText: {
    color: C.dim,
    fontSize: 13,
    textAlign: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.crimson,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 30,
    marginTop: 4,
  },
  retryText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyBox: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyIconWrap: {
    width: 70, height: 70,
    borderRadius: 35,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyText: {
    color: C.dim,
    fontSize: 13,
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  loadMoreText: {
    color: C.dimmer,
    fontSize: 12,
  },
});