export type MenuItem = {
  id: string;
  menu_id: string;
  name: string;
  tags: string[];
  carbon_footprint?: string | null;
  data_location?: string;
  nutrition?: Record<string, number | string> | null;
  ingredients?: string | null;
  allergens?: string[];
};

export type CategoryMenu = {
  name: string;
  items: MenuItem[];
};

export type MealMenu = {
  period: string;
  categories: CategoryMenu[];
};

export type LocationMenu = {
  slug: string;
  name: string;
  status: string;
  hours: string[];
  serve_date: string;
  meals: MealMenu[];
};

export type MenuOutput = {
  date: string;
  scraped_at: string;
  locations: LocationMenu[];
};

export type FavoriteMatch = {
  food_name: string;
  item_id: string;
  location_name: string;
  location_slug: string;
  meal_period: string;
  category: string;
  tags: string[];
  carbon_footprint?: string | null;
};

export type FavoriteFood = {
  id: string;
  user_id: string;
  food_name: string;
  display_name: string;
  created_at: string;
};

export function menuItemToDict(item: MenuItem): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: item.id,
    menu_id: item.menu_id,
    name: item.name,
    tags: item.tags,
  };
  if (item.carbon_footprint) data.carbon_footprint = item.carbon_footprint;
  if (item.nutrition != null) data.nutrition = item.nutrition;
  if (item.ingredients != null) data.ingredients = item.ingredients;
  if (item.allergens?.length) data.allergens = item.allergens;
  return data;
}

export function locationMenuToDict(location: LocationMenu): Record<string, unknown> {
  return {
    slug: location.slug,
    name: location.name,
    status: location.status,
    hours: location.hours,
    serve_date: location.serve_date,
    meals: location.meals.map((meal) => ({
      period: meal.period,
      categories: meal.categories.map((category) => ({
        name: category.name,
        items: category.items.map(menuItemToDict),
      })),
    })),
  };
}

export function buildMenuOutput(
  menuDate: string,
  locations: LocationMenu[],
  scrapedAt?: string,
): MenuOutput {
  return {
    date: menuDate,
    scraped_at: scrapedAt ?? new Date().toISOString(),
    locations,
  };
}

export function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
