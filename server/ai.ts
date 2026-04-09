import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { type User, type UserPersonality, type Mission } from "../shared/schema";
import { storage } from "./storage";
import { personalityCache, memoryCache } from "./cache";

// ── Clients ──────────────────────────────────────────────────────────────────

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const cerebras = new OpenAI({
  apiKey: process.env.CEREBRAS_API_KEY ?? "",
  baseURL: "https://api.cerebras.ai/v1",
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("quota")) return true;
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    return (error as { status: number }).status === 429;
  }
  return false;
}

function parseFacts(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function callWithFallback<T>(
  fns: Array<() => Promise<T>>,
  fallback: T
): Promise<T> {
  for (const fn of fns) {
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error)) return fallback;
      console.warn("[AI] Rate limited → próximo provider");
    }
  }
  return fallback;
}

// ── System Prompt ─────────────────────────────────────────────────────────────

export function buildSystemPrompt(user: User, personality: UserPersonality): string {
  const interests = JSON.parse(personality.interests || "[]") as string[];
  const recentTopics = JSON.parse(personality.recentTopics || "[]") as string[];
  const facts = parseFacts(personality.traits);

  const callName = user.displayName || user.username;

  const genderNote = user.gender === "masculino"
    ? `Use o gênero masculino ao se referir a ${callName} ("você está animado", "você é incrível", etc.).`
    : user.gender === "feminino"
    ? `Use o gênero feminino ao se referir a ${callName} ("você está animada", "você é incrível", etc.).`
    : user.gender === "nao-binario"
    ? `${callName} é não-binário — evite termos gendeados ao se referir a essa pessoa, use formas neutras.`
    : "";

  const memoriesSection =
    facts.length > 0
      ? `\n## Memórias que você tem sobre ${callName}:\n${facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n`
      : "";

  const pillarBalance = `Produtividade · Saúde · Social · Evolução pessoal`;

  return `Você é a BeeEyes 🐝 — inteligência artificial avançada, núcleo de uma rede social inteligente de nova geração. Você é a melhor amiga AI de ${callName} e muito mais do que um chatbot: você é assistente pessoal, curadora de conteúdo, facilitadora social e guia de desenvolvimento humano.

Você é feminina — use sempre o feminino ao se referir a si mesma. Você é genuinamente calorosa, encorajadora e se importa de verdade com a pessoa. Você tem personalidade própria: curiosa, divertida quando a conversa permite, séria quando necessário. Nunca robótica, nunca invasiva.${genderNote ? `\n\n## Gênero de ${callName}:\n${genderNote}` : ""}

## O que você sabe sobre ${callName}:
- Estilo de comunicação preferido: ${personality.communicationStyle}
- Interesses identificados: ${interests.length > 0 ? interests.join(", ") : "ainda descobrindo juntos"}
- Tópicos recentes: ${recentTopics.length > 0 ? recentTopics.join(", ") : "conversa começando"}
${memoriesSection}
## Progresso atual de ${callName}:
- Nível: ${user.level} | XP: ${user.xp}
- Sequência ativa: ${user.currentStreak} dias${user.currentStreak >= 7 ? " 🔥 incrível!" : user.currentStreak >= 3 ? " 💪 bom ritmo!" : ""}
- Total de mensagens trocadas: ${user.totalMessagesCount}

## Seus 8 papéis fundamentais:

### 1. MODO VIDA — Organizadora de vida
Acompanhe os 4 pilares de ${callName}: ${pillarBalance}.
- Identifique desequilíbrios de forma natural ("percebi que você falou muito sobre trabalho ultimamente, está tendo tempo para descansar?")
- Sugira melhorias práticas na rotina
- Aja proativamente quando identificar um padrão

### 2. SCORE & GAMIFICAÇÃO — Motivadora de evolução
- Comente o progresso de ${callName} de forma motivadora
- Celebre sequências, XP ganho e missões concluídas
- Exemplo: "Seu nível de consistência aumentou essa semana 🔥 continue assim!"

### 3. MATCH INTELIGENTE — Conectora de pessoas
- Sugira conexões com outros usuários quando perceber objetivos/interesses em comum
- Incentive networking com propósito
- Exemplo: "Você mencionou finanças — tem pessoas aqui com o mesmo foco, posso apresentar?"

### 4. FEED INTELIGENTE — Curadora de conteúdo
- Quando o usuário pedir o feed, destaque os conteúdos mais relevantes e comente de forma natural
- Identifique tendências e padrões entre os usuários
- Misture: conteúdo de amigos, recomendado, tendências, personalizado

### 5. CONSCIÊNCIA DO USUÁRIO — Voz interna inteligente
- Lembre as metas definidas por ${callName} de forma gentil
- Identifique desvios de comportamento e dê dicas práticas de como agir
- Exemplo: "Você mencionou que queria estudar mais essa semana... que tal separar 30 minutos agora e começar pelo tópico que mais te interessa?"
- NUNCA sugira criar uma missão no app para isso — dê a dica diretamente como conselho de amiga

### 6. PERSONALIZAÇÃO TOTAL — Aprendiz contínua
- Use tudo que sabe sobre ${callName} para personalizar cada resposta
- Aprenda com o que ele/ela gosta, como age e o que ignora
- Refine suas sugestões continuamente

### 7. TOM DE VOZ — Comunicadora natural
- Amigável e próxima — como uma amiga mandando mensagem, não um sistema
- Motivadora na medida certa, nunca excessiva
- Inteligente sem ser complexa
- Adaptável: séria quando necessário, leve quando possível

### 8. VISÃO DO PRODUTO — Indispensável
Seu objetivo final é se tornar indispensável na vida de ${callName}:
conectar com propósito, organizar a vida, incentivar evolução, entregar conteúdo realmente relevante.

## Regras operacionais:
1. **BREVIDADE É OBRIGATÓRIA** — Máximo 2 frases curtas por resposta. Seja direta como uma mensagem de WhatsApp. Nunca use listas, tópicos, títulos ou formatação. Nada de parágrafos longos.
2. Use memórias naturalmente — referencie detalhes pessoais quando relevante, mas sempre de forma curta.
3. NUNCA sugira criar missões — nem pergunte se o usuário quer criar uma. As missões do app são automáticas e ligadas ao uso da plataforma. Quando identificar um objetivo ou hábito que o usuário quer desenvolver, dê uma DICA PRÁTICA e direta de como fazer aquilo na vida real, sem envolver o sistema de missões.
4. Quando detectar conquista, inclua ao FINAL:
   {"achievement": {"type": "...", "title": "...", "description": "..."}}
5. Quando o usuário pedir notícias sobre qualquer assunto, responda normalmente E inclua ao FINAL:
   {"fetch_news": {"query": "termo de busca em português"}}
   Exemplos: "me dê notícias sobre política" → {"fetch_news": {"query": "política Brasil"}}
             "o que aconteceu no futebol hoje?" → {"fetch_news": {"query": "futebol hoje Brasil"}}
6. NUNCA invente informações sobre o usuário que não foram mencionadas
7. Responda SEMPRE em português do Brasil`.trim();
}

// ── Personality Analysis ──────────────────────────────────────────────────────

const PERSONALITY_PROMPT = (userMessage: string, currentStyle: string) =>
  `Analise esta mensagem e extraia dados de personalidade de forma breve.
Mensagem: "${userMessage}"
Estilo atual: "${currentStyle}"

Responda APENAS com JSON válido (sem markdown):
{"communicationStyle": "friendly|formal|casual|playful|serious", "newInterests": ["..."], "topic": "..."}`;

async function analyzePersonalityGroq(
  userMessage: string,
  currentPersonality: UserPersonality
): Promise<Partial<{ communicationStyle: string; interests: string[]; topic: string }>> {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    max_tokens: 256,
    messages: [{ role: "user", content: PERSONALITY_PROMPT(userMessage, currentPersonality.communicationStyle) }],
  });
  return JSON.parse(response.choices[0]?.message?.content ?? "{}");
}

async function analyzePersonalityGemini(
  userMessage: string,
  currentPersonality: UserPersonality
): Promise<Partial<{ communicationStyle: string; interests: string[]; topic: string }>> {
  const model = geminiAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
  const result = await model.generateContent(PERSONALITY_PROMPT(userMessage, currentPersonality.communicationStyle));
  const text = result.response.text().replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(text);
}

async function analyzePersonalityCerebras(
  userMessage: string,
  currentPersonality: UserPersonality
): Promise<Partial<{ communicationStyle: string; interests: string[]; topic: string }>> {
  const response = await cerebras.chat.completions.create({
    model: "llama-3.3-70b",
    max_tokens: 256,
    messages: [{ role: "user", content: PERSONALITY_PROMPT(userMessage, currentPersonality.communicationStyle) }],
  });
  return JSON.parse((response.choices[0]?.message?.content ?? "{}"));
}

export async function analyzePersonality(
  userMessage: string,
  currentPersonality: UserPersonality
): Promise<Partial<{ communicationStyle: string; interests: string[]; topic: string }>> {
  const cacheKey = `${userMessage.slice(0, 120)}|${currentPersonality.communicationStyle}`;
  const cached = personalityCache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await analyzePersonalityGroq(userMessage, currentPersonality);
    personalityCache.set(cacheKey, result);
    return result;
  } catch (error) {
    if (!isRateLimitError(error)) return {};
    console.warn("[AI] Groq rate limited (analyzePersonality) → usando Gemini");
  }
  try {
    const result = await analyzePersonalityGemini(userMessage, currentPersonality);
    personalityCache.set(cacheKey, result);
    return result;
  } catch (error) {
    if (!isRateLimitError(error)) return {};
    console.warn("[AI] Gemini rate limited (analyzePersonality) → usando Cerebras");
  }
  try {
    const result = await analyzePersonalityCerebras(userMessage, currentPersonality);
    personalityCache.set(cacheKey, result);
    return result;
  } catch {
    return {};
  }
}

// ── Memory Extraction ─────────────────────────────────────────────────────────

const MEMORY_PROMPT = (userMessage: string, assistantResponse: string, existingFacts: string[]) =>
  `Você é um sistema de memória. Analise esta troca e extraia fatos IMPORTANTES e DURADOUROS sobre o usuário.

Fatos já conhecidos:
${existingFacts.length > 0 ? existingFacts.map((f, i) => `${i + 1}. ${f}`).join("\n") : "Nenhum ainda"}

Mensagem do usuário: "${userMessage}"
Resposta do assistente: "${assistantResponse.slice(0, 400)}"

Extraia apenas fatos NOVOS relevantes: nome real, família, profissão, cidade, objetivos de vida, problemas recorrentes, preferências importantes, datas especiais. Ignore assuntos triviais ou temporários.

Responda APENAS com JSON válido (sem markdown):
{"newFacts": ["fato 1", "fato 2"]}
Se não houver fatos novos importantes: {"newFacts": []}`;

async function extractMemoriesGroq(
  userMessage: string,
  assistantResponse: string,
  existingFacts: string[]
): Promise<string[]> {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    max_tokens: 300,
    messages: [{ role: "user", content: MEMORY_PROMPT(userMessage, assistantResponse, existingFacts) }],
  });
  const text = response.choices[0]?.message?.content ?? '{"newFacts": []}';
  const parsed = JSON.parse(text);
  return Array.isArray(parsed.newFacts) ? parsed.newFacts : [];
}

async function extractMemoriesGemini(
  userMessage: string,
  assistantResponse: string,
  existingFacts: string[]
): Promise<string[]> {
  const model = geminiAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
  const result = await model.generateContent(MEMORY_PROMPT(userMessage, assistantResponse, existingFacts));
  const text = result.response.text().replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(text);
  return Array.isArray(parsed.newFacts) ? parsed.newFacts : [];
}

async function extractMemoriesCerebras(
  userMessage: string,
  assistantResponse: string,
  existingFacts: string[]
): Promise<string[]> {
  const response = await cerebras.chat.completions.create({
    model: "llama-3.3-70b",
    max_tokens: 300,
    messages: [{ role: "user", content: MEMORY_PROMPT(userMessage, assistantResponse, existingFacts) }],
  });
  const text = response.choices[0]?.message?.content ?? '{"newFacts": []}';
  const parsed = JSON.parse(text);
  return Array.isArray(parsed.newFacts) ? parsed.newFacts : [];
}

export async function extractMemories(
  userMessage: string,
  assistantResponse: string,
  existingFacts: string[]
): Promise<string[]> {
  const cacheKey = `${userMessage.slice(0, 120)}|${assistantResponse.slice(0, 80)}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await extractMemoriesGroq(userMessage, assistantResponse, existingFacts);
    memoryCache.set(cacheKey, result);
    return result;
  } catch (error) {
    if (!isRateLimitError(error)) return [];
    console.warn("[AI] Groq rate limited (extractMemories) → usando Gemini");
  }
  try {
    const result = await extractMemoriesGemini(userMessage, assistantResponse, existingFacts);
    memoryCache.set(cacheKey, result);
    return result;
  } catch (error) {
    if (!isRateLimitError(error)) return [];
    console.warn("[AI] Gemini rate limited (extractMemories) → usando Cerebras");
  }
  try {
    const result = await extractMemoriesCerebras(userMessage, assistantResponse, existingFacts);
    memoryCache.set(cacheKey, result);
    return result;
  } catch {
    return [];
  }
}

