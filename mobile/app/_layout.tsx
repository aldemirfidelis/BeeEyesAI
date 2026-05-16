import "@mobile/lib/i18n";
import { useEffect } from "react";
import { Stack } from "expo-router";

// Root ErrorBoundary do Expo Router — captura erros não tratados em qualquer
// rota/componente filho e mostra UI amigável em vez de crashar a app.
export { default as ErrorBoundary } from "@mobile/components/RouteErrorBoundary";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { queryClient } from "../lib/queryClient";
import { configureGoogleSignin } from "../lib/googleAuth";
import {
  setupNotificationChannels,
  setupNotificationTapListener,
  setupAlarmNotificationCategory,
  registerPushToken,
} from "../lib/notifications";
import { useAuthStore } from "../stores/authStore";
import { useUIStore } from "../stores/uiStore";
import { getThemeColors } from "../lib/theme";
import { applyAppLanguage } from "../lib/i18n";

export default function RootLayout() {
  const { initialize, isLoading, token } = useAuthStore();
  const { initializePreferences, isPreferencesReady, themeMode } = useUIStore();
  const colors = getThemeColors(themeMode);

  // Inicialização única: canais Android + listener de tap
  useEffect(() => {
    configureGoogleSignin();
    initialize().then(async () => {
      const { token } = useAuthStore.getState();
      let serverAvatarUrl: string | null = null;
      if (token) {
        try {
          const { api } = await import("../lib/api");
          const { data } = await api.get("/api/me");
          useAuthStore.getState().setUser(data);
          applyAppLanguage(data?.language);
          serverAvatarUrl = data?.avatarUrl ?? null;
        } catch {
          await useAuthStore.getState().logout();
        }
      }
      initializePreferences(serverAvatarUrl);
    });
    // Cria os canais Android antes de qualquer notificação
    setupNotificationChannels().catch(() => {});

    // Registra categorias de ação dos alarmes (snooze, dispensar)
    setupAlarmNotificationCategory().catch(() => {});

    // Listener de tap na notificação → navega para a tela correta
    const unsubscribe = setupNotificationTapListener();
    return unsubscribe;
  }, []);

  // Após login: agenda notificações diárias + registra push token
  useEffect(() => {
    if (!token) return;

    registerPushToken().catch(() => {});
  }, [token]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
          {isLoading || !isPreferencesReady ? (
            <View
              style={{
                flex: 1,
                backgroundColor: colors.background,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator size="large" color={colors.primaryDark} />
            </View>
          ) : (
            <Stack screenOptions={{ headerShown: false }} />
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
