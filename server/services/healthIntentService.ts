// ── Detecção de intenções de Saúde no chat da Bee ─────────────────────────────
//
// Identifica pedidos relacionados a treino e saúde, retornando um intent
// estruturado com confiança e campos extraídos. Usado pelo messages.ts para
// roteamento e perguntas progressivas.

import type { HealthGoal, WeekDay, SplitType } from "./workoutPlanService";

export type HealthIntent =
  | "create_workout_plan"
  | "edit_workout_plan"
  | "list_workouts"
  | "add_exercise"
  | "remove_exercise"
  | "change_training_days"
  | "change_rest_days"
  | "mark_workout_done"
  | "ask_health_summary"
  | "substitute_exercise"
  | "unknown";

export interface HealthIntentResult {
  intent: HealthIntent;
  confidence: number;
  goal?: HealthGoal;
  level?: "iniciante" | "intermediario" | "avancado";
  trainingDays?: WeekDay[];
  restDays?: WeekDay[];
  daysPerWeek?: number;
  splitType?: SplitType;
  preference?: "machines" | "free_weights" | "bodyweight" | "misto";
  missingFields: string[];
  rawSnippet?: string;
}

const WEEKDAY_PATTERNS: Array<{ rx: RegExp; day: WeekDay }> = [
  { rx: /\b(segunda|seg)\b/i,    day: "monday" },
  { rx: /\b(ter[cç]a|ter)\b/i,   day: "tuesday" },
  { rx: /\b(quarta|qua)\b/i,     day: "wednesday" },
  { rx: /\b(quinta|qui)\b/i,     day: "thursday" },
  { rx: /\b(sexta|sex)\b/i,      day: "friday" },
  { rx: /\b(s[aá]bado|sab)\b/i,  day: "saturday" },
  { rx: /\b(domingo|dom)\b/i,    day: "sunday" },
];

function extractDays(text: string): WeekDay[] {
  const found = new Set<WeekDay>();
  for (const { rx, day } of WEEKDAY_PATTERNS) {
    if (rx.test(text)) found.add(day);
  }
  return Array.from(found);
}

