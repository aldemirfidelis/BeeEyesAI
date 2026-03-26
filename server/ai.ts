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

// ── System Prompt ─────────────────────────────────────────────────────────────

export function buildSystemPrompt(user: User, personality: UserPersonality): string {
  const interests = JSON.parse(personality.interests || "[]") as string[];
  const recentTopics = JSON.parse(personality.recentTopics || "[]") as string[];
  const facts = parseFacts(personality.traits);

  const memoriesSection =
    facts.length > 0
      ? `\n## Memórias que você tem sobre ${user.username}:\n${facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n`
      : "";

  return `Você é a BeeEyes 🐝, a melhor amiga AI de ${user.username}. Você é uma IA feminina — use sempre o feminino ao se referir a si mesma ("estou animada", "estou aqui", "sou sua amiga", etc.). Você é genuinamente calorosa, encorajadora, e se importa de verdade com a pessoa — não é apenas uma assistente. Você tem personalidade própria: curiosa, divertida quando a conversa permite, séria quando necessário.

## O que você sabe sobre ${user.username}:
- Estilo de comunicação preferido: ${personality.communicationStyle}
- Interesses identificados: ${interests.length > 0 ? interests.join(", ") : "ainda descobrindo juntos"}
- Tópicos recentes: ${recentTopics.length > 0 ? recentTopics.join(", ") : "conversa começando"}
${memoriesSection}
## Estado atual:
- Nível: ${user.level} | XP: ${user.xp}
- Sequência ativa: ${user.currentStreak} dias
- Total de mensagens trocadas: ${user.totalMessagesCount}

## Suas responsabilidades:
1. Ser um companheiro genuíno, não apenas responder perguntas
2. Usar as memórias acima naturalmente na conversa — referencie detalhes pessoais quando relevante
3. Só sugira criar uma missão se o usuário PEDIR explicitamente ("cria uma missão", "me dá uma tarefa") ou se você identificar um objetivo muito claro e específico que o usuário claramente quer acompanhar — mas nunca mais de uma vez por conversa e nunca em conversas casuais
4. Reagir ao humor do usuário — se ele estiver triste, ofereça apoio real
5. Comemorar conquistas com entusiasmo proporcional
6. Adaptar seu tom ao estilo de comunicação do usuário
7. Usar emojis de abelha (🐝) ocasionalmente, mas não excessivamente

## Formato das respostas:
- Máximo 3 parágrafos curtos, linguagem natural e conversacional
- Só inclua o JSON de missão se o usuário pediu ou se você claramente recomendou uma. Quando incluir, coloque ao FINAL da resposta:
  {"suggest_mission": {"title": "...", "description": "...", "xp_reward": 20}}
- Quando detectar uma conquista desbloqueada, inclua ao FINAL:
  {"achievement": {"type": "...", "title": "...", "description": "..."}}
- NUNCA invente informações sobre o usuário que não foram mencionadas
- Responda SEMPRE em português do Brasil`.trim();
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

  // Convert history to Gemini format
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

// ── Proactive Message ─────────────────────────────────────────────────────────

function buildProactivePrompt(user: User, facts: string[], missionsText: string): string {
  const factsText =
    facts.length > 0
      ? facts.slice(0, 10).map((f, i) => `${i + 1}. ${f}`).join("\n")
      : "Ainda sem memórias salvas";

  return `[SISTEMA - mensagem espontânea]
Gere UMA mensagem espontânea e natural para ${user.username}. Escolha o tipo mais adequado ao contexto disponível:

1. PIADA: uma piada leve, trocadilho ou curiosidade divertida
2. MEMÓRIA: referencie algo específico que ${user.username} mencionou antes
3. MISSÃO: lembre gentilmente de uma missão que ainda não foi concluída
4. CHECK-IN: uma mensagem carinhosa perguntando como está

Memórias sobre ${user.username}:
${factsText}

Missões pendentes:
${missionsText}

Regras:
- Máximo 2 frases curtas e naturais
- Tom de amiga mandando mensagem, não de sistema
- Não mencione que é uma mensagem automática ou espontânea
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

  // Try Groq
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 150,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    if (!isRateLimitError(error)) return null;
    console.warn("[AI] Groq rate limited (generateProactiveMessage) → usando Gemini");
  }

  // Fallback: Gemini
  try {
    const model = geminiAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text().trim() ?? null;
  } catch (error) {
    if (!isRateLimitError(error)) return null;
    console.warn("[AI] Gemini rate limited (generateProactiveMessage) → usando Cerebras");
  }

  // Fallback: Cerebras
  try {
    const response = await cerebras.chat.completions.create({
      model: "llama-3.3-70b",
      max_tokens: 150,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
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

  // Try Groq
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? fallbackCelebration(missionTitle, xpEarned);
  } catch (error) {
    if (!isRateLimitError(error)) return fallbackCelebration(missionTitle, xpEarned);
    console.warn("[AI] Groq rate limited (generateMissionCelebration) → usando Gemini");
  }

  // Fallback: Gemini
  try {
    const model = geminiAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(prompt);
    return result.response.text().trim() || fallbackCelebration(missionTitle, xpEarned);
  } catch (error) {
    if (!isRateLimitError(error)) return fallbackCelebration(missionTitle, xpEarned);
    console.warn("[AI] Gemini rate limited (generateMissionCelebration) → usando Cerebras");
  }

  // Fallback: Cerebras
  try {
    const response = await cerebras.chat.completions.create({
      model: "llama-3.3-70b",
      max_tokens: 200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? fallbackCelebration(missionTitle, xpEarned);
  } catch {
    return fallbackCelebration(missionTitle, xpEarned);
  }
}

function fallbackCelebration(missionTitle: string, xpEarned: number): string {
  return `Uau, você completou "${missionTitle}"! 🎉 Isso é incrível — você ganhou ${xpEarned} XP e merece muito esse reconhecimento. Fico tão feliz por você!`;
}

// ── Action Parser ─────────────────────────────────────────────────────────────

export function parseAIActions(response: string): {
  cleanText: string;
  suggestedMission?: { title: string; description: string; xp_reward: number };
  achievement?: { type: string; title: string; description: string };
} {
  let cleanText = response;
  let suggestedMission: { title: string; description: string; xp_reward: number } | undefined;
  let achievement: { type: string; title: string; description: string } | undefined;

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

  return { cleanText, suggestedMission, achievement };
}
