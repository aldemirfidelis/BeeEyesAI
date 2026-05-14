import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api } from "@mobile/lib/api";
import type { NotificationCenterItem } from "@mobile/lib/intelligence";
import { timeAgo } from "@mobile/lib/social";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";
import type { PendingDMUser } from "@mobile/stores/uiStore";

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const setPendingDMUser = useUIStore((state) => state.setPendingDMUser);

  const { data: notifications = [] } = useQuery<NotificationCenterItem[]>({
    queryKey: ["notifications-center"],
    queryFn: () => api.get("/api/notifications/center").then((r) => r.data),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    retry: false,
  });

  const markNotificationsRead = useMutation({
    mutationFn: (ids: string[]) => api.post("/api/notifications/read", { ids }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-center"] });
    },
  });

  const clearNotifications = useMutation({
    mutationFn: () => api.post("/api/notifications/clear").then((r) => r.data),
    onSuccess: () => {
      queryClient.setQueryData(["notifications-center"], []);
      queryClient.invalidateQueries({ queryKey: ["notifications-center"] });
    },
  });

  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  function iconForNotification(item: NotificationCenterItem): React.ComponentProps<typeof Feather>["name"] {
    if (item.source === "direct_message") return "message-circle";
    if (item.source === "connection") return "user-plus";
    if (item.source === "community") return "users";
    if (item.source === "visit") return "eye";
    return "bell";
  }

  function handleNotificationPress(item: NotificationCenterItem) {
    if (!item.read && !markNotificationsRead.isPending) {
      markNotificationsRead.mutate([item.id]);
    }

    if (item.source === "direct_message" && item.fromUserId) {
      const dmUser: PendingDMUser = {
        id: item.fromUserId,
        username: item.fromName || item.fromUserId,
        displayName: item.fromName || null,
        level: 1,
        avatarUrl: null,
      };
      setPendingDMUser(dmUser);
      router.push("/(tabs)/inbox" as never);
      return;
    }

    if (item.source === "connection") { router.push("/friends" as never); return; }
    if (item.source === "community") { router.push("/communities" as never); return; }
    if (item.source === "visit" && item.fromUserId) {
      router.push({ pathname: "/friends", params: { openProfile: item.fromUserId } } as never);
      return;
    }
    if (item.source === "visit") { router.push("/profile" as never); return; }
    router.push("/" as never);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t("notifications_title")}</Text>
          <Text style={styles.headerSub}>{t("notifications_subtitle")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {safeNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="bell" size={32} color={colors.muted} style={{ alignSelf: "center", marginBottom: 8 }} />
            <Text style={styles.emptyTitle}>Nenhum alerta no momento.</Text>
            <Text style={styles.emptyText}>{t("notifications_empty_text")}</Text>
          </View>
        ) : (
          safeNotifications.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => handleNotificationPress(item)}
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
                <View style={styles.notificationTitleRow}>
                  <Feather name={iconForNotification(item)} size={14} color={item.source === "direct_message" ? colors.primary : colors.muted} />
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notificationTime}>{timeAgo(item.createdAt)}</Text>
              </View>
              <Text style={styles.notificationBody}>{item.body}</Text>
              {item.source === "direct_message" ? (
                <Text style={styles.notificationAction}>Abrir conversa →</Text>
              ) : item.source === "visit" && item.fromUserId ? (
                <Text style={styles.notificationAction}>Ver perfil de {item.fromName || "quem visitou"} {"->"}</Text>
              ) : (
                <Text style={styles.notificationSource}>
                  {item.category === "social" ? t("notifications_social") : item.category === "activity" ? t("notifications_activity") : t("notifications_alert")} · {item.source}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      {safeNotifications.length > 0 ? (
        <TouchableOpacity
          style={[styles.clearButton, { bottom: Math.max(insets.bottom, 12) + 12 }]}
          onPress={() => clearNotifications.mutate()}
          disabled={clearNotifications.isPending}
          activeOpacity={0.85}
        >
          <Feather name="trash-2" size={16} color={colors.primaryDark ?? colors.foreground} />
          <Text style={styles.clearButtonText}>{clearNotifications.isPending ? "Limpando..." : "Limpar alertas"}</Text>
        </TouchableOpacity>
      ) : null}
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
    content: { padding: 16, gap: 12, paddingBottom: 96 },
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
    notificationWarning: { backgroundColor: colors.secondary, borderColor: colors.primaryDark + "66" },
    notificationDanger: { backgroundColor: colors.destructive + "33", borderColor: colors.destructive + "88" },
    notificationPositive: { backgroundColor: colors.success + "33", borderColor: colors.success + "88" },
    notificationUnread: { shadowColor: colors.foreground, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
    notificationHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" },
    notificationTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
    notificationTitle: { flex: 1, fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.foreground },
    notificationTime: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted },
    notificationBody: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, color: colors.foreground },
    notificationSource: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted, textTransform: "lowercase" },
    notificationAction: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "600", color: colors.primary },
    clearButton: {
      position: "absolute",
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.primary,
      shadowColor: colors.foreground,
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 6,
    },
    clearButtonText: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "800", color: colors.primaryDark ?? colors.foreground },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
  });
}