function extractDaysPerWeek(text: string): number | undefined {
  const m = text.match(/(\d+)\s*(?:vezes?|x|dias?)\s*(?:por|na|\/)?\s*semana/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 7) return n;
  }
  const word = text.match(/\b(uma|duas|tr[eê]s|quatro|cinco|seis|sete)\b\s*(?:vezes?|x)\s*(?:por|na)?\s*semana/i);
  if (word) {
    const map: Record<string, number> = {
      uma: 1, duas: 2, "três": 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
    };
    return map[word[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")];
  }
  return undefined;
}

function extractGoal(text: string): HealthGoal | undefined {
  if (/perder?\s+(peso|gordura)|emagrec/i.test(text)) return "perda_gordura";
  if (/ganhar?\s+m[uú]sculo|hipertrof/i.test(text)) return "hipertrofia";
  if (/(ganho|aumentar?)\s+(de\s+)?for[cç]a/i.test(text)) return "ganho_forca";
  if (/resist[eê]ncia|condicionamento|f[oô]lego/i.test(text)) return "condicionamento";
  if (/mobilidade|flexibilidade|alongamento/i.test(text)) return "mobilidade";
  if (/retorno|voltei?|voltar?\s+(a\s+)?treinar/i.test(text)) return "retorno_treinos";
  if (/sa[uú]de|bem.?estar|geral/i.test(text)) return "saude_geral";
  return undefined;
}

function extractLevel(text: string): "iniciante" | "intermediario" | "avancado" | undefined {
  if (/iniciante|come[cç]ando|nunca\s+treinei?|zerei?/i.test(text)) return "iniciante";
  if (/intermedi[aá]rio|3\+?\s*meses|alguns\s*meses/i.test(text)) return "intermediario";
  if (/avan[cç]ado|experiente|anos?\s+treinando/i.test(text)) return "avancado";
  return undefined;
}

function extractSplit(text: string): SplitType | undefined {
  if (/\babc\b/i.test(text)) return "abc";
  if (/push.?pull.?legs|ppl/i.test(text)) return "push_pull_legs";
  if (/superiores?\s+e\s+inferiores?|upper.?lower/i.test(text)) return "upper_lower";
  if (/corpo\s+inteiro|full.?body/i.test(text)) return "full_body";
  if (/cardio\s+e\s+muscula[cç][aã]o|cardio\s*\+\s*muscula/i.test(text)) return "cardio_musculacao";
  if (/por\s+grupo\s+muscular|grupo\s+muscular/i.test(text)) return "muscle_group";
  return undefined;
}

function extractPreference(text: string): HealthIntentResult["preference"] | undefined {
  if (/aparelh|m[aá]quina/i.test(text)) return "machines";
  if (/peso\s+livre|halter|barra/i.test(text)) return "free_weights";
  if (/peso\s+corporal|sem\s+(equipamento|aparelho)|casa/i.test(text)) return "bodyweight";
  if (/misto|qualquer|tanto\s+faz/i.test(text)) return "misto";
  return undefined;
}

const CREATE_PATTERNS = [
  /\b(crie?|cri[ae]r|monte?|montar|fa[cç]a|fazer|gere?|gerar)\s+(um\s+)?treino\b/i,
  /\bmontar?\s+(um\s+)?plano\s+(de\s+)?treino/i,
  /quero\s+treinar\b/i,
  /preciso\s+de\s+(um\s+)?treino/i,
  /me\s+ajude?\s+(a\s+)?(montar|organizar|criar)\s+(um\s+)?treino/i,
];

const EDIT_PATTERNS = [
  /\b(edit[ae]r?|alter[ae]r?|mudar?|trocar?|ajust[ae]r?)\s+(meu\s+)?treino/i,
  /\b(adicion[ae]r?|coloc[ae]r?)\s+(mais\s+)?(um\s+)?(exerc[ií]cio|treino)/i,
];

const DAYS_CHANGE_PATTERNS = [
  /\b(quero|prefiro|posso)\s+treinar\b/i,
  /\bmudar?\s+(os\s+)?dias\s+de\s+treino/i,
];

const REST_PATTERNS = [
  /\b(descanso|descansar?|folga)\b/i,
];

const SUBSTITUTE_PATTERNS = [
  /\b(troc[ae]r?|substituir?|outro)\s+(exerc[ií]cio|aparelho)/i,
  /n[aã]o\s+tem\s+(esse\s+)?(aparelho|equipamento|m[aá]quina)/i,
  /sem\s+aparelho|sem\s+m[aá]quina/i,
];

const DONE_PATTERNS = [
  /\b(conclu[ií]r?|terminei?|fiz)\s+(o\s+)?treino/i,
  /\btreino\s+(feito|conclu[ií]do|terminado)/i,
  /marcar?\s+treino\s+como\s+(feito|conclu[ií]do)/i,
];

const SUMMARY_PATTERNS = [
  /\bcomo\s+(estou|est[aá])\s+(indo|na\s+semana)/i,
  /(resumo|progresso|evolu[cç][aã]o)\s+(da\s+)?(semana|treino)/i,
  /quantos\s+treinos\s+fiz/i,
];

const LIST_PATTERNS = [
  /\b(quais|mostr[ae]r?|ver?)\s+(meus\s+)?treinos/i,
  /\bmeu\s+(treino|plano)\s+(de\s+)?hoje/i,
];

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseHealthIntent(rawMessage: string): HealthIntentResult {
  const text = (rawMessage ?? "").trim();
  if (!text) return { intent: "unknown", confidence: 0, missingFields: [] };

  const goal = extractGoal(text);
  const level = extractLevel(text);
  const trainingDays = extractDays(text);
  const daysPerWeek = extractDaysPerWeek(text);
  const splitType = extractSplit(text);
  const preference = extractPreference(text);

  // Mark workout done
  if (DONE_PATTERNS.some((rx) => rx.test(text))) {
    return { intent: "mark_workout_done", confidence: 0.9, missingFields: [], rawSnippet: text.slice(0, 200) };
  }

  // Weekly summary
  if (SUMMARY_PATTERNS.some((rx) => rx.test(text))) {
    return { intent: "ask_health_summary", confidence: 0.85, missingFields: [], rawSnippet: text.slice(0, 200) };
  }

  // Substitution
  if (SUBSTITUTE_PATTERNS.some((rx) => rx.test(text))) {
    return {
      intent: "substitute_exercise",
      confidence: 0.8,
      preference,
      missingFields: [],
      rawSnippet: text.slice(0, 200),
    };
  }

  // List
  if (LIST_PATTERNS.some((rx) => rx.test(text))) {
    return { intent: "list_workouts", confidence: 0.8, missingFields: [], rawSnippet: text.slice(0, 200) };
  }

  // Create plan
  const createMatch = CREATE_PATTERNS.some((rx) => rx.test(text));
  if (createMatch) {
    const missing: string[] = [];
    if (!daysPerWeek && trainingDays.length === 0) missing.push("trainingDays");
    if (!level) missing.push("level");
    if (!preference) missing.push("preference");
    return {
      intent: "create_workout_plan",
      confidence: 0.92,
      goal,
      level,
      trainingDays: trainingDays.length ? trainingDays : undefined,
      daysPerWeek,
      splitType,
      preference,
      missingFields: missing,
      rawSnippet: text.slice(0, 200),
    };
  }

  // Change training days
  if (DAYS_CHANGE_PATTERNS.some((rx) => rx.test(text)) && trainingDays.length > 0) {
    const hasRest = REST_PATTERNS.some((rx) => rx.test(text));
    return {
      intent: hasRest ? "change_rest_days" : "change_training_days",
      confidence: 0.78,
      trainingDays: hasRest ? undefined : trainingDays,
      restDays: hasRest ? trainingDays : undefined,
      missingFields: [],
      rawSnippet: text.slice(0, 200),
    };
  }

  // Edit plan
  if (EDIT_PATTERNS.some((rx) => rx.test(text))) {
    return { intent: "edit_workout_plan", confidence: 0.7, missingFields: [], rawSnippet: text.slice(0, 200) };
  }

  return { intent: "unknown", confidence: 0, missingFields: [] };
}

// ── Helper to build follow-up question for missing field ──────────────────────

export function buildFollowUpQuestion(missing: string): string {
  switch (missing) {
    case "trainingDays":
      return "Quantos dias por semana você quer treinar? E quais dias prefere — segunda, terça, quarta…? 🐝";
    case "level":
      return "Seu nível hoje é iniciante, intermediário ou avançado? Não tem certo nem errado, só pra eu ajustar a intensidade 💛";
    case "preference":
      return "Você prefere treinar com aparelhos, peso livre (halteres/barra), peso corporal (em casa) ou misto? 🏋️";
    case "goal":
      return "Qual é seu objetivo principal? (Saúde geral, condicionamento, ganho de força, hipertrofia, perda de gordura…) 🐝✨";
    default:
      return "Me conta mais um pouco pra eu montar algo bem feito pra você? 🐝";
  }
}

export function buildHealthContextForAI(profile: { healthGoal?: string; level?: string; trainingDays?: string[] } | null): string {
  if (!profile) return "";
  const parts: string[] = [];
  if (profile.healthGoal) parts.push(`objetivo: ${profile.healthGoal}`);
  if (profile.level) parts.push(`nível: ${profile.level}`);
  if (profile.trainingDays && profile.trainingDays.length) parts.push(`treina: ${profile.trainingDays.join(", ")}`);
  if (!parts.length) return "";
  return `\n[Saúde do usuário: ${parts.join(" · ")}]\n`;
}
