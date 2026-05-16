// server/ai.ts importa server/db.ts e instancia SDKs de IA no top-level.
// Setamos stubs ANTES de qualquer import e usamos dynamic import dentro do test
// para garantir que o env já está populado quando o módulo carrega.
process.env.DATABASE_URL ??= "postgres://stub:stub@localhost:5432/stub";
process.env.OPENAI_API_KEY ??= "sk-stub-test";
process.env.GROQ_API_KEY ??= "gsk-stub-test";
process.env.GEMINI_API_KEY ??= "stub-test";
process.env.CEREBRAS_API_KEY ??= "stub-test";

import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

let buildSystemPrompt: typeof import("../server/ai").buildSystemPrompt;

before(async () => {
  ({ buildSystemPrompt } = await import("../server/ai"));
});

const baseUser = {
  id: "u1",
  username: "joao",
  displayName: "João Silva",
  password: "hash",
  email: "joao@example.com",
  gender: "masculino",
  avatarUrl: null,
  level: 3,
  xp: 250,
  currentStreak: 7,
  longestStreak: 14,
  totalMessagesCount: 99,
  bio: null,
  language: "pt-BR",
  onboardingCompleted: true,
  anonymousProfileVisitsEnabled: false,
  allowMessagesFromStrangers: true,
  expoPushToken: null,
  personalityProfile: null,
  isAdmin: false,
  googleId: null,
  city: "Recife",
  lastDailyBriefingDate: null,
  lastActiveAt: new Date(),
  createdAt: new Date(),
} as any;

const basePersonality = {
  userId: "u1",
  traits: JSON.stringify([
    "Trabalha como engenheiro de software em uma fintech",
    "Mora em Recife com a esposa Maria",
    "Tem ansiedade — está em terapia",
  ]),
  communicationStyle: "friendly",
  interests: JSON.stringify(["IA", "ciclismo", "investimentos"]),
  recentTopics: JSON.stringify(["calendário", "treino"]),
  lastAnalyzed: new Date(),
} as any;

describe("buildSystemPrompt — opt-in de PII", () => {
  test("comportamento legado: sem options → inclui dados pessoais", () => {
    const prompt = buildSystemPrompt(baseUser, basePersonality);
    assert.match(prompt, /João Silva/);
    assert.match(prompt, /Trabalha como engenheiro/);
    assert.match(prompt, /IA, ciclismo, investimentos/);
    assert.match(prompt, /Nível: 3/);
    assert.match(prompt, /Sequência: 7 dias/);
  });

  test("personalizationEnabled: true explícito → inclui dados (sem regressão)", () => {
    const prompt = buildSystemPrompt(baseUser, basePersonality, { personalizationEnabled: true });
    assert.match(prompt, /João Silva/);
    assert.match(prompt, /Trabalha como engenheiro/);
  });

  test("personalizationEnabled: false → prompt enxuto sem dados pessoais", () => {
    const prompt = buildSystemPrompt(baseUser, basePersonality, { personalizationEnabled: false });
    assert.doesNotMatch(prompt, /João Silva/);
    assert.doesNotMatch(prompt, /joao/i);
    assert.doesNotMatch(prompt, /engenheiro/);
    assert.doesNotMatch(prompt, /Maria/);
    assert.doesNotMatch(prompt, /ansiedade/);
    assert.doesNotMatch(prompt, /ciclismo/);
    assert.doesNotMatch(prompt, /Recife/);
    assert.doesNotMatch(prompt, /Nível: \d/);
    assert.match(prompt, /Você é a Bee/);
    assert.match(prompt, /Modo privacidade ativo/);
    assert.match(prompt, /create_event/);
    assert.match(prompt, /log_finance/);
    assert.match(prompt, /save_note/);
  });

  test("prompt enxuto instrui IA a não inventar dados pessoais", () => {
    const prompt = buildSystemPrompt(baseUser, basePersonality, { personalizationEnabled: false });
    assert.match(prompt, /Não invente nome/);
  });
});
