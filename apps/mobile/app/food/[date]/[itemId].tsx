import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import type { MenuItem, MenuOutput } from "@berkeley-dining/shared";
import { apiFetch } from "@/lib/supabase";
import { color, radius, serif, serifBold, type } from "@/lib/theme";

const INGREDIENTS_PREVIEW = 140;

function formatNutrient(value: unknown, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function findMenuItem(
  menu: MenuOutput,
  itemId: string,
  name?: string,
): {
  item: MenuItem;
  locationName: string;
  mealPeriod: string;
  category: string;
} | null {
  for (const location of menu.locations) {
    for (const meal of location.meals) {
      for (const category of meal.categories) {
        for (const item of category.items) {
          const idMatch = item.id === itemId;
          const nameMatch = !name || item.name === name;
          if (idMatch && nameMatch) {
            return {
              item,
              locationName: location.name,
              mealPeriod: meal.period,
              category: category.name,
            };
          }
        }
      }
    }
  }
  for (const location of menu.locations) {
    for (const meal of location.meals) {
      for (const category of meal.categories) {
        for (const item of category.items) {
          if (item.id === itemId) {
            return {
              item,
              locationName: location.name,
              mealPeriod: meal.period,
              category: category.name,
            };
          }
        }
      }
    }
  }
  return null;
}

function dishHeroGlyph(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("cookie") || n.includes("cake") || n.includes("dessert")) return "🍪";
  if (n.includes("bagel") || n.includes("bread")) return "bagel";
  if (n.includes("egg")) return "🍳";
  if (n.includes("salad")) return "🥗";
  if (n.includes("soup")) return "🍲";
  if (n.includes("rice") || n.includes("bowl")) return "🍚";
  return "🍽️";
}

