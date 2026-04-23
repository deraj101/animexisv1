import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Linking,
  Animated,
  FlatList,
  useWindowDimensions,
  Modal,
} from "react-native";
import { Image } from "expo-image";

import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import API from "../services/api";
import { C } from "../theme";
import AppFooter from "../components/AppFooter";
import { useAuth } from "../context/AuthContext";
import * as Stats from "../services/Userstats";
import CommentSection from "../components/CommentSection";
import DotCircleLoader from "../components/DotCircleLoader";

// ─── ANIMATED EPISODE CARD ────────────────────────────────────────────────────
const EpisodeCard = React.memo(function EpisodeCard({ item, index, onPress, isActive }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY  = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 280,
        delay: Math.min(index, 20) * 30,
        useNativeDriver: true,
      }),
      Animated.spring(slideY, {
        toValue: 0,
        delay: Math.min(index, 20) * 30,
        tension: 90, friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onPressIn  = useCallback(() =>
    Animated.spring(scale, { toValue: 0.92, tension: 140, friction: 7, useNativeDriver: true }).start(), []);
  const onPressOut = useCallback(() =>
    Animated.spring(scale, { toValue: 1, tension: 140, friction: 7, useNativeDriver: true }).start(), []);

  return (
    <Animated.View style={[styles.episodeCardWrap, { opacity, transform: [{ translateY: slideY }, { scale }] }]}>
      <TouchableOpacity
        style={[styles.episodeCard, isActive && styles.episodeCardActive]}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => onPress(item, index)}
        activeOpacity={1}
      >
        {isActive && <View style={styles.episodeCardGlow} />}
        
        <View style={styles.episodeLeft}>
          <Text style={[styles.episodeNumber, isActive && styles.episodeNumberActive]}>
            {item.number}
          </Text>
        </View>

        <View style={styles.episodeMain}>
          <Text style={[styles.episodeTitle, isActive && styles.episodeTitleActive]} numberOfLines={2}>
            {item.title || `Episode ${item.number}`}
          </Text>
        </View>

        <View style={[styles.episodePlayIcon, isActive && styles.episodePlayIconActive]}>
          <Ionicons name={isActive ? "pause" : "play"} size={14} color="white" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}, (prev, next) =>
  prev.isActive === next.isActive &&
  prev.item     === next.item     &&
  prev.index    === next.index
);

