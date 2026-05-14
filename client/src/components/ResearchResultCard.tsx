import { ExternalLink, Heart, MapPin, Star, Thermometer, Umbrella, Wind } from "lucide-react";
import { motion } from "framer-motion";
import type { ResearchResult } from "@/features/home/types";

interface ResearchResultCardProps {
  result: ResearchResult;
  authHeaders: () => Record<string, string>;
  onSaveToWishlist?: (result: ResearchResult) => void;
}

export function ResearchResultCard({ result, onSaveToWishlist }: ResearchResultCardProps) {
  if (result.type === "weather") {
    return <WeatherResultCard result={result} />;
  }
  return <GenericResultCard result={result} onSave={onSaveToWishlist} />;
}

// ── Weather Card ──────────────────────────────────────────────────────────────

function WeatherResultCard({ result }: { result: ResearchResult }) {
  const icon = WEATHER_ICON_MAP[result.weatherIcon ?? "cloudy"] ?? "🌤️";
  const hasRain = (result.precipitationChance ?? 0) >= 30;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/50 dark:to-blue-950/40 dark:border-sky-800/50 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <MapPin className="h-3 w-3" />
            {result.title}
          </div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-sky-700 dark:text-sky-300 leading-none">
              {result.temperature}°C
            </span>
            <span className="text-2xl leading-none">{icon}</span>
          </div>
          <p className="mt-1 text-sm text-foreground/80 capitalize">{result.description}</p>
        </div>
        <div className="text-right space-y-1">
          {result.temperatureMin != null && result.temperatureMax != null && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
              <Thermometer className="h-3 w-3" />
              <span>{result.temperatureMin}° / {result.temperatureMax}°</span>
            </div>
          )}
          {result.feelsLike != null && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
              <Wind className="h-3 w-3" />
              <span>Sensação {result.feelsLike}°C</span>
            </div>
          )}
          {result.precipitationChance != null && (
            <div className={`flex items-center gap-1 text-xs justify-end ${hasRain ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-muted-foreground"}`}>
              <Umbrella className="h-3 w-3" />
              <span>{result.precipitationChance}% chuva</span>
            </div>
          )}
        </div>
      </div>
      {hasRain && (
        <p className="mt-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-lg px-2.5 py-1.5">
          Leve guarda-chuva — há boa chance de chuva hoje.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground/60">Fonte: {result.source}</p>
    </motion.div>
  );
}

const WEATHER_ICON_MAP: Record<string, string> = {
  sunny: "☀️",
  partly_cloudy: "⛅",
  cloudy: "☁️",
  rainy: "🌧️",
};

// ── Generic Result Card ───────────────────────────────────────────────────────

function GenericResultCard({ result, onSave }: { result: ResearchResult; onSave?: (r: ResearchResult) => void }) {
  const typeIcon = RESULT_TYPE_ICONS[result.type] ?? "🔍";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card/70 overflow-hidden"
    >
      <div className="px-4 pt-3 pb-2">
        {/* Source badge */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs">{typeIcon}</span>
          <span className="text-xs font-medium text-muted-foreground">{result.source}</span>
          {result.publishedAt && (
            <>
              <span className="text-xs text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground/70">{formatDate(result.publishedAt)}</span>
            </>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{result.title}</p>

        {/* Description */}
        {result.description && result.description !== result.title && (
          <p className="mt-1 text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">{result.description}</p>
        )}

        {/* Local place details */}
        {result.type === "local_place" && (
          <div className="flex flex-wrap gap-2 mt-2">
            {result.rating != null && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full px-2 py-0.5 font-medium">
                <Star className="h-3 w-3 fill-current" />
                {result.rating.toFixed(1)}
              </span>
            )}
            {result.distance && (
              <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">
                <MapPin className="h-3 w-3" />
                {result.distance}
              </span>
            )}
            {result.isOpen != null && (
              <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${result.isOpen ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"}`}>
                {result.isOpen ? "Aberto" : "Fechado"}
              </span>
            )}
          </div>
        )}

        {/* Price */}
        {result.price && (
          <p className="mt-1 text-xs font-semibold text-primary">{result.price}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center border-t border-border/40 divide-x divide-border/40">
        {result.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver fonte
          </a>
        )}
        {onSave && (
          <button
            onClick={() => onSave(result)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
            title="Salvar na Lista de Desejos"
          >
            <Heart className="h-3.5 w-3.5" />
            Salvar
          </button>
        )}
      </div>
    </motion.div>
  );
}

const RESULT_TYPE_ICONS: Record<string, string> = {
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
    if (isNaN(d.getTime())) return raw.slice(0, 30);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "agora";
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d atrás`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return raw.slice(0, 20);
  }
}

// ── Research Loading State ────────────────────────────────────────────────────

export function ResearchLoadingState({ intent }: { intent: string }) {
  const label = INTENT_LOADING_LABELS[intent] ?? "Pesquisando na web...";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
    >
      <span className="animate-pulse">🐝</span>
      <span className="font-medium">{label}</span>
      <div className="ml-auto flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
      </div>
    </motion.div>
  );
}

const INTENT_LOADING_LABELS: Record<string, string> = {
  weather_search: "Consultando a previsão do tempo...",
  finance_search: "Buscando notícias do mercado financeiro...",
  local_search: "Procurando lugares próximos...",
  news_search: "Pesquisando as últimas notícias...",
  sports_search: "Buscando resultados esportivos...",
  event_search: "Procurando eventos na programação...",
  product_search: "Pesquisando análises e preços...",
  comparison_search: "Fazendo o comparativo...",
  general_web_search: "Pesquisando na web...",
};

// ── Research Source Badge ─────────────────────────────────────────────────────

export function ResearchSourceBadge({ count, intent }: { count: number; intent: string }) {
  const label = INTENT_SOURCE_LABELS[intent] ?? "web";
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>🐝</span>
      <span>
        {count} resultado{count !== 1 ? "s" : ""} encontrado{count !== 1 ? "s" : ""} na {label}
      </span>
    </div>
  );
}

const INTENT_SOURCE_LABELS: Record<string, string> = {
  weather_search: "web (tempo real)",
  finance_search: "web (mercado)",
  local_search: "web (lugares)",
  news_search: "web (notícias)",
  sports_search: "web (esportes)",
  general_web_search: "web",
};
