import { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import { PressableScale } from "@/components/PressableScale";
import {
  explainAuthNetworkError,
  getSupabaseConfigError,
} from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { color, radius, type } from "@/lib/theme";

function showMessage(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    getSupabaseConfigError(),
  );

  async function handleSignIn() {
    setLoading(true);
    setErrorMessage(getSupabaseConfigError());

    const configError = getSupabaseConfigError();
    if (configError) {
      setErrorMessage(configError);
      setLoading(false);
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage("Email and password are required.");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;
      if (!data.session) {
        throw new Error("Sign in succeeded but no session was returned.");
      }
      router.replace("/(tabs)/home");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown authentication error";
      const friendly = explainAuthNetworkError(message);
      setErrorMessage(friendly);
      showMessage("Sign in failed", friendly);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cal Bite</Text>
      <Text style={styles.subtitle}>Sign in to track your favorite foods</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={color.faint}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor={color.faint}
        value={password}
        onChangeText={setPassword}
      />
      {errorMessage ? <Text style={styles.status}>{errorMessage}</Text> : null}
      <PressableScale
        style={styles.button}
        onPress={handleSignIn}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? "…" : "Sign In"}</Text>
      </PressableScale>
      <Link href="/(auth)/signup" style={styles.link}>
        Create an account
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: color.background,
  },
  title: {
    ...type.display,
    fontSize: 28,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: color.muted,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.card,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
    color: color.reading,
  },
  button: {
    backgroundColor: color.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonText: { color: color.ink, fontWeight: "700", fontSize: 16 },
  link: {
    marginTop: 8,
    color: color.ink,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 12,
  },
  status: { color: color.ink, marginBottom: 12, fontWeight: "600" },
});
