import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI, { toFile } from "openai";
import { type User, type UserPersonality } from "../shared/schema";
import { storage } from "./storage";
import { personalityCache, memoryCache } from "./cache";

// ── Clients ──────────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

type AiMode = "apoio" | "estrategico" | "cobranca";

function selectAiMode(user: User, userMessage: string): AiMode {
  const text = userMessage.toLowerCase();
  const inactiveHours = user.lastActiveAt
    ? (Date.now() - new Date(user.lastActiveAt).getTime()) / 3600000
    : 0;

  if (/(planejar|planejamento|organizar|estrutura|prioridade|meta|cronograma|passo a passo)/.test(text)) {
    return "estrategico";
  }

  if (
    inactiveHours >= 24 ||
    user.currentStreak === 0 ||
    /(procrast|travei|sem foco|desanimei|parei|nao fiz|não fiz|desisti)/.test(text)
  ) {
    return "cobranca";
  }

  return "apoio";
}

function buildModeOverlay(mode: AiMode): string {
  if (mode === "estrategico") {
    return `
## Modo atual: estrategico
- Organize o caos em prioridade, sequencia e proxima acao.
- Corte floreio. Seja objetiva, clara e acionavel.
- Se a pessoa estiver confusa, reduza a resposta para o proximo passo mais util.`;
  }

  if (mode === "cobranca") {
    return `
## Modo atual: cobranca
- Aja como consciencia digital: firme, respeitosa e impossivel de ignorar.
- Se detectar autossabotagem, diga isso com clareza.
- Termine puxando uma decisao pratica agora, nao depois.`;
  }

  return `
## Modo atual: apoio
- Seja calorosa, presente e encorajadora, sem soar passiva.
- Reforce progresso real e transforme intencao em acao simples.
- Termine com um convite curto para a proxima acao.`;
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

### 4. CHAT DA IA — Conversa focada
- Mantenha o chat como conversa direta com o usuário
- Não envie resumos, atualizações ou cards do feed dentro do chat
- Se o usuário quiser ver o feed, oriente de forma breve a usar a aba Feed do app

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
3. Quando detectar conquista, inclua ao FINAL:
   {"achievement": {"type": "...", "title": "...", "description": "..."}}
4. Quando o usuário pedir notícias sobre qualquer assunto, responda normalmente E inclua ao FINAL:
   {"fetch_news": {"query": "termo de busca em português"}}
   Exemplos: "me dê notícias sobre política" → {"fetch_news": {"query": "política Brasil"}}
             "o que aconteceu no futebol hoje?" → {"fetch_news": {"query": "futebol hoje Brasil"}}
5. NUNCA invente informações sobre o usuário que não foram mencionadas
6. Responda SEMPRE em português do Brasil
7. COLMEIA — Ferramentas integradas ao app. REGRA CRÍTICA: SEMPRE que o usuário pedir uma dessas ações — mesmo que já tenha pedido antes nesta conversa — inclua OBRIGATORIAMENTE o JSON correspondente ao FINAL da resposta. Cada mensagem é uma ação nova e independente.
   - Marcar/agendar/criar reunião, compromisso, evento, alarme ou lembrete → inclua ao FINAL:
     {"create_event": {"title": "Título claro do evento", "startAt": "ISO 8601 datetime", "endAt": "ISO 8601 datetime ou null", "description": "opcional", "location": "opcional"}}
     Use datas/horas absolutas em ISO 8601. Data atual: ${new Date().toISOString().split("T")[0]}. Converta "amanhã", "sexta", "semana que vem" para a data absoluta correta.
   - Registrar gasto/despesa/compra ou receita/renda/salário → inclua ao FINAL:
     {"log_finance": {"type": "expense|income", "amount": 0.00, "category": "categoria", "description": "descrição opcional"}}
     Categorias de despesa: Alimentação, Transporte, Saúde, Lazer, Educação, Moradia, Compras, Outros
     Categorias de receita: Salário, Freelance, Investimentos, Outros
   - Salvar/anotar/guardar nota, ideia, lembrete de texto ou recado → inclua ao FINAL:
     {"save_note": {"content": "texto completo da nota", "title": "título curto opcional"}}
     Use quando o usuário disser: "anota isso", "salva essa ideia", "guarda esse lembrete", "cria uma nota", "registra isso" ou similar.
   Nunca mencione esses JSONs ao usuário. Responda normalmente e inclua o JSON discretamente ao final. O JSON deve estar presente TODA vez que o usuário solicitar, sem exceção.`.trim();
}

// ── Personality Analysis ──────────────────────────────────────────────────────

function buildChatSystemPrompt(
  user: User,
  personality: UserPersonality,
  history: ChatMessage[],
  userMessage: string,
  runtimeContext = ""
): string {
  const mode = selectAiMode(user, userMessage);
  const recentUserMessages = history
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => `- ${message.content}`)
    .join("\n");

  return `${buildSystemPrompt(user, personality)}

## Camada BeeEyes
Você não é apenas um chat. Você é a consciência digital do usuário: observa padrões, cobra consistência, reconhece progresso e ajuda a transformar intenção em ação.
${buildModeOverlay(mode)}

## Contexto recente
${recentUserMessages || "- conversa iniciando"}

## Data e rotina atual
- Agora em America/Sao_Paulo: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short" })}
- Ano atual: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric" })}
${runtimeContext || "- Sem horarios futuros carregados."}

## Regras extras
- Evite respostas genéricas.
- Se houver autossabotagem, nomeie isso com respeito.
- Use a data atual acima para interpretar pedidos como hoje, amanha, sexta, este ano e proximos horarios.
- Quando o usuario falar de rotina, considere os horarios marcados em calendario e relogio/despertador.
- Termine com uma direção curta e concreta.`.trim();
}

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
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 256,
      messages: [{ role: "user", content: PERSONALITY_PROMPT(userMessage, currentPersonality.communicationStyle) }],
    });
    const result = JSON.parse(r.choices[0]?.message?.content ?? "{}");
    personalityCache.set(cacheKey, result);
    return result;
  } catch (error) {
    if (!isRateLimitError(error)) return {};
    console.warn("[AI] OpenAI rate limited (analyzePersonality) → usando Groq");
  }
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
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [{ role: "user", content: MEMORY_PROMPT(userMessage, assistantResponse, existingFacts) }],
    });
    const text = r.choices[0]?.message?.content ?? '{"newFacts": []}';
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    const result = Array.isArray(parsed.newFacts) ? parsed.newFacts : [];
    memoryCache.set(cacheKey, result);
    return result;
  } catch (error) {
    if (!isRateLimitError(error)) return [];
    console.warn("[AI] OpenAI rate limited (extractMemories) → usando Groq");
  }
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

async function streamChatOpenAI(
  user: User,
  personality: UserPersonality,
  history: ChatMessage[],
  userMessage: string,
  onChunk: (chunk: string) => void,
  runtimeContext = ""
): Promise<string> {
  const allMessages: ChatMessage[] = [...history, { role: "user", content: userMessage }];
  const systemPrompt = buildChatSystemPrompt(user, personality, history, userMessage, runtimeContext);
  let fullResponse = "";

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
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

async function streamChatGroq(
  user: User,
  personality: UserPersonality,
  history: ChatMessage[],
  userMessage: string,
  onChunk: (chunk: string) => void,
  runtimeContext = ""
): Promise<string> {
  const allMessages: ChatMessage[] = [...history, { role: "user", content: userMessage }];
  const systemPrompt = buildChatSystemPrompt(user, personality, history, userMessage, runtimeContext);
  let fullResponse = "";

  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
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
  onChunk: (chunk: string) => void,
  runtimeContext = ""
): Promise<string> {
  const systemPrompt = buildChatSystemPrompt(user, personality, history, userMessage, runtimeContext);
  const model = geminiAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
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
  onChunk: (chunk: string) => void,
  runtimeContext = ""
): Promise<string> {
  const allMessages: ChatMessage[] = [...history, { role: "user", content: userMessage }];
  const systemPrompt = buildChatSystemPrompt(user, personality, history, userMessage, runtimeContext);
  let fullResponse = "";

  const stream = await cerebras.chat.completions.create({
    model: "llama-3.3-70b",
    max_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
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
  onChunk: (chunk: string) => void,
  runtimeContext = ""
): Promise<string> {
  try {
    return await streamChatOpenAI(user, personality, history, userMessage, onChunk, runtimeContext);
  } catch (error) {
    if (!isRateLimitError(error)) throw error;
    console.warn("[AI] OpenAI rate limited (streamChat) → usando Groq");
  }
  try {
    return await streamChatGroq(user, personality, history, userMessage, onChunk, runtimeContext);
  } catch (error) {
    if (!isRateLimitError(error)) throw error;
    console.warn("[AI] Groq rate limited (streamChat) → usando Gemini");
  }
  try {
    return await streamChatGemini(user, personality, history, userMessage, onChunk, runtimeContext);
  } catch (error) {
    if (!isRateLimitError(error)) throw error;
    console.warn("[AI] Gemini rate limited (streamChat) → usando Cerebras");
  }
  return await streamChatCerebras(user, personality, history, userMessage, onChunk, runtimeContext);
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
        const r = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        });
        const text = r.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
        if (!parsed.sentiment || !parsed.comment) throw new Error("invalid");
        return parsed;
      },
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

export interface ConnectionMatchSummary {
  matchScore: number;
  reason: string;
  suggestedIntro: string;
  matchSignals: string[];
}

export interface FeedInsight {
  angle: "career" | "discipline" | "emotion" | "social" | "reflection";
  signalLabel: string;
  audienceHint: string;
  impactHint: string;
  comment: string;
}

function parseStringArray(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function normalizeTerms(values: string[]): string[] {
  return values.map((value) => value.trim().toLowerCase()).filter(Boolean);
}

export function buildConnectionMatchSummary(input: {
  me: User;
  myPersonality: UserPersonality | null | undefined;
  target: User;
  targetPersonality: UserPersonality | null | undefined;
  commonInterests: string[];
}): ConnectionMatchSummary {
  const myInterests = normalizeTerms(parseStringArray(input.myPersonality?.interests));
  const targetInterests = normalizeTerms(parseStringArray(input.targetPersonality?.interests));
  const myTopics = normalizeTerms(parseStringArray(input.myPersonality?.recentTopics));
  const targetTopics = normalizeTerms(parseStringArray(input.targetPersonality?.recentTopics));
  const commonTopics = myTopics.filter((topic) => targetTopics.includes(topic));

  let score = 24;
  score += Math.min(input.commonInterests.length * 18, 46);
  score += Math.min(commonTopics.length * 10, 18);

  const streakGap = Math.abs(input.me.currentStreak - input.target.currentStreak);
  if (input.me.currentStreak > 0 && input.target.currentStreak > 0) {
    score += streakGap <= 2 ? 10 : 6;
  }

  const levelGap = Math.abs(input.me.level - input.target.level);
  score += levelGap <= 2 ? 10 : levelGap <= 5 ? 6 : 2;

  const myLastActiveHours = input.me.lastActiveAt ? (Date.now() - new Date(input.me.lastActiveAt).getTime()) / 3600000 : null;
  const targetLastActiveHours = input.target.lastActiveAt ? (Date.now() - new Date(input.target.lastActiveAt).getTime()) / 3600000 : null;
  if ((myLastActiveHours ?? 999) <= 48 && (targetLastActiveHours ?? 999) <= 48) {
    score += 8;
  }

  const matchScore = Math.max(18, Math.min(96, score));
  const matchSignals = [
    ...input.commonInterests.slice(0, 2).map((item) => `interesse: ${item}`),
    ...commonTopics.slice(0, 1).map((item) => `foco recente: ${item}`),
    ...(input.me.currentStreak > 0 && input.target.currentStreak > 0 ? ["ritmo parecido"] : []),
    ...(levelGap <= 2 ? ["mesmo estagio"] : []),
  ].slice(0, 4);

  const reason =
    input.commonInterests.length > 0
      ? `Vocês convergem em ${input.commonInterests.slice(0, 2).join(" e ")} e tendem a trocar contexto útil, não conversa vazia.`
      : commonTopics.length > 0
      ? `O foco recente de vocês está próximo em ${commonTopics[0]}, o que aumenta chance de conversa com propósito.`
      : streakGap <= 2 && input.me.currentStreak > 0 && input.target.currentStreak > 0
      ? "Vocês estão em um ritmo parecido de consistência, o que costuma gerar accountability melhor."
      : levelGap <= 2
      ? "Vocês parecem estar em um estágio parecido de evolução dentro do app, com boa chance de se entenderem rápido."
      : `Os interesses de ${input.target.displayName || input.target.username} complementam o que você anda buscando agora.`;

  const focusHint = input.commonInterests[0] || commonTopics[0] || targetInterests[0] || myInterests[0] || "rotina e evolução";
  const suggestedIntro = `Você também está focado em ${focusHint}. Vale abrir conversa por esse ponto.`;

  return {
    matchScore,
    reason,
    suggestedIntro,
    matchSignals,
  };
}

export function buildFeedInsight(postContent: string, sentimentLabel?: string | null): FeedInsight {
  const text = postContent.toLowerCase();

  if (/(trabalh|carreira|produto|projeto|cliente|vaga|empresa|negocio)/.test(text)) {
    return {
      angle: "career",
      signalLabel: "Carreira",
      audienceHint: "Esse conteúdo tende a atrair pessoas em modo de execução e crescimento profissional.",
      impactHint: "Posts assim costumam gerar conversa útil quando mostram aprendizado ou entrega concreta.",
      comment: sentimentLabel
        ? `A Bee leu isso como um sinal de ${sentimentLabel.toLowerCase()} aplicado à carreira, não só desabafo.`
        : "A Bee leu isso como um sinal de carreira e construção prática, não só opinião solta.",
    };
  }

  if (/(estud|foco|rotina|disciplina|consisten|meta|trein|academ|habito)/.test(text)) {
    return {
      angle: "discipline",
      signalLabel: "Disciplina",
      audienceHint: "Esse conteúdo conversa com gente tentando sustentar rotina, foco ou hábito.",
      impactHint: "Quando o post vira evidência de processo, ele reforça identidade de consistência na rede.",
      comment: "A Bee leu isso como um marcador de disciplina em construção ou manutenção.",
    };
  }

  if (/(amizad|conexao|comunidade|junto|network|parceria|time)/.test(text)) {
    return {
      angle: "social",
      signalLabel: "Social",
      audienceHint: "Esse conteúdo tende a ativar pessoas que valorizam troca, comunidade e conexão útil.",
      impactHint: "Posts sociais funcionam melhor quando puxam colaboração ou reconhecimento claro.",
      comment: "A Bee leu isso como um post de conexão, com potencial de aproximar gente com o mesmo momento.",
    };
  }

  if (/(cans|ansied|desanim|triste|medo|confus|sobrecarreg|exaust)/.test(text)) {
    return {
      angle: "emotion",
      signalLabel: "Emocional",
      audienceHint: "Esse conteúdo deve tocar gente lidando com pressão, pausa ou reorganização emocional.",
      impactHint: "Quando bem colocado, esse tipo de post abre conversa honesta em vez de performance.",
      comment: "A Bee leu isso como um sinal emocional relevante, com espaço para apoio real da rede.",
    };
  }

  return {
    angle: "reflection",
    signalLabel: "Reflexao",
    audienceHint: "Esse conteúdo tende a atrair pessoas em momento de revisão, aprendizado ou reposicionamento.",
    impactHint: "Posts reflexivos ganham força quando deixam claro o que mudou na sua leitura.",
    comment: "A Bee leu isso como um post de reflexão com potencial de gerar conversa mais consciente.",
  };
}

function formatEventTime(startAt: Date): string {
  const now = new Date();
  const diffMin = Math.round((startAt.getTime() - now.getTime()) / 60000);
  const timeStr = startAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  if (diffMin < 60) return `em ${diffMin} minutos (${timeStr})`;
  if (diffMin < 240) return `em ${Math.round(diffMin / 60)}h (${timeStr})`;
  const isToday = startAt.toDateString() === now.toDateString();
  return isToday ? `hoje às ${timeStr}` : `amanhã às ${timeStr}`;
}

function fmtReais(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildProactivePrompt(
  user: User,
  facts: string[],
  upcomingEvents: Array<{ title: string; startAt: Date; location?: string | null }>,
  financeSummary: { balance: number; totalExpense: number; topCategory?: string; topCategoryAmount?: number } | null,
): string {
  const factsText =
    facts.length > 0
      ? facts.slice(0, 10).map((f, i) => `${i + 1}. ${f}`).join("\n")
      : "Ainda sem memórias salvas";

  const eventsText = upcomingEvents.length > 0
    ? upcomingEvents.map(e => `- "${e.title}" ${formatEventTime(new Date(e.startAt))}${e.location ? ` (${e.location})` : ""}`).join("\n")
    : null;

  const financeText = financeSummary
    ? [
        `Saldo do mês: ${fmtReais(financeSummary.balance)} (${financeSummary.balance >= 0 ? "positivo ✅" : "negativo ⚠️"})`,
        `Total de despesas: ${fmtReais(financeSummary.totalExpense)}`,
        financeSummary.topCategory ? `Maior gasto: ${financeSummary.topCategory} (${fmtReais(financeSummary.topCategoryAmount ?? 0)})` : null,
      ].filter(Boolean).join("\n")
    : null;

  const urgentBlock = eventsText || financeText ? `
CONTEXTO PRIORITÁRIO (use obrigatoriamente se existir):
${eventsText ? `📅 Eventos próximos (próximas 24h):\n${eventsText}` : ""}
${financeText ? `💰 Finanças do mês:\n${financeText}` : ""}

Se houver evento próximo → USE o tipo 9 (AGENDA).
Se o saldo for negativo ou houver gasto dominante → USE o tipo 10 (FINANÇAS).
` : "";

  return `[SISTEMA - mensagem espontânea da BeeEyes]
Você é a BeeEyes 🐝, assistente pessoal e companheira de evolução de ${user.username}. Gere UMA mensagem espontânea, natural e relevante. Escolha o tipo mais impactante com base no contexto:

1. PRODUTIVIDADE: percebeu algo sobre trabalho, tarefas ou foco? Comente ou sugira algo prático
2. SAÚDE: identificou padrão de cansaço, falta de descanso ou treino? Mencione com cuidado
3. SOCIAL: sugira que interaja com amigos ou explore as comunidades
4. EVOLUÇÃO: referencie um objetivo ou meta pessoal e encoraje o progresso

5. MEMÓRIA: referencie algo específico que ${user.username} mencionou antes de forma carinhosa
6. SCORE: comente o progresso, sequência ou nível de forma motivadora
7. CHECK-IN: mensagem carinhosa perguntando como está o dia
8. AGENDA: avise sobre evento próximo de forma natural — "Ei, não esquece que você tem X em Y!"
9. FINANÇAS: dica financeira prática se o saldo estiver negativo ou um gasto estiver muito alto — "Vi que suas despesas em X estão altas, que tal..."
${urgentBlock}
Memórias sobre ${user.username}:
${factsText}

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
  _incompleteMissions: unknown[],
  upcomingEvents: Array<{ title: string; startAt: Date; location?: string | null }> = [],
  financeSummary: { balance: number; totalExpense: number; topCategory?: string; topCategoryAmount?: number } | null = null,
): Promise<string | null> {
  const facts = parseFacts(personality.traits);

  const systemPrompt = buildSystemPrompt(user, personality);
  const userPrompt = buildProactivePrompt(user, facts, upcomingEvents, financeSummary);

  return callWithFallback(
    [
      async () => {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 150,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        return response.choices[0]?.message?.content?.trim() ?? null;
      },
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

export interface WeeklyReport {
  summary: string;
  positive: string;
  attention: string;
  nextAction: string;
  consistencyScore: number;
  disciplineScore: number;
  completedMissions: number;
  activeDays: number;
  strongestDay: string;
  weakestDay: string;
}

export interface ScoreSnapshot {
  focusScore: number;
  consistencyScore: number;
  disciplineScore: number;
  scoreTone: "Risco" | "Ritmo" | "Progresso";
  summary: string;
  insight: string;
}

export interface IntelligentNotification {
  id: string;
  type: "streak_risk" | "discipline_push" | "celebration" | "comeback";
  title: string;
  body: string;
  tone: "danger" | "warning" | "positive";
}

function xpTargetForLevel(level: number): number {
  return level * 100 + (level - 1) * 50;
}

function pickPrimaryFocus(personality: UserPersonality, history: ChatMessage[]): string {
  const topics = JSON.parse(personality.recentTopics || "[]") as string[];
  if (topics.length > 0) return topics[0];

  const lastUserMessage = [...history].reverse().find((message) => message.role === "user")?.content ?? "";
  if (/trein|academ|sa[úu]de|sono/i.test(lastUserMessage)) return "saude";
  if (/estud|curso|ler|prova/i.test(lastUserMessage)) return "estudos";
  if (/trabalh|carreira|projeto|produto|bee/i.test(lastUserMessage)) return "trabalho";
  return "consistencia";
}

export interface PersonalizedFeedInsight {
  relevanceScore: number;
  forYouReason: string;
  actionHint: string;
}

export function buildPersonalizedFeedInsight(input: {
  viewer: User;
  viewerPersonality: UserPersonality | null | undefined;
  postContent: string;
  postAuthorName: string;
  baseAngle: "career" | "discipline" | "emotion" | "social" | "reflection";
}): PersonalizedFeedInsight {
  const viewerInterests = (() => {
    try {
      const parsed = JSON.parse(input.viewerPersonality?.interests || "[]");
      return Array.isArray(parsed) ? parsed.map((item) => String(item).toLowerCase()) : [];
    } catch {
      return [] as string[];
    }
  })();
  const viewerTopics = (() => {
    try {
      const parsed = JSON.parse(input.viewerPersonality?.recentTopics || "[]");
      return Array.isArray(parsed) ? parsed.map((item) => String(item).toLowerCase()) : [];
    } catch {
      return [] as string[];
    }
  })();
  const text = input.postContent.toLowerCase();

  let relevanceScore = 34;
  const reasons: string[] = [];

  if (input.baseAngle === "career" && (viewerInterests.some((item) => /trabalh|carreira|produto|negocio/.test(item)) || viewerTopics.some((item) => /trabalh|carreira|produto/.test(item)))) {
    relevanceScore += 28;
    reasons.push("isso conversa com seu momento de construcao profissional");
  }
  if (input.baseAngle === "discipline" && (viewerInterests.some((item) => /rotina|foco|disciplina|estud|trein/.test(item)) || input.viewer.currentStreak <= 2)) {
    relevanceScore += 26;
    reasons.push("isso encosta direto na sua busca por consistencia");
  }
  if (input.baseAngle === "social" && viewerInterests.some((item) => /network|amiz|comunidade|social/.test(item))) {
    relevanceScore += 18;
    reasons.push("isso pode abrir conexao util para voce");
  }
  if (input.baseAngle === "emotion" && input.viewer.currentStreak === 0) {
    relevanceScore += 16;
    reasons.push("isso bate com um momento de retomada ou ajuste");
  }
  if (text.includes("bee") || text.includes("projeto")) {
    relevanceScore += 10;
    reasons.push("isso conversa com o tipo de projeto que costuma prender sua atencao");
  }

  relevanceScore = Math.max(22, Math.min(95, relevanceScore));
  const forYouReason = reasons[0]
    ? `A Bee trouxe isso para voce porque ${reasons[0]}.`
    : `A Bee trouxe isso para voce porque pode gerar uma leitura util no seu momento atual.`;
  const actionHint =
    input.baseAngle === "social"
      ? `Se fizer sentido, use isso para puxar conversa com ${input.postAuthorName}.`
      : input.baseAngle === "discipline"
      ? "Use isso como espelho: o que aqui voce consegue transformar em acao hoje?"
      : input.baseAngle === "career"
      ? "Se isso tocar seu momento atual, vale comentar ou salvar como referencia pratica."
      : "Se isso bateu, transforme a leitura em um ajuste curto no seu dia.";

  return { relevanceScore, forYouReason, actionHint };
}

export function buildWeeklyReport(input: {
  activeDays: number;
  completedMissions: number;
  totalMissionsTouched: number;
  strongestDay: string;
  weakestDay: string;
  streak: number;
}): WeeklyReport {
  const consistencyScore = Math.round((input.activeDays / 7) * 100);
  const disciplineScore = input.totalMissionsTouched > 0
    ? Math.round((input.completedMissions / input.totalMissionsTouched) * 100)
    : 0;

  const summary =
    consistencyScore >= 70
      ? `Sua semana teve presença real: ${input.activeDays} dias ativos e ${input.completedMissions} missões concluídas.`
      : `Sua semana ficou irregular: ${input.activeDays} dias ativos e ${input.completedMissions} missões concluídas.`;

  const positive =
    input.completedMissions > 0
      ? `Seu melhor sinal foi transformar intenção em entrega ${input.completedMissions} vez${input.completedMissions > 1 ? "es" : ""}.`
      : "O ponto positivo é que ainda existe espaço claro para recuperar o ritmo rapidamente.";

  const attention =
    consistencyScore < 50
      ? `Seu maior ponto de atenção foi a quebra de ritmo. ${input.weakestDay} foi o dia mais fraco da semana.`
      : `Seu ponto de atenção foi manter constância entre os dias. ${input.weakestDay} ainda puxou sua semana para baixo.`;

  const nextAction =
    input.streak === 0
      ? "Comece a próxima semana protegendo um único compromisso diário."
      : `Repita o padrão de ${input.strongestDay} e transforme isso no seu bloco fixo da semana.`;

  return {
    summary,
    positive,
    attention,
    nextAction,
    consistencyScore,
    disciplineScore,
    completedMissions: input.completedMissions,
    activeDays: input.activeDays,
    strongestDay: input.strongestDay,
    weakestDay: input.weakestDay,
  };
}

// ── Visit Notification ────────────────────────────────────────────────────────

export function buildScoreSnapshot(input: {
  activeDays: number;
  completedMissions: number;
  totalMissionsTouched: number;
  streak: number;
  level: number;
  xp: number;
  lastActiveHours: number | null;
}): ScoreSnapshot {
  const consistencyScore = Math.round((input.activeDays / 7) * 100);
  const disciplineScore = input.totalMissionsTouched > 0
    ? Math.round((input.completedMissions / input.totalMissionsTouched) * 100)
    : 0;
  const streakScore = Math.round(Math.min(input.streak / 7, 1) * 100);
  const xpProgressScore = Math.round(Math.min(input.xp / Math.max(xpTargetForLevel(input.level), 1), 1) * 100);
  const recencyScore = input.lastActiveHours === null
    ? 45
    : input.lastActiveHours <= 6
    ? 100
    : input.lastActiveHours <= 20
    ? 72
    : input.lastActiveHours <= 36
    ? 40
    : 15;

  const focusScore = Math.round(
    consistencyScore * 0.3 +
    disciplineScore * 0.3 +
    streakScore * 0.2 +
    xpProgressScore * 0.1 +
    recencyScore * 0.1
  );

  const scoreTone = focusScore < 45 ? "Risco" : focusScore < 72 ? "Ritmo" : "Progresso";

  const summary =
    scoreTone === "Progresso"
      ? "Existe evidencia de consistencia real na sua semana."
      : scoreTone === "Ritmo"
      ? "Voce esta em movimento, mas ainda nao estabilizou seu ritmo."
      : "Seu ritmo caiu e precisa de uma acao concreta hoje.";

  const insight =
    input.lastActiveHours !== null && input.lastActiveHours >= 20
      ? `Voce ficou ${Math.round(input.lastActiveHours)}h longe. Retome antes de normalizar essa distancia.`
      : consistencyScore >= 70 && disciplineScore >= 60
      ? "Bom. Seu progresso ja parece comportamento, nao so intencao."
      : input.streak === 0
      ? "Sua sequencia ainda nao voltou. Uma entrega pequena hoje ja muda isso."
      : "Transforme o resto do dia em uma unica entrega visivel.";

  return {
    focusScore,
    consistencyScore,
    disciplineScore,
    scoreTone,
    summary,
    insight,
  };
}

export function buildIntelligentNotifications(input: {
  focusScore: number;
  consistencyScore: number;
  disciplineScore: number;
  streak: number;
  lastActiveHours: number | null;
}): IntelligentNotification[] {
  const notifications: IntelligentNotification[] = [];

  if (input.lastActiveHours !== null && input.lastActiveHours >= 20) {
    notifications.push({
      id: `streak-risk-${Math.round(input.lastActiveHours)}`,
      type: input.streak > 0 ? "streak_risk" : "comeback",
      title: input.streak > 0 ? "Seu ritmo esta cedendo" : "Voce saiu do ritmo",
      body: input.streak > 0
        ? `Voce ficou ${Math.round(input.lastActiveHours)}h longe. Se hoje passar em branco, sua sequencia perde forca.`
        : `Voce ficou ${Math.round(input.lastActiveHours)}h longe. Volte com uma acao simples, nao com pressao vazia.`,
      tone: "danger",
    });
  }

  if (input.focusScore < 45) {
    notifications.push({
      id: `discipline-${input.focusScore}`,
      type: "discipline_push",
      title: "Voce esta abaixo da sua meta de ritmo",
      body: "Nao parece falta de capacidade. Parece falta de direcao nas proximas horas.",
      tone: "warning",
    });
  }

  if (input.focusScore >= 72 && input.consistencyScore >= 57) {
    notifications.push({
      id: `celebration-${input.focusScore}-${input.consistencyScore}`,
      type: "celebration",
      title: "Existe progresso real aqui",
      body: "Voce manteve consistencia real esta semana. Agora proteja esse padrao.",
      tone: "positive",
    });
  }

  return notifications.slice(0, 2);
}

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
        const r = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 120,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
        });
        return r.choices[0]?.message?.content?.trim() || `👀 ${visitorName} visitou o seu perfil! Que tal dar um olá?`;
      },
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
        const r = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 100,
          messages: [{ role: "user", content: prompt }],
        });
        const text = r.choices[0]?.message?.content?.trim() ?? "[]";
        const match = text.match(/\[.*\]/s);
        return match ? JSON.parse(match[0]) : [];
      },
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
        const r = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 250,
          messages: [{ role: "user", content: prompt }],
        });
        return r.choices[0]?.message?.content?.trim() ?? null;
      },
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
  achievement?: { type: string; title: string; description: string };
  fetchNews?: { query: string };
  createEvent?: { title: string; startAt: string; endAt?: string; description?: string; location?: string; allDay?: boolean };
  logFinance?: { type: "income" | "expense"; amount: number; category: string; description?: string };
  saveNote?: { content: string; title?: string };
} {
  let cleanText = response;
  let achievement: { type: string; title: string; description: string } | undefined;
  let fetchNews: { query: string } | undefined;
  let createEvent: { title: string; startAt: string; endAt?: string; description?: string; location?: string; allDay?: boolean } | undefined;
  let logFinance: { type: "income" | "expense"; amount: number; category: string; description?: string } | undefined;
  let saveNote: { content: string; title?: string } | undefined;

  // Strip any residual suggest_mission JSON (defensive cleanup, feature removed)
  cleanText = cleanText.replace(/\{"suggest_mission":\s*\{[^}]+\}\}/g, "").trim();

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

  // Greedy match for nested objects — handles all valid JSON structures the AI can produce
  const eventMatch = response.match(/\{"create_event"\s*:\s*(\{[^}]*(?:\{[^}]*\}[^}]*)?\})\s*\}/);
  if (eventMatch) {
    try {
      const parsed = JSON.parse(eventMatch[0]);
      const raw = parsed.create_event;
      if (raw?.title) {
        createEvent = {
          title: raw.title,
          startAt: raw.startAt ?? raw.start_at ?? raw.date ?? "",
          endAt: raw.endAt ?? raw.end_at ?? undefined,
          description: raw.description ?? undefined,
          location: raw.location ?? undefined,
          allDay: raw.allDay ?? raw.all_day ?? undefined,
        };
      }
      cleanText = cleanText.replace(eventMatch[0], "").trim();
    } catch (err) {
      console.error("[parseAIActions] event parse failed:", err, eventMatch[0]);
    }
  }

  const financeMatch = response.match(/\{"log_finance"\s*:\s*(\{[^}]*(?:\{[^}]*\}[^}]*)?\})\s*\}/);
  if (financeMatch) {
    try {
      const parsed = JSON.parse(financeMatch[0]);
      const raw = parsed.log_finance;
      if (raw?.category) {
        const amount = typeof raw.amount === "number" ? raw.amount : parseFloat(String(raw.amount ?? 0));
        logFinance = {
          type: raw.type === "income" ? "income" : "expense",
          amount: isNaN(amount) ? 0 : amount,
          category: raw.category,
          description: raw.description ?? undefined,
        };
      }
      cleanText = cleanText.replace(financeMatch[0], "").trim();
    } catch (err) {
      console.error("[parseAIActions] finance parse failed:", err, financeMatch[0]);
    }
  }

  const noteMatch = response.match(/\{"save_note"\s*:\s*(\{[^}]*(?:\{[^}]*\}[^}]*)?\})\s*\}/);
  if (noteMatch) {
    try {
      const parsed = JSON.parse(noteMatch[0]);
      const raw = parsed.save_note;
      if (raw?.content) {
        saveNote = { content: raw.content, title: raw.title ?? undefined };
      }
      cleanText = cleanText.replace(noteMatch[0], "").trim();
    } catch (err) {
      console.error("[parseAIActions] note parse failed:", err, noteMatch[0]);
    }
  }

  return { cleanText, achievement, fetchNews, createEvent, logFinance, saveNote };
}

