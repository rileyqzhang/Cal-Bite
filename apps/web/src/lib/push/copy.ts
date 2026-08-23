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

function joinNames(names: string[]): string {
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function firstMatchForName(
  matches: FavoriteMatch[],
  name: string,
): FavoriteMatch | undefined {
  const key = normalizeFoodName(name);
  return matches.find((match) => normalizeFoodName(match.food_name) === key);
}

function singleFavoriteBody(match: FavoriteMatch | undefined): string {
  const hall = match?.location_name?.trim() ?? "";
  const meal = match?.meal_period ? shortMealLabel(match.meal_period) : "";
  const place = hall && meal ? `${hall} · ${meal}` : hall || meal;
  return place ? `${place}. Decide if you’re going.` : "Decide if you’re going.";
}

export function buildDailyDigestCopy(
  matches: FavoriteMatch[],
  mode: NotificationMode,
): DailyDigestCopy | null {
  const uniqueNames = uniqueFavoriteNames(matches);
  const matchCount = uniqueNames.length;

  if (matchCount >= 4) {
    return {
      title: `${matchCount} favorites today`,
      body: `Including ${uniqueNames[0]}. Plan your meal before you go.`,
      matchCount,
    };
  }

  if (matchCount >= 2) {
    return {
      title: `${matchCount} favorites today`,
      body: `${joinNames(uniqueNames)}. Plan your meal before you go.`,
      matchCount,
    };
  }

  if (matchCount === 1) {
    return {
      title: `${uniqueNames[0]} is on the menu`,
      body: singleFavoriteBody(firstMatchForName(matches, uniqueNames[0])),
      matchCount: 1,
    };
  }

  if (mode === "always") {
    return {
      title: "Today’s menu is up",
      body: "See what’s being served and decide if you’re going.",
      matchCount: 0,
    };
  }

  return null;
}
