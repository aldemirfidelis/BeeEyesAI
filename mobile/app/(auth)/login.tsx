import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from "react-native";
import { router, Link } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import BeeEyes from "../../components/BeeEyes";
import { COLORS, FONTS } from "../../lib/theme";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setToken, setUser } = useAuthStore();

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Atenção", "Preencha usuário e senha");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { username, password });
      await SecureStore.setItemAsync("bee_token", data.token);
      setToken(data.token);
      setUser(data.user);
      router.replace("/(tabs)/");
    } catch (err: any) {
      Alert.alert("Erro", err.response?.data?.message || "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <BeeEyes expression="happy" size={100} />
          <Text style={styles.title}>bee-eyes</Text>
          <Text style={styles.subtitle}>Seu melhor amigo com IA 🐝</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Nome de usuário"
            placeholderTextColor={COLORS.muted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor={COLORS.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <Link href="/(auth)/register" asChild>
            <TouchableOpacity style={styles.linkButton}>
              <Text style={styles.linkText}>
                Não tem conta? <Text style={styles.linkHighlight}>Criar conta</Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.primary,
    marginTop: 16,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 4,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: FONTS.sans,
    color: COLORS.foreground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: FONTS.display,
    fontWeight: "700",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  linkText: {
    color: COLORS.muted,
    fontFamily: FONTS.sans,
    fontSize: 14,
  },
  linkHighlight: {
    color: COLORS.primary,
    fontWeight: "600",
  },
});
