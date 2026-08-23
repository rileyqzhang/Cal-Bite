import type { MenuOutput } from "@berkeley-dining/shared";
import { normalizeFoodName } from "@berkeley-dining/shared";
import { downloadMenuJson, listStoredMenuDates } from "@/lib/supabase/server";
import { todayLocal, isoDateString } from "@/lib/scraper/fetch";

function collectFoodNames(menu: MenuOutput): string[] {
  const names: string[] = [];
  for (const location of menu.locations) {
    for (const meal of location.meals) {
      for (const category of meal.categories) {
        for (const item of category.items) {
          if (item.name?.trim()) names.push(item.name.trim());
        }
      }
    }
  }
  return names;
}

/** Unique dish names from today + upcoming stored menus. */
export async function listUniqueFoodNames(): Promise<string[]> {
  const today = isoDateString(todayLocal());
  const dates = (await listStoredMenuDates()).filter((d) => d >= today);
  const byNormalized = new Map<string, string>();

  await Promise.all(
    dates.map(async (date) => {
      const menu = (await downloadMenuJson(date)) as MenuOutput | null;
      if (!menu) return;
      for (const name of collectFoodNames(menu)) {
        const key = normalizeFoodName(name);
        if (!byNormalized.has(key)) byNormalized.set(key, name);
      }
    }),
  );

  return [...byNormalized.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

/**
 * Non-fuzzy search: every dish where a word starts with the query
 * (or the full normalized name contains a multi-word phrase).
 * Prefix hits sort first, then alphabetical — nothing is hidden by a score cutoff.
 */
export function filterFoodNames(foods: string[], query: string): string[] {
  const q = normalizeFoodName(query);
  if (!q) return [];

  const starts: string[] = [];
  const other: string[] = [];
  for (const name of foods) {
    const n = normalizeFoodName(name);
    const words = n.split(/[^a-z0-9]+/).filter(Boolean);
    const hit = q.includes(" ")
      ? n.includes(q)
      : words.some((w) => w.startsWith(q));
    if (!hit) continue;
    if (n.startsWith(q) || words[0]?.startsWith(q)) starts.push(name);
    else other.push(name);
  }
  return [...starts, ...other];
}
