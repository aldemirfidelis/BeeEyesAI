// ── Per-user in-memory rate limiter ──────────────────────────────────────────
// Limits chat messages to MAX_PER_HOUR per user per rolling hour window.

const MAX_PER_HOUR = 60;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Clean up expired entries every 10 minutes to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000);

export function checkRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
} {
  const now = Date.now();
  let entry = store.get(userId);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(userId, entry);
    return { allowed: true, remaining: MAX_PER_HOUR - 1, resetInMs: WINDOW_MS };
  }

  if (entry.count >= MAX_PER_HOUR) {
    return { allowed: false, remaining: 0, resetInMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_PER_HOUR - entry.count, resetInMs: entry.resetAt - now };
}