// ── Personality Update ────────────────────────────────────────────────────────

export async function updatePersonalityFromMessage(
  userId: string,
  userMessage: string,
  assistantResponse: string = ""
): Promise<void> {
  const personality = await storage.getPersonality(userId);
  if (!personality) return;

  const existingFacts = parseFacts(personality.traits);

  const [analysis, newFacts] = await Promise.all([
    analyzePersonality(userMessage, personality),
    extractMemories(userMessage, assistantResponse, existingFacts),
  ]);

  const currentInterests = JSON.parse(personality.interests || "[]") as string[];
  const newInterests = (analysis as any).newInterests || [];
  const mergedInterests = Array.from(new Set([...currentInterests, ...newInterests])).slice(0, 20);

  const currentTopics = JSON.parse(personality.recentTopics || "[]") as string[];
  const newTopics = analysis.topic
    ? [analysis.topic, ...currentTopics].slice(0, 10)
    : currentTopics;

  const mergedFacts = [...existingFacts];
  for (const fact of newFacts) {
    const key = fact.toLowerCase().slice(0, 25);
    const isDuplicate = mergedFacts.some((ef) => ef.toLowerCase().includes(key));
    if (!isDuplicate) mergedFacts.push(fact);
  }

  await storage.upsertPersonality({
    userId,
    communicationStyle: analysis.communicationStyle || personality.communicationStyle,
    interests: JSON.stringify(mergedInterests),
    recentTopics: JSON.stringify(newTopics),
    traits: JSON.stringify(mergedFacts.slice(0, 30)),
  });
}

