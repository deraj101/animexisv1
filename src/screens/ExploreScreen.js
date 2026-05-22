import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import API from "../services/api";
import AnimeCard from "../components/AnimeCard";
import SkeletonGrid from "../components/SkeletonGrid"; // Assuming we have this or I'll implement inline shimmer

const C = {
  bg: "#080809",
  surface: "rgba(255,255,255,0.04)",
  surfaceHigh: "rgba(255,255,255,0.08)",
  white: "#fff",
  dim: "rgba(255,255,255,0.55)",
  crimson: "#DC143C",
};

const GENRES = [
  "Action", "Adventure", "Cars", "Comedy", "Dementia", "Demons", "Drama",
  "Ecchi", "Fantasy", "Game", "Harem", "Historical", "Horror", "Isekai",
  "Josei", "Kids", "Magic", "Martial Arts", "Mecha", "Military", "Music",
  "Mystery", "Parody", "Police", "Psychological", "Romance", "Samurai",
  "School", "Sci-Fi", "Seinen", "Shoujo", "Shoujo Ai", "Shounen",
  "Shounen Ai", "Slice of Life", "Space", "Sports", "Super Power",
  "Supernatural", "Thriller", "Vampire",
];

const FORMATS = ["All", "TV", "Movie", "OVA", "ONA", "Special", "Music"];
const STATUSES = ["All", "Ongoing", "Completed", "Upcoming"];
const currentYear = new Date().getFullYear();
const YEARS = ["All", ...Array.from({ length: currentYear - 2008 }, (_, i) => String(currentYear + 1 - i))];

export default function ExploreScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [activeGenre, setActiveGenre] = useState(null);
  const [activeFormat, setActiveFormat] = useState("All");
  const [activeStatus, setActiveStatus] = useState("All");
  const [activeYear, setActiveYear] = useState("All");

  const [animeList, setAnimeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  // Fetch data
  const fetchData = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      }
      const targetPage = reset ? 1 : page + 1;

      let endpoint = `/api/anime/popular?page=${targetPage}`;
      if (activeGenre) {
        const slug = activeGenre.toLowerCase().replace(/\s+/g, "-");
        endpoint = `/api/anime/genre/${slug}?page=${targetPage}`;
      }

      const res = await API.get(endpoint);
      const results = res.data.results || res.data.episodes || [];

      setAnimeList((prev) => reset ? results : [...prev, ...results]);
      setHasNext(res.data.hasNextPage || results.length > 0); // Assuming if results>0 there might be more
      if (!reset) setPage(targetPage);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeGenre, page]);

  useEffect(() => {
    fetchData(true);
  }, [activeGenre]);

  // Client-side filtering for Format, Status, Year
  const filteredAnime = useMemo(() => {
    return animeList.filter((item) => {
      let match = true;
      if (activeFormat !== "All") {
        const category = (item.category || item.type || "").toLowerCase();
        if (!category.includes(activeFormat.toLowerCase())) match = false;
      }
      if (activeStatus !== "All") {
        const status = (item.status || "").toLowerCase();
        if (activeStatus === "Ongoing" && !status.includes("ongoing")) match = false;
        if (activeStatus === "Completed" && !status.includes("complete")) match = false;
        if (activeStatus === "Upcoming" && !status.includes("upcoming")) match = false;
      }
      if (activeYear !== "All") {
        const year = (item.premiered || item.seasonYear || item.releaseDate || "").toString();
        if (!year.includes(activeYear)) match = false;
      }
      return match;
    });
  }, [animeList, activeFormat, activeStatus, activeYear]);

  // Grid calculations
  const gridColumns = width >= 1200 ? 6 : width >= 992 ? 5 : width >= 768 ? 4 : 2;
  const gridGap = 10;
  const gridCardWidth = (width - 32 - (gridColumns - 1) * gridGap) / gridColumns;
  const gridCardHeight = gridCardWidth * 1.4;

  const navigateToDetails = useCallback((item) => {
    const id = item.slug || item.id;
    if (id) navigation.navigate("Details", { id, title: item.title });
  }, [navigation]);

  const FilterRow = ({ title, options, activeValue, onSelect }) => (
    <View style={styles.filterSection}>
      <Text style={styles.filterTitle}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {options.map((opt) => {
          const isActive = activeValue === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => onSelect(isActive && title === "Genres" ? null : opt)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <LinearGradient
          colors={["rgba(8,8,9,0.98)", "rgba(8,8,9,0.85)", "rgba(8,8,9,0)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerContent}>
          <View style={styles.sectionAccent} />
          <Text style={styles.headerTitle}>Explore</Text>
        </View>
      </View>

      <FlatList
        data={filteredAnime}
        keyExtractor={(item, index) => `${item.slug || item.id}-${index}`}
        numColumns={isMobile ? 2 : gridColumns}
        key={isMobile ? "mobile" : "desktop"} // Force re-render on layout change
        contentContainerStyle={{
          paddingTop: 80 + insets.top,
          paddingBottom: isMobile ? 110 + insets.bottom : 40 + insets.bottom,
          paddingHorizontal: 16,
        }}
        columnWrapperStyle={{ gap: gridGap, marginBottom: gridGap }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.filtersContainer}>
            <FilterRow title="Genres" options={GENRES} activeValue={activeGenre} onSelect={setActiveGenre} />
            <FilterRow title="Format" options={FORMATS} activeValue={activeFormat} onSelect={setActiveFormat} />
            <FilterRow title="Status" options={STATUSES} activeValue={activeStatus} onSelect={setActiveStatus} />
            <FilterRow title="Release Year" options={YEARS} activeValue={activeYear} onSelect={setActiveYear} />
            
            {/* Header for Results */}
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                {activeGenre || "Popular"} Anime {filteredAnime.length > 0 && `(${filteredAnime.length}+)`}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <AnimeCard
            item={item}
            cardWidth={gridCardWidth}
            cardHeight={gridCardHeight}
            onPress={navigateToDetails}
            index={index}
            inGrid={true}
            containerStyle={{ marginLeft: 0, marginBottom: 0 }}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: gridGap }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <View key={i} style={{ width: gridCardWidth, height: gridCardHeight, backgroundColor: C.surface, borderRadius: 6, opacity: 0.5 }} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="search" size={48} color={C.dim} />
              <Text style={styles.emptyText}>No anime found matching these filters.</Text>
            </View>
          )
        }
        onEndReached={() => {
          if (hasNext && !loading) fetchData(false);
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading && animeList.length > 0 ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text style={{ color: C.dim }}>Loading more...</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    color: C.white,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: C.crimson,
    marginRight: 10,
  },
  filtersContainer: {
    marginBottom: 16,
    marginHorizontal: -16, // to bleed edges for horizontal scroll
  },
  filterSection: {
    marginBottom: 16,
  },
  filterTitle: {
    color: C.white,
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterPill: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  filterPillActive: {
    backgroundColor: C.crimson,
    borderColor: C.crimson,
  },
  filterText: {
    color: C.dim,
    fontSize: 13,
    fontWeight: "600",
  },
  filterTextActive: {
    color: C.white,
    fontWeight: "800",
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  resultsTitle: {
    color: C.white,
    fontSize: 18,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    color: C.dim,
    marginTop: 12,
    fontSize: 14,
  },
});
