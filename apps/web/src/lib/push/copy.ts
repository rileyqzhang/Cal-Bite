import type { FavoriteMatch } from "@berkeley-dining/shared";
import { normalizeFoodName } from "@berkeley-dining/shared";

export type NotificationMode = "favorites_only" | "always";

export type DailyDigestCopy = {
  title: string;
  body: string;
  matchCount: number;
};

export function uniqueFavoriteNames(matches: FavoriteMatch[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const match of matches) {
    const key = normalizeFoodName(match.food_name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(match.food_name);
  }
  return names;
}

export function shortMealLabel(period: string): string {
  const parts = period
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || period;
}

export function buildDailyDigestCopy(
  matches: FavoriteMatch[],
  mode: NotificationMode,
): DailyDigestCopy | null {
  const uniqueNames = uniqueFavoriteNames(matches);
  const matchCount = uniqueNames.length;

  if (matchCount === 0) {
    if (mode !== "always") return null;
    return {
      title: "CalBite",
      body: "Good morning! You don't have any favorite foods scheduled today.",
      matchCount: 0,
    };
  }

  if (matchCount === 1) {
    return {
      title: "Favorites today",
      body: "Good morning! You have 1 favorite food today 🍳",
      matchCount: 1,
    };
  }

  return {
    title: "Favorites today",
    body: `Good morning! You have ${matchCount} favorite foods today 🍳`,
    matchCount,
  };
}
