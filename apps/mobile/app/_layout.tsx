import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { chrome, color, enableLayoutMotion } from "@/lib/theme";

enableLayoutMotion();

function openDailyDigestHome() {
  router.replace("/(tabs)/home");
}

function isDailyDigest(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as { type?: string }).type === "daily_digest"
  );
}

export default function RootLayout() {
  // Push response APIs are native-only; calling them on web throws.
  useEffect(() => {
    if (Platform.OS === "web") return;

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (isDailyDigest(response.notification.request.content.data)) {
          openDailyDigestHome();
        }
      },
    );

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response && isDailyDigest(response.notification.request.content.data)) {
        openDailyDigestHome();
      }
      if (typeof Notifications.clearLastNotificationResponseAsync === "function") {
        Notifications.clearLastNotificationResponseAsync();
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: chrome.headerStyle,
          headerTintColor: chrome.headerTintColor,
          headerShadowVisible: false,
          headerBackTitleVisible: false,
          headerBackButtonDisplayMode: "minimal",
          animation: "slide_from_right",
          contentStyle: { backgroundColor: color.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/signin" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/signup" options={{ headerShown: false }} />
        <Stack.Screen
          name="(tabs)/home"
          options={{ headerShown: false, title: "CalBite" }}
        />
        <Stack.Screen
          name="menu/[date]"
          options={{
            title: "CalBite",
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="food/[date]/[itemId]"
          options={{
            title: "CalBite",
            headerTitleStyle: { fontWeight: "700" },
            headerBackButtonDisplayMode: "minimal",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="favorites/setup"
          options={{
            title: "Favorite Foods",
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: "Settings",
            headerBackButtonDisplayMode: "minimal",
          }}
        />
      </Stack>
    </>
  );
}
