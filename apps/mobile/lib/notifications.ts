import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "./supabase";

export const DAILY_CHANNEL_ID = "daily-favorites";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function expoProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
      ?.projectId
  );
}

export async function ensureDailyNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DAILY_CHANNEL_ID, {
    name: "Morning menu",
    importance: Notifications.AndroidImportance.DEFAULT,
    description: "Once a day at 7:30 AM Pacific",
  });
}

export async function getNotificationPermissionStatus(): Promise<
  Notifications.PermissionStatus
> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") return true;
  if (existing.status === "denied") return false;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return status === "granted";
}

export async function registerForPushNotifications(
  accessToken: string,
): Promise<string | null> {
  if (!Device.isDevice) return null;

  const granted = await requestNotificationPermission();
  if (!granted) return null;

  await ensureDailyNotificationChannel();

  const projectId = expoProjectId();
  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenData.data;
  await apiFetch(
    "/api/push/register",
    {
      method: "POST",
      body: JSON.stringify({ expo_push_token: token }),
    },
    accessToken,
  );
  return token;
}

export async function unregisterPushNotifications(
  accessToken: string,
  token?: string | null,
): Promise<void> {
  await apiFetch(
    "/api/push/unregister",
    {
      method: "POST",
      body: JSON.stringify(token ? { expo_push_token: token } : {}),
    },
    accessToken,
  );
}
