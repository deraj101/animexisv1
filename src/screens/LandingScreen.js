import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { C } from "../theme";
import LegalModal from "../components/LegalModal";

const { width: W, height: H } = Dimensions.get("window");

// ─── GENRE PILLS DATA ─────────────────────────────────────────────────────────
const GENRES = [
  "Action", "Romance", "Fantasy", "Sci-Fi", "Isekai",
  "Horror", "Slice of Life", "Sports", "Mecha", "Thriller",
  "Comedy", "Drama", "Supernatural", "Mystery", "Shounen",
];

// ─── FLOATING ANIME CARDS DATA ────────────────────────────────────────────────
const CARDS = [
  { emoji: "🌑",  tag: "Action",    title: "Solo Leveling",  meta: "2024 · 12 ep",  bg: ["#000B18", "#002855"] },
  { emoji: "⭐",  tag: "Drama",     title: "Oshi no Ko",     meta: "2023 · 11 ep",  bg: ["#1A001A", "#4A004A"] },
  { emoji: "🧿",  tag: "Shounen",   title: "Jujutsu Kaisen", meta: "2020 · 24 ep",  bg: ["#001A1A", "#003333"] },
];

// ─── FEATURES DATA ────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: "flash",          label: "Simulcast Ready",  desc: "New episodes go live within hours of Japan airing." },
  { icon: "flag",           label: "Sub & Dub",        desc: "Switch between Japanese sub or English dub anytime." },
  { icon: "eye-off",        label: "Minimal Ads",      desc: "Upgrade once and never see an ad again." },
  { icon: "phone-portrait", label: "Any Device",       desc: "iOS, Android, web — your watchlist syncs everywhere." },
  { icon: "heart",          label: "Favorites & Stats",desc: "Track watch time, ratings, and your favorites list." },
  { icon: "search",         label: "50+ Genres",       desc: "Find your next binge in under 30 seconds." },
];

// ─── PLANS DATA ───────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: "Free",
    price: "₱0",
    period: "/ month",
    desc: "Start watching with light ads",
    featured: false,
    perks: ["12,000+ episodes", "HD streaming (720p)", "Favorites list", "Light ads"],
  },
  {
    name: "Premium",
    price: "₱149",
    period: "/ month",
    desc: "Ad-free, full HD quality",
    featured: true,
    badge: "Popular",
    perks: ["Everything in Free", "Full HD (1080p)", "Zero ads, ever", "2 simultaneous streams", "Early access"],
  },
];

// ─── FAQ DATA ─────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "Is Animexis really free to use?",
    a: "Yes! You can stream thousands of episodes completely free. Free users watch a short ad before each episode. Upgrade to Premium for a completely ad-free experience.",
  },
  {
    q: "How many episodes can I watch per day on the free plan?",
    a: "Free users can watch up to 20 unique episodes per day. Your daily limit resets every 24 hours at midnight. Premium members have unlimited access.",
  },
  {
    q: "What is included in the Premium plan?",
    a: "Premium gives you zero ads, Full HD (1080p) streaming, up to 2 simultaneous streams, early access to new episodes, and priority support — all for ₱149/month.",
  },
  {
    q: "Can I cancel my Premium subscription anytime?",
    a: "Absolutely. You can cancel your Premium subscription at any time from your Profile settings. You'll continue to have Premium access until the end of your current billing period.",
  },
  {
    q: "Are subtitles and dubs available?",
    a: "Yes. Most series on Animexis are available in both Japanese with English subtitles (sub) and English dubbed audio (dub). You can switch at any time in the player.",
  },
  {
    q: "Does my watchlist sync across devices?",
    a: "Yes. Your favorites, watch time, ratings, and progress are all stored on our servers and linked to your account. Just log in on any device to pick up right where you left off.",
  },
  {
    q: "How quickly are new episodes added?",
    a: "We aim to have new simulcast episodes available within hours of their original Japanese broadcast. Most ongoing series are updated weekly.",
  },
];

// ─── SMALL REUSABLE COMPONENTS ────────────────────────────────────────────────

