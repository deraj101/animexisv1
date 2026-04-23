import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Dimensions,
  Platform,
  Animated,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
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

const { width } = Dimensions.get("window");
const MODAL_W = Math.min(width - 24, 900);
const PLAYER_H = Math.round(MODAL_W * (9 / 16));

// ─── PLAYER SCREEN ────────────────────────────────────────────────────────────
export default function PlayerScreen({ route, navigation }) {
  const { video, title, animeTitle, episodeNumber, episodeTitle, episodeData, animeId, animeImage } = route.params;
  const { user } = useAuth();

  const [playerLoading, setPlayerLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState(null);
  const [webViewUrl, setWebViewUrl] = useState(null);
  const [useWebView, setUseWebView] = useState(false);
  const [error, setError] = useState(null);
  const [showAd, setShowAd] = useState(user?.subscription?.toLowerCase() !== 'premium');
  // Controls visibility state
  const [controlsVisible, setControlsVisible] = useState(false);

  const videoRef = useRef(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.93)).current;
  const controlsAnim = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef(null);
  const watchStartRef = useRef(null);
  const wasFinishedRef = useRef(false);

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
          episodeUrl: video,
          episodeNumber: String(episodeNumber || "1")
        }).catch(() => { });
      }
    }
  }, [showAd, user?.email, animeId]);

  useEffect(() => {
    return () => {
      if (!watchStartRef.current || !user?.email) return;
      
      const elapsed = Math.round((Date.now() - watchStartRef.current) / 1000);
      if (elapsed >= 1) {
        // Record watch time statistics (ALWAYS, even if finished)
        Stats.addWatchTime(user.email, elapsed);
      }

      // Record 'Continue Watching' progress (ONLY if not already marked finished)
      if (animeId && !wasFinishedRef.current) {
        API.post("/api/anime/continue-watching", {
          email: user.email,
          animeId: animeId,
          title: animeTitle || "Unknown Anime",
          image: animeImage || "",
          episodeUrl: video,
          episodeNumber: String(episodeNumber || "1")
        }).catch(() => { });
      }
    };
  }, []);

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
        params: { episodeNum: episodeNumber }
      });
      if (res.data.success) {
        setCommentCount(res.data.count);
      }
    } catch (err) {
      console.error("Failed to fetch comment count:", err);
    }
  }, [animeId, episodeNumber]);

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
    // Standard video formats + HLS (m3u8)
    return url.match(/\.(mp4|mkv|webm|ogv|m3u8)$/i) ||
      [".mp4", ".m3u8", ".mkv", ".webm"].some(ext => url.toLowerCase().includes(ext));
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

  const isEmbedPage = (url) =>
    ["vibeplayer", "otakuhg", "otakuvid", "myvidplay", "upnvids", "gogoanime", "gogocdn",
      "dood", "mp4upload", "fembed", "mcloud", "/embed/", "/e/", "/v/", "/player/", "/play/", "/watch/"]
      .some(p => url.toLowerCase().includes(p));

  const buildStreamUrl = (rawUrl) => {
    if (Platform.OS === "web") {
      return `${process.env.EXPO_PUBLIC_API_URL}/api/anime/stream?url=${encodeURIComponent(rawUrl)}`;
    }
    return rawUrl;
  };

  const pickAndLoadSource = () => {
    const videoSrc = episodeData?.videoSources?.find(s => isVideoFile(s.url || s));
    if (videoSrc) {
      setUseWebView(false);
      setVideoUrl(buildStreamUrl(videoSrc.url || videoSrc));
      return;
    }
    const embedSrc = episodeData?.videoSources?.find(s => isEmbedPage(s.url || s));
    if (embedSrc) {
      setUseWebView(true);
      setWebViewUrl(embedSrc.url || embedSrc);
      return;
    }
    if (episodeData?.iframe) {
      setUseWebView(true);
      setWebViewUrl(episodeData.iframe);
      return;
    }
    if (video) {
      if (isVideoFile(video)) {
        setUseWebView(false);
        setVideoUrl(buildStreamUrl(video));
      } else {
        setUseWebView(true);
        setWebViewUrl(video);
      }
      return;
    }
    setError("No playable source found for this episode.");
    setPlayerLoading(false);
  };

  const handleVideoError = useCallback(() => {
    setPlayerLoading(false);
    if (Platform.OS !== "web" && videoUrl) {
      setUseWebView(true);
      setWebViewUrl(videoUrl);
      setVideoUrl(null);
      setPlayerLoading(true);
      return;
    }
    setError("Playback failed. Try opening in browser.");
  }, [videoUrl]);

  const openInBrowser = useCallback(() => {
    const url = webViewUrl || videoUrl || video;
    if (!url) return;
    Platform.OS === "web" ? window.open(url, "_blank") : WebBrowser.openBrowserAsync(url);
  }, [webViewUrl, videoUrl, video]);

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

  const handleAdFinished = useCallback(() => setShowAd(false), []);

  const headerTitle = animeTitle
    ? `${animeTitle}  ·  Ep ${episodeNumber}${episodeTitle ? `: ${episodeTitle}` : ""}`
    : title || "Now Playing";

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
            source={{ uri: videoUrl }}
            style={styles.video}
            useNativeControls
            resizeMode="contain"
            onLoad={() => setPlayerLoading(false)}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && status.durationMillis > 0) {
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
    <View style={styles.screen}>
      <StatusBar hidden />
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={goBack} />

      <Animated.View style={[styles.card, { opacity: cardAnim, transform: [{ scale: cardScale }] }]}>
        {/* ── Static header (always visible) ── */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{headerTitle}</Text>
          <View style={styles.headerRight}>
            <View style={styles.iconBtnWrap}>
              <TouchableOpacity
                onPress={() => setShowComments(true)}
                style={styles.iconBtn}
                accessibilityLabel="View Comments"
                onMouseEnter={() => setHoveredBtn('comments')}
                onMouseLeave={() => setHoveredBtn(null)}
              >
                <Ionicons name="chatbubble-outline" size={17} color={C.dim} />
                {commentCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{commentCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {renderTooltip('comments', 'View Comments')}
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

            <View style={styles.iconBtnWrap}>
              <TouchableOpacity
                onPress={openInBrowser}
                style={styles.iconBtn}
                accessibilityLabel="Open in Browser"
                onMouseEnter={() => setHoveredBtn('browser')}
                onMouseLeave={() => setHoveredBtn(null)}
              >
                <Ionicons name="open-outline" size={17} color={C.dim} />
              </TouchableOpacity>
              {renderTooltip('browser', 'Open in Browser')}
            </View>

            <View style={styles.iconBtnWrap}>
              <TouchableOpacity
                onPress={goBack}
                style={styles.iconBtn}
                accessibilityLabel="Close Player"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onMouseEnter={() => setHoveredBtn('close')}
                onMouseLeave={() => setHoveredBtn(null)}
              >
                <Ionicons name="close" size={19} color={C.white} />
              </TouchableOpacity>
              {renderTooltip('close', 'Close Player')}
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={{ height: PLAYER_H }}>
            {renderPlayerBody()}
            {showAd && <AdOverlay onAdFinished={handleAdFinished} />}
          </View>
        </View>
      </Animated.View>

      {/* ── COMMENTS MODAL OVERLAY ── */}
      <Modal
        visible={showComments}
        transparent
        animationType="slide"
        onRequestClose={() => setShowComments(false)}
      >
        <View style={styles.commentsOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowComments(false)}
          />
          <View style={styles.commentsCard}>
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>Discussion</Text>
              <TouchableOpacity onPress={() => setShowComments(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={C.white} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <CommentSection
                animeId={animeId}
                episodeNum={episodeNumber}
                onCommentAdded={fetchCommentCount}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: MODAL_W,
    backgroundColor: C.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    zIndex: 10,
    boxShadow: '0 16px 36px rgba(0,0,0,0.7)',
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.border,
    zIndex: 100, // Ensure header (and tooltips) are above cardBody
  },
  cardTitle: { color: C.white, fontSize: 14, fontWeight: "600", flex: 1, marginRight: 10 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1, borderColor: C.border,
    justifyContent: "center", alignItems: "center",
  },
  cardBody: { backgroundColor: "#000", maxHeight: 650 },

  playerArea: { flex: 1, backgroundColor: "#000", position: "relative" },
  video: { flex: 1, backgroundColor: "#000" },
  preparingBox: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: C.bg },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(11,12,16,0.88)",
    zIndex: 5, gap: 12,
  },
  loadingText: { color: C.dim, fontSize: 13 },

  // ── Controls overlay ──
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
  controlsTopRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  controlBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    justifyContent: "center", alignItems: "center",
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
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },

  iconBtnWrap: { position: "relative", alignItems: "center" },
  tooltip: {
    position: "absolute",
    top: 42,
    backgroundColor: "rgba(32,32,32,0.95)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    zIndex: 999, // Extra safety
    minWidth: 130,
    alignItems: "center",
  },
  tooltipArrow: {
    position: "absolute",
    top: -6,
    width: 0, height: 0,
    borderLeftWidth: 6, borderLeftColor: "transparent",
    borderRightWidth: 6, borderRightColor: "transparent",
    borderBottomWidth: 6, borderBottomColor: "rgba(32,32,32,0.95)",
  },
  tooltipText: { color: "#fff", fontSize: 11, fontWeight: "600", whiteSpace: "nowrap" },

  errorBox: {
    flex: 1, justifyContent: "center", alignItems: "center",
    padding: 24, gap: 10, backgroundColor: C.bg,
  },
  errorIconWrap: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: C.primaryDim,
    borderWidth: 1, borderColor: C.primaryBorder,
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  errorTitle: { color: C.white, fontSize: 17, fontWeight: "700" },
  errorText: { color: C.dim, fontSize: 13, textAlign: "center", lineHeight: 19 },
  browserBtn: { borderRadius: 30, overflow: "hidden", marginTop: 6 },
  browserBtnInner: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 22, paddingVertical: 11,
  },
  browserBtnText: { color: "#000000", fontSize: 14, fontWeight: "700" },

  // ── Comments Modal ──
  commentsOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)"
  },
  commentsCard: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  commentsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: C.border
  },
  commentsTitle: {
    color: C.white,
    fontSize: 18,
    fontWeight: "700"
  },
  countBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: C.crimson,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.surface
  },
  countText: {
    color: C.white,
    fontSize: 9,
    fontWeight: "800"
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