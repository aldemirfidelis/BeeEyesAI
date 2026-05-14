import { classifyIntent, extractCity, type SearchIntent, type SearchRequest } from "./searchIntentService";

// ── Result Type ───────────────────────────────────────────────────────────────

export interface ResearchResult {
  id: string;
  type: "news" | "weather" | "local_place" | "product" | "finance" | "general";
  title: string;
  description: string;
  source: string;
  url?: string;
  imageUrl?: string;
  /** weather: current temperature in Celsius */
  temperature?: number;
  /** weather: min/max, feels like */
  temperatureMin?: number;
  temperatureMax?: number;
  feelsLike?: number;
  weatherIcon?: string;
  precipitationChance?: number;
  /** local: star rating 0-5 */
  rating?: number;
  /** local: formatted distance */
  distance?: string;
  /** local: is currently open */
  isOpen?: boolean;
  /** product/finance: price string */
  price?: string;
  publishedAt?: string;
  category?: string;
  address?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(prefix: string, index: number) {
  return `${prefix}-${Date.now()}-${index}`;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Weather (wttr.in — free, no key needed) ───────────────────────────────────

async function fetchWeather(query: string, userCity?: string): Promise<ResearchResult[]> {
  const city = extractCity(query) ?? userCity ?? "Brasil";
  const encoded = encodeURIComponent(city);
  try {
    const res = await fetchWithTimeout(
      `https://wttr.in/${encoded}?format=j1`,
      { headers: { "Accept": "application/json", "User-Agent": "BeeEyesAI/1.0" } },
      6000,
    );
    if (!res.ok) return [];
    const data = await res.json() as WttrResponse;
    const current = data.current_condition?.[0];
    const weather0 = data.weather?.[0];
    if (!current || !weather0) return [];

    const desc = current.lang_pt?.[0]?.value ?? current.weatherDesc?.[0]?.value ?? "";
    const precipChance = Number(weather0.hourly?.[4]?.chanceofrain ?? 0);
    const icon = mapWttrCode(Number(current.weatherCode ?? "800"));

    return [{
      id: uid("weather", 0),
      type: "weather",
      title: `${city}`,
      description: desc,
      source: "wttr.in",
      temperature: Number(current.temp_C),
      temperatureMin: Math.min(...(weather0.hourly ?? []).map((h) => Number(h.tempC))),
      temperatureMax: Math.max(...(weather0.hourly ?? []).map((h) => Number(h.tempC))),
      feelsLike: Number(current.FeelsLikeC),
      weatherIcon: icon,
      precipitationChance: precipChance,
      category: "weather",
    }];
  } catch {
    return [];
  }
}

interface WttrResponse {
  current_condition?: Array<{
    temp_C?: string;
    FeelsLikeC?: string;
    weatherCode?: string;
    weatherDesc?: Array<{ value: string }>;
    lang_pt?: Array<{ value: string }>;
  }>;
  weather?: Array<{
    hourly?: Array<{ tempC?: string; chanceofrain?: string }>;
  }>;
}

function mapWttrCode(code: number): string {
  if (code === 113) return "sunny";
  if (code === 116) return "partly_cloudy";
  if ([119, 122].includes(code)) return "cloudy";
  if ([176, 179, 182, 185, 200, 227, 230, 248, 260, 263, 266, 281, 284, 293, 296, 299, 302, 305, 308, 311, 314, 317, 320, 323, 326, 329, 332, 335, 338, 350, 353, 356, 359, 362, 365, 368, 371, 374, 377, 386, 389, 392, 395].includes(code)) return "rainy";
  return "cloudy";
}

// ── Google News RSS (free, no key needed) ─────────────────────────────────────

async function fetchGoogleNews(query: string, limit = 5): Promise<ResearchResult[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-BR`;
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 7000);
    if (!res.ok) return [];
    const xml = await res.text();
    const items: ResearchResult[] = [];
    const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    let i = 0;
    for (const match of matches) {
      if (i >= limit) break;
      const block = match[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? block.match(/<title>(.*?)<\/title>/)?.[1] ?? "").trim();
      const link = (block.match(/<link>(.*?)<\/link>/)?.[1] ?? "").trim();
      const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "Google News").trim();
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "").trim();
      const desc = (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 180);
      if (title && link) {
        items.push({
          id: uid("news", i),
          type: "news",
          title,
          description: desc || title,
          source,
          url: link,
          publishedAt: pubDate,
          category: "news",
        });
        i++;
      }
    }
    return items;
  } catch {
    return [];
  }
}

// ── Tavily Search (AI-first, best quality — needs TAVILY_API_KEY) ─────────────

async function fetchTavily(query: string, limit = 5, searchDepth: "basic" | "advanced" = "basic"): Promise<ResearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ query, max_results: limit, search_depth: searchDepth, include_answer: false, include_images: false }),
    }, 8000);
    if (!res.ok) return [];
    const data = await res.json() as TavilyResponse;
    return (data.results ?? []).slice(0, limit).map((item, i) => ({
      id: uid("tavily", i),
      type: "general" as const,
      title: item.title,
      description: item.content?.slice(0, 200) ?? item.title,
      source: item.url ? new URL(item.url).hostname.replace("www.", "") : "Web",
      url: item.url,
      publishedAt: item.published_date,
      category: "general",
    }));
  } catch {
    return [];
  }
}

interface TavilyResponse {
  results?: Array<{ title: string; url: string; content?: string; published_date?: string }>;
}

// ── Brave Search (needs BRAVE_SEARCH_API_KEY) ─────────────────────────────────

async function fetchBrave(query: string, type: "web" | "news" = "web", limit = 5): Promise<ResearchResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({ q: query, count: String(limit), country: "BR" });
    if (type === "news") params.set("result_filter", "news");
    const res = await fetchWithTimeout(`https://api.search.brave.com/res/v1/${type === "news" ? "news" : "web"}/search?${params}`, {
      headers: { "Accept": "application/json", "X-Subscription-Token": key },
    }, 7000);
    if (!res.ok) return [];
    const data = await res.json() as BraveResponse;
    const raw = type === "news" ? (data.news?.results ?? []) : (data.web?.results ?? []);
    return raw.slice(0, limit).map((item, i) => ({
      id: uid("brave", i),
      type: type === "news" ? "news" as const : "general" as const,
      title: item.title,
      description: item.description?.slice(0, 200) ?? item.title,
      source: item.url ? new URL(item.url).hostname.replace("www.", "") : "Web",
      url: item.url,
      publishedAt: item.age,
      category: type,
    }));
  } catch {
    return [];
  }
}

