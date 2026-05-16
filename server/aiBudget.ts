/**
 * Cap de custo de IA por usuário/mês — mitigação contra:
 *   - Abuso/bot enviando milhares de mensagens.
 *   - "Sucesso viral surpresa" levando a contas estouradas no provedor.
 *
 * Implementação in-memory (Map). Reseta a cada deploy/restart, o que é
 * aceitável como camada inicial. Para produção crítica, persistir em
 * Redis ou nova tabela `ai_cost_usage(user_id, month, cost_cents)`.
 *
 * Custo é estimado em centavos com base no gpt-4o-mini (provedor padrão):
 *   - Input: $0.15 / 1M tokens
 *   - Output: $0.60 / 1M tokens
 *   - Razão típica observada: ~70% input, 30% output em chat com Bee
 *
 * Configurável via env:
 *   BEE_AI_MONTHLY_BUDGET_USD — limite em dólares (default 5)
 *
 * Para isentar usuários específicos (ex: admin/testers), use o método
 * isExempt — a lista vem de env BEE_AI_BUDGET_EXEMPT_USER_IDS.
 */

const PRICE_INPUT_USD_PER_TOKEN = 0.15 / 1_000_000;
const PRICE_OUTPUT_USD_PER_TOKEN = 0.60 / 1_000_000;

/** Heurística simples para estimar tokens a partir de um texto. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Regra grosseira: 1 token ≈ 4 caracteres em PT-BR / inglês comum.
  return Math.ceil(text.length / 4);
}

/** Custo estimado em centavos para uma chamada com input/output dados. */
export function estimateCostCents(inputTokens: number, outputTokens: number): number {
  const usd = inputTokens * PRICE_INPUT_USD_PER_TOKEN + outputTokens * PRICE_OUTPUT_USD_PER_TOKEN;
  return Math.ceil(usd * 100); // cents, arredondado pra cima
}

interface UsageEntry {
  cents: number;
  monthKey: string; // YYYY-MM, reset automático ao virar o mês
}

const usage = new Map<string, UsageEntry>();

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function exemptUserIds(): Set<string> {
  const raw = process.env.BEE_AI_BUDGET_EXEMPT_USER_IDS ?? "";
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

export function isExempt(userId: string): boolean {
  return exemptUserIds().has(userId);
}

function budgetCents(): number {
  const usd = parseFloat(process.env.BEE_AI_MONTHLY_BUDGET_USD ?? "5");
  if (!Number.isFinite(usd) || usd <= 0) return 500; // fallback $5
  return Math.floor(usd * 100);
}

export interface BudgetCheckResult {
  allowed: boolean;
  spentCents: number;
  budgetCents: number;
  /** Quando expirar (epoch ms) — fim do mês UTC corrente. */
  resetAt: number;
}

export function checkBudget(userId: string): BudgetCheckResult {
  if (isExempt(userId)) {
    return { allowed: true, spentCents: 0, budgetCents: Number.MAX_SAFE_INTEGER, resetAt: 0 };
  }
  const now = new Date();
  const monthKey = currentMonthKey();
  const entry = usage.get(userId);

  // Auto-reset se virou o mês
  const spent = entry && entry.monthKey === monthKey ? entry.cents : 0;
  const budget = budgetCents();

  // Calcula fim do mês UTC
  const endOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0);

  return {
    allowed: spent < budget,
    spentCents: spent,
    budgetCents: budget,
    resetAt: endOfMonth,
  };
}

/** Registra gasto após uma chamada de IA bem-sucedida. */
export function recordCost(userId: string, inputTokens: number, outputTokens: number): void {
  if (isExempt(userId)) return;
  const monthKey = currentMonthKey();
  const cents = estimateCostCents(inputTokens, outputTokens);
  const entry = usage.get(userId);
  if (!entry || entry.monthKey !== monthKey) {
    usage.set(userId, { cents, monthKey });
  } else {
    entry.cents += cents;
  }
}

/** Para testes — limpa todo o tracking em memória. */
export function resetBudgetStoreForTests(): void {
  usage.clear();
}
