import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Animated,
  Dimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import LegalModal from "../components/LegalModal";
import DotCircleLoader from "../components/DotCircleLoader";

const { width } = Dimensions.get("window");
const CARD_W = Math.min(width - 40, 420);

const C = {
  bg:          "#080809",
  surface:     "#0e0e12",
  surfaceHigh: "#141418",
  crimson:     "#DC143C",
  crimsonDark: "#a8002e",
  white:       "#F2EFF8",
  dim:         "#9090a8",
  dimmer:      "#55556a",
  border:      "rgba(255,255,255,0.05)",
};

// ─── OTP INPUT ────────────────────────────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const inputs = useRef([]);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  const handleKey = (index, char) => {
    const arr = digits.map((d, i) => (i === index ? char.replace(/\D/g, "").slice(-1) : d));
    onChange(arr.join(""));
    if (char && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleBackspace = (index, key) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      const arr = [...digits];
      arr[index - 1] = "";
      onChange(arr.join(""));
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={otp.row}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          style={[otp.box, d && otp.filled]}
          value={d}
          maxLength={1}
          keyboardType="number-pad"
          onChangeText={(c) => handleKey(i, c)}
          onKeyPress={({ nativeEvent: { key } }) => handleBackspace(i, key)}
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const otp = StyleSheet.create({
  row:    { flexDirection: "row", gap: 7, justifyContent: "center", marginVertical: 8 },
  box:    {
    width: 40, height: 48, borderRadius: 10, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.surfaceHigh,
    color: C.white, fontSize: 18, fontWeight: "700", textAlign: "center",
    outlineStyle: 'none',
  },
  filled: { borderColor: "rgba(255,255,255,0.22)", backgroundColor: "rgba(255,255,255,0.06)" },
});

// ─── PASSWORD FIELD (reusable with eye toggle) ────────────────────────────────
function PasswordInput({ value, onChange, placeholder = "Password", onSubmit }) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.inputWrap}>
      <Ionicons name="lock-closed-outline" size={18} color={C.dim} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={C.dimmer}
        value={value}
        onChangeText={onChange}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType={onSubmit ? "go" : "next"}
        onSubmitEditing={onSubmit}
      />
      <TouchableOpacity onPress={() => setShow((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={18} color={C.dim} />
      </TouchableOpacity>
    </View>
  );
}

// ─── PRIMARY BUTTON ───────────────────────────────────────────────────────────
function PrimaryButton({ loading, onPress, label, icon = "arrow-forward", disabled = false }) {
  return (
    <TouchableOpacity
      style={[styles.btn, (loading || disabled) && styles.btnDisabled]}
      onPress={onPress}
      disabled={loading || disabled}
    >
      {loading ? (
        <View style={styles.btnLoading}>
          <DotCircleLoader size={18} color={C.white} />
        </View>
      ) : (
        <LinearGradient colors={[C.crimson, "#a00020"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
          <Text style={styles.btnText}>{label}</Text>
          <Ionicons name={icon} size={16} color={C.white} />
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}

// ─── RESEND BUTTON ────────────────────────────────────────────────────────────
function ResendButton({ timer, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={timer > 0} style={styles.resendRow}>
      <Text style={[styles.resendText, timer > 0 && styles.resendDisabled]}>
        {timer > 0 ? `Resend code in ${timer}s` : "Didn't get the code? Resend"}
      </Text>
    </TouchableOpacity>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
/**
 * step values:
 *   "signin"          – email + password (Sign In tab)
 *   "register"        – email + password + confirm (Create Account tab)
 *   "otp"             – shared 6-digit OTP (login & register)
 *   "forgot_email"    – forgot password: enter email
 *   "forgot_otp"      – forgot password: enter OTP
 *   "reset_password"  – forgot password: enter new password
 *
 * otpPurpose: "login" | "register" | "forgot"
 */
export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();

  const [step,       setStep]       = useState("signin");
  const [otpPurpose, setOtpPurpose] = useState("login");

  const [email,              setEmail]              = useState("");
  const [password,           setPassword]           = useState("");
  const [confirmPassword,    setConfirmPassword]    = useState("");
  const [newPassword,        setNewPassword]        = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [otpValue,           setOtpValue]           = useState("");
  const [forgotOtp,          setForgotOtp]          = useState(""); // stored to pass to reset-password

  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [legalPage,   setLegalPage]   = useState(null);

  const cardAnim  = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(cardSlide, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const clearError   = () => setError("");

  // ── Switch between Sign In / Create Account tabs ──────────────────────────
  const switchTab = (tab) => {
    setStep(tab);
    clearError();
    setPassword("");
    setConfirmPassword("");
    setOtpValue("");
  };

  // ── Back navigation ───────────────────────────────────────────────────────
  const goBack = () => {
    clearError();
    if      (step === "otp")            { setStep(otpPurpose === "register" ? "register" : "signin"); setOtpValue(""); }
    else if (step === "forgot_email")   { setStep("signin"); }
    else if (step === "forgot_otp")     { setStep("forgot_email"); setForgotOtp(""); }
    else if (step === "reset_password") { setStep("forgot_otp"); setNewPassword(""); setConfirmNewPassword(""); }
  };

  // ── OTP bypass check (server is the only source of truth) ─────────────────
  const checkBypass = async (trimmedEmail) => {
    try {
      const res = await API.post('/api/auth/check-bypass', { email: trimmedEmail });
      return !!res.data?.bypassed;
    } catch {
      // If server is unreachable, fail closed (require OTP for security)
      return false;
    }
  };

  // ── Helper: fire a send-code endpoint and start timer ────────────────────
  const sendCode = async (endpoint, body) => {
    const res = await API.post(endpoint, body);
    if (res.data.success) { setResendTimer(60); return true; }
    setError(res.data.message || "Failed to send code.");
    return false;
  };

  // ── SIGN IN ───────────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) return setError("Enter a valid email address.");
    if (!password || password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true); clearError();
    try {
      const bypassed = await checkBypass(trimmed);
      if (bypassed) {
        const res = await API.post("/api/auth/bypass-login", { email: trimmed, password });
        if (res.data.success) {
          await signIn({
            email:         trimmed,
            token:         res.data.token,
            isAdmin:       res.data.isAdmin,
            name:          res.data.name           || null,
            profile_image: res.data.profile_image  || null,
            profile_border:res.data.profile_border || null,
            subscription:  res.data.subscription   || 'free',
          });
        } else {
          setError(res.data.message || "Sign-in failed.");
        }
        return;
      }
      const ok = await sendCode("/api/auth/send-otp", { email: trimmed, password });
      if (ok) { setOtpPurpose("login"); setStep("otp"); }
    } catch (e) {
      setError(
        e.response?.data?.message ||
        (e.message?.includes("Network Error")
          ? `Cannot reach server. Check EXPO_PUBLIC_API_URL (${process.env.EXPO_PUBLIC_API_URL || "not set"})`
          : e.message || "Network error.")
      );
    } finally { setLoading(false); }
  };

  // ── CREATE ACCOUNT ────────────────────────────────────────────────────────
  const handleRegister = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed))          return setError("Enter a valid email address.");
    if (!password || password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword)     return setError("Passwords do not match.");

    // Requirement: Must accept terms before registration
    setLegalPage("terms");
    // We pass handleActualRegister as the onAccept callback below in render
  };

  const handleActualRegister = async () => {
    const trimmed = email.trim().toLowerCase();
    setLoading(true); clearError();
    try {
      const ok = await sendCode("/api/auth/register", { email: trimmed, password });
      if (ok) { setOtpPurpose("register"); setStep("otp"); }
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Network error.");
    } finally { setLoading(false); }
  };

  // ── VERIFY OTP (shared by sign-in and register) ───────────────────────────
  const handleVerifyOtp = async () => {
    if (otpValue.length < 6) return setError("Enter the full 6-digit code.");
    setLoading(true); clearError();
    try {
      const res = await API.post("/api/auth/verify-otp", {
        email: email.trim().toLowerCase(),
        otp:   otpValue,
      });
      if (res.data.success) {
        await signIn({
          email:         email.trim().toLowerCase(),
          token:         res.data.token,
          isAdmin:       res.data.isAdmin,
          name:          res.data.name           || null,
          profile_image: res.data.profile_image  || null,
          profile_border:res.data.profile_border || null,
          subscription:  res.data.subscription   || 'free',
        });
      } else {
        setError(res.data.message || "Invalid or expired code.");
        setOtpValue("");
      }
    } catch (e) {
      setError(e.response?.data?.message || "Verification failed. Try again.");
      setOtpValue("");
    } finally { setLoading(false); }
  };

  // ── FORGOT PASSWORD: step 1 — send reset code ─────────────────────────────
  const handleForgotSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) return setError("Enter a valid email address.");
    setLoading(true); clearError();
    try {
      const ok = await sendCode("/api/auth/forgot-password", { email: trimmed });
      if (ok) { setOtpPurpose("forgot"); setStep("forgot_otp"); }
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Network error.");
    } finally { setLoading(false); }
  };

  // ── FORGOT PASSWORD: step 2 — store OTP and go to new-password screen ────
  const handleForgotOtpNext = () => {
    if (otpValue.length < 6) return setError("Enter the full 6-digit code.");
    setForgotOtp(otpValue);  // keep the OTP to send with reset-password
    setOtpValue("");
    clearError();
    setStep("reset_password");
  };

  // ── FORGOT PASSWORD: step 3 — submit new password ─────────────────────────
  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) return setError("Password must be at least 6 characters.");
    if (newPassword !== confirmNewPassword)       return setError("Passwords do not match.");
    setLoading(true); clearError();
    try {
      const res = await API.post("/api/auth/reset-password", {
        email:       email.trim().toLowerCase(),
        otp:         forgotOtp,
        newPassword: newPassword,
      });
      if (res.data.success) {
        await signIn({
          email:         email.trim().toLowerCase(),
          token:         res.data.token,
          isAdmin:       res.data.isAdmin,
          name:          res.data.name           || null,
          profile_image: res.data.profile_image  || null,
          profile_border:res.data.profile_border || null,
          subscription:  res.data.subscription   || 'free',
        });
      } else {
        setError(res.data.message || "Reset failed. Please try again.");
      }
    } catch (e) {
      setError(e.response?.data?.message || "Reset failed.");
    } finally { setLoading(false); }
  };

  // ── RESEND ─────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true); clearError();
    try {
      if      (otpPurpose === "login")    await sendCode("/api/auth/send-otp",        { email: email.trim().toLowerCase(), password });
      else if (otpPurpose === "register") await sendCode("/api/auth/register",         { email: email.trim().toLowerCase(), password });
      else                                await sendCode("/api/auth/forgot-password",  { email: email.trim().toLowerCase() });
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  const showTabs = step === "signin" || step === "register";

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* TOP BAR */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color={C.white} />
            </TouchableOpacity>
            <View style={styles.navLogo}>
              <View style={styles.navLogoIcon}>
                <Ionicons name="flame" size={14} color={C.crimson} />
              </View>
              <Text style={styles.navLogoText}>
                ANIME<Text style={{ color: C.crimson }}>XIS</Text>
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* CARD */}
          <View style={styles.center}>
            <Animated.View style={[styles.card, { opacity: cardAnim, transform: [{ translateY: cardSlide }] }]}>

              {/* Tabs — Sign In / Create Account */}
              {showTabs && (
                <View style={styles.tabs}>
                  <TouchableOpacity
                    style={[styles.tab, step === "signin" && styles.tabActive]}
                    onPress={() => switchTab("signin")}
                  >
                    <Text style={[styles.tabText, step === "signin" && styles.tabTextActive]}>Sign In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, step === "register" && styles.tabActive]}
                    onPress={() => switchTab("register")}
                  >
                    <Text style={[styles.tabText, step === "register" && styles.tabTextActive]}>Create Account</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Back button for sub-steps */}
              {!showTabs && (
                <TouchableOpacity style={styles.backRow} onPress={goBack}>
                  <Ionicons name="arrow-back" size={16} color={C.dim} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
              )}

              {/* ── SIGN IN ── */}
              {step === "signin" && (
                <>
                  <Text style={styles.heading}>Welcome back</Text>
                  <Text style={styles.sub}>Sign in to your account to continue.</Text>

                  <View style={styles.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={C.dim} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email address"
                      placeholderTextColor={C.dimmer}
                      value={email}
                      onChangeText={(v) => { setEmail(v); clearError(); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>

                  <PasswordInput
                    value={password}
                    onChange={(v) => { setPassword(v); clearError(); }}
                    onSubmit={handleSignIn}
                  />

                  <TouchableOpacity
                    onPress={() => { clearError(); setStep("forgot_email"); }}
                    style={styles.forgotRow}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <PrimaryButton loading={loading} onPress={handleSignIn} label="Continue" />
                </>
              )}

              {/* ── CREATE ACCOUNT ── */}
              {step === "register" && (
                <>
                  <Text style={styles.heading}>Create account</Text>
                  <Text style={styles.sub}>Enter your details to get started.</Text>

                  <View style={styles.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={C.dim} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email address"
                      placeholderTextColor={C.dimmer}
                      value={email}
                      onChangeText={(v) => { setEmail(v); clearError(); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>
                  <PasswordInput
                    value={password}
                    onChange={(v) => { setPassword(v); clearError(); }}
                    placeholder="Password (min. 6 characters)"
                  />
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(v) => { setConfirmPassword(v); clearError(); }}
                    placeholder="Confirm password"
                    onSubmit={handleRegister}
                  />

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <PrimaryButton loading={loading} onPress={handleRegister} label="Continue" />
                </>
              )}

              {/* ── OTP (sign-in + register) ── */}
              {step === "otp" && (
                <>
                  <Text style={styles.heading}>Check your email</Text>
                  <Text style={styles.sub}>
                    We sent a 6-digit code to{"\n"}
                    <Text style={styles.emailHighlight}>{email}</Text>
                  </Text>
                  <OtpInput value={otpValue} onChange={(v) => { setOtpValue(v); clearError(); }} />
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <PrimaryButton
                    loading={loading}
                    onPress={handleVerifyOtp}
                    label="Verify & Sign In"
                    icon="checkmark"
                    disabled={otpValue.length < 6}
                  />
                  <ResendButton timer={resendTimer} onPress={handleResend} />
                </>
              )}

              {/* ── FORGOT: email input ── */}
              {step === "forgot_email" && (
                <>
                  <Text style={styles.heading}>Forgot password?</Text>
                  <Text style={styles.sub}>Enter your email and we'll send a reset code.</Text>

                  <View style={styles.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={C.dim} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email address"
                      placeholderTextColor={C.dimmer}
                      value={email}
                      onChangeText={(v) => { setEmail(v); clearError(); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="go"
                      onSubmitEditing={handleForgotSend}
                    />
                  </View>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <PrimaryButton loading={loading} onPress={handleForgotSend} label="Send Reset Code" icon="send" />
                </>
              )}

              {/* ── FORGOT: OTP ── */}
              {step === "forgot_otp" && (
                <>
                  <Text style={styles.heading}>Enter reset code</Text>
                  <Text style={styles.sub}>
                    We sent a 6-digit code to{"\n"}
                    <Text style={styles.emailHighlight}>{email}</Text>
                  </Text>
                  <OtpInput value={otpValue} onChange={(v) => { setOtpValue(v); clearError(); }} />
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <PrimaryButton
                    loading={false}
                    onPress={handleForgotOtpNext}
                    label="Next"
                    icon="arrow-forward"
                    disabled={otpValue.length < 6}
                  />
                  <ResendButton timer={resendTimer} onPress={handleResend} />
                </>
              )}

              {/* ── FORGOT: new password ── */}
              {step === "reset_password" && (
                <>
                  <Text style={styles.heading}>Set new password</Text>
                  <Text style={styles.sub}>Choose a strong new password for your account.</Text>

                  <PasswordInput
                    value={newPassword}
                    onChange={(v) => { setNewPassword(v); clearError(); }}
                    placeholder="New password (min. 6 characters)"
                  />
                  <PasswordInput
                    value={confirmNewPassword}
                    onChange={(v) => { setConfirmNewPassword(v); clearError(); }}
                    placeholder="Confirm new password"
                    onSubmit={handleResetPassword}
                  />

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <PrimaryButton loading={loading} onPress={handleResetPassword} label="Reset Password" icon="checkmark" />
                </>
              )}

            </Animated.View>
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <View style={styles.footerLinks}>
              {[
                { label: "Terms & Conditions", page: "terms"   },
                { label: "Privacy Policy",     page: "privacy" },
                { label: "Terms of Use",       page: "use"     },
                { label: "Contact Us",         page: "contact" },
              ].map(({ label, page }, i, arr) => (
                <React.Fragment key={label}>
                  <TouchableOpacity onPress={() => setLegalPage(page)}>
                    <Text style={styles.footerLink}>{label}</Text>
                  </TouchableOpacity>
                  {i < arr.length - 1 && <Text style={styles.footerDivider}>·</Text>}
                </React.Fragment>
              ))}
            </View>
            <Text style={styles.footerCopy}>© 2026 Animexis. All rights reserved.</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
      <LegalModal 
        page={legalPage} 
        onClose={() => setLegalPage(null)} 
        onAccept={legalPage === "terms" && step === "register" ? handleActualRegister : null}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingBottom: 32 },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: C.border,
    justifyContent: "center", alignItems: "center",
  },
  navLogo:     { flexDirection: "row", alignItems: "center", gap: 7 },
  navLogoIcon: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center",
  },
  navLogoText: { fontWeight: "800", fontSize: 17, color: C.white, letterSpacing: 1.5 },

  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20, paddingVertical: 24 },
  card: {
    width: CARD_W, backgroundColor: C.surface, borderRadius: 28,
    borderWidth: 1, borderColor: C.border, padding: 28,
    boxShadow: '0 20px 30px rgba(0,0,0,0.5)'
  },

  tabs: {
    flexDirection: "row", backgroundColor: C.surfaceHigh,
    borderRadius: 14, padding: 4, marginBottom: 24,
  },
  tab:           { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: "center" },
  tabActive:     { backgroundColor: "rgba(220,20,60,0.18)", borderWidth: 1, borderColor: "rgba(220,20,60,0.28)" },
  tabText:       { color: C.dim,     fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: C.crimson, fontSize: 13, fontWeight: "700" },

  heading:        { color: C.white, fontSize: 24, fontWeight: "700", marginBottom: 6, letterSpacing: -0.4 },
  sub:            { color: C.dim,   fontSize: 14, lineHeight: 20, marginBottom: 24 },
  emailHighlight: { color: C.white, fontWeight: "600" },
  errorText:      { color: C.crimson, fontSize: 13, marginBottom: 12, marginTop: -4 },

  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14, marginBottom: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input:     { flex: 1, color: C.white, fontSize: 15, height: "100%", outlineStyle: 'none' },

  forgotRow:  { alignSelf: "flex-end", marginBottom: 16, marginTop: -4 },
  forgotText: { color: C.crimson, fontSize: 13, fontWeight: "500" },

  btn:         { borderRadius: 14, overflow: "hidden", height: 50, marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnGradient: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText:     { color: C.white, fontSize: 15, fontWeight: "700" },
  btnLoading:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.crimsonDark },

  backRow:        { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  backText:       { color: C.dim, fontSize: 14 },
  resendRow:      { marginTop: 16, alignItems: "center" },
  resendText:     { color: C.crimson, fontSize: 13, textDecorationLine: "underline" },
  resendDisabled: { color: C.dimmer, textDecorationLine: "none" },

  footer:        { alignItems: "center", paddingTop: 32, paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  footerLinks:   { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6 },
  footerLink:    { color: C.dimmer, fontSize: 11, fontWeight: "500" },
  footerDivider: { color: C.dimmer, fontSize: 11, opacity: 0.5 },
  footerCopy:    { color: C.dimmer, fontSize: 11, opacity: 0.6 },
});