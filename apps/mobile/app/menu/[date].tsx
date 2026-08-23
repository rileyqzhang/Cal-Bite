import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { MenuOutput } from "@berkeley-dining/shared";
import { apiFetch } from "@/lib/supabase";

type DropdownProps = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

function Dropdown({ label, value, options, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.dropdownWrap}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <Pressable
        style={styles.dropdownButton}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Text style={styles.dropdownButtonText} numberOfLines={1}>
          {selected?.label ?? "Select…"}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            <ScrollView style={styles.modalList}>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.optionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function shortMealLabel(period: string): string {
  const parts = period.split(" - ");
  return parts[parts.length - 1] ?? period;
}

export default function MenuScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const [menu, setMenu] = useState<MenuOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [hallSlug, setHallSlug] = useState("");
  const [mealPeriod, setMealPeriod] = useState("");

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    apiFetch(`/api/menus/${date}`)
      .then((data) => {
        const next = data as MenuOutput;
        setMenu(next);
        const firstHall = next.locations[0];
        setHallSlug(firstHall?.slug ?? "");
        setMealPeriod(firstHall?.meals[0]?.period ?? "");
      })
      .catch(() => {
        setMenu(null);
        setHallSlug("");
        setMealPeriod("");
      })
      .finally(() => setLoading(false));
  }, [date]);

  const hallOptions = useMemo(
    () =>
      (menu?.locations ?? []).map((loc) => ({
        value: loc.slug,
        label: loc.name,
      })),
    [menu],
  );

  const selectedHall = useMemo(
    () => menu?.locations.find((loc) => loc.slug === hallSlug) ?? null,
    [menu, hallSlug],
  );

  const mealOptions = useMemo(
    () =>
      (selectedHall?.meals ?? []).map((meal) => ({
        value: meal.period,
        label: shortMealLabel(meal.period),
      })),
    [selectedHall],
  );

  const selectedMeal = useMemo(
    () => selectedHall?.meals.find((meal) => meal.period === mealPeriod) ?? null,
    [selectedHall, mealPeriod],
  );

  function onHallChange(slug: string) {
    setHallSlug(slug);
    const hall = menu?.locations.find((loc) => loc.slug === slug);
    const nextMeal = hall?.meals[0]?.period ?? "";
    setMealPeriod(nextMeal);
  }

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

  if (!hallOptions.length) {
    return (
      <View style={styles.center}>
        <Text>No dining halls listed for {date}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.filters}>
        <Text style={styles.dateLabel}>{date}</Text>
        <Dropdown
          label="Dining hall"
          value={hallSlug}
          options={hallOptions}
          onChange={onHallChange}
        />
        <Dropdown
          label="Meal period"
          value={mealPeriod}
          options={mealOptions}
          onChange={setMealPeriod}
        />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {selectedHall ? (
          <Text style={styles.meta}>
            {selectedHall.status}
            {selectedHall.hours?.length
              ? ` · ${selectedHall.hours.join(", ")}`
              : ""}
          </Text>
        ) : null}

        {!selectedMeal ? (
          <Text style={styles.empty}>No meals for this dining hall.</Text>
        ) : selectedMeal.categories.length === 0 ? (
          <Text style={styles.empty}>No items for this meal.</Text>
        ) : (
          selectedMeal.categories.map((category) => (
            <View key={`${selectedMeal.period}-${category.name}`} style={styles.categoryBlock}>
              <Text style={styles.categoryName}>{category.name}</Text>
              {category.items.map((item) => (
                <Pressable
                  key={`${item.id}-${item.menu_id}-${item.name}`}
                  style={styles.itemRow}
                  onPress={() =>
                    router.push({
                      pathname: "/food/[date]/[itemId]",
                      params: {
                        date: String(date),
                        itemId: item.id,
                        name: item.name,
                      },
                    })
                  }
                >
                  <Text style={styles.itemName}>• {item.name}</Text>
                  <Text style={styles.itemChevron}>Details</Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  filters: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 10,
  },
  dateLabel: { fontSize: 13, color: "#666", marginBottom: 2 },
  dropdownWrap: { gap: 4 },
  dropdownLabel: { fontSize: 12, fontWeight: "600", color: "#555" },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fafafa",
  },
  dropdownButtonText: { flex: 1, fontSize: 16, color: "#111", paddingRight: 8 },
  caret: { fontSize: 14, color: "#003262" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    maxHeight: "70%",
    overflow: "hidden",
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003262",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalList: { paddingBottom: 8 },
  optionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  optionRowActive: { backgroundColor: "#003262" },
  optionText: { fontSize: 16, color: "#222" },
  optionTextActive: { color: "#fff", fontWeight: "600" },
  meta: { color: "#666", marginBottom: 12, fontSize: 13 },
  categoryBlock: { marginBottom: 16 },
  categoryName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#003262",
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingLeft: 4,
  },
  itemName: { flex: 1, fontSize: 15, color: "#222", paddingRight: 8 },
  itemChevron: { fontSize: 13, color: "#003262", fontWeight: "600" },
  empty: { color: "#666", marginTop: 12 },
});
