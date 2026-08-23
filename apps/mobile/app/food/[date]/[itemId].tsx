import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import type { MenuItem, MenuOutput } from "@berkeley-dining/shared";
import { apiFetch } from "@/lib/supabase";
import { color, radius, type } from "@/lib/theme";

function formatNutrient(value: unknown, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function findMenuItem(
  menu: MenuOutput,
  itemId: string,
  name?: string,
): { item: MenuItem; locationName: string; mealPeriod: string; category: string } | null {
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

  useEffect(() => {
    if (!date || !itemId) return;
    let cancelled = false;
    setLoading(true);
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

  const rows = useMemo(
    () => [
      {
        label: "Serving size",
        value:
          nutrition && typeof nutrition.serving_size === "string"
            ? nutrition.serving_size
            : "—",
      },
      {
        label: "Calories",
        value:
          nutrition && typeof nutrition.calories_kcal === "number"
            ? `${formatNutrient(nutrition.calories_kcal, 0)} kcal`
            : "—",
      },
      {
        label: "Protein",
        value:
          nutrition && typeof nutrition.protein_g === "number"
            ? `${formatNutrient(nutrition.protein_g)} g`
            : "—",
      },
      {
        label: "Fat",
        value:
          nutrition && typeof nutrition.total_fat_g === "number"
            ? `${formatNutrient(nutrition.total_fat_g)} g`
            : "—",
      },
      {
        label: "Carbs",
        value:
          nutrition && typeof nutrition.carbohydrate_g === "number"
            ? `${formatNutrient(nutrition.carbohydrate_g)} g`
            : "—",
      },
    ],
    [nutrition],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Food" }} />
        <ActivityIndicator color={color.ink} />
      </View>
    );
  }

  if (!menuItem) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Food" }} />
        <Text style={styles.empty}>Food not found on this menu.</Text>
      </View>
    );
  }

  const { item, mealPeriod, category } = menuItem;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: item.name }} />

      <Text style={styles.kicker}>
        {mealPeriod.split(" - ").slice(-1)[0]} · {category}
      </Text>
      <Text style={styles.title}>{item.name}</Text>

      <Text style={styles.sectionTitle}>Nutrition</Text>
      {!nutrition ? (
        <Text style={styles.empty}>Nutrition details are not available for this item.</Text>
      ) : (
        <View style={styles.nutritionCard}>
          {rows.map((row, index) => (
            <View
              key={row.label}
              style={[
                styles.nutritionRow,
                index === rows.length - 1 && styles.nutritionRowLast,
              ]}
            >
              <Text style={styles.nutritionLabel}>{row.label}</Text>
              <Text style={styles.nutritionValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      )}

      {item.allergens?.length ? (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Allergens</Text>
          <View style={styles.bodyCard}>
            <Text style={styles.body}>{item.allergens.join(", ")}</Text>
          </View>
        </View>
      ) : null}

      {item.ingredients ? (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <View style={styles.bodyCard}>
            <Text style={styles.body}>{item.ingredients}</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background },
  content: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: color.background,
    padding: 16,
  },
  kicker: {
    ...type.kicker,
    marginBottom: 6,
  },
  title: {
    ...type.display,
    marginBottom: 18,
  },
  sectionTitle: {
    ...type.section,
    fontSize: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  nutritionCard: {
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.md,
    marginBottom: 12,
    overflow: "hidden",
  },
  nutritionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  nutritionRowLast: {
    borderBottomWidth: 0,
  },
  nutritionLabel: { fontSize: 15, color: color.muted },
  nutritionValue: { fontSize: 15, fontWeight: "600", color: color.reading },
  block: { marginBottom: 4 },
  bodyCard: {
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  body: { fontSize: 14, color: color.reading, lineHeight: 20 },
  empty: { color: color.muted },
});