// ─── INFO TILE ────────────────────────────────────────────────────────────────
function InfoTile({ label, value, icon, delay = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideX  = useRef(new Animated.Value(-10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.spring(slideX,  { toValue: 0, delay, tension: 80, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.infoItem, { opacity, transform: [{ translateX: slideX }] }]}>
      <View style={styles.infoIconRow}>
        <Ionicons name={icon} size={12} color={C.crimson} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={2}>{value || "—"}</Text>
    </Animated.View>
  );
}

// ─── DETAILS SCREEN ───────────────────────────────────────────────────────────
export default function DetailsScreen({ route, navigation }) {
  const { id, title: initialTitle } = route.params;
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  const [anime,         setAnime]     = useState(null);
  const [episodes,      setEpisodes]  = useState([]);
  const [loading,       setLoading]   = useState(true);
  const [error,         setError]     = useState(null);
  const [activeEpIndex, setActive]    = useState(-1);
  const [isFavorited, setIsFavorited] = useState(false);
  const [watchlistStatus, setWatchlistStatus] = useState("None");
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [userRating,    setUserRating]= useState(0);
  const [isReversed,    setIsReversed]= useState(false);
  const [activeRange,   setActiveRange] = useState(0); 

  // ── EPISODE RANGES ──
  const CHUNK_SIZE = 50;
  const episodeRanges = useMemo(() => {
    if (!episodes || !episodes.length) return [];
    const ranges = [];
    for (let i = 0; i < episodes.length; i += CHUNK_SIZE) {
      const start = episodes[i].number;
      const end = episodes[Math.min(i + CHUNK_SIZE - 1, episodes.length - 1)].number;
      ranges.push({
        label: `${start}-${end}`,
        data: episodes.slice(i, i + CHUNK_SIZE),
        index: ranges.length
      });
    }
    return isReversed ? [...ranges].reverse() : ranges;
  }, [episodes, isReversed]);

  const activeRangeData = useMemo(() => {
    if (!episodeRanges.length) return [];
    const found = episodeRanges.find(r => r.index === activeRange) || episodeRanges[0];
    return isReversed ? [...found.data].reverse() : found.data;
  }, [episodeRanges, activeRange, isReversed]);

  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  // Scroll position — drives the sticky header
  const scrollY = useRef(new Animated.Value(0)).current;

  // ── Sticky header opacity: fades in after banner scrolls ~160px out of view ──
  const stickyHeaderOpacity = scrollY.interpolate({
    inputRange:  [160, 220],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  // Banner parallax: subtle upward drift as user scrolls
  const bannerTranslateY = scrollY.interpolate({
    inputRange:  [0, 300],
    outputRange: [0, -60],
    extrapolate: "clamp",
  });

  useEffect(() => { fetchAnimeDetails(); }, []);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  };

  const scrollViewRef = useRef(null);

  // Jump to comments if arrived via a Notification interaction
  useEffect(() => {
    if (route.params?.scrollToComments && !loading) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 500); // Wait briefly for layout calculation
    }
  }, [route.params?.scrollToComments, loading]);

  const fetchAnimeDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get(`/api/anime/details/${id}`);
      if (res.data.success) {
        setAnime(res.data);
        setEpisodes(res.data.episodes || []);
        animateIn();
        
        // Fetch Live Global Rating right after rendering starts so cache doesn't block it
        API.get(`/api/anime/details/${id}/rating`).then(ratingRes => {
          if (ratingRes.data?.success && ratingRes.data.globalRating) {
            setAnime(prev => prev ? { ...prev, globalRating: ratingRes.data.globalRating } : prev);
          }
        }).catch(err => console.log('global rating fetch block', err.message));
        
        // Silently log this view for "Top Anime" analytics
        API.post(`/api/anime/${id}/view`, {
          title: res.data.title || initialTitle,
          image: res.data.image || null
        }).catch(() => {});
        if (user?.email) {
          const [fav, rating] = await Promise.all([
            Stats.isFavorited(user.email, id),
            Stats.getAnimeRating(user.email, id),
          ]);
          setIsFavorited(fav);
          setUserRating(rating);

          // Fetch current watchlist status
          const wlRes = await API.get("/api/stats/watchlist");
          if (wlRes.data.success) {
            const item = wlRes.data.list.find(i => i.id === id);
            setWatchlistStatus(item ? item.status : "None");
          }
        }
      } else {
        setError(res.data.error || "Failed to load anime details");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load anime details");
    }
    setLoading(false);
  };

  const handleEpisodePress = useCallback(async (episode, index) => {
    setActive(index);
    try {
      setLoading(true);
      const res = await API.get(`/api/anime/episode-info?url=${encodeURIComponent(episode.url)}`);
      if (res.data.success) {
        // Record episode the moment the user successfully plays it —
        // same trigger as the Redis daily-limit counter so both stay in sync.
        if (user?.email) {
          const epId = `${id}_ep${episode.number || episode.displayNumber || index}`;
          Stats.recordEpisode(user.email, epId).catch(() => {});
        }
        navigation.navigate("Player", {
          video:         episode.url,
          title:         episode.title ? `Ep ${episode.number}: ${episode.title}` : `Episode ${episode.displayNumber || episode.number}`,
          animeTitle:    anime?.title || initialTitle,
          episodeNumber: episode.number,
          episodeTitle:  episode.title,
          episodeData:   res.data,
          animeId:       id,
          animeImage:    anime?.image,
        });
      } else {
        Alert.alert("Error", res.data.error || "Failed to load episode");
      }
    } catch {
      Alert.alert("Error", "Failed to load episode. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [anime, navigation, initialTitle, user, id]);

  const handleToggleFavorite = async () => {
    if (!user) {
      Alert.alert("Login Required", "Please log in to add to favorites.");
      return;
    }
    setFavoriteLoading(true);
    try {
      const animeObj = {
        id: id,
        title: anime?.title || initialTitle,
        image: anime?.image || route.params?.image,
      };
      await Stats.toggleFavorite(user.email, animeObj);
      setIsFavorited(!isFavorited);
    } catch {
      Alert.alert("Error", "Failed to update favorites.");
    } finally {
      setFavoriteLoading(false);
    }
  };

  const updateWatchlistStatus = async (status) => {
    if (!user) {
      Alert.alert("Login Required", "Please log in to manage your watchlist.");
      return;
    }
    setWatchlistLoading(true);
    try {
      const animeObj = {
        id: id,
        title: anime?.title || initialTitle,
        image: anime?.image || route.params?.image,
        status: status
      };
      const res = await API.post("/api/stats/watchlist", animeObj);
      if (res.data.success) {
        setWatchlistStatus(status);
        setShowStatusPicker(false);
      }
    } catch {
      Alert.alert("Error", "Failed to update watchlist status.");
    } finally {
      setWatchlistLoading(false);
    }
  };

  const handleTrailerPress = useCallback(() => {
    if (!anime?.trailer) return;
    const url = anime.trailer.site === "youtube"
      ? `https://www.youtube.com/watch?v=${anime.trailer.id}`
      : anime.trailer.id;
    Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open trailer"));
  }, [anime]);

  const handleRate = useCallback(async (stars) => {
    if (!user?.email) return;
    const newRating = userRating === stars ? 0 : stars;
    setUserRating(newRating);
    await Stats.rateAnime(user.email, id, newRating);
  }, [user, id, userRating]);

  const renderEpisode = useCallback(({ item, index }) => (
    <EpisodeCard
      item={item}
      index={index}
      onPress={handleEpisodePress}
      isActive={activeEpIndex === index}
    />
  ), [handleEpisodePress, activeEpIndex]);

  const episodeKeyExtractor = useCallback((item, i) =>
    `${item.number || item.displayNumber || i}`, []);

  // ── LOADING ──
  if (loading && !anime) {
    return (
      <View style={styles.centered}>
        <DotCircleLoader size={54} color={C.crimson} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  // ── ERROR ──
  if (error) {
    return (
      <View style={styles.centered}>
        <View style={styles.errorIconContainer}>
          <Ionicons name="alert-circle" size={52} color={C.crimson} />
        </View>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchAnimeDetails}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!anime) return null;

  const formatDate = (d) => {
    if (!d?.year) return null;
    return d.month && d.day
      ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
      : String(d.year);
  };
  const startDate = anime.startDate ? formatDate(anime.startDate) : null;
  const endDate   = anime.endDate   ? formatDate(anime.endDate)   : null;
  const aired     = startDate ? (endDate ? `${startDate} → ${endDate}` : startDate) : anime.released;
  
  // New Metadata Helpers
  const studios = Array.isArray(anime.studios) ? anime.studios.map(s => s.name || s).join(", ") : anime.studios;
  const producers = Array.isArray(anime.producers) ? anime.producers.map(p => p.name || p).join(", ") : anime.producers;
  const premiered = anime.season ? `${anime.season} ${anime.year || ""}` : (anime.premiered || null);
  const duration = anime.duration || (anime.episodeDuration ? `${anime.episodeDuration} min` : null);

  const posterUrl = anime.image  || "https://placehold.co/300x450/111115/DC143C?text=No+Image";
  const bannerUrl = anime.banner || posterUrl;
  const epCardWidth = (width - 46) / 3 - 3;
  
  const isDesktop = width >= 992;
  const posterW = isDesktop ? 180 : 105;
  const posterH = isDesktop ? 260 : 155;
  const contentMarginTop = isDesktop ? -120 : -60;
  const titleSize = isDesktop ? 30 : 20;
  const titleLineHeight = isDesktop ? 36 : 26;
  const bannerHeight = isDesktop ? 420 : 290;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── STICKY COLLAPSING HEADER ─────────────────────────────────────────── */}
      <Animated.View
        style={[styles.stickyHeader, { opacity: stickyHeaderOpacity }]}
        pointerEvents={undefined}
      >
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[C.crimson, C.crimsonBright]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.stickyAccentLine}
        />
        <View style={styles.stickyHeaderContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.stickyBackBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.stickyTitle} numberOfLines={1}>
            {anime.title || initialTitle}
          </Text>
          {anime.score && (
            <View style={styles.stickyScorePill}>
              <Ionicons name="star" size={11} color="#FFD700" />
              <Text style={styles.stickyScoreText}>{anime.score}%</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── SCROLL BODY ── */}
      <Animated.ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { flexGrow: 1, paddingBottom: 0 }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >

        {/* ── BANNER (with parallax) ── */}
        <View style={[styles.bannerContainer, { height: bannerHeight }]}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateY: bannerTranslateY }] },
            ]}
          >
            <Image source={{ uri: bannerUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
          </Animated.View>

          <LinearGradient
            colors={["transparent", "rgba(8,8,9,0.9)", C.bg]}
            locations={[0.75, 0.92, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.backWrapper}>
            <BlurView intensity={50} tint="dark" style={styles.blurButton}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={22} color="white" />
              </TouchableOpacity>
            </BlurView>
          </View>

          {anime.score && (
            <View style={styles.scoreBadge}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.scoreText}>{anime.score}%</Text>
            </View>
          )}
        </View>

        {/* ── CONTENT ── */}
        <Animated.View style={[styles.content, { marginTop: contentMarginTop, opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

          {/* Poster + title row */}
          <View style={[styles.posterRow, isDesktop && { gap: 24 }]}>
            <View style={styles.posterWrapper}>
              <Image source={{ uri: posterUrl }} style={[styles.poster, { width: posterW, height: posterH }]} contentFit="cover" transition={300} />
              <View style={styles.posterGlow} />
            </View>

            <View style={styles.titleContainer}>
              <Text style={[styles.title, { fontSize: titleSize, lineHeight: titleLineHeight }]}>{anime.title || initialTitle}</Text>

              <View style={styles.pillsRow}>
                {(anime.format || anime.type) && (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{anime.format || anime.type}</Text>
                  </View>
                )}
                {anime.status && (
                  <View style={[styles.pill, { borderColor: C.glass, backgroundColor: "rgba(255,255,255,0.05)" }]}>
                    <Text style={[styles.pillText, { color: C.dim }]}>{anime.status}</Text>
                  </View>
                )}
              </View>

              <View style={styles.actionButtons}>
                {episodes.length > 0 && (
                  <TouchableOpacity
                    style={styles.watchButton}
                    onPress={() => handleEpisodePress(episodes[0], 0)}
                  >
                    <LinearGradient
                      colors={[C.crimson, "#a00020"]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.watchGradient}
                    >
                      <Ionicons name="play" size={16} color="white" />
                      <Text style={styles.watchButtonText}>Watch Now</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                
                {/* ── ACTIONS (FAV & WATCHLIST) ── */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, isFavorited && styles.actionBtnActive]}
                    onPress={handleToggleFavorite}
                    disabled={favoriteLoading}
                  >
                    <Ionicons
                      name={isFavorited ? "heart" : "heart-outline"}
                      size={20}
                      color={isFavorited ? C.crimson : C.white}
                    />
                    <Text style={[styles.actionText, isFavorited && { color: C.crimson }]}>
                      {isFavorited ? "Favorited" : "Favorite"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, watchlistStatus !== "None" && styles.actionBtnActive]}
                    onPress={() => setShowStatusPicker(true)}
                    disabled={watchlistLoading}
                  >
                    <Ionicons
                      name={watchlistStatus !== "None" ? "bookmark" : "bookmark-outline"}
                      size={19}
                      color={watchlistStatus !== "None" ? C.crimson : C.white}
                    />
                    <Text style={[styles.actionText, watchlistStatus !== "None" && { color: C.crimson }]}>
                      {watchlistStatus === "None" ? "Add to List" : watchlistStatus}
                    </Text>
                  </TouchableOpacity>
                </View>
                {anime.trailer && (
                  <TouchableOpacity style={styles.trailerButton} onPress={handleTrailerPress}>
                    <Ionicons name="logo-youtube" size={18} color="#FF4444" />
                  </TouchableOpacity>
                )}
              </View>

            </View>
          </View>

          {/* Info grid */}
          <View style={styles.infoGrid}>
            <InfoTile label="Format"   value={anime.format || anime.type}                                 icon="tv-outline"       delay={0}   />
            <InfoTile label="Episodes" value={String(anime.anilistEpisodeCount || episodes.length || "?")} icon="list-outline"     delay={60}  />
            <InfoTile label="Status"   value={anime.status}                                                icon="time-outline"     delay={120} />
            {aired && <InfoTile label="Aired" value={aired}                                                icon="calendar-outline" delay={180} />}
            {duration && <InfoTile label="Duration" value={duration}                                       icon="hourglass-outline" delay={240} />}
            {studios && <InfoTile label="Studios" value={studios}                                          icon="business-outline" delay={300} />}
            {producers && <InfoTile label="Producers" value={producers}                                    icon="videocam-outline" delay={360} />}
            {premiered && <InfoTile label="Premiered" value={premiered}                                    icon="sunny-outline" delay={420} />}
          </View>

          {/* Synonyms */}
          {anime.synonyms?.length > 0 && (
            <View style={styles.otherNames}>
              <Ionicons name="pricetag-outline" size={14} color={C.crimson} />
              <Text style={styles.otherNamesText} numberOfLines={1}>{anime.synonyms.join(" · ")}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Synopsis</Text>
          <Text style={styles.synopsis}>
            {anime.description?.replace(/<[^>]*>/g, "") || "No synopsis available."}
          </Text>

          {anime.genres?.length > 0 && (
            <View style={styles.genresContainer}>
              {anime.genres.map((g, i) => (
                <View key={i} style={[styles.genreTag, { borderColor: C.crimson + "60", backgroundColor: "rgba(220,20,60,0.12)" }]}>
                  <Text style={[styles.genreText, { color: C.white }]}>{typeof g === "string" ? g : g.name || g}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Ratings Section */}
          <View style={{ gap: 12, marginTop: 18 }}>
            {anime.globalRating?.count > 0 && (
              <View style={[styles.ratingRow, { marginTop: 0 }]}>
                <View style={styles.ratingLeft}>
                  <Ionicons name="people" size={14} color={C.dim} />
                  <Text style={styles.ratingLabel}>Community ({anime.globalRating.count})</Text>
                </View>
                <View style={[styles.starsRow, { gap: 4 }]}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={[styles.ratingValue, { fontSize: 15 }]}>{anime.globalRating.average}</Text>
                  <Text style={{ color: C.dimmer, fontSize: 12, fontWeight: "600", marginTop: 2 }}>/ 5</Text>
                </View>
              </View>
            )}

            {user?.email && (
              <View style={[styles.ratingRow, { marginTop: 0 }]}>
                <View style={styles.ratingLeft}>
                  <Ionicons name="person" size={14} color={C.dim} />
                  <Text style={styles.ratingLabel}>Your rating</Text>
              </View>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => handleRate(s)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Ionicons
                      name={s <= userRating ? "star" : "star-outline"}
                      size={24}
                      color={s <= userRating ? "#FFD700" : C.dimmer}
                    />
                  </TouchableOpacity>
                ))}
                {userRating > 0 && (
                  <Text style={styles.ratingValue}>{userRating}/5</Text>
                )}
              </View>
            </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Episodes header */}
          <View style={styles.episodesHeader}>
            <View style={styles.episodesHeaderLeft}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionLabel}>Episodes</Text>
              <View style={styles.epCountBadge}>
                <Text style={styles.epCountText}>{episodes.length}</Text>
              </View>
              
              {episodes.length > CHUNK_SIZE && (
                <TouchableOpacity 
                  style={styles.sortToggle} 
                  onPress={() => setIsReversed(!isReversed)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={isReversed ? "arrow-down" : "arrow-up"} 
                    size={12} 
                    color={C.crimson} 
                  />
                  <Text style={styles.sortToggleText}>
                    {isReversed ? "Newest" : "Oldest"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {episodes.length > 0 && (
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => handleEpisodePress(episodes[0], 0)}
              >
                <Text style={styles.startButtonText}>Start</Text>
                <Ionicons name="play" size={12} color={C.crimson} />
              </TouchableOpacity>
            )}
          </View>

          {/* Range Selector */}
          {episodeRanges.length > 1 && (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={episodeRanges}
              keyExtractor={(r) => r.label}
              contentContainerStyle={styles.rangeSelector}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.rangePill, activeRange === item.index && styles.rangePillActive]}
                  onPress={() => setActiveRange(item.index)}
                >
                  <Text style={[styles.rangePillText, activeRange === item.index && styles.rangePillActiveText]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          {episodes.length > 0 ? (
            <FlatList
              data={activeRangeData}
              keyExtractor={episodeKeyExtractor}
              renderItem={renderEpisode}
              numColumns={isDesktop ? 2 : 1}
              key={isDesktop ? "desktop-grid" : "mobile-list"}
              scrollEnabled={false}
              removeClippedSubviews
              initialNumToRender={CHUNK_SIZE}
              maxToRenderPerBatch={CHUNK_SIZE}
              windowSize={3}
              contentContainerStyle={styles.episodesGrid}
            />
          ) : (
            <View style={styles.noEpisodesContainer}>
              <Ionicons name="film-outline" size={32} color={C.dimmer} />
              <Text style={styles.noEpisodes}>No episodes available</Text>
            </View>
          )}

          <CommentSection animeId={id} />

          <AppFooter />
        </Animated.View>
      </Animated.ScrollView>

      {/* Loading overlay (episode fetch) */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <DotCircleLoader size={54} color={C.crimson} />
        </View>
      )}
      {/* ── STATUS PICKER MODAL ── */}
      <Modal
        visible={showStatusPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowStatusPicker(false)}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.statusModal}>
            <Text style={styles.modalTitle}>Update Status</Text>
            {['Watching', 'Plan to Watch', 'Completed', 'On Hold', 'Dropped', 'None'].map(s => (
              <TouchableOpacity 
                key={s} 
                style={[styles.statusOption, watchlistStatus === s && styles.statusOptionActive]}
                onPress={() => updateWatchlistStatus(s)}
              >
                <Text style={[styles.statusOptionText, watchlistStatus === s && styles.statusOptionTextActive]}>
                  {s === 'None' ? 'Remove from List' : s}
                </Text>
                {watchlistStatus === s && <Ionicons name="checkmark" size={18} color={C.crimson} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}


// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  centered: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: C.bg, padding: 20, gap: 12,
  },
  loadingText: { color: C.dim, fontSize: 14 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,8,9,0.75)",
    justifyContent: "center", alignItems: "center",
    zIndex: 1000,
  },

  // ── Sticky header ──
  stickyHeader: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 100,
    overflow: "hidden",
  },
  stickyAccentLine: { height: 2 },
  stickyHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 52 : 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  stickyBackBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: C.border,
    justifyContent: "center", alignItems: "center",
  },
  stickyTitle: {
    flex: 1, color: C.white,
    fontSize: 16, fontWeight: "700",
    letterSpacing: -0.2,
  },
  stickyScorePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1, borderColor: "rgba(255,215,0,0.35)",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  stickyScoreText: { color: "#FFD700", fontSize: 11, fontWeight: "700" },

  errorIconContainer: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.04)",
    justifyContent: "center", alignItems: "center",
  },
  errorText: { color: C.crimson, fontSize: 15, textAlign: "center" },
  retryButton: {
    backgroundColor: C.crimson,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 30,
  },
  retryText: { color: C.white, fontWeight: "700", fontSize: 15 },

  bannerContainer: { height: 290, position: "relative", overflow: "hidden" },
  backWrapper: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 40,
    left: 18, zIndex: 10,
  },
  blurButton: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    overflow: "hidden", borderWidth: 1, borderColor: C.border,
  },
  scoreBadge: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 40,
    right: 18,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(8,8,9,0.8)",
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 30, borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
    zIndex: 10,
  },
  scoreText: { color: C.white, fontSize: 12, fontWeight: "700" },

  content: { paddingHorizontal: 18, marginTop: -60, paddingBottom: 20 },
  posterRow: { flexDirection: "row", gap: 16, alignItems: "flex-end" },
  posterWrapper: { position: "relative" },
  poster: {
    width: 105, height: 155,
    borderRadius: 18, borderWidth: 1.5, borderColor: C.glassHigh,
  },
  posterGlow: {
    position: "absolute",
    bottom: -10, left: 10, right: 10,
    height: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    filter: Platform.OS === "web" ? "blur(12px)" : undefined,
    opacity: 0.5,
  },
  titleContainer: {
    flex: 1, justifyContent: "flex-end", paddingBottom: 6, gap: 8,
  },
  title: { color: C.white, fontSize: 20, fontWeight: "800", letterSpacing: -0.4, lineHeight: 26 },
  pillsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  pillText: { color: C.dim, fontSize: 11, fontWeight: "600" },
  actionButtons: { flexDirection: "row", gap: 10, marginTop: 2 },
  watchButton: { flex: 1, borderRadius: 30, overflow: "hidden" },
  watchGradient: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 11, gap: 6,
  },
  watchButtonText: { color: C.white, fontSize: 13, fontWeight: "700" },
  trailerButton: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: C.surfaceHigh, borderWidth: 1,
    borderColor: "rgba(255,68,68,0.3)",
    justifyContent: "center", alignItems: "center",
  },

  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  infoItem: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 6, padding: 12, flex: 1, minWidth: 120,
  },
  infoIconRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
  infoLabel: { color: C.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600" },
  infoValue: { color: C.white, fontSize: 14, fontWeight: "700" },

  otherNames: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 14, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 6,
    borderWidth: 1, borderColor: C.glass,
  },
  otherNamesText: { color: C.dim, fontSize: 12, flex: 1 },

  divider: { height: 1, backgroundColor: C.border, marginVertical: 20 },

  sectionLabel: { color: C.white, fontSize: 16, fontWeight: "700", marginBottom: 10, letterSpacing: -0.2 },
  synopsis: { color: "#c0c0d0", fontSize: 14, lineHeight: 22 },

  genresContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  genreTag: {
    backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 30, borderWidth: 1, borderColor: C.glass,
  },
  genreText: { color: C.dim, fontSize: 12, fontWeight: "600" },

  episodesHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
  },
  episodesHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionAccent: { width: 4, height: 18, backgroundColor: C.crimson, borderRadius: 2 },
  epCountBadge: {
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: C.glass,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20,
  },
  epCountText: { color: C.dim, fontSize: 11, fontWeight: "700" },
  startButton: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 6, borderWidth: 1,
    borderColor: C.glass, backgroundColor: "rgba(255,255,255,0.04)",
  },
  startButtonText: { color: C.dim, fontSize: 12, fontWeight: "700" },

  sortToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(220,20,60,0.08)",
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(220,20,60,0.25)",
    marginLeft: 6,
  },
  sortToggleText: {
    color: C.crimson,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  episodesGrid: { gap: 12 },
  episodeCardWrap: { flex: 1, marginHorizontal: 2, marginVertical: 4 },
  episodeCard: {
    flexDirection: "row",
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
    alignItems: "center", gap: 16, overflow: "hidden",
  },
  episodeCardActive: { borderColor: C.crimson, backgroundColor: "rgba(220,20,60,0.12)" },
  episodeCardGlow: {
    position: "absolute", top: 0, bottom: 0, left: 0,
    width: 4, backgroundColor: C.crimson,
  },
  episodeLeft: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  episodeNumber: { color: C.dim, fontSize: 13, fontWeight: "800" },
  episodeNumberActive: { color: C.crimson },
  episodeMain: { flex: 1 },
  episodeTitle: { color: C.white, fontSize: 13, fontWeight: "600", lineHeight: 18, opacity: 0.8 },
  episodeTitleActive: { opacity: 1 },
  episodePlayIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center", alignItems: "center",
  },
  episodePlayIconActive: { backgroundColor: C.crimson },

  rangeSelector: { paddingBottom: 16, gap: 10 },
  recommendationsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 24 },
  statusModal: { width: "100%", maxWidth: 340, backgroundColor: C.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.border },
  modalTitle: { color: C.white, fontSize: 18, fontWeight: "700", marginBottom: 20, textAlign: "center" },
  statusOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: C.surfaceHigh },
  statusOptionActive: { backgroundColor: C.crimsonDim, borderWidth: 1, borderColor: C.crimsonBorder },
  statusOptionText: { color: C.dim, fontSize: 15, fontWeight: "600" },
  statusOptionTextActive: { color: C.white },
  rangePill: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: C.surfaceHigh,
    borderWidth: 1, borderColor: C.border,
  },
  rangePillActive: { backgroundColor: C.crimson, borderColor: C.crimson },
  rangePillText: { color: C.dim, fontSize: 12, fontWeight: "700" },
  rangePillActiveText: { color: C.white },

  noEpisodesContainer: { alignItems: "center", padding: 30, gap: 10 },
  noEpisodes: { color: C.dim, fontSize: 14 },

  ratingRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 18, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border,
  },
  ratingLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingLabel: { color: C.dim, fontSize: 13, fontWeight: "600" },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingValue: { color: "#FFD700", fontSize: 13, fontWeight: "700", marginLeft: 6 },
});