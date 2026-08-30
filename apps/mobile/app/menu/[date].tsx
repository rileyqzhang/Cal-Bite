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
import { PressableScale } from "@/components/PressableScale";
import { apiFetch } from "@/lib/supabase";
import { color, radius, serifBold, type } from "@/lib/theme";

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
      <PressableScale
        style={styles.dropdownButton}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Text style={styles.dropdownButtonText} numberOfLines={1}>
          {selected?.label ?? "Select…"}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </PressableScale>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setOpen(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            <ScrollView style={styles.modalList}>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <PressableScale
                    key={option.value}
                    selected={active}
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
                    {active ? <Text style={styles.optionCheck}>✓</Text> : null}
                  </PressableScale>
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
        <ActivityIndicator color={color.ink} />
      </View>
    );
  }

  if (!menu) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Menu not available for {date}</Text>
      </View>
    );
  }

  if (!hallOptions.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No dining halls listed for {date}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.filters}>
        <Text style={styles.kicker}>{date}</Text>
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
              <View style={styles.mealDivider}>
                <Text style={styles.categoryName}>{category.name}</Text>
                <View style={styles.mealDividerLine} />
              </View>
              {category.items.map((item, index) => (
                <PressableScale
                  key={`${selectedMeal.period}-${category.name}-${item.id}-${index}`}
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
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.rowMark}>›</Text>
                </PressableScale>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background },
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 8, paddingBottom: 32 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: color.background,
    padding: 16,
  },
  filters: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
    gap: 10,
    backgroundColor: color.background,
  },
  kicker: {
    ...type.kicker,
    marginBottom: 2,
  },
  dropdownWrap: { gap: 4 },
  dropdownLabel: type.caption,
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: color.card,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 16,
    color: color.reading,
    paddingRight: 8,
  },
  caret: { fontSize: 14, color: color.accent },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,50,98,0.28)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: color.card,
    borderRadius: 14,
    maxHeight: "70%",
    overflow: "hidden",
    zIndex: 1,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  modalTitle: {
    ...type.section,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalList: { paddingBottom: 8 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
    backgroundColor: color.card,
  },
  optionRowActive: {
    backgroundColor: color.ink,
    borderColor: color.accent,
    borderTopColor: color.accent,
  },
  optionText: { fontSize: 16, color: color.reading, flex: 1 },
  optionTextActive: { color: color.onInk, fontWeight: "600" },
  optionCheck: {
    color: color.accent,
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 12,
  },
  meta: { ...type.meta, marginBottom: 12 },
  categoryBlock: { marginBottom: 16 },
  mealDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: "700",
    color: color.ink,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  mealDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hairline,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.card,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  itemName: {
    flex: 1,
    fontFamily: serifBold,
    fontSize: 15,
    fontWeight: "700",
    color: color.reading,
    paddingRight: 8,
  },
  rowMark: {
    fontSize: 16,
    fontWeight: "400",
    color: color.accent,
    lineHeight: 18,
  },
  empty: { color: color.muted, marginTop: 12 },
});
