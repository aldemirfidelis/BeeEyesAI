// ── In-memory rate limiter ───────────────────────────────────────────────────
// Mantém duas APIs:
//   - checkRateLimit(userId): limit padrão de chat (60/h por usuário). Legacy.
//   - checkLimit(key, opts): API genérica usada para rotas de autenticação por IP.
//
// Em produção multi-instância, migrar para Redis. O limite em memória só
// funciona corretamente em single-instance/single-process (que é o nosso caso
// atual: 1 droplet, 1 container Express).

interface Entry {
  count: number;
  resetAt: number;
}

interface LimitOptions {
  /** Quantidade máxima dentro do windowMs */
  max: number;
  /** Janela em milissegundos */
  windowMs: number;
}

interface LimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

const CHAT_MAX_PER_HOUR = 60;
const CHAT_WINDOW_MS = 60 * 60 * 1000; // 1h

const store = new Map<string, Entry>();

// Limpeza periódica para evitar memory leak
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000);

cleanupTimer.unref?.();

function consume(key: string, max: number, windowMs: number): LimitResult {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true, remaining: max - 1, resetInMs: windowMs };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetInMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: max - entry.count, resetInMs: entry.resetAt - now };
}

/** Rate limit padrão de chat: 60 mensagens/hora por usuário. */
export function checkRateLimit(userId: string): LimitResult {
  return consume(`chat:${userId}`, CHAT_MAX_PER_HOUR, CHAT_WINDOW_MS);
}

/** API genérica para uso em rotas de auth, reset, etc. Chave deve ser única (ex: `login:${ip}`). */
export function checkLimit(key: string, opts: LimitOptions): LimitResult {
  return consume(key, opts.max, opts.windowMs);
}

export function resetRateLimitStoreForTests() {
  store.clear();
}
