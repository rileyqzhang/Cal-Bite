import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Session } from "@supabase/supabase-js";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";

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
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
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

  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#003262" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#003262" },
        headerTintColor: "#fff",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/signup" options={{ title: "Sign In" }} />
      <Stack.Screen name="(tabs)/home" options={{ title: "Berkeley Dining" }} />
      <Stack.Screen name="menu/[date]" options={{ title: "Full Menu" }} />
      <Stack.Screen name="food/[date]/[itemId]" options={{ title: "Food" }} />
      <Stack.Screen name="favorites/setup" options={{ title: "Favorite Foods" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
