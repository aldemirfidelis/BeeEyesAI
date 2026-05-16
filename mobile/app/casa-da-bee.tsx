import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";
import { getBeeHouseBootstrap, openBeeHouseUnity } from "@mobile/services/beeHouseService";

export default function CasaDaBeeScreen() {
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [nativeUnavailable, setNativeUnavailable] = useState(false);
  const [opening, setOpening] = useState(false);

  const query = useQuery({
    queryKey: ["bee-house-bootstrap"],
    queryFn: getBeeHouseBootstrap,
    staleTime: 20000,
  });

  const openUnity = useCallback(async () => {
    if (!query.data || opening) return;
    setOpening(true);
    try {
      const opened = await openBeeHouseUnity(query.data);
      setNativeUnavailable(!opened);
      if (!opened) {
        Alert.alert("Casa da Bee", "O modulo Unity ainda precisa ser vinculado no build nativo.");
      }
    } catch {
      setNativeUnavailable(true);
      Alert.alert("Casa da Bee", "Nao consegui abrir o modulo Unity agora.");
    } finally {
      setOpening(false);
    }
  }, [opening, query.data]);

  useEffect(() => {
    if (query.data) {
      openUnity();
    }
  }, [query.data]);

  const profile = query.data?.profile as { pollen?: number; level?: number; currentState?: string } | undefined;
  const activeTask = query.data?.activeTask;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.75}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Casa da Bee</Text>
          <Text style={styles.subtitle}>Modulo Unity</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => query.refetch()} activeOpacity={0.75}>
          <Feather name="refresh-cw" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      ) : query.isError ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={34} color={colors.destructive} />
          <Text style={styles.emptyText}>Nao consegui carregar a Casa da Bee.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => query.refetch()} activeOpacity={0.82}>
            <Feather name="refresh-cw" size={16} color="#1A1A1A" />
            <Text style={styles.primaryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statusPanel}>
            <View style={styles.beeMark}>
              <Text style={styles.beeMarkText}>B</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>{nativeUnavailable ? "Build nativo pendente" : "Abrindo mundo Unity"}</Text>
              <Text style={styles.panelSubtitle}>
                {activeTask?.speechText ?? "Prontinha para entrar em casa."}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <Metric icon="zap" label="Nivel" value={String(profile?.level ?? 1)} colors={colors} />
            <Metric icon="hexagon" label="Polen" value={String(profile?.pollen ?? 0)} colors={colors} />
            <Metric icon="activity" label="Estado" value={profile?.currentState ?? "idle"} colors={colors} />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={openUnity} activeOpacity={0.82} disabled={opening || !query.data}>
            {opening ? <ActivityIndicator size="small" color="#1A1A1A" /> : <Feather name="play" size={16} color="#1A1A1A" />}
            <Text style={styles.primaryButtonText}>Abrir Casa da Bee</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Metric({
  icon,
  label,
  value,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 10, padding: 12, gap: 8 }}>
      <Feather name={icon} size={15} color={colors.primaryDark} />
      <Text style={{ color: colors.muted, fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700" }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.foreground, fontFamily: FONTS.sans, fontSize: 14, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.secondary,
    },
    title: { color: colors.foreground, fontFamily: FONTS.display, fontSize: 22, fontWeight: "900" },
    subtitle: { color: colors.muted, fontFamily: FONTS.sans, fontSize: 12, marginTop: 2 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
    emptyText: { color: colors.muted, fontFamily: FONTS.sans, fontSize: 14, textAlign: "center" },
    content: { padding: 18, gap: 16, paddingBottom: 34 },
    statusPanel: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderWidth: 1,
      borderColor: colors.primary + "44",
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
    },
    beeMark: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    beeMarkText: { color: "#1A1A1A", fontFamily: FONTS.display, fontSize: 24, fontWeight: "900" },
    panelTitle: { color: colors.foreground, fontFamily: FONTS.sans, fontSize: 15, fontWeight: "900" },
    panelSubtitle: { color: colors.muted, fontFamily: FONTS.sans, fontSize: 12, marginTop: 3 },
    metricsRow: { flexDirection: "row", gap: 10 },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
    },
    primaryButtonText: { color: "#1A1A1A", fontFamily: FONTS.sans, fontSize: 14, fontWeight: "900" },
  });
}
