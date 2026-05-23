import React, { useState, useEffect, useCallback } from "react";
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
import AppFooter from "../components/AppFooter";

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

const FORMATS = ["TV", "Movie", "OVA", "ONA", "Special", "Music"];
const STATUSES = ["Ongoing", "Completed", "Upcoming"];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2007 }, (_, i) => String(currentYear - i));
const toFilterSlug = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "-");

// ─── Horizontal Filter Pills ────────────────────────────────────────────────
function FilterPills({ options, activeValue, onSelect }) {
  return (
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
            onPress={() => onSelect(isActive ? null : opt)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Shimmer Placeholder Card ───────────────────────────────────────────────
function ShimmerCard({ cardWidth, cardHeight }) {
  return (
    <View style={{
      width: cardWidth,
      height: cardHeight,
      backgroundColor: C.surfaceHigh,
      borderRadius: 8,
      marginRight: 10,
      opacity: 0.5,
    }} />
  );
}

// ─── Explore Section (1 row: title + pills + horizontal anime cards) ────────
function ExploreSection({ title, icon, pills, activePill, onPillSelect, anime, loading, onPressAnime, cardWidth, cardHeight }) {
  return (
    <View style={styles.section}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionAccent} />
        <Ionicons name={icon} size={18} color={C.crimson} style={{ marginRight: 8 }} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {/* Filter Pills */}
      <View style={{ marginBottom: 14 }}>
        <FilterPills options={pills} activeValue={activePill} onSelect={onPillSelect} />
      </View>

      {/* Horizontal Anime Cards */}
      {loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <ShimmerCard key={i} cardWidth={cardWidth} cardHeight={cardHeight} />
          ))}
        </ScrollView>
      ) : anime.length === 0 ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyRowText}>
            No anime found. Try a different filter.
          </Text>
        </View>
      ) : (
        <FlatList
          data={anime}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `${item.slug || item.id}-${index}`}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item, index }) => (
            <AnimeCard
              item={item}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              onPress={onPressAnime}
              index={index}
              containerStyle={{ marginRight: 10 }}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── EXPLORE SCREEN ─────────────────────────────────────────────────────────
export default function ExploreScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Card sizing for horizontal rows
  const cardWidth = isMobile ? width * 0.34 : 160;
  const cardHeight = cardWidth * 1.4;

  // ── Genre State ──
  const [activeGenre, setActiveGenre] = useState("Action");
  const [genreAnime, setGenreAnime] = useState([]);
  const [genreLoading, setGenreLoading] = useState(true);

  // ── Master List (for Format / Status / Year filtering) ──
  const [formatAnime, setFormatAnime] = useState([]);
  const [formatLoading, setFormatLoading] = useState(true);

  // ── Format State ──
  const [activeFormat, setActiveFormat] = useState("TV");

  // ── Status State ──
  const [activeStatus, setActiveStatus] = useState("Ongoing");
  const [statusAnime, setStatusAnime] = useState([]);
  const [statusLoading, setStatusLoading] = useState(true);

  // ── Year State ──
  const [activeYear, setActiveYear] = useState(String(currentYear));
  const [yearAnime, setYearAnime] = useState([]);
  const [yearLoading, setYearLoading] = useState(true);

  // ── Navigation helper ──
  const navigateToDetails = useCallback((item) => {
    const id = item.slug || item.id;
    if (id) navigation.navigate("Details", { id, title: item.title });
  }, [navigation]);

  // ── Fetch Genre anime from backend ──
  useEffect(() => {
    if (!activeGenre) {
      setGenreAnime([]);
      setGenreLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setGenreLoading(true);
      try {
        const slug = activeGenre.toLowerCase().replace(/\s+/g, "-");
        const res = await API.get(`/api/anime/genre/${slug}?page=1`);
        if (!cancelled) {
          setGenreAnime(res.data.results || []);
        }
      } catch (err) {
        console.error("[explore] genre fetch:", err.message);
        if (!cancelled) setGenreAnime([]);
      } finally {
        if (!cancelled) setGenreLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeGenre]);

  // ── Fetch Master List (popular anime, multiple pages) for client-side filters ──
  const fetchExploreFilter = useCallback(async (value, setData, setLoading, logKey) => {
    if (!value) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const slug = toFilterSlug(value);
      const res = await API.get(`/api/anime/genre/${encodeURIComponent(slug)}?page=1`);
      setData(res.data.results || []);
    } catch (err) {
      console.error(`[explore] ${logKey} fetch:`, err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Client-side filtered lists ──
  useEffect(() => {
    let active = true;
    fetchExploreFilter(
      activeFormat,
      (data) => { if (active) setFormatAnime(data); },
      (loading) => { if (active) setFormatLoading(loading); },
      "format"
    );
    return () => { active = false; };
  }, [activeFormat, fetchExploreFilter]);

  useEffect(() => {
    let active = true;
    fetchExploreFilter(
      activeStatus,
      (data) => { if (active) setStatusAnime(data); },
      (loading) => { if (active) setStatusLoading(loading); },
      "status"
    );
    return () => { active = false; };
  }, [activeStatus, fetchExploreFilter]);

  useEffect(() => {
    let active = true;
    fetchExploreFilter(
      activeYear,
      (data) => { if (active) setYearAnime(data); },
      (loading) => { if (active) setYearLoading(loading); },
      "year"
    );
    return () => { active = false; };
  }, [activeYear, fetchExploreFilter]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── Fixed Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <LinearGradient
          colors={["rgba(8,8,9,0.98)", "rgba(8,8,9,0.85)", "rgba(8,8,9,0)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerContent}>
          <View style={styles.headerAccent} />
          <Text style={styles.headerTitle}>Explore</Text>
        </View>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 60 + insets.top,
          paddingBottom: isMobile ? 92 + insets.bottom : 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* GENRES SECTION */}
        <ExploreSection
          title="Genres"
          icon="flame-outline"
          pills={GENRES}
          activePill={activeGenre}
          onPillSelect={setActiveGenre}
          anime={genreAnime}
          loading={genreLoading}
          onPressAnime={navigateToDetails}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />

        {/* FORMAT SECTION */}
        <ExploreSection
          title="Format"
          icon="tv-outline"
          pills={FORMATS}
          activePill={activeFormat}
          onPillSelect={setActiveFormat}
          anime={formatAnime}
          loading={formatLoading}
          onPressAnime={navigateToDetails}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />

        {/* STATUS SECTION */}
        <ExploreSection
          title="Status"
          icon="radio-button-on-outline"
          pills={STATUSES}
          activePill={activeStatus}
          onPillSelect={setActiveStatus}
          anime={statusAnime}
          loading={statusLoading}
          onPressAnime={navigateToDetails}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />

        {/* YEAR SECTION */}
        <ExploreSection
          title="Release Year"
          icon="calendar-outline"
          pills={YEARS}
          activePill={activeYear}
          onPillSelect={setActiveYear}
          anime={yearAnime}
          loading={yearLoading}
          onPressAnime={navigateToDetails}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />

        <AppFooter />
      </ScrollView>
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
    paddingBottom: 10,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: C.crimson,
    marginRight: 10,
  },
  headerTitle: {
    color: C.white,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  // ── Sections ──
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: C.crimson,
    marginRight: 8,
  },
  sectionTitle: {
    color: C.white,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  // ── Filter Pills ──
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
  // ── Empty ──
  emptyRow: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyRowText: {
    color: C.dim,
    fontSize: 13,
  },
});
