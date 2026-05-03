import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";
import { api } from "./api";

// ── Foreground handler ────────────────────────────────────────────────────────
// Mostra banner mesmo com o app aberto em primeiro plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Canal IDs ─────────────────────────────────────────────────────────────────
export const CHANNEL = {
  MISSIONS:  "bee-missions",
  SOCIAL:    "bee-social",
  ALERTS:    "bee-alerts",
  TIPS:      "bee-tips",
} as const;

// ── Canais Android ────────────────────────────────────────────────────────────
// Deve ser chamado na inicialização do app (antes de qualquer notificação)
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Promise.all([
    Notifications.setNotificationChannelAsync(CHANNEL.MISSIONS, {
      name: "🎯 Missões",
      description: "Lembretes de missões e progresso diário",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: "#FFD940",
      sound: "default",
      enableVibrate: true,
    }),
    Notifications.setNotificationChannelAsync(CHANNEL.SOCIAL, {
      name: "🤝 Social",
      description: "Conexões, amigos e comunidades",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#FFD940",
      sound: "default",
      enableVibrate: true,
    }),
    Notifications.setNotificationChannelAsync(CHANNEL.ALERTS, {
      name: "⚠️ Alertas da Bee",
      description: "Alertas importantes sobre seu progresso",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: "#FF4444",
      sound: "default",
      enableVibrate: true,
    }),
    Notifications.setNotificationChannelAsync(CHANNEL.TIPS, {
      name: "💡 Dicas da Bee",
      description: "Dicas de uso e novidades do app",
      importance: Notifications.AndroidImportance.LOW,
      lightColor: "#FFD940",
      sound: null,
      enableVibrate: false,
    }),
  ]);
}

// ── Permissões ────────────────────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowCriticalAlerts: false,
      provideAppNotificationSettings: false,
      allowProvisional: false,
    },
  });

  return status === "granted";
}

// ── Push token ────────────────────────────────────────────────────────────────
// Registra o token de push no servidor para notificações remotas
export async function registerPushToken(): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: "d0d86027-eada-4f64-bf91-faba1d627a58",
    });

    await api.post("/api/notifications/push-token", { token: token.data }).catch(() => {});
  } catch {
    // Em emuladores ou sem EAS o token pode não estar disponível — silencioso
  }
}

// ── Tap listener ──────────────────────────────────────────────────────────────
// Registra uma vez no _layout para navegar ao tocar na notificação
let tapListenerRef: Notifications.EventSubscription | null = null;

export function setupNotificationTapListener(): () => void {
  // Remove listener anterior se existir (evita duplicatas em hot reload)
  if (tapListenerRef) {
    tapListenerRef.remove();
    tapListenerRef = null;
  }

  tapListenerRef = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, string> | undefined;
    const screen = data?.screen;

    if (!screen) return;

    // Aguarda o app terminar de montar antes de navegar
    setTimeout(() => {
      try {
        router.push(screen as any);
      } catch {
        router.replace(screen as any);
      }
    }, 300);
  });

  return () => {
    tapListenerRef?.remove();
    tapListenerRef = null;
  };
}

// ── Notificações agendadas diárias ────────────────────────────────────────────
export async function scheduleDailyBeeNotifications(): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Cancela notificações anteriores da Bee para não acumular
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => {
          try { return (n.content.data as any)?.source === "bee-daily"; } catch { return false; }
        })
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    const now = new Date();

    // Busca o contexto adaptativo com fallback seguro
    let morningTitle = "BeeEyes · Bom dia! 🐝";
    let morningBody = "Suas missões do dia estão prontas. Toque para começar.";

    try {
      const { data } = await api.get<{
        label?: string | null;
        tip?: string | null;
        reason?: string | null;
        moodAvg: number | null;
      }>("/api/missions/daily-context");

      const label = typeof data?.label === "string" && data.label.trim() ? data.label.trim() : null;
      const tip   = typeof data?.tip   === "string" && data.tip.trim()   ? data.tip.trim()   : null;

      if (label) morningTitle = `BeeEyes · ${label}`;
      if (tip)   morningBody  = tip;
    } catch {
      // usa fallback — não interrompe o agendamento
    }

    // Notificação da manhã (09:00) — contexto do dia
    const morning = new Date(now);
    morning.setHours(9, 0, 0, 0);
    if (morning <= now) morning.setDate(morning.getDate() + 1);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: morningTitle,
        body: morningBody,
        data: { source: "bee-daily", screen: "/(tabs)/missions" },
        sound: true,
        ...(Platform.OS === "android" && { channelId: CHANNEL.MISSIONS }),
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
        title: "BeeEyes · Missões te esperam 🎯",
        body: "Ainda dá tempo de fechar uma hoje. Não deixa o dia passar em branco.",
        data: { source: "bee-daily", screen: "/(tabs)/missions" },
        sound: true,
        ...(Platform.OS === "android" && { channelId: CHANNEL.MISSIONS }),
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

// ── Helpers de notificação imediata ───────────────────────────────────────────

export async function notifyStreakRisk(): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "BeeEyes · Sua sequência está em risco ⚠️",
        body: "Você ainda não completou nenhuma atividade hoje. Não perca sua sequência!",
        data: { source: "bee-streak", screen: "/(tabs)/missions" },
        sound: true,
        ...(Platform.OS === "android" && { channelId: CHANNEL.ALERTS }),
      },
      trigger: null,
    });
  } catch {}
}

export async function notifyNewConnection(fromName: string): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const name = fromName?.trim() || "Alguém";

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "BeeEyes · Nova solicitação de conexão 🤝",
        body: `${name} quer se conectar com você.`,
        data: { source: "bee-social", screen: "/(tabs)" },
        sound: true,
        ...(Platform.OS === "android" && { channelId: CHANNEL.SOCIAL }),
      },
      trigger: null,
    });
  } catch {}
}

export async function notifyMissionComplete(missionTitle: string, xp: number): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const title = missionTitle?.trim() || "Missão";

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "BeeEyes · Missão concluída! 🎉",
        body: `"${title}" — +${xp} XP ganhos!`,
        data: { source: "bee-mission-done", screen: "/(tabs)/missions" },
        sound: true,
        ...(Platform.OS === "android" && { channelId: CHANNEL.MISSIONS }),
      },
      trigger: null,
    });
  } catch {}
}

export async function notifyLevelUp(newLevel: number): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `BeeEyes · Você chegou ao Nível ${newLevel}! 🏆`,
        body: "Novos recursos desbloqueados. Confira o que ganhou!",
        data: { source: "bee-levelup", screen: "/(tabs)/missions" },
        sound: true,
        ...(Platform.OS === "android" && { channelId: CHANNEL.MISSIONS }),
      },
      trigger: null,
    });
  } catch {}
}

export async function notifyNewTestimonial(fromName: string): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const name = fromName?.trim() || "Um amigo";

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "BeeEyes · Novo depoimento no seu perfil 💬",
        body: `${name} escreveu um depoimento para você.`,
        data: { source: "bee-testimonial", screen: "/(tabs)/profile" },
        sound: true,
        ...(Platform.OS === "android" && { channelId: CHANNEL.SOCIAL }),
      },
      trigger: null,
    });
  } catch {}
}
