import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import type { FavoriteMatch } from "@berkeley-dining/shared";
import { normalizeFoodName } from "@berkeley-dining/shared";
import { apiFetch, supabase } from "@/lib/supabase";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatDateLabel(iso: string): { weekday: string; day: string; isToday: boolean } {
  const date = parseIsoDate(iso);
  return {
    weekday: WEEKDAYS[date.getDay()] ?? "",
    day: String(date.getDate()),
    isToday: iso === todayIso(),
  };
}

function formatSelectedHeadline(iso: string): string {
  const date = parseIsoDate(iso);
  const label = formatDateLabel(iso);
  const month = date.toLocaleString("en-US", { month: "short" });
  if (label.isToday) return `Today · ${month} ${label.day}`;
  return `${label.weekday} · ${month} ${label.day}`;
}

function shortMealPeriod(period: string): string {
  const parts = period.split(" - ");
  return parts[parts.length - 1] ?? period;
}

/** Breakfast → Lunch → Dinner → anything else. */
function mealSortRank(period: string): number {
  const meal = shortMealPeriod(period).toLowerCase();
  if (meal.includes("breakfast")) return 0;
  if (meal.includes("brunch")) return 1;
  if (meal.includes("lunch")) return 2;
  if (meal.includes("dinner")) return 3;
  if (meal.includes("late")) return 4;
  return 5;
}

const MAX_FAVORITE_DOTS = 6;

type GroupedMatch = {
  key: string;
  food_name: string;
  item_id: string;
  meal_period: string;
  locations: string[];
};

function FavoriteDots({
  count,
  active,
}: {
  count: number;
  active: boolean;
}) {
  const dots = Math.min(Math.max(count, 0), MAX_FAVORITE_DOTS);
  if (dots === 0) {
    return <View style={styles.dotsRowSpacer} />;
  }
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: dots }, (_, index) => (
        <View
          key={index}
          style={[styles.favoriteDot, active && styles.favoriteDotActive]}
        />
      ))}
    </View>
  );
}

