import React, { useEffect, useState, useRef, useCallback } from "react";
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
        <Text style={[styles.episodeNumber, isActive && styles.episodeNumberActive]}>
          {item.displayNumber || item.number}
        </Text>
        <View style={[styles.episodePlayIcon, isActive && styles.episodePlayIconActive]}>
          <Ionicons name="play" size={13} color="white" />
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
  const [favorited,     setFavorited] = useState(false);
  const [userRating,    setUserRating]= useState(0);
  const [favLoading,    setFavLoading]= useState(false);

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
          setFavorited(fav);
          setUserRating(rating);
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
          title:         `Episode ${episode.displayNumber || episode.number}`,
          animeTitle:    anime?.title || initialTitle,
          episodeNumber: episode.number,
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

  const handleTrailerPress = useCallback(() => {
    if (!anime?.trailer) return;
    const url = anime.trailer.site === "youtube"
      ? `https://www.youtube.com/watch?v=${anime.trailer.id}`
      : anime.trailer.id;
    Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open trailer"));
  }, [anime]);

  const handleFavorite = useCallback(async () => {
    if (!user?.email || !anime) return;
    setFavLoading(true);
    const { isFavorited: nowFav } = await Stats.toggleFavorite(user.email, {
      id, title: anime.title, image: anime.image,
    });
    setFavorited(nowFav);
    setFavLoading(false);
  }, [user, anime, id]);

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

      {/* ── STICKY COLLAPSING HEADER ───────────────────────────────────────────
          Absolutely positioned on top; fades in as the banner scrolls away.
          Shows the back button + title + score so the user always has context. */}
      <Animated.View
        style={[styles.stickyHeader, { opacity: stickyHeaderOpacity }]}
        pointerEvents={undefined} // always receive touches so back btn works
      >
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        {/* Accent line */}
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

          {/* Back button — visible when sticky header is hidden */}
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
                {anime.trailer && (
                  <TouchableOpacity style={styles.trailerButton} onPress={handleTrailerPress}>
                    <Ionicons name="logo-youtube" size={18} color="#FF4444" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.trailerButton,
                    favorited && { borderColor: C.crimsonBorder, backgroundColor: C.crimsonDim },
                  ]}
                  onPress={handleFavorite}
                  disabled={favLoading}
                >
                  <Ionicons
                    name={favorited ? "heart" : "heart-outline"}
                    size={18}
                    color={favorited ? C.crimson : C.dim}
                  />
                </TouchableOpacity>
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

          {episodes.length > 0 ? (
            <FlatList
              data={episodes}
              keyExtractor={episodeKeyExtractor}
              renderItem={renderEpisode}
              numColumns={3}
              key={epCardWidth}
              scrollEnabled={false}
              removeClippedSubviews
              initialNumToRender={18}
              maxToRenderPerBatch={18}
              windowSize={5}
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

  episodesGrid: { gap: 10 },
  episodeCardWrap: { flex: 1, margin: 5 },
  episodeCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 6, paddingVertical: 14, paddingHorizontal: 8,
    alignItems: "center", gap: 8, overflow: "hidden",
  },
  episodeCardActive: { borderColor: C.crimson, backgroundColor: C.crimsonDim },
  episodeCardGlow: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: 2, backgroundColor: C.crimson, opacity: 0.9,
  },
  episodeNumber: { color: C.dim, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  episodeNumberActive: { color: C.crimson },
  episodePlayIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.surfaceHigh, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: C.border,
  },
  episodePlayIconActive: { backgroundColor: C.crimson, borderColor: "transparent" },

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