import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { getThemeColors } from "@mobile/lib/theme";

export interface ResearchResult {
  id: string;
  type: "news" | "weather" | "local_place" | "product" | "finance" | "general";
  title: string;
  description: string;
  source: string;
  url?: string;
  temperature?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  feelsLike?: number;
  precipitationChance?: number;
  weatherIcon?: string;
  rating?: number;
  distance?: string;
  isOpen?: boolean;
  price?: string;
  publishedAt?: string;
  category?: string;
  address?: string;
}

interface Props {
  result: ResearchResult;
  colors: ReturnType<typeof getThemeColors>;
  onSaveToWishlist?: (result: ResearchResult) => void;
}

export function ResearchResultCard({ result, colors, onSaveToWishlist }: Props) {
  if (result.type === "weather") {
    return <WeatherCard result={result} colors={colors} />;
  }
  return <GenericCard result={result} colors={colors} onSave={onSaveToWishlist} />;
}

// ── Weather Card ──────────────────────────────────────────────────────────────

function WeatherCard({ result, colors }: { result: ResearchResult; colors: ReturnType<typeof getThemeColors> }) {
  const hasRain = (result.precipitationChance ?? 0) >= 30;
  const icon = WEATHER_ICONS[result.weatherIcon ?? "cloudy"] ?? "⛅";
  const s = StyleSheet.create({
    card: { backgroundColor: "#0ea5e910", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#0ea5e940", marginBottom: 6 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    city: { color: colors.textSecondary, fontSize: 11, marginBottom: 4 },
    tempRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
    temp: { color: "#0369a1", fontSize: 36, fontWeight: "900", lineHeight: 40 },
    emoji: { fontSize: 28, lineHeight: 36 },
    desc: { color: colors.text, fontSize: 13, marginTop: 4, textTransform: "capitalize" },
    rightCol: { alignItems: "flex-end", gap: 4 },
    metaText: { color: colors.textSecondary, fontSize: 11 },
    rainBadge: { backgroundColor: "#dbeafe", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8 },
    rainText: { color: "#1d4ed8", fontSize: 11, fontWeight: "600" },
    sourceText: { color: colors.textSecondary, fontSize: 10, marginTop: 6, opacity: 0.6 },
  });

  return (
    <View style={s.card}>
      <View style={s.row}>
        <View>
          <Text style={s.city}>📍 {result.title}</Text>
          <View style={s.tempRow}>
            <Text style={s.temp}>{result.temperature}°C</Text>
            <Text style={s.emoji}>{icon}</Text>
          </View>
          <Text style={s.desc}>{result.description}</Text>
        </View>
        <View style={s.rightCol}>
          {result.temperatureMin != null && result.temperatureMax != null && (
            <Text style={s.metaText}>🌡️ {result.temperatureMin}° / {result.temperatureMax}°</Text>
          )}
          {result.feelsLike != null && (
            <Text style={s.metaText}>💨 Sensação {result.feelsLike}°C</Text>
          )}
          {result.precipitationChance != null && (
            <Text style={[s.metaText, hasRain && { color: "#1d4ed8", fontWeight: "600" }]}>
              ☔ {result.precipitationChance}%
            </Text>
          )}
        </View>
      </View>
      {hasRain && (
        <View style={s.rainBadge}>
          <Text style={s.rainText}>Leve guarda-chuva — boa chance de chuva hoje.</Text>
        </View>
      )}
      <Text style={s.sourceText}>Fonte: {result.source}</Text>
    </View>
  );
}

const WEATHER_ICONS: Record<string, string> = {
  sunny: "☀️",
  partly_cloudy: "⛅",
  cloudy: "☁️",
  rainy: "🌧️",
};

// ── Generic Card ──────────────────────────────────────────────────────────────

function GenericCard({ result, colors, onSave }: { result: ResearchResult; colors: ReturnType<typeof getThemeColors>; onSave?: (r: ResearchResult) => void }) {
  const typeIcon = TYPE_ICONS[result.type] ?? "🔍";
  const s = StyleSheet.create({
    card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 6, overflow: "hidden" },
    body: { padding: 12 },
    sourceRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
    sourceText: { color: colors.textSecondary, fontSize: 11, fontWeight: "500" },
    dot: { color: colors.textSecondary, opacity: 0.4, fontSize: 11 },
    dateText: { color: colors.textSecondary, fontSize: 11, opacity: 0.7 },
    title: { color: colors.text, fontSize: 13, fontWeight: "700", lineHeight: 18 },
    desc: { color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
    tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
    ratingBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fef3c7", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    ratingText: { color: "#92400e", fontSize: 11, fontWeight: "700" },
    distBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.inputBg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    distText: { color: colors.textSecondary, fontSize: 11 },
    openBadge: (open: boolean): object => ({ backgroundColor: open ? "#d1fae5" : "#fee2e2", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }),
    openText: (open: boolean): object => ({ color: open ? "#065f46" : "#991b1b", fontSize: 11, fontWeight: "600" }),
    price: { color: colors.primary, fontSize: 12, fontWeight: "700", marginTop: 4 },
    actions: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border },
    actionBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 10 },
    actionText: { color: colors.primary, fontSize: 12, fontWeight: "600" },
    actionTextSecondary: { color: colors.textSecondary, fontSize: 12, fontWeight: "500" },
    divider: { width: 1, backgroundColor: colors.border },
  });

  return (
    <View style={s.card}>
      <View style={s.body}>
        <View style={s.sourceRow}>
          <Text>{typeIcon}</Text>
          <Text style={s.sourceText}>{result.source}</Text>
          {result.publishedAt && (
            <>
              <Text style={s.dot}>·</Text>
              <Text style={s.dateText}>{formatDate(result.publishedAt)}</Text>
            </>
          )}
        </View>
        <Text style={s.title} numberOfLines={2}>{result.title}</Text>
        {result.description && result.description !== result.title && (
          <Text style={s.desc} numberOfLines={2}>{result.description}</Text>
        )}
        {result.type === "local_place" && (
          <View style={s.tagsRow}>
            {result.rating != null && (
              <View style={s.ratingBadge}>
                <Feather name="star" size={10} color="#92400e" />
                <Text style={s.ratingText}>{result.rating.toFixed(1)}</Text>
              </View>
            )}
            {result.distance && (
              <View style={s.distBadge}>
                <Feather name="map-pin" size={10} color={colors.textSecondary} />
                <Text style={s.distText}>{result.distance}</Text>
              </View>
            )}
            {result.isOpen != null && (
              <View style={s.openBadge(result.isOpen) as any}>
                <Text style={s.openText(result.isOpen) as any}>{result.isOpen ? "Aberto" : "Fechado"}</Text>
              </View>
            )}
          </View>
        )}
        {result.price && <Text style={s.price}>{result.price}</Text>}
      </View>
      <View style={s.actions}>
        {result.url && (
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => result.url && Linking.openURL(result.url).catch(() => {})}
          >
            <Feather name="external-link" size={13} color={colors.primary} />
            <Text style={s.actionText}>Ver fonte</Text>
          </TouchableOpacity>
        )}
        {onSave && (
          <>
            {result.url && <View style={s.divider} />}
            <TouchableOpacity style={s.actionBtn} onPress={() => onSave(result)}>
              <Feather name="heart" size={13} color={colors.textSecondary} />
              <Text style={s.actionTextSecondary}>Salvar</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const TYPE_ICONS: Record<string, string> = {
  news: "📰",
  weather: "🌤️",
  local_place: "📍",
  product: "🛍️",
  finance: "📈",
  general: "🔍",
};

function formatDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw.slice(0, 20);
    const diffH = Math.floor((Date.now() - d.getTime()) / 3600000);
    if (diffH < 1) return "agora";
    if (diffH < 24) return `${diffH}h atrás`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d atrás`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return raw.slice(0, 20);
  }
}

// ── Research Loading State ────────────────────────────────────────────────────

interface LoadingProps {
  intent: string;
  colors: ReturnType<typeof getThemeColors>;
}

export function ResearchLoadingCard({ intent, colors }: LoadingProps) {
  const label = INTENT_LABELS[intent] ?? "Pesquisando na web...";
  const s = StyleSheet.create({
    card: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: `${colors.primary}18`, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: `${colors.primary}30`, marginBottom: 6 },
    label: { color: colors.primary, fontSize: 13, fontWeight: "600", flex: 1 },
    dots: { flexDirection: "row", gap: 4 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  });
  return (
    <View style={s.card}>
      <Text>🐝</Text>
      <Text style={s.label}>{label}</Text>
      <View style={s.dots}>
        <View style={s.dot} />
        <View style={s.dot} />
        <View style={s.dot} />
      </View>
    </View>
  );
}

const INTENT_LABELS: Record<string, string> = {
  weather_search: "Consultando a previsão do tempo...",
  finance_search: "Buscando notícias do mercado...",
  local_search: "Procurando lugares próximos...",
  news_search: "Pesquisando as últimas notícias...",
  sports_search: "Buscando resultados esportivos...",
  event_search: "Procurando eventos na programação...",
  product_search: "Pesquisando análises e preços...",
  comparison_search: "Fazendo o comparativo...",
  general_web_search: "Pesquisando na web...",
};
