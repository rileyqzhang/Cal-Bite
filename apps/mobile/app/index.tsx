import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { supabase } from "@/lib/supabase";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Index() {
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [exited, setExited] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setAuthReady(true);
    }, 8000);

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSignedIn(!!data.session);
      setAuthReady(true);
      clearTimeout(timeout);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const onExitComplete = useCallback(() => {
    setExited(true);
  }, []);

  if (exited) {
    return <Redirect href={signedIn ? "/(tabs)/home" : "/(auth)/signin"} />;
  }

  return <AnimatedSplash canExit={authReady} onExitComplete={onExitComplete} />;
}
