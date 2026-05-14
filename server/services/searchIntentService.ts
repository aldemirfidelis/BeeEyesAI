export type SearchIntent =
  | "weather_search"
  | "local_search"
  | "news_search"
  | "finance_search"
  | "product_search"
  | "sports_search"
  | "event_search"
  | "comparison_search"
  | "general_web_search"
  | "none";

export interface SearchRequest {
  intent: SearchIntent;
  query: string;
  location?: { city?: string; latitude?: number; longitude?: number };
}

const PATTERNS: Record<Exclude<SearchIntent, "none">, RegExp> = {
  weather_search:
    /\b(clima|tempo|chuva|chover|temperatura|previs[aã]o do tempo|frio|calor|sol|nublado|garoa|vai chover|tempo hoje|clima hoje|previs[aã]o)\b/i,
  finance_search:
    /\b(bolsa|ibovespa|a[cç][aã]o|a[cç][oõ]es|d[oó]lar|bitcoin|cripto|mercado financeiro|investimento|nasdaq|sp500|cota[cç][aã]o|petrobras|vale3|magazine|magalu|itau|bradesco|banco central|selic|inflação|igpm|ipca)\b/i,
  local_search:
    /\b(restaurante|lanchonete|academia|hotel|farm[aá]cia|hospital|cl[ií]nica|mercado|supermercado|posto de gasolina|oficina|loja|sal[aã]o|barbearia|padaria|açougue|aberto agora|perto de mim|próximo|proximo|perto|next to|near|no bairro)\b/i,
  news_search:
    /\b(not[ií]cia|not[ií]cias|jornal|manchete|acontec|hoje no brasil|hoje no mundo|[ú]ltima hora|ultima hora|o que aconteceu|novidades|atualidade)\b/i,
  sports_search:
    /\b(jogo|futebol|basquete|t[eê]nis|esporte|campeonato|placar|resultado|gol|torneio|copa|olimp[ií]ada|brasileirão|libertadores|champions)\b/i,
  event_search:
    /\b(evento|show|concerto|cinema|filme em cartaz|festival|programa[cç][aã]o|o que fazer em|o que rolar|agenda|teatro|exposi[cç][aã]o|feira)\b/i,
  comparison_search:
    /\b(comparar|compara[cç][aã]o|qual melhor|qual [eé] melhor|diferen[cç]a|versus|vs\.|vantagem|melhor op[cç][aã]o entre|comparativo)\b/i,
  product_search:
    /\b(melhor celular|melhor notebook|melhor tv|melhor produto|vale a pena|qual comprar|melhor custo.benef[ií]cio|barato|desconto|oferta|promo[cç][aã]o|mais barato|qual [eé] melhor.*comprar)\b/i,
  general_web_search:
    /\b(o que [eé]|quem [eé]|quando foi|onde fica|como funciona|qual.*hoje|atualmente|recente|novo|lan[cç]amento|2024|2025|como est[aá])\b/i,
};

/** Priority order: more specific intents first */
const PRIORITY: Exclude<SearchIntent, "none">[] = [
  "weather_search",
  "finance_search",
  "local_search",
  "sports_search",
  "news_search",
  "event_search",
  "comparison_search",
  "product_search",
  "general_web_search",
];

export function classifyIntent(message: string): SearchRequest {
  for (const intent of PRIORITY) {
    if (PATTERNS[intent].test(message)) {
      return { intent, query: buildQuery(intent, message) };
    }
  }
  return { intent: "none", query: message };
}

function buildQuery(intent: SearchIntent, message: string): string {
  const clean = message.trim().replace(/[?!.]+$/, "").trim();

  switch (intent) {
    case "weather_search":
      return extractCity(message) ? `clima ${extractCity(message)} hoje` : `previsão do tempo hoje`;
    case "finance_search":
      return `${clean} mercado financeiro`;
    case "local_search":
      return clean;
    case "news_search":
      return `${clean} notícias recentes`;
    case "sports_search":
      return `${clean} resultado hoje`;
    case "event_search":
      return `${clean} programação agenda`;
    case "comparison_search":
      return `${clean} comparativo 2025`;
    case "product_search":
      return `${clean} análise avaliação 2025`;
    case "general_web_search":
      return clean;
    default:
      return clean;
  }
}

export function extractCity(message: string): string | null {
  // Pattern: "em <City>" or "perto de <City>" or "em <City>, <State>"
  const match = message.match(/\bem\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]+)*)/i);
  return match ? match[1].trim() : null;
}
