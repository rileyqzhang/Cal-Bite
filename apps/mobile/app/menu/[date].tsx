import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { MenuOutput } from "@berkeley-dining/shared";
import { apiFetch } from "@/lib/supabase";

export default function MenuScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const [menu, setMenu] = useState<MenuOutput | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    apiFetch(`/api/menus/${date}`)
      .then((data) => setMenu(data as MenuOutput))
      .catch(() => setMenu(null))
      .finally(() => setLoading(false));
  }, [date]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#003262" />
      </View>
    );
  }

  if (!menu) {
    return (
      <View style={styles.center}>
        <Text>Menu not available for {date}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {menu.locations.map((location) => (
        <View key={location.slug} style={styles.locationBlock}>
          <Text style={styles.locationName}>{location.name}</Text>
          {location.meals.map((meal) => (
            <View key={`${location.slug}-${meal.period}`} style={styles.mealBlock}>
              <Text style={styles.mealTitle}>{meal.period}</Text>
              {meal.categories.map((category) => (
                <View key={`${meal.period}-${category.name}`}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <FlatList
                    data={category.items}
                    scrollEnabled={false}
                    keyExtractor={(item) => `${item.id}-${item.menu_id}-${item.name}`}
                    renderItem={({ item }) => (
                      <Text style={styles.itemName}>• {item.name}</Text>
                    )}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  locationBlock: { marginBottom: 24 },
  locationName: { fontSize: 20, fontWeight: "700", color: "#003262" },
  mealBlock: { marginTop: 12 },
  mealTitle: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  categoryName: { fontSize: 14, fontWeight: "600", color: "#555", marginTop: 8 },
  itemName: { fontSize: 14, color: "#222", marginVertical: 2, paddingLeft: 8 },
});
