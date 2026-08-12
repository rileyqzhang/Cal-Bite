/**
 * Upload scraped menus to Supabase Storage (local dev helper).
 * Usage: npx tsx scripts/seed-local.ts [--no-nutrition]
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  try {
    const envPath = resolve(__dirname, "../.env.local");
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Next.js dev may already have env loaded
  }
}

loadEnvLocal();

import { scrapeAvailableMenusFromToday } from "../src/lib/scraper/fetch";
import { uploadMenuJson } from "../src/lib/supabase/server";

async function main() {
  const includeNutrition = !process.argv.includes("--no-nutrition");
  console.error(
    includeNutrition
      ? "Scraping with full nutrition..."
      : "Scraping menus only (no nutrition)...",
  );

  const menus = await scrapeAvailableMenusFromToday({ includeNutrition });
  for (const menu of menus) {
    await uploadMenuJson(menu.date, menu);
    const itemCount = menu.locations.reduce(
      (sum, loc) =>
        sum +
        loc.meals.reduce(
          (mSum, meal) =>
            mSum +
            meal.categories.reduce((cSum, cat) => cSum + cat.items.length, 0),
          0,
        ),
      0,
    );
    console.error(`  uploaded ${menu.date} (${menu.locations.length} halls, ${itemCount} items)`);
  }

  console.log(JSON.stringify({ ok: true, dates: menus.map((m) => m.date) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
