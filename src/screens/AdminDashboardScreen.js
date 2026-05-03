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
  Modal,
  TextInput,
  ActivityIndicator,
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

function SkeletonStat() {
  return (
    <View style={{ width: '48%', height: 100, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, overflow: 'hidden' }}>
      <LinearGradient colors={["transparent", "rgba(255,255,255,0.05)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

function SkeletonDashboard() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}>
      <View style={{ height: 200, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 24, marginBottom: 30 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </View>
      <View style={{ height: 150, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, marginTop: 30 }} />
    </View>
  );
}

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
                  boxShadow: '0 0 4px rgba(220,20,60,0.8)',
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
                boxShadow: '0 0 6px rgba(220,20,60,1)',
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
  email, joinedAgo, seenAgo, last, onToggleBypass, bypassed, isToggling,
  subscription, onToggleSubscription, onDeleteUser, onEditUser
}) {
  const letter = email?.[0]?.toUpperCase() || "?";
  return (
    <View style={[styles.userRow, !last && styles.userRowBorder, isToggling && { opacity: 0.5 }]}>
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarLetter}>{letter}</Text>
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.userEmail} numberOfLines={1}>{email}</Text>
        <View style={styles.userMetaRow}>
          <Text style={styles.userMeta}>Joined {joinedAgo} · Active {seenAgo}</Text>
          {bypassed && (
            <View style={styles.bypassBadge}>
              <Ionicons name="key" size={9} color="#22c55e" />
              <Text style={styles.bypassBadgeText}>OTP disabled</Text>
            </View>
          )}
          {subscription === "premium" && (
            <View style={[styles.bypassBadge, { backgroundColor: "rgba(234,179,8,0.1)", borderColor: "rgba(234,179,8,0.3)" }]}>
              <Ionicons name="star" size={9} color="#eab308" />
              <Text style={[styles.bypassBadgeText, { color: "#eab308" }]}>Premium</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.userActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onEditUser({ email, name: email.split('@')[0], subscription })}
          hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
        >
          <Ionicons name="create-outline" size={15} color={C.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, bypassed && styles.actionBtnBypass]}
          onPress={() => onToggleBypass(email)}
          hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
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
          hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
          disabled={isToggling}
        >
          <Ionicons
            name={subscription === 'premium' ? "star" : "star-outline"}
            size={15}
            color={subscription === 'premium' ? "#eab308" : C.dimmer}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnBanned, { marginLeft: 4 }]}
          onPress={() => onDeleteUser(email)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="trash" size={15} color={C.crimson} />
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
  const [reports,     setReports]     = useState([]);
  const [activeTab,   setActiveTab]   = useState("overview");
  const [bypassSet,   setBypassSet]   = useState(new Set()); // emails that bypass OTP
  const [apiError,    setApiError]    = useState(null);
  const [monthlyVisits, setMonthlyVisits] = useState([]);
  const [togglingBypass, setTogglingBypass] = useState(null);
  const [activityOffset, setActivityOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreActivity, setHasMoreActivity] = useState(true);
  const [activeUsers, setActiveUsers] = useState(null);
  
  const [customAnimes, setCustomAnimes] = useState([]);
  const [allComments, setAllComments]   = useState([]);
  
  const [pendingUsers, setPendingUsers] = useState([]);
  const [subRequests, setSubRequests] = useState([]);
  
  // UI States for Forms & Modals
  const [userEditModal, setUserEditModal] = useState(null); // { email, name, subscription }
  const [animeModal, setAnimeModal] = useState(null); // { slug, title, ... }
  const [episodeModal, setEpisodeModal] = useState(null); // { animeId, title }
  const [episodeForm, setEpisodeForm] = useState({ number: "", title: "", videoUrl: "", thumbnail: "", _id: null });
  
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // CMS Search States
  const [cmsSearchQuery, setCmsSearchQuery] = useState("");
  const [cmsSearchResults, setCmsSearchResults] = useState([]);
  const [searchingCMS, setSearchingCMS] = useState(false);

  // Feedback Reply State
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

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
      const [statsRes, animeRes, usersRes, activityRes, visitsRes, reportsRes, customRes, commentsRes, pendingUsersRes, subRequestsRes] = await Promise.allSettled([
        API.get("/api/admin/stats",        cfg),
        API.get("/api/admin/top-anime",    cfg),
        API.get("/api/admin/recent-users?limit=50", cfg),
        API.get("/api/admin/activity?limit=10&skip=0",     cfg),
        API.get("/api/admin/monthly-visits", cfg),
        API.get("/api/admin/reports", cfg),
        API.get("/api/admin/anime", cfg),
        API.get("/api/admin/comments/all", cfg),
        API.get("/api/admin/pending-verifications", cfg),
        API.get("/api/admin/subscription-requests", cfg)
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

      if (visitsRes.status === "fulfilled") {
        setMonthlyVisits(visitsRes.value.data.visits || []);
      }
      if (reportsRes.status === "fulfilled") {
        setReports(reportsRes.value.data.reports || []);
      }
      if (customRes.status === "fulfilled") {
        setCustomAnimes(customRes.value.data.animes || []);
      }
      if (commentsRes.status === "fulfilled" && commentsRes.value.data) {
        setAllComments(commentsRes.value.data.comments || []);
      }

      if (pendingUsersRes?.status === "fulfilled") {
        setPendingUsers(pendingUsersRes.value.data.users || []);
      }
      if (subRequestsRes?.status === "fulfilled") {
        setSubRequests(subRequestsRes.value.data.requests || []);
      }
    } catch (err) {
      setApiError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── New Handlers ──────────────────────────────────────────────────────────
  const handleApproveUser = async (email) => {
    try {
      const cfg = { headers: await getAuthHeader() };
      await API.post(`/api/admin/verify-user/${encodeURIComponent(email)}`, {}, cfg);
      setPendingUsers(prev => prev.filter(u => u.email !== email));
      if (Platform.OS === 'web') {
        window.alert(`User ${email} verified.`);
      } else {
        Alert.alert("Success", `User ${email} verified.`);
      }
      // Also update recent users if they are there
      setRecentUsers(prev => prev.map(u => u.email === email ? { ...u, account_status: 'active', is_verified: true } : u));
    } catch (err) { 
      if (Platform.OS === 'web') window.alert("Error: Failed to verify user.");
      else Alert.alert("Error", "Failed to verify user."); 
    }
  };

  const handleProcessSub = async (id, status, note = "") => {
    try {
      const cfg = { headers: await getAuthHeader() };
      const endpoint = status === 'approved' ? 'approve' : 'reject';
      await API.post(`/api/admin/subscription-requests/${id}/${endpoint}`, { adminNote: note }, cfg);
      setSubRequests(prev => prev.filter(r => r._id !== id));
      if (Platform.OS === 'web') {
        window.alert(`Subscription request ${status}.`);
      } else {
        Alert.alert("Success", `Subscription request ${status}.`);
      }
      if (status === 'approved') fetchAll(true); // Refresh all to see premium status
    } catch (err) { 
      if (Platform.OS === 'web') window.alert(`Error: Failed to ${status} subscription.`);
      else Alert.alert("Error", `Failed to ${status} subscription.`); 
    }
  };

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

  const handleSendReply = async (feedbackId) => {
    if (!replyText.trim()) return;
    setSendingReply(true);

    try {
      const authHeader = await getAuthHeader();
      const res = await API.post(
        "/api/admin/reply-feedback",
        { feedbackId, reply: replyText.trim() },
        { headers: authHeader }
      );

      if (res.data?.success) {
        setReports(prev => prev.map(r => r.id === feedbackId ? { ...r, adminReply: replyText.trim(), status: 'resolved' } : r));
        setReplyingTo(null);
        setReplyText("");
        Alert.alert("Success", "Reply successfully sent!");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to send reply.");
    } finally {
      setSendingReply(false);
    }
  };

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

  // ── CMS Search & Import ──────────────────────────────────────────────────
  const handleCMSSearch = async () => {
    if (!cmsSearchQuery.trim()) return;
    setSearchingCMS(true);
    try {
      const res = await API.get(`/api/anime/search?q=${encodeURIComponent(cmsSearchQuery.trim())}`);
      setCmsSearchResults(res.data.results || []);
    } catch (err) {
      console.error("CMS Search error:", err);
    } finally {
      setSearchingCMS(false);
    }
  };

  const handleImportAnime = async (item) => {
    // If it's already a custom anime, just open it for editing
    const existing = customAnimes.find(a => a.slug === item.slug);
    if (existing) {
      setAnimeModal(existing);
      return;
    }

    setLoading(true);
    try {
      const res = await API.get(`/api/anime/details/${item.slug}`);
      if (res.data.success) {
        // Pre-fill modal with scraped data
        setAnimeModal({
          title: res.data.title,
          slug: res.data.slug,
          description: res.data.description,
          image: res.data.image,
          releaseDate: res.data.released || res.data.premiered || "",
          status: res.data.status || "Ongoing",
          genres: res.data.genres || [],
          type: res.data.type || "TV"
        });
      }
    } catch (err) {
      Alert.alert("Error", "Failed to fetch global details for import.");
    } finally {
      setLoading(false);
    }
  };

  // ── CMS & Admin Actions ──────────────────────────────────────────────────
  const handleDeleteUser = async (email) => {
    const performDelete = async () => {
      try {
        const cfg = { headers: await getAuthHeader() };
        await API.delete(`/api/admin/users/${encodeURIComponent(email)}`, cfg);
        setRecentUsers(prev => prev.filter(u => u.email !== email));
        setPendingUsers(prev => prev.filter(u => u.email !== email)); // Update pending list too
        if (Platform.OS === 'web') {
           window.alert(`User ${email} deleted.`);
        } else {
           Alert.alert("Success", "User deleted successfully.");
        }
      } catch (err) { 
        const msg = err.response?.data?.error || err.message;
        if (Platform.OS === 'web') window.alert("Error: " + msg);
        else Alert.alert("Error", msg);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to permanently delete ${email}?`)) {
        performDelete();
      }
    } else {
      Alert.alert("Delete User", `Are you sure you want to permanently delete ${email}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete }
      ]);
    }
  };

  const handleUpdateUser = async () => {
    if (!userEditModal?.email) return;
    try {
      const cfg = { headers: await getAuthHeader() };
      const res = await API.put(`/api/admin/users/${encodeURIComponent(userEditModal.email)}`, {
        name: userEditModal.name,
        subscription: userEditModal.subscription
      }, cfg);
      if (res.data.success) {
        setRecentUsers(prev => prev.map(u => u.email === userEditModal.email ? { ...u, ...res.data.user } : u));
        setUserEditModal(null);
        Alert.alert("Success", "User updated.");
      }
    } catch (err) { Alert.alert("Error", err.message); }
  };

  const handleSaveAnime = async (animeData) => {
    try {
      const cfg = { headers: await getAuthHeader() };
      let res;
      if (animeData._id) {
        res = await API.put(`/api/admin/anime/${animeData._id}`, animeData, cfg);
      } else {
        res = await API.post("/api/admin/anime", animeData, cfg);
      }

      if (res.data.success) {
        if (animeData._id) {
          setCustomAnimes(prev => prev.map(a => a._id === animeData._id ? res.data.anime : a));
        } else {
          setCustomAnimes(prev => [res.data.anime, ...prev]);
        }
        setAnimeModal(null);
        Alert.alert("Success", "Anime saved.");
      }
    } catch (err) { Alert.alert("Error", err.message); }
  };

  const handleDeleteAnime = async (id, title) => {
    const performDelete = async () => {
      try {
        const cfg = { headers: await getAuthHeader() };
        await API.delete(`/api/admin/anime/${encodeURIComponent(id)}`, cfg);
        setCustomAnimes(prev => prev.filter(a => (a._id || a.id) !== id));
        if (Platform.OS === 'web') {
           window.alert("Anime and episodes deleted.");
        } else {
           Alert.alert("Success", "Anime and episodes deleted.");
        }
      } catch (err) { 
        const msg = err.response?.data?.error || err.message;
        if (Platform.OS === 'web') window.alert("Error: " + msg);
        else Alert.alert("Error", msg);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete "${title}" and all its custom episodes?`)) {
        performDelete();
      }
    } else {
      Alert.alert("Delete Anime", `Are you sure you want to delete "${title}" and all its custom episodes?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete }
      ]);
    }
  };

  const [currentEpisodes, setCurrentEpisodes] = useState([]);
  const [fetchingEpisodes, setFetchingEpisodes] = useState(false);

  const openEpisodeManager = async (anime) => {
    setFetchingEpisodes(true);
    setEpisodeModal({ animeId: anime.slug, animeTitle: anime.title });
    try {
      const cfg = { headers: await getAuthHeader() };
      const res = await API.get(`/api/admin/episodes/${anime.slug}`, cfg);
      setCurrentEpisodes(res.data.episodes || []);
    } catch (err) { 
      Alert.alert("Error", "Failed to fetch episodes"); 
      setEpisodeModal(null); // Close if fetch fails
    }
    finally { setFetchingEpisodes(false); }
  };

  const handleSaveEpisode = async () => {
    try {
      const cfg = { headers: await getAuthHeader() };
      let res;
      if (episodeForm._id) {
        res = await API.put(`/api/admin/episodes/${episodeForm._id}`, episodeForm, cfg);
      } else {
        res = await API.post("/api/admin/episodes", { ...episodeForm, animeId: episodeModal.animeId }, cfg);
      }

      if (res.data.success) {
        if (episodeForm._id) {
          setCurrentEpisodes(prev => prev.map(e => e._id === episodeForm._id ? res.data.episode : e).sort((a,b) => a.number - b.number));
        } else {
          setCurrentEpisodes(prev => [...prev, res.data.episode].sort((a,b) => a.number - b.number));
        }
        setEpisodeForm({ number: "", title: "", videoUrl: "", thumbnail: "", _id: null });
        Alert.alert("Success", episodeForm._id ? "Episode updated." : "Episode added.");
      }
    } catch (err) { Alert.alert("Error", err.response?.data?.error || err.message); }
  };

  const handleDeleteEpisode = async (id) => {
    if (!id) return Alert.alert("Error", "Missing Episode ID");
    
    const performDelete = async () => {
      try {
        const cfg = { headers: await getAuthHeader() };
        await API.delete(`/api/admin/episodes/${encodeURIComponent(id)}`, cfg);
        setCurrentEpisodes(prev => prev.filter(e => (e._id || e.id) !== id));
        if (Platform.OS === 'web') window.alert("Episode deleted.");
        else Alert.alert("Success", "Episode deleted.");
      } catch (err) { 
        const msg = err.response?.data?.error || err.message;
        if (Platform.OS === 'web') window.alert("Error: " + msg);
        else Alert.alert("Error", msg);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Delete this episode?")) {
        performDelete();
      }
    } else {
      Alert.alert("Delete Episode", "Delete this episode?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete }
      ]);
    }
  };

  const handleDeleteComment = async (id) => {
    console.log("[Admin] Attempting to delete comment ID:", id);
    if (!id) return Alert.alert("Error", "Missing Comment ID");

    const performDelete = async () => {
      try {
        const cfg = { headers: await getAuthHeader() };
        const encodedId = encodeURIComponent(id);
        console.log(`[Admin] Deleting comment via: /api/admin/comments/${encodedId}`);
        
        await API.delete(`/api/admin/comments/${encodedId}`, cfg);
        
        setAllComments(prev => prev.filter(c => (c.id || c._id) !== id));
        if (Platform.OS === 'web') {
           window.alert("Comment deleted.");
        } else {
           Alert.alert("Success", "Comment deleted.");
        }
      } catch (err) { 
        console.error("[Admin] Delete comment error:", err);
        const msg = err.response?.data?.error || err.message;
        if (Platform.OS === 'web') window.alert("Error: " + msg);
        else Alert.alert("Error", msg); 
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to remove this comment?")) {
        performDelete();
      }
    } else {
      Alert.alert("Delete Comment", "Are you sure you want to remove this comment?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete }
      ]);
    }
  };

  const handleDeleteReport = async (id) => {
    if (!id) return Alert.alert("Error", "Missing Report ID");
    
    const performDelete = async () => {
      try {
        const cfg = { headers: await getAuthHeader() };
        await API.delete(`/api/admin/feedbacks/${encodeURIComponent(id)}`, cfg);
        setReports(prev => prev.filter(r => (r.id || r._id) !== id));
        if (Platform.OS === 'web') {
           window.alert("Feedback report deleted.");
        } else {
           Alert.alert("Success", "Feedback report deleted.");
        }
      } catch (err) { 
        const msg = err.response?.data?.error || err.message;
        if (Platform.OS === 'web') window.alert("Error: " + msg);
        else Alert.alert("Error", msg);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to remove this report?")) {
        performDelete();
      }
    } else {
      Alert.alert("Delete Feedback", "Are you sure you want to remove this report?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete }
      ]);
    }
  };

  const handleBroadcast = async () => {
    if (!announcementTitle.trim() || !announcementMsg.trim()) return Alert.alert("Error", "Title and info required");
    setSendingBroadcast(true);
    try {
      const authHeader = await getAuthHeader();
      await API.post("/api/admin/send-notification", { title: announcementTitle, message: announcementMsg }, { headers: authHeader });
      Alert.alert("Success", "Broadcast sent to all users!");
      setAnnouncementTitle(""); setAnnouncementMsg("");
    } catch (err) { Alert.alert("Error", "Failed to broadcast"); }
    finally { setSendingBroadcast(false); }
  };

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
    return <SkeletonDashboard />;
  }

  const TABS = [
    { key: "overview", label: "Overview", icon: "grid-outline" },
    { key: "users",    label: "Users",    icon: "people-outline" },
    { key: "verification", label: "Verify", icon: "shield-checkmark-outline",
      badge: pendingUsers.length > 0 ? pendingUsers.length : null, badgeColor: C.crimson },
    { key: "subscriptions", label: "Payments", icon: "cash-outline",
      badge: subRequests.length > 0 ? subRequests.length : null, badgeColor: "#22c55e" },
    { key: "cms", label: "Content", icon: "film-outline" },
    { key: "comments", label: "Comments", icon: "chatbox-ellipses-outline" },
    { key: "announcements", label: "Announce", icon: "megaphone-outline" },
    { key: "feedbacks", label: "Feedback", icon: "help-buoy-outline" },
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
                        <View style={styles.userAvatar}>
                          <Text style={styles.userAvatarLetter}>{letter}</Text>
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
                                <Text style={styles.bypassBadgeText}>OTP disabled</Text>
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
                          <View style={{ marginTop: 10 }}>
                            <SkeletonGrid cardWidth={cardWidth} count={cols} />
                          </View>
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
                        <Ionicons name="eye-outline" size={13} color={C.dimmer} />
                        <Text style={styles.animeViews}>{item.views?.toLocaleString() ?? "—"}</Text>
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
                  Key icon = toggle OTP bypass. Star icon = toggle premium status.
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
                      last={i === recentUsers.length - 1}
                      bypassed={bypassSet.has(u.email?.toLowerCase())}
                      onToggleBypass={handleToggleBypass}
                      isToggling={togglingBypass === u.email?.toLowerCase()}
                      subscription={u.subscription}
                      onToggleSubscription={handleToggleSubscription}
                      onDeleteUser={handleDeleteUser}
                      onEditUser={(data) => setUserEditModal(data)}
                    />
                  ))
                )}
              </View>
            </View>
          )}

          {/* ═══════════ VERIFICATION TAB ═══════════ */}
          {activeTab === "verification" && (
            <View style={styles.body}>
              <SectionHeader title={`Pending Verification (${pendingUsers.length})`} icon="shield-checkmark-outline" />
              <View style={styles.panel}>
                {pendingUsers.length === 0 ? (
                  <Text style={styles.emptyText}>No users waiting for verification.</Text>
                ) : (
                  pendingUsers.map((u, i) => (
                    <View key={u.email || i} style={[styles.userRow, i < pendingUsers.length - 1 && styles.userRowBorder]}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarLetter}>{u.email[0].toUpperCase()}</Text>
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userEmail}>{u.email}</Text>
                        <Text style={styles.userMeta}>Joined {u.joinedAgo}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity 
                          style={[styles.addBtn, { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)' }]}
                          onPress={() => handleApproveUser(u.email)}
                        >
                          <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                          <Text style={[styles.addBtnText, { color: "#22c55e" }]}>Approve</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.addBtn, { backgroundColor: 'rgba(220,20,60,0.1)', borderColor: 'rgba(220,20,60,0.3)' }]}
                          onPress={() => handleDeleteUser(u.email)}
                        >
                          <Ionicons name="close-circle" size={16} color="#DC143C" />
                          <Text style={[styles.addBtnText, { color: "#DC143C" }]}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* ═══════════ SUBSCRIPTIONS TAB ═══════════ */}
          {activeTab === "subscriptions" && (
            <View style={styles.body}>
              <SectionHeader title={`Subscription Requests (${subRequests.length})`} icon="cash-outline" />
              <View style={styles.panel}>
                {subRequests.length === 0 ? (
                  <Text style={styles.emptyText}>No pending subscription requests.</Text>
                ) : (
                  subRequests.map((req, i) => (
                    <View key={req._id || i} style={[styles.actRow, i < subRequests.length - 1 && styles.actRowBorder]}>
                      <View style={styles.actInfo}>
                        <Text style={styles.actTitle}>{req.userEmail}</Text>
                        <Text style={styles.actSub}>
                          {req.paymentMethod} · Ref: {req.referenceNumber} · {req.amount} PHP
                        </Text>
                        <Text style={styles.actTime}>{new Date(req.createdAt).toLocaleString()}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity 
                          style={[styles.miniActionBtn, { borderColor: 'rgba(34,197,94,0.3)' }]}
                          onPress={() => handleProcessSub(req._id, 'approved')}
                        >
                          <Ionicons name="checkmark" size={14} color="#22c55e" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.miniActionBtn, { borderColor: 'rgba(220,20,60,0.3)' }]}
                          onPress={() => {
                            if (Platform.OS === 'web') {
                              const note = window.prompt("Reason for rejection?");
                              if (note !== null) handleProcessSub(req._id, 'rejected', note);
                            } else {
                              Alert.prompt("Reject Request", "Reason for rejection?", [
                                { text: "Cancel", style: "cancel" },
                                { text: "Reject", style: "destructive", onPress: (note) => handleProcessSub(req._id, 'rejected', note) }
                              ]);
                            }
                          }}
                        >
                          <Ionicons name="close" size={14} color={C.crimson} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* ═══════════ CMS TAB (ANIME) ═══════════ */}
          {activeTab === "cms" && (
            <View style={styles.body}>
              
              {/* CMS Search Section */}
              <View style={[styles.panel, { marginBottom: 20, padding: 16 }]}>
                <Text style={[styles.modalTitle, { fontSize: 16, marginBottom: 12 }]}>Search Global Anime to Edit</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput 
                    style={[styles.simpleInput, { flex: 1, marginBottom: 0 }]}
                    placeholder="Search global anime (e.g. Naruto)"
                    placeholderTextColor={C.dimmer}
                    value={cmsSearchQuery}
                    onChangeText={setCmsSearchQuery}
                    onSubmitEditing={handleCMSSearch}
                  />
                  <TouchableOpacity 
                    style={[styles.addBtn, { paddingHorizontal: 16, backgroundColor: 'rgba(75,163,255,0.1)', borderColor: 'rgba(75,163,255,0.3)' }]}
                    onPress={handleCMSSearch}
                  >
                    {searchingCMS ? <ActivityIndicator size="small" color="#4ba3ff" /> : <Ionicons name="search" size={18} color="#4ba3ff" />}
                  </TouchableOpacity>
                </View>

                {cmsSearchResults.length > 0 && (
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border }}>
                    <Text style={{ color: C.dim, fontSize: 12, marginBottom: 10 }}>Global Search Results:</Text>
                    {cmsSearchResults.slice(0, 5).map((item, i) => (
                      <View key={item.slug || i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                         <View style={{ flex: 1 }}>
                            <Text style={{ color: C.white, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
                            <Text style={{ color: C.dimmer, fontSize: 11 }}>{item.slug}</Text>
                         </View>
                         <TouchableOpacity 
                           style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: C.border }]}
                           onPress={() => handleImportAnime(item)}
                         >
                            <Ionicons name="cloud-download-outline" size={14} color={C.white} />
                            <Text style={[styles.addBtnText, { color: C.white }]}>Import/Edit</Text>
                         </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity onPress={() => setCmsSearchResults([])}>
                       <Text style={{ color: C.crimson, fontSize: 12, textAlign: 'center', marginTop: 5 }}>Clear Results</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <SectionHeader title={`Custom Anime (${customAnimes.length})`} icon="film-outline" />
                <TouchableOpacity 
                  style={styles.addBtn}
                  onPress={() => setAnimeModal({ title: "", slug: "", description: "", image: "", releaseDate: "", status: "Ongoing", genres: [], type: "TV" })}
                >
                  <Ionicons name="add" size={18} color={C.white} />
                  <Text style={styles.addBtnText}>Add New</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.panel}>
                {customAnimes.length === 0 ? (
                  <Text style={styles.emptyText}>No custom anime added yet.</Text>
                ) : (
                  customAnimes.map((anime, i) => (
                    <View key={anime.slug || i} style={[styles.actRow, i < customAnimes.length - 1 && styles.actRowBorder]}>
                      <View style={[styles.actIconWrap, { backgroundColor: 'rgba(220,20,60,0.1)', borderColor: 'rgba(220,20,60,0.3)' }]}>
                        <Ionicons name="play" size={14} color={C.crimson} />
                      </View>
                      <View style={styles.actInfo}>
                        <Text style={styles.actTitle} numberOfLines={1}>{anime.title}</Text>
                        <Text style={[styles.actSub, { color: C.dimmer }]}>{anime.slug} · {anime.releaseDate} · {anime.type}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity 
                          style={styles.miniActionBtn}
                          onPress={() => openEpisodeManager(anime)}
                          hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                        >
                           <Ionicons name="list" size={14} color="#4ba3ff" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.miniActionBtn}
                          onPress={() => setAnimeModal(anime)}
                          hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                        >
                           <Ionicons name="create-outline" size={14} color={C.white} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.miniActionBtn, { borderColor: 'rgba(220,20,60,0.3)' }]}
                          onPress={() => handleDeleteAnime(anime._id || anime.id, anime.title)}
                          hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                        >
                           <Ionicons name="trash-outline" size={14} color={C.crimson} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* ═══════════ COMMENTS TAB ═══════════ */}
          {activeTab === "comments" && (
            <View style={styles.body}>
              <SectionHeader title={`Global Comments (${allComments.length})`} icon="chatbox-ellipses-outline" />
              <View style={styles.panel}>
                {allComments.length === 0 ? (
                  <Text style={styles.emptyText}>No comments available.</Text>
                ) : (
                  allComments.map((comment, i) => (
                    <View key={comment.id || i} style={[styles.actRow, i < allComments.length - 1 && styles.actRowBorder, { minHeight: 70 }]}>
                      <View style={styles.actInfo}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                           <Text style={[styles.actTitle, { color: C.white, fontSize: 13, fontWeight: "700" }]}>{comment.email}</Text>
                           <Text style={styles.actTime}>{new Date(comment.ts).toLocaleDateString()}</Text>
                        </View>
                        <Text style={[styles.actTitle, { color: C.dim, fontSize: 14, lineHeight: 20 }]}>{comment.text}</Text>
                        <Text style={[styles.actSub, { fontSize: 10, marginTop: 6 }]}>Anime ID: {comment.animeId} | Ep: {comment.episodeNum || 'Main'}</Text>
                      </View>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.actionBtnBanned, { alignSelf: 'center', marginLeft: 10 }]}
                        onPress={() => handleDeleteComment(comment.id || comment._id)}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        activeOpacity={0.7}
                      >
                         <Ionicons name="trash-outline" size={16} color={C.crimson} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* ═══════════ ANNOUNCEMENTS TAB ═══════════ */}
          {activeTab === "announcements" && (
            <View style={styles.body}>
              <SectionHeader title="Broadcast Announcement" icon="megaphone-outline" />
              <View style={[styles.panel, { padding: 16 }]}>
                 <Text style={{ color: C.dim, fontSize: 13, marginBottom: 12 }}>
                    Send a global system notification to all users. They will receive it in their notification inbox.
                 </Text>
                 <TextInput
                   style={[styles.modalInput, { minHeight: 40, padding: 12, marginBottom: 10 }]}
                   placeholder="Notification Title (e.g. Scheduled Maintenance)"
                   placeholderTextColor={C.dimmer}
                   value={announcementTitle}
                   onChangeText={setAnnouncementTitle}
                 />
                 <TextInput
                   style={[styles.modalInput, { marginBottom: 16 }]}
                   placeholder="Notification Message..."
                   placeholderTextColor={C.dimmer}
                   multiline textAlignVertical="top"
                   value={announcementMsg}
                   onChangeText={setAnnouncementMsg}
                 />
                 <TouchableOpacity 
                   style={[styles.modalSubmitBtn, sendingBroadcast && { opacity: 0.7 }]} 
                   onPress={handleBroadcast} disabled={sendingBroadcast}
                 >
                   {sendingBroadcast ? <ActivityIndicator size="small" color={C.white} /> : (
                     <>
                        <Ionicons name="paper-plane" size={16} color={C.white} />
                        <Text style={styles.modalSubmitText}>Send Broadcast</Text>
                     </>
                   )}
                 </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ═══════════ FEEDBACKS TAB ═══════════ */}
          {activeTab === "feedbacks" && (
            <View style={styles.body}>
              <SectionHeader title={`User Feedback (${reports.length})`} icon="chatbubble-ellipses-outline" />
              <View style={styles.panel}>
                {reports.length === 0 ? (
                  <Text style={styles.emptyText}>No feedback available.</Text>
                ) : (
                  reports.map((fb, i) => (
                    <View key={fb.id || i} style={[styles.actRow, i < reports.length - 1 && styles.actRowBorder, { minHeight: 70 }]}>
                      <View style={[styles.actIconWrap, { backgroundColor: 'rgba(220,20,60,0.1)', borderColor: 'rgba(220,20,60,0.3)' }]}>
                        <Ionicons 
                          name={fb.type === 'bug' ? 'bug' : fb.type === 'feature' ? 'bulb' : 'chatbubble'} 
                          size={14} 
                          color={C.crimson} 
                        />
                      </View>
                      <View style={styles.actInfo}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.actTitle, { color: C.white, fontSize: 13, fontWeight: "700" }]}>{fb.email}</Text>
                            {fb.email === 'Guest' && (
                              <View style={[styles.miniBadge, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                                <Text style={[styles.miniBadgeText, { color: C.dimmer }]}>GUEST</Text>
                              </View>
                            )}
                            {fb.status === 'resolved' ? (
                              <View style={[styles.miniBadge, { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)' }]}>
                                <Text style={[styles.miniBadgeText, { color: "#22c55e" }]}>RESOLVED</Text>
                              </View>
                            ) : (
                              <View style={[styles.miniBadge, { backgroundColor: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.3)' }]}>
                                <Text style={[styles.miniBadgeText, { color: "#eab308" }]}>PENDING</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.actTime}>{new Date(fb.createdAt).toLocaleDateString()}</Text>
                        </View>
                        <Text style={[styles.actTitle, { color: C.dim, fontSize: 14, lineHeight: 20 }]} selectable>
                          {fb.message}
                        </Text>
                        
                        {fb.status === 'resolved' && fb.adminReply ? (
                          <View style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8 }}>
                            <Text style={{ color: '#4ba3ff', fontSize: 11, fontWeight: '700', marginBottom: 2 }}>Admin Reply:</Text>
                            <Text style={{ color: C.white, fontSize: 13 }}>{fb.adminReply}</Text>
                          </View>
                        ) : fb.email !== 'Guest' ? (
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                            <TouchableOpacity 
                              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(75,163,255,0.1)', borderWidth: 1, borderColor: 'rgba(75,163,255,0.3)', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                              onPress={() => setReplyingTo(fb)}
                              hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                            >
                              <Ionicons name="chatbubble-ellipses-outline" size={12} color="#4ba3ff" />
                              <Text style={{ color: '#4ba3ff', fontSize: 11, fontWeight: '700' }}>Reply</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(220,20,60,0.1)', borderWidth: 1, borderColor: 'rgba(220,20,60,0.3)', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                              onPress={() => handleDeleteReport(fb.id || fb._id)}
                              hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                            >
                              <Ionicons name="trash-outline" size={12} color={C.crimson} />
                              <Text style={{ color: C.crimson, fontSize: 11, fontWeight: '700' }}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                             <Text style={{ color: C.dimmer, fontSize: 10, fontStyle: 'italic' }}>* Anonymous feedback (cannot reply)</Text>
                             <TouchableOpacity 
                               onPress={() => handleDeleteReport(fb.id || fb._id)}
                               hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                             >
                                <Ionicons name="trash-outline" size={16} color={C.dimmer} />
                             </TouchableOpacity>
                           </View>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* ═══════════ FOOTER ═══════════ */}

          <AppFooter />

        </Animated.View>
      </Animated.ScrollView>

      {/* ═══════════ REPLY MODAL ═══════════ */}
      <Modal
        visible={!!replyingTo}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reply to Feedback</Text>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setReplyText(""); }}>
                <Ionicons name="close" size={24} color={C.dim} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSelectedFeedback}>
              <Text style={styles.modalFeedbackUser}>{replyingTo?.email}</Text>
              <Text style={styles.modalFeedbackText} numberOfLines={3}>
                "{replyingTo?.message}"
              </Text>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Start drafting your reply..."
              placeholderTextColor={C.dimmer}
              multiline
              autoFocus
              textAlignVertical="top"
              value={replyText}
              onChangeText={setReplyText}
            />

            <TouchableOpacity 
              style={[styles.modalSubmitBtn, sendingReply && { opacity: 0.7 }]} 
              onPress={() => handleSendReply(replyingTo?.id)}
              disabled={sendingReply}
            >
              {sendingReply ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color={C.white} />
                  <Text style={styles.modalSubmitText}>Send Reply</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════ USER EDIT MODAL ═══════════ */}
      <Modal visible={!!userEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit User</Text>
              <TouchableOpacity onPress={() => setUserEditModal(null)}>
                <Ionicons name="close" size={24} color={C.dim} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: C.dim, marginBottom: 12 }}>{userEditModal?.email}</Text>
            
            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 44, paddingVertical: 10 }]}
              value={userEditModal?.name}
              onChangeText={t => setUserEditModal(p => ({ ...p, name: t }))}
              placeholder="Display Name"
              placeholderTextColor={C.dimmer}
            />

            <Text style={styles.inputLabel}>Subscription</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {['free', 'premium'].map(tier => (
                <TouchableOpacity
                  key={tier}
                  style={[styles.tierOption, userEditModal?.subscription === tier && styles.tierOptionActive]}
                  onPress={() => setUserEditModal(p => ({ ...p, subscription: tier }))}
                >
                  <Text style={[styles.tierOptionText, userEditModal?.subscription === tier && styles.tierOptionTextActive]}>
                    {tier.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleUpdateUser}>
              <Text style={styles.modalSubmitText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════ CUSTOM ANIME MODAL ═══════════ */}
      <Modal visible={!!animeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{animeModal?._id ? "Edit Anime" : "New Custom Anime"}</Text>
              <TouchableOpacity onPress={() => setAnimeModal(null)}>
                <Ionicons name="close" size={24} color={C.dim} />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput style={styles.simpleInput} value={animeModal?.title || ""} onChangeText={t => setAnimeModal(p => ({ ...p, title: t }))} />
              
              <Text style={styles.inputLabel}>Slug (Unique key) *</Text>
              <TextInput style={styles.simpleInput} value={animeModal?.slug || ""} onChangeText={t => setAnimeModal(p => ({ ...p, slug: t }))} editable={!animeModal?._id} />
              
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput style={[styles.simpleInput, { height: 80 }]} multiline value={animeModal?.description || ""} onChangeText={t => setAnimeModal(p => ({ ...p, description: t }))} />
              
              <Text style={styles.inputLabel}>Poster Image URL</Text>
              <TextInput style={styles.simpleInput} value={animeModal?.image || ""} onChangeText={t => setAnimeModal(p => ({ ...p, image: t }))} />
              
              <Text style={styles.inputLabel}>Banner Background URL</Text>
              <TextInput style={styles.simpleInput} value={animeModal?.banner || ""} onChangeText={t => setAnimeModal(p => ({ ...p, banner: t }))} placeholder="High-res wide image" placeholderTextColor={C.dimmer} />
              
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Release Date</Text>
                  <TextInput style={styles.simpleInput} value={animeModal?.releaseDate || ""} onChangeText={t => setAnimeModal(p => ({ ...p, releaseDate: t }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Type</Text>
                  <TextInput style={styles.simpleInput} value={animeModal?.type || ""} onChangeText={t => setAnimeModal(p => ({ ...p, type: t }))} />
                </View>
              </View>

              <Text style={styles.inputLabel}>Status</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                {['Ongoing', 'Completed'].map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.tierOption, animeModal?.status === s && styles.tierOptionActive, { paddingVertical: 8 }]}
                    onPress={() => setAnimeModal(p => ({ ...p, status: s }))}
                  >
                    <Text style={[styles.tierOptionText, animeModal?.status === s && styles.tierOptionTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Genres (Comma-separated)</Text>
              <TextInput 
                style={styles.simpleInput} 
                value={Array.isArray(animeModal?.genres) ? animeModal.genres.join(", ") : animeModal?.genres} 
                onChangeText={t => setAnimeModal(p => ({ ...p, genres: t.split(",").map(g => g.trim()).filter(Boolean) }))} 
                placeholder="Action, Adventure, Fantasy"
                placeholderTextColor={C.dimmer}
              />

              <TouchableOpacity style={[styles.modalSubmitBtn, { marginTop: 20 }]} onPress={() => handleSaveAnime(animeModal)}>
                <Text style={styles.modalSubmitText}>Save Anime</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════ EPISODE MANAGER MODAL ═══════════ */}
      <Modal visible={!!episodeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%', width: '95%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Manage Episodes</Text>
                <Text style={{ color: C.dim, fontSize: 12 }}>{episodeModal?.animeTitle}</Text>
              </View>
              <TouchableOpacity onPress={() => setEpisodeModal(null)}>
                <Ionicons name="close" size={24} color={C.dim} />
              </TouchableOpacity>
            </View>

            {fetchingEpisodes ? (
              <ActivityIndicator size="large" color={C.crimson} style={{ margin: 20 }} />
            ) : (
              <>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12, marginBottom: 15 }}>
                  <Text style={{ color: C.white, fontWeight: '700', fontSize: 13, marginBottom: 10 }}>
                    {episodeForm._id ? "Edit Episode" : "Add New Episode"}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                    <TextInput 
                      style={[styles.simpleInput, { flex: 0.3, marginBottom: 0 }]} 
                      placeholder="No." placeholderTextColor={C.dimmer} keyboardType="numeric"
                      onChangeText={v => setEpisodeForm(p => ({ ...p, number: v }))}
                      value={(episodeForm.number || "").toString()}
                    />
                    <TextInput 
                      style={[styles.simpleInput, { flex: 0.7, marginBottom: 0 }]} 
                      placeholder="Episode Title (Optional)" placeholderTextColor={C.dimmer}
                      onChangeText={v => setEpisodeForm(p => ({ ...p, title: v }))}
                      value={episodeForm.title || ""}
                    />
                  </View>
                  
                  <TextInput 
                    style={[styles.simpleInput, { marginBottom: 10 }]} 
                    placeholder="Video Stream URL (m3u8, mp4, etc)" placeholderTextColor={C.dimmer}
                    onChangeText={v => setEpisodeForm(p => ({ ...p, videoUrl: v }))}
                    value={episodeForm.videoUrl || ""}
                  />

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity 
                      style={[styles.modalSubmitBtn, { flex: 2, paddingVertical: 10 }]} 
                      onPress={handleSaveEpisode}
                    >
                      <Text style={styles.modalSubmitText}>
                        {episodeForm._id ? "Update Episode" : "Add Episode"}
                      </Text>
                    </TouchableOpacity>
                    
                    {episodeForm._id && (
                      <TouchableOpacity 
                        style={[styles.modalSubmitBtn, { flex: 1, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.1)' }]} 
                        onPress={() => setEpisodeForm({ number: "", title: "", videoUrl: "", thumbnail: "", _id: null })}
                      >
                        <Text style={styles.modalSubmitText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {currentEpisodes.length === 0 ? (
                    <Text style={[styles.emptyText, { padding: 10 }]}>No episodes yet.</Text>
                  ) : (
                    currentEpisodes.map((ep, i) => (
                      <View key={ep._id || i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                        <Text style={{ color: C.crimson, fontWeight: '800', width: 30 }}>{ep.number}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.white, fontSize: 13 }} numberOfLines={1}>{ep.title || `Episode ${ep.number}`}</Text>
                          <Text style={{ color: C.dimmer, fontSize: 10 }} numberOfLines={1}>{ep.videoUrl}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity 
                            style={styles.miniActionBtn}
                            onPress={() => setEpisodeForm({ ...ep })}
                          >
                             <Ionicons name="create-outline" size={16} color={C.white} />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            onPress={() => handleDeleteEpisode(ep._id || ep.id)}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            style={styles.miniActionBtn}
                          >
                            <Ionicons name="trash-outline" size={16} color={C.crimson} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>


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
  liveDot: { 
    width: 9, height: 9, borderRadius: 5, backgroundColor: '#22c55e',
    boxShadow: '0 0 6px #22c55e'
  },
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
  animeViewsWrap: { flexDirection: "row", alignItems: "center", gap: 4, opacity: 0.8 },
  animeViews:     { color: C.dim, fontSize: 12, fontWeight: "600" },

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
  actionBtnBanned: {
    backgroundColor: "rgba(220, 20, 60, 0.12)",
    borderColor: "rgba(220, 20, 60, 0.30)",
  },

  emptyText:  { color: C.dim, fontSize: 13, padding: 20, textAlign: "center" },
  footer:     { alignItems: "center", paddingVertical: 20 },
  footerText: { color: C.dimmer, fontSize: 11 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 20,
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: C.white,
    fontSize: 18,
    fontWeight: "700",
  },
  modalSelectedFeedback: {
    backgroundColor: C.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#4ba3ff",
  },
  modalFeedbackUser: {
    color: "#4ba3ff",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  modalFeedbackText: {
    color: C.dim,
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: C.surfaceHigh,
    color: C.white,
    fontSize: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 120,
    padding: 16,
    marginBottom: 16,
  },
  modalSubmitBtn: {
    backgroundColor: C.crimson,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalSubmitText: {
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
  },
  
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  addBtnText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  
  miniActionBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  
  inputLabel: { color: C.dim, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  simpleInput: {
    backgroundColor: 'rgba(255,255,255,0.03)', color: C.white,
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    padding: 12, marginBottom: 15, fontSize: 14,
  },
  
  tierOption: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)',
  },
  tierOptionActive: { backgroundColor: 'rgba(220,20,60,0.15)', borderColor: C.crimson },
  tierOptionText: { color: C.dim, fontSize: 12, fontWeight: '700' },
  tierOptionTextActive: { color: C.white },

  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});