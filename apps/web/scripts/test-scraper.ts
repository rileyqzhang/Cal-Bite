import { scrapeMenus } from "../src/lib/scraper/fetch";

async function main() {
  const date = process.argv[2] ?? "2026-07-22";
  console.error(`Scraping ${date} without nutrition...`);
  const menu = await scrapeMenus(date, { includeNutrition: false });
  console.log(
    JSON.stringify(
      {
        date: menu.date,
        locations: menu.locations.length,
        items: menu.locations.reduce(
          (sum, loc) =>
            sum +
            loc.meals.reduce(
              (mealSum, meal) =>
                mealSum +
                meal.categories.reduce(
                  (catSum, cat) => catSum + cat.items.length,
                  0,
                ),
              0,
            ),
          0,
        ),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