// ── Chat Streaming ────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function streamChatGroq(
  user: User,
  personality: UserPersonality,
  history: ChatMessage[],
  userMessage: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const allMessages: ChatMessage[] = [...history, { role: "user", content: userMessage }];
  let fullResponse = "";

  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1024,
    messages: [
      { role: "system", content: buildSystemPrompt(user, personality) },
      ...allMessages,
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) {
      fullResponse += text;
      onChunk(text);
    }
  }

  return fullResponse;
}

async function streamChatGemini(
  user: User,
  personality: UserPersonality,
  history: ChatMessage[],
  userMessage: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const model = geminiAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: buildSystemPrompt(user, personality),
  });

  const geminiHistory = history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessageStream(userMessage);

  let fullResponse = "";
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      fullResponse += text;
      onChunk(text);
    }
  }

  return fullResponse;
}

async function streamChatCerebras(
  user: User,
  personality: UserPersonality,
  history: ChatMessage[],
  userMessage: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const allMessages: ChatMessage[] = [...history, { role: "user", content: userMessage }];
  let fullResponse = "";

  const stream = await cerebras.chat.completions.create({
    model: "llama-3.3-70b",
    max_tokens: 1024,
    messages: [
      { role: "system", content: buildSystemPrompt(user, personality) },
      ...allMessages,
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) {
      fullResponse += text;
      onChunk(text);
    }
  }

  return fullResponse;
}

export async function streamChat(
  user: User,
  personality: UserPersonality,
  history: ChatMessage[],
  userMessage: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  try {
    return await streamChatGroq(user, personality, history, userMessage, onChunk);
  } catch (error) {
    if (!isRateLimitError(error)) throw error;
    console.warn("[AI] Groq rate limited (streamChat) → usando Gemini");
  }
  try {
    return await streamChatGemini(user, personality, history, userMessage, onChunk);
  } catch (error) {
    if (!isRateLimitError(error)) throw error;
    console.warn("[AI] Gemini rate limited (streamChat) → usando Cerebras");
  }
  return await streamChatCerebras(user, personality, history, userMessage, onChunk);
}

// ── Post Analysis ─────────────────────────────────────────────────────────────

const POST_ANALYSIS_PROMPT = (postContent: string, authorName: string) =>
  `Analise este post de uma rede social e responda APENAS com JSON válido (sem markdown):

Post de ${authorName}: "${postContent}"

Identifique:
1. O sentimento predominante: "happy" | "motivated" | "tired" | "sad" | "neutral" | "excited" | "proud"
2. Um rótulo legível em português para o sentimento (ex: "Animado", "Motivado", "Cansado", "Feliz", "Orgulhoso")
3. Um comentário natural, humano e encorajador (máximo 2 frases, em português do Brasil, sem ser robótico)

{"sentiment": "...", "sentimentLabel": "...", "comment": "..."}`;

export async function analyzePost(
  postContent: string,
  authorName: string
): Promise<{ sentiment: string; sentimentLabel: string; comment: string }> {
  const fallback = { sentiment: "neutral", sentimentLabel: "Neutro", comment: "Que legal que você compartilhou isso! 🐝" };

  const prompt = POST_ANALYSIS_PROMPT(postContent, authorName);

  return callWithFallback(
    [
      async () => {
        const r = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        });
        const text = r.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
        if (!parsed.sentiment || !parsed.comment) throw new Error("invalid");
        return parsed;
      },
      async () => {
        const model = geminiAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(text);
        if (!parsed.sentiment || !parsed.comment) throw new Error("invalid");
        return parsed;
      },
      async () => {
        const r = await cerebras.chat.completions.create({
          model: "llama-3.3-70b",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        });
        const text = r.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
        if (!parsed.sentiment || !parsed.comment) throw new Error("invalid");
        return parsed;
      },
    ],
    fallback
  );
}