interface BraveResponse {
  web?: { results?: Array<{ title: string; url: string; description?: string; age?: string }> };
  news?: { results?: Array<{ title: string; url: string; description?: string; age?: string }> };
}

// ── Main Orchestrator ─────────────────────────────────────────────────────────

export async function runResearch(
  message: string,
  userCity?: string | null,
  userLocation?: { latitude: number; longitude: number } | null,
): Promise<{ request: SearchRequest; results: ResearchResult[] }> {
  const request = classifyIntent(message);

  if (request.intent === "none") {
    return { request, results: [] };
  }

  const locationCity = userLocation ? undefined : (userCity ?? undefined);
  let results: ResearchResult[] = [];

  try {
    switch (request.intent) {
      case "weather_search":
        results = await fetchWeather(message, locationCity);
        if (results.length === 0) {
          results = await fetchGoogleNews(`previsão do tempo ${extractCity(message) ?? locationCity ?? "Brasil"}`, 3);
        }
        break;

      case "finance_search":
        results = await Promise.any([
          fetchBrave(request.query, "news", 5),
          fetchGoogleNews(request.query, 5),
        ]).catch(() => fetchGoogleNews(request.query, 5));
        break;

      case "news_search":
        results = await Promise.any([
          fetchBrave(request.query, "news", 5),
          fetchGoogleNews(request.query, 5),
        ]).catch(() => fetchGoogleNews(request.query, 5));
        break;

      case "sports_search":
        results = await Promise.any([
          fetchBrave(request.query, "news", 5),
          fetchGoogleNews(request.query, 5),
        ]).catch(() => fetchGoogleNews(request.query, 5));
        break;

      case "local_search": {
        const city = extractCity(message) ?? locationCity;
        const localQuery = city ? `${request.query} ${city}` : request.query;
        results = await Promise.any([
          fetchTavily(localQuery, 5, "basic"),
          fetchBrave(localQuery, "web", 5),
          fetchGoogleNews(localQuery, 4),
        ]).catch(() => fetchGoogleNews(localQuery, 4));
        break;
      }

      case "product_search":
        results = await Promise.any([
          fetchTavily(request.query, 5, "basic"),
          fetchBrave(request.query, "web", 5),
          fetchGoogleNews(request.query, 4),
        ]).catch(() => fetchGoogleNews(request.query, 4));
        break;

      case "event_search": {
        const city = extractCity(message) ?? locationCity;
        const eventQuery = city ? `${request.query} ${city}` : request.query;
        results = await Promise.any([
          fetchBrave(eventQuery, "web", 5),
          fetchGoogleNews(eventQuery, 4),
        ]).catch(() => fetchGoogleNews(eventQuery, 4));
        break;
      }

      case "comparison_search":
        results = await Promise.any([
          fetchTavily(request.query, 5, "advanced"),
          fetchBrave(request.query, "web", 5),
          fetchGoogleNews(request.query, 4),
        ]).catch(() => fetchGoogleNews(request.query, 4));
        break;

      case "general_web_search":
        results = await Promise.any([
          fetchTavily(request.query, 5, "basic"),
          fetchBrave(request.query, "web", 5),
          fetchGoogleNews(request.query, 4),
        ]).catch(() => fetchGoogleNews(request.query, 4));
        break;

      default:
        results = await fetchGoogleNews(request.query, 5);
    }
  } catch {
    results = [];
  }

  return { request, results: results.slice(0, 6) };
}

// ── Context Formatter (injected into AI prompt) ───────────────────────────────

export function formatResultsForContext(intent: SearchIntent, results: ResearchResult[]): string {
  if (results.length === 0) return "";

  const header = INTENT_LABELS[intent] ?? "Resultados da pesquisa";
  const lines = results.map((r, i) => {
    if (r.type === "weather") {
      return `${i + 1}. ${r.title}: ${r.temperature}°C (mín ${r.temperatureMin}°C / máx ${r.temperatureMax}°C), sensação ${r.feelsLike}°C. ${r.description}. Chance de chuva: ${r.precipitationChance}%.`;
    }
    return `${i + 1}. "${r.title}" — ${r.source}${r.publishedAt ? ` (${r.publishedAt})` : ""}. ${r.description}${r.url ? ` [${r.url}]` : ""}`;
  });

  return `\n## ${header} (dados reais e atualizados):\n${lines.join("\n")}\n\nResponda baseando-se nesses dados reais acima. Mencione as fontes. Seja concisa e útil.`;
}

const INTENT_LABELS: Partial<Record<SearchIntent, string>> = {
  weather_search: "Previsão do tempo atual",
  finance_search: "Mercado financeiro — notícias recentes",
  news_search: "Notícias recentes",
  local_search: "Lugares encontrados",
  sports_search: "Resultados esportivos",
  event_search: "Eventos e programação",
  product_search: "Análises de produtos",
  comparison_search: "Comparativos encontrados",
  general_web_search: "Informações da web",
};
