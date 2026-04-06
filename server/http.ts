interface ParseBoundedIntOptions {
  fallback: number;
  min: number;
  max: number;
}

export function parseBoundedInt(
  value: unknown,
  { fallback, min, max }: ParseBoundedIntOptions,
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(raw ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}
