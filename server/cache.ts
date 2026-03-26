// ── Simple TTL cache ──────────────────────────────────────────────────────────
// Used to avoid redundant AI calls for personality analysis and memory extraction.

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private store = new Map<string, Entry<T>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs: number, maxSize = 1000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict oldest entry when full
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

// ── Shared cache instances ────────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000;

// Personality analysis: keyed by message content (same msg → same analysis)
export const personalityCache = new TTLCache<Record<string, any>>(2 * HOUR, 2000);

// Memory extraction: keyed by message content
export const memoryCache = new TTLCache<string[]>(2 * HOUR, 2000);
