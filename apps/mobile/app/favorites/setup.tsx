import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { FavoriteFood } from "@berkeley-dining/shared";
import { normalizeFoodName } from "@berkeley-dining/shared";
import { maybeOfferNotificationsAfterFirstFavorite } from "@/lib/notification-settings";
import { apiFetch, supabase } from "@/lib/supabase";

function filterFoodNames(foods: string[], query: string): string[] {
  const q = normalizeFoodName(query);
  if (!q) return [];

  const starts: string[] = [];
  const other: string[] = [];
  for (const name of foods) {
    const n = normalizeFoodName(name);
    const words = n.split(/[^a-z0-9]+/).filter(Boolean);
    const hit = q.includes(" ")
      ? n.includes(q)
      : words.some((w) => w.startsWith(q));
    if (!hit) continue;
    if (n.startsWith(q) || words[0]?.startsWith(q)) starts.push(name);
    else other.push(name);
  }
  return [...starts, ...other];
}

export default function FavoritesSetupScreen() {
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const response = await apiFetch("/api/favorites", {}, token);
      setFavorites(response.favorites ?? []);
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setCatalogLoading(true);
      try {
        const response = await apiFetch("/api/foods");
        if (!cancelled) setCatalog(response.foods ?? []);
      } catch {
        if (!cancelled) setCatalog([]);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }
    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const favoriteKeys = useMemo(
    () => new Set(favorites.map((f) => normalizeFoodName(f.food_name))),
    [favorites],
  );

  const sortedFavorites = useMemo(
    () =>
      [...favorites].sort((a, b) =>
        a.display_name.localeCompare(b.display_name, undefined, {
          sensitivity: "base",
        }),
      ),
    [favorites],
  );

  const suggestions = useMemo(
    () =>
      filterFoodNames(catalog, query).filter(
        (name) => !favoriteKeys.has(normalizeFoodName(name)),
      ),
    [catalog, query, favoriteKeys],
  );

  const searching = Boolean(normalizeFoodName(query));

  async function addFavorite(foodName: string) {
    const value = foodName.trim();
    if (!value || adding) return;
    setAdding(value);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in required");
      await apiFetch(
        "/api/favorites",
        { method: "POST", body: JSON.stringify({ food_name: value }) },
        token,
      );
      setQuery("");
      const wasEmpty = favorites.length === 0;
      await loadFavorites();
      if (wasEmpty) {
        await maybeOfferNotificationsAfterFirstFavorite(token);
      }
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to add");
    } finally {
      setAdding(null);
    }
  }

  async function removeFavorite(id: string) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in required");
      await apiFetch(
        "/api/favorites",
        { method: "DELETE", body: JSON.stringify({ id }) },
        token,
      );
      await loadFavorites();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to remove");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Track dishes</Text>
      <Text style={styles.headline}>Add favorites</Text>
      <Text style={styles.help}>
        Search the dining menus and tap a dish to track it. Turn on the morning
        alert in Settings to hear when it shows up.
      </Text>

      <View style={styles.searchCard}>
        <Text style={styles.searchLabel}>Search</Text>
        <TextInput
          style={styles.input}
          placeholder="Try scrambled, cookie, chowder…"
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {catalogLoading ? (
          <Text style={styles.searchHint}>Loading menu dishes…</Text>
        ) : (
          <Text style={styles.searchHint}>
            {catalog.length} dishes available to track
          </Text>
        )}
      </View>

      {searching ? (
        <View style={styles.block}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Results</Text>
            <Text style={styles.count}>
              {suggestions.length} match{suggestions.length === 1 ? "" : "es"}
            </Text>
          </View>
          <FlatList
            style={styles.suggestions}
            data={suggestions}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptyBody}>
                  Nothing on the current menus starts with “{query.trim()}”.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.suggestionCard}
                onPress={() => addFavorite(item)}
                disabled={adding === item}
              >
                <Text style={styles.suggestionText}>{item}</Text>
                <View style={styles.addPill}>
                  <Text style={styles.addPillText}>
                    {adding === item ? "Adding…" : "Add"}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      ) : (
        <View style={styles.block}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your favorites</Text>
            {!loading ? (
              <Text style={styles.count}>
                {sortedFavorites.length} dish
                {sortedFavorites.length === 1 ? "" : "es"}
              </Text>
            ) : null}
          </View>

          {loading ? (
            <ActivityIndicator color="#003262" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={sortedFavorites}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.favoriteList}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No favorites yet</Text>
                  <Text style={styles.emptyBody}>
                    Start typing above to find a dish from this week’s menus.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.favoriteCard}>
                  <Text style={styles.favoriteName}>{item.display_name}</Text>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removeFavorite(item.id)}
                    hitSlop={8}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              )}
            />
          )}
        </View>
      )}
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
  kicker: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headline: {
    fontSize: 24,
    fontWeight: "700",
    color: "#003262",
    marginBottom: 6,
  },
  help: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  searchCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    marginBottom: 18,
  },
  searchLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  searchHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#9CA3AF",
  },
  block: { flex: 1 },
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
  suggestions: {
    flexGrow: 0,
    maxHeight: "100%",
  },
  suggestionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#EEF0F3",
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  addPill: {
    backgroundColor: "#003262",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addPillText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  favoriteList: {
    paddingBottom: 24,
  },
  favoriteCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#EEF0F3",
  },
  favoriteName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  removeButton: {
    backgroundColor: "#FEF2F2",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  removeText: {
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEF0F3",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003262",
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
});
