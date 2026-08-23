import { Platform, UIManager } from "react-native";

/**
 * Berkeley Dining design tokens.
 *
 * Extracted from the home / favorites screens (the only designed surfaces)
 * and locked as the single system for every student screen.
 *
 *   background  cool gray canvas + white card + inset field
 *   ink         Berkeley Blue — chrome, titles, selected fill, pictograms
 *   accent      California Gold — the only accent; selection rim, tint, check
 *   hairline    one stroke
 *   radius      sm / md / lg / pill
 *   type        system UI sans; display is the same face at 700
 */
export const color = {
  background: "#F7F8FA",
  card: "#FFFFFF",
  inset: "#F9FAFB",
  ink: "#003262",
  reading: "#111827",
  muted: "#6B7280",
  faint: "#9CA3AF",
  hairline: "#E5E7EB",
  accent: "#FDB515",
  onInk: "#FFFFFF",
} as const;

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const type = {
  kicker: {
    fontSize: 12,
    fontWeight: "600" as const,
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
    color: color.muted,
  },
  display: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: color.ink,
  },
  title: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: color.ink,
  },
  section: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: color.ink,
  },
  body: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: color.reading,
  },
  meta: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: color.muted,
  },
  caption: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: color.muted,
  },
};

export const motion = {
  pressScale: 0.97,
  selectedScale: 1.02,
  disabledOpacity: 0.4,
  spring: {
    friction: 18,
    tension: 280,
    useNativeDriver: true as const,
  },
};

export const chrome = {
  headerStyle: { backgroundColor: color.ink },
  headerTintColor: color.onInk,
};

export function enableLayoutMotion() {
  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}
