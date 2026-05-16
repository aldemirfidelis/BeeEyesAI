import { z } from "zod";

/**
 * Parser robusto de ações JSON emitidas pela IA dentro do texto da resposta.
 *
 * Substitui o legado por regex `[^}]*` que quebrava com:
 *   - JSON aninhado (chaves dentro de strings ou objetos filhos)
 *   - JSON parcial (stream truncado)
 *   - Múltiplas ações na mesma resposta
 *
 * Estratégia:
 *   1. Procura literalmente `"<key>"` e a partir dali faz extração balanceada
 *      contando `{` vs `}`, respeitando strings com escape.
 *   2. Tenta JSON.parse no slice; se falhar, ignora e segue (resiliente a
 *      stream truncado).
 *   3. Valida o payload com Zod antes de devolver — descarta ações inválidas
 *      com log, evitando que INSERTs corrompidos cheguem ao banco.
 */

// ── Schemas (validação Zod) ────────────────────────────────────────────────

const isoDateTimeSchema = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), {
  message: "data inválida (esperado ISO 8601)",
});

export const achievementSchema = z.object({
  type: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(500),
});

export const fetchNewsSchema = z.object({
  query: z.string().min(1).max(200),
});

export const createEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema.optional(),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  allDay: z.boolean().optional(),
});

export const logFinanceSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive("amount deve ser > 0"),
  category: z.string().trim().min(1).max(80),
  description: z.string().max(500).optional(),
});

export const saveNoteSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  title: z.string().max(200).optional(),
});

// ── Extração balanceada ────────────────────────────────────────────────────

/**
 * Encontra o primeiro objeto JSON top-level que contém uma chave específica.
 * Aceita JSON aninhado e strings com chaves dentro. Retorna { slice, start, end }
 * ou null. O slice é a substring exata do objeto encontrado (inclui chaves).
 */
export function extractJsonObjectWithKey(
  source: string,
  keyName: string,
): { slice: string; start: number; end: number } | null {
  // Procura `"<keyName>"` no source. Pode aparecer em vários lugares; precisamos
  // achar o `{` mais próximo ANTES dessa chave que abre o objeto top-level.
  const needle = `"${keyName}"`;
  let searchFrom = 0;
  while (true) {
    const idx = source.indexOf(needle, searchFrom);
    if (idx === -1) return null;

    // Procura o `{` que abre o objeto que contém esta chave. Não pode haver
    // `}` não-balanceado entre eles. Esse é o brace mais próximo à esquerda.
    let openBrace = -1;
    let depth = 0;
    for (let i = idx - 1; i >= 0; i -= 1) {
      const ch = source[i];
      if (ch === "}") depth += 1;
      else if (ch === "{") {
        if (depth === 0) { openBrace = i; break; }
        depth -= 1;
      }
    }
    if (openBrace < 0) {
      searchFrom = idx + needle.length;
      continue;
    }

    // Agora extrai o objeto balanceado a partir de openBrace
    const end = findMatchingCloseBrace(source, openBrace);
    if (end < 0) {
      // Objeto não fecha (stream truncado). Não dá pra parsear; pula.
      searchFrom = idx + needle.length;
      continue;
    }

    return { slice: source.slice(openBrace, end + 1), start: openBrace, end };
  }
}

/** Dado o índice de `{`, retorna o índice do `}` que o fecha, respeitando strings. */
function findMatchingCloseBrace(source: string, openIdx: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = openIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = false; continue; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// ── Normalização (snake_case → camelCase quando necessário) ────────────────

function normalizeCreateEvent(raw: any): any {
  if (!raw || typeof raw !== "object") return raw;
  return {
    title: typeof raw.title === "string" ? raw.title.trim() : raw.title,
    startAt: raw.startAt ?? raw.start_at ?? raw.date,
    endAt: raw.endAt ?? raw.end_at,
    description: raw.description,
    location: raw.location,
    allDay: raw.allDay ?? raw.all_day,
  };
}

function normalizeLogFinance(raw: any): any {
  if (!raw || typeof raw !== "object") return raw;
  const amount = typeof raw.amount === "number" ? raw.amount : parseFloat(String(raw.amount ?? "NaN"));
  return {
    type: raw.type === "income" ? "income" : raw.type === "expense" ? "expense" : raw.type,
    amount: Number.isFinite(amount) ? amount : raw.amount,
    category: typeof raw.category === "string" ? raw.category.trim() : raw.category,
    description: raw.description,
  };
}

// ── Extrair + validar ──────────────────────────────────────────────────────

interface ExtractResult<T> {
  value: T | null;
  slice: string | null; // slice exato do JSON encontrado (para limpar do texto)
}

function extractAndValidate<T>(
  source: string,
  keyName: string,
  schema: z.ZodType<T>,
  normalize: (raw: any) => any = (raw) => raw,
): ExtractResult<T> {
  const extracted = extractJsonObjectWithKey(source, keyName);
  if (!extracted) return { value: null, slice: null };

  let parsed: any;
  try {
    parsed = JSON.parse(extracted.slice);
  } catch (err) {
    console.warn(`[parseAIActions] JSON inválido para "${keyName}":`, (err as Error).message);
    return { value: null, slice: extracted.slice };
  }

  const raw = parsed?.[keyName];
  if (raw === undefined) return { value: null, slice: extracted.slice };

  const normalized = normalize(raw);
  const validated = schema.safeParse(normalized);
  if (!validated.success) {
    console.warn(
      `[parseAIActions] payload "${keyName}" rejeitado pelo schema:`,
      validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
    return { value: null, slice: extracted.slice };
  }

  return { value: validated.data, slice: extracted.slice };
}

// ── API pública ────────────────────────────────────────────────────────────

export type Achievement = z.infer<typeof achievementSchema>;
export type FetchNews = z.infer<typeof fetchNewsSchema>;
export type CreateEvent = z.infer<typeof createEventSchema>;
export type LogFinance = z.infer<typeof logFinanceSchema>;
export type SaveNote = z.infer<typeof saveNoteSchema>;

export interface ParsedAIActions {
  cleanText: string;
  achievement?: Achievement;
  fetchNews?: FetchNews;
  createEvent?: CreateEvent;
  logFinance?: LogFinance;
  saveNote?: SaveNote;
}

export function parseAIActionsV2(response: string): ParsedAIActions {
  let cleanText = response;
  const result: ParsedAIActions = { cleanText };

  const ach = extractAndValidate(response, "achievement", achievementSchema);
  if (ach.value) result.achievement = ach.value;
  if (ach.slice) cleanText = cleanText.replace(ach.slice, "").trim();

  const news = extractAndValidate(response, "fetch_news", fetchNewsSchema);
  if (news.value) result.fetchNews = news.value;
  if (news.slice) cleanText = cleanText.replace(news.slice, "").trim();

  const ev = extractAndValidate(response, "create_event", createEventSchema, normalizeCreateEvent);
  if (ev.value) result.createEvent = ev.value;
  if (ev.slice) cleanText = cleanText.replace(ev.slice, "").trim();

  const fin = extractAndValidate(response, "log_finance", logFinanceSchema, normalizeLogFinance);
  if (fin.value) result.logFinance = fin.value;
  if (fin.slice) cleanText = cleanText.replace(fin.slice, "").trim();

  const note = extractAndValidate(response, "save_note", saveNoteSchema);
  if (note.value) result.saveNote = note.value;
  if (note.slice) cleanText = cleanText.replace(note.slice, "").trim();

  // Limpa lixo residual: linhas em branco múltiplas
  result.cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();
  return result;
}
