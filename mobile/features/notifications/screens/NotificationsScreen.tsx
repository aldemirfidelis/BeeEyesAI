import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useEffect, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api } from "@mobile/lib/api";
import type { NotificationCenterItem, ScoreSnapshot } from "@mobile/lib/intelligence";
import { timeAgo } from "@mobile/lib/social";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<NotificationCenterItem[]>({
    queryKey: ["notifications-center"],
    queryFn: () => api.get("/api/notifications/center").then((r) => r.data),
    staleTime: 45 * 1000,
    refetchInterval: 90 * 1000,
    retry: false,
  });

  const { data: score } = useQuery<ScoreSnapshot>({
    queryKey: ["score"],
    queryFn: () => api.get("/api/score").then((r) => r.data),
    staleTime: 30 * 1000,
    retry: false,
  });

  const markNotificationsRead = useMutation({
    mutationFn: (ids: string[]) => api.post("/api/notifications/read", { ids }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-center"] });
    },
  });

  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  useEffect(() => {
    const unreadIds = safeNotifications.filter((item) => !item.read).map((item) => item.id);
    if (unreadIds.length === 0 || markNotificationsRead.isPending) return;
    markNotificationsRead.mutate(unreadIds);
  }, [markNotificationsRead.isPending, markNotificationsRead.mutate, safeNotifications]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Alertas da Bee</Text>
          <Text style={styles.headerSub}>Tudo o que pede sua atencao agora</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {score ? (
          <View style={styles.scoreCard}>
            <Text style={styles.cardTitle}>Leitura atual</Text>
            <View style={styles.scoreTopRow}>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreValue}>{score.focusScore}</Text>
                <Text style={styles.scoreTone}>{score.scoreTone}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scoreLine}>{score.summary}</Text>
                <Text style={styles.scoreHint}>{score.insight}</Text>
              </View>
            </View>
            <View style={styles.scoreMetaRow}>
              <Text style={styles.scoreMeta}>{score.consistencyScore}% constancia</Text>
              <Text style={styles.scoreMeta}>{score.disciplineScore}% disciplina</Text>
            </View>
          </View>
        ) : null}

        {safeNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nada urgente por aqui.</Text>
            <Text style={styles.emptyText}>Quando a Bee detectar risco, progresso ou movimento da rede, isso aparece aqui.</Text>
          </View>
        ) : (
          safeNotifications.map((item) => (
            <View
              key={item.id}
              style={[
                styles.notificationCard,
                item.tone === "danger"
                  ? styles.notificationDanger
                  : item.tone === "positive"
                  ? styles.notificationPositive
                  : item.tone === "warning"
                  ? styles.notificationWarning
                  : styles.notificationNeutral,
                !item.read ? styles.notificationUnread : null,
              ]}
            >
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                <Text style={styles.notificationTime}>{timeAgo(item.createdAt)}</Text>
              </View>
              <Text style={styles.notificationBody}>{item.body}</Text>
              <Text style={styles.notificationSource}>
                {item.category === "social" ? "Social" : item.category === "activity" ? "Atividade" : "Alerta"} · {item.source}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontFamily: FONTS.display, fontSize: 24, fontWeight: "800", color: colors.foreground },
    headerSub: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
    content: { padding: 16, gap: 12, paddingBottom: 32 },
    scoreCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.foreground },
    scoreTopRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    scoreBadge: {
      width: 84,
      borderRadius: 18,
      paddingVertical: 12,
      paddingHorizontal: 10,
      backgroundColor: colors.secondary,
      alignItems: "center",
      gap: 2,
    },
    scoreValue: { fontFamily: FONTS.display, fontSize: 28, fontWeight: "800", color: colors.foreground },
    scoreTone: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.primaryDark, textTransform: "uppercase" },
    scoreLine: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, color: colors.foreground },
    scoreHint: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 4 },
    scoreMetaRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    scoreMeta: { fontFamily: FONTS.mono, fontSize: 12, fontWeight: "700", color: colors.foreground },
    emptyState: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    emptyTitle: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "700", color: colors.foreground },
    emptyText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, color: colors.muted },
    notificationCard: { borderRadius: 18, padding: 14, borderWidth: 1, gap: 6 },
    notificationNeutral: { backgroundColor: colors.card, borderColor: colors.border },
    notificationWarning: { backgroundColor: colors.secondary + "AA", borderColor: colors.primaryDark + "44" },
    notificationDanger: { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "55" },
    notificationPositive: { backgroundColor: colors.success + "14", borderColor: colors.success + "44" },
    notificationUnread: { shadowColor: colors.foreground, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
    notificationHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" },
    notificationTitle: { flex: 1, fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.foreground },
    notificationTime: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted },
    notificationBody: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, color: colors.foreground },
    notificationSource: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted, textTransform: "lowercase" },
  });
}
