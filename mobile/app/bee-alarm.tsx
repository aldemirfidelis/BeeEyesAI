/**
 * bee-alarm.tsx
 *
 * Tela especial da Bee exibida quando o usuário toca em uma notificação de alarme.
 * Parâmetros via query string: alarmId, alarmTitle, alarmBody
 *
 * Funcionalidades:
 * - Exibe avatar da Bee, título e mensagem do alarme
 * - Botão "Adiar 5 min" (re-agenda notificação via alarmService.snoozeAlarm)
 * - Botão "Concluir" (fecha a tela)
 * - Botão "Ver meus alarmes" (navega para Colmeia)
 * - Vibração e visual acolhedor no estilo Bee
 */

import { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useUIStore } from "@mobile/stores/uiStore";
import { getThemeColors, FONTS } from "@mobile/lib/theme";
import { snoozeAlarm } from "@mobile/services/alarmService";

export default function BeeAlarmScreen() {
  const { themeMode } = useUIStore();
  const colors = getThemeColors(themeMode);
  const params = useLocalSearchParams<{
    alarmId?: string;
    alarmTitle?: string;
    alarmBody?: string;
  }>();

  const alarmId = params.alarmId ?? "";
  const alarmTitle = decodeURIComponent(params.alarmTitle ?? "Alarme");
  const alarmBody = decodeURIComponent(params.alarmBody ?? "");

  // Vibração ao entrar na tela (feedback de alarme)
  useEffect(() => {
    if (Platform.OS !== "web") {
      Vibration.vibrate([0, 400, 200, 400, 200, 400]);
    }
  }, []);

  const handleSnooze = async () => {
    if (alarmId) {
      await snoozeAlarm({ id: alarmId, title: alarmTitle, message: alarmBody || null, kind: "alarm" }).catch(() => {});
    }
    router.back();
  };

  const handleDismiss = () => {
    router.back();
  };

  const handleOpenAlarms = () => {
    router.replace("/(tabs)/colmeia" as any);
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
      {/* Bee avatar area */}
      <View style={s.beeArea}>
        <View style={[s.beeCircle, { backgroundColor: colors.primaryDark + "18" }]}>
          <Text style={s.beeEmoji}>🐝</Text>
        </View>
        <View style={[s.pulse, { borderColor: colors.primaryDark + "30" }]} />
      </View>

      {/* Content */}
      <View style={s.content}>
        <Text style={[s.label, { color: colors.muted }]}>BeeEyes · Despertador</Text>
        <Text style={[s.title, { color: colors.foreground }]}>{alarmTitle}</Text>
        {!!alarmBody && alarmBody !== alarmTitle && (
          <Text style={[s.body, { color: colors.muted }]}>{alarmBody}</Text>
        )}
        <Text style={[s.timeText, { color: colors.primaryDark }]}>
          {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>

      {/* Actions */}
      <View style={s.actions}>
        {/* Snooze */}
        <TouchableOpacity
          style={[s.snoozeBtn, { backgroundColor: colors.card, borderColor: colors.primaryDark + "40" }]}
          onPress={handleSnooze}
          activeOpacity={0.8}
        >
          <Feather name="clock" size={20} color={colors.primaryDark} />
          <Text style={[s.snoozeBtnText, { color: colors.primaryDark }]}>Adiar 5 minutos</Text>
          <Text style={[s.snoozeHint, { color: colors.muted }]}>Quer que eu te avise daqui pouco? 🐝</Text>
        </TouchableOpacity>

        {/* Dismiss */}
        <TouchableOpacity
          style={[s.dismissBtn, { backgroundColor: colors.primaryDark }]}
          onPress={handleDismiss}
          activeOpacity={0.85}
        >
          <Feather name="check" size={20} color="#fff" />
          <Text style={s.dismissBtnText}>Concluir</Text>
        </TouchableOpacity>
      </View>

      {/* Footer link */}
      <TouchableOpacity onPress={handleOpenAlarms} style={s.footer}>
        <Text style={[s.footerText, { color: colors.muted }]}>Ver meus alarmes</Text>
        <Feather name="arrow-right" size={13} color={colors.muted} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  beeArea: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    position: "relative",
  },
  beeCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  beeEmoji: {
    fontSize: 64,
  },
  pulse: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
  },
  content: {
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.sans,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 34,
  },
  body: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  timeText: {
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 8,
  },
  actions: {
    width: "100%",
    gap: 12,
    marginBottom: 8,
  },
  snoozeBtn: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
    alignItems: "center",
    gap: 6,
  },
  snoozeBtnText: {
    fontSize: 17,
    fontWeight: "700",
  },
  snoozeHint: {
    fontSize: 12,
  },
  dismissBtn: {
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  dismissBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 13,
  },
});
