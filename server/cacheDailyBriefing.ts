/**
 * Cache em memória do briefing diário por (userId, dia). Evita chamar a IA
 * múltiplas vezes no mesmo dia se o usuário ainda não dismissou — F5 / abrir
 * o app várias vezes não deve custar N chamadas de IA.
 *
 * Reset automático ao virar o dia (chave inclui YYYY-MM-DD).
 *
 * Para multi-instance, migrar para Redis. Single-process atual basta.
 */

interface CachedBriefing {
  text: string;
  city: string | null;
  weather: unknown;
  date: string;
  dayOfWeek: string;
}

const cache = new Map<string, CachedBriefing>();

function key(userId: string, dateStr: string): string {
  return `${userId}:${dateStr}`;
}

export function getCachedBriefing(userId: string, dateStr: string): CachedBriefing | null {
  return cache.get(key(userId, dateStr)) ?? null;
}

export function setCachedBriefing(userId: string, dateStr: string, briefing: CachedBriefing): void {
  cache.set(key(userId, dateStr), briefing);
}

export function clearCachedBriefing(userId: string, dateStr: string): void {
  cache.delete(key(userId, dateStr));
}

/** Limpa todas as entradas que não sejam do dia atual. Cron pode chamar. */
export function pruneOldBriefings(currentDateStr: string): number {
  let removed = 0;
  for (const [k] of cache) {
    if (!k.endsWith(`:${currentDateStr}`)) {
      cache.delete(k);
      removed += 1;
    }
  }
  return removed;
}

export function resetBriefingCacheForTests(): void {
  cache.clear();
}
