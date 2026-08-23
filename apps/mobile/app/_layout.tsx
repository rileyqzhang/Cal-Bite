import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Session } from "@supabase/supabase-js";
import { registerForPushNotifications } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { chrome, color, enableLayoutMotion } from "@/lib/theme";

enableLayoutMotion();

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
    if (session?.access_token) {
      registerForPushNotifications(session.access_token).catch(() => undefined);
    }
  }, [session?.access_token]);

  if (session === undefined) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: color.background,
        }}
      >
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={color.ink} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: chrome.headerStyle,
          headerTintColor: chrome.headerTintColor,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: color.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/signup" options={{ title: "Sign In" }} />
        <Stack.Screen name="(tabs)/home" options={{ title: "Berkeley Dining" }} />
        <Stack.Screen name="menu/[date]" options={{ title: "Full Menu" }} />
        <Stack.Screen name="food/[date]/[itemId]" options={{ title: "Food" }} />
        <Stack.Screen name="favorites/setup" options={{ title: "Favorite Foods" }} />
      </Stack>
    </>
  );
}