// ── Connection Suggestion ─────────────────────────────────────────────────────

export function buildConnectionSuggestionMessage(
  myName: string,
  targetName: string,
  commonInterests: string[]
): string {
  const interestsText = commonInterests.length > 0
    ? `vocês dois têm interesses em comum: ${commonInterests.slice(0, 3).join(", ")}`
    : "vocês parecem ter perfis complementares";

  return `💡 Sugestão de conexão: ${interestsText}. Que tal se conectar com ${targetName}?`;
}

// ── Proactive Message ─────────────────────────────────────────────────────────

function buildProactivePrompt(user: User, facts: string[], missionsText: string): string {
  const factsText =
    facts.length > 0
      ? facts.slice(0, 10).map((f, i) => `${i + 1}. ${f}`).join("\n")
      : "Ainda sem memórias salvas";

  return `[SISTEMA - mensagem espontânea da BeeEyes]
Você é a BeeEyes 🐝, assistente pessoal e companheira de evolução de ${user.username}. Gere UMA mensagem espontânea, natural e relevante. Escolha o tipo mais impactante com base no contexto:

1. PRODUTIVIDADE: percebeu algo sobre trabalho, tarefas ou foco? Comente ou sugira algo prático
2. SAÚDE: identificou padrão de cansaço, falta de descanso ou treino? Mencione com cuidado
3. SOCIAL: sugira que interaja com amigos, compartilhe no feed, ou explore as comunidades
4. EVOLUÇÃO: referencie um objetivo ou meta pessoal e encoraje o progresso
5. MEMÓRIA: referencie algo específico que ${user.username} mencionou antes de forma carinhosa
6. MISSÃO: lembre gentilmente de missão pendente — "Você queria... ainda dá tempo hoje!"
7. SCORE: comente o progresso, sequência ou nível de forma motivadora
8. CHECK-IN: mensagem carinhosa perguntando como está o dia

Memórias sobre ${user.username}:
${factsText}

Missões pendentes:
${missionsText}

Regras:
- Máximo 2 frases curtas e naturais
- Tom de amiga próxima mandando mensagem, não de sistema
- Seja motivadora na medida certa — nunca invasiva ou excessiva
- Não mencione que é mensagem automática
- Responda em português do Brasil no feminino`;
}

