import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type {
  CategoryMenu,
  LocationMenu,
  MealMenu,
  MenuItem,
} from "@berkeley-dining/shared";

const DATE_CLASS_PATTERN = /^\d{8}$/;
const CARBON_FOOTPRINT_MAP: Record<string, string> = {
  "low.png": "low",
  "med.png": "medium",
  "high.png": "high",
};

const NUTRITION_KEY_MAP: Record<string, string> = {
  "calories (kcal)": "calories_kcal",
  "total lipid/fat (g)": "total_fat_g",
  "saturated fatty acid (g)": "saturated_fat_g",
  "trans fat (g)": "trans_fat_g",
  "cholesterol (mg)": "cholesterol_mg",
  "sodium (mg)": "sodium_mg",
  "carbohydrate (g)": "carbohydrate_g",
  "total dietary fiber (g)": "fiber_g",
  "sugar (g)": "sugar_g",
  "protein (g)": "protein_g",
  "vitamin a (iu)": "vitamin_a_iu",
  "vitamin c (mg)": "vitamin_c_mg",
  "calcium (mg)": "calcium_mg",
  "iron (mg)": "iron_mg",
  "water (g)": "water_g",
  "ash (g)": "ash_g",
  "vitamin a (rae)": "vitamin_a_rae",
  "potassium (mg)": "potassium_mg",
  "vitamin d(iu)": "vitamin_d_iu",
  "carbon footprint (kg co2)": "carbon_footprint_kg_co2",
};

export type RecipeDetails = {
  serving_size: string | null;
  nutrition: Record<string, number | string>;
  ingredients: string | null;
  allergens: string[];
};

export function parseMenuHtml(html: string): LocationMenu[] {
  const $ = cheerio.load(html);
  const locations: LocationMenu[] = [];

  $("li.location-name").each((_, el) => {
    locations.push(parseLocation($, el));
  });

  return locations;
}

function parseLocation(
  $: cheerio.CheerioAPI,
  locationEl: Element,
): LocationMenu {
  const classes = ($(locationEl).attr("class") ?? "").split(/\s+/).filter(Boolean);
  const slug = slugFromLocationClasses(classes);
  const titleEl = $(locationEl).find(".cafe-title").first();
  const statusEl = $(locationEl).find(".status").first();
  const serveDateEl = $(locationEl).find(".serve-date").first();

  const hours: string[] = [];
  $(locationEl)
    .find(".times span")
    .each((_, span) => {
      const text = $(span).text().trim();
      if (text) hours.push(text);
    });

  const meals: MealMenu[] = [];
  $(locationEl)
    .find("li.preiod-name")
    .each((_, mealEl) => {
      meals.push(parseMeal($, mealEl));
    });

  return {
    slug,
    name: titleEl.text().trim() || slug,
    status: statusEl.text().trim(),
    hours,
    serve_date: serveDateEl.text().trim(),
    meals,
  };
}

function slugFromLocationClasses(classes: string[]): string {
  const tokens = classes.filter((c) => c !== "location-name");
  if (!tokens.length) return "";
  if (DATE_CLASS_PATTERN.test(tokens[tokens.length - 1] ?? "")) {
    tokens.pop();
  }
  return tokens.join("_");
}

function parseMeal($: cheerio.CheerioAPI, mealEl: Element): MealMenu {
  const period = mealPeriodFromElement($, mealEl);
  const categories: CategoryMenu[] = [];

  $(mealEl)
    .find(".recipes-main-wrap .cat-name")
    .each((_, categoryEl) => {
      categories.push(parseCategory($, categoryEl));
    });

  return { period, categories };
}