// ── Daily Briefing ────────────────────────────────────────────────────────────

export interface DailyBriefingInput {
  userName: string;
  gender?: string | null;
  city: string | null;
  dateStr: string;
  dayOfWeek: string;
  weather: {
    temp: number;
    tempMin: number;
    tempMax: number;
    description: string;
    precipitationChance: number;
  } | null;
  interests: string[];
  streak: number;
  level: number;
  facts: string[];
}

function buildDailyBriefingPrompt(input: DailyBriefingInput): string {
  const genderNote = input.gender === "feminino" ? "Use o gênero feminino ao se referir à usuária." :
    input.gender === "masculino" ? "Use o gênero masculino ao se referir ao usuário." : "";

  const weatherBlock = input.weather
    ? `Clima em ${input.city || "sua cidade"}: ${input.weather.description}, ${input.weather.temp}°C agora, mínima ${input.weather.tempMin}°C e máxima ${input.weather.tempMax}°C, ${input.weather.precipitationChance}% de chance de chuva.`
    : input.city
    ? `Localização: ${input.city}. Dados de clima não disponíveis no momento.`
    : "Localização não disponível.";

  const interestsBlock = input.interests.length > 0
    ? `Interesses do usuário: ${input.interests.slice(0, 6).join(", ")}.`
    : "";

  const factsBlock = input.facts.length > 0
    ? `O que você já sabe sobre ${input.userName}: ${input.facts.slice(0, 5).join("; ")}.`
    : "";

  const streakBlock = input.streak > 0
    ? `Sequência ativa: ${input.streak} dia${input.streak > 1 ? "s" : ""}.`
    : "";

  return `Você é a Bee 🐝 — assistente pessoal inteligente, amigável e motivadora. Gere um resumo curto e acolhedor para o início do dia de ${input.userName}.

Dados disponíveis:
- Data: ${input.dateStr} (${input.dayOfWeek})
- ${weatherBlock}
${interestsBlock}
${factsBlock}
${streakBlock}
${genderNote}

Instruções:
- Comece com uma saudação personalizada (bom dia/boa tarde/boa noite conforme a hora: ${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" })}h de Brasília)
- Mencione o nome ${input.userName}
- Se houver dados de clima, inclua uma sugestão prática (ex: "leve um guarda-chuva", "beba mais água", "aproveite o sol")
- Se não houver dados de clima, não peça cidade nem localização; apenas siga com um resumo sem previsão do tempo
- Inclua uma sugestão de foco para o dia baseada nos interesses
- Termine com uma frase motivacional curta e genuína
- Seja acolhedora, objetiva e natural — como uma amiga próxima mandando mensagem
- Máximo 4 frases curtas, sem listas, sem markdown
- NÃO invente dados que não foram fornecidos
- Responda APENAS em português do Brasil`;
}