function SectionLabel({
  icon,
  label,
}: {
  icon: "sun" | "shield" | "leaf";
  label: string;
}) {
  return (
    <View style={styles.sectionLabelRow}>
      {icon === "sun" ? (
        <View style={styles.sunCore} />
      ) : (
        <Text style={styles.sectionEmoji}>
          {icon === "shield" ? "✓" : "🍃"}
        </Text>
      )}
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

export default function FoodDetailScreen() {
  const params = useLocalSearchParams<{
    date: string;
    itemId: string;
    name?: string;
  }>();
  const date = params.date;
  const itemId = params.itemId;
  const nameParam = Array.isArray(params.name) ? params.name[0] : params.name;

  const [loading, setLoading] = useState(true);
  const [menuItem, setMenuItem] = useState<ReturnType<typeof findMenuItem>>(null);
  const [ingredientsExpanded, setIngredientsExpanded] = useState(false);

  useEffect(() => {
    if (!date || !itemId) return;
    let cancelled = false;
    setLoading(true);
    setIngredientsExpanded(false);
    apiFetch(`/api/menus/${date}`)
      .then((data) => {
        if (cancelled) return;
        setMenuItem(findMenuItem(data as MenuOutput, itemId, nameParam));
      })
      .catch(() => {
        if (!cancelled) setMenuItem(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, itemId, nameParam]);

  const nutrition = menuItem?.item.nutrition ?? null;

  const nutritionTiles = useMemo(() => {
    const calories =
      nutrition && typeof nutrition.calories_kcal === "number"
        ? formatNutrient(nutrition.calories_kcal, 0)
        : "—";
    const serving =
      nutrition && typeof nutrition.serving_size === "string"
        ? nutrition.serving_size
        : "—";
    const protein =
      nutrition && typeof nutrition.protein_g === "number"
        ? `${formatNutrient(nutrition.protein_g)} g`
        : "—";
    const fat =
      nutrition && typeof nutrition.total_fat_g === "number"
        ? `${formatNutrient(nutrition.total_fat_g)} g`
        : "—";
    const carbs =
      nutrition && typeof nutrition.carbohydrate_g === "number"
        ? `${formatNutrient(nutrition.carbohydrate_g)} g`
        : "—";

    return [
      { key: "cal", icon: "🔥", value: calories, label: "Calories" },
      { key: "srv", icon: "⚖️", value: serving, label: "Serving size" },
      { key: "pro", icon: "💪", value: protein, label: "Protein" },
      { key: "fat", icon: "💧", value: fat, label: "Fat" },
      { key: "carb", icon: "🌾", value: carbs, label: "Carbs" },
    ];
  }, [nutrition]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "CalBite", headerTintColor: color.onInk }} />
        <ActivityIndicator color={color.ink} />
      </View>
    );
  }

  if (!menuItem) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "CalBite" }} />
        <Text style={styles.empty}>Food not found on this menu.</Text>
      </View>
    );
  }

  const { item, mealPeriod, category } = menuItem;
  const meal = mealPeriod.split(" - ").slice(-1)[0] ?? mealPeriod;
  const kcalLine =
    nutrition && typeof nutrition.calories_kcal === "number"
      ? `${formatNutrient(nutrition.calories_kcal, 0)} kcal`
      : null;
  const servingLine =
    nutrition && typeof nutrition.serving_size === "string"
      ? nutrition.serving_size
      : null;
  const metaLine = [kcalLine, servingLine].filter(Boolean).join(" · ");

  const ingredients = item.ingredients?.trim() ?? "";
  const ingredientsLong = ingredients.length > INGREDIENTS_PREVIEW;
  const ingredientsShown =
    !ingredientsExpanded && ingredientsLong
      ? `${ingredients.slice(0, INGREDIENTS_PREVIEW).trim()}…`
      : ingredients;

  const glyph = dishHeroGlyph(item.name);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: "CalBite",
          headerBackButtonDisplayMode: "minimal",
          headerTitleStyle: {
            fontFamily: serif,
            fontWeight: "700",
            color: color.onInk,
          },
        }}
      />

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>
            {meal.toUpperCase()} · {category.toUpperCase()}
          </Text>
          <Text style={styles.title}>{item.name}</Text>
          {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}
        </View>
        <View style={styles.heroArt}>
          <Text style={styles.heroGlyph}>
            {glyph === "bagel" ? "🥯" : glyph}
          </Text>
        </View>
      </View>

      <SectionLabel icon="sun" label="NUTRITION" />
      {!nutrition ? (
        <Text style={styles.empty}>
          Nutrition details are not available for this item.
        </Text>
      ) : (
        <View style={styles.nutritionCard}>
          {nutritionTiles.map((tile) => (
            <View key={tile.key} style={styles.nutritionTile}>
              <View style={styles.nutritionIconWrap}>
                <Text style={styles.nutritionIcon}>{tile.icon}</Text>
              </View>
              <View style={styles.nutritionCopy}>
                <Text style={styles.nutritionValue}>{tile.value}</Text>
                <Text style={styles.nutritionLabel}>{tile.label}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {item.allergens?.length ? (
        <View style={styles.block}>
          <SectionLabel icon="shield" label="ALLERGENS" />
          <View style={styles.pillRow}>
            {item.allergens.map((allergen) => (
              <View key={allergen} style={styles.pill}>
                <Text style={styles.pillText}>{allergen}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {ingredients ? (
        <View style={styles.block}>
          <SectionLabel icon="leaf" label="INGREDIENTS" />
          <View style={styles.bodyCard}>
            <Text style={styles.body}>{ingredientsShown}</Text>
            {ingredientsLong ? (
              <Pressable
                onPress={() => setIngredientsExpanded((v) => !v)}
                hitSlop={8}
                style={styles.showMoreBtn}
              >
                <Text style={styles.showMoreText}>
                  {ingredientsExpanded ? "Show less" : "Show more"}{" "}
                  {ingredientsExpanded ? "⌃" : "⌄"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background },
  content: { padding: 16, paddingBottom: 48 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: color.background,
    padding: 16,
  },
  hero: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
    alignItems: "flex-start",
  },
  heroCopy: {
    flex: 1,
    paddingRight: 4,
  },
  kicker: {
    ...type.kicker,
    marginBottom: 8,
  },
  title: {
    fontFamily: serifBold,
    fontSize: 28,
    fontWeight: "700",
    color: color.ink,
    lineHeight: 34,
    marginBottom: 8,
  },
  meta: {
    fontSize: 14,
    color: color.muted,
    fontWeight: "500",
  },
  heroArt: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#F3EFE6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  heroGlyph: {
    fontSize: 40,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    marginTop: 6,
  },
  sunCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: color.accent,
  },
  sectionEmoji: {
    fontSize: 12,
    color: color.ink,
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: color.ink,
  },
  nutritionCard: {
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 18,
  },
  nutritionTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  nutritionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.inset,
    alignItems: "center",
    justifyContent: "center",
  },
  nutritionIcon: {
    fontSize: 16,
  },
  nutritionCopy: {
    flex: 1,
    gap: 2,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: "700",
    color: color.ink,
  },
  nutritionLabel: {
    fontSize: 12,
    color: color.muted,
    fontWeight: "500",
  },
  block: {
    marginBottom: 14,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    backgroundColor: "#F3EFE6",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
    color: color.ink,
  },
  bodyCard: {
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  body: {
    fontSize: 14,
    color: color.reading,
    lineHeight: 21,
  },
  showMoreBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: color.ink,
  },
  empty: { color: color.muted },
});
