import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Dimensions,
  useWindowDimensions,
  Image,
  Platform,
  Animated,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import CustomWebView from "../components/CustomWebView";
import { useAuth } from "../context/AuthContext";
import * as Stats from "../services/Userstats";
import API from "../services/api";
import CommentSection from "../components/CommentSection";
import DotCircleLoader from "../components/DotCircleLoader";
import DownloadService from "../services/DownloadService";

// react-native-svg — optional dep, gracefully absent on web
let Svg, Circle;
try {
  const rnsvg = require("react-native-svg");
  Svg = rnsvg.Svg;
  Circle = rnsvg.Circle;
} catch { /* not installed — CountdownRing falls back to plain box */ }

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#080808",
  surface: "#101010",
  surfaceHigh: "#1a1a1a",
  accent: "#FFFFFF",
  accentDim: "rgba(255,255,255,0.07)",
  accentBorder: "rgba(255,255,255,0.18)",
  white: "#FFFFFF",
  dim: "#888888",
  border: "rgba(255,255,255,0.07)",
  modalBorder: "#1a1a1a",
  primary: "#FFFFFF",
  primaryDim: "rgba(255,255,255,0.07)",
  primaryBorder: "rgba(255,255,255,0.18)",
  crimson: "#e11d48",
};

// ─── AD CONFIG ────────────────────────────────────────────────────────────────
const ADS = [
  {
    url: `${process.env.EXPO_PUBLIC_API_URL}/api/anime/ad`,
    skipAfter: 5,
    label: "Ad · animexis.com",
  },
];

// ─── FORMAT TIME ─────────────────────────────────────────────────────────────
const fmtTime = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

