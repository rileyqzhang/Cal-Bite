import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { FavoriteFood } from "@berkeley-dining/shared";
import { apiFetch, supabase } from "@/lib/supabase";

export default function FavoritesSetupScreen() {
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [newFavorite, setNewFavorite] = useState("");
  const [loading, setLoading] = useState(true);

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

  async function addFavorite() {
    const value = newFavorite.trim();
    if (!value) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in required");
      await apiFetch(
        "/api/favorites",
        { method: "POST", body: JSON.stringify({ food_name: value }) },
        token,
      );
      setNewFavorite("");
      await loadFavorites();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to add");
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
      <Text style={styles.help}>
        Add exact dish names you want to track, like "Scrambled Eggs" or "Margherita Pizza".
      </Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Favorite food name"
          value={newFavorite}
          onChangeText={setNewFavorite}
        />
        <Pressable style={styles.addButton} onPress={addFavorite}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
      {loading ? (
        <Text>Loading...</Text>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <Text style={styles.itemText}>{item.display_name}</Text>
              <Pressable onPress={() => removeFavorite(item.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No favorites yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  help: { color: "#666", marginBottom: 12 },
  row: { flexDirection: "row", gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  addButton: {
    backgroundColor: "#003262",
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  addButtonText: { color: "#fff", fontWeight: "600" },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  itemText: { fontSize: 16 },
  removeText: { color: "#c00" },
  empty: { color: "#666" },
});
