import type {
  BeeConversationContext,
  Message,
  MoodEntry,
  User,
  UserMemory,
  UserPersonality,
  UserPreference,
} from "../../shared/schema";

export type BeeEmotionalTone =
  | "neutral"
  | "cansado"
  | "animado"
  | "confuso"
  | "frustrado"
  | "tecnico"
  | "sensivel";

export interface BeeContextInput {
  user: User;
  personality: UserPersonality;
  memories: UserMemory[];
  preferences: UserPreference[];
  conversationContext?: BeeConversationContext | null;
  feedbackSummary?: Array<{ category: string; likes: number; dislikes: number }>;
  moodEntries?: MoodEntry[];
  wishlistInterests?: Array<{ interestName: string; category: string; score: number }>;
  recentMessages?: Message[];
  userMessage: string;
}

const STOP_WORDS = new Set([
  "para", "como", "sobre", "isso", "essa", "esse", "aqui", "hoje", "amanha",
  "amanhã", "quero", "preciso", "pode", "voce", "você", "bee", "minha",
  "meu", "uma", "umas", "uns", "com", "sem", "por", "que", "de", "da", "do",
]);

export function inferEmotionalTone(text: string): BeeEmotionalTone {
  const normalized = text.toLowerCase();
  if (/\b(cansad[oa]|exaust[oa]|sem energia|esgotad[oa]|sono|pesado)\b/.test(normalized)) return "cansado";
  if (/\b(animad[oa]|feliz|empolgado|empolgada|consegui|boa|partiu|vamos)\b/.test(normalized)) return "animado";
  if (/\b(confus[oa]|nao entendi|não entendi|perdido|perdida|duvida|dúvida|passo a passo)\b/.test(normalized)) return "confuso";
  if (/\b(frustrad[oa]|irritad[oa]|chatead[oa]|raiva|deu errado|nao gostei|não gostei|pessimo|péssimo)\b/.test(normalized)) return "frustrado";
  if (/\b(codigo|código|api|banco|sql|deploy|erro|bug|implementar|tecnico|técnico)\b/.test(normalized)) return "tecnico";
  if (/\b(triste|ansios[oa]|medo|chorar|sozinh[oa]|desanimad[oa]|mal hoje)\b/.test(normalized)) return "sensivel";
  return "neutral";
}

export function extractContextTopics(messages: Array<Pick<Message, "content">>, userMessage: string): string[] {
  const text = [...messages.slice(-8).map((message) => message.content), userMessage].join(" ");
  const terms = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/\b[a-z0-9]{4,}\b/g) ?? [];

  const counts = new Map<string, number>();
  for (const term of terms) {
    if (STOP_WORDS.has(term)) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term]) => term);
}

function formatMood(entries: MoodEntry[] | undefined) {
  if (!entries?.length) return "";
  const recent = entries.slice(0, 7);
  const avg = recent.reduce((sum, entry) => sum + entry.mood, 0) / recent.length;
  const notes = recent.map((entry) => entry.note).filter(Boolean).slice(0, 2);
  return `Humor recente: media ${avg.toFixed(1)}/5${notes.length ? `; observacoes: ${notes.join(" | ")}` : ""}.`;
}

function formatFeedback(summary: BeeContextInput["feedbackSummary"]) {
  if (!summary?.length) return "";
  const liked = summary.filter((item) => item.likes > item.dislikes).slice(0, 3);
  const disliked = summary.filter((item) => item.dislikes > item.likes).slice(0, 3);
  const parts = [
    liked.length ? `Categorias bem recebidas: ${liked.map((item) => item.category).join(", ")}` : "",
    disliked.length ? `Categorias que pedem ajuste: ${disliked.map((item) => item.category).join(", ")}` : "",
  ].filter(Boolean);
  return parts.join(". ");
}

function formatPreferences(preferences: UserPreference[]) {
  if (!preferences.length) return "";
  return preferences
    .slice(0, 12)
    .map((preference) => `- ${preference.category}: ${preference.preference} (peso ${preference.weight}, fonte ${preference.source})`)
    .join("\n");
}

