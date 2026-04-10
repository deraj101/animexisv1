import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import { C } from "../theme";
import AppFooter from "../components/AppFooter";
import DotCircleLoader from "../components/DotCircleLoader";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
/**
 * Reads the JWT token from AsyncStorage.
 * auth_user is stored as { email, token } by AuthContext.signIn.
 */
async function getAuthHeader() {
  try {
    const raw = await AsyncStorage.getItem("auth_user");
    const token = raw ? JSON.parse(raw)?.token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = React.memo(function StatCard({ icon, label, value, sub, color, anim }) {
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const tintColor  = color || C.crimson;
  const dimBg      = `${tintColor}1a`;
  const dimBorder  = `${tintColor}44`;

  return (
    <Animated.View style={[styles.statCard, { opacity: anim, transform: [{ translateY }] }]}>
      <View style={[styles.statIconWrap, { backgroundColor: dimBg, borderColor: dimBorder }]}>
        <Ionicons name={icon} size={18} color={tintColor} />
      </View>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={[styles.statSub, { color: tintColor }]}>{sub}</Text> : null}
    </Animated.View>
  );
});

// ─── AREA CHART (SVG, no library) ───────────────────────────────────────────
const CHART_H = 140;
const CHART_PAD_X = 36;
const CHART_PAD_Y = 14;

function VisitsAreaChart({ data }) {
  const [w, setW] = React.useState(0);
  if (!data || data.length === 0) return null;

  const maxV = Math.max(...data.map(d => d.visits), 1);
  const innerW = w - CHART_PAD_X * 2;
  const innerH = CHART_H - CHART_PAD_Y * 2;

  const getX = (i) => CHART_PAD_X + (i / Math.max(data.length - 1, 1)) * innerW;
  const getY = (v) => CHART_PAD_Y + innerH - (v / maxV) * innerH;

  // Build SVG path strings only when width is known
  let linePath = '';
  let areaPath = '';
  if (w > 0) {
    const pts = data.map((d, i) => `${getX(i).toFixed(1)},${getY(d.visits).toFixed(1)}`);
    linePath = `M ${pts.join(' L ')}`;
    areaPath = `M ${getX(0).toFixed(1)},${(CHART_PAD_Y + innerH).toFixed(1)} L ${pts.join(' L ')} L ${getX(data.length - 1).toFixed(1)},${(CHART_PAD_Y + innerH).toFixed(1)} Z`;
  }

  // Y axis grid values
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: getY(maxV * f),
    label: Math.round(maxV * f),
  }));

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLabel = (ym) => {
    const m = parseInt(ym?.split('-')[1], 10);
    return MONTHS[(m - 1)] || ym;
  };

  return (
    <View
      style={{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}
      onLayout={e => setW(e.nativeEvent.layout.width)}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ color: C.white, fontWeight: '700', fontSize: 13 }}>Unique Visitors</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.crimson }} />
          <Text style={{ color: C.dim, fontSize: 11 }}>Per month</Text>
        </View>
      </View>

      {w > 0 && (
        // SVG drawn with absolute positioned Views since RN doesn't have SVG built-in
        // We simulate it using a Canvas-style approach with Views
        <View style={{ height: CHART_H, marginHorizontal: 0, position: 'relative' }}>
          {/* Grid lines */}
          {gridLines.map((gl, i) => (
            <View key={i} style={[{ position: 'absolute', left: CHART_PAD_X, right: 8, height: 1, backgroundColor: 'rgba(255,255,255,0.05)', top: gl.y }]}>
              <Text style={{ position: 'absolute', left: -(CHART_PAD_X - 2), top: -8, color: C.dimmer, fontSize: 9, fontWeight: '600' }}>
                {gl.label > 999 ? `${(gl.label/1000).toFixed(1)}k` : gl.label}
              </Text>
            </View>
          ))}

          {/* Area fill — approximate with gradient strip columns */}
          {data.map((d, i) => {
            if (i === data.length - 1 || !w) return null;
            const x1 = getX(i);
            const x2 = getX(i + 1);
            const y1 = getY(d.visits);
            const y2 = getY(data[i + 1].visits);
            const top = Math.min(y1, y2);
            const bottom = CHART_PAD_Y + innerH;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: x1,
                  width: x2 - x1,
                  top: top,
                  height: bottom - top,
                  backgroundColor: 'rgba(220,20,60,0.12)',
                }}
              />
            );
          })}

          {/* Line segments */}
          {data.map((d, i) => {
            if (i === data.length - 1 || !w) return null;
            const x1 = getX(i);
            const x2 = getX(i + 1);
            const y1 = getY(d.visits);
            const y2 = getY(data[i + 1].visits);
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: x1,
                  top: y1,
                  width: len,
                  height: 2.5,
                  backgroundColor: C.crimson,
                  transformOrigin: '0 0',
                  transform: [{ rotate: `${angle}deg` }],
                  borderRadius: 2,
                  shadowColor: C.crimson,
                  shadowOpacity: 0.8,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              />
            );
          })}

          {/* Dots + tooltip */}
          {data.map((d, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: getX(i) - 5,
                top: getY(d.visits) - 5,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: C.crimson,
                borderWidth: 2,
                borderColor: C.bg,
                shadowColor: C.crimson,
                shadowOpacity: 1,
                shadowRadius: 6,
                elevation: 4,
              }}
            />
          ))}
        </View>
      )}

      {/* X axis labels */}
      <View style={{ flexDirection: 'row', paddingHorizontal: CHART_PAD_X - 8, paddingBottom: 12, paddingTop: 6 }}>
        {data.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <Text style={{ color: C.dim, fontSize: 9, fontWeight: '600' }}>{monthLabel(d.year_month)}</Text>
            <Text style={{ color: C.white, fontSize: 9, fontWeight: '700' }}>{d.visits}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, icon }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionAccent} />
    <Ionicons name={icon} size={14} color={C.crimson} style={{ marginRight: 6 }} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

