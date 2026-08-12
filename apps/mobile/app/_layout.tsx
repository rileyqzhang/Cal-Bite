import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Session } from "@supabase/supabase-js";
import { registerForPushNotifications } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

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
      <Stack.Screen name="favorites/setup" options={{ title: "Favorite Foods" }} />
    </Stack>
  );
}
