//March 3, 2026
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  RefreshControl,
  Platform,
  useWindowDimensions,
  Alert,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import API from "../services/api";
import * as NotificationApi from "../services/notificationApi"; // 🔔 NEW
import { useAuth } from "../context/AuthContext";
import { C } from "../theme";
import * as ExpoLinking from "expo-linking";
import PremiumBorder from "../components/PremiumBorder"; // 🎨 NEW
import AppFooter from "../components/AppFooter";
import AnimeCard from "../components/AnimeCard";
import DotCircleLoader from "../components/DotCircleLoader";

const SEARCH_DEBOUNCE_MS = 120;
const SEARCH_SKELETON_DELAY_MS = 180;
const SUGGESTION_LIMIT = 10;
const SEARCH_CACHE_TTL_MS = 5 * 60_000;
const searchResultCache = new Map();

const normalizeSearchKey = (text) => String(text || "").trim().toLowerCase();

const getCachedSearch = (key) => {
  const hit = searchResultCache.get(key);
  if (!hit || Date.now() - hit.ts > SEARCH_CACHE_TTL_MS) {
    searchResultCache.delete(key);
    return null;
  }
  return hit.results;
};

const setCachedSearch = (key, results) => {
  searchResultCache.set(key, { results, ts: Date.now() });
  if (searchResultCache.size > 80) {
    const oldestKey = searchResultCache.keys().next().value;
    searchResultCache.delete(oldestKey);
  }
};

const compactAnimeItem = (item) => ({
  id: item.slug || item.id,
  slug: item.slug || item.id,
  title: item.title || "Unknown Anime",
  image: item.image || null,
  year: item.year,
  isCustom: item.isCustom,
});

const getLocalSuggestions = (text, pools = [], limit = SUGGESTION_LIMIT) => {
  const key = normalizeSearchKey(text);
  const seen = new Set();
  const merged = pools.flat().filter(Boolean);
  const scored = merged
    .map(compactAnimeItem)
    .filter(item => {
      const itemKey = item.slug || item.id || item.title;
      if (!item.title || seen.has(itemKey)) return false;
      seen.add(itemKey);
      if (!key) return true;
      return item.title.toLowerCase().includes(key);
    })
    .map(item => {
      const title = item.title.toLowerCase();
      const starts = key && title.startsWith(key) ? 0 : 1;
      const index = key ? title.indexOf(key) : 0;
      return { item, score: starts * 1000 + Math.max(index, 0) };
    })
    .sort((a, b) => a.score - b.score);

  return scored.slice(0, limit).map(({ item }) => item);
};

const HighlightedTitle = React.memo(function HighlightedTitle({ title, query }) {
  const cleanQuery = normalizeSearchKey(query);
  const safeTitle = title || "Unknown Anime";
  const index = cleanQuery ? safeTitle.toLowerCase().indexOf(cleanQuery) : -1;

  if (index < 0) {
    return <Text style={styles.suggestionTitle} numberOfLines={1}>{safeTitle}</Text>;
  }

  return (
    <Text style={styles.suggestionTitle} numberOfLines={1}>
      {safeTitle.slice(0, index)}
      <Text style={styles.suggestionTitleHighlight}>{safeTitle.slice(index, index + cleanQuery.length)}</Text>
      {safeTitle.slice(index + cleanQuery.length)}
    </Text>
  );
});

const getHeroHeight = (w) => {
  if (w >= 1200) return 500;
  if (w >= 992) return 450;
  if (w >= 768) return 400;
  return 480; // 📱 Increased for Mobile Stacking Mode
};

// ─── SIMPLE IN-MEMORY API CACHE ───────────────────────────────────────────────
const _cache = {};
const cachedGet = async (url, ttlMs = 60_000) => {
  const hit = _cache[url];
  if (hit && Date.now() - hit.ts < ttlMs) return hit.data;
  const res = await API.get(url);
  _cache[url] = { data: res, ts: Date.now() };
  return res;
};

// ─── ONGOING CARD (Horizontal) ────────────────────────────────────────────────
const OngoingCard = React.memo(function OngoingCard({ item, onPress, index, width }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(-16)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 40, useNativeDriver: true }),
      Animated.spring(slideX, { toValue: 0, delay: index * 40, tension: 100, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const onPressIn = useCallback(() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start(), []);
  const onPressOut = useCallback(() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start(), []);

  const imgUrl = item.image || "https://placehold.co/100x140/111115/DC143C?text=N";
  const epLabel = item.episode || (item.latestEpisode ? `Ep ${item.latestEpisode.replace(/\D/g, "")}` : "Ongoing");

  return (
    <Animated.View style={{ opacity, transform: [{ translateX: slideX }, { scale }], width: width, marginBottom: 12 }}>
      <TouchableOpacity
        style={styles.ongoingCard}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => onPress(item)}
        activeOpacity={1}
      >
        <Image source={{ uri: imgUrl }} style={styles.ongoingImage} contentFit="cover" transition={300} />
        <View style={styles.ongoingInfo}>
          <Text style={styles.ongoingTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.ongoingBadge}>
            <Ionicons name="play-circle" size={10} color={C.white} />
            <Text style={styles.ongoingBadgeText}>{epLabel}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.dim} style={{ marginRight: 12 }} />
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── SCHEDULE HOME CARD (Horizontal) ──────────────────────────────────────────
const ScheduleHomeCard = React.memo(function ScheduleHomeCard({ item, onPress, index, width }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(16)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 40, useNativeDriver: true }),
      Animated.spring(slideX, { toValue: 0, delay: index * 40, tension: 100, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const onPressIn = useCallback(() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start(), []);
  const onPressOut = useCallback(() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start(), []);

  const imgUrl = item.image || "https://placehold.co/100x140/111115/DC143C?text=N";
  
  let timeStr = "";
  if (item.time) {
    try {
      timeStr = new Date(item.time.replace(/-/g, "/")).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      timeStr = item.time;
    }
  }

  const isReleased = item.status?.toLowerCase() === "released";

  return (
    <Animated.View style={{ opacity, transform: [{ translateX: slideX }, { scale }], width: width, marginBottom: 12 }}>
      <TouchableOpacity
        style={styles.ongoingCard}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => onPress(item)}
        activeOpacity={1}
      >
        <Image source={{ uri: imgUrl }} style={styles.ongoingImage} contentFit="cover" transition={300} />
        <View style={styles.ongoingInfo}>
          <Text style={styles.ongoingTitle} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {timeStr ? (
              <View style={[styles.ongoingBadge, { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }]}>
                <Ionicons name="time-outline" size={10} color={C.dim} />
                <Text style={[styles.ongoingBadgeText, { color: C.dim }]}>{timeStr}</Text>
              </View>
            ) : null}
            {item.episode ? (
              <View style={[styles.ongoingBadge, { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }]}>
                <Ionicons name="film-outline" size={10} color={C.dim} />
                <Text style={[styles.ongoingBadgeText, { color: C.dim }]}>
                  {item.episode.replace(/episode\s*/i, 'Ep ')}
                </Text>
              </View>
            ) : null}
            <View style={[
              styles.ongoingBadge, 
              { 
                backgroundColor: isReleased ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                borderColor: isReleased ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)",
                borderWidth: 1
              }
            ]}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isReleased ? "#10B981" : "#F59E0B", marginRight: 4 }} />
              <Text style={[styles.ongoingBadgeText, { color: isReleased ? "#10B981" : "#F59E0B", fontWeight: "800" }]}>
                {isReleased ? "Released" : "Upcoming"}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.dim} style={{ marginRight: 12 }} />
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── SUGGESTION ITEM ──────────────────────────────────────────────────────────
const SuggestionItem = React.memo(function SuggestionItem({ item, onPress, index, query }) {
  const translateX = useRef(new Animated.Value(-10)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 140, delay: Math.min(index, 4) * 16, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, delay: Math.min(index, 4) * 16, tension: 120, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  const onPressIn = useCallback(() =>
    Animated.spring(scale, { toValue: 0.96, tension: 150, friction: 8, useNativeDriver: true }).start(), []);
  const onPressOut = useCallback(() =>
    Animated.spring(scale, { toValue: 1, tension: 150, friction: 8, useNativeDriver: true }).start(), []);

  const imgUrl = item.image || "https://placehold.co/40x56/111115/DC143C?text=N";

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }, { scale }] }}>
      <TouchableOpacity
        style={styles.suggestionItem}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => onPress(item)}
        activeOpacity={1}
      >
        <View style={styles.suggestionImageWrapper}>
          <Image source={{ uri: imgUrl }} style={styles.suggestionImage} contentFit="cover" />
          <View style={styles.suggestionImageAccent} />
        </View>
        <View style={styles.suggestionInfo}>
          <HighlightedTitle title={item.title} query={query} />
          {item.year && <Text style={styles.suggestionYear}>{item.year}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={14} color={C.crimson} />
      </TouchableOpacity>
    </Animated.View>
  );
}, (prev, next) => (
  prev.item?.id === next.item?.id &&
  prev.item?.slug === next.item?.slug &&
  prev.item?.title === next.item?.title &&
  prev.query === next.query
));


