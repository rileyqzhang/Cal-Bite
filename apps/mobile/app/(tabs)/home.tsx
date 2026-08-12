import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import type { FavoriteMatch } from "@berkeley-dining/shared";
import { apiFetch, supabase } from "@/lib/supabase";

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function HomeScreen() {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [matches, setMatches] = useState<FavoriteMatch[]>([]);
  const [loading, setLoading] = useState(true);

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
    async function loadMatches() {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const matchResponse = await apiFetch(
          `/api/menus/${selectedDate}/matches`,
          {},
          token,
        );
        setMatches(matchResponse.matches ?? []);
      } catch {
        setMatches([]);
      } finally {
        setLoading(false);
      }
    }
    loadMatches();
  }, [selectedDate]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Pick a date</Text>
        <Link href="/favorites/setup" style={styles.link}>Edit favorites</Link>
      </View>
      <FlatList
        horizontal
        data={dates}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.dateChip, item === selectedDate && styles.dateChipActive]}
            onPress={() => setSelectedDate(item)}
          >
            <Text style={[styles.dateChipText, item === selectedDate && styles.dateChipTextActive]}>
              {item}
            </Text>
          </Pressable>
        )}
      />

      <Text style={styles.sectionTitle}>Your favorites on this date</Text>
      {loading ? (
        <ActivityIndicator color="#003262" />
      ) : matches.length ? (
        <FlatList
          data={matches}
          keyExtractor={(item, index) =>
            `${item.food_name}-${item.location_slug}-${item.meal_period}-${index}`
          }
          renderItem={({ item }) => (
            <View style={styles.matchCard}>
              <Text style={styles.foodName}>{item.food_name}</Text>
              <Text style={styles.meta}>
                {item.location_name} · {item.meal_period}
              </Text>
            </View>
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
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#003262", marginBottom: 8 },
  link: { color: "#003262" },
  dateChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateChipActive: { backgroundColor: "#003262", borderColor: "#003262" },
  dateChipText: { color: "#333" },
  dateChipTextActive: { color: "#fff" },
  matchCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  foodName: { fontSize: 16, fontWeight: "600", color: "#111" },
  meta: { marginTop: 4, color: "#666" },
  empty: { color: "#666", marginVertical: 12 },
  menuButton: {
    marginTop: "auto",
    backgroundColor: "#FDB515",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  menuButtonText: { color: "#003262", fontWeight: "700" },
});