// ─── COUNTDOWN RING ───────────────────────────────────────────────────────────
const RING_SIZE = 52;
const RING_RADIUS = 20;
const RING_STROKE = 3;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function CountdownRing({ remaining, total, onSkip, canSkip }) {
  const progress = total > 0 ? remaining / total : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;

  if (Platform.OS === "web") {
    return (
      <TouchableOpacity
        onPress={canSkip ? onSkip : undefined}
        activeOpacity={canSkip ? 0.8 : 1}
        style={adStyles.ringWrap}
      >
        <svg
          width={RING_SIZE} height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <circle cx={cx} cy={cy} r={RING_RADIUS} fill="none"
            stroke="rgba(255,255,255,0.18)" strokeWidth={RING_STROKE} />
          <circle cx={cx} cy={cy} r={RING_RADIUS} fill="none"
            stroke={canSkip ? "#facc15" : "rgba(255,255,255,0.75)"}
            strokeWidth={RING_STROKE} strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashOffset}
            style={{
              transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px`,
              transition: "stroke-dashoffset 0.9s linear, stroke 0.3s"
            }} />
        </svg>
        <View style={adStyles.ringCenter}>
          {canSkip
            ? <Ionicons name="play-skip-forward" size={16} color="#facc15" />
            : <Text style={adStyles.ringCountdown}>{remaining}</Text>
          }
        </View>
        {canSkip && <Text style={adStyles.ringSkipLabel}>Skip</Text>}
      </TouchableOpacity>
    );
  }

  if (Svg && Circle) {
    return (
      <TouchableOpacity
        onPress={canSkip ? onSkip : undefined}
        activeOpacity={canSkip ? 0.8 : 1}
        style={adStyles.ringWrap}
      >
        <Svg width={RING_SIZE} height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <Circle cx={cx} cy={cy} r={RING_RADIUS} fill="none"
            stroke="rgba(255,255,255,0.18)" strokeWidth={RING_STROKE} />
          <Circle cx={cx} cy={cy} r={RING_RADIUS} fill="none"
            stroke={canSkip ? "#facc15" : "rgba(255,255,255,0.75)"}
            strokeWidth={RING_STROKE} strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashOffset}
            rotation={-90} origin={`${cx}, ${cy}`} />
        </Svg>
        <View style={adStyles.ringCenter}>
          {canSkip
            ? <Ionicons name="play-skip-forward" size={16} color="#facc15" />
            : <Text style={adStyles.ringCountdown}>{remaining}</Text>
          }
        </View>
        {canSkip && <Text style={adStyles.ringSkipLabel}>Skip</Text>}
      </TouchableOpacity>
    );
  }

  return canSkip ? (
    <TouchableOpacity style={adStyles.skipBtn} onPress={onSkip} activeOpacity={0.85}>
      <Text style={adStyles.skipBtnText}>Skip Ad</Text>
      <Ionicons name="play-skip-forward" size={13} color="#000" />
    </TouchableOpacity>
  ) : (
    <View style={adStyles.skipSoon}>
      <Text style={adStyles.skipSoonText}>Skip in {remaining}s</Text>
    </View>
  );
}

// ─── PRE-ROLL AD OVERLAY ──────────────────────────────────────────────────────
function AdOverlay({ onAdFinished }) {
  const ad = ADS[0];
  const [countdown, setCountdown] = useState(ad.skipAfter);
  const [canSkip, setCanSkip] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [adError, setAdError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const skipAnim = useRef(new Animated.Value(0)).current;
  const adRef = useRef(null);

  useEffect(() => {
    if (countdown <= 0) {
      setCanSkip(true);
      Animated.spring(skipAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSkip = useCallback(() => { if (canSkip) onAdFinished(); }, [canSkip, onAdFinished]);
  const handleAdError = useCallback(() => { setAdLoading(false); setAdError(true); }, []);

  const renderOverlayUI = () => (
    <>
      {adLoading && !adError && (
        <View style={adStyles.loadingOverlay}>
          <DotCircleLoader size={18} color="#fff" />
          <Text style={adStyles.loadingText}>Loading ad…</Text>
        </View>
      )}
      {adError && (
        <View style={adStyles.loadingOverlay}>
          <Text style={adStyles.loadingText}>Ad unavailable</Text>
        </View>
      )}
      {!adLoading && !adError && (
        <View style={adStyles.labelWrap}>
          <View style={adStyles.adBadge}><Text style={adStyles.adBadgeText}>Ad</Text></View>
          <Text style={adStyles.adLabel} numberOfLines={1}>{ad.label}</Text>
        </View>
      )}
      <View style={adStyles.skipArea}>
        {timeLeft !== null && !adError && (
          <Text style={adStyles.timeLeft}>Ad ends in {fmtTime(timeLeft)}</Text>
        )}
        {!adError && (
          <CountdownRing
            remaining={countdown}
            total={ad.skipAfter}
            onSkip={handleSkip}
            canSkip={canSkip}
          />
        )}
      </View>
    </>
  );

  if (Platform.OS === "web") {
    return (
      <View style={adStyles.container}>
        {!adError && (
          <video
            ref={adRef}
            src={ad.url}
            autoPlay
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#000" }}
            onLoadStart={() => setAdLoading(false)}
            onCanPlay={() => setAdLoading(false)}
            onLoadedMetadata={() => setAdLoading(false)}
            onLoadedData={() => setAdLoading(false)}
            onTimeUpdate={(e) => {
              const v = e.target;
              setAdLoading(false);
              if (!isNaN(v.duration)) setTimeLeft(Math.max(0, Math.ceil(v.duration - v.currentTime)));
            }}
            onEnded={onAdFinished}
            onError={handleAdError}
          />
        )}
        {renderOverlayUI()}
      </View>
    );
  }

  return (
    <View style={adStyles.container}>
      {!adError && (
        <Video
          ref={adRef}
          source={{ uri: ad.url }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          shouldPlay
          useNativeControls={false}
          onLoad={(status) => {
            setAdLoading(false);
            if (status.durationMillis) setTimeLeft(Math.ceil(status.durationMillis / 1000));
          }}
          onPlaybackStatusUpdate={(status) => {
            if (status.durationMillis && status.positionMillis) {
              setTimeLeft(Math.max(0, Math.ceil((status.durationMillis - status.positionMillis) / 1000)));
            }
            if (status.didJustFinish) onAdFinished();
          }}
          onError={handleAdError}
        />
      )}
      {renderOverlayUI()}
    </View>
  );
}

// ─── PLAYER CONTROLS OVERLAY ─────────────────────────────────────────────────
// Fades in on tap, auto-hides after AUTO_HIDE_MS of inactivity.
const AUTO_HIDE_MS = 3000;

function PlayerControls({
  visible, title, onClose, onOpenBrowser, controlsAnim,
}) {
  return (
    <Animated.View
      style={[styles.controlsOverlay, { opacity: controlsAnim, pointerEvents: visible ? "box-none" : "none" }]}
    >
      {/* Top gradient + title bar */}
      <LinearGradient
        colors={["rgba(0,0,0,0.78)", "transparent"]}
        style={styles.controlsTop}
      >
        <Text style={styles.controlsTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.controlsTopRight}>
          <TouchableOpacity onPress={onOpenBrowser} style={styles.controlBtn}>
            <Ionicons name="open-outline" size={17} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={[styles.controlBtn, styles.controlBtnClose]}>
            <Ionicons name="close" size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Centre play/pause hint (just a visual cue) */}
      <View style={[styles.controlsCenter, { pointerEvents: "none" }]}>
        <View style={styles.controlsCenterIcon}>
          <Ionicons name="pause" size={28} color="rgba(255,255,255,0.5)" />
        </View>
      </View>

    </Animated.View>
  );
}

// ─── PLAYER SCREEN ────────────────────────────────────────────────────────────
export default function PlayerScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { video, title, animeTitle, episodeNumber, episodeTitle, episodeData, animeId, animeImage, isOffline } = route.params;
  const { user } = useAuth();
  
  const { width, height } = useWindowDimensions();
  const isWidescreen = width > 990;

  // Dynamic responsive player dimensions
  const playerWidth = isWidescreen ? Math.round(width * 0.69) : width;
  const playerHeight = Math.round(playerWidth * (9 / 16));
  const maxPlayerHeight = height * 0.72;
  const finalPlayerHeight = Math.min(playerHeight, maxPlayerHeight);

  const [currentEpisodeUrl, setCurrentEpisodeUrl] = useState(video);
  const [currentEpisodeNumber, setCurrentEpisodeNumber] = useState(episodeNumber);
  const [currentEpisodeData, setCurrentEpisodeData] = useState(episodeData);
  const [episodes, setEpisodes] = useState([]);
  const [animeDetails, setAnimeDetails] = useState(null);
  const [activeTab, setActiveTab] = useState("episodes"); // "episodes" | "comments"
  const [showEpisodesModal, setShowEpisodesModal] = useState(false);

  const [playerLoading, setPlayerLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState(null);
  const [webViewUrl, setWebViewUrl] = useState(null);
  const [useWebView, setUseWebView] = useState(false);
  const [error, setError] = useState(null);
  const [showAd, setShowAd] = useState(user?.subscription?.toLowerCase() !== 'premium');
  // Controls visibility state
  const [controlsVisible, setControlsVisible] = useState(false);

  const [downloadedEps, setDownloadedEps] = useState({});
  const [downloadingEps, setDownloadingEps] = useState({});

  useEffect(() => {
    const checkDownloads = async () => {
      const list = await DownloadService.getDownloads();
      const map = {};
      list.filter(d => String(d.animeId) === String(animeId)).forEach(d => {
        map[d.episodeNumber] = true;
      });
      setDownloadedEps(map);
    };
    if (animeId) checkDownloads();
  }, [animeId]);

  const handleDownloadEpisode = async (episodeNum, episodeUrl) => {
    if (user?.subscription?.toLowerCase() !== 'premium') {
      Alert.alert("Premium Only", "Offline downloads are exclusive to Premium members. Upgrade to unlock!");
      return;
    }

    if (downloadedEps[episodeNum]) {
      Alert.alert("Already Downloaded", "This episode is already available offline.");
      return;
    }

    if (downloadingEps[episodeNum] !== undefined) return;

    try {
      setDownloadingEps(p => ({ ...p, [episodeNum]: 0 }));

      let directUrl = null;
      const res = await API.get(`/api/anime/episode-info?url=${encodeURIComponent(episodeUrl)}`);
      if (res.data.success) {
        const videoSources = res.data.videoSources || [];
        const mp4Source = videoSources.find(s => {
          const url = (s.url || s).toLowerCase();
          return /\.(mp4|mkv|webm|mov|avi)/i.test(url);
        });

        if (mp4Source) {
          const fileUrl = mp4Source.url || mp4Source;
          directUrl = `${API.defaults.baseURL}/api/anime/download-file?url=${encodeURIComponent(fileUrl)}`;
        } else {
          const hlsSource = videoSources.find(s => (s.url || s).toLowerCase().includes('.m3u8'));
          if (hlsSource) {
            const streamUrl = hlsSource.url || hlsSource;
            directUrl = `${API.defaults.baseURL}/api/anime/download-m3u8?format=ts&url=${encodeURIComponent(streamUrl)}`;
          }
        }
      }

      if (!directUrl) {
        Alert.alert("Error", "No downloadable source found for this episode.");
        setDownloadingEps(p => {
          const next = { ...p };
          delete next[episodeNum];
          return next;
        });
        return;
      }

      try {
        await DownloadService.startDownload(
          { number: episodeNum, directUrl },
          { id: animeId, title: animeTitle, image: animeImage },
          (progressInfo) => {
            setDownloadingEps(p => ({ ...p, [episodeNum]: progressInfo.progress }));
          }
        );
        setDownloadedEps(p => ({ ...p, [episodeNum]: true }));
        Alert.alert("Success", `Episode ${episodeNum} downloaded successfully!`);
      } catch (dlErr) {
        Alert.alert("Download Failed", dlErr.message || "Failed to download episode.");
      }
    } catch (err) {
      console.error("Download error:", err);
      Alert.alert("Download Failed", err.message || "Failed to download episode.");
    } finally {
      setDownloadingEps(p => {
        const next = { ...p };
        delete next[episodeNum];
        return next;
      });
    }
  };

  const videoRef = useRef(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.93)).current;
  const controlsAnim = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef(null);
  const watchStartRef = useRef(null);
  const totalWatchTimeRef = useRef(0);
  const lastPlayStartRef = useRef(null);
  const isPlayingRef = useRef(false);
  const wasFinishedRef = useRef(false);
  const playbackRef = useRef({ position: 0, duration: 0 }); // track playback for progress sync
  const lastSyncRef = useRef(0); // timestamp of last progress sync

  // ── Controls: show → fade in + start auto-hide timer ──────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    Animated.timing(controlsAnim, {
      toValue: 1, duration: 220, useNativeDriver: true,
    }).start();
    // Reset the auto-hide timer on every interaction
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      Animated.timing(controlsAnim, {
        toValue: 0, duration: 300, useNativeDriver: true,
      }).start(() => setControlsVisible(false));
    }, AUTO_HIDE_MS);
  }, []);

  const hideControls = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    Animated.timing(controlsAnim, {
      toValue: 0, duration: 220, useNativeDriver: true,
    }).start(() => setControlsVisible(false));
  }, []);

  const toggleControls = useCallback(() => {
    if (controlsVisible) hideControls();
    else showControls();
  }, [controlsVisible, showControls, hideControls]);

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  useEffect(() => {
    if (!showAd && !watchStartRef.current) {
      watchStartRef.current = Date.now();

      // 🚀 IMMEDIATE SYNC: Update 'Continue Watching' the moment playback begins
      if (user?.email && animeId) {
        console.log("[Player] Syncing progress immediately...");
        API.post("/api/anime/continue-watching", {
          email: user.email,
          animeId: animeId,
          title: animeTitle || "Unknown Anime",
          image: animeImage || "",
          episodeUrl: currentEpisodeUrl,
          episodeNumber: String(currentEpisodeNumber || "1"),
          progress: 0,
          duration: 0,
        }).catch(() => { });
      }
    }
  }, [showAd, user?.email, animeId, currentEpisodeUrl, currentEpisodeNumber]);

  useEffect(() => {
    return () => {
      if (!watchStartRef.current || !user?.email) return;
      
      // Ensure we add any currently accumulating watch time if they unmount while playing
      if (isPlayingRef.current && lastPlayStartRef.current) {
        totalWatchTimeRef.current += (Date.now() - lastPlayStartRef.current);
        isPlayingRef.current = false;
      }
      
      let finalElapsed = Math.round(totalWatchTimeRef.current / 1000);
      
      // Fallback: If using an iframe (WebView), we can't accurately track play/pause, 
      // so we use the total time spent on the screen.
      if (useWebView || finalElapsed === 0) {
        const screenTime = Math.round((Date.now() - watchStartRef.current) / 1000);
        // Only use screenTime fallback if we didn't get any native playback time
        if (finalElapsed === 0) finalElapsed = screenTime;
      }

      if (finalElapsed >= 1) {
        // Record watch time statistics (only actual playtime)
        Stats.addWatchTime(user.email, finalElapsed);
      }

      // Record 'Continue Watching' progress with timestamp (ONLY if not already marked finished)
      if (animeId && !wasFinishedRef.current) {
        const { position, duration } = playbackRef.current;
        API.post("/api/anime/continue-watching", {
          email: user.email,
          animeId: animeId,
          title: animeTitle || "Unknown Anime",
          image: animeImage || "",
          episodeUrl: currentEpisodeUrl,
          episodeNumber: String(currentEpisodeNumber || "1"),
          progress: Math.round(position),
          duration: Math.round(duration),
        }).catch(() => { });
      }
    };
  }, [currentEpisodeUrl, currentEpisodeNumber]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, tension: 75, friction: 11, useNativeDriver: true })
    ]).start();
    pickAndLoadSource();
    // Show controls initially for 3s so user sees title & close button
    showControls();
  }, []);

  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [hoveredBtn, setHoveredBtn] = useState(null);

  const fetchCommentCount = useCallback(async () => {
    try {
      const res = await API.get(`/api/comments/count/${animeId}`, {
        params: { episodeNum: currentEpisodeNumber }
      });
      if (res.data.success) {
        setCommentCount(res.data.count);
      }
    } catch (err) {
      console.error("Failed to fetch comment count:", err);
    }
  }, [animeId, currentEpisodeNumber]);

  useEffect(() => {
    fetchCommentCount();
  }, [fetchCommentCount]);

  // Open comments modal automatically if arrived via a Notification interaction
  useEffect(() => {
    if (route.params?.scrollToComments) {
      setTimeout(() => setShowComments(true), 500); // Wait for the player to mount smoothly
    }
  }, [route.params?.scrollToComments]);

  const isVideoFile = (url) => {
    if (!url) return false;
    // Standard video formats + HLS (m3u8) + Kwik Direct MP4
    return url.match(/\.(mp4|mkv|webm|ogv|m3u8)$/i) ||
      [".mp4", ".m3u8", ".mkv", ".webm"].some(ext => url.toLowerCase().includes(ext)) ||
      url.includes('kwik.cx/v/');
  };

  const renderTooltip = (btnKey, text) => {
    if (hoveredBtn !== btnKey) return null;
    return (
      <View style={styles.tooltip}>
        <View style={styles.tooltipArrow} />
        <Text style={styles.tooltipText}>{text}</Text>
      </View>
    );
  };

  const isEmbedPage = (url) => {
    if (!url || isVideoFile(url)) return false;
    return ["vibeplayer", "otakuhg", "otakuvid", "myvidplay", "upnvids", "gogoanime", "gogocdn",
      "dood", "mp4upload", "fembed", "mcloud", "/embed/", "/e/", "/player/", "/play/", "/watch/", "kwik.cx/f/", "kwik.cx/e/"]
      .some(p => url.toLowerCase().includes(p));
  };

  const buildStreamUrl = (rawUrl) => {
    if (Platform.OS === "web") {
      return `${process.env.EXPO_PUBLIC_API_URL}/api/anime/stream?url=${encodeURIComponent(rawUrl)}&token=${user?.token || ''}`;
    }
    return rawUrl;
  };

  const pickAndLoadSource = (epData = currentEpisodeData, epUrl = currentEpisodeUrl) => {
    console.log("[Player] 🔍 Picking source. Platform:", Platform.OS);
    if (isOffline) {
      console.log("[Player] 📦 Offline mode. Using local file:", epUrl);
      setUseWebView(false);
      setVideoUrl(epUrl);
      return;
    }

    const videoSrc = epData?.videoSources?.find(s => isVideoFile(s.url || s));
    const embedSrc = epData?.videoSources?.find(s => isEmbedPage(s.url || s));

    console.log("[Player] 🔎 Discovery:", {
      hasVideo: !!videoSrc,
      hasEmbed: !!embedSrc,
      hasIframe: !!epData?.iframe,
      videoUrl: videoSrc?.url || videoSrc
    });

    // On Web, prioritize iframes/embeds due to strict CORS and HLS proxying limitations.
    if (Platform.OS === "web") {
      if (epData?.iframe || embedSrc) {
        const url = epData.iframe || embedSrc?.url || embedSrc;
        console.log("[Player] 🌐 Web: Using WebView for embed:", url);
        setUseWebView(true);
        setWebViewUrl(url);
        return;
      }
      if (videoSrc) {
        const url = buildStreamUrl(videoSrc.url || videoSrc);
        console.log("[Player] 🌐 Web: Falling back to direct video proxy (experimental):", url);
        setUseWebView(false);
        setVideoUrl(url);
        return;
      }
    } else {
      // On Mobile (Android/iOS), prioritize native direct video streams for better performance.
      if (videoSrc) {
        const url = buildStreamUrl(videoSrc.url || videoSrc);
        console.log("[Player] 📱 Mobile: Using native direct stream:", url);
        setUseWebView(false);
        setVideoUrl(url);
        return;
      }
      if (embedSrc || epData?.iframe) {
        const url = embedSrc?.url || embedSrc || epData.iframe;
        console.log("[Player] 📱 Mobile: Using WebView for embed:", url);
        setUseWebView(true);
        setWebViewUrl(url);
        return;
      }
    }

    if (epUrl) {
      console.log("[Player] ⚠️ No sources. Falling back to url:", epUrl);
      if (isVideoFile(epUrl)) {
        setUseWebView(false);
        setVideoUrl(buildStreamUrl(epUrl));
      } else {
        setUseWebView(true);
        setWebViewUrl(epUrl);
      }
      return;
    }
    console.error("[Player] ❌ No playable source found!");
    setError("No playable source found for this episode.");
    setPlayerLoading(false);
  };

  const handleVideoError = useCallback((e) => {
    console.log("❌ [Player] Video Error:", e?.error || e?.nativeEvent || e);
    setPlayerLoading(false);
    
    // If native playback fails, fall back to the actual HTML iframe player in WebView
    const fallbackUrl = currentEpisodeData?.iframe || currentEpisodeUrl;
    if (Platform.OS !== "web" && fallbackUrl) {
      console.log("[Player] Falling back to WebView for embed iframe:", fallbackUrl);
      setUseWebView(true);
      setWebViewUrl(fallbackUrl);
      setVideoUrl(null);
      setPlayerLoading(true);
      return;
    }
    setError("Playback failed. Try opening in browser.");
  }, [currentEpisodeData, currentEpisodeUrl]);

  const openInBrowser = useCallback(() => {
    const url = webViewUrl || videoUrl || currentEpisodeUrl;
    if (!url) return;
    Platform.OS === "web" ? window.open(url, "_blank") : WebBrowser.openBrowserAsync(url);
  }, [webViewUrl, videoUrl, currentEpisodeUrl]);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const onMarkFinished = useCallback(async () => {
    wasFinishedRef.current = true;
    console.log("[Player] Manual finish. Cleaning up...");
    if (user?.email && animeId) {
      API.delete("/api/anime/continue-watching", {
        data: { email: user.email, animeId }
      }).catch(() => { });
    }
    Alert.alert("Success", "This episode has been marked as finished and removed from your Home screen.");
    goBack();
  }, [user, animeId, goBack]);

  const onReportVideo = useCallback(() => {
    Alert.alert(
      "Report Broken Video",
      "Is this video not playing or buffering endlessly? We can try to fix it.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Report", 
          style: "destructive",
          onPress: async () => {
            try {
              const res = await API.post("/api/anime/report-video", {
                animeId,
                episodeNum: currentEpisodeNumber
              });
              if (res.data?.success) {
                Alert.alert("Reported", "Thanks! We've cleared the cache. Please try reloading the page in a moment.");
              } else {
                Alert.alert("Error", "Could not report video right now.");
              }
            } catch (err) {
              Alert.alert("Error", "Failed to connect to server.");
            }
          }
        }
      ]
    );
  }, [animeId, currentEpisodeNumber]);

  const handleAdFinished = useCallback(() => setShowAd(false), []);

  const [selectedSourceLabel, setSelectedSourceLabel] = useState("Auto");

  const handleSourceSelect = (src) => {
    setPlayerLoading(true);
    setError(null);
    if (src.isIframe) {
      setSelectedSourceLabel(src.label);
      setUseWebView(true);
      setWebViewUrl(src.url);
      setVideoUrl(null);
    } else {
      setSelectedSourceLabel(src.label);
      if (isEmbedPage(src.url)) {
        setUseWebView(true);
        setWebViewUrl(src.url);
        setVideoUrl(null);
      } else {
        setUseWebView(false);
        setVideoUrl(buildStreamUrl(src.url));
        setWebViewUrl(null);
      }
    }
  };

  const handleEpisodeSelect = async (ep) => {
    try {
      setShowEpisodesModal(false);
      setPlayerLoading(true);
      setError(null);
      setVideoUrl(null);
      setWebViewUrl(null);
      setSelectedSourceLabel("Auto");
      
      const res = await API.get(`/api/anime/episode-info?url=${encodeURIComponent(ep.url)}`);
      if (res.data?.success) {
        setCurrentEpisodeUrl(ep.url);
        setCurrentEpisodeNumber(ep.number);
        setCurrentEpisodeData(res.data);
        
        // Reset playback tracker
        playbackRef.current = { position: 0, duration: 0 };
        wasFinishedRef.current = false;
        
        // Pick new sources
        pickAndLoadSource(res.data, ep.url);
        
        // Sync watch history for this new episode immediately
        if (user?.email && animeId) {
          API.post("/api/anime/continue-watching", {
            email: user.email,
            animeId: animeId,
            title: animeTitle || "Unknown Anime",
            image: animeImage || "",
            episodeUrl: ep.url,
            episodeNumber: String(ep.number),
            progress: 0,
            duration: 0,
          }).catch(() => { });
        }
      } else {
        Alert.alert("Error", res.data?.error || "Failed to load episode info");
        setPlayerLoading(false);
      }
    } catch (err) {
      Alert.alert("Error", "Could not switch episode. Please try again.");
      setPlayerLoading(false);
    }
  };

  useEffect(() => {
    if (animeId && !isOffline) {
      const fetchEpisodes = async () => {
        try {
          const res = await API.get(`/api/anime/details/${animeId}`);
          if (res.data?.success) {
            setAnimeDetails(res.data);
            if (res.data.episodes) {
              setEpisodes(res.data.episodes);
            }
          }
        } catch (err) {
          console.error("Failed to fetch episodes list:", err);
        }
      };
      fetchEpisodes();
    }
  }, [animeId, isOffline]);

  const headerTitle = animeTitle
    ? `${animeTitle}  ·  Ep ${currentEpisodeNumber}`
    : title || "Now Playing";

  const availableSources = [];
  
  if (currentEpisodeData?.videoSources) {
    currentEpisodeData.videoSources.forEach((s, idx) => {
      availableSources.push({
        ...s,
        label: s.quality || `Direct ${idx + 1}`,
        isIframe: false,
        url: s.url || s
      });
    });
  }

  if (currentEpisodeData?.servers && Array.isArray(currentEpisodeData.servers)) {
    currentEpisodeData.servers.forEach((srv, idx) => {
      if (!availableSources.some(s => s.url === srv.url)) {
        availableSources.push({
          url: srv.url,
          label: srv.label || `Server ${idx + 1}`,
          isIframe: true
        });
      }
    });
  }

  if (currentEpisodeData?.iframe && !availableSources.some(s => s.url === currentEpisodeData.iframe)) {
    availableSources.push({
      url: currentEpisodeData.iframe,
      label: "Main Stream",
      isIframe: true
    });
  }

  const renderSourceSelector = () => {
    if (availableSources.length <= 1) return null;
    return (
      <View style={styles.sourceSelectorContainer}>
        <Text style={styles.sourceSelectorLabel}>Server:</Text>
        <View style={styles.sourceWrap}>
          {availableSources.map((src, idx) => {
            const isActive = selectedSourceLabel === src.label || (selectedSourceLabel === "Auto" && idx === 0);
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.sourceBtn, isActive && styles.sourceBtnActive]}
                onPress={() => handleSourceSelect(src)}
              >
                <Text style={[styles.sourceBtnText, isActive && styles.sourceBtnTextActive]}>
                  {src.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderDownloadSection = () => {
    if (isOffline) return null;

    const isDownloaded = !!downloadedEps[currentEpisodeNumber];
    const downloadProgress = downloadingEps[currentEpisodeNumber];
    const isDownloading = downloadProgress !== undefined;

    return (
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600", marginRight: 12 }}>
          Offline:
        </Text>
        
        {isDownloaded ? (
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(16,185,129,0.12)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" }}>
            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
            <Text style={{ color: "#10b981", fontSize: 13, fontWeight: "600", marginLeft: 6 }}>Downloaded</Text>
          </View>
        ) : isDownloading ? (
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(250,204,21,0.12)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "rgba(250,204,21,0.3)" }}>
            <Ionicons name="cloud-download" size={16} color="#facc15" />
            <Text style={{ color: "#facc15", fontSize: 13, fontWeight: "600", marginLeft: 6 }}>
              Downloading {Math.round(downloadProgress * 100)}%
            </Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
            onPress={() => handleDownloadEpisode(currentEpisodeNumber, currentEpisodeUrl)}
          >
            <Ionicons name="cloud-download-outline" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", marginLeft: 6 }}>Download</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Player body ───────────────────────────────────────────────────────────────
  const renderPlayerBody = () => {
    if (error) {
      return (
        <View style={styles.errorBox}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle" size={42} color={C.primary} />
          </View>
          <Text style={styles.errorTitle}>Playback Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.browserBtn} onPress={openInBrowser}>
            <LinearGradient
              colors={["#ffffff", "#cccccc"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.browserBtnInner}
            >
              <Ionicons name="open-outline" size={15} color="white" />
              <Text style={styles.browserBtnText}>Open in Browser</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }



    return (
      // Tap anywhere on the player to toggle controls
      <TouchableOpacity
        style={[styles.playerArea, { opacity: showAd ? 0.01 : 1 }]}
        activeOpacity={1}
        onPress={toggleControls}
        disabled={showAd}
      >
        {playerLoading && (
          <View style={styles.loadingOverlay}>
            <DotCircleLoader size={54} color={C.primary} />
            <Text style={styles.loadingText}>Loading player…</Text>
          </View>
        )}

        {useWebView && webViewUrl ? (
          Platform.OS === "web" ? (
            <iframe
              src={webViewUrl}
              style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#000" }}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              title="Video Player"
              onLoad={() => setPlayerLoading(false)}
            />
          ) : (
            <CustomWebView
              source={{ uri: webViewUrl }}
              style={{ flex: 1, backgroundColor: "#000" }}
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              onLoadEnd={() => setPlayerLoading(false)}
              onError={() => { setPlayerLoading(false); handleVideoError(); }}
            />
          )
        ) : videoUrl ? (
          <Video
            ref={videoRef}
            source={{ 
              uri: videoUrl,
              ...(videoUrl.startsWith('http') && {
                headers: {
                  "Referer": videoUrl.includes("kwik.cx") 
                    ? "https://kwik.cx/" 
                    : "https://embtaku.com/",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
              })
            }}
            style={styles.video}
            useNativeControls
            resizeMode="contain"
            onLoad={() => setPlayerLoading(false)}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && status.durationMillis > 0) {
                // Tracking actual watch time (only when playing)
                if (status.isPlaying && !isPlayingRef.current) {
                  isPlayingRef.current = true;
                  lastPlayStartRef.current = Date.now();
                } else if (!status.isPlaying && isPlayingRef.current) {
                  isPlayingRef.current = false;
                  if (lastPlayStartRef.current) {
                    totalWatchTimeRef.current += (Date.now() - lastPlayStartRef.current);
                    lastPlayStartRef.current = null;
                  }
                }

                // Track playback position for progress sync
                const posSec = status.positionMillis / 1000;
                const durSec = status.durationMillis / 1000;
                playbackRef.current = { position: posSec, duration: durSec };

                // Sync progress to server every 15 seconds
                const now = Date.now();
                if (user?.email && animeId && now - lastSyncRef.current > 15000) {
                  lastSyncRef.current = now;
                  API.post("/api/anime/continue-watching", {
                    email: user.email,
                    animeId,
                    title: animeTitle || "Unknown Anime",
                    image: animeImage || "",
                    episodeUrl: currentEpisodeUrl,
                    episodeNumber: String(currentEpisodeNumber || "1"),
                    progress: Math.round(posSec),
                    duration: Math.round(durSec),
                  }).catch(() => {});
                }

                // 🏁 Threshold: Trigger cleanup if reached 98% OR within last 20 seconds
                const isNearlyFinished =
                  status.positionMillis >= status.durationMillis * 0.98 ||
                  (status.durationMillis - status.positionMillis) < 20000;

                if ((status.didJustFinish || isNearlyFinished) && !wasFinishedRef.current) {
                  wasFinishedRef.current = true;
                  console.log("[Player] Episode finished (threshold reached). Cleaning up...");
                  if (user?.email && animeId) {
                    API.delete("/api/anime/continue-watching", {
                      data: { email: user.email, animeId }
                    }).catch(() => { });
                  }
                }
              }
            }}
            onError={handleVideoError}
            shouldPlay={!showAd}
          />
        ) : (
          <View style={styles.preparingBox}>
            <DotCircleLoader size={54} color={C.primary} />
            <Text style={styles.loadingText}>Preparing player…</Text>
          </View>
        )}

        {/* ── Animated controls overlay ── */}
        <PlayerControls
          visible={controlsVisible}
          title={headerTitle}
          onClose={goBack}
          onOpenBrowser={openInBrowser}
          controlsAnim={controlsAnim}
        />
      </TouchableOpacity>
    );
  };

  // ── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.screen, { opacity: cardAnim }]}>
      <StatusBar hidden />

      {/* ── Sleek Fullscreen Top Navigation Bar ── */}
      <View style={[styles.fullscreenHeader, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backButtonWrap} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerInfoContainer}>
          <Text style={styles.fullscreenHeaderTitle} numberOfLines={1}>
            {animeTitle || title || "Now Playing"}
          </Text>
          <Text style={styles.fullscreenHeaderSubtitle}>
            Episode {currentEpisodeNumber}
          </Text>
        </View>
        
        <View style={styles.headerRight}>
          <View style={styles.iconBtnWrap}>
            <TouchableOpacity
              onPress={onReportVideo}
              style={[styles.iconBtn, { borderColor: 'rgba(225,29,72,0.4)' }]}
              accessibilityLabel="Report Broken Video"
              onMouseEnter={() => setHoveredBtn('report')}
              onMouseLeave={() => setHoveredBtn(null)}
            >
              <Ionicons name="warning-outline" size={17} color="#e11d48" />
            </TouchableOpacity>
            {renderTooltip('report', 'Report Broken Video')}
          </View>

          <View style={styles.iconBtnWrap}>
            <TouchableOpacity
              onPress={onMarkFinished}
              style={styles.iconBtn}
              accessibilityLabel="Mark as Finished"
              onMouseEnter={() => setHoveredBtn('finish')}
              onMouseLeave={() => setHoveredBtn(null)}
            >
              <Ionicons name="checkmark-circle-outline" size={19} color={C.dim} />
            </TouchableOpacity>
            {renderTooltip('finish', 'Mark as Finished')}
          </View>


        </View>
      </View>

      {/* ── Dynamic Layout Body ── */}
      {isWidescreen ? (
        /* ── WIDESCREEN CINEMATIC SIDE-BY-SIDE LAYOUT ── */
        <View style={styles.widescreenContainer}>
          {/* Left Column: Player + Metadata Info Card */}
          <ScrollView showsVerticalScrollIndicator={false} style={styles.widescreenLeftColumn}>
            <Animated.View style={{ width: playerWidth, height: finalPlayerHeight, position: "relative", backgroundColor: "#000", borderRadius: 16, overflow: "hidden", transform: [{ scale: cardScale }] }}>
              {renderPlayerBody()}
              {showAd && <AdOverlay onAdFinished={handleAdFinished} />}
            </Animated.View>
            <View style={styles.metaCard}>
              {renderSourceSelector()}
              {renderDownloadSection()}
            </View>
          </ScrollView>

          {/* Right Column: Dynamic Sidebar (Tabs for Episodes & Comments) */}
          <View style={styles.widescreenRightColumn}>
            <View style={styles.sidebarTabsHeader}>
              <TouchableOpacity 
                onPress={() => setActiveTab("episodes")}
                style={[styles.sidebarTabBtn, activeTab === "episodes" && styles.sidebarTabBtnActive]}
              >
                <Text style={[styles.sidebarTabBtnText, activeTab === "episodes" && styles.sidebarTabBtnTextActive]}>
                  Episodes ({episodes.length})
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setActiveTab("comments")}
                style={[styles.sidebarTabBtn, activeTab === "comments" && styles.sidebarTabBtnActive]}
              >
                <Text style={[styles.sidebarTabBtnText, activeTab === "comments" && styles.sidebarTabBtnTextActive]}>
                  Discussion
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }} style={styles.sidebarContentScroll}>
              {activeTab === "episodes" ? (
                <View style={styles.episodeListContainer}>
                  {episodes.map((ep) => {
                    const isActive = String(ep.number) === String(currentEpisodeNumber);
                    return (
                      <TouchableOpacity
                        key={ep.id || ep.number}
                        onPress={() => handleEpisodeSelect(ep)}
                        style={[
                          styles.episodeItemRow,
                          isActive && styles.episodeItemRowActive
                        ]}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.episodeItemNumberContainer, isActive && styles.episodeItemNumberContainerActive]}>
                          <Text style={[styles.episodeItemNumberText, isActive && styles.episodeItemActiveText]}>
                            Ep {ep.number}
                          </Text>
                        </View>
                        <Text style={[styles.episodeItemTitleText, isActive && styles.episodeItemActiveText]} numberOfLines={1}>
                          {ep.title || `Episode ${ep.number}`}
                        </Text>
                        {isActive && (
                          <Ionicons name="play" size={14} color="#000" style={styles.episodePlayIcon} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <CommentSection
                  animeId={animeId}
                  episodeNum={currentEpisodeNumber}
                  onCommentAdded={fetchCommentCount}
                />
              )}
            </ScrollView>
          </View>
        </View>
      ) : (
        /* ── MOBILE VERTICAL STACKED CINEMATIC LAYOUT ── */
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.mobileContainer}
          contentContainerStyle={{ paddingBottom: insets.bottom + (width < 768 ? 110 : 24) }}
        >
          <Animated.View style={{ width: playerWidth, height: finalPlayerHeight, position: "relative", backgroundColor: "#000", transform: [{ scale: cardScale }] }}>
            {renderPlayerBody()}
            {showAd && <AdOverlay onAdFinished={handleAdFinished} />}
          </Animated.View>

          {/* Anime Info details block */}
          <View style={styles.mobileMetaCard}>
            {renderSourceSelector()}
            {renderDownloadSection()}
          </View>

          {/* Dynamic tabs selector inside mobile page flow */}
          <View style={styles.mobileTabsHeader}>
            <TouchableOpacity 
              onPress={() => setActiveTab("episodes")}
              style={[styles.mobileTabBtn, activeTab === "episodes" && styles.mobileTabBtnActive]}
            >
              <Text style={[styles.mobileTabBtnText, activeTab === "episodes" && styles.mobileTabBtnTextActive]}>
                Episodes ({episodes.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setActiveTab("comments")}
              style={[styles.mobileTabBtn, activeTab === "comments" && styles.mobileTabBtnActive]}
            >
              <Text style={[styles.mobileTabBtnText, activeTab === "comments" && styles.mobileTabBtnTextActive]}>
                Comments ({commentCount})
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mobileTabContentContainer}>
            {activeTab === "episodes" ? (
              <View style={styles.episodeListContainer}>
                {episodes.map((ep) => {
                  const isActive = String(ep.number) === String(currentEpisodeNumber);
                  return (
                    <TouchableOpacity
                      key={ep.id || ep.number}
                      onPress={() => handleEpisodeSelect(ep)}
                      style={[
                        styles.episodeItemRow,
                        isActive && styles.episodeItemRowActive
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.episodeItemNumberContainer, isActive && styles.episodeItemNumberContainerActive]}>
                        <Text style={[styles.episodeItemNumberText, isActive && styles.episodeItemActiveText]}>
                          Ep {ep.number}
                        </Text>
                      </View>
                      <Text style={[styles.episodeItemTitleText, isActive && styles.episodeItemActiveText]} numberOfLines={1}>
                        {ep.title || `Episode ${ep.number}`}
                      </Text>
                      {isActive && (
                        <Ionicons name="play" size={14} color="#000" style={styles.episodePlayIcon} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <CommentSection
                animeId={animeId}
                episodeNum={currentEpisodeNumber}
                onCommentAdded={fetchCommentCount}
              />
            )}
          </View>
        </ScrollView>
      )}
    </Animated.View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#080808",
  },
  
  // ── Fullscreen Header ──
  fullscreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#0d0d0d",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    zIndex: 100,
  },
  backButtonWrap: {
    marginRight: 16,
    padding: 4,
  },
  headerInfoContainer: {
    flex: 1,
  },
  fullscreenHeaderTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  fullscreenHeaderSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtnWrap: {
    position: "relative",
    alignItems: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Widescreen layout ──
  widescreenContainer: {
    flex: 1,
    flexDirection: "row",
    padding: 20,
    gap: 20,
  },
  widescreenLeftColumn: {
    flex: 3,
  },
  widescreenRightColumn: {
    width: 340,
    backgroundColor: "#101010",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },

  // ── Mobile layout ──
  mobileContainer: {
    flex: 1,
  },
  mobileMetaCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  mobileDetailsContainer: {
    marginTop: 10,
  },
  mobileDetailsSynopsis: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Anime Info Card (Widescreen) ──
  metaCard: {
    backgroundColor: "#101010",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 20,
    marginTop: 20,
  },
  sourceSelectorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  sourceSelectorLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
    marginRight: 12,
  },
  sourceWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sourceBtn: {
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sourceBtnActive: {
    backgroundColor: "rgba(250,204,21,0.15)",
    borderColor: "#facc15",
  },
  sourceBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
  },
  sourceBtnTextActive: {
    color: "#facc15",
  },
  metaTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  metaAnimeTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    flex: 1,
    marginRight: 12,
  },
  metaEpisodeBadge: {
    color: "#facc15",
    fontSize: 14,
    fontWeight: "700",
    backgroundColor: "rgba(250,204,21,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  detailsContentContainer: {
    flexDirection: "row",
    gap: 16,
  },
  detailsPoster: {
    width: 110,
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  detailsTextCol: {
    flex: 1,
    gap: 12,
  },
  detailsBadgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  statusBadge: {
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "700",
  },
  typeBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  genresRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  genreBadge: {
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  genreBadgeText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "600",
  },
  detailsSynopsis: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    lineHeight: 19,
  },
  detailsLoadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    gap: 10,
  },
  detailsLoadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },

  // ── Widescreen Tabs Header ──
  sidebarTabsHeader: {
    flexDirection: "row",
    backgroundColor: "#161616",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  sidebarTabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  sidebarTabBtnActive: {
    borderColor: "#facc15",
  },
  sidebarTabBtnText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontWeight: "600",
  },
  sidebarTabBtnTextActive: {
    color: "#facc15",
    fontWeight: "700",
  },
  sidebarContentScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // ── Mobile Tabs Header ──
  mobileTabsHeader: {
    flexDirection: "row",
    backgroundColor: "#101010",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  mobileTabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  mobileTabBtnActive: {
    borderColor: "#facc15",
  },
  mobileTabBtnText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
  },
  mobileTabBtnTextActive: {
    color: "#facc15",
    fontWeight: "700",
  },
  mobileTabContentContainer: {
    padding: 16,
  },

  // ── Video Controls Overlay ──
  playerArea: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
  },
  video: {
    flex: 1,
    backgroundColor: "#000",
  },
  preparingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#000",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(11,12,16,0.88)",
    zIndex: 5,
    gap: 12,
  },
  loadingText: {
    color: "#888",
    fontSize: 13,
  },

  // ── Video Action Controls ──
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: "space-between",
  },
  controlsTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 10,
  },
  controlsTitle: {
    flex: 1,
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "600",
  },
  controlsTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  controlBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlBtnClose: {
    backgroundColor: "rgba(220,20,60,0.25)",
    borderColor: "rgba(220,20,60,0.4)",
  },
  controlsCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  controlsCenterIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Tooltips ──
  tooltip: {
    position: "absolute",
    top: 42,
    backgroundColor: "rgba(32,32,32,0.95)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 999,
    minWidth: 130,
    alignItems: "center",
  },
  tooltipArrow: {
    position: "absolute",
    top: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderLeftColor: "transparent",
    borderRightWidth: 6,
    borderRightColor: "transparent",
    borderBottomWidth: 6,
    borderBottomColor: "rgba(32,32,32,0.95)",
  },
  tooltipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },

  // ── Errors ──
  errorBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 10,
    backgroundColor: "#080808",
  },
  errorIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  errorTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  errorText: {
    color: "#888888",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  browserBtn: {
    borderRadius: 30,
    overflow: "hidden",
    marginTop: 6,
  },
  browserBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  browserBtnText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "700",
  },

  // ── Episodes Row List ──
  episodeListContainer: {
    gap: 8,
    marginTop: 6,
  },
  episodeItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    gap: 12,
  },
  episodeItemRowActive: {
    backgroundColor: "#facc15",
    borderColor: "#eab308",
  },
  episodeItemNumberContainer: {
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  episodeItemNumberContainerActive: {
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  episodeItemNumberText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  episodeItemTitleText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  episodeItemActiveText: {
    color: "#000000",
    fontWeight: "700",
  },
  episodePlayIcon: {
    marginLeft: "auto",
  }
});

// ─── AD STYLES ────────────────────────────────────────────────────────────────
const adStyles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000", zIndex: 50 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  labelWrap: {
    position: "absolute", top: 12, left: 12,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  adBadge: { backgroundColor: "#facc15", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3 },
  adBadgeText: { color: "#000", fontSize: 10, fontWeight: "800" },
  adLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11, maxWidth: 200 },
  skipArea: { position: "absolute", bottom: 14, right: 14, alignItems: "flex-end", gap: 6 },
  timeLeft: { color: "rgba(255,255,255,0.6)", fontSize: 11 },
  skipBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#facc15",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4,
  },
  skipBtnText: { color: "#000", fontSize: 13, fontWeight: "700" },
  skipSoon: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4,
  },
  skipSoonText: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600" },
  ringWrap: { width: RING_SIZE, height: RING_SIZE + 18, alignItems: "center" },
  ringCenter: {
    position: "absolute", top: 0,
    width: RING_SIZE, height: RING_SIZE,
    justifyContent: "center", alignItems: "center",
  },
  ringCountdown: { color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: "700" },
  ringSkipLabel: { position: "absolute", bottom: 0, color: "#facc15", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  loadingText: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 6 },
});