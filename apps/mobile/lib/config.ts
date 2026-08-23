import { Platform } from "react-native";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
// Web preview runs on the Mac, so always hit local Next.js.
// Native (phone) uses EXPO_PUBLIC_API_URL (your Mac LAN IP while developing).
export const API_URL =
  Platform.OS === "web"
    ? "http://localhost:3000"
    : process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:3000";

export function getSupabaseConfigError(): string | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env. Restart Expo after editing.";
  }
  if (!SUPABASE_URL.startsWith("https://") || !SUPABASE_URL.includes(".supabase.co")) {
    return "EXPO_PUBLIC_SUPABASE_URL must look like https://YOUR-PROJECT-REF.supabase.co";
  }
  return null;
}

export function explainAuthNetworkError(message: string): string {
  if (!message.toLowerCase().includes("failed to fetch")) {
    return message;
  }
  return [
    "Cannot reach Supabase (network/DNS error).",
    "Open Supabase Dashboard → Project Settings → API and copy the exact Project URL into apps/mobile/.env as EXPO_PUBLIC_SUPABASE_URL.",
    `Current URL: ${SUPABASE_URL || "(empty)"}`,
  ].join(" ");
}
