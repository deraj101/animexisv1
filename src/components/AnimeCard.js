import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme";

// Inject Web Hover Styles
if (Platform.OS === "web" && typeof document !== "undefined") {
  const id = "__animexis_homecard_styles__";
  if (!document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      .animexis-homecard { cursor: pointer; }
      .animexis-homecard:focus-visible { outline: 2px solid #DC143C; outline-offset: 3px; }
    `;
    document.head.appendChild(el);
  }
}

// 🚀 GLOBAL TRAILER LIMITER
let globalActiveTrailers = 0;
const MAX_TRAILERS = 4;

const AnimeCard = React.memo(function AnimeCard({
  item,
  cardWidth,
  cardHeight,
  onPress,
  index,
  inGrid = false,
  containerStyle,
  progress,
  duration: propDuration,
}) {
  // Entrance
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;
  
  // Press + hover scales (stacked)
  const pressScale = useRef(new Animated.Value(1)).current;
  const hoverScale = useRef(new Animated.Value(1)).current;
  
  // Hover overlay + glow
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  const [isHovered, setIsHovered] = React.useState(false);
  const [trailerInitialized, setTrailerInitialized] = React.useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (Platform.OS === 'web' && item.trailer?.id && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Background pre-load (only if limit not reached)
            if (globalActiveTrailers < MAX_TRAILERS && !trailerInitialized) {
              setTrailerInitialized(true);
              globalActiveTrailers++;
            }
          } else {
            // Only cleanup if NOT currently hovered
            if (trailerInitialized && !isHovered) {
              setTrailerInitialized(false);
              globalActiveTrailers = Math.max(0, globalActiveTrailers - 1);
            }
          }
        });
      }, { threshold: 0.1, rootMargin: '150px' });

      if (containerRef.current) observer.observe(containerRef.current);
      return () => {
        observer.disconnect();
        if (trailerInitialized) {
          globalActiveTrailers = Math.max(0, globalActiveTrailers - 1);
        }
      };
    }
  }, [item.trailer?.id, trailerInitialized, isHovered]);

  // Force initialize if hovered
  useEffect(() => {
    if (isHovered && !trailerInitialized) {
      setTrailerInitialized(true);
      globalActiveTrailers++;
    }
  }, [isHovered]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay: Math.min(index, 8) * 50,
        useNativeDriver: true,
      }),
      Animated.spring(slideY, {
        toValue: 0,
        delay: Math.min(index, 8) * 50,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (isHovered) {
      if (!item.trailer?.id) {
        console.log(`[HoverVideo] ❌ No trailer found for: ${item.title}`);
      } else {
        console.log(`[HoverVideo] 🔍 Trailer detected for: ${item.title} (${item.trailer.id})`);
      }
    }
  }, [isHovered]);

  const handleHoverIn = useCallback(() => {
    setIsHovered(true);
    Animated.parallel([
      Animated.spring(hoverScale, { toValue: 1.055, tension: 160, friction: 14, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleHoverOut = useCallback(() => {
    setIsHovered(false);
    Animated.parallel([
      Animated.spring(hoverScale, { toValue: 1, tension: 160, friction: 14, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const onPressIn = useCallback(() =>
    Animated.spring(pressScale, { toValue: 0.93, tension: 120, friction: 8, useNativeDriver: true }).start(), []);
  const onPressOut = useCallback(() =>
    Animated.spring(pressScale, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }).start(), []);

  const imgUrl = item.image || "https://placehold.co/300x420/111115/DC143C?text=No+Image";

  const hoverProps = Platform.OS === "web"
    ? {
        onMouseEnter: handleHoverIn,
        onMouseLeave: handleHoverOut,
        className: "animexis-homecard",
      }
    : {};

  // Extract metadata
  const epLabel = item.episodes ? `${item.episodes} ep` : item.episodeNumber || (item.episode ? item.episode.replace(/Episode\s+/i, "Ep ") : null);
  const typeLabel = item.type || (item.title?.toLowerCase().includes("dub") ? "Dub" : "Sub");
  const categoryLabel = item.category || "TV";
  
  // Hover Metadata
  const rating = item.score || item.rating || item.averageScore || null;
  const genres = Array.isArray(item.genres) 
    ? item.genres.slice(0, 2).map(g => typeof g === 'string' ? g : g.name).join(", ")
    : null;
  const synopsis = item.synopsis || item.description || item.plot || "No description available.";
  
  const studios = Array.isArray(item.studios) ? item.studios.map(s => s.name || s).join(", ") : item.studios;
  const producers = Array.isArray(item.producers) ? item.producers.map(p => p.name || p).join(", ") : item.producers;
  const totalDuration = item.duration || (item.episodeDuration ? `${item.episodeDuration}m` : null);
  const status = item.status || null;
  const premiered = item.premiered || (item.season ? `${item.season} ${item.seasonYear || ""}` : null);

  // Calculate progress %
  const prog = progress ?? item.progress;
  const dur = propDuration ?? item.duration;
  const progressPercent = (prog && dur && dur > 0) ? (prog / dur) * 100 : 0;

  // Use a fallback height if cardHeight is missing so grids display correctly
  const finalCardHeight = cardHeight || Math.round(cardWidth * 1.4);

  return (
    <Animated.View
      ref={containerRef}
      style={[
        { opacity, transform: [{ translateY: slideY }] },
        containerStyle || { marginLeft: inGrid ? 0 : 16, marginBottom: inGrid ? 24 : 0 }
      ]}
      {...hoverProps}
    >
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <TouchableOpacity
          style={{ width: cardWidth }}
          activeOpacity={1}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={() => onPress(item)}
        >
          <View style={[styles.cardImageContainer, { height: finalCardHeight }]}>
            <Animated.View style={{ flex: 1, transform: [{ scale: hoverScale }] }}>
              <Image 
                source={{ uri: imgUrl }} 
                style={[styles.cardImage, isHovered && item.trailer?.id && { opacity: 0 }]} 
                contentFit="cover" 
                transition={300} 
              />
              
              {/* Persistent Hover Video (Web Only) */}
              {Platform.OS === 'web' && trailerInitialized && item.trailer?.id && item.trailer?.site === 'youtube' && (
                <Animated.View 
                  style={[
                    StyleSheet.absoluteFill, 
                    { zIndex: 10, backgroundColor: '#000' },
                    { 
                      opacity: isHovered ? overlayOpacity.interpolate({
                        inputRange: [0, 0.9, 1],
                        outputRange: [0, 0, 1] 
                      }) : 0,
                      visibility: isHovered ? 'visible' : 'hidden' // Completely hide when not hovered
                    }
                  ]}
                >
                  <iframe
                    src={`https://www.youtube.com/embed/${item.trailer.id}?autoplay=1&mute=1&muted=1&controls=0&loop=1&playlist=${item.trailer.id}&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&showinfo=0&autohide=1&playsinline=1&enablejsapi=1&version=3&widgetid=1&origin=${encodeURIComponent(window.location.origin)}`}
                    style={{ 
                      width: '180%', 
                      height: '180%', 
                      position: 'absolute',
                      top: '-40%',
                      left: '-40%',
                      border: 'none', 
                      pointerEvents: 'none',
                      objectFit: 'cover',
                      opacity: 0.99
                    }}
                    allow="autoplay; encrypted-media; fullscreen"
                    title="Trailer Preview"
                  />
                </Animated.View>
              )}
            </Animated.View>

            {/* Static bottom gradient */}
            <LinearGradient
              colors={["transparent", "rgba(8,8,9,0.40)"]}
              locations={[0.6, 1]}
              style={[StyleSheet.absoluteFill, { zIndex: 1, pointerEvents: "none" }]}
            />


            {/* Category badge (Top-Right) */}
            <View style={styles.cardCategoryBadge}>
              <Text style={styles.cardCategoryText}>{categoryLabel}</Text>
            </View>

            {/* Episode badge (Bottom-Left) */}
            {epLabel && (
              <View style={styles.cardEpisodeBadge}>
                <Text style={styles.cardEpisodeText}>{epLabel}</Text>
              </View>
            )}

            {/* Type badge (Bottom-Right) */}
            <View style={styles.cardTypeBadge}>
              <Text style={styles.cardTypeText}>{typeLabel}</Text>
            </View>

            {/* Progress Bar (Bottom) */}
            {progressPercent > 0 && (
              <View style={styles.cardProgressBarBg}>
                <View style={[styles.cardProgressBarFill, { width: `${Math.min(100, progressPercent)}%` }]} />
              </View>
            )}
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  cardGlowBorder: {
    position: "absolute",
    top: -2, left: -2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    boxShadow: '0 0 10px rgba(0,0,0,0.5)'
  },
  cardImageContainer: {
    borderRadius: 6, overflow: "hidden",
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
    backgroundColor: C.crimson,
    paddingHorizontal: 8, paddingVertical: 4,
    borderTopRightRadius: 10,
    zIndex: 10,
  },
  cardEpisodeText: { color: C.white, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  
  cardTypeBadge: {
    position: "absolute", bottom: 0, right: 0,
    backgroundColor: C.white,
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

  // Hover Metadata Styles
  hoverContent: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    justifyContent: "flex-start",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  hoverTitle: {
    color: C.white,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
  },
  hoverRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  hoverRatingNum: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "700",
  },
  hoverRatingCount: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "600",
  },
  hoverMainStats: {
    marginBottom: 12,
  },
  hoverStatLine: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  hoverSynopsis: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
    marginTop: 4,
  },
  hoverActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: "auto",
    paddingTop: 12,
  },
  hoverActionBtn: {
    opacity: 0.9,
  },
  cardProgressBarBg: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.12)",
    zIndex: 15,
  },
  cardProgressBarFill: {
    height: "100%",
    backgroundColor: C.crimson,
  },
});

export default AnimeCard;
