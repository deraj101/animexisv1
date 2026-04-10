// ─── SHARED THEME ─────────────────────────────────────────────────────────────
// Single source of truth — import this instead of copy-pasting C in every file.
export const C = {
  bg:            "#080809",
  void:          "#05050a",
  surface:       "#0e0e12",
  surfaceHigh:   "#141418",
  overlay:       "#1c1c22",

  // ── Brand red — use SPARINGLY: logo, primary CTA, active/selected states only
  crimson:       "#DC143C",
  crimsonDark:   "#a8002e",
  crimsonDeep:   "#6b0020",
  crimsonBright: "#ff3a5c",
  // These go on backgrounds/fills where red is intentional (badges, active pills)
  crimsonDim:    "rgba(220,20,60,0.08)",   // was 0.12 — softer background tint
  crimsonTint:   "rgba(220,20,60,0.14)",   // was 0.22
  crimsonGlow:   "rgba(220,20,60,0.25)",   // was 0.35
  crimsonBorder: "rgba(220,20,60,0.28)",   // was 0.38 — only for ACTIVE borders

  // ── Glass border system — use these for ALL passive / structural borders
  // Replaces the old heavy crimsonBorder on icon-wraps, cards, inputs, etc.
  glass:         "rgba(255,255,255,0.07)",   // default card / surface border
  glassHigh:     "rgba(255,255,255,0.11)",   // hover / elevated surface border
  glassShimmer:  "rgba(255,255,255,0.16)",   // top-edge highlight (inner border trick)
  glassDark:     "rgba(255,255,255,0.04)",   // very subtle dividers

  white:         "#F2EFF8",
  dim:           "#9090a8",
  dimmer:        "#55556a",
  border:        "rgba(255,255,255,0.06)",   // slightly brighter than before for legibility

  // ── Semantic tokens ────────────────────────────────────────────────────────
  success:       "#22c55e",
  successDim:    "rgba(34,197,94,0.10)",
  successBorder: "rgba(34,197,94,0.28)",
  warning:       "#DC143C",
  warningDim:    "rgba(220,20,60,0.10)",
  warningBorder: "rgba(220,20,60,0.28)",
};