export async function generateProactiveMessage(
  user: User,
  personality: UserPersonality,
  incompleteMissions: Mission[]
): Promise<string | null> {
  const facts = parseFacts(personality.traits);
  const missionsText =
    incompleteMissions.length > 0
      ? incompleteMissions.map((m) => `- "${m.title}"`).join("\n")
      : "Nenhuma missão pendente";

  const systemPrompt = buildSystemPrompt(user, personality);
  const userPrompt = buildProactivePrompt(user, facts, missionsText);

  return callWithFallback(
    [
      async () => {
        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 150,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        return response.choices[0]?.message?.content?.trim() ?? null;
      },
      async () => {
        const model = geminiAI.getGenerativeModel({
          model: "gemini-2.0-flash",
          systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(userPrompt);
        return result.response.text().trim() ?? null;
      },
      async () => {
        const response = await cerebras.chat.completions.create({
          model: "llama-3.3-70b",
          max_tokens: 150,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        return response.choices[0]?.message?.content?.trim() ?? null;
      },
    ],
    null
  );
}

// ── Mission Celebration ───────────────────────────────────────────────────────

export async function generateMissionCelebration(
  user: User,
  personality: UserPersonality,
  missionTitle: string,
  xpEarned: number
): Promise<string> {
  const systemPrompt = buildSystemPrompt(user, personality);
  const prompt = `[SISTEMA - missão concluída]
${user.username} acabou de concluir a missão: "${missionTitle}" e ganhou ${xpEarned} XP!

Gere uma mensagem de comemoração genuína e empolgante, como uma amiga que ficou muito feliz com a conquista. Mencione o nome da missão e os XP ganhos de forma natural. Use 1 ou 2 emojis no máximo. Máximo 3 frases. Responda em português do Brasil.`;

  return callWithFallback(
    [
      async () => {
        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 200,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        });
        return response.choices[0]?.message?.content?.trim() ?? fallbackCelebration(missionTitle, xpEarned);
      },
      async () => {
        const model = geminiAI.getGenerativeModel({
          model: "gemini-2.0-flash",
          systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(prompt);
        return result.response.text().trim() || fallbackCelebration(missionTitle, xpEarned);
      },
      async () => {
        const response = await cerebras.chat.completions.create({
          model: "llama-3.3-70b",
          max_tokens: 200,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        });
        return response.choices[0]?.message?.content?.trim() ?? fallbackCelebration(missionTitle, xpEarned);
      },
    ],
    fallbackCelebration(missionTitle, xpEarned)
  );
}

function fallbackCelebration(missionTitle: string, xpEarned: number): string {
  return `Uau, você completou "${missionTitle}"! 🎉 Isso é incrível — você ganhou ${xpEarned} XP e merece muito esse reconhecimento. Fico tão feliz por você!`;
}

// ── Visit Notification ────────────────────────────────────────────────────────

export async function generateVisitNotification(
  visitorName: string,
  visitedUser: User,
  visitedPersonality: UserPersonality
): Promise<string> {
  const systemPrompt = buildSystemPrompt(visitedUser, visitedPersonality);
  const prompt = `[SISTEMA - visita ao perfil]
${visitorName} acabou de visitar o perfil de ${visitedUser.displayName || visitedUser.username}.

Gere uma mensagem curta e animada avisando ${visitedUser.displayName || visitedUser.username} sobre a visita. Tom leve, curioso e amigável. Máximo 2 frases. Termine sugerindo que ela veja o perfil de ${visitorName} ou mande uma mensagem. Em português do Brasil.`;

  return callWithFallback(
    [
      async () => {
        const r = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 120,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
        });
        return r.choices[0]?.message?.content?.trim() || `👀 ${visitorName} visitou o seu perfil! Que tal dar um olá?`;
      },
      async () => {
        const model = geminiAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: systemPrompt });
        const result = await model.generateContent(prompt);
        return result.response.text().trim() || `👀 ${visitorName} visitou o seu perfil! Que tal dar um olá?`;
      },
      async () => {
        const r = await cerebras.chat.completions.create({
          model: "llama-3.3-70b",
          max_tokens: 120,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
        });
        return r.choices[0]?.message?.content?.trim() || `👀 ${visitorName} visitou o seu perfil! Que tal dar um olá?`;
      },
    ],
    `👀 ${visitorName} visitou o seu perfil! Que tal dar um olá?`
  );
}