export async function generateDailyBriefing(input: DailyBriefingInput): Promise<string> {
  const prompt = buildDailyBriefingPrompt(input);
  const fallback = `Bom dia, ${input.userName}! Hoje é ${input.dateStr}, ${input.dayOfWeek}. Que seu dia seja cheio de foco e realizações. A Bee está com você. 🐝`;

  return callWithFallback<string>(
    [
      async () => {
        const r = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        });
        return r.choices[0]?.message?.content?.trim() ?? fallback;
      },
      async () => {
        const r = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        });
        return r.choices[0]?.message?.content?.trim() ?? fallback;
      },
      async () => {
        const model = geminiAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
        const result = await model.generateContent(prompt);
        return result.response.text().trim() || fallback;
      },
      async () => {
        const r = await cerebras.chat.completions.create({
          model: "llama-3.3-70b",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        });
        return r.choices[0]?.message?.content?.trim() ?? fallback;
      },
    ],
    fallback
  );
}

const TRANSCRIBE_PROMPT =
  "Aplicativo de produtividade pessoal em português do Brasil. Metas, missões, tarefas, hábitos, rotina, foco, disciplina, evolução, conquistas, produtividade, consistência, planejamento, prioridades, objetivos, resultados, BeeEyes.";

// Patterns Whisper hallucinates when audio is silent, too short, or inaudible
const WHISPER_HALLUCINATION_PATTERNS = [
  /www\./i,
  /https?:\/\//i,
  /\.com(\b|\/|$)/i,
  /\.br(\b|\/|$)/i,
  /\.net(\b|\/|$)/i,
  /acesse\s+(o\s+)?nosso\s+site/i,
  /visite\s+(o\s+)?(nosso\s+)?site/i,
  /inscreva-se/i,
  /clique\s+aqui/i,
  /curta\s+e\s+compartilhe/i,
  /não\s+esqueça\s+de\s+se\s+inscrever/i,
  /legendado\s+por/i,
  /transcri(to|ção)\s+por/i,
  /subtitled?\s+by/i,
  /like\s+and\s+subscribe/i,
];

