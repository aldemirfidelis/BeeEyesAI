import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@mobile/lib/api";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";

interface NewsResponse {
  items: Array<{ title: string; link: string; source: string }>;
  query: string;
}

export default function NewsScreen() {
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [summaryByUrl, setSummaryByUrl] = useState<Record<string, string>>({});

  const newsQuery = useQuery<NewsResponse>({
    queryKey: ["news"],
    queryFn: () => api.get("/api/news").then((r) => r.data),
  });

  const summarize = useMutation({
    mutationFn: ({ url, title }: { url: string; title: string }) =>
      api.post("/api/news/summarize", { url, title }).then((r) => r.data),
    onSuccess: (data, variables) => {
      setSelectedUrl(variables.url);
      setSummaryByUrl((prev) => ({ ...prev, [variables.url]: data.summary }));
    },
    onError: (error: any) => {
      Alert.alert("Erro", error?.response?.data?.message || "Nao foi possivel resumir o artigo.");
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Noticias</Text>
        <Text style={styles.subtitle}>
          {newsQuery.data?.query ? `Selecionadas para: ${newsQuery.data.query}` : "Resumo da sua rede e interesses"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {newsQuery.isLoading ? <ActivityIndicator color={colors.primaryDark} style={{ marginTop: 40 }} /> : null}

        {!newsQuery.isLoading && !newsQuery.data?.items?.length ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma noticia agora</Text>
            <Text style={styles.emptyText}>Quando houver itens relevantes, eles aparecem aqui com opcao de resumo.</Text>
          </View>
        ) : null}

        {newsQuery.data?.items?.map((item, index) => {
          const selected = selectedUrl === item.link;
          const summary = summaryByUrl[item.link];
          return (
            <View key={item.link} style={styles.card}>
              <Text style={styles.indexBadge}>{index + 1}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSource}>{item.source}</Text>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => Linking.openURL(item.link)}>
                  <Text style={styles.secondaryButtonText}>Abrir artigo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => summarize.mutate({ url: item.link, title: item.title })}
                  disabled={summarize.isPending && selected}
                >
                  <Text style={styles.primaryButtonText}>
                    {summarize.isPending && selected ? "Resumindo..." : "Gerar resumo"}
                  </Text>
                </TouchableOpacity>
              </View>

              {summary ? (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>BeeEyes resumiu</Text>
                  <Text style={styles.summaryText}>{summary}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { fontFamily: FONTS.display, fontSize: 24, fontWeight: "700", color: colors.foreground },
    subtitle: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted, marginTop: 4 },
    content: { padding: 16, gap: 12, paddingBottom: 32 },
    emptyCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 18,
      gap: 8,
    },
    emptyTitle: { fontFamily: FONTS.display, fontSize: 20, fontWeight: "700", color: colors.foreground },
    emptyText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 16,
      gap: 10,
    },
    indexBadge: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary + "33",
      color: colors.primaryDark,
      fontFamily: FONTS.mono,
      fontWeight: "700",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: "hidden",
    },
    cardTitle: { fontFamily: FONTS.sans, fontSize: 16, lineHeight: 23, fontWeight: "700", color: colors.foreground },
    cardSource: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    actions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    primaryButtonText: { fontFamily: FONTS.sans, fontWeight: "700", color: "#1A1A1A" },
    secondaryButton: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    secondaryButtonText: { fontFamily: FONTS.sans, fontWeight: "700", color: colors.foreground },
    summaryBox: {
      backgroundColor: colors.secondary,
      borderRadius: 14,
      padding: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      gap: 4,
    },
    summaryLabel: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.primaryDark },
    summaryText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 20, color: colors.foreground },
  });
}

