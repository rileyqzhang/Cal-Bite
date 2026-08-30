import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FavoriteMatch } from "@berkeley-dining/shared";
import { normalizeFoodName } from "@berkeley-dining/shared";
import { PressableScale } from "@/components/PressableScale";
import { HomeFavoritesSkeleton } from "@/components/Skeleton";
import { apiFetch, supabase } from "@/lib/supabase";
import { color, serif, serifBold, type } from "@/lib/theme";

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

function formatDateLabel(iso: string): {
  weekday: string;
  day: string;
  isToday: boolean;
  month: string;
} {
  const date = parseIsoDate(iso);
  return {
    weekday: WEEKDAYS[date.getDay()] ?? "",
    day: String(date.getDate()),
    isToday: iso === todayIso(),
    month: date.toLocaleString("en-US", { month: "short" }),
  };
}

function shortMealPeriod(period: string): string {
  const parts = period.split(" - ");
  return parts[parts.length - 1] ?? period;
}

function mealSortRank(period: string): number {
  const meal = shortMealPeriod(period).toLowerCase();
  if (meal.includes("breakfast")) return 0;
  if (meal.includes("brunch")) return 1;
  if (meal.includes("lunch")) return 2;
  if (meal.includes("dinner")) return 3;
  if (meal.includes("late")) return 4;
  return 5;
}

function dishGlyph(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("bagel") || n.includes("bread") || n.includes("toast")) return "🥯";
  if (n.includes("egg")) return "🍳";
  if (n.includes("salad")) return "🥗";
  if (n.includes("soup") || n.includes("chowder")) return "🍲";
  if (n.includes("chicken") || n.includes("beef") || n.includes("pork")) return "🍽️";
  if (n.includes("rice") || n.includes("bowl")) return "🍚";
  if (n.includes("cookie") || n.includes("cake") || n.includes("dessert")) return "🍪";
  if (n.includes("yogurt") || n.includes("fruit")) return "🥣";
  return "🍴";
}

type GroupedMatch = {
  key: string;
  food_name: string;
  item_id: string;
  meal_period: string;
  locations: string[];
};

function FavoriteCountBadge({
  count,
  active,
}: {
  count: number;
  active: boolean;
}) {
  const n = Math.max(count, 0);
  if (n === 0) {
    return <View style={styles.countBadgeSpacer} />;
  }
  const label = n > 9 ? "9+" : String(n);
  return (
    <View style={[styles.countBadge, active && styles.countBadgeActive]}>
      <Text style={[styles.countBadgeText, active && styles.countBadgeTextActive]}>
        {label}
      </Text>
    </View>
  );
}