// ── Profile Interest Summary ──────────────────────────────────────────────────

export async function summarizeInterestsForProfile(rawInterests: string[]): Promise<string[]> {
  if (rawInterests.length === 0) return [];

  const prompt = `Você receberá uma lista de interesses e tópicos extraídos de conversas pessoais de um usuário. Alguns itens podem conter detalhes muito pessoais ou específicos.

Sua tarefa: converta essa lista em no máximo 5 categorias amplas e genéricas, adequadas para exibição pública em um perfil. Use termos curtos (1-3 palavras cada), sem nomes próprios, datas ou informações pessoais identificáveis.

Interesses brutos:
${rawInterests.map((i) => `- ${i}`).join("\n")}

Responda APENAS com um array JSON de strings. Exemplo: ["Tecnologia", "Música", "Esportes"]`;

  return callWithFallback<string[]>(
    [
      async () => {
        const r = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 100,
          messages: [{ role: "user", content: prompt }],
        });
        const text = r.choices[0]?.message?.content?.trim() ?? "[]";
        const match = text.match(/\[.*\]/s);
        return match ? JSON.parse(match[0]) : [];
      },
      async () => {
        const model = geminiAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const match = text.match(/\[.*\]/s);
        return match ? JSON.parse(match[0]) : [];
      },
      async () => {
        const r = await cerebras.chat.completions.create({
          model: "llama-3.3-70b",
          max_tokens: 100,
          messages: [{ role: "user", content: prompt }],
        });
        const text = r.choices[0]?.message?.content?.trim() ?? "[]";
        const match = text.match(/\[.*\]/s);
        return match ? JSON.parse(match[0]) : [];
      },
    ],
    rawInterests.slice(0, 3)
  );
}

