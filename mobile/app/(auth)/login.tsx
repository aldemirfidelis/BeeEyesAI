import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Dimensions, Alert,
} from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat,
  withSequence, FadeInDown, SlideInDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, G, Rect, Circle } from "react-native-svg";
import { router, Link } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import BeeEyes from "../../components/BeeEyes";
import { COLORS } from "../../lib/theme";

WebBrowser.maybeCompleteAuthSession();

const { height } = Dimensions.get("window");

// ── Google "G" Icon ──────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

// ── Apple Icon ───────────────────────────────────────────────────────────────
function AppleIcon({ color = "#fff" }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.35.74 3.17.79 1.2-.24 2.35-.93 3.64-.84 1.55.12 2.72.72 3.48 1.84-3.2 1.91-2.44 6.12.72 7.28-.57 1.46-1.3 2.9-3.01 3.81zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

// ── Eye Icon ─────────────────────────────────────────────────────────────────
function EyeIcon({ visible, color = "#888" }: { visible: boolean; color?: string }) {
  return visible ? (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
    </Svg>
  ) : (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M1 1l22 22" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function GoogleLoginButton({
  enabled,
  loading,
  googleLoading,
  onSuccess,
}: {
  enabled: boolean;
  loading: boolean;
  googleLoading: boolean;
  onSuccess: (accessToken: string) => void;
}) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const accessToken = response.authentication?.accessToken;
      if (accessToken) {
        onSuccess(accessToken);
      }
    }
  }, [onSuccess, response]);

  return (
    <TouchableOpacity
      style={styles.socialBtn}
      onPress={() => promptAsync()}
      disabled={!request || loading || googleLoading}
      activeOpacity={0.8}
    >
      {googleLoading ? (
        <Text style={styles.socialBtnText}>...</Text>
      ) : (
        <>
          <GoogleIcon />
          <Text style={styles.socialBtnText}>Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { setToken, setUser } = useAuthStore();

  // BeeEyes float animation
  const floatY = useSharedValue(0);
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(withTiming(-10, { duration: 1800 }), withTiming(0, { duration: 1800 })),
      -1, true
    );
  }, []);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value }] }));

  // Google OAuth
  const googleEnabled = Boolean(
    Platform.select({
      android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    }),
  );

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
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Erro", err.response?.data?.message || "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialLogin(provider: string, accessToken: string) {
    setGoogleLoading(true);
    try {
      const { data } = await api.post("/api/auth/social", { provider, accessToken });
      await SecureStore.setItemAsync("bee_token", data.token);
      setToken(data.token);
      setUser(data.user);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Erro", err.response?.data?.message || "Falha ao entrar com Google");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Hero gradient */}
      <LinearGradient colors={["#FFF8E7", "#FFE566", "#F5C842"]} style={styles.hero}>
        {/* Decorative hexagons */}
        <Svg style={styles.decoTop} width={160} height={160} viewBox="0 0 160 160" opacity={0.12}>
          <Path d="M40 10 L70 10 L85 36 L70 62 L40 62 L25 36 Z" fill="#D4A017" />
          <Path d="M90 40 L120 40 L135 66 L120 92 L90 92 L75 66 Z" fill="#D4A017" />
          <Path d="M20 70 L50 70 L65 96 L50 122 L20 122 L5 96 Z" fill="#D4A017" />
        </Svg>

        <Animated.View style={[styles.beeContainer, floatStyle]}>
          <BeeEyes expression="happy" size={110} />
        </Animated.View>
        <Text style={styles.brandName}>bee-eyes</Text>
        <Text style={styles.brandTagline}>Sua melhor amiga com IA 🐝</Text>
      </LinearGradient>

      {/* Form card */}
      <Animated.View entering={SlideInDown.springify().damping(18)} style={styles.card}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.delay(100)}>
            <Text style={styles.cardTitle}>Olá de novo! 👋</Text>
            <Text style={styles.cardSubtitle}>Entre para continuar sua jornada</Text>
          </Animated.View>

          {/* Inputs */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Usuário</Text>
            <TextInput
              style={styles.input}
              placeholder="seu_nome_aqui"
              placeholderTextColor={COLORS.muted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(280)} style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Senha</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="••••••••"
                placeholderTextColor={COLORS.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <EyeIcon visible={showPassword} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Login button */}
          <Animated.View entering={FadeInDown.delay(360)}>
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading || googleLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#FFD700", "#F5C842", "#E8B800"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.primaryBtnGradient}
              >
                {loading ? (
                  <Text style={styles.primaryBtnText}>Entrando...</Text>
                ) : (
                  <Text style={styles.primaryBtnText}>Entrar  →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Divider */}
          <Animated.View entering={FadeInDown.delay(420)} style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou continue com</Text>
            <View style={styles.dividerLine} />
          </Animated.View>

          {/* Social buttons */}
          <Animated.View entering={FadeInDown.delay(480)} style={styles.socialRow}>
            {googleEnabled ? (
              <GoogleLoginButton
                enabled={googleEnabled}
                loading={loading}
                googleLoading={googleLoading}
                onSuccess={(accessToken) => handleSocialLogin("google", accessToken)}
              />
            ) : (
              <TouchableOpacity
                style={[styles.socialBtn, styles.btnDisabled]}
                onPress={() => Alert.alert("Google indisponível", "Configure EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID para ativar o login com Google.")}
                activeOpacity={0.8}
              >
                <GoogleIcon />
                <Text style={styles.socialBtnText}>Google</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.socialBtn, styles.appleBtnStyle]}
              onPress={() => Alert.alert("Em breve", "Login com Apple estará disponível em breve!")}
              activeOpacity={0.8}
            >
              <AppleIcon color="#1A1A1A" />
              <Text style={[styles.socialBtnText, { color: "#1A1A1A" }]}>Apple</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Register link */}
          <Animated.View entering={FadeInDown.delay(540)} style={styles.footer}>
            <Text style={styles.footerText}>Não tem conta? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Criar conta ↗</Text>
              </TouchableOpacity>
            </Link>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5C842",
  },
  hero: {
    height: height * 0.40,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 24,
  },
  decoTop: {
    position: "absolute",
    top: -10,
    right: -10,
  },
  beeContainer: {
    marginBottom: 4,
  },
  brandName: {
    fontFamily: "System",
    fontSize: 34,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontFamily: "System",
    fontSize: 14,
    color: "#6B5000",
    marginTop: 2,
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  cardTitle: {
    fontFamily: "System",
    fontSize: 26,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  cardSubtitle: {
    fontFamily: "System",
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 4,
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: "System",
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: "#F8F6F0",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 15,
    fontFamily: "System",
    color: "#1A1A1A",
    borderWidth: 1.5,
    borderColor: "#EDE9E0",
    marginBottom: 0,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyeBtn: {
    padding: 14,
    backgroundColor: "#F8F6F0",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#EDE9E0",
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 4,
    shadowColor: "#F5C842",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnGradient: {
    paddingVertical: 17,
    alignItems: "center",
  },
  primaryBtnText: {
    fontFamily: "System",
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: 0.3,
  },
  btnDisabled: { opacity: 0.6 },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#EDE9E0",
  },
  dividerText: {
    fontFamily: "System",
    fontSize: 12,
    color: COLORS.muted,
  },
  socialRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#EDE9E0",
    backgroundColor: "#FFFFFF",
  },
  appleBtnStyle: {
    backgroundColor: "#F8F6F0",
  },
  socialBtnText: {
    fontFamily: "System",
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    paddingBottom: 8,
  },
  footerText: {
    fontFamily: "System",
    fontSize: 14,
    color: COLORS.muted,
  },
  footerLink: {
    fontFamily: "System",
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
});