function MealSun() {
  return (
    <View style={styles.sun}>
      <View style={styles.sunCore} />
    </View>
  );
}

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
  const insets = useSafeAreaInsets();
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [matches, setMatches] = useState<FavoriteMatch[]>([]);
  const [favoriteCounts, setFavoriteCounts] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);

  const groupedMatches = useMemo(() => groupMatchesByFood(matches), [matches]);
  const selectedLabel = formatDateLabel(selectedDate);

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

  function selectDate(next: string) {
    if (next === selectedDate) return;
    LayoutAnimation.configureNext({
      duration: 180,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    setSelectedDate(next);
  }

  const headlineDay = selectedLabel.isToday ? "Today" : selectedLabel.weekday;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Math.max(insets.top, 8), paddingBottom: Math.max(insets.bottom, 16) },
      ]}
    >
      <View style={styles.navBar}>
        <View style={styles.navSide}>
          <PressableScale
            style={styles.navIconBtn}
            onPress={() => router.push("/settings")}
            hitSlop={8}
          >
            <View style={styles.hamburger}>
              <View style={styles.hamburgerLine} />
              <View style={styles.hamburgerLine} />
              <View style={styles.hamburgerLine} />
            </View>
          </PressableScale>
        </View>
        <Text style={styles.brand} pointerEvents="none">
          CalBite
        </Text>
        <View style={[styles.navSide, styles.navSideRight]}>
          <PressableScale
            onPress={() => router.push("/favorites/setup")}
            hitSlop={8}
            style={styles.editFavoritesBtn}
          >
            <Text style={styles.editFavoritesText}>Edit favorites</Text>
          </PressableScale>
        </View>
      </View>

      <Text style={styles.kicker}>Menu week</Text>
      <View style={styles.headlineRow}>
        <Text style={styles.headline}>{headlineDay}</Text>
        <View style={styles.headlineDot} />
        <Text style={styles.headline}>
          {selectedLabel.month} {selectedLabel.day}
        </Text>
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
            <PressableScale
              style={[
                styles.dateChip,
                active && styles.dateChipActive,
                isToday && !active && styles.dateChipToday,
              ]}
              onPress={() => selectDate(item)}
            >
              <Text
                style={[
                  styles.dateWeekday,
                  active && styles.dateWeekdayActive,
                ]}
              >
                {weekday}
              </Text>
              <Text style={[styles.dateDay, active && styles.dateDayActive]}>
                {day}
              </Text>
              <FavoriteCountBadge count={favoriteCount} active={active} />
            </PressableScale>
          );
        }}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Favorites today</Text>
      </View>

      {loading ? (
        <HomeFavoritesSkeleton />
      ) : mealSections.length ? (
        <SectionList
          sections={mealSections}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.matchList}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.mealDivider}>
              <MealSun />
              <Text style={styles.mealDividerText}>{section.title}</Text>
              <View style={styles.mealDividerLine} />
            </View>
          )}
          renderItem={({ item }) => (
            <PressableScale
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
              <View style={styles.dishIcon}>
                <Text style={styles.dishGlyph}>{dishGlyph(item.food_name)}</Text>
              </View>
              <View style={styles.matchCopy}>
                <Text style={styles.foodName} numberOfLines={1}>
                  {item.food_name}
                </Text>
                <Text style={styles.halls} numberOfLines={1}>
                  {item.locations.join(" · ")}
                </Text>
              </View>
              <Text style={styles.rowMark}>›</Text>
            </PressableScale>
          )}
        />
      ) : (
        <Text style={styles.empty}>No favorite foods on this date.</Text>
      )}

      <View style={styles.menuButtonWrap}>
        <PressableScale
          style={styles.menuButton}
          onPress={() => router.push(`/menu/${selectedDate}`)}
        >
          <Text style={styles.menuButtonText}>View full menu</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    minHeight: 40,
    position: "relative",
  },
  navSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  navSideRight: {
    justifyContent: "flex-end",
  },
  navIconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  hamburger: {
    gap: 5,
    width: 22,
  },
  hamburgerLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: color.ink,
  },
  brand: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: serif,
    fontSize: 28,
    fontWeight: "700",
    color: color.ink,
    letterSpacing: 0.2,
  },
  editFavoritesBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  editFavoritesText: {
    fontSize: 13,
    fontWeight: "600",
    color: color.ink,
    textAlign: "right",
  },
  kicker: {
    ...type.kicker,
    marginBottom: 6,
  },
  headlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  headline: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: "700",
    color: color.ink,
  },
  headlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: color.accent,
  },
  dateList: {
    flexGrow: 0,
    marginBottom: 20,
    minHeight: 108,
  },
  dateListContent: {
    gap: 10,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  dateChip: {
    width: 58,
    paddingTop: 12,
    paddingBottom: 10,
    borderRadius: 18,
    backgroundColor: color.card,
    borderWidth: 1.5,
    borderColor: color.hairline,
    alignItems: "center",
    shadowColor: "#003262",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dateChipToday: {
    borderColor: color.accent,
  },
  dateChipActive: {
    backgroundColor: color.ink,
    borderColor: color.accent,
    borderWidth: 2,
  },
  dateWeekday: {
    fontSize: 12,
    fontWeight: "600",
    color: color.muted,
    marginBottom: 4,
  },
  dateWeekdayActive: {
    color: color.accent,
  },
  dateDay: {
    fontFamily: serif,
    fontSize: 22,
    fontWeight: "700",
    color: color.ink,
    marginBottom: 8,
  },
  dateDayActive: {
    color: color.onInk,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 11,
    backgroundColor: "#F3EFE6",
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeActive: {
    backgroundColor: color.accent,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: color.ink,
  },
  countBadgeTextActive: {
    color: color.ink,
  },
  countBadgeSpacer: {
    width: 22,
    height: 22,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: serif,
    fontSize: 26,
    fontWeight: "700",
    color: color.ink,
  },
  matchList: {
    paddingBottom: 8,
  },
  mealDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  sun: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sunCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: color.accent,
  },
  mealDividerText: {
    fontSize: 12,
    fontWeight: "700",
    color: color.ink,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  mealDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hairline,
  },
  matchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: color.card,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: color.hairline,
    shadowColor: "#003262",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  dishIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.inset,
    alignItems: "center",
    justifyContent: "center",
  },
  dishGlyph: {
    fontSize: 20,
  },
  matchCopy: {
    flex: 1,
    gap: 3,
  },
  foodName: {
    fontFamily: serifBold,
    fontSize: 16,
    fontWeight: "700",
    color: color.ink,
  },
  halls: {
    color: color.muted,
    fontSize: 12,
  },
  rowMark: {
    fontSize: 22,
    fontWeight: "300",
    color: color.faint,
    paddingHorizontal: 4,
  },
  empty: {
    color: color.muted,
    marginTop: 8,
    marginBottom: 12,
  },
  menuButtonWrap: {
    marginTop: "auto",
    paddingTop: 12,
  },
  menuButton: {
    backgroundColor: color.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  menuButtonText: {
    color: color.ink,
    fontWeight: "700",
    fontSize: 16,
  },
});