function formatWishlistInterests(interests: BeeContextInput["wishlistInterests"]) {
  if (!interests?.length) return "";
  return interests
    .slice(0, 8)
    .map((interest) => `${interest.interestName} (${interest.category}, score ${interest.score})`)
    .join(", ");
}

export function buildBeePersonalizationContext(input: BeeContextInput): string {
  const personalizationEnabled = input.conversationContext?.personalizationEnabled ?? true;
  const callName = input.user.displayName || input.user.username;
  const tone = inferEmotionalTone(input.userMessage);
  const memoryLines = personalizationEnabled
    ? input.memories.slice(0, 12).map((memory) => `- ${memory.title}: ${memory.content} (${memory.memoryType}, importancia ${memory.importance})`)
    : [];
  const preferenceBlock = personalizationEnabled ? formatPreferences(input.preferences) : "";
  const moodBlock = personalizationEnabled ? formatMood(input.moodEntries) : "";
  const feedbackBlock = personalizationEnabled ? formatFeedback(input.feedbackSummary) : "";
  const wishlistBlock = personalizationEnabled ? formatWishlistInterests(input.wishlistInterests) : "";
  const conversation = input.conversationContext;

  return `
## Contexto personalizado da Bee
- Personalizacao ativa: ${personalizationEnabled ? "sim" : "nao"}
- Nome de tratamento: ${callName}
- Tom emocional detectado nesta mensagem: ${tone}
- Resumo dinamico anterior: ${conversation?.contextSummary || "ainda sem resumo consolidado"}
- Topicos recentes consolidados: ${conversation?.recentTopics?.length ? conversation.recentTopics.join(", ") : "sem topicos consolidados"}
- Objetivos ativos conhecidos: ${conversation?.activeGoals?.length ? conversation.activeGoals.join(", ") : "sem objetivos consolidados"}

${memoryLines.length ? `Memorias ativas:\n${memoryLines.join("\n")}` : "Memorias ativas: nenhuma memoria estruturada ativa."}

${preferenceBlock ? `Preferencias ativas:\n${preferenceBlock}` : "Preferencias ativas: nenhuma preferencia estruturada ativa."}

${moodBlock ? `Humor e bem-estar:\n${moodBlock}` : ""}
${feedbackBlock ? `Feedback sobre respostas anteriores:\n${feedbackBlock}` : ""}
${wishlistBlock ? `Interesses vindos da Lista de Desejos:\n${wishlistBlock}` : ""}

Regras para usar este contexto:
- Use nome, memorias, preferencias, rotina e historico apenas quando ajudarem a resposta.
- Nao diga que lembra de algo se a informacao nao estiver neste contexto ou na conversa recente.
- Quando uma preferencia ou memoria influenciar claramente a resposta, deixe isso transparente de forma natural.
- Se a personalizacao estiver desativada, responda sem usar memorias/preferencias persistentes.
`.trim();
}

export function buildConversationContextUpdate(input: {
  previous?: BeeConversationContext | null;
  recentMessages: Message[];
  userMessage: string;
  assistantResponse: string;
}) {
  const tone = inferEmotionalTone(input.userMessage);
  const recentTopics = extractContextTopics(input.recentMessages, input.userMessage);
  const previousSummary = input.previous?.contextSummary?.trim();
  const userExcerpt = input.userMessage.replace(/\s+/g, " ").slice(0, 180);
  const assistantExcerpt = input.assistantResponse.replace(/\s+/g, " ").slice(0, 180);
  const contextSummary = [
    previousSummary,
    `Ultima troca: usuario disse "${userExcerpt}"; Bee respondeu "${assistantExcerpt}".`,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(-1200);

  const goalTerms = [...(input.previous?.activeGoals ?? [])];
  for (const topic of recentTopics) {
    if (/treino|estudo|rotina|trabalho|saude|foco|financa|calendario|lembrete|objetivo/.test(topic) && !goalTerms.includes(topic)) {
      goalTerms.push(topic);
    }
  }

  return {
    contextSummary,
    recentTopics,
    emotionalTone: tone,
    activeGoals: goalTerms.slice(-8),
    personalizationEnabled: input.previous?.personalizationEnabled ?? true,
  };
}