/** One row per dish + meal; dining halls merged into a single list. */
function groupMatchesByFood(matches: FavoriteMatch[]): GroupedMatch[] {
  const map = new Map<string, GroupedMatch>();

  for (const match of matches) {
    const key = `${normalizeFoodName(match.food_name)}|${match.meal_period}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        food_name: match.food_name,
        item_id: match.item_id,
        meal_period: match.meal_period,
        locations: [match.location_name],
      });
      continue;
    }
    if (!existing.locations.includes(match.location_name)) {
      existing.locations.push(match.location_name);
    }
  }

  return [...map.values()]
    .map((group) => ({
      ...group,
      locations: [...group.locations].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => {
      const meal = mealSortRank(a.meal_period) - mealSortRank(b.meal_period);
      if (meal !== 0) return meal;
      return a.food_name.localeCompare(b.food_name);
    });
}

export default function HomeScreen() {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [matches, setMatches] = useState<FavoriteMatch[]>([]);
  const [favoriteCounts, setFavoriteCounts] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);

  const groupedMatches = useMemo(() => groupMatchesByFood(matches), [matches]);

  const mealSections = useMemo(() => {
    const byRank = new Map<number, { title: string; data: GroupedMatch[] }>();

    for (const match of groupedMatches) {
      const rank = mealSortRank(match.meal_period);
      const title = shortMealPeriod(match.meal_period);
      const existing = byRank.get(rank);
      if (existing) {
        existing.data.push(match);
      } else {
        byRank.set(rank, { title, data: [match] });
      }
    }

    return [...byRank.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rank, section]) => ({
        rank,
        title: section.title,
        data: section.data,
      }));
  }, [groupedMatches]);

  useEffect(() => {
    async function loadDates() {
      try {
        const datesResponse = await apiFetch("/api/menus/available-dates");
        const availableDates: string[] = datesResponse.dates ?? [];
        const nextDates = availableDates.length ? availableDates : [todayIso()];
        setDates(nextDates);
        if (!nextDates.includes(selectedDate)) {
          setSelectedDate(nextDates[0] ?? todayIso());
        }
      } catch {
        setDates([todayIso()]);
      }
    }
    loadDates();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadFavoriteCounts(dateList: string[]) {
      if (!dateList.length) {
        setFavoriteCounts({});
        return;
      }
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          if (!cancelled) setFavoriteCounts({});
          return;
        }
        const results = await Promise.all(
          dateList.map(async (date) => {
            try {
              const response = await apiFetch(
                `/api/menus/${date}/matches`,
                {},
                token,
              );
              const count = groupMatchesByFood(response.matches ?? []).length;
              return [date, count] as const;
            } catch {
              return [date, 0] as const;
            }
          }),
        );
        if (!cancelled) {
          setFavoriteCounts(Object.fromEntries(results));
        }
      } catch {
        if (!cancelled) setFavoriteCounts({});
      }
    }
    loadFavoriteCounts(dates);
    return () => {
      cancelled = true;
    };
  }, [dates]);

  useEffect(() => {
    let cancelled = false;
    async function loadMatches() {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          if (!cancelled) setMatches([]);
          return;
        }
        const matchResponse = await apiFetch(
          `/api/menus/${selectedDate}/matches`,
          {},
          token,
        );
        const nextMatches = matchResponse.matches ?? [];
        if (!cancelled) {
          setMatches(nextMatches);
          setFavoriteCounts((prev) => ({
            ...prev,
            [selectedDate]: groupMatchesByFood(nextMatches).length,
          }));
        }
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadMatches();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.kicker}>Menu week</Text>
          <Text style={styles.headline}>{formatSelectedHeadline(selectedDate)}</Text>
        </View>
        <Link href="/favorites/setup" style={styles.link}>
          Edit favorites
        </Link>
      </View>

      <FlatList
        horizontal
        data={dates}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        style={styles.dateList}
        contentContainerStyle={styles.dateListContent}
        renderItem={({ item }) => {
          const { weekday, day, isToday } = formatDateLabel(item);
          const active = item === selectedDate;
          const favoriteCount = favoriteCounts[item] ?? 0;
          return (
            <Pressable
              style={[
                styles.dateChip,
                active && styles.dateChipActive,
                isToday && !active && styles.dateChipToday,
              ]}
              onPress={() => setSelectedDate(item)}
            >
              <Text
                style={[
                  styles.dateWeekday,
                  active && styles.dateTextActive,
                ]}
              >
                {weekday}
              </Text>
              <Text
                style={[
                  styles.dateDay,
                  active && styles.dateTextActive,
                ]}
              >
                {day}
              </Text>
              <FavoriteDots count={favoriteCount} active={active} />
            </Pressable>
          );
        }}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Favorites today</Text>
        {!loading ? (
          <Text style={styles.count}>
            {groupedMatches.length} dish{groupedMatches.length === 1 ? "" : "es"}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color="#003262" style={{ marginTop: 24 }} />
      ) : mealSections.length ? (
        <SectionList
          sections={mealSections}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.matchList}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.mealDivider}>
              <Text style={styles.mealDividerText}>{section.title}</Text>
              <View style={styles.mealDividerLine} />
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={styles.matchCard}
              onPress={() =>
                router.push({
                  pathname: "/food/[date]/[itemId]",
                  params: {
                    date: selectedDate,
                    itemId: item.item_id,
                    name: item.food_name,
                  },
                })
              }
            >
              <Text style={styles.foodName} numberOfLines={1}>
                {item.food_name}
              </Text>
              <View style={styles.matchBottom}>
                <Text style={styles.halls} numberOfLines={1}>
                  {item.locations.join(" · ")}
                </Text>
                <Text style={styles.nutritionLink}>Nutrition</Text>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <Text style={styles.empty}>No favorite foods on this date.</Text>
      )}

      <Pressable
        style={styles.menuButton}
        onPress={() => router.push(`/menu/${selectedDate}`)}
      >
        <Text style={styles.menuButtonText}>View full menu</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headline: {
    fontSize: 22,
    fontWeight: "700",
    color: "#003262",
  },
  link: {
    color: "#003262",
    fontWeight: "600",
    paddingTop: 4,
  },
  dateList: {
    flexGrow: 0,
    marginBottom: 18,
  },
  dateListContent: {
    gap: 8,
    alignItems: "center",
    paddingVertical: 2,
  },
  dateChip: {
    width: 52,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  dateChipToday: {
    borderColor: "#FDB515",
  },
  dateChipActive: {
    backgroundColor: "#003262",
    borderColor: "#FDB515",
    borderWidth: 2,
  },
  dateWeekday: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  dateTextActive: {
    color: "#fff",
  },
  dotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
    marginTop: 5,
    minHeight: 6,
    maxWidth: 40,
  },
  dotsRowSpacer: {
    height: 6,
    marginTop: 5,
  },
  favoriteDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FDB515",
  },
  favoriteDotActive: {
    backgroundColor: "#FDB515",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#003262",
  },
  count: {
    fontSize: 13,
    color: "#6B7280",
  },
  matchList: {
    paddingBottom: 8,
  },
  mealDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  mealDividerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#003262",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  mealDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#D1D5DB",
  },
  matchCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#EEF0F3",
  },
  foodName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  matchBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  halls: {
    flex: 1,
    color: "#6B7280",
    fontSize: 12,
  },
  nutritionLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#003262",
  },
  empty: {
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 12,
  },
  menuButton: {
    marginTop: "auto",
    backgroundColor: "#FDB515",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  menuButtonText: {
    color: "#003262",
    fontWeight: "700",
    fontSize: 16,
  },
});
