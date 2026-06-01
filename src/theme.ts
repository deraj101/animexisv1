// @ts-nocheck
import { Platform } from "react-native";

export const C = {
  bg: "#0A0A0A",
  void: "#050505",
  black: "#000000",
  ink: "#121212",
  surface: "#121212",
  surfaceHigh: "#1A1A1A",
  surfaceLift: "#202020",
  overlay: "rgba(0,0,0,0.72)",

  crimson: "#DC143C",
  crimsonDark: "#A30F2D",
  crimsonDeep: "#5A0618",
  crimsonBright: "#FF365D",
  crimsonSoft: "#E50914",
  crimsonDim: "rgba(220,20,60,0.10)",
  crimsonTint: "rgba(220,20,60,0.18)",
  crimsonGlow: "rgba(220,20,60,0.34)",
  crimsonBorder: "rgba(220,20,60,0.38)",

  white: "#FFFFFF",
  text: "#FFFFFF",
  muted: "#A0A0A0",
  dim: "#A0A0A0",
  dimmer: "#676767",
  faint: "#3A3A3A",

  glass: "rgba(255,255,255,0.08)",
  glassHigh: "rgba(255,255,255,0.14)",
  glassShimmer: "rgba(255,255,255,0.20)",
  glassDark: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.10)",
  hairline: "rgba(255,255,255,0.06)",

  success: "#22C55E",
  successDim: "rgba(34,197,94,0.10)",
  successBorder: "rgba(34,197,94,0.30)",
  warning: "#F59E0B",
  warningDim: "rgba(245,158,11,0.12)",
  warningBorder: "rgba(245,158,11,0.32)",
  danger: "#DC143C",
  dangerDim: "rgba(220,20,60,0.12)",
  dangerBorder: "rgba(220,20,60,0.34)",
};

C.primary = C.crimson;
C.primaryDark = C.crimsonDark;
C.primaryBright = C.crimsonBright;
C.primaryDim = C.crimsonDim;
C.primaryTint = C.crimsonTint;
C.primaryGlow = C.crimsonGlow;
C.primaryBorder = C.crimsonBorder;

export const fonts = {
  heading: Platform.select({ ios: "System", android: "sans-serif", default: "Poppins, Outfit, Inter, sans-serif" }),
  body: Platform.select({ ios: "System", android: "sans-serif", default: "Inter, Roboto, sans-serif" }),
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, SFMono-Regular, Menlo, monospace" }),
};

export const type = {
  hero: { fontFamily: fonts.heading, fontSize: 40, lineHeight: 46, fontWeight: "900", letterSpacing: 0, color: C.white },
  h1: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 36, fontWeight: "900", letterSpacing: 0, color: C.white },
  h2: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: 0, color: C.white },
  h3: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24, fontWeight: "800", letterSpacing: 0, color: C.white },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, fontWeight: "400", color: C.white },
  bodyStrong: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, fontWeight: "700", color: C.white },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, fontWeight: "500", color: C.dim },
  overline: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: C.crimson },
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  page: 20,
};

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const gradients = {
  app: [C.void, C.bg, C.ink],
  heroFade: ["rgba(0,0,0,0)", "rgba(10,10,10,0.58)", C.bg],
  crimsonButton: [C.crimsonBright, C.crimson, C.crimsonDark],
  crimsonSurface: [C.crimsonDeep, C.ink, C.void],
  glass: ["rgba(255,255,255,0.12)", "rgba(255,255,255,0.035)"],
  posterFade: ["rgba(0,0,0,0)", "rgba(0,0,0,0.68)", "rgba(0,0,0,0.95)"],
};

export const shadow = {
  crimson: {
    shadowColor: C.crimson,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  soft: {
    shadowColor: C.black,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
};

export const ui = {
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  page: {
    paddingHorizontal: space.page,
    paddingBottom: space.xxl,
  },
  glassPanel: {
    backgroundColor: "rgba(18,18,18,0.72)",
    borderWidth: 1,
    borderColor: C.glass,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: radius.md,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    color: C.white,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: C.glass,
  },
  pill: {
    minHeight: 34,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.glass,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
};

export default {
  C,
  fonts,
  type,
  space,
  radius,
  gradients,
  shadow,
  ui,
};
