import { Alert, Linking, Platform } from "react-native";
import {
  getNotificationPermissionStatus,
  registerForPushNotifications,
  requestNotificationPermission,
  unregisterPushNotifications,
} from "./notifications";
import { apiFetch } from "./supabase";

export type NotificationMode = "favorites_only" | "always";

export type NotificationSettings = {
  notifications_enabled: boolean;
  notification_mode: NotificationMode;
};

export async function loadNotificationSettings(
  accessToken: string,
): Promise<NotificationSettings> {
  const data = await apiFetch("/api/settings", {}, accessToken);
  return {
    notifications_enabled: Boolean(data.notifications_enabled),
    notification_mode:
      data.notification_mode === "always" ? "always" : "favorites_only",
  };
}

function confirmMorningNotifications(): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(
      window.confirm(
        "Once a day at 7:30 AM, we’ll tell you if your favorites are being served so you can decide whether to go.",
      ),
    );
  }
  return new Promise((resolve) => {
    Alert.alert(
      "Morning dining alert",
      "Once a day at 7:30 AM, we’ll tell you if your favorites are being served so you can decide whether to go.",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Turn on", onPress: () => resolve(true) },
      ],
    );
  });
}

function explainDeniedPermission(): void {
  const message =
    "Notifications are off in system settings. You can enable them there to get the morning dining alert.";
  if (Platform.OS === "web") {
    window.alert(message);
    return;
  }
  Alert.alert("Notifications are off", message, [
    { text: "Not now", style: "cancel" },
    { text: "Open Settings", onPress: () => Linking.openSettings() },
  ]);
}

export async function enableMorningNotifications(
  accessToken: string,
  mode: NotificationMode = "favorites_only",
): Promise<{ ok: boolean }> {
  const status = await getNotificationPermissionStatus();
  if (status !== "granted") {
    const accepted = await confirmMorningNotifications();
    if (!accepted) return { ok: false };
    const granted = await requestNotificationPermission();
    if (!granted) {
      explainDeniedPermission();
      return { ok: false };
    }
  }

  await registerForPushNotifications(accessToken).catch(() => null);
  await apiFetch(
    "/api/settings",
    {
      method: "PATCH",
      body: JSON.stringify({
        notifications_enabled: true,
        notification_mode: mode,
      }),
    },
    accessToken,
  );
  return { ok: true };
}

export async function disableMorningNotifications(
  accessToken: string,
): Promise<void> {
  await apiFetch(
    "/api/settings",
    {
      method: "PATCH",
      body: JSON.stringify({ notifications_enabled: false }),
    },
    accessToken,
  );
  await unregisterPushNotifications(accessToken).catch(() => undefined);
}

export async function saveNotificationMode(
  accessToken: string,
  mode: NotificationMode,
): Promise<void> {
  await apiFetch(
    "/api/settings",
    {
      method: "PATCH",
      body: JSON.stringify({ notification_mode: mode }),
    },
    accessToken,
  );
}

export async function maybeOfferNotificationsAfterFirstFavorite(
  accessToken: string,
): Promise<void> {
  try {
    const settings = await loadNotificationSettings(accessToken);
    if (settings.notifications_enabled) return;
    await enableMorningNotifications(accessToken, settings.notification_mode);
  } catch {
    // Settings are optional after adding a favorite.
  }
}
