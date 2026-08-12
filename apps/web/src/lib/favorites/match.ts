import type { FavoriteMatch, MenuOutput } from "@berkeley-dining/shared";
import { normalizeFoodName } from "@berkeley-dining/shared";

export function findFavoriteMatches(
  menu: MenuOutput,
  favoriteNames: string[],
): FavoriteMatch[] {
  const normalizedFavorites = new Set(
    favoriteNames.map((name) => normalizeFoodName(name)),
  );
  const matches: FavoriteMatch[] = [];

  for (const location of menu.locations) {
    for (const meal of location.meals) {
      for (const category of meal.categories) {
        for (const item of category.items) {
          if (!normalizedFavorites.has(normalizeFoodName(item.name))) continue;
          matches.push({
            food_name: item.name,
            location_name: location.name,
            location_slug: location.slug,
            meal_period: meal.period,
            category: category.name,
            tags: item.tags,
            carbon_footprint: item.carbon_footprint,
          });
        }
      }
    }
  }

  matches.sort((a, b) => {
    const food = a.food_name.localeCompare(b.food_name);
    if (food !== 0) return food;
    return a.location_name.localeCompare(b.location_name);
  });

  return matches;
}

export function formatMatchesForPush(matches: FavoriteMatch[]): string {
  if (!matches.length) return "";
  const lines = matches.map(
    (m) =>
      `${m.food_name} — ${m.location_name} (${formatMealShort(m.meal_period)})`,
  );
  const unique = [...new Set(lines)];
  const preview = unique.slice(0, 5).join(", ");
  const suffix =
    unique.length > 5 ? ` and ${unique.length - 5} more` : "";
  return `Good morning! Today: ${preview}${suffix}`;
}

function formatMealShort(period: string): string {
  const parts = period.split(" - ");
  return parts[parts.length - 1] ?? period;
}
