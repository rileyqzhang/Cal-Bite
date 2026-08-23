import {
  buildMenuOutput,
  type LocationMenu,
  type MenuOutput,
} from "@berkeley-dining/shared";
import { todayInTimeZone } from "@/lib/time/campus";
import { parseMenuHtml, parseRecipeDetails } from "./parse";

export const AJAX_URL =
  "https://dining.berkeley.edu/wp-admin/admin-ajax.php";
export const MENUS_URL = "https://dining.berkeley.edu/menus/";
export const USER_AGENT = "BerkeleyMenuScraper/1.0 (+berkeley-dining-app)";
export const EMPTY_MENU_MARKER = '<ul class="cafe-location"></ul>';
export const NO_MENU_MESSAGE = "We are currently working on the menu";

const DEFAULT_TIMEOUT_MS = 30_000;
const RECIPE_CONCURRENCY = 8;
const MAX_RETRIES = 3;

export class MenuFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MenuFetchError";
  }
}

class RecipeCache {
  private cache = new Map<string, string>();

  get(locationB64: string, recipeId: string, menuId: string): string | undefined {
    return this.cache.get(`${locationB64}:${recipeId}:${menuId}`);
  }

  set(
    locationB64: string,
    recipeId: string,
    menuId: string,
    html: string,
  ): void {
    this.cache.set(`${locationB64}:${recipeId}:${menuId}`, html);
  }
}

function formatMenuDate(menuDate: Date): string {
  const y = menuDate.getFullYear();
  const m = String(menuDate.getMonth() + 1).padStart(2, "0");
  const d = String(menuDate.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isoDateString(menuDate: Date): string {
  const y = menuDate.getFullYear();
  const m = String(menuDate.getMonth() + 1).padStart(2, "0");
  const d = String(menuDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayLocal(): Date {
  return parseIsoDate(todayInTimeZone());
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          ...(init.headers ?? {}),
        },
      });
      clearTimeout(timeout);
      if (
        response.ok ||
        ![429, 500, 502, 503, 504].includes(response.status)
      ) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw new MenuFetchError(`Request failed after retries: ${lastError}`);
}

export async function fetchMenuHtml(
  menuDate: Date,
  location = "",
  meal = "",
): Promise<string> {
  const body = new URLSearchParams({
    action: "cald_filter_xml",
    location,
    mealperiod: meal,
    date: formatMenuDate(menuDate),
  });

  const response = await fetchWithRetry(AJAX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new MenuFetchError(`Failed to fetch menu HTML: HTTP ${response.status}`);
  }

  const html = await response.text();
  if (html.includes(EMPTY_MENU_MARKER)) return NO_MENU_MESSAGE;
  return html;
}

export async function fetchRecipeDetailsHtml(
  locationB64: string,
  recipeId: string,
  menuId: string,
  cache?: RecipeCache,
): Promise<string> {
  const cached = cache?.get(locationB64, recipeId, menuId);
  if (cached !== undefined) return cached;

  const body = new URLSearchParams({
    action: "get_recipe_details",
    location: locationB64,
    id: recipeId,
    menu_id: menuId,
  });

  const response = await fetchWithRetry(AJAX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new MenuFetchError(
      `Failed to fetch recipe details for id=${recipeId}: HTTP ${response.status}`,
    );
  }

  const html = await response.text();
  cache?.set(locationB64, recipeId, menuId, html);
  return html;
}

export async function fetchAvailableDates(): Promise<Date[]> {
  const response = await fetchWithRetry(MENUS_URL, { method: "GET" });
  if (!response.ok) {
    throw new MenuFetchError(`Failed to fetch menus page: HTTP ${response.status}`);
  }

  const html = await response.text();
  const dates: Date[] = [];
  const optionRegex =
    /<option value="(\d{8})"[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = optionRegex.exec(html)) !== null) {
    const raw = match[1];
    const y = Number(raw.slice(0, 4));
    const m = Number(raw.slice(4, 6));
    const d = Number(raw.slice(6, 8));
    dates.push(new Date(y, m - 1, d));
  }

  if (!dates.length) {
    throw new MenuFetchError("No dates found in menus page dropdown");
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

export async function fetchAvailableDatesFromToday(): Promise<Date[]> {
  const today = todayLocal();
  return (await fetchAvailableDates()).filter((d) => d >= today);
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  async function runWorker(): Promise<void> {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runWorker),
  );
}

type WorkItem = {
  dataLocation: string;
  recipeId: string;
  menuId: string;
  item: import("@berkeley-dining/shared").MenuItem;
};

export async function scrapeMenus(
  menuDate: Date | string,
  options: {
    includeNutrition?: boolean;
    location?: string;
    meal?: string;
  } = {},
): Promise<MenuOutput> {
  const { includeNutrition = true, location = "", meal = "" } = options;
  const dateObj =
    typeof menuDate === "string" ? parseIsoDate(menuDate) : menuDate;
  const isoDate = isoDateString(dateObj);

  const html = await fetchMenuHtml(dateObj, location, meal);
  if (html === NO_MENU_MESSAGE) {
    return buildMenuOutput(isoDate, []);
  }

  const locations = parseMenuHtml(html);
  if (!includeNutrition) {
    return buildMenuOutput(isoDate, locations);
  }

  const itemsByKey = new Map<string, WorkItem["item"]>();
  const work: WorkItem[] = [];

  for (const locationMenu of locations) {
    for (const mealMenu of locationMenu.meals) {
      for (const category of mealMenu.categories) {
        for (const item of category.items) {
          const dataLocation = item.data_location ?? "";
          if (!dataLocation || !item.id || !item.menu_id) continue;
          const key = `${dataLocation}:${item.id}:${item.menu_id}`;
          if (!itemsByKey.has(key)) {
            itemsByKey.set(key, item);
            work.push({
              dataLocation,
              recipeId: item.id,
              menuId: item.menu_id,
              item,
            });
          }
        }
      }
    }
  }

  const cache = new RecipeCache();
  await mapWithConcurrency(work, RECIPE_CONCURRENCY, async (job) => {
    const detailsHtml = await fetchRecipeDetailsHtml(
      job.dataLocation,
      job.recipeId,
      job.menuId,
      cache,
    );
    const details = parseRecipeDetails(detailsHtml);
    const nutrition = { ...details.nutrition };
    if (details.serving_size) nutrition.serving_size = details.serving_size;
    job.item.nutrition = Object.keys(nutrition).length ? nutrition : null;
    job.item.ingredients = details.ingredients;
    job.item.allergens = details.allergens;
  });

  return buildMenuOutput(isoDate, locations);
}

export async function scrapeAvailableMenusFromToday(options?: {
  includeNutrition?: boolean;
}): Promise<MenuOutput[]> {
  const dates = await fetchAvailableDatesFromToday();
  const results: MenuOutput[] = [];
  for (const menuDate of dates) {
    results.push(await scrapeMenus(menuDate, options));
  }
  return results;
}

export { formatMenuDate, isoDateString, todayLocal, parseIsoDate };