function SectionLabel({ text }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function GenrePill({ label }) {
  const [active, setActive] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={() => setActive(v => !v)}
      activeOpacity={0.8}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FeatureCard({ icon, label, desc }) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIconWrap}>
        <Ionicons name={icon} size={22} color={C.crimson} />
      </View>
      <Text style={styles.featureTitle}>{label}</Text>
      <Text style={styles.featureDesc}>{desc}</Text>
    </View>
  );
}

function FaqItem({ question, answer, index }) {
  const [open, setOpen] = useState(false);
  const anim       = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const toValue = open ? 0 : 1;
    Animated.parallel([
      Animated.spring(anim,       { toValue, useNativeDriver: false, speed: 20, bounciness: 4 }),
      Animated.timing(rotateAnim, { toValue, duration: 200, useNativeDriver: true }),
    ]).start();
    setOpen(o => !o);
  };

  const maxH   = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 300] });
  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <View style={[styles.faqItem, open && styles.faqItemOpen]}>
      <TouchableOpacity style={styles.faqRow} onPress={toggle} activeOpacity={0.8}>
        <View style={styles.faqNumWrap}>
          <Text style={styles.faqNum}>{String(index + 1).padStart(2, '0')}</Text>
        </View>
        <Text style={[styles.faqQ, open && { color: C.white }]}>{question}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="add" size={20} color={open ? C.crimson : C.dimmer} />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={{ maxHeight: maxH, overflow: 'hidden' }}>
        <Text style={styles.faqA}>{answer}</Text>
      </Animated.View>
    </View>
  );
}

function AnimeCardFloat({ card, style }) {
  return (
    <Animated.View style={[styles.floatCard, style]}>
      <LinearGradient colors={card.bg} style={styles.floatThumb}>
        <Text style={{ fontSize: 32 }}>{card.emoji}</Text>
      </LinearGradient>
      <View style={styles.floatInfo}>
        <View style={styles.floatTag}>
          <Text style={styles.floatTagText}>{card.tag}</Text>
        </View>
        <Text style={styles.floatTitle} numberOfLines={1}>{card.title}</Text>
        <Text style={styles.floatMeta}>{card.meta}</Text>
      </View>
    </Animated.View>
  );
}