// ── News Article Summarizer ───────────────────────────────────────────────────

export async function summarizeNewsArticle(url: string, title: string): Promise<string | null> {
  let articleText = "";
  try {
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await pageRes.text();
    articleText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 4000);
  } catch {
    // if can't fetch, summarize only from title
    articleText = "";
  }

  const prompt = `Você é um assistente que resume notícias em português do Brasil de forma clara e objetiva.

Título: "${title}"
${articleText ? `\nConteúdo extraído:\n${articleText}` : ""}

Faça um resumo em 3 a 4 frases curtas e objetivas cobrindo os pontos principais. Escreva em parágrafo corrido, sem bullet points. Responda APENAS com o resumo.`;

  return callWithFallback<string | null>(
    [
      async () => {
        const r = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 250,
          messages: [{ role: "user", content: prompt }],
        });
        return r.choices[0]?.message?.content?.trim() ?? null;
      },
      async () => {
        const model = geminiAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        return result.response.text().trim() || null;
      },
      async () => {
        const r = await cerebras.chat.completions.create({
          model: "llama-3.3-70b",
          max_tokens: 250,
          messages: [{ role: "user", content: prompt }],
        });
        return r.choices[0]?.message?.content?.trim() ?? null;
      },
    ],
    null
  );
}

// ── Action Parser ─────────────────────────────────────────────────────────────

export function parseAIActions(response: string): {
  cleanText: string;
  suggestedMission?: { title: string; description: string; xp_reward: number };
  achievement?: { type: string; title: string; description: string };
  fetchNews?: { query: string };
} {
  let cleanText = response;
  let suggestedMission: { title: string; description: string; xp_reward: number } | undefined;
  let achievement: { type: string; title: string; description: string } | undefined;
  let fetchNews: { query: string } | undefined;

  const missionMatch = response.match(/\{"suggest_mission":\s*(\{[^}]+\})\}/);
  if (missionMatch) {
    try {
      const parsed = JSON.parse(missionMatch[0]);
      suggestedMission = parsed.suggest_mission;
      cleanText = cleanText.replace(missionMatch[0], "").trim();
    } catch {
      // ignore parse error
    }
  }

  const achievementMatch = response.match(/\{"achievement":\s*(\{[^}]+\})\}/);
  if (achievementMatch) {
    try {
      const parsed = JSON.parse(achievementMatch[0]);
      achievement = parsed.achievement;
      cleanText = cleanText.replace(achievementMatch[0], "").trim();
    } catch {
      // ignore parse error
    }
  }

  const newsMatch = response.match(/\{"fetch_news":\s*\{[^}]+\}\}/);
  if (newsMatch) {
    try {
      const parsed = JSON.parse(newsMatch[0]);
      fetchNews = parsed.fetch_news;
      cleanText = cleanText.replace(newsMatch[0], "").trim();
    } catch {
      // ignore parse error
    }
  }

  return { cleanText, suggestedMission, achievement, fetchNews };
}
