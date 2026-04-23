import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Alert,
  ScrollView,
  Switch,
  TextInput,
  FlatList,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import { C } from "../theme";
import { Image } from "expo-image";
import * as FileSystem from 'expo-file-system'; // 📂 PROPER IMPORT
import PremiumBorder from "../components/PremiumBorder"; // 🎨 NEW
import AppFooter from "../components/AppFooter";
import * as Stats from "../services/Userstats";
import API from "../services/api";
import DotCircleLoader from "../components/DotCircleLoader";

const { width } = Dimensions.get("window");
const HERO_H = 270;
const AVATAR_SZ = 88;



// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = React.memo(function StatCard({ icon, value, label, anim }) {
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  return (
    <Animated.View style={[styles.statCard, { opacity: anim, transform: [{ translateY }] }]}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={16} color={C.crimson} />
      </View>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
});

// ─── ACHIEVEMENT BADGE ────────────────────────────────────────────────────────
const Badge = React.memo(function Badge({ icon, label, earned, anim }) {
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  return (
    <Animated.View style={[styles.badge, { opacity: anim, transform: [{ scale }] }]}>
      <LinearGradient
        colors={earned
          ? [C.crimsonTint, C.crimsonDim]
          : ["rgba(30,30,38,0.8)", "rgba(20,20,24,0.8)"]}
        style={styles.badgeGradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={[styles.badgeIconWrap, earned && styles.badgeIconWrapEarned]}>
          <Ionicons name={icon} size={20} color={earned ? C.crimson : C.dimmer} />
        </View>
        <Text style={[styles.badgeLabel, !earned && styles.badgeLabelDim]} numberOfLines={2}>
          {label}
        </Text>
        {!earned && (
          <View style={styles.badgeLock}>
            <Ionicons name="lock-closed" size={9} color={C.dimmer} />
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
});

// ─── SETTING ROW ──────────────────────────────────────────────────────────────
const SettingRow = React.memo(function SettingRow({ icon, label, sub, value, onToggle, last }) {
  return (
    <View style={[styles.settingRow, !last && styles.settingRowBorder]}>
      <View style={styles.settingIconWrap}>
        <Ionicons name={icon} size={16} color={C.crimson} />
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sub && <Text style={styles.settingSub}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: C.overlay, true: C.crimsonTint }}
        thumbColor={value ? C.crimson : C.dimmer}
        ios_backgroundColor={C.overlay}
      />
    </View>
  );
});

// ─── MENU ROW ─────────────────────────────────────────────────────────────────
const MenuRow = React.memo(function MenuRow({ icon, label, sub, onPress, danger, last }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, { toValue: 0.97, tension: 150, friction: 8, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, tension: 150, friction: 8, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        activeOpacity={1}
        style={[styles.menuRow, !last && styles.menuRowBorder]}
      >
        <View style={[styles.menuIconWrap, danger && styles.menuIconWrapDanger]}>
          <Ionicons name={icon} size={16} color={danger ? C.crimson : C.dim} />
        </View>
        <View style={styles.menuText}>
          <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
          {sub && <Text style={styles.menuSub} numberOfLines={1}>{sub}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={14} color={danger ? C.crimsonBorder : C.dimmer} />
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── SECTION WRAPPER ──────────────────────────────────────────────────────────
const Section = ({ title, children }) => (
  <View style={styles.section}>
    {title && (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionAccent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    )}
    <View>{children}</View>
  </View>
);


// ─── PROFILE SCREEN ───────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { user, signOut, updateUser } = useAuth();

  // Avatar
  const [avatarUri, setAvatarUri] = useState(user?.profile_image || null);
  const [picking, setPicking] = useState(false);

  // Username editing
  const [username, setUsername] = useState(user?.name || "");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [nameSaving, setNameSaving] = useState(false);
  const nameInputRef = useRef(null);

  // Live stats
  const [statsLoading, setStatsLoading] = useState(true);
  const [liveStats, setLiveStats] = useState({
    episodes: "—", watchTime: "—", favCount: "—", avgRating: "—",
  });
  const [usage, setUsage] = useState({ count: 0, limit: 20, subscription: 'free' });
  const [profileBorder, setProfileBorder] = useState(user?.profile_border || null); // 🎨 NEW
  const [borderSaving, setBorderSaving] = useState(false); // 🎨 NEW

  // Favorites list
  const [favorites, setFavorites] = useState([]);

  // Settings
  const [settings, setSettings] = useState({
    notifications: true,
    autoplay: true,
    hd: false,
    subtitles: true,
  });

  // Animations
  const heroAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const settAnim = useRef(new Animated.Value(0)).current;
  const menuAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // ── Load all data ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!user?.email) return;
    setStatsLoading(true);
    try {
      // 1. Load background details (isolated usage stats so it doesn't block the profile load)
      API.get("/api/auth/usage-status").then(res => {
        if (res.data?.success) {
          setUsage({
            count: res.data.count,
            limit: res.data.limit,
            subscription: res.data.subscription
          });
        }
      }).catch(e => console.log('usage stats fail:', e.message));

      // 2. Load server-backed items (favs, ratings, settings, etc.)
      const [savedSettings, allStats, favList] = await Promise.all([
        Stats.getSettings(user.email),
        Stats.getAllStats(user.email),
        Stats.getFavorites(user.email),
      ]);

      // Priority 1: Global context (fresh), Priority 2: server stats (fallback)
      const finalName = user.name || allStats.username;

      // Only set local state if the user object doesn't already have it
      // to avoid triggering an unnecessary flash.
      if (!username) setUsername(finalName);
      if (!nameInput) setNameInput(finalName);
      if (!avatarUri && user.profile_image) {
        setAvatarUri(user.profile_image);
      }

      if (savedSettings) setSettings(s => ({ ...s, ...savedSettings }));
      
      const finalBorder = user.profile_border || allStats.profile_border;
      if (finalBorder) setProfileBorder(finalBorder);

      setLiveStats({
        episodes: String(allStats.episodes),
        watchTime: allStats.watchTime,
        favCount: String(allStats.favCount),
        avgRating: allStats.avgRating,
      });
      setFavorites(favList);
    } catch { /* ignored */ }
    finally { setStatsLoading(false); }
    // Only depend on the user identity — NOT local state like username/avatarUri/nameInput.
    // Those are SET by loadAll, so including them causes an infinite re-render loop.
  }, [user?.email, user?.name, user?.profile_image]);

  /** 
   * Sync local state whenever global user context updates 
   * (fixes the 'gone on navigation back' issue)
   */
  useEffect(() => {
    if (user?.name) {
      setUsername(user.name);
      setNameInput(user.name);
    }
    if (user?.profile_image !== undefined) {
      setAvatarUri(user.profile_image);
    }
    if (user?.profile_border) {
      setProfileBorder(user.profile_border);
    }
  }, [user?.name, user?.profile_image, user?.profile_border]);

  useEffect(() => {
    loadAll();
    const run = (anim, delay) =>
      Animated.timing(anim, { toValue: 1, duration: 420, delay, useNativeDriver: true });
    Animated.parallel([
      run(heroAnim, 0),
      run(statsAnim, 100),
      run(badgeAnim, 180),
      run(settAnim, 260),
      run(menuAnim, 320),
    ]).start();
  }, [loadAll]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingName) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [editingName]);

  // ── Username save ────────────────────────────────────────────────────────────
  const handleSaveName = useCallback(async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === username) { setEditingName(false); return; }
    if (trimmed.length < 2) { Alert.alert("Too short", "Username must be at least 2 characters."); return; }
    if (trimmed.length > 24) { Alert.alert("Too long", "Username must be 24 characters or fewer."); return; }
    setNameSaving(true);
    await Stats.setUsername(user.email, trimmed);
    await updateUser({ name: trimmed });
    setUsername(trimmed);
    setEditingName(false);
    setNameSaving(false);
  }, [nameInput, username, user?.email]);

  const handleCancelName = useCallback(() => {
    setNameInput(username);
    setEditingName(false);
  }, [username]);

  // ── Avatar ───────────────────────────────────────────────────────────────────
  const handleChangeAvatar = useCallback(async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow access to your photo library.");
        return;
      }
    }
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.2, // 📉 LOWER QUALITY = SUCCESSFUL SAVING
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;

        // Convert to base64 so it can be stored in MongoDB and survive app restarts.
        // Local file:// URIs are temporary — they disappear after the session ends.
        let storableUri = uri;
        try {
          if (Platform.OS === 'web') {
            const response = await fetch(uri);
            const blob = await response.blob();
            storableUri = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } else {
            const base64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const rawExt = uri.split('.').pop()?.split('?')[0].toLowerCase() || 'jpg';
            const ext = ['jpg','jpeg','png'].includes(rawExt) ? rawExt : 'jpg';
            const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
            storableUri = `data:${mime};base64,${base64}`;
          }
        } catch (err) {
          console.error("Base64 conversion failed:", err.message);
          Alert.alert("Upload Error", "Could not process image format.");
          return; // STOP: Do not save temporary URIs to the database
        }

        setAvatarUri(storableUri);
        await Stats.setProfileImage(user.email, storableUri); // Sync to backend
        await updateUser({ profile_image: storableUri });
      }
    } catch { Alert.alert("Error", "Could not load image."); }
    finally { setPicking(false); }
  }, [user?.email]);

  const handleSelectBorder = useCallback(async (borderId) => {
    if (user?.subscription !== 'premium') {
      Alert.alert("Premium Feature", "Animated borders are exclusive to Premium members. Upgrade to get this perk! 🌟");
      return;
    }
    const newBorder = profileBorder === borderId ? null : borderId;
    setBorderSaving(true);
    try {
      await Stats.setProfileBorder(user.email, newBorder);
      setProfileBorder(newBorder);
      await updateUser({ profile_border: newBorder });
    } catch {
      Alert.alert("Error", "Failed to save border selection.");
    } finally {
      setBorderSaving(false);
    }
  }, [user?.email, profileBorder, user?.subscription]);

  const handleRemoveAvatar = useCallback(async () => {
    const confirmed = Platform.OS === "web"
      ? window.confirm("Remove your profile photo?")
      : await new Promise(r =>
        Alert.alert("Remove Photo", "Remove your profile photo?", [
          { text: "Cancel", style: "cancel", onPress: () => r(false) },
          { text: "Remove", style: "destructive", onPress: () => r(true) },
        ])
      );
    if (!confirmed) return;
    setAvatarUri(null);
    await Stats.setProfileImage(user.email, null); // Sync to backend
    await updateUser({ profile_image: null });
  }, [user?.email, updateUser]);


  // ── Settings ─────────────────────────────────────────────────────────────────
  const toggleSetting = useCallback(async (key) => {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      Stats.saveSettings(user.email, next).catch(() => { });
      return next;
    });
  }, [user?.email]);

  // ── Sign out ─────────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    const confirmed = Platform.OS === "web"
      ? window.confirm("Sign out?")
      : await new Promise(r =>
        Alert.alert("Sign Out", "Are you sure?", [
          { text: "Cancel", style: "cancel", onPress: () => r(false) },
          { text: "Sign Out", style: "destructive", onPress: () => r(true) },
        ])
      );
    if (confirmed) signOut();
  }, [signOut]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const avatarLetter = (username || user?.email)?.[0]?.toUpperCase() || "?";
  const epCount = parseInt(liveStats.episodes) || 0;
  const favCount = parseInt(liveStats.favCount) || 0;
  const avgRat = parseFloat(liveStats.avgRating) || 0;
  
  let accountAgeText = "0m";
  if (user?.joined_at) {
    const now = Date.now();
    const joined = new Date(user.joined_at).getTime();
    const diffMs = now - joined;

    if (diffMs < 60000) { // Less than 1 minute
      accountAgeText = "Just now";
    } else {
      const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const h = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diffMs / 1000 / 60) % 60);

      const parts = [];
      if (d > 0) parts.push(`${d}d`);
      if (h > 0) parts.push(`${h}h`);
      if (m > 0 || parts.length === 0) parts.push(`${m}m`);
      accountAgeText = parts.join(" ");
    }
  }

  const badges = [
    { icon: "flame", label: "Binge Master", earned: epCount >= 50 },
    { icon: "ribbon", label: "Day 1 Member", earned: true },
    { icon: "heart", label: "Collector", earned: favCount >= 10 },
    { icon: "trophy", label: "Top Reviewer", earned: avgRat >= 4.5 && !isNaN(avgRat) },
    { icon: "planet", label: "Explorer", earned: epCount >= 10 },
    { icon: "flash", label: "Speed Watcher", earned: epCount >= 100 },
  ];

  // Parallax
  const heroTranslate = scrollY.interpolate({
    inputRange: [0, HERO_H], outputRange: [0, -HERO_H * 0.35], extrapolate: "clamp",
  });
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, HERO_H * 0.7], outputRange: [1, 0], extrapolate: "clamp",
  });
  const navOpacity = scrollY.interpolate({
    inputRange: [HERO_H - 80, HERO_H - 20], outputRange: [0, 1], extrapolate: "clamp",
  });

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* ── STICKY NAV ── */}
      <Animated.View style={[styles.stickyNav, { opacity: navOpacity }]}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.stickyNavLine} />
        <View style={styles.stickyNavContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.stickyNavTitle}>{username}</Text>
          <View style={{ width: 38 }} />
        </View>
      </Animated.View>

      {/* ── FLOATING BACK ── */}
      <Animated.View style={[styles.floatBack, { opacity: heroOpacity }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.floatBackBtn}>
          <BlurView intensity={60} tint="dark" style={styles.floatBackBlur}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </BlurView>
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        {/* ── HERO ── */}
        <Animated.View style={[styles.heroWrap, { transform: [{ translateY: heroTranslate }] }]}>
          <LinearGradient
            colors={[C.crimsonDeep, "#2a0010", C.void]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View style={[styles.heroOrb, styles.heroOrbLeft, { pointerEvents: "none" }]} />
          <View style={[styles.heroOrb, styles.heroOrbRight, { pointerEvents: "none" }]} />
          <LinearGradient
            colors={["transparent", C.bg]} style={styles.heroFade}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          />

          <Animated.View style={[styles.heroContent, { opacity: heroAnim }]}>
            <View style={styles.heroTopRow}>
              {/* Avatar with Animated Border */}
              <TouchableOpacity onPress={handleChangeAvatar} activeOpacity={0.85} disabled={picking}>
                <PremiumBorder borderStyle={profileBorder} size={88} borderWidth={3}>
                  <View style={styles.avatarInner}>
                    {avatarUri ? (
                      <Image 
                        source={{ uri: avatarUri }} 
                        style={styles.avatarImage} 
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <LinearGradient colors={["#1a1a22", C.surfaceHigh]} style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                      </LinearGradient>
                    )}
                  </View>
                </PremiumBorder>
                <View style={[styles.cameraBadge, { bottom: 0, right: 0 }]}>
                  <Ionicons name={picking ? "hourglass-outline" : "camera"} size={12} color={C.white} />
                </View>
                <View style={[styles.onlineDot, { bottom: 6, left: 0 }]} />
              </TouchableOpacity>

              {/* Premium Borders Section (Beside Avatar) */}
              <View style={styles.sideSelector}>
                <Text style={styles.borderLabel}>
                  Profile Aura{" "}
                  {borderSaving && <DotCircleLoader size={16} color={C.crimson} />}
                </Text>
                <View style={styles.borderGrid}>
                  {['gold', 'neon', 'cosmic'].map((id) => (
                    <TouchableOpacity 
                      key={id} 
                      onPress={() => handleSelectBorder(id)}
                      style={[
                        styles.borderOption, 
                        profileBorder === id && styles.borderOptionActive
                      ]}
                    >
                      <PremiumBorder borderStyle={id} size={28} borderWidth={2}>
                        <View style={[styles.borderPreviewInner, { width: 28, height: 28, borderRadius: 14, backgroundColor: id === 'gold' ? '#eab30830' : id === 'neon' ? '#0062ff30' : '#ff00cc30' }]}>
                          <Ionicons 
                            name={id === 'gold' ? "sparkles" : id === 'neon' ? "flash" : "planet"} 
                            size={12} 
                            color={id === 'gold' ? '#eab308' : id === 'neon' ? '#00f2ff' : '#ff00cc'} 
                          />
                        </View>
                      </PremiumBorder>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Username row — display or edit */}
            {editingName ? (
              <View style={[styles.nameEditRow, { marginTop: 15 }]}>
                <TextInput
                  ref={nameInputRef}
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  onSubmitEditing={handleSaveName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={24}
                  returnKeyType="done"
                  selectionColor={C.crimson}
                  placeholderTextColor={C.dimmer}
                  placeholder="Your name…"
                />
                {nameSaving ? (
                  <View style={{ marginLeft: 8 }}>
                    <DotCircleLoader size={16} color={C.crimson} />
                  </View>
                ) : (
                  <>
                    <TouchableOpacity onPress={handleSaveName} style={styles.nameActionBtn}>
                      <Ionicons name="checkmark" size={18} color={C.crimson} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCancelName} style={styles.nameActionBtn}>
                      <Ionicons name="close" size={18} color={C.dim} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.nameRow, { marginTop: 15 }]}
                onPress={() => { setNameInput(username); setEditingName(true); }}
                activeOpacity={0.75}
              >
                <Text style={styles.heroName}>{username}</Text>
                <View style={styles.editNameBadge}>
                  <Ionicons name="pencil" size={11} color={C.dim} />
                </View>
              </TouchableOpacity>
            )}

            <Text style={styles.heroEmail}>{user?.email}</Text>

            <View style={[styles.heroBadgeRow, { flexWrap: "wrap", justifyContent: "center" }]}>
              {user?.subscription === 'premium' ? (
                <View style={[styles.heroBadgePill, { borderColor: '#eab308' }]}>
                  <Ionicons name="star" size={12} color="#eab308" />
                  <Text style={[styles.heroBadgeText, { color: '#eab308' }]}>Premium Member</Text>
                </View>
              ) : (
                <View style={styles.heroBadgePill}>
                  <Ionicons name="checkmark-circle" size={12} color={C.crimson} />
                  <Text style={styles.heroBadgeText}>Free Member</Text>
                </View>
              )}
              {user?.joined_at && (
                <View style={styles.heroBadgePill}>
                  <Ionicons name="time-outline" size={12} color={C.dim} />
                  <Text style={[styles.heroBadgeText, { color: C.dim }]}>Joined {accountAgeText} ago</Text>
                </View>
              )}
            </View>

            {avatarUri && (
              <TouchableOpacity onPress={handleRemoveAvatar} style={styles.removePhotoBtn}>
                <Text style={styles.removePhotoText}>Remove photo</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </Animated.View>

        {/* ── BODY ── */}
        <View style={styles.body}>

          {/* STATS ROW */}
          <Animated.View style={{ opacity: statsAnim }}>
            {statsLoading ? (
              <View style={styles.statsLoading}>
                <DotCircleLoader size={18} color={C.crimson} />
              </View>
            ) : (
              <View style={styles.statsRow}>
                <StatCard icon="play-circle-outline" value={liveStats.episodes} label="Episodes" anim={statsAnim} />
                <StatCard icon="time-outline" value={liveStats.watchTime} label="Watch Time" anim={statsAnim} />
                <StatCard icon="heart-outline" value={liveStats.favCount} label="Favorites" anim={statsAnim} />
                <StatCard icon="star-outline" value={liveStats.avgRating} label="Avg Rating" anim={statsAnim} />
              </View>
            )}
          </Animated.View>

          {/* DAILY LIMIT (Free users only) */}
          {usage.subscription === 'free' && (
            <Animated.View style={[styles.limitCard, { opacity: statsAnim }]}>
              <View style={styles.limitHeader}>
                <View style={styles.limitTitleRow}>
                  <Ionicons name="timer-outline" size={16} color={C.white} />
                  <Text style={styles.limitTitle}>Daily Episode Limit</Text>
                </View>
                <Text style={styles.limitValue}>{usage.count} / {usage.limit}</Text>
              </View>
              <View style={styles.limitBarBg}>
                <View style={[styles.limitBarFill, { width: `${Math.min(100, (usage.count / usage.limit) * 100)}%` }]} />
              </View>
              <Text style={styles.limitHint}>You can watch 20 episodes every 24 hours. Go Premium for unlimited access!</Text>
              <TouchableOpacity
                style={styles.limitUpgradeBtn}
                onPress={() => navigation.navigate("Subscription")}
              >
                <LinearGradient
                  colors={[C.crimson, "#a00020"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.limitUpgradeBtnGrad}
                >
                  <Text style={styles.limitUpgradeBtnText}>Upgrade Now</Text>
                  <Ionicons name="flash" size={14} color={C.white} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* STATS EXPLAINER */}
          <Animated.View style={[styles.explainerCard, { opacity: statsAnim }]}>
            <Ionicons name="information-circle-outline" size={14} color={C.dim} style={{ marginTop: 1 }} />
            <Text style={styles.explainerText}>
              <Text style={styles.explainerBold}>Episodes</Text>{" "}counts unique episodes clicked.{" "}
              <Text style={styles.explainerBold}>Watch Time</Text>{" "}counts time in player ≥ 15s.{" "}
              <Text style={styles.explainerBold}>Favorites</Text>{" "}are anime you ❤️ from the details page.{" "}
              <Text style={styles.explainerBold}>Avg Rating</Text>{" "}is your mean ★ score across all rated anime.
            </Text>
          </Animated.View>


          {/* ACHIEVEMENTS */}
          <Animated.View style={{ opacity: badgeAnim }}>
            <Section title="Achievements">
              <View style={styles.badgesGrid}>
                {badges.map((b) => (
                  <Badge key={b.label} {...b} anim={badgeAnim} />
                ))}
              </View>
              <Text style={styles.badgeHint}>Keep watching and rating to unlock all badges.</Text>
            </Section>
          </Animated.View>

          {/* PLAYBACK */}
          <Animated.View style={{ opacity: settAnim }}>
            <Section title="Playback">
              <View style={styles.settingsCard}>
                <SettingRow icon="play-skip-forward-outline" label="Autoplay Next" sub="Automatically play next episode" value={settings.autoplay} onToggle={() => toggleSetting("autoplay")} />
                <SettingRow icon="tv-outline" label="HD Quality" sub="Use more data for better quality" value={settings.hd} onToggle={() => toggleSetting("hd")} />
                <SettingRow icon="text-outline" label="Subtitles" sub="Show subtitles by default" value={settings.subtitles} onToggle={() => toggleSetting("subtitles")} last />
              </View>
            </Section>
          </Animated.View>

          {/* NOTIFICATIONS */}
          <Animated.View style={{ opacity: settAnim }}>
            <Section title="Notifications">
              <View style={styles.settingsCard}>
                <SettingRow icon="notifications-outline" label="Push Notifications" sub="New episodes & updates" value={settings.notifications} onToggle={() => toggleSetting("notifications")} last />
              </View>
            </Section>
          </Animated.View>

          {/* ACTIVITY */}
          <Animated.View style={{ opacity: menuAnim }}>
            <Section title="Activity">
              <View style={styles.menuCard}>
                <MenuRow icon="time-outline" label="Watch History" sub="Episodes you've seen" onPress={() => navigation.navigate("WatchHistory")} />
                <MenuRow icon="bookmark-outline" label="Watchlist" sub="Plan to watch & more" onPress={() => navigation.navigate("Watchlist")} />
                <MenuRow icon="heart-outline" label="Favorites" sub={`${favorites.length} items`} onPress={() => navigation.navigate("Favorites")} last />
              </View>
            </Section>

          </Animated.View>

          {/* ACCOUNT */}

          <Animated.View style={{ opacity: menuAnim }}>
            <Section title="Account">
              <View style={styles.menuCard}>
                <MenuRow icon="person-outline" label="Username" sub={username} onPress={() => { setNameInput(username); setEditingName(true); }} />
                <MenuRow icon="mail-outline" label="Email" sub={user?.email} onPress={() => { }} />

                <MenuRow
                  icon="star-outline"
                  label="Subscription"
                  sub={user?.subscription === 'premium' ? "Premium Member" : "Free Plan (Upgrade?)"}
                  onPress={() => navigation.navigate("Subscription")}
                />
                <MenuRow icon="log-out-outline" label="Sign Out" onPress={handleSignOut} danger last />
              </View>
            </Section>
          </Animated.View>

          <AppFooter />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  stickyNav: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 100, overflow: "hidden" },
  stickyNavLine: { position: "absolute", bottom: 0, left: 0, right: 0, height: 1, backgroundColor: C.glass, opacity: 1 },
  stickyNavContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: Platform.OS === "ios" ? 54 : 42, paddingBottom: 12, paddingHorizontal: 16 },
  stickyNavTitle: { color: C.white, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" },

  floatBack: { position: "absolute", top: Platform.OS === "ios" ? 56 : 44, left: 16, zIndex: 101 },
  floatBackBtn: { borderRadius: 12, overflow: "hidden" },
  floatBackBlur: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },

  heroWrap: { height: HERO_H + 60, overflow: "hidden", alignItems: "center", justifyContent: "flex-end" },
  heroOrb: { position: "absolute", width: 200, height: 200, borderRadius: 100, opacity: 0.25 },
  heroOrbLeft: { backgroundColor: C.crimson, top: -50, left: -60, transform: [{ scaleX: 1.5 }] },
  heroOrbRight: { backgroundColor: C.crimsonDark, top: 20, right: -80, transform: [{ scaleY: 1.3 }] },
  heroFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 120 },
  heroContent: { alignItems: "center", paddingBottom: 24, zIndex: 2 },

  avatarRing: { width: AVATAR_SZ + 8, height: AVATAR_SZ + 8, borderRadius: (AVATAR_SZ + 8) / 2, marginBottom: 14, alignItems: "center", justifyContent: "center", position: "relative" },
  avatarRingGradient: { ...StyleSheet.absoluteFillObject, borderRadius: (AVATAR_SZ + 8) / 2 },
  avatarInner: { width: AVATAR_SZ, height: AVATAR_SZ, borderRadius: AVATAR_SZ / 2, overflow: "hidden", borderWidth: 2, borderColor: C.bg },
  avatarImage: { width: "100%", height: "100%" },
  avatarPlaceholder: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  avatarLetter: { color: C.white, fontSize: 32, fontWeight: "800" },
  cameraBadge: { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: C.crimson, borderWidth: 2, borderColor: C.bg, justifyContent: "center", alignItems: "center" },
  onlineDot: { position: "absolute", top: 4, right: 4, width: 13, height: 13, borderRadius: 7, backgroundColor: "#22c55e", borderWidth: 2, borderColor: C.bg },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  heroName: { color: C.white, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  editNameBadge: { width: 22, height: 22, borderRadius: 6, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" },
  nameEditRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3, backgroundColor: C.surface, borderWidth: 1, borderColor: C.glass, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  nameInput: { color: C.white, fontSize: 17, fontWeight: "700", flex: 1, padding: 0, minWidth: 120, outlineStyle: 'none' },
  nameActionBtn: { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },

  heroEmail: { color: C.dim, fontSize: 13, marginBottom: 12 },
  heroBadgeRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  heroBadgePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: C.glass, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  heroBadgeText: { color: C.crimson, fontSize: 11, fontWeight: "700" },
  removePhotoBtn: { marginTop: 4, paddingVertical: 4 },
  removePhotoText: { color: C.dim, fontSize: 12, textDecorationLine: "underline" },

  body: { paddingHorizontal: 16, paddingBottom: 40 },

  statsLoading: { height: 90, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10, marginTop: -4 },
  statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingVertical: 14, paddingHorizontal: 6, alignItems: "center", gap: 5 },
  statIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: C.glass, justifyContent: "center", alignItems: "center", marginBottom: 2 },
  statValue: { color: C.white, fontSize: 16, fontWeight: "800", letterSpacing: -0.4 },
  statLabel: { color: C.dim, fontSize: 9, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center" },

  explainerCard: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 24 },
  explainerText: { flex: 1, color: C.dim, fontSize: 11, lineHeight: 17 },
  explainerBold: { color: C.white, fontWeight: "700" },


  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: C.crimson },
  sectionTitle: { color: C.white, fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },

  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badge: { width: (width - 32 - 20) / 3, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  badgeGradient: { padding: 12, alignItems: "center", gap: 6, minHeight: 96, justifyContent: "center", position: "relative" },
  badgeIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" },
  badgeIconWrapEarned: { backgroundColor: "rgba(255,255,255,0.05)", borderColor: C.glass },
  badgeLabel: { color: C.white, fontSize: 10, fontWeight: "700", textAlign: "center", lineHeight: 14 },
  badgeLabelDim: { color: C.dimmer },
  badgeLock: { position: "absolute", top: 7, right: 7 },
  badgeHint: { color: C.dimmer, fontSize: 11, textAlign: "center", marginTop: 12 },

  settingsCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  settingIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: C.glass, justifyContent: "center", alignItems: "center" },
  settingText: { flex: 1 },
  settingLabel: { color: C.white, fontSize: 14, fontWeight: "600" },
  settingSub: { color: C.dim, fontSize: 11, marginTop: 1 },

  menuCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  dangerCard: { borderColor: C.crimsonBorder, backgroundColor: "rgba(220,20,60,0.04)" },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  menuIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" },
  menuIconWrapDanger: { backgroundColor: C.crimsonDim, borderColor: C.crimsonBorder },
  menuText: { flex: 1 },
  menuLabel: { color: C.white, fontSize: 14, fontWeight: "600" },
  menuLabelDanger: { color: C.crimson },
  menuSub: { color: C.dim, fontSize: 11, marginTop: 1 },

  footer: { alignItems: "center", paddingVertical: 24, gap: 4 },
  footerText: { color: C.dimmer, fontSize: 12, fontWeight: "600" },
  footerSub: { color: C.dimmer, fontSize: 11 },

  limitCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 24,
    marginTop: 4,
  },
  limitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  limitTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  limitTitle: {
    color: C.white,
    fontSize: 14,
    fontWeight: "700",
  },
  limitValue: {
    color: C.crimson,
    fontSize: 14,
    fontWeight: "800",
  },
  limitBarBg: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 10,
  },
  limitBarFill: {
    height: "100%",
    backgroundColor: C.crimson,
    borderRadius: 4,
  },
  limitHint: {
    color: C.dim,
    fontSize: 11,
    lineHeight: 16,
  },

  borderSelectorSection: { width: '100%' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 5 },
  sideSelector: { flex: 1, height: 88, justifyContent: 'center' },
  borderLabel: { color: C.dim, fontSize: 10, fontWeight: "800", textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  borderGrid: { flexDirection: 'row', gap: 12 },
  borderOption: { opacity: 0.4, scale: 0.9 },
  borderOptionActive: { opacity: 1, scale: 1 },
  borderOptionText: { color: C.dim, fontSize: 10, fontWeight: "600" },
  borderOptionTextActive: { color: C.white, fontWeight: "800" },

  limitUpgradeBtn: {
    marginTop: 14,
    borderRadius: 12,
    overflow: "hidden",
  },
  limitUpgradeBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  limitUpgradeBtnText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "700",
  },
});