// ─── PULSING CTA BUTTON ───────────────────────────────────────────────────────
// Wraps any button content with a gentle scale pulse + an ambient glow ring
// that breathes in sync. Used for the primary "Start Watching Free" CTA.
function PulsingButton({ onPress, children, style }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.035, duration: 900, useNativeDriver: true }),
          Animated.timing(glow,  { toValue: 1,     duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1,     duration: 900, useNativeDriver: true }),
          Animated.timing(glow,  { toValue: 0,     duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={{ position: "relative" }}>
      {/* Ambient glow ring */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pulseGlow,
          { opacity: glow },
        ]}
      />
      <Animated.View style={[{ transform: [{ scale: pulse }] }, style]}>
        <TouchableOpacity
          style={styles.btnHero}
          onPress={onPress}
          activeOpacity={0.85}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── LANDING SCREEN ───────────────────────────────────────────────────────────
export default function LandingScreen({ navigation }) {
  const { user, loading: authLoading } = useAuth();
  const [showLegal, setShowLegal] = useState(false);
  const heroOpacity  = useRef(new Animated.Value(0)).current;
  const heroSlide    = useRef(new Animated.Value(40)).current;
  const badgePulse   = useRef(new Animated.Value(1)).current;

  const card0 = useRef(new Animated.Value(0)).current;
  const card1 = useRef(new Animated.Value(0)).current;
  const card2 = useRef(new Animated.Value(0)).current;
  const cardAnims = [card0, card1, card2];

  const [legalPage, setLegalPage] = useState(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(heroSlide,   { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
    ]).start();

    Animated.stagger(120, cardAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 70, friction: 12, useNativeDriver: true })
    )).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        Animated.timing(badgePulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ─── STRIPE SUCCESS REDIRECT ───
  useEffect(() => {
    if (Platform.OS === "web" && !authLoading) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("success") === "true") {
         // If we have a user (session restored), go to Home immediately.
         // HomeScreen will show the success alert.
         if (user) {
           navigation.navigate("Home");
         } else {
           // If session loss occurred (Origin mismatch), the params are still there.
           // We keep them so once the user logs in, they might still see the alert.
           // But mostly, we just wait.
         }
      }
    }
  }, [user, authLoading]);

  const goToLogin = () => navigation.navigate("Login");

  const handleUpgrade = async () => {
    // Set a flag so HomeScreen knows to redirect to Subscription after login
    await AsyncStorage.setItem("pending_redirect", "subscription");
    navigation.navigate("Login");
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* ── STICKY NAV ── */}
      <View style={styles.nav}>
        <View style={styles.navLogo}>
          <View style={styles.navLogoIcon}>
            <Ionicons name="flame" size={16} color={C.crimson} />
          </View>
          <Text style={styles.navLogoText}>
            ANIME<Text style={{ color: C.crimson }}>XIS</Text>
          </Text>
        </View>
        <View style={styles.navActions}>
          <TouchableOpacity style={styles.navBtnGhost} onPress={goToLogin} activeOpacity={0.8}>
            <Text style={styles.navBtnGhostText}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtnPrimary} onPress={goToLogin} activeOpacity={0.8}>
            <Text style={styles.navBtnPrimaryText}>Join Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 64 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── HERO ── */}
        <View style={styles.hero}>
          <LinearGradient
            colors={["rgba(220,20,60,0.18)", "rgba(220,20,60,0.04)", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
          />

          <Animated.View
            style={[styles.heroContent, { opacity: heroOpacity, transform: [{ translateY: heroSlide }] }]}
          >
            {/* Live badge */}
            <View style={styles.heroBadge}>
              <Animated.View style={[styles.badgeDot, { opacity: badgePulse }]} />
              <Text style={styles.heroBadgeText}>NEW EPISODES EVERY WEEK</Text>
            </View>

            <Text style={styles.heroH1}>
              Stream Every{"\n"}<Text style={{ color: C.crimson }}>Anime</Text>{"\n"}Ever Made.
            </Text>

            <Text style={styles.heroSub}>
              Thousands of series, movies & OVAs — in HD, ad-light, and always on time.
            </Text>

            {/* ── CTA buttons ── */}
            <View style={styles.heroCta}>
              {/* Primary button — pulsing */}
              <PulsingButton onPress={goToLogin}>
                <LinearGradient
                  colors={[C.crimson, "#a00020"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.btnHeroGrad}
                >
                  <Text style={styles.btnHeroText}>Start Watching Free</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </LinearGradient>
              </PulsingButton>

              {/* Secondary outline button — no pulse */}
              <TouchableOpacity style={styles.btnOutline} onPress={goToLogin} activeOpacity={0.8}>
                <View style={styles.playCircle}>
                  <Text style={{ fontSize: 8, color: "#fff" }}>▶</Text>
                </View>
                <Text style={styles.btnOutlineText}>Watch Trailer</Text>
              </TouchableOpacity>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              {[
                { num: "12K+", label: "Episodes" },
                { num: "800+", label: "Series"   },
                { num: "50+",  label: "Genres"   },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNum}>{s.num.replace("+", "")}<Text style={{ color: C.crimson }}>+</Text></Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                  {i < 2 && <View style={styles.statDivider} />}
                </React.Fragment>
              ))}
            </View>
          </Animated.View>

          {/* Floating anime cards */}
          {W >= 768 && (
            <View style={styles.floatCards}>
              {CARDS.map((card, i) => (
                <AnimeCardFloat
                  key={card.title}
                  card={card}
                  style={{
                    opacity: cardAnims[i],
                    transform: [{
                      translateY: cardAnims[i].interpolate({
                        inputRange: [0, 1], outputRange: [40, i * 12],
                      })
                    }],
                    marginLeft: i === 0 ? 0 : i * 20,
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── FEATURES ── */}
        <View style={styles.section}>
          <SectionLabel text="Why Animexis" />
          <SectionTitle>Built for{"\n"}Anime Fans</SectionTitle>
          <Text style={styles.sectionSub}>
            Not another generic streaming app — crafted specifically for the anime community.
          </Text>
          <View style={styles.featureGrid}>
            {FEATURES.map(f => (
              <FeatureCard key={f.label} {...f} />
            ))}
          </View>
        </View>

        {/* ── GENRES ── */}
        <View style={[styles.section, { backgroundColor: C.void }]}>
          <SectionLabel text="Browse" />
          <SectionTitle>Every Genre{"\n"}Covered</SectionTitle>
          <View style={styles.genreRow}>
            {GENRES.map(g => <GenrePill key={g} label={g} />)}
          </View>
        </View>

        {/* ── HOW IT WORKS ── */}
        <View style={styles.section}>
          <SectionLabel text="Simple Setup" />
          <SectionTitle>Three Steps{"\n"}to Anime</SectionTitle>
          <View style={styles.stepsCol}>
            {[
              { num: "01", icon: "mail-outline",    title: "Create Account",   desc: "Sign in with your email. No credit card needed." },
              { num: "02", icon: "grid-outline",    title: "Pick Your Genre",  desc: "Browse 50+ genres or follow our recommendations." },
              { num: "03", icon: "play-circle",     title: "Start Watching",   desc: "Hit play — HD anime, any screen, anywhere." },
            ].map((s, i) => (
              <View key={s.num} style={styles.stepRow}>
                <View style={styles.stepLeft}>
                  <Text style={styles.stepNum}>{s.num}</Text>
                  {i < 2 && <View style={styles.stepLine} />}
                </View>
                <View style={styles.stepBody}>
                  <View style={styles.stepIconWrap}>
                    <Ionicons name={s.icon} size={24} color={C.crimson} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.stepDesc}>{s.desc}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── PLANS ── */}
        <View style={[styles.section, { backgroundColor: C.void }]}>
          <SectionLabel text="Pricing" />
          <SectionTitle>Your Plan,{"\n"}Your Anime</SectionTitle>
          <View style={styles.plansCol}>
            {PLANS.map(plan => (
              <View
                key={plan.name}
                style={[styles.planCard, plan.featured && styles.planFeatured]}
              >
                {plan.badge && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>{plan.badge}</Text>
                  </View>
                )}
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.planPriceRow}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planPeriod}> {plan.period}</Text>
                </View>
                <Text style={styles.planDesc}>{plan.desc}</Text>
                <View style={styles.planPerks}>
                  {plan.perks.map(p => (
                    <View key={p} style={styles.perkRow}>
                      <Ionicons name="checkmark" size={14} color={C.crimson} />
                      <Text style={styles.perkText}>{p}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={plan.featured ? styles.planBtnFilled : styles.planBtnOutline}
                  onPress={goToLogin}
                  activeOpacity={0.85}
                >
                  {plan.featured ? (
                    <TouchableOpacity 
                      activeOpacity={0.8}
                      onPress={handleUpgrade}
                    >
                      <LinearGradient
                        colors={[C.crimson, "#a00020"]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.planBtnGrad}
                      >
                        <Text style={styles.planBtnFilledText}>Upgrade Now</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.planBtnOutlineText}>
                      {plan.name === "Free" ? "Get Started Free" : `Choose ${plan.name}`}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* ── FAQ ── */}
        <View style={[styles.section, { backgroundColor: C.bg }]}>
          <SectionLabel text="FAQ" />
          <SectionTitle>{"Got\nQuestions?"}</SectionTitle>
          <Text style={styles.sectionSub}>
            Everything you need to know about Animexis, answered below.
          </Text>
          <View style={styles.faqList}>
            {FAQ_ITEMS.map((item, i) => (
              <FaqItem key={i} question={item.q} answer={item.a} index={i} />
            ))}
          </View>
        </View>

        {/* ── CTA BANNER ── */}
        <View style={styles.ctaWrap}>
          <LinearGradient
            colors={["#150003", "#200010", "#100015"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.ctaBanner}
          >
            <LinearGradient
              colors={["rgba(220,20,60,0.15)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
            />
            <Text style={styles.ctaTitle}>
              Your Next Obsession{"\n"}is Waiting<Text style={{ color: C.crimson }}>.</Text>
            </Text>
            <Text style={styles.ctaSub}>
              Join thousands of anime fans streaming on Animexis right now.
            </Text>
            <View style={styles.ctaButtons}>
              {/* CTA banner primary button — also pulsing */}
              <PulsingButton onPress={handleUpgrade}>
                <LinearGradient
                  colors={[C.crimson, "#a00020"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.btnHeroGrad}
                >
                  <Text style={styles.btnHeroText}>Get Started</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </LinearGradient>
              </PulsingButton>
              <TouchableOpacity style={styles.btnOutline} onPress={goToLogin} activeOpacity={0.8}>
                <Text style={styles.btnOutlineText}>Log In</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* ── FOOTER ── */}
        <View style={styles.footer}>
          <View style={styles.footerLogo}>
            <View style={styles.navLogoIcon}>
              <Ionicons name="flame" size={14} color={C.crimson} />
            </View>
            <Text style={styles.navLogoText}>
              ANIME<Text style={{ color: C.crimson }}>XIS</Text>
            </Text>
          </View>
          <Text style={styles.footerTagline}>
            The streaming platform built for true anime fans.{"\n"}High-quality video, zero compromise.
          </Text>
          <View style={styles.footerLinks}>
            {[
              { label: "Terms & Conditions", page: "terms"   },
              { label: "Privacy Policy",     page: "privacy" },
              { label: "Terms of Use",       page: "use"     },
              { label: "Contact",            page: "contact" },
            ].map(({ label, page }, i, arr) => (
              <React.Fragment key={label}>
                <TouchableOpacity onPress={() => setLegalPage(page)}>
                  <Text style={styles.footerLink}>{label}</Text>
                </TouchableOpacity>
                {i < arr.length - 1 && (
                  <Text style={[styles.footerLink, { opacity: 0.3 }]}>·</Text>
                )}
              </React.Fragment>
            ))}
          </View>
          <Text style={styles.footerCopy}>© 2025 Animexis. All rights reserved.</Text>
        </View>

      </ScrollView>

      <LegalModal page={legalPage} onClose={() => setLegalPage(null)} />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const isTablet = W >= 768;
const PAD = isTablet ? 40 : 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  nav: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 100,
    height: 64,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: PAD,
    backgroundColor: "rgba(8,8,9,0.9)",
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  navLogo: { flexDirection: "row", alignItems: "center", gap: 8 },
  navLogoIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: C.glass,
    alignItems: "center", justifyContent: "center",
  },
  navLogoText: { fontWeight: "800", fontSize: 18, color: C.white, letterSpacing: 1.5 },
  navActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  navBtnGhost: {
    borderWidth: 1, borderColor: C.glass,
    borderRadius: 30, paddingHorizontal: 16, paddingVertical: 8,
  },
  navBtnGhostText: { color: C.white, fontSize: 13, fontWeight: "600" },
  navBtnPrimary: {
    backgroundColor: C.crimson,
    borderRadius: 30, paddingHorizontal: 16, paddingVertical: 8,
  },
  navBtnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  hero: {
    minHeight: H * 0.88,
    paddingHorizontal: PAD, paddingTop: 48, paddingBottom: 40,
    flexDirection: isTablet ? "row" : "column",
    alignItems: isTablet ? "center" : "flex-start",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  heroContent: {
    flex: isTablet ? 0.55 : 1,
    maxWidth: isTablet ? 560 : "100%",
  },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: C.glass,
    borderRadius: 30, paddingHorizontal: 14, paddingVertical: 6,
    alignSelf: "flex-start", marginBottom: 22,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.crimsonBright },
  heroBadgeText: { fontSize: 10, fontWeight: "700", color: C.crimsonBright, letterSpacing: 1 },
  heroH1: {
    fontSize: isTablet ? 72 : 52,
    fontWeight: "900", color: C.white,
    lineHeight: isTablet ? 68 : 50,
    letterSpacing: -1, marginBottom: 20,
  },
  heroSub: { fontSize: 16, color: C.dim, lineHeight: 26, marginBottom: 32, maxWidth: 480 },
  heroCta: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 48, alignItems: "center" },

  // ── Primary CTA button ──
  btnHero: { borderRadius: 50, overflow: "hidden" },
  btnHeroGrad: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 26, paddingVertical: 15,
  },
  btnHeroText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Ambient glow ring behind the pulsing button
  pulseGlow: {
    position: "absolute",
    top: -8, left: -8, right: -8, bottom: -8,
    borderRadius: 58,
    backgroundColor: C.crimson,
    opacity: 0,
    // blur on web, elevation on native
    ...(Platform.OS === "web" ? { filter: "blur(16px)" } : {}),
    shadowColor: C.crimson,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 10,
  },

  btnOutline: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 50, paddingHorizontal: 22, paddingVertical: 14,
  },
  playCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.crimson,
    alignItems: "center", justifyContent: "center",
  },
  btnOutlineText: { color: C.white, fontSize: 15, fontWeight: "600" },

  statsRow: {
    flexDirection: "row", alignItems: "center",
    paddingTop: 28, borderTopWidth: 1, borderTopColor: C.border,
  },
  statItem: { alignItems: "center", flex: 1 },
  statNum: { fontSize: 30, fontWeight: "900", color: C.white, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: C.dimmer, fontWeight: "600", letterSpacing: .8, textTransform: "uppercase" },
  statDivider: { width: 1, height: 36, backgroundColor: C.border },

  floatCards: { flex: 0.4, alignItems: "center", justifyContent: "center", gap: 14, paddingLeft: 24 },
  floatCard: {
    width: 190, backgroundColor: C.surfaceHigh,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 16, overflow: "hidden", alignSelf: "flex-end",
  },
  floatThumb: { height: 110, alignItems: "center", justifyContent: "center" },
  floatInfo: { padding: 10 },
  floatTag: {
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: C.glass,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
    alignSelf: "flex-start", marginBottom: 4,
  },
  floatTagText: { fontSize: 10, fontWeight: "700", color: C.dim },
  floatTitle: { fontSize: 13, fontWeight: "700", color: C.white, marginBottom: 2 },
  floatMeta:  { fontSize: 11, color: C.dim },

  section: { paddingHorizontal: PAD, paddingVertical: 72, backgroundColor: C.bg },
  sectionLabel: {
    fontSize: 10, fontWeight: "700", letterSpacing: 2,
    color: C.crimson, textTransform: "uppercase", marginBottom: 12,
  },
  sectionTitle: {
    fontSize: isTablet ? 52 : 36,
    fontWeight: "900", color: C.white,
    letterSpacing: -0.5, lineHeight: isTablet ? 50 : 36, marginBottom: 14,
  },
  sectionSub: { fontSize: 15, color: C.dim, lineHeight: 24, marginBottom: 0, maxWidth: 520 },

  featureGrid: { marginTop: 32, flexDirection: "row", flexWrap: "wrap", gap: 16 },
  featureCard: {
    width: isTablet ? (W - PAD * 2 - 32) / 3 : "100%",
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 24,
  },
  featureIconWrap: {
    width: 48, height: 48, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: C.glass,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  featureTitle: { fontSize: 16, fontWeight: "700", color: C.white, marginBottom: 8 },
  featureDesc:  { fontSize: 13, color: C.dim, lineHeight: 20 },

  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 36 },
  pill: {
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 30, paddingHorizontal: 18, paddingVertical: 9,
  },
  pillActive: { backgroundColor: C.crimsonDim, borderColor: C.crimsonBorder },
  pillText:   { fontSize: 13, fontWeight: "600", color: C.dim },
  pillTextActive: { color: C.white },

  stepsCol: { marginTop: 36, gap: 0 },
  stepRow: { flexDirection: "row", gap: 16 },
  stepLeft: { alignItems: "center", width: 52 },
  stepNum: { fontWeight: "900", fontSize: 28, color: C.crimson, opacity: .22, lineHeight: 36 },
  stepLine: { flex: 1, width: 1, backgroundColor: C.crimsonBorder, marginVertical: 6, minHeight: 40 },
  stepBody: { flex: 1, flexDirection: "row", gap: 14, paddingBottom: 32, alignItems: "flex-start" },
  stepIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1, borderColor: C.glass,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stepTitle: { fontSize: 16, fontWeight: "700", color: C.white, marginBottom: 6, marginTop: 2 },
  stepDesc:  { fontSize: 13, color: C.dim, lineHeight: 20 },

  plansCol: { marginTop: 40, gap: 16 },
  planCard: {
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 24, padding: 28, position: "relative",
  },
  planFeatured: { backgroundColor: "#0d0006", borderColor: C.crimsonBorder },
  planBadge: {
    position: "absolute", top: 24, right: 24,
    backgroundColor: C.crimson, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  planBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: .5 },
  planName: {
    fontSize: 12, fontWeight: "700", color: C.dim,
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
  },
  planPriceRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 4 },
  planPrice: { fontSize: 42, fontWeight: "900", color: C.white, letterSpacing: -1 },
  planPeriod: { fontSize: 16, color: C.dim, fontWeight: "400" },
  planDesc: { fontSize: 13, color: C.dim, marginBottom: 20 },
  planPerks: { gap: 8, marginBottom: 24 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  perkText: { fontSize: 13, color: C.dim },
  planBtnFilled: { borderRadius: 40, overflow: "hidden" },
  planBtnGrad: { alignItems: "center", paddingVertical: 14 },
  planBtnFilledText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  planBtnOutline: {
    borderWidth: 1.5, borderColor: C.glass,
    borderRadius: 40, paddingVertical: 13, alignItems: "center",
  },
  planBtnOutlineText: { color: C.white, fontSize: 15, fontWeight: "600" },

  ctaWrap: { paddingHorizontal: PAD, paddingBottom: 64 },
  ctaBanner: {
    borderWidth: 1, borderColor: C.glass,
    borderRadius: 24, padding: 36, overflow: "hidden",
  },
  ctaTitle: {
    fontSize: isTablet ? 44 : 32,
    fontWeight: "900", color: C.white,
    letterSpacing: -0.5, lineHeight: isTablet ? 44 : 34, marginBottom: 12,
  },
  ctaSub: { fontSize: 15, color: C.dim, lineHeight: 24, marginBottom: 28 },
  ctaButtons: { flexDirection: "row", gap: 12, flexWrap: "wrap", alignItems: "center" },

  footer: {
    backgroundColor: C.void,
    borderTopWidth: 1, borderTopColor: C.border,
    paddingHorizontal: PAD, paddingTop: 48, paddingBottom: 40,
    alignItems: "center",
  },
  footerLogo: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  footerTagline: { fontSize: 13, color: C.dimmer, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  footerLinks: { flexDirection: "row", gap: 24, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" },
  footerLink: { fontSize: 12, color: C.dimmer },
  footerCopy: { fontSize: 12, color: C.dimmer },

  // ── FAQ ──────────────────────────────────────────────────────────────────
  faqList: { marginTop: 36, gap: 12 },
  faqItem: {
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 18, overflow: 'hidden',
  },
  faqItemOpen: { borderColor: C.crimsonBorder, backgroundColor: '#0d0006' },
  faqRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 18, paddingHorizontal: 20,
  },
  faqNumWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: C.glass,
    alignItems: 'center', justifyContent: 'center',
  },
  faqNum: { color: C.dimmer, fontSize: 10, fontWeight: '800' },
  faqQ: { flex: 1, color: C.dim, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  faqA: { color: C.dimmer, fontSize: 13, lineHeight: 22, paddingHorizontal: 20, paddingBottom: 18 },
});