function mealPeriodFromElement(
  $: cheerio.CheerioAPI,
  mealEl: Element,
): string {
  const classes = ($(mealEl).attr("class") ?? "").split(/\s+/).filter(Boolean);
  const idx = classes.indexOf("preiod-name");
  if (idx >= 0) {
    let remainder = classes.slice(idx + 1);
    if (remainder.length) {
      if (DATE_CLASS_PATTERN.test(remainder[remainder.length - 1] ?? "")) {
        remainder = remainder.slice(0, -1);
      }
      if (remainder.length) return remainder.join(" ");
    }
  }

  const label = $(mealEl).children("span").first();
  if (label.length) {
    return label
      .text()
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function parseCategory(
  $: cheerio.CheerioAPI,
  categoryEl: Element,
): CategoryMenu {
  const nameEl = $(categoryEl).children("span").first();
  const name = nameEl.text().trim();
  const items: MenuItem[] = [];

  $(categoryEl)
    .find("li.recip")
    .each((_, itemEl) => {
      items.push(parseItem($, itemEl));
    });

  return { name, items };
}

function parseItem($: cheerio.CheerioAPI, itemEl: Element): MenuItem {
  const nameSpan = $(itemEl).children("span").first();
  const name = nameSpan.length
    ? nameSpan.text().trim()
    : $(itemEl).text().trim();
  const classAttr = $(itemEl).attr("class") ?? "";
  const tags = classAttr.split(/\s+/).filter((c) => c && c !== "recip");

  return {
    id: $(itemEl).attr("data-id") ?? "",
    menu_id: $(itemEl).attr("data-menuid") ?? "",
    name,
    tags,
    carbon_footprint: carbonFootprintFromItem($, itemEl),
    data_location: $(itemEl).attr("data-location") ?? "",
    nutrition: null,
    ingredients: null,
    allergens: [],
  };
}

function carbonFootprintFromItem(
  $: cheerio.CheerioAPI,
  itemEl: Element,
): string | null {
  let result: string | null = null;
  $(itemEl)
    .find("img[src*='green_image/']")
    .each((_, img) => {
      const src = $(img).attr("src") ?? "";
      for (const [suffix, label] of Object.entries(CARBON_FOOTPRINT_MAP)) {
        if (src.includes(suffix)) {
          result = label;
          return false;
        }
      }
      const alt = ($(img).attr("alt") ?? "").toLowerCase();
      const tooltip = $(img).next("span.allg-tooltip");
      const tooltipText = tooltip.text().trim().toLowerCase();
      const combined = `${alt} ${tooltipText}`;
      if (combined.includes("high")) result = "high";
      else if (combined.includes("medium") || combined.includes("med"))
        result = "medium";
      else if (combined.includes("low")) result = "low";
    });
  return result;
}

export function parseRecipeDetails(html: string): RecipeDetails {
  const $ = cheerio.load(html);
  const servingEl = $(".serving-size").first();
  let servingSize: string | null = null;
  if (servingEl.length) {
    servingSize = servingEl
      .text()
      .replace(/Serving Size:/i, "")
      .trim();
  }

  const nutrition: Record<string, number | string> = {};
  $(".nutration-details li").each((_, row) => {
    const labelEl = $(row).find("span").first();
    if (!labelEl.length) return;
    const label = labelEl.text().trim().replace(/:$/, "").toLowerCase();
    const valueText = $(row)
      .text()
      .replace(labelEl.text(), "")
      .trim();
    const key = NUTRITION_KEY_MAP[label] ?? normalizeNutritionKey(label);
    nutrition[key] = parseNutritionValue(valueText);
  });

  const ingredientsEl = $(".ingredients .content").first();
  const ingredients = ingredientsEl.length
    ? ingredientsEl.text().replace(/\s+/g, " ").trim()
    : null;

  const allergens: string[] = [];
  $(".allergens span").each((_, span) => {
    const text = $(span).text().trim();
    if (text) allergens.push(text);
  });

  return {
    serving_size: servingSize,
    nutrition,
    ingredients,
    allergens,
  };
}

function normalizeNutritionKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseNutritionValue(valueText: string): number | string {
  const trimmed = valueText.trim();
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : trimmed;
}