const Section = React.memo(function Section({
  title, data, cardWidth, cardHeight, onItemPress, variant = "recent", isGrid = false, gridColumns = 2, gridGap = 10
}) {
  const isTrending = variant === "trending";
  const isOngoing = variant === "ongoing";

  if (isGrid) {
    return (
      <View style={[styles.section, isTrending && styles.sectionTrending]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionAccent, isTrending && styles.sectionAccentTrending]} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <View style={{
          flexDirection: "row",
          flexWrap: "wrap",
          paddingHorizontal: 15,
          columnGap: gridGap,
          rowGap: isOngoing ? 0 : gridGap
        }}>
          {data.map((item, index) => (
            isOngoing ? (
              <OngoingCard
                key={`ongoing-${item.slug || index}`}
                item={item}
                onPress={onItemPress}
                index={index}
                width={gridColumns > 2 ? (cardWidth * 2) + gridGap : (cardWidth * 2) + 20}
              />
            ) : (
              <AnimeCard
                key={`${variant}-${item.slug || item.id || index}`}
                item={item}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                onPress={onItemPress}
                index={index}
                inGrid={true}
              />
            )
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.section, isTrending && styles.sectionTrending]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionAccent, isTrending && styles.sectionAccentTrending]} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {isTrending && (
          <View style={styles.trendingBadge}>
            <Ionicons name="flame" size={11} color={C.crimson} />
            <Text style={styles.trendingBadgeText}>HOT</Text>
          </View>
        )}
      </View>
      <FlatList
        data={data}
        horizontal
        keyExtractor={(item, i) => `${item.slug || item.id || i}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 20 }}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={3}
        renderItem={({ item, index }) => (
          <AnimeCard
            item={item}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            onPress={onItemPress}
            index={index}
          />
        )}
      />
    </View>
  );
});

// ─── SHIMMER SKELETON ─────────────────────────────────────────────────────────
const SHIMMER_COLORS = [
  "rgba(255,255,255,0.00)",
  "rgba(255,255,255,0.08)",
  "rgba(255,255,255,0.18)",
  "rgba(255,255,255,0.08)",
  "rgba(255,255,255,0.00)",
];
const SHIMMER_LOCATIONS = [0, 0.2, 0.5, 0.8, 1];

function ShimmerCard({ cardWidth, cardHeight, shimmerX }) {
  const translateX = shimmerX.interpolate({
    inputRange: [0, 1],
    outputRange: [-cardWidth, cardWidth * 2],
  });
  const shimmerOpacity = shimmerX.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.18, 0.55, 0.18],
  });
  const imageH = cardHeight;
  const totalW = cardWidth;
  return (
    <View style={[shimStyles.card, { width: totalW, marginLeft: 16 }]}>
      <View style={[shimStyles.imagePlaceholder, { width: totalW, height: imageH, borderRadius: 16 }]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: shimmerOpacity,
              transform: [{ translateX }, { skewX: "-12deg" }],
            },
          ]}
        >
          <LinearGradient
            colors={SHIMMER_COLORS}
            locations={SHIMMER_LOCATIONS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <View style={[shimStyles.textLine, { width: totalW * 0.85, marginTop: 10 }]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: shimmerOpacity,
              transform: [{ translateX }, { skewX: "-12deg" }],
            },
          ]}
        >
          <LinearGradient colors={SHIMMER_COLORS} locations={SHIMMER_LOCATIONS}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <View style={[shimStyles.textLine, { width: totalW * 0.55, marginTop: 6, height: 10 }]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: shimmerOpacity,
              transform: [{ translateX }, { skewX: "-12deg" }],
            },
          ]}
        >
          <LinearGradient colors={SHIMMER_COLORS} locations={SHIMMER_LOCATIONS}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </View>
  );
}

function SkeletonSection({ title, cardWidth, cardHeight, shimmerX, count = 5 }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionAccent, { opacity: 0.35 }]} />
        <Text style={[styles.sectionTitle, { opacity: 0.35 }]}>{title}</Text>
      </View>
      <View style={{ flexDirection: "row", paddingRight: 20 }}>
        {Array.from({ length: count }).map((_, i) => (
          <ShimmerCard key={i} cardWidth={cardWidth} cardHeight={cardHeight} shimmerX={shimmerX} />
        ))}
      </View>
    </View>
  );
}

const shimStyles = StyleSheet.create({
  card: { overflow: "hidden" },
  imagePlaceholder: { backgroundColor: C.surfaceHigh, overflow: "hidden" },
  textLine: { height: 13, borderRadius: 6, backgroundColor: C.surfaceHigh, overflow: "hidden" },
});

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
// Module-level Set — persists across HomeScreen remounts so a Stripe session_id
// that was already routed to SubscriptionSuccess is never processed a second time.
const _handledSessionIds = new Set();

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, refreshSession } = useAuth();

  // ─── STATE ─────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");

  const avatarLetter = user?.email?.[0]?.toUpperCase() || "?";
  const navAvatar = user?.profile_image ?? null;
  const profileBorder = user?.profile_border ?? null;

  const [anime, setAnime] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [recent, setRecent] = useState([]);
  const [ongoing, setOngoing] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [trending, setTrending] = useState([]);
  const [spotlight, setSpotlight] = useState([]);
  const [genres, setGenres] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]); // 🔍 NEW
  const [suggestSkeletonVisible, setSuggestSkeletonVisible] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [error, setError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [playerLoading, setPlayerLoading] = useState(false);

  const [searchPage, setSearchPage] = useState(1);
  const [searchHasNext, setSearchHasNext] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false); // 📱 Mobile Search State
  const [dailyUsage, setDailyUsage] = useState(null); // { count, limit, subscription }
  const [showLimitModal, setShowLimitModal] = useState(false); // 🚫 NEW

  const scrollY = useRef(new Animated.Value(0)).current;
  const heroScrollX = useRef(new Animated.Value(0)).current; // 📏 Track hero scroll position
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const heroPulse = useRef(new Animated.Value(1)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const searchFocus = useRef(new Animated.Value(0)).current;
  const lastSearchRef = useRef({ query: "", results: [] });
  const suggestionAbortRef = useRef(null);
  const suggestionRequestRef = useRef(0);
  const searchAbortRef = useRef(null);
  const skeletonTimerRef = useRef(null);
  const shimmerX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null); // Add ref for scrolling
  // ─── LOGIN & PAYMENT REDIRECT BRIDGE ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      // 1. Check for pending subscription redirect
      const pending = await AsyncStorage.getItem("pending_redirect");
      if (pending === "subscription") {
        await AsyncStorage.removeItem("pending_redirect");
        navigation.navigate("Subscription");
        return;
      }
    })();

    // 2. Stripe Deep Link Fallback (Expo Go workaround)
    // Manually parse the URL to catch the session_id if React Navigation linking fails dynamically.
    // IMPORTANT: We track handled session IDs in a module-level Set so that when
    // navigation.replace("Home") re-mounts HomeScreen after payment, getInitialURL()
    // still returns the old stripe URL — without this guard it would redirect back to
    // SubscriptionSuccess and reset the "Verifying Payment" screen.
    const handleUrl = (url) => {
      if (!url) return;
      if (url.includes("subscription-success") && url.includes("session_id=")) {
        const match = url.match(/[?&]session_id=([^&]+)/);
        if (match && match[1]) {
          const sessionId = match[1];
          // Only navigate if this session hasn't been handled yet
          if (!_handledSessionIds.has(sessionId)) {
            _handledSessionIds.add(sessionId);
            navigation.navigate("SubscriptionSuccess", { session_id: sessionId });
          }
        }
      }
    };

    ExpoLinking.getInitialURL().then(handleUrl);
    const linkingSub = ExpoLinking.addEventListener("url", (event) => handleUrl(event.url));

    return () => {
      if (linkingSub && linkingSub.remove) {
        linkingSub.remove();
      }
    };
  }, [navigation]);

  const heroHeight = useMemo(() => getHeroHeight(width), [width]);

  const gridColumns = width >= 1200 ? 6 : width >= 992 ? 5 : width >= 768 ? 4 : 2;
  const gridGap = 10;
  const gridCardWidth = (width - 32 - (gridColumns - 1) * gridGap) / gridColumns;
  const gridCardHeight = gridCardWidth * 1.4;

  const activeData = useMemo(
    () => (anime.length > 0 ? anime : recent),
    [anime, recent]
  );

  const navbarHeight = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [88 + insets.top, 68 + insets.top],
    extrapolate: "clamp"
  });

  const toggleDropdown = useCallback((show) => {
    Animated.spring(dropdownAnim, {
      toValue: show ? 1 : 0,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [dropdownAnim]);

  useEffect(() => {
    toggleDropdown(showSuggestions && suggestions.length > 0);
  }, [showSuggestions, suggestions, toggleDropdown]);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1.04, duration: 1800, useNativeDriver: true }),
        Animated.timing(logoPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => {
    if (!sectionsLoading) return;
    shimmerX.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [sectionsLoading]);


  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (user?.email) {
        // 1. Fetch Continue Watching
        API.get(`/api/anime/continue-watching?email=${encodeURIComponent(user.email)}`)
          .then(res => {
            if (active && res.data.success) {
              setContinueWatching(res.data.list.map(c => ({
                ...c,
                id: c.anime_id,
                episode: `Ep ${c.episode_number}`
              })));
            }
          })
          .catch(() => { });

        // 2. Fetch Notifications Badge
        const updateNotifs = () => {
          NotificationApi.getNotifications().then(res => {
            if (active && res.success) setUnreadCount(res.unreadCount);
          });
        };
        updateNotifs();
        const notifIv = setInterval(updateNotifs, 120_000); // 2 min polling
        
        return () => { active = false; clearInterval(notifIv); };
      } else {
        setContinueWatching([]);
        setUnreadCount(0);
      }
      
      // 3. Fetch Search History
      if (user?.email) {
        API.get(`/api/anime/search-history?email=${encodeURIComponent(user.email)}`)
          .then(res => { if (active && res.data.success) setSearchHistory(res.data.list || []); })
          .catch(() => {});

        // 4. Fetch Daily Usage (for remaining episodes pill)
        API.get("/api/auth/usage-status")
          .then(res => {
            if (active && res.data?.success) {
              setDailyUsage({ count: res.data.count, limit: res.data.limit, subscription: res.data.subscription });
            }
          }).catch(() => {});
      } else {
        setSearchHistory([]);
        setDailyUsage(null);
      }
      
      return () => { active = false; };

    }, [user])
  );

  const fetchRecentEpisodes = useCallback(async () => {
    try {
      setError(null);
      const [recentRes, popularRes, spotlightRes, ongoingRes, scheduleRes] = await Promise.all([
        cachedGet("/api/anime/recent?page=1", 60_000).catch(() => null),
        cachedGet("/api/anime/popular?page=1", 3600_000).catch(() => null),
        cachedGet("/api/anime/spotlight", 60_000).catch(() => null),
        cachedGet("/api/anime/ongoing?page=1", 3600_000).catch(() => null),
        cachedGet("/api/anime/schedule", 3600_000).catch(() => null)
      ]);

      if (recentRes?.data?.success && recentRes.data.episodes) setRecent(recentRes.data.episodes);
      if (ongoingRes?.data?.success && ongoingRes.data.series) setOngoing(ongoingRes.data.series);
      if (popularRes?.data?.success && popularRes.data.results) setTrending(popularRes.data.results);
      if (scheduleRes?.data?.success && scheduleRes.data.results) setSchedule(scheduleRes.data.results);
      if (spotlightRes?.data?.success && spotlightRes.data.results) {
        console.log("[HomeScreen] Spotlight data count:", spotlightRes.data.results.length);
        setSpotlight(spotlightRes.data.results);
      } else {
        console.log("[HomeScreen] Spotlight fetch failed or empty:", spotlightRes?.data);
      }

    } catch {
      setError("Failed to load data");
    } finally {
      setSectionsLoading(false);
    }
  }, []);

  const fetchGenres = useCallback(async () => {
    try {
      const res = await cachedGet("/api/anime/genres", 5 * 60_000);
      const raw = res.data.genres || [];
      const seen = new Set();
      const flat = [];
      raw.forEach(g => {
        const name = typeof g === "string" ? g : g.name || "";
        name.split(",").map(s => s.trim()).filter(Boolean).forEach(n => {
          if (!seen.has(n)) { seen.add(n); flat.push(n); }
        });
      });
      setGenres(flat);
    } catch { /* genres are non-critical */ }
  }, []);

  useEffect(() => { fetchRecentEpisodes(); fetchGenres(); }, [fetchRecentEpisodes, fetchGenres]);

  // ── SPOTLIGHT CAROUSEL LOGIC ──
  const heroFlatListRef = useRef(null);
  useEffect(() => {
    if (spotlight.length === 0 || query.length >= 3) return;
    const interval = setInterval(() => {
      const nextIndex = (heroIndex + 1) % spotlight.length;
      setHeroIndex(nextIndex);
      heroFlatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, 6000); // 6s duration
    return () => clearInterval(interval);
  }, [spotlight, heroIndex, query]);

  const handleHeroPress = useCallback((item, isWatch) => {
    // In a real app we'd navigate to the player, but for now Details is more consistent.
    navigation.navigate("Details", { id: item.id, title: item.title });
  }, [navigation]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // 🕵️‍♂️ Clear cache for all main sections to force fresh fetch
    ["/api/anime/recent?page=1", "/api/anime/popular?page=1", "/api/anime/spotlight", "/api/anime/ongoing?page=1", "/api/anime/schedule"].forEach(k => delete _cache[k]);
    
    await Promise.all([
      fetchRecentEpisodes(), 
      fetchGenres(), 
      NotificationApi.getNotifications().then(res => { if (res.success) setUnreadCount(res.unreadCount); })
    ]);
    setRefreshing(false);
  }, [fetchRecentEpisodes, fetchGenres]);


  const localSuggestionPools = useMemo(
    () => [trending, spotlight, recent, ongoing, schedule],
    [trending, spotlight, recent, ongoing, schedule]
  );

  const idleSuggestions = useMemo(
    () => getLocalSuggestions("", [trending, spotlight, recent], SUGGESTION_LIMIT),
    [trending, spotlight, recent]
  );

  const fetchSuggestions = useCallback(async (text) => {
    const trimmed = text.trim();
    const cacheKey = normalizeSearchKey(trimmed);
    const requestId = ++suggestionRequestRef.current;

    if (suggestionAbortRef.current) {
      suggestionAbortRef.current.abort();
    }
    if (skeletonTimerRef.current) {
      clearTimeout(skeletonTimerRef.current);
      skeletonTimerRef.current = null;
    }

    if (!trimmed) {
      setSuggestSkeletonVisible(false);
      if (!searchActive) {
        setShowSuggestions(false);
        return;
      }
      const idle = searchHistory.length ? [] : idleSuggestions;
      setSuggestions(idle);
      setShowSuggestions(Boolean(searchHistory.length || idle.length));
      return;
    }

    const localResults = getLocalSuggestions(trimmed, localSuggestionPools, SUGGESTION_LIMIT);
    setSuggestions(localResults);
    setShowSuggestions(true);

    const cached = getCachedSearch(cacheKey);
    if (cached) {
      setSuggestions(cached);
      setSuggestSkeletonVisible(false);
      return;
    }

    const controller = new AbortController();
    suggestionAbortRef.current = controller;
    setSuggestSkeletonVisible(false);
    skeletonTimerRef.current = setTimeout(() => {
      if (suggestionRequestRef.current === requestId) {
        setSuggestSkeletonVisible(true);
      }
    }, SEARCH_SKELETON_DELAY_MS);

    try {
      const res = await API.get("/api/anime/suggestions", {
        params: { q: trimmed, limit: SUGGESTION_LIMIT },
        signal: controller.signal,
      });
      if (suggestionRequestRef.current !== requestId) return;
      const remoteResults = (res.data.results || []).map(compactAnimeItem);
      const merged = getLocalSuggestions(trimmed, [remoteResults, localResults], SUGGESTION_LIMIT);
      setCachedSearch(cacheKey, merged);
      setSuggestions(merged);
      setShowSuggestions(true);
    } catch (err) {
      if (err?.code !== "ERR_CANCELED" && err?.name !== "CanceledError") {
        setSuggestions(localResults);
      }
    } finally {
      if (suggestionRequestRef.current === requestId) {
        setSuggestSkeletonVisible(false);
      }
      if (skeletonTimerRef.current) {
        clearTimeout(skeletonTimerRef.current);
        skeletonTimerRef.current = null;
      }
    }
  }, [idleSuggestions, localSuggestionPools, searchActive, searchHistory.length]);

  const searchAnime = useCallback((text, activePage = 1) => {
    if (!text || text.length < 2) return;
    if (lastSearchRef.current.query === text && lastSearchRef.current.page === activePage) {
      setAnime(lastSearchRef.current.results);
      setSearchHasNext(lastSearchRef.current.hasNextPage);
      setSearchPage(activePage);
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (searchAbortRef.current) searchAbortRef.current.abort();
    searchAbortRef.current = new AbortController();
    setSearchLoading(true);
    API.get("/api/anime/search", {
      params: {
        q: text,
        page: activePage,
        email: user?.email || "",
      },
      signal: searchAbortRef.current.signal,
    })
      .then(res => {

        const results = res.data.results || [];
        lastSearchRef.current = { query: text, results, page: activePage, hasNextPage: res.data.hasNextPage };
        setAnime(results);
        setSearchHasNext(res.data.hasNextPage);
        setSearchPage(activePage);
        setSuggestions([]);
        setShowSuggestions(false);
        if (activePage === 1 && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true });
        }
      })
      .catch((err) => {
        if (err?.code !== "ERR_CANCELED" && err?.name !== "CanceledError") setError("Search failed");
      })
      .finally(() => setSearchLoading(false));
  }, [user?.email]);

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, fetchSuggestions]);

  useEffect(() => () => {
    suggestionAbortRef.current?.abort();
    searchAbortRef.current?.abort();
    if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current);
  }, []);

  const heroItem = activeData[heroIndex];

  useEffect(() => {
    if (!activeData.length) return;
    const iv = setInterval(() => {
      setHeroIndex(p => (p + 1 >= Math.min(5, activeData.length) ? 0 : p + 1));
    }, 5000);
    return () => clearInterval(iv);
  }, [activeData]);

  const getAnimeId = useCallback((item) => {
    if (item.slug) return item.slug;
    if (item.id) return item.id;
    if (item.url) {
      const parts = item.url.split("/");
      return parts[parts.length - 1];
    }
    if (item.title)
      return item.title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/--+/g, "-").trim();
    return null;
  }, []);

  const handleSuggestionSelect = useCallback((item) => {
    setQuery(item.title);
    setShowSuggestions(false);
    searchAnime(item.title);
  }, [searchAnime]);

  const renderSuggestionItem = useCallback(({ item, index }) => (
    <SuggestionItem
      item={item}
      index={index}
      query={query}
      onPress={(it) => {
        handleSuggestionSelect(it);
        setShowSuggestions(false);
        setMobileSearchOpen(false);
      }}
    />
  ), [handleSuggestionSelect, query]);

  const suggestionKeyExtractor = useCallback(
    (item, index) => `suggestion-${item.slug || item.id || item.title || index}`,
    []
  );

  const navigateToDetails = useCallback((item) => {
    const animeId = getAnimeId(item);
    if (!animeId) { Alert.alert("Error", "Cannot open anime details: Invalid ID"); return; }
    navigation.navigate("Details", { id: animeId, title: item.title || "Unknown" });
  }, [navigation, getAnimeId]);

  const handleContinuePress = useCallback(async (item) => {
    if (!item.episode_url) return navigateToDetails(item);
    try {
      setPlayerLoading(true);
      const res = await API.get(`/api/anime/episode-info?url=${encodeURIComponent(item.episode_url)}`);
      if (res.data.success) {
        navigation.navigate("Player", {
          video: item.episode_url,
          title: `Episode ${item.episode_number}`,
          animeTitle: item.title,
          episodeNumber: item.episode_number,
          episodeData: res.data,
          animeId: item.anime_id,
          animeImage: item.image,
        });
      } else {
        Alert.alert("Error", res.data.error || "Failed to load episode info");
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setShowLimitModal(true);
      } else {
        Alert.alert("Error", "Could not restore playback. Please try again.");
      }
    } finally {
      setPlayerLoading(false);
    }
  }, [navigation, navigateToDetails]);

  const navigateToGenre = useCallback((name) => {
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    navigation.navigate("Genre", { slug, title: name });
  }, [navigation]);



  const clearSearch = useCallback(() => {
    setQuery("");
    setAnime([]);
    setSearchPage(1);
    setSearchHasNext(false);
    setSuggestions([]);
    setShowSuggestions(false);
    lastSearchRef.current = { query: "", results: [], page: 1, hasNextPage: false };
    
    // Refresh history
    if (user?.email) {
      API.get(`/api/anime/search-history?email=${encodeURIComponent(user.email)}`)
        .then(res => { if (res.data.success) setSearchHistory(res.data.list || []); });
    }
  }, [user?.email]);

  // ── FULL HOME RESET (Logo / Home Tab press) ──
  const resetToHome = useCallback(() => {
    setQuery("");
    setAnime([]);
    setSearchPage(1);
    setSearchHasNext(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setMobileSearchOpen(false);
    lastSearchRef.current = { query: "", results: [], page: 1, hasNextPage: false };
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  }, []);

  // Listen for Home tab press to fully reset search state
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (e) => {
      resetToHome();
    });
    return unsubscribe;
  }, [navigation, resetToHome]);

  const clearHistory = useCallback(async () => {
    if (!user?.email) return;
    try {
      await API.delete("/api/anime/search-history", { data: { email: user.email } });
      setSearchHistory([]);
    } catch {}
  }, [user?.email]);


  const dropdownTranslateY = dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] });
  const dropdownOpacity = dropdownAnim;
  const dropdownScale = dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── NAVBAR ── */}
      <Animated.View style={[styles.navbar, { height: navbarHeight }]}>
        <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.navbarLine} />
        <View style={[styles.navContent, { paddingTop: insets.top }]}>
          <Animated.View style={{ transform: [{ scale: logoPulse }] }}>
            <TouchableOpacity onPress={resetToHome} activeOpacity={0.7}>
              <View style={styles.logoRow}>
                <Text style={styles.logo}>
                  Anime<Text style={{ color: C.crimson }}>xis</Text>
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {width >= 768 ? (
            <>
              <View style={styles.searchContainer}>
                <Animated.View style={[
                  styles.searchWrapper,
                  {
                    width: width >= 768 ? 280 : 210,
                  }
                ]}>
                  {suggestSkeletonVisible
                    ? <DotCircleLoader size={18} color={C.crimson} />
                    : <Ionicons name="search" size={16} color={C.dim} style={styles.searchIcon} />
                  }
                  <TextInput
                    value={query}
                    onChangeText={(text) => {
                      setQuery(text);
                      setShowSuggestions(true);
                      if (!text) {
                        setAnime([]);
                        setSearchPage(1);
                        setSearchHasNext(false);
                      }
                    }}
                    placeholder="Search anime…"
                    placeholderTextColor={C.dimmer}
                    style={[styles.searchInput, { paddingVertical: 0 }]}
                    returnKeyType="search"
                    onFocus={() => {
                      setSearchActive(true);
                      setShowSuggestions(true);
                      if (!query.trim() && idleSuggestions.length > 0 && searchHistory.length === 0) {
                        setSuggestions(idleSuggestions);
                      }
                    }}
                    onBlur={() => {
                      setSearchActive(false);
                      setTimeout(() => setShowSuggestions(false), 150);
                    }}
                    onSubmitEditing={() => { searchAnime(query.trim()); setShowSuggestions(false); }}
                  />
                  {query.length > 0 && (
                    <TouchableOpacity
                      onPress={clearSearch}
                      style={styles.clearButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={16} color={C.dim} />
                    </TouchableOpacity>
                  )}
                </Animated.View>

                {/* ── INLINE SUGGESTIONS DROPDOWN ── */}
                {showSuggestions && suggestions.length > 0 && (
                  <Animated.View style={[
                    styles.suggestionsDropdown,
                    { width: width >= 768 ? 280 : 210 },
                    {
                      opacity: dropdownOpacity,
                      transform: [{ translateY: dropdownTranslateY }, { scale: dropdownScale }],
                    }
                  ]}>
                    <View style={styles.dropdownAccentLine} />
                    <View style={styles.dropdownHeader}>
                      <Text style={styles.dropdownHeaderText}>Results ({suggestions.length})</Text>
                      <TouchableOpacity onPress={() => setShowSuggestions(false)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="close" size={14} color={C.dim} />
                      </TouchableOpacity>
                    </View>
                    <FlatList
                      data={suggestions}
                      renderItem={renderSuggestionItem}
                      keyExtractor={suggestionKeyExtractor}
                      style={{ maxHeight: 320 }}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                      initialNumToRender={8}
                      maxToRenderPerBatch={8}
                      windowSize={4}
                      removeClippedSubviews={Platform.OS !== "web"}
                      getItemLayout={(_, index) => ({ length: 75, offset: 75 * index, index })}
                    />
                  </Animated.View>
                )}

                {/* ── SEARCH HISTORY DROPDOWN (Shown when focused and query is empty) ── */}
                {showSuggestions && query.length === 0 && searchHistory.length > 0 && (
                  <Animated.View style={[
                    styles.suggestionsDropdown,
                    { width: width >= 768 ? 280 : 210 },
                    {
                      opacity: dropdownOpacity,
                      transform: [{ translateY: dropdownTranslateY }, { scale: dropdownScale }],
                    }
                  ]}>
                    <View style={styles.dropdownAccentLine} />
                    <View style={styles.dropdownHeader}>
                      <Text style={styles.dropdownHeaderText}>Recent Searches</Text>
                      <TouchableOpacity onPress={clearHistory} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Text style={{ color: C.crimson, fontSize: 11, fontWeight: "600" }}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ paddingBottom: 10 }}>
                      {searchHistory.map((item, index) => (
                        <TouchableOpacity 
                          key={`hist-${index}`} 
                          style={styles.historyItem} 
                          onPress={() => {
                            setQuery(item.query);
                            searchAnime(item.query);
                            setShowSuggestions(false);
                          }}
                        >
                          <Ionicons name="time-outline" size={14} color={C.dim} style={{ marginRight: 10 }} />
                          <Text style={styles.historyText} numberOfLines={1}>{item.query}</Text>
                          <Ionicons name="arrow-forward" size={12} color={C.surfaceHigh} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Animated.View>
                )}
              </View>

              <View style={styles.navRight}>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Notifications")}
                  style={styles.navIconBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="notifications-outline" size={22} color={C.white} />
                  {unreadCount > 0 && (
                    <View style={styles.notifBadge}>
                      <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate("ProfileTab")}
                  style={styles.avatarBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <PremiumBorder borderStyle={profileBorder} size={32} borderWidth={2}>
                    <View style={styles.avatarCircle}>
                      {navAvatar ? (
                        <Image source={{ uri: navAvatar }} style={styles.avatarImageInside} contentFit="cover" />
                      ) : (
                        <LinearGradient colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.05)"]} style={styles.avatarCircle}>
                          <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                        </LinearGradient>
                      )}
                    </View>
                  </PremiumBorder>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.navRight}>
              <TouchableOpacity
                onPress={() => setMobileSearchOpen(!mobileSearchOpen)}
                style={styles.navIconBtn}
                activeOpacity={0.7}
              >
                <Ionicons name={mobileSearchOpen ? "close" : "search"} size={26} color={C.white} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate("Notifications")}
                style={[styles.navIconBtn, { marginLeft: 10 }]}
                activeOpacity={0.7}
              >
                <Ionicons name="notifications-outline" size={24} color={C.white} />
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── MOBILE SEARCH DROPDOWN (MOVED OUTSIDE NAVBAR FOR TOUCH FIX) ── */}
      {width < 768 && mobileSearchOpen && (
        <View style={[styles.mobileMenuDropdown, { top: 86 + insets.top, zIndex: 1100, elevation: 10, position: 'absolute' }]}>
          <View style={styles.searchContainer}>
            <Animated.View style={[
              styles.searchWrapper,
              { width: "100%" }
            ]}>
              {suggestSkeletonVisible
                ? <DotCircleLoader size={18} color={C.crimson} />
                : <Ionicons name="search" size={16} color={C.dim} style={styles.searchIcon} />
              }
              <TextInput
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  setShowSuggestions(true);
                  if (!text) {
                    setAnime([]);
                    setSearchPage(1);
                    setSearchHasNext(false);
                  }
                }}
                placeholder="Search anime…"
                placeholderTextColor={C.dimmer}
                style={[styles.searchInput, { paddingVertical: 0 }]}
                returnKeyType="search"
                autoFocus={true}
                onFocus={() => {
                  setSearchActive(true);
                  setShowSuggestions(true);
                  if (!query.trim() && idleSuggestions.length > 0 && searchHistory.length === 0) {
                    setSuggestions(idleSuggestions);
                  }
                }}
                onBlur={() => {
                  setSearchActive(false);
                  setTimeout(() => setShowSuggestions(false), 150);
                }}
                onSubmitEditing={() => { searchAnime(query.trim()); setShowSuggestions(false); setMobileSearchOpen(false); }}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={C.dim} />
                </TouchableOpacity>
              )}
            </Animated.View>

            {showSuggestions && suggestions.length > 0 && (
              <View style={[styles.suggestionsDropdown, { width: "100%", position: 'relative', top: 8, zIndex: 1200 }]}>
                <View style={styles.dropdownAccentLine} />
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownHeaderText}>Results ({suggestions.length})</Text>
                </View>
                <FlatList
                  data={suggestions}
                  renderItem={renderSuggestionItem}
                  keyExtractor={suggestionKeyExtractor}
                  style={{ maxHeight: Math.min(360, Math.max(220, width * 0.72)) }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                  initialNumToRender={8}
                  maxToRenderPerBatch={8}
                  windowSize={4}
                  removeClippedSubviews={Platform.OS !== "web"}
                  getItemLayout={(_, index) => ({ length: 75, offset: 75 * index, index })}
                />
              </View>
            )}

            {showSuggestions && query.length === 0 && searchHistory.length > 0 && (
              <View style={[styles.suggestionsDropdown, { width: "100%", position: 'relative', top: 8, zIndex: 1200 }]}>
                <View style={styles.dropdownAccentLine} />
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownHeaderText}>Recent Searches</Text>
                  <TouchableOpacity onPress={clearHistory} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={{ color: C.crimson, fontSize: 11, fontWeight: "600" }}>Clear</Text>
                  </TouchableOpacity>
                </View>
                {searchHistory.slice(0, SUGGESTION_LIMIT).map((item, index) => (
                  <TouchableOpacity
                    key={`mhist-${index}`}
                    style={styles.historyItem}
                    onPress={() => {
                      setQuery(item.query);
                      searchAnime(item.query);
                      setShowSuggestions(false);
                      setMobileSearchOpen(false);
                    }}
                  >
                    <Ionicons name="time-outline" size={14} color={C.dim} style={{ marginRight: 10 }} />
                    <Text style={styles.historyText} numberOfLines={1}>{item.query}</Text>
                    <Ionicons name="arrow-forward" size={12} color={C.surfaceHigh} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── SCROLL CONTENT ── */}
      <Animated.ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 100 + insets.top,
          paddingBottom: (width < 768 ? 110 : 24) + insets.bottom,
          flexGrow: 1
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.crimson} />}
      >
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={20} color={C.crimson} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchRecentEpisodes} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── HERO SPOTLIGHT CAROUSEL ── */}
        {spotlight.length > 0 && anime.length === 0 && (
          <View style={[styles.heroContainer, { height: heroHeight, width: width - 32, alignSelf: 'center' }]}>
            <FlatList
              ref={heroFlatListRef}
              data={spotlight}
              horizontal
              pagingEnabled={true} // MAGNETIC: Always snaps to exactly one page 🎡
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: heroScrollX } } }],
                { useNativeDriver: false }
              )}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
                setHeroIndex(index);
              }}
              keyExtractor={(item, i) => `hero-${i}`}
              getItemLayout={(data, index) => ({
                length: width - 32,
                offset: (width - 32) * index,
                index,
              })}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={10}
              removeClippedSubviews={false}
              renderItem={({ item }) => (
                <View style={{ width: width - 32, height: heroHeight, justifyContent: "center", alignItems: "center" }}>
                  <View style={{ width: "100%", height: heroHeight, borderRadius: 6, overflow: "hidden", position: "relative" }}>
                    {/* Background Layer (Visual) */}
                    <Image
                      source={{ uri: item.background || item.image }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      priority="high"
                      transition={400}
                    />
                    <BlurView intensity={Platform.OS === 'web' ? 40 : 25} tint="dark" style={StyleSheet.absoluteFill} />
                    <LinearGradient
                      colors={["rgba(8,8,9,0.25)", "rgba(8,8,9,0.92)"]}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Content Layer (Foreground) */}
                    <View style={[styles.heroSplitContent, {
                      flexDirection: width >= 768 ? "row" : "column-reverse",
                      alignItems: "center",
                      justifyContent: width >= 768 ? "center" : "flex-end",
                      paddingTop: width >= 768 ? 20 : 40,
                    }]}>
                      {/* Left side: Info (Bottom on mobile) */}
                      <View style={[styles.heroLeftCol, {
                        marginRight: width >= 768 ? 16 : 0,
                        alignItems: width >= 768 ? "flex-start" : "center",
                        marginTop: width >= 768 ? 0 : 20,
                      }]}>
                        <View style={styles.spotlightBadge}>
                          <Text style={styles.spotlightBadgeText}>{item.rank || "#1 SPOTLIGHT"}</Text>
                        </View>
                        <Text
                          style={[styles.heroSpotlightTitle, {
                            fontSize: width >= 768 ? 32 : 24,
                            textAlign: width >= 768 ? "left" : "center"
                          }]}
                          numberOfLines={2}
                        >
                          {item.title}
                        </Text>

                        {/* HERO GENRES */}
                        {item.genres && item.genres.length > 0 && (
                          <View style={[styles.heroGenreRow, { justifyContent: width >= 768 ? "flex-start" : "center" }]}>
                            {item.genres.slice(0, width >= 768 ? 10 : 3).map((g, i) => (
                              <View key={i} style={[styles.heroGenrePill, { borderColor: C.crimson + "60", backgroundColor: "rgba(220,20,60,0.12)" }]}>
                                <Text style={[styles.heroGenreText, { color: C.white }]}>{g}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Hide description on mobile to keep the layout cinematic and clean */}
                        {width >= 768 && (
                          <Text style={styles.heroSpotlightDescription} numberOfLines={3}>
                            {item.description || "No description available for this featured spotlight."}
                          </Text>
                        )}

                        <View style={[styles.heroSpotlightActions, { marginTop: width >= 768 ? 0 : 8 }]}>
                          <TouchableOpacity
                            style={styles.heroBtnSolid}
                            onPress={() => handleHeroPress(item, true)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="play" size={18} color="#000" />
                            <Text style={styles.heroBtnSolidText}>Watch Now</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.heroBtnOutline}
                            onPress={() => handleHeroPress(item, false)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="information-circle-outline" size={18} color={C.white} />
                            <Text style={styles.heroBtnOutlineText}>Details</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Right side: Floating Poster (Top on mobile) */}
                      <View style={[styles.heroRightCol, {
                        width: width >= 768 ? "26%" : 140,
                        height: width >= 768 ? "70%" : 190,
                        alignSelf: width >= 768 ? "auto" : "center",
                      }]}>
                        <Image
                          source={{ uri: item.poster || item.image }}
                          style={styles.heroPoster}
                          contentFit="cover"
                          transition={500}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}
            />

            {/* Top-Right Pagination Bullets */}
            <View style={styles.heroPaginationBox}>
              {spotlight.slice(0, 6).map((_, i) => {
                const input = [(i - 1) * width, i * width, (i + 1) * width];
                const bulletWidth = heroScrollX.interpolate({
                  inputRange: input,
                  outputRange: [6, 18, 6],
                  extrapolate: "clamp",
                });
                const bulletOpacity = heroScrollX.interpolate({
                  inputRange: input,
                  outputRange: [0.35, 1, 0.35],
                  extrapolate: "clamp",
                });

                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setHeroIndex(i);
                      heroFlatListRef.current?.scrollToIndex({ index: i, animated: true });
                    }}
                    style={styles.heroBulletWrapper}
                  >
                    <Animated.View style={[
                      styles.heroBulletBase,
                      { width: bulletWidth, opacity: bulletOpacity }
                    ]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── SECTIONS / SKELETON ── */}
        {sectionsLoading ? (
          <>
            <SkeletonSection title="Recent Episodes" cardWidth={gridCardWidth} cardHeight={gridCardHeight} shimmerX={shimmerX} count={5} />
            <SkeletonSection title="Ongoing Series" cardWidth={gridCardWidth} cardHeight={gridCardHeight} shimmerX={shimmerX} count={5} />
            <SkeletonSection title="Trending" cardWidth={gridCardWidth} cardHeight={gridCardHeight} shimmerX={shimmerX} count={5} />
          </>
        ) : anime.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionAccent]} />
              <Text style={styles.sectionTitle}>Search Results</Text>
              <View style={styles.searchBadge}>
                <Ionicons name="search" size={11} color={C.dim} />
                <Text style={styles.searchBadgeText}>{anime.length} results</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, columnGap: gridGap, rowGap: 4 }}>
              {anime.map((item, index) => (
                <AnimeCard
                  key={`search-${item.slug || item.id || index}`}
                  item={item}
                  cardWidth={gridCardWidth}
                  cardHeight={gridCardHeight}
                  onPress={navigateToDetails}
                  showEpisodeBadge={false}
                  index={index}
                  inGrid={true}
                />
              ))}
            </View>

            {/* ── PAGINATION CONTROLS ── */}
            <View style={styles.paginationRow}>
              {searchPage > 1 && (
                <TouchableOpacity
                  style={styles.pageBtn}
                  onPress={() => searchAnime(query, searchPage - 1)}
                  disabled={searchLoading}
                >
                  <Ionicons name="chevron-back" size={16} color={C.dim} />
                  <Text style={styles.pageBtnText}>Prev</Text>
                </TouchableOpacity>
              )}

              <View style={styles.pageNumbers}>
                {searchPage > 1 && (
                  <TouchableOpacity onPress={() => searchAnime(query, searchPage - 1)} style={styles.pageNumberBtn}>
                    <Text style={styles.pageNumberText}>{searchPage - 1}</Text>
                  </TouchableOpacity>
                )}

                <View style={[styles.pageNumberBtn, styles.pageNumberBtnActive]}>
                  {searchLoading ? (
                    <DotCircleLoader size={18} color={C.white} />
                  ) : (
                    <Text style={[styles.pageNumberText, styles.pageNumberTextActive]}>{searchPage}</Text>
                  )}
                </View>

                {searchHasNext && (
                  <TouchableOpacity onPress={() => searchAnime(query, searchPage + 1)} style={styles.pageNumberBtn}>
                    <Text style={styles.pageNumberText}>{searchPage + 1}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {searchHasNext && (
                <TouchableOpacity
                  style={styles.pageBtn}
                  onPress={() => searchAnime(query, searchPage + 1)}
                  disabled={searchLoading}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.dim} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : recent.length > 0 || trending.length > 0 || continueWatching.length > 0 ? (
          <>
            {continueWatching.length > 0 && anime.length === 0 && (
              <Section
                title="Continue Watching"
                data={continueWatching}
                cardWidth={gridCardWidth}
                cardHeight={gridCardHeight}
                onItemPress={handleContinuePress}
                variant="recent"
              />
            )}
            {recent.length > 0 && (
              <Section
                title="Recent Episodes"
                data={recent.slice(0, 15)}
                cardWidth={gridCardWidth}
                cardHeight={gridCardHeight}
                onItemPress={navigateToDetails}
                variant="recent"
                isGrid={true}
                gridColumns={gridColumns}
                gridGap={gridGap}
              />
            )}
            {/* Split Layout: Ongoing (Left) vs. Today's Schedule (Right) */}
            {(ongoing.length > 0 || schedule.length > 0) && (
              <View style={[
                styles.splitLayoutContainer,
                { flexDirection: width >= 992 ? "row" : "column", paddingHorizontal: 16, gap: 24, marginBottom: 20 }
              ]}>
                
                {/* Left Column: Ongoing Series */}
                {ongoing.length > 0 && (
                  <View style={{ flex: width >= 992 ? 1 : undefined }}>
                    <View style={styles.sectionHeaderSplit}>
                      <View style={styles.sectionAccent} />
                      <Text style={styles.sectionTitleSplit}>Ongoing Series</Text>
                    </View>
                    <View style={styles.splitListContainer}>
                      {ongoing.slice(0, 6).map((item, index) => (
                        <OngoingCard
                          key={`ongoing-${item.slug || index}`}
                          item={item}
                          onPress={navigateToDetails}
                          index={index}
                          width="100%"
                        />
                      ))}
                    </View>
                  </View>
                )}

                {/* Right Column: Release Schedule */}
                {schedule.length > 0 && (
                  <View style={{ flex: width >= 992 ? 1 : undefined }}>
                    <View style={styles.sectionHeaderSplit}>
                      <View style={[styles.sectionAccent, { backgroundColor: "#F59E0B" }]} />
                      <Text style={styles.sectionTitleSplit}>Today's Schedule</Text>
                    </View>
                    <View style={styles.splitListContainer}>
                      {schedule.slice(0, 6).map((item, index) => (
                        <ScheduleHomeCard
                          key={`sched-${item.id || index}`}
                          item={item}
                          onPress={(it) => navigation.navigate("Details", { id: it.slug || it.id, title: it.title })}
                          index={index}
                          width="100%"
                        />
                      ))}
                    </View>
                  </View>
                )}

              </View>
            )}
            {trending.length > 0 && (
              <Section
                title="Trending Now"
                data={trending.slice(0, 15)}
                cardWidth={gridCardWidth}
                cardHeight={gridCardHeight}
                onItemPress={navigateToDetails}
                variant="trending"
                isGrid={true}
                gridColumns={gridColumns}
                gridGap={gridGap}
              />
            )}
          </>
        ) : null}

        {/* ── GENRES ── */}
        {genres.length > 0 && (
          <View style={styles.genresSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Explore Genres</Text>
            </View>
            <View style={styles.genreWrapper}>
              {genres.map((name, index) => {
                const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#a855f7", "#14b8a6"];
                const textColor = colors[index % colors.length];

                return (
                  <TouchableOpacity
                    key={`genre-${index}-${name}`}
                    style={styles.genreCard}
                    onPress={() => navigateToGenre(name)}
                    activeOpacity={0.78}
                  >
                    <LinearGradient
                      colors={["rgba(255,255,255,0.06)", C.surface]}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={[styles.genreCardText, { color: textColor }]} numberOfLines={1}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {activeData.length === 0 && anime.length === 0 && query.length >= 3 && !showSuggestions && (
          <View style={styles.noResults}>
            <View style={styles.noResultsIcon}>
              <Ionicons name="search-outline" size={36} color={C.crimson} />
            </View>
            <Text style={styles.noResultsText}>No results for "{query}"</Text>
            <Text style={styles.noResultsSub}>Try a different spelling</Text>
          </View>
        )}

        <AppFooter />
      </Animated.ScrollView>

      {playerLoading && (
        <View style={styles.loadingOverlay}>
          <DotCircleLoader size={54} color={C.crimson} />
          <Text style={styles.loadingText}>Restoring your place…</Text>
        </View>
      )}

      {/* ── DAILY LIMIT WARNING MODAL ── */}
      <Modal
        visible={showLimitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLimitModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLimitModal(false)}
        >
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.limitModal}>
            {/* Glow accent */}
            <LinearGradient
              colors={[C.crimson, C.crimsonBright]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.limitModalAccent}
            />

            <View style={styles.limitIconWrap}>
              <Ionicons name="warning" size={36} color={C.crimson} />
            </View>

            <Text style={styles.limitTitle}>Daily Limit Reached</Text>
            <Text style={styles.limitSubtitle}>
              You've watched{" "}
              <Text style={{ color: C.crimson, fontWeight: "800" }}>20 / 20</Text>
              {" "}episodes today.
            </Text>
            <Text style={styles.limitBody}>
              Free accounts are limited to 20 unique episodes per day. Upgrade to{" "}
              <Text style={{ color: C.crimsonBright, fontWeight: "700" }}>Premium</Text>
              {" "}for unlimited, ad-free streaming!
            </Text>

            <TouchableOpacity
              style={styles.limitUpgradeBtn}
              onPress={() => {
                setShowLimitModal(false);
                navigation.navigate("Subscription");
              }}
            >
              <LinearGradient
                colors={[C.crimson, "#a00020"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.limitUpgradeGradient}
              >
                <Ionicons name="diamond" size={16} color="white" />
                <Text style={styles.limitUpgradeText}>Upgrade to Premium</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.limitDismissBtn}
              onPress={() => setShowLimitModal(false)}
            >
              <Text style={styles.limitDismissText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  navbar: {
    position: "absolute",
    top: 0,
    width: "100%",
    zIndex: 1000,
    overflow: "visible",
    borderBottomWidth: 0,
  },
  navbarLine: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: C.glass,
    opacity: 1,
  },
  navContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "ios" ? 10 : 6,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: "rgba(220,20,60,0.12)",
    borderWidth: 1, borderColor: "rgba(220,20,60,0.3)",
    justifyContent: "center", alignItems: "center",
    boxShadow: '0 0 4px rgba(220,20,60,0.2)'
  },
  logo: { color: C.white, fontSize: 22, fontWeight: "900", letterSpacing: -1 },

  searchContainer: { position: "relative", zIndex: 1100 },
  searchWrapper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surface,
    borderWidth: 1, borderRadius: 40,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 9 : 6,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: C.white,
    fontSize: 14,
    marginLeft: 8,
    height: "100%",
    outlineStyle: 'none',
  },
  clearButton: { marginLeft: 6 },

  suggestionsDropdown: {
    position: "absolute",
    top: 52, right: 0,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 18, overflow: "hidden",
    zIndex: 1200,
    boxShadow: '0 16px 24px rgba(0,0,0,0.6)'
  },
  dropdownAccentLine: { height: 2, backgroundColor: C.crimson, opacity: 0.9 },
  dropdownHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dropdownHeaderText: { color: C.dim, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  historyText: { flex: 1, color: C.white, fontSize: 13, fontWeight: "500" },
  suggestionItem: {
    flexDirection: "row", alignItems: "center",
    minHeight: 75,
    paddingVertical: 10, paddingHorizontal: 14,
    gap: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  suggestionImageWrapper: { position: "relative", borderRadius: 8, overflow: "hidden" },
  suggestionImage: { width: 38, height: 54, borderRadius: 8, backgroundColor: C.surfaceHigh },
  suggestionImageAccent: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: 3, backgroundColor: C.crimson, opacity: 0.9,
  },
  suggestionInfo: { flex: 1 },
  suggestionTitle: { color: C.white, fontSize: 13, fontWeight: "600", marginBottom: 2 },
  suggestionTitleHighlight: { color: C.crimson, fontWeight: "900" },
  suggestionYear: { color: C.dim, fontSize: 11 },

  heroContainer: {
    marginHorizontal: 16, marginBottom: 28,
    borderRadius: 16, overflow: "hidden",
    backgroundColor: C.surface,
  },
  heroSplitContent: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 24, paddingVertical: 20,
    alignItems: "center",
  },
  heroLeftCol: { flex: 1, marginRight: 16, justifyContent: "center" },
  heroRightCol: { width: "26%", height: "70%", borderRadius: 6, overflow: "hidden", elevation: 12 },
  heroPoster: { width: "100%", height: "100%", borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },

  spotlightBadge: {
    backgroundColor: C.crimson,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, marginBottom: 12, alignSelf: "flex-start",
  },
  spotlightBadgeText: { color: C.white, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  heroSpotlightTitle: { color: C.white, fontWeight: "900", marginBottom: 6, textShadow: "0px 0px 8px rgba(0,0,0,0.5)" },

  heroGenreRow: { flexDirection: "row", gap: 6, marginBottom: 14, flexWrap: "wrap" },
  heroGenrePill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: C.crimson + "60",
    backgroundColor: "rgba(220,20,60,0.12)",
  },
  heroGenreText: { fontSize: 10, fontWeight: "700", color: C.white },

  heroSpotlightDescription: { color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 18, marginBottom: 20 },

  heroSpotlightActions: { flexDirection: "row", gap: 10 },
  heroBtnSolid: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.crimson, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
  },
  heroBtnSolidText: { color: "#FFF", fontWeight: "800", fontSize: 13 },
  heroBtnOutline: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
  },
  heroBtnOutlineText: { color: C.white, fontWeight: "700", fontSize: 13 },

  heroPaginationBox: { position: "absolute", top: 16, right: 24, flexDirection: "row", gap: 8, alignItems: "center" },
  heroBulletWrapper: { paddingHorizontal: 2, height: 12, justifyContent: "center" },
  heroBulletBase: { height: 6, borderRadius: 3, backgroundColor: "#FFF" },

  section: { marginTop: 28 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    marginLeft: 18, marginBottom: 16, gap: 10,
  },
  sectionAccent: { width: 4, height: 20, backgroundColor: C.crimson, borderRadius: 2 },
  sectionTitle: { color: C.white, fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },

  // ── Enhanced card styles ──
  cardGlowBorder: {
    position: "absolute",
    top: -2, left: -2,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    boxShadow: '0 0 10px rgba(0,0,0,0.5)'
  },
  cardImageContainer: {
    borderRadius: 12, overflow: "hidden",
    backgroundColor: C.surfaceHigh,
    boxShadow: '0 8px 14px rgba(0,0,0,0.35)'
  },
  cardImage: { width: "100%", height: "100%" },
  cardHoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  cardPlayButton: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    justifyContent: "center", alignItems: "center",
    paddingLeft: 3,
    boxShadow: '0 0 10px rgba(0,0,0,0.5)'
  },
  cardEpisodeBadge: {
    position: "absolute", bottom: 0, left: 0,
    backgroundColor: C.crimson, // Was Anitaku Orange
    paddingHorizontal: 8, paddingVertical: 4,
    borderTopRightRadius: 10,
    zIndex: 10,
  },
  cardEpisodeText: { color: C.white, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  cardTypeBadge: {
    position: "absolute", bottom: 0, right: 0,
    backgroundColor: C.white, // Was Anitaku Yellow/Orange
    paddingHorizontal: 8, paddingVertical: 4,
    borderTopLeftRadius: 10,
    zIndex: 10,
  },
  cardTypeText: { color: "#000", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  cardCategoryBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    zIndex: 10,
  },
  cardCategoryText: { color: C.white, fontSize: 9, fontWeight: "800", textTransform: "uppercase" },

  cardContent: { paddingVertical: 10, paddingHorizontal: 4 },
  cardTitle: { color: C.white, fontSize: 12, fontWeight: "700", lineHeight: 18, textAlign: "center" },

  errorContainer: {
    flexDirection: "row", alignItems: "center",
    margin: 16, padding: 16,
    backgroundColor: "rgba(220,20,60,0.08)",
    borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(220,20,60,0.2)", gap: 10,
  },
  errorText: { color: C.crimson, fontSize: 14, flex: 1 },
  retryButton: {
    backgroundColor: C.crimson,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
  },
  retryText: { color: C.white, fontWeight: "700", fontSize: 13 },

  noResults: { padding: 60, alignItems: "center", gap: 8 },
  noResultsIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.04)",
    justifyContent: "center", alignItems: "center", marginBottom: 8,
  },
  noResultsText: { color: C.white, fontSize: 16, fontWeight: "600" },
  noResultsSub: { color: C.dim, fontSize: 13 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,8,9,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5000,
  },
  loadingText: { color: C.dim, fontSize: 13, marginTop: 12 },

  avatarBtn: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarCircle: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
    overflow: 'hidden'
  },
  avatarImageInside: { width: '100%', height: '100%' },
  avatarLetter: { color: C.white, fontSize: 15, fontWeight: "800" },

  // ── Ongoing Card Styles ──
  ongoingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 10,
    overflow: "hidden",
  },
  ongoingImage: {
    width: 60,
    height: 84,
    borderRadius: 4,
    backgroundColor: C.surfaceHigh,
  },
  ongoingInfo: {
    flex: 1,
    paddingLeft: 14,
    justifyContent: "center",
  },
  ongoingTitle: {
    color: C.white,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  ongoingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.crimson,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  ongoingBadgeText: {
    color: C.white,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  genresSection: { marginTop: 32, marginBottom: 16 },
  genreWrapper: {
    paddingHorizontal: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
    columnGap: 8,
  },
  genreCard: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  genreCardText: { color: C.white, fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },

  sectionTrending: {
    marginTop: 28, backgroundColor: C.surfaceHigh,
    paddingVertical: 20,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border,
  },
  sectionAccentTrending: { backgroundColor: C.crimson },
  trendingBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: C.glass,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  trendingBadgeText: { color: C.dim, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  // 🏆 Success Modal Styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modalCard: {
    width: "85%",
    maxWidth: 400,
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.glass,
  },
  modalIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.04)",
    justifyContent: "center", alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { color: C.white, fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 12 },
  modalText: { color: C.dim, fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  modalBtn: {
    backgroundColor: C.crimson,
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 14, width: "100%",
    alignItems: "center",
  },
  modalBtnText: { color: C.white, fontWeight: "800", fontSize: 15 },
  searchBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  searchBadgeText: { color: C.dim, fontSize: 10, fontWeight: "600" },

  // ── Navbar & Navigation ──
  navContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 10,
  },

  // 📱 Mobile Menu Styles
  mobileMenuDropdown: {
    position: 'absolute',
    top: 86, // Sits perfectly below the navbar content
    left: 16,
    right: 16,
    backgroundColor: C.surfaceHigh,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    zIndex: 1500,
    boxShadow: '0 10px 16px rgba(0,0,0,0.5)'
  },
  mobileNavRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  mobileNavBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    marginHorizontal: 6,
  },
  mobileNavText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "700",
  },
  mobileNotifBadge: {
    position: "absolute",
    top: -2,
    right: 8,
    backgroundColor: C.crimson,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  usagePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  usagePillFull: {
    borderColor: "rgba(220,20,60,0.3)",
    backgroundColor: "rgba(220,20,60,0.08)",
  },
  usagePillText: {
    color: C.dim,
    fontSize: 10,
    fontWeight: "800",
  },
  usagePillTextFull: {
    color: C.crimson,
  },
  navRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  navIconBtn: { position: "relative", width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  notifBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: C.crimson,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: C.bg
  },
  notifBadgeText: { color: C.white, fontSize: 8, fontWeight: "800" },

  // Limit Modal Styles
  limitModal: {
    width: "85%",
    maxWidth: 380,
    backgroundColor: C.surface,
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  limitModalAccent: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 4,
  },
  limitIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(220,20,60,0.06)",
    justifyContent: "center", alignItems: "center",
    marginBottom: 20,
  },
  limitTitle: { color: C.white, fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 8 },
  limitSubtitle: { color: C.dim, fontSize: 14, fontWeight: "600", marginBottom: 16 },
  limitBody: { color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 20, textAlign: "center", marginBottom: 30 },
  limitUpgradeBtn: { width: "100%", height: 52, borderRadius: 16, overflow: "hidden" },
  limitUpgradeGradient: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  limitUpgradeText: { color: C.white, fontSize: 15, fontWeight: "700" },
  limitDismissBtn: { marginTop: 16, paddingVertical: 8 },
  limitDismissText: { color: C.dimmer, fontSize: 13, fontWeight: "600" },

  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },

  heroMetaRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6,
  },
  heroScorePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1, borderColor: "rgba(255,215,0,0.35)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  heroScoreText: { color: C.crimsonBright, fontSize: 11, fontWeight: "700" },
  heroMetaPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  heroMetaPillText: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "600" },
  heroGenreRow: {
    flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap",
  },
  heroGenrePill: {
    backgroundColor: "rgba(220,20,60,0.12)", borderWidth: 1, borderColor: C.crimson + "60",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  heroGenreText: { color: C.white, fontSize: 11, fontWeight: "700" },

  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 8,
    gap: 16,
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: C.glass,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, gap: 4,
  },
  pageBtnText: { color: C.white, fontSize: 13, fontWeight: "700" },
  pageNumbers: { flexDirection: "row", gap: 8 },
  pageNumberBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border,
    justifyContent: "center", alignItems: "center",
  },
  pageNumberBtnActive: { backgroundColor: C.crimson, borderColor: C.crimson },
  pageNumberText: { color: C.white, fontSize: 13, fontWeight: "600" },
  pageNumberTextActive: { color: C.white, fontWeight: "800" },
  
  splitLayoutContainer: {
    marginVertical: 10,
  },
  splitListContainer: {
    flexDirection: "column",
    gap: 0,
    marginTop: 14,
  },
  sectionHeaderSplit: {
    flexDirection: "row", 
    alignItems: "center",
    marginLeft: 2,
    marginBottom: 6, 
    gap: 10,
  },
  sectionTitleSplit: { 
    color: C.white, 
    fontSize: 18, 
    fontWeight: "800", 
    letterSpacing: -0.3,
    flex: 1,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewAllText: {
    color: C.dim,
    fontSize: 12,
    fontWeight: "700",
  },

});
