import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  disableMorningNotifications,
  enableMorningNotifications,
  loadNotificationSettings,
  saveNotificationMode,
  type NotificationMode,
} from "@/lib/notification-settings";
import { unregisterPushNotifications } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<NotificationMode>("favorites_only");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const settings = await loadNotificationSettings(token);
      setEnabled(settings.notifications_enabled);
      setMode(settings.notification_mode);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleEnabled(next: boolean) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token || saving) return;
    setSaving(true);
    try {
      if (next) {
        const result = await enableMorningNotifications(token, mode);
        setEnabled(result.ok);
      } else {
        await disableMorningNotifications(token);
        setEnabled(false);
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Could not update notifications",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeMode(next: NotificationMode) {
    if (next === mode) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token || saving) return;
    const previous = mode;
    setMode(next);
    try {
      await saveNotificationMode(token, next);
    } catch (error) {
      setMode(previous);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Could not update preference",
      );
    }
  }

  async function signOut() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      await unregisterPushNotifications(token).catch(() => undefined);
    }
    await supabase.auth.signOut();
    router.replace("/(auth)/signup");
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003262" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Alerts</Text>
      <Text style={styles.headline}>Morning notification</Text>
      <Text style={styles.help}>
        We’ll send one notification at 7:30 AM Pacific so you can decide whether
        to go.
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Morning dining alert</Text>
            <Text style={styles.rowBody}>Once a day, never a reminder</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={toggleEnabled}
            disabled={saving}
            trackColor={{ false: "#D1D5DB", true: "#FDB515" }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {enabled ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>When to notify</Text>
          <Pressable
            style={[styles.choice, mode === "favorites_only" && styles.choiceOn]}
            onPress={() => changeMode("favorites_only")}
          >
            <Text
              style={[
                styles.choiceTitle,
                mode === "favorites_only" && styles.choiceTitleOn,
              ]}
            >
              Favorites only
            </Text>
            <Text
              style={[
                styles.choiceBody,
                mode === "favorites_only" && styles.choiceBodyOn,
              ]}
            >
              Only when at least one favorite is on today’s menu
            </Text>
          </Pressable>
          <Pressable
            style={[styles.choice, mode === "always" && styles.choiceOn]}
            onPress={() => changeMode("always")}
          >
            <Text
              style={[
                styles.choiceTitle,
                mode === "always" && styles.choiceTitleOn,
              ]}
            >
              Every day
            </Text>
            <Text
              style={[
                styles.choiceBody,
                mode === "always" && styles.choiceBodyOn,
              ]}
            >
              Favorites when they appear, otherwise a menu teaser
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F8FA",
  },
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
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  rowBody: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  choice: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: "#F9FAFB",
  },
  choiceOn: {
    backgroundColor: "#003262",
    borderColor: "#FDB515",
  },
  choiceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  choiceTitleOn: {
    color: "#fff",
  },
  choiceBody: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  choiceBodyOn: {
    color: "#E5E7EB",
  },
  signOut: {
    marginTop: "auto",
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  signOutText: {
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: 16,
  },
});
