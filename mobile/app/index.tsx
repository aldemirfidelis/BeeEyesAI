import { Redirect } from "expo-router";
import { useAuthStore } from "../stores/authStore";

export default function Index() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  if (token) {
    if (user?.onboardingCompleted === false) {
      return <Redirect href="/onboarding" />;
    }

    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
