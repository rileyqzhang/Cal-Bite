import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { HeaderBackButton } from "@react-navigation/elements";
import type { FavoriteFood } from "@berkeley-dining/shared";
import { normalizeFoodName } from "@berkeley-dining/shared";
import { PressableScale } from "@/components/PressableScale";
import { maybeOfferNotificationsAfterFirstFavorite } from "@/lib/notification-settings";
import { apiFetch, supabase } from "@/lib/supabase";
import { color, radius, serifBold, type } from "@/lib/theme";

function goBackHome() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace("/(tabs)/home");
}

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
      <Stack.Screen
        options={{
          title: "Favorite Foods",
          headerBackButtonDisplayMode: "minimal",
          headerLeft: () => (
            <HeaderBackButton
              displayMode="minimal"
              tintColor={color.onInk}
              onPress={goBackHome}
            />
          ),
        }}
      />
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
          placeholderTextColor={color.faint}
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
              <PressableScale
                style={styles.rowCard}
                onPress={() => addFavorite(item)}
                disabled={adding === item}
              >
                <Text style={styles.rowName}>{item}</Text>
                <View style={styles.accentPill}>
                  <Text style={styles.accentPillText}>
                    {adding === item ? "Adding…" : "Add"}
                  </Text>
                </View>
              </PressableScale>
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
            <ActivityIndicator color={color.ink} style={{ marginTop: 20 }} />
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
                <View style={styles.rowCard}>
                  <Text style={styles.favoriteName}>{item.display_name}</Text>
                  <PressableScale
                    style={styles.ghostPill}
                    onPress={() => removeFavorite(item.id)}
                    hitSlop={8}
                  >
                    <Text style={styles.ghostPillText}>Remove</Text>
                  </PressableScale>
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
    backgroundColor: color.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  kicker: {
    ...type.kicker,
    marginBottom: 2,
  },
  headline: {
    ...type.display,
    marginBottom: 6,
  },
  help: {
    color: color.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  searchCard: {
    backgroundColor: color.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: color.hairline,
    marginBottom: 18,
  },
  searchLabel: {
    ...type.kicker,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.inset,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: color.reading,
  },
  searchHint: {
    marginTop: 8,
    fontSize: 12,
    color: color.faint,
  },
  block: { flex: 1 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  sectionTitle: type.section,
  count: type.meta,
  suggestions: {
    flexGrow: 0,
    maxHeight: "100%",
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: color.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  rowName: {
    flex: 1,
    fontFamily: serifBold,
    fontSize: 15,
    fontWeight: "700",
    color: color.reading,
  },
  accentPill: {
    backgroundColor: color.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  accentPillText: {
    color: color.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  favoriteList: {
    paddingBottom: 24,
  },
  favoriteName: {
    flex: 1,
    fontFamily: serifBold,
    fontSize: 15,
    fontWeight: "700",
    color: color.reading,
  },
  ghostPill: {
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ghostPillText: {
    color: color.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: color.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  emptyTitle: {
    ...type.section,
    fontSize: 16,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: color.muted,
    lineHeight: 20,
  },
});
