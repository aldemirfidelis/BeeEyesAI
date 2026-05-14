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
  SOCIAL:  "bee-social",
  ALERTS:  "bee-alerts",
  ALARMS:  "bee-alarms",
  TIPS:    "bee-tips",
} as const;

// ── Canais Android ────────────────────────────────────────────────────────────
// Deve ser chamado na inicialização do app (antes de qualquer notificação)
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Promise.all([
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
    Notifications.setNotificationChannelAsync(CHANNEL.ALARMS, {
      name: "🔔 Despertadores",
      description: "Alarmes, remédios e compromissos com vibração",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 900, 250, 900, 250, 900],
      lightColor: "#FFD940",
      sound: "default",
      enableVibrate: true,
      bypassDnd: false,
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

// ── Alarm notification category (botões snooze + dispensar) ──────────────────
// Registra categorias de ação para os alarmes da Bee.
// Deve ser chamado uma vez na inicialização do app.
export async function setupAlarmNotificationCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync("bee-alarm-actions", [
      {
        identifier: "snooze",
        buttonTitle: "Adiar 5 min ⏰",
        options: { opensAppToForeground: true },
      },
      {
        identifier: "dismiss",
        buttonTitle: "Dispensar",
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);
  } catch {
    // Non-fatal — ação é opcional
  }
}

// ── Tap listener ──────────────────────────────────────────────────────────────
// Registra uma vez no _layout para navegar ao tocar na notificação.
// Também processa ações de snooze/dismiss diretamente.
let tapListenerRef: Notifications.EventSubscription | null = null;

export function setupNotificationTapListener(): () => void {
  // Remove listener anterior se existir (evita duplicatas em hot reload)
  if (tapListenerRef) {
    tapListenerRef.remove();
    tapListenerRef = null;
  }

  tapListenerRef = Notifications.addNotificationResponseReceivedListener(async (response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const actionId = response.actionIdentifier;
    const screen = data?.screen as string | undefined;
    const alarmId = data?.alarmId as string | undefined;
    const alarmTitle = data?.alarmTitle as string | undefined;
    const alarmBodyText = data?.alarmBody as string | undefined;
    const source = data?.source as string | undefined;

    // ── Ação: Snooze ──────────────────────────────────────────────────────────
    if (actionId === "snooze" && alarmId) {
      try {
        const { snoozeAlarm } = await import("../services/alarmService");
        await snoozeAlarm({ id: alarmId, title: alarmTitle ?? "Alarme", message: alarmBodyText ?? null, kind: "alarm" });
        if (__DEV__) console.log("[Notifications] Alarm snoozed", alarmId);
      } catch { /* ignore */ }
      return;
    }

    // ── Ação: Dispensar ───────────────────────────────────────────────────────
    if (actionId === "dismiss") {
      return;
    }

    // ── Toque padrão: abrir tela da Bee ──────────────────────────────────────
    let targetScreen = screen;
    if (source === "bee-alarm" && alarmId) {
      const params = new URLSearchParams({
        alarmId,
        ...(alarmTitle ? { alarmTitle } : {}),
        ...(alarmBodyText ? { alarmBody: alarmBodyText } : {}),
      });
      targetScreen = `/bee-alarm?${params.toString()}`;
    }

    if (!targetScreen) return;

    // Aguarda o app terminar de montar antes de navegar
    setTimeout(() => {
      try {
        router.push(targetScreen as any);
      } catch {
        try { router.replace(targetScreen as any); } catch { /* give up */ }
      }
    }, 350);
  });

  return () => {
    tapListenerRef?.remove();
    tapListenerRef = null;
  };
}

// ── Helpers de notificação imediata ──────────────────────────────────────────

export async function notifyStreakRisk(): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "BeeEyes · Sua sequência está em risco ⚠️",
        body: "Você ainda não completou nenhuma atividade hoje. Não perca sua sequência!",
        data: { source: "bee-streak", screen: "/(tabs)" },
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

export async function notifyLevelUp(newLevel: number): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `BeeEyes · Você chegou ao Nível ${newLevel}! 🏆`,
        body: "Seu progresso foi atualizado. Confira as novidades no app!",
        data: { source: "bee-levelup", screen: "/(tabs)" },
        sound: true,
        ...(Platform.OS === "android" && { channelId: CHANNEL.ALERTS }),
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
