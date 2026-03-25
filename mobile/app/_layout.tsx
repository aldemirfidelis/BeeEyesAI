import { useEffect } from "react";
import { Stack } from "expo-router";
import { router } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { queryClient } from "../lib/queryClient";
import { useAuthStore } from "../stores/authStore";

export default function RootLayout() {
  const { initialize, isLoading, token } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (token) {
        router.replace("/(tabs)/");
      } else {
        router.replace("/(auth)/login");
      }
    }
  }, [isLoading, token]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