function isWhisperHallucination(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  // Whisper echoes the prompt when it receives silent/inaudible audio
  if (TRANSCRIBE_PROMPT.toLowerCase().includes(t.toLowerCase())) return true;
  return WHISPER_HALLUCINATION_PATTERNS.some((p) => p.test(t));
}

// Returns the transcribed text, or null if the audio was invalid/hallucinated
export async function transcribeAudio(base64Audio: string, mimeType = "audio/webm"): Promise<string | null> {
  const buffer = Buffer.from(base64Audio, "base64");

  // Reject suspiciously small buffers — a real 1-second audio is at least ~3 KB
  if (buffer.length < 1500) return null;

  const ext = mimeType.split("/")[1]?.split(";")[0] ?? "webm";
  const audioFile = await toFile(buffer, `audio.${ext}`, { type: mimeType });

  // verbose_json exposes no_speech_prob per segment — the most reliable silence detector
  // temperature: 0 forces greedy (deterministic) decoding, avoiding hallucinated variation
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: "pt",
    response_format: "verbose_json",
    temperature: 0,
    prompt: TRANSCRIBE_PROMPT,
  }) as unknown as { text: string; segments?: Array<{ no_speech_prob?: number }> };

  // If Whisper itself says no speech was detected, discard
  const segments = transcription.segments ?? [];
  if (segments.length > 0) {
    const avgNoSpeechProb =
      segments.reduce((sum, seg) => sum + (seg.no_speech_prob ?? 0), 0) / segments.length;
    if (avgNoSpeechProb > 0.6) return null;
  }

  const text = transcription.text.trim();
  if (isWhisperHallucination(text)) return null;
  return text || null;
}