// ─── ACTIVITY ROW ─────────────────────────────────────────────────────────────
const ActivityRow = React.memo(function ActivityRow({ icon, color, title, sub, time, last }) {
  const safeColor = color || C.dim;
  return (
    <View style={[styles.actRow, !last && styles.actRowBorder]}>
      <View style={[styles.actIconWrap, { backgroundColor: `${safeColor}1a`, borderColor: `${safeColor}44` }]}>
        <Ionicons name={icon || "information-circle"} size={14} color={safeColor} />
      </View>
      <View style={styles.actInfo}>
        <Text style={styles.actTitle}>{title}</Text>
        {sub ? <Text style={styles.actSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Text style={styles.actTime}>{time}</Text>
    </View>
  );
});

// ─── USER ROW ─────────────────────────────────────────────────────────────────
const UserRow = React.memo(function UserRow({
  email, joinedAgo, seenAgo, isBanned, last, onBan, onToggleBypass, bypassed, isToggling,
  subscription, onToggleSubscription
}) {
  const letter = email?.[0]?.toUpperCase() || "?";
  return (
    <View style={[styles.userRow, !last && styles.userRowBorder, isToggling && { opacity: 0.5 }]}>
      <View style={[styles.userAvatar, isBanned && styles.userAvatarBanned]}>
        <Text style={[styles.userAvatarLetter, isBanned && { color: C.dimmer }]}>{letter}</Text>
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.userEmail} numberOfLines={1}>{email}</Text>
        <View style={styles.userMetaRow}>
          <Text style={styles.userMeta}>Joined {joinedAgo} · Active {seenAgo}</Text>
          {bypassed && (
            <View style={styles.bypassBadge}>
              <Ionicons name="key" size={9} color="#22c55e" />
              <Text style={styles.bypassBadgeText}>OTP off</Text>
            </View>
          )}
          {subscription === 'premium' && (
            <View style={[styles.bypassBadge, { backgroundColor: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.3)' }]}>
              <Ionicons name="star" size={9} color="#eab308" />
              <Text style={[styles.bypassBadgeText, { color: '#eab308' }]}>Premium</Text>
            </View>
          )}
          {isBanned && (
            <View style={styles.bannedBadge}>
              <Text style={styles.bannedBadgeText}>Banned</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.actionBtn, bypassed && styles.actionBtnBypass]}
          onPress={() => onToggleBypass(email)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isToggling}
        >
          {isToggling ? (
            <DotCircleLoader size={18} color={C.dimmer} />
          ) : (
            <Ionicons
              name={bypassed ? "key" : "key-outline"}
              size={15}
              color={bypassed ? "#22c55e" : C.dimmer}
            />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionBtn, subscription === 'premium' && styles.actionBtnPremium]}
          onPress={() => onToggleSubscription(email, subscription)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isToggling}
        >
          <Ionicons
            name={subscription === 'premium' ? "star" : "star-outline"}
            size={15}
            color={subscription === 'premium' ? "#eab308" : C.dimmer}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onBan(email, isBanned)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isBanned ? "checkmark-circle-outline" : "ban-outline"}
            size={15}
            color={isBanned ? "#22c55e" : C.dimmer}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── REPORT ROW ─────────────────────────────────────────────────────────────
const ReportRow = React.memo(function ReportRow({ report, onUpdateStatus, onDelete, last }) {
  const isBug = report.type === 'bug';
  const isOpen = report.status === 'open';

  return (
    <View style={[styles.userRow, !last && styles.userRowBorder]}>
      <View style={[styles.userAvatar, { backgroundColor: isBug ? `${C.crimson}1a` : `${C.dim}1a`, borderColor: isBug ? `${C.crimson}44` : `${C.dim}44` }]}>
        <Ionicons name={isBug ? "bug" : "help-buoy"} size={16} color={isBug ? C.crimson : C.dim} />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userEmail} numberOfLines={1}>{report.title}</Text>
        <View style={styles.userMetaRow}>
          <Text style={styles.userMeta}>{report.email}</Text>
          <View style={[styles.statusBadge, { backgroundColor: isOpen ? `${C.crimson}15` : 'rgba(34,197,94,0.1)', borderColor: isOpen ? `${C.crimson}33` : 'rgba(34,197,94,0.3)' }]}>
            <Text style={[styles.statusBadgeText, { color: isOpen ? C.crimson : '#22c55e' }]}>
              {report.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.reportDesc} numberOfLines={2}>{report.description}</Text>
        <Text style={styles.userMeta}>{new Date(report.createdAt).toLocaleDateString()}</Text>
      </View>
      <View style={styles.userActions}>
        {isOpen && (
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => onUpdateStatus(report._id, 'resolved')}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#22c55e" />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={() => onDelete(report._id)}
        >
          <Ionicons name="trash-outline" size={16} color={C.dimmer} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
export default function AdminDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();

  if (!user?.isAdmin) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.accessDenied}>
          <View style={styles.accessDeniedIcon}>
            <Ionicons name="lock-closed" size={36} color={C.crimson} />
          </View>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedSub}>This area is for admins only.</Text>
          <TouchableOpacity style={styles.accessDeniedBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.accessDeniedBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [stats,       setStats]       = useState(null);
  const [topAnime,    setTopAnime]    = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [activeTab,   setActiveTab]   = useState("overview");
  const [bypassSet,   setBypassSet]   = useState(new Set()); // emails that bypass OTP
  const [apiError,    setApiError]    = useState(null);
  const [scraperStatus, setScraperStatus] = useState(null);
  const [monthlyVisits, setMonthlyVisits] = useState([]);
  const [togglingBypass, setTogglingBypass] = useState(null);
  const [activityOffset, setActivityOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreActivity, setHasMoreActivity] = useState(true);
  const [activeUsers, setActiveUsers] = useState(null);
  const [reports,     setReports]     = useState([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const scrollY   = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const statAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  // ── Core fetch ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setApiError(null);

    const authHeader = await getAuthHeader();

    // Warn clearly if there's no token yet
    if (!authHeader.Authorization) {
      setApiError("No auth token found. Please sign out and sign back in.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const cfg = { headers: authHeader };

    try {
      const [statsRes, animeRes, usersRes, activityRes, scraperRes, visitsRes] = await Promise.allSettled([
        API.get("/api/admin/stats",        cfg),
        API.get("/api/admin/top-anime",    cfg),
        API.get("/api/admin/recent-users?limit=50", cfg),
        API.get("/api/admin/activity?limit=10&skip=0",     cfg),
        API.get("/api/admin/scraper-status", cfg),
        API.get("/api/admin/monthly-visits", cfg),
        API.get("/api/reports", cfg),
      ]);

      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value.data);
      } else {
        // Surface the real error so we know if it's a 401/403
        const msg = statsRes.reason?.response?.data?.error || statsRes.reason?.message;
        setApiError(`Stats error: ${msg}`);
      }

      setTopAnime(
        animeRes.status === "fulfilled" ? animeRes.value.data.results || [] : []
      );

      setRecentUsers(
        usersRes.status === "fulfilled" ? usersRes.value.data.users || [] : []
      );

      setActivityLog(
        activityRes.status === "fulfilled" ? activityRes.value.data.activity || [] : []
      );
      setActivityOffset(0);
      setHasMoreActivity((activityRes.value.data.activity || []).length === 10);

      // Build bypass set from the returned user list
      if (usersRes.status === "fulfilled") {
        const bypassed = (usersRes.value.data.users || [])
          .filter((u) => u.otpBypass)
          .map((u) => u.email.toLowerCase());
        setBypassSet(new Set(bypassed));
      }

      if (scraperRes.status === "fulfilled") {
        setScraperStatus(scraperRes.value.data);
      }
      if (visitsRes.status === "fulfilled") {
        setMonthlyVisits(visitsRes.value.data.visits || []);
      }
      if (reportsRes.status === "fulfilled") {
        setReports(reportsRes.value.data.reports || []);
      }
    } catch (err) {
      setApiError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Animations ────────────────────────────────────────────────────────────
  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        ...statAnims.map((a) =>
          Animated.timing(a, { toValue: 1, duration: 400, useNativeDriver: true })
        ),
      ]).start();
    }
  }, [loading]);

  // ── Ban / Unban ───────────────────────────────────────────────────────────
  const handleBanUser = useCallback(async (email, currentlyBanned) => {
    const action     = currentlyBanned ? "Unban" : "Ban";
    const endpoint   = currentlyBanned ? "/api/admin/unban-user" : "/api/admin/ban-user";
    const actionMsg  = currentlyBanned
      ? `Restore access for ${email}?`
      : `Ban ${email}? They will lose access immediately.`;

    Alert.alert(action, actionMsg, [
      { text: "Cancel", style: "cancel" },
      {
        text: action,
        style: currentlyBanned ? "default" : "destructive",
        onPress: async () => {
          try {
            const authHeader = await getAuthHeader();
            await API.post(endpoint, { email }, { headers: authHeader });
            // Optimistic update
            setRecentUsers((prev) =>
              prev.map((u) =>
                u.email === email ? { ...u, isBanned: !currentlyBanned } : u
              )
            );
            setStats((prev) =>
              prev
                ? {
                    ...prev,
                    bannedCount: currentlyBanned
                      ? Math.max(0, (prev.bannedCount || 0) - 1)
                      : (prev.bannedCount || 0) + 1,
                  }
                : prev
            );
          } catch {
            Alert.alert("Error", `Could not ${action.toLowerCase()} user. Try again.`);
          }
        },
      },
    ]);
  }, []);

  // ── OTP bypass toggle ─────────────────────────────────────────────────────
  const handleToggleBypass = useCallback(async (email) => {
    const lower      = email.toLowerCase();
    const isBypassed = bypassSet.has(lower);
    const newState   = !isBypassed;

    setTogglingBypass(lower);
    try {
      const authHeader = await getAuthHeader();
      await API.post(
        "/api/admin/set-otp-bypass",
        { email: lower, bypass: newState },
        { headers: authHeader }
      );
      
      const nextSet = new Set(bypassSet);
      if (newState) nextSet.add(lower);
      else          nextSet.delete(lower);
      setBypassSet(nextSet);

      Alert.alert(
        newState ? "OTP Bypass Enabled" : "OTP Restored",
        newState
          ? `${email} can now sign in without a verification code.`
          : `${email} must verify with OTP again.`
      );
    } catch {
      Alert.alert("Error", "Could not update OTP bypass. Try again.");
    } finally {
      setTogglingBypass(null);
    }
  }, [bypassSet]);

  const handleToggleSubscription = useCallback(async (email, currentSub) => {
    const lower   = email.toLowerCase();
    const nextSub = currentSub === 'premium' ? 'free' : 'premium';

    setTogglingBypass(lower);
    try {
      const authHeader = await getAuthHeader();
      await API.post(
        "/api/admin/set-subscription",
        { email: lower, subscription: nextSub },
        { headers: authHeader }
      );
      
      // Update local user list
      setRecentUsers(prev => (
        prev.map(u => 
          u.email?.toLowerCase() === lower ? { ...u, subscription: nextSub } : u
        )
      ));
    } catch {
      Alert.alert("Error", "Could not update subscription tier. Try again.");
    } finally {
      setTogglingBypass(null);
    }
  }, []);

  const handleLoadMoreActivity = useCallback(async () => {
    if (loadingMore || !hasMoreActivity) return;
    setLoadingMore(true);

    try {
      const authHeader = await getAuthHeader();
      const nextOffset = activityOffset + 10;
      const res = await API.get(`/api/admin/activity?limit=10&skip=${nextOffset}`, { headers: authHeader });
      
      const newItems = res.data.activity || [];
      if (newItems.length > 0) {
        setActivityLog(prev => [...prev, ...newItems]);
        setActivityOffset(nextOffset);
        if (newItems.length < 10) setHasMoreActivity(false);
      } else {
        setHasMoreActivity(false);
      }
    } catch (err) {
      console.log("Load more activity error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [activityOffset, loadingMore, hasMoreActivity]);

  const handleSignOut = useCallback(() => signOut(), [signOut]);

  // ── Real-time active users polling (every 30s) ────────────────────────
  useEffect(() => {
    const fetchActive = async () => {
      try {
        const authHeader = await getAuthHeader();
        const res = await API.get('/api/admin/active-users', { headers: authHeader });
        if (res.data?.success) setActiveUsers(res.data.count);
      } catch { /* silent */ }
    };
    fetchActive();
    const interval = setInterval(fetchActive, 30000);
    return () => clearInterval(interval);
  }, []);

  // Pulse animation for the live dot
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const navOpacity = scrollY.interpolate({
    inputRange: [60, 110], outputRange: [0, 1], extrapolate: "clamp",
  });

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <DotCircleLoader size={54} color={C.crimson} />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      </View>
    );
  }

  const TABS = [
    { key: "overview", label: "Overview", icon: "grid-outline" },
    { key: "users",    label: "Users",    icon: "people-outline",
      badge: recentUsers.length > 0 ? recentUsers.length : null, badgeColor: "#3b82f6" },
    { key: "reports",  label: "Reports",  icon: "flag-outline",
      badge: reports.filter(r => r.status === 'open').length || null, badgeColor: C.crimson },
    { key: "system",   label: "System",   icon: "settings-outline" },
  ];

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* Sticky nav */}
      <Animated.View style={[styles.stickyNav, { opacity: navOpacity }]}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.stickyNavLine} />
        <View style={styles.stickyNavContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.stickyNavTitle}>Admin</Text>
          <TouchableOpacity onPress={handleSignOut} style={styles.backBtn}>
            <Ionicons name="log-out-outline" size={20} color={C.crimson} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAll(true)}
            tintColor={C.crimson}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        {/* Hero */}
        <LinearGradient
          colors={[C.crimsonDeep, "#1a000a", C.void]}
          style={styles.hero}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <LinearGradient
            colors={["transparent", C.bg]}
            style={styles.heroFade}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          />
          <View style={styles.heroContent}>
            <View style={styles.heroTopRow}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.floatBack}>
                <BlurView intensity={60} tint="dark" style={styles.floatBackBlur}>
                  <Ionicons name="arrow-back" size={20} color={C.white} />
                </BlurView>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSignOut} style={styles.floatBack}>
                <BlurView intensity={60} tint="dark" style={styles.floatBackBlur}>
                  <Ionicons name="log-out-outline" size={20} color={C.crimson} />
                </BlurView>
              </TouchableOpacity>
            </View>
            <View style={styles.adminBadgeRow}>
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={11} color={C.crimson} />
                <Text style={styles.adminBadgeText}>SUPER ADMIN</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>Dashboard</Text>
            <Text style={styles.heroSub}>{user?.email}</Text>
          </View>
        </LinearGradient>

        <Animated.View style={{ opacity: fadeAnim }}>

          {/* API error banner */}
          {apiError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={C.crimson} />
              <Text style={styles.errorBannerText}>{apiError}</Text>
              <TouchableOpacity onPress={() => fetchAll()}>
                <Text style={styles.errorBannerRetry}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabRow}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={activeTab === tab.key ? C.crimson : C.dim}
                />
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {tab.badge ? (
                  <View style={[styles.tabBadge, tab.badgeColor && { backgroundColor: tab.badgeColor }]}>
                    <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

          {/* ═══════════ OVERVIEW TAB ═══════════ */}
          {activeTab === "overview" && (
            <View style={styles.body}>

              {/* ⚡ Real-time Active Users */}
              {activeUsers !== null && (
                <Animated.View style={[styles.liveCard, { opacity: fadeAnim }]}>
                  <View style={styles.liveLeft}>
                    <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                    <Text style={styles.liveLabel}>LIVE</Text>
                    <Text style={styles.liveDesc}>Active Now</Text>
                  </View>
                  <Text style={styles.liveCount}>{activeUsers}</Text>
                  <Text style={styles.liveUnit}>users</Text>
                  <View style={styles.liveRefreshInfo}>
                    <Ionicons name="refresh-outline" size={11} color={C.dimmer} />
                    <Text style={styles.liveRefreshText}>30s</Text>
                  </View>
                </Animated.View>
              )}

              {/* Stat cards — all from the backend */}
              <View style={styles.statsGrid}>
                <StatCard
                  icon="people"
                  label="Total Users"
                  value={stats?.totalUsers?.toLocaleString() ?? "0"}
                  sub={stats?.newUsersToday ? `+${stats.newUsersToday} today` : null}
                  color="#3b82f6"
                  anim={statAnims[0]}
                />
                <StatCard
                  icon="person-add"
                  label="New This Week"
                  value={stats?.newUsersThisWeek?.toLocaleString() ?? "0"}
                  sub={stats?.activeThisWeek ? `${stats.activeThisWeek} active` : null}
                  color="#22c55e"
                  anim={statAnims[1]}
                />
                <StatCard
                  icon="ban"
                  label="Banned"
                  value={stats?.bannedCount?.toLocaleString() ?? "0"}
                  color={C.crimson}
                  anim={statAnims[2]}
                />
                <StatCard
                  icon="pulse"
                  label="Active / Week"
                  value={stats?.activeThisWeek?.toLocaleString() ?? "0"}
                  color={C.crimson}
                  anim={statAnims[3]}
                />
              </View>

              {/* Recent Signups */}
              <SectionHeader title={`Recent Signups`} icon="person-add-outline" />
              <View style={styles.panel}>
                {recentUsers.length === 0 ? (
                  <Text style={styles.emptyText}>No users yet.</Text>
                ) : (
                  recentUsers.slice(0, 5).map((u, i) => {
                    const letter = u.email?.[0]?.toUpperCase() || "?";
                    return (
                      <View
                        key={u.email || i}
                        style={[
                          styles.userRow,
                          i < Math.min(recentUsers.length, 5) - 1 && styles.userRowBorder,
                        ]}
                      >
                        <View style={[styles.userAvatar, u.isBanned && styles.userAvatarBanned]}>
                          <Text style={[styles.userAvatarLetter, u.isBanned && { color: C.dimmer }]}>{letter}</Text>
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
                          <View style={styles.userMetaRow}>
                            <Text style={styles.userMeta}>Joined {u.joinedAgo}</Text>
                            {u.subscription === "premium" && (
                              <View style={[styles.bypassBadge, { backgroundColor: "rgba(234,179,8,0.1)", borderColor: "rgba(234,179,8,0.3)" }]}>
                                <Ionicons name="star" size={9} color="#eab308" />
                                <Text style={[styles.bypassBadgeText, { color: "#eab308" }]}>Premium</Text>
                              </View>
                            )}
                            {u.otpBypass && (
                              <View style={styles.bypassBadge}>
                                <Ionicons name="key" size={9} color="#22c55e" />
                                <Text style={styles.bypassBadgeText}>OTP off</Text>
                              </View>
                            )}
                            {u.isBanned && (
                              <View style={styles.bannedBadge}>
                                <Text style={styles.bannedBadgeText}>Banned</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Monthly Visits Chart */}
              <SectionHeader title="Monthly Visits" icon="stats-chart-outline" />
              {monthlyVisits.length === 0 ? (
                <View style={[styles.panel, { padding: 20 }]}>
                  <Text style={styles.emptyText}>No visit data yet.</Text>
                </View>
              ) : (
                <VisitsAreaChart data={monthlyVisits} />
              )}

              {/* Recent Activity — real data from SQLite */}
              <SectionHeader title="Recent Activity" icon="pulse-outline" />
              <View style={styles.panel}>
                {activityLog.length === 0 ? (
                  <Text style={styles.emptyText}>No activity yet.</Text>
                ) : (
                  <>
                    {activityLog.map((ev, i) => (
                      <ActivityRow
                        key={ev.id || i}
                        icon={ev.icon}
                        color={ev.color}
                        title={ev.title}
                        sub={ev.sub}
                        time={ev.time}
                        last={i === activityLog.length - 1}
                      />
                    ))}
                    
                    {hasMoreActivity && (
                      <TouchableOpacity 
                        style={styles.loadMoreBtn} 
                        onPress={handleLoadMoreActivity}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <DotCircleLoader size={18} color={C.crimson} />
                        ) : (
                          <>
                            <Text style={styles.loadMoreText}>Load More</Text>
                            <Ionicons name="chevron-down" size={14} color={C.dimmer} />
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>

              {/* Top Anime */}
              <SectionHeader title="Top Anime" icon="trending-up-outline" />
              <View style={styles.panel}>
                {topAnime.length === 0 ? (
                  <Text style={styles.emptyText}>No data yet.</Text>
                ) : (
                  topAnime.slice(0, 5).map((item, i) => (
                    <View
                      key={item.slug || i}
                      style={[styles.animeRow, i < Math.min(topAnime.length, 5) - 1 && styles.animeRowBorder]}
                    >
                      <Text style={styles.animeRank}>#{i + 1}</Text>
                      <View style={styles.animeInfo}>
                        <Text style={styles.animeTitle} numberOfLines={1}>{item.title}</Text>
                      </View>
                      <View style={styles.animeViewsWrap}>
                        <View style={[styles.animeBar, { width: item.views ? Math.max(10, (item.views / Math.max(...topAnime.map(a => a.views || 0), 1)) * 100) + "%" : "10%" }]} />
                        <Text style={styles.animeViews}>{item.views ?? "—"} {item.views ? "views" : ""}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* ═══════════ USERS TAB ═══════════ */}
          {activeTab === "users" && (
            <View style={styles.body}>

              {bypassSet.size > 0 && (
                <View style={styles.bypassCallout}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#22c55e" />
                  <Text style={styles.bypassCalloutText}>
                    {bypassSet.size} user{bypassSet.size > 1 ? "s" : ""} currently bypassing OTP
                  </Text>
                </View>
              )}

              <View style={styles.legendRow}>
                <Ionicons name="key" size={13} color="#22c55e" />
                <Text style={styles.legendText}>
                  Key icon = toggle OTP bypass. Ban icon = ban/unban user.
                </Text>
              </View>

              <SectionHeader title={`All Users (${recentUsers.length})`} icon="people-outline" />
              <View style={styles.panel}>
                {recentUsers.length === 0 ? (
                  <Text style={styles.emptyText}>No users yet. Sign-ups will appear here in real time.</Text>
                ) : (
                  recentUsers.map((u, i) => (
                    <UserRow
                      key={u.email || i}
                      email={u.email}
                      joinedAgo={u.joinedAgo}
                      seenAgo={u.seenAgo}
                      isBanned={u.isBanned}
                      last={i === recentUsers.length - 1}
                      bypassed={bypassSet.has(u.email?.toLowerCase())}
                      onBan={handleBanUser}
                      onToggleBypass={handleToggleBypass}
                      isToggling={togglingBypass === u.email?.toLowerCase()}
                      subscription={u.subscription}
                      onToggleSubscription={handleToggleSubscription}
                    />
                  ))
                )}
              </View>
            </View>
          )}

          {/* ═══════════ SYSTEM TAB ═══════════ */}
          {activeTab === "system" && (
            <View style={styles.body}>
              <SectionHeader title="Scraper Status" icon="globe-outline" />
              <View style={styles.panel}>
                <View style={{ padding: 16, gap: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: C.dim }}>Current Domain:</Text>
                    <Text style={{ color: C.white, fontWeight: "700" }}>{scraperStatus?.domain || "Unknown"}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: C.dim }}>Last Health Check:</Text>
                    <Text style={{ color: C.white }}>{scraperStatus?.lastRequestTime ? new Date(scraperStatus.lastRequestTime).toLocaleString() : "Never"}</Text>
                  </View>
                </View>
              </View>
              
              <SectionHeader title="Actions" icon="construct-outline" />
              <View style={{ gap: 12 }}>
                <TouchableOpacity 
                   style={{ backgroundColor: C.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 10 }}
                  onPress={async () => {
                    Alert.alert("Finding domain...", "Please wait. This may take up to 20 seconds depending on connection.");
                    try {
                      const authHeader = await getAuthHeader();
                      const res = await API.post("/api/admin/scraper-find-domain", {}, { headers: authHeader });
                      if (res.data.success) {
                         setScraperStatus(prev => ({...prev, domain: res.data.domain}));
                         Alert.alert("Success", "Found working domain: " + res.data.domain);
                      }
                    } catch (e) {
                      Alert.alert("Error", "Could not find a working domain.");
                    }
                  }}
                >
                  <Ionicons name="search-outline" size={20} color={C.white} />
                  <Text style={{ color: C.white, fontSize: 15, fontWeight: "600", flex: 1 }}>Find Working Domain</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ backgroundColor: C.crimsonDim, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: C.crimsonBorder, flexDirection: "row", alignItems: "center", gap: 10 }}
                  onPress={async () => {
                    try {
                      const authHeader = await getAuthHeader();
                      const res = await API.post("/api/admin/clear-cache", {}, { headers: authHeader });
                      if (res.data.success) Alert.alert("Success", "System cache cleared.");
                    } catch (e) {
                      Alert.alert("Error", "Could not clear cache.");
                    }
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={C.crimson} />
                  <Text style={{ color: C.crimson, fontSize: 15, fontWeight: "600", flex: 1 }}>Clear Server Cache</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ═══════════ REPORTS TAB ═══════════ */}
          {activeTab === "reports" && (
            <View style={styles.body}>
              <SectionHeader title={`Reports (${reports.length})`} icon="flag-outline" />
              <View style={styles.panel}>
                {reports.length === 0 ? (
                  <Text style={styles.emptyText}>No reports found.</Text>
                ) : (
                  reports.map((r, i) => (
                    <ReportRow
                      key={r._id || i}
                      report={r}
                      last={i === reports.length - 1}
                      onUpdateStatus={async (id, status) => {
                        try {
                          const authHeader = await getAuthHeader();
                          await API.patch(`/api/reports/${id}`, { status }, { headers: authHeader });
                          setReports(prev => prev.map(x => x._id === id ? { ...x, status } : x));
                        } catch {
                          Alert.alert("Error", "Failed to update report.");
                        }
                      }}
                      onDelete={async (id) => {
                        Alert.alert("Delete Report", "Are you sure?", [
                          { text: "Cancel", style: "cancel" },
                          { 
                            text: "Delete", 
                            style: "destructive",
                            onPress: async () => {
                              try {
                                const authHeader = await getAuthHeader();
                                await API.delete(`/api/reports/${id}`, { headers: authHeader });
                                setReports(prev => prev.filter(x => x._id !== id));
                              } catch {
                                Alert.alert("Error", "Failed to delete report.");
                              }
                            }
                          }
                        ]);
                      }}
                    />
                  ))
                )}
              </View>
            </View>
          )}

          <AppFooter />

        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  liveCard: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: 'rgba(34,197,94,0.07)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  liveLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#22c55e',
    shadowColor: '#22c55e', shadowOpacity: 1, shadowRadius: 6, elevation: 4 },
  liveLabel: { color: '#22c55e', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  liveDesc: { color: C.dim, fontSize: 12, fontWeight: '500' },
  liveCount: { color: C.white, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  liveUnit: { color: C.dim, fontSize: 11, fontWeight: '600', marginTop: 4 },
  liveRefreshInfo: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  liveRefreshText: { color: C.dimmer, fontSize: 10 },

  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: C.dim, fontSize: 13 },

  accessDenied: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40, gap: 14 },
  accessDeniedIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    justifyContent: "center", alignItems: "center",
  },
  accessDeniedTitle:   { color: C.white, fontSize: 22, fontWeight: "700" },
  accessDeniedSub:     { color: C.dim,   fontSize: 14, textAlign: "center" },
  accessDeniedBtn: {
    marginTop: 8, backgroundColor: C.crimson,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 30,
  },
  accessDeniedBtnText: { color: C.white, fontSize: 15, fontWeight: "700" },

  stickyNav: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 100, overflow: "hidden" },
  stickyNavLine: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: 1, backgroundColor: "rgba(255,255,255,0.07)", opacity: 1,
  },
  stickyNavContent: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 54 : 42, paddingBottom: 12, paddingHorizontal: 16,
  },
  stickyNavTitle: { color: C.white, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: C.border,
    justifyContent: "center", alignItems: "center",
  },

  hero: { height: 210, justifyContent: "flex-end", overflow: "hidden" },
  heroFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 80 },
  heroContent: { padding: 16, paddingTop: Platform.OS === "ios" ? 54 : 42 },
  heroTopRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 14,
  },
  floatBack:     { alignSelf: "flex-start" },
  floatBackBlur: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  adminBadgeRow: { marginBottom: 6 },
  adminBadge: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
  },
  adminBadgeText: { color: C.dim, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  heroTitle: { color: C.white, fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
  heroSub:   { color: C.dim,   fontSize: 12, marginTop: 2 },

  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    margin: 16, borderRadius: 12, padding: 12,
  },

  loadMoreBtn: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.03)",
  },
  loadMoreText: {
    color: C.dim,
    fontSize: 13,
    fontWeight: "600",
  },
  errorBannerText:  { color: C.dim, fontSize: 12, flex: 1 },
  errorBannerRetry: { color: C.white, fontSize: 12, fontWeight: "700" },

  tabRow: {
    flexDirection: "row", backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 16, gap: 4,
  },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 13, paddingHorizontal: 12,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabActive:     { borderBottomColor: C.crimson },
  tabText:       { color: C.dim,   fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: C.white, fontSize: 13, fontWeight: "700" },
  tabBadge: {
    backgroundColor: C.crimson, paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 20, minWidth: 18, alignItems: "center",
  },
  tabBadgeText: { color: C.white, fontSize: 10, fontWeight: "800" },

  body: { padding: 16, paddingBottom: 40 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  statCard: {
    width: "47.5%", backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, borderRadius: 16,
    padding: 14, alignItems: "flex-start", gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1, marginLeft: 6,
  },
  statusBadgeText: { fontSize: 8, fontWeight: "800" },
  reportDesc: { color: C.dim, fontSize: 11, marginTop: 4, lineHeight: 16 },
  statIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    borderWidth: 1, justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  statValue: { color: C.white, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { color: C.dim, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  statSub:   { fontSize: 11, fontWeight: "700", marginTop: 1 },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginBottom: 10, marginTop: 4,
  },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: C.crimson, marginRight: 2 },
  sectionTitle:  { color: C.white, fontSize: 14, fontWeight: "700", letterSpacing: -0.2, flex: 1 },

  panel: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, overflow: "hidden", marginBottom: 24,
  },

  actRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  actRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  actIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    borderWidth: 1, justifyContent: "center", alignItems: "center",
  },
  actInfo:  { flex: 1 },
  actTitle: { color: C.white, fontSize: 12, fontWeight: "600" },
  actSub:   { color: C.dim,   fontSize: 11, marginTop: 1 },
  actTime:  { color: C.dimmer, fontSize: 10, minWidth: 28, textAlign: "right" },

  animeRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  animeRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  animeRank:      { color: C.crimson, fontSize: 13, fontWeight: "800", width: 22 },
  animeInfo:      { flex: 1 },
  animeTitle:     { color: C.white, fontSize: 13, fontWeight: "600" },
  animeViewsWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  animeBar:       { height: 4, borderRadius: 2, backgroundColor: C.crimson, opacity: 0.7 },
  animeViews:     { color: C.dim, fontSize: 11, minWidth: 32, textAlign: "right" },

  legendRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    marginBottom: 12, paddingHorizontal: 2,
  },
  legendText: { color: C.dim, fontSize: 12, flex: 1, lineHeight: 18 },

  bypassCallout: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(34,197,94,0.08)",
    borderWidth: 1, borderColor: "rgba(34,197,94,0.22)",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 14,
  },
  bypassCalloutText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },

  userRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  userRowBorder:   { borderBottomWidth: 1, borderBottomColor: C.border },
  userAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    justifyContent: "center", alignItems: "center",
  },
  userAvatarBanned: { backgroundColor: C.surface, borderColor: C.border },
  userAvatarLetter: { color: C.dim, fontSize: 15, fontWeight: "800" },
  userInfo:    { flex: 1 },
  userEmail:   { color: C.white, fontSize: 13, fontWeight: "600" },
  userMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  userMeta:    { color: C.dim, fontSize: 11 },

  bypassBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1, borderColor: "rgba(34,197,94,0.30)",
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
  },
  bypassBadgeText: { color: "#22c55e", fontSize: 9, fontWeight: "700" },

  bannedBadge: {
    backgroundColor: C.crimsonDim, borderWidth: 1, borderColor: C.crimsonBorder,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
  },
  bannedBadgeText: { color: C.crimson, fontSize: 9, fontWeight: "700" },

  userActions:    { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border,
    justifyContent: "center", alignItems: "center",
  },
  actionBtnBypass: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.30)",
  },
  actionBtnPremium: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderColor: "rgba(234, 179, 8, 0.30)",
  },

  emptyText:  { color: C.dim, fontSize: 13, padding: 20, textAlign: "center" },
  footer:     { alignItems: "center", paddingVertical: 20 },
  footerText: { color: C.dimmer, fontSize: 11 },
});