import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

// Mostra o banner mesmo com o app em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// Cancela agendamentos anteriores da Bee e reagenda com base no contexto do dia
export async function scheduleDailyBeeNotifications(): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Busca o contexto adaptativo do servidor
    const { data } = await api.get<{
      label: string;
      reason: string;
      tip: string;
      moodAvg: number | null;
    }>("/api/missions/daily-context");

    // Cancela notificações anteriores da Bee para não acumular
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if ((n.content.data as any)?.source === "bee-daily") {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    const now = new Date();

    // Notificação da manhã (09:00) — contexto do dia
    const morning = new Date(now);
    morning.setHours(9, 0, 0, 0);
    if (morning <= now) morning.setDate(morning.getDate() + 1);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Bee-Eyes · ${data.label}`,
        body: data.tip,
        data: { source: "bee-daily", screen: "/missions" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: morning,
      },
    });

    // Notificação da tarde (18:00) — lembrete de missões
    const evening = new Date(now);
    evening.setHours(18, 0, 0, 0);
    if (evening <= now) evening.setDate(evening.getDate() + 1);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Bee-Eyes · Suas missões te esperam",
        body: "Ainda dá tempo de fechar uma hoje. Não deixa o dia passar em branco 🐝",
        data: { source: "bee-daily", screen: "/missions" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: evening,
      },
    });
  } catch {
    // silencioso — notificações são opcionais
  }
}
