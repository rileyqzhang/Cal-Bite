import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { HeaderBackButton } from "@react-navigation/elements";
import { PressableScale } from "@/components/PressableScale";
import {
  disableMorningNotifications,
  enableMorningNotifications,
  loadNotificationSettings,
  saveNotificationMode,
  type NotificationMode,
} from "@/lib/notification-settings";
import { unregisterPushNotifications } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { color, radius, type } from "@/lib/theme";

function goBackHome() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace("/(tabs)/home");
}

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
    router.replace("/(auth)/signin");
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen
          options={{
            title: "Settings",
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
        <ActivityIndicator size="large" color={color.ink} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Settings",
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
            trackColor={{ false: color.hairline, true: color.accent }}
            thumbColor={color.card}
          />
        </View>
      </View>

      {enabled ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>When to notify</Text>
          <PressableScale
            selected={mode === "favorites_only"}
            style={[styles.choice, mode === "favorites_only" && styles.choiceOn]}
            onPress={() => changeMode("favorites_only")}
            disabled={saving}
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
          </PressableScale>
          <PressableScale
            selected={mode === "always"}
            style={[styles.choice, mode === "always" && styles.choiceOn]}
            onPress={() => changeMode("always")}
            disabled={saving}
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
          </PressableScale>
        </View>
      ) : null}

      <View style={styles.signOutWrap}>
        <PressableScale style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: color.background,
  },
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
  card: {
    backgroundColor: color.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: color.hairline,
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
    color: color.reading,
  },
  rowBody: {
    marginTop: 4,
    fontSize: 13,
    color: color.muted,
  },
  sectionLabel: {
    ...type.kicker,
    marginBottom: 10,
  },
  choice: {
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    backgroundColor: color.inset,
  },
  choiceOn: {
    backgroundColor: color.ink,
    borderColor: color.accent,
    borderWidth: 2,
  },
  choiceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: color.reading,
    marginBottom: 4,
  },
  choiceTitleOn: {
    color: color.onInk,
  },
  choiceBody: {
    fontSize: 13,
    color: color.muted,
    lineHeight: 18,
  },
  choiceBodyOn: {
    color: color.hairline,
  },
  signOutWrap: {
    marginTop: "auto",
  },
  signOut: {
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.card,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  signOutText: {
    color: color.ink,
    fontWeight: "700",
    fontSize: 16,
  },
});
