interface RequestMetricEntry {
  count: number;
  totalDurationMs: number;
}

const startedAt = new Date().toISOString();
const routeMetrics = new Map<string, RequestMetricEntry>();
let activeRequests = 0;
let totalRequests = 0;

export function trackRequestStart() {
  activeRequests += 1;
  totalRequests += 1;
}

export function trackRequestEnd(routeKey: string, durationMs: number) {
  activeRequests = Math.max(0, activeRequests - 1);
  const current = routeMetrics.get(routeKey) ?? { count: 0, totalDurationMs: 0 };
  current.count += 1;
  current.totalDurationMs += durationMs;
  routeMetrics.set(routeKey, current);
}

export function getMetricsSnapshot() {
  return {
    startedAt,
    totalRequests,
    activeRequests,
    routes: Array.from(routeMetrics.entries()).map(([route, entry]) => ({
      route,
      count: entry.count,
      avgDurationMs: Number((entry.totalDurationMs / entry.count).toFixed(2)),
    })),
  };
}
