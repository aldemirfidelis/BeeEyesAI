import { writeJsonSnapshot } from "./persistence";

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
  writeJsonSnapshot("metrics-latest.json", getMetricsSnapshot());
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

export function exportMetricsAsPrometheus() {
  const snapshot = getMetricsSnapshot();
  const lines = [
    "# HELP beeyes_requests_total Total HTTP requests processed",
    "# TYPE beeyes_requests_total counter",
    `beeyes_requests_total ${snapshot.totalRequests}`,
    "# HELP beeyes_requests_active Active in-flight HTTP requests",
    "# TYPE beeyes_requests_active gauge",
    `beeyes_requests_active ${snapshot.activeRequests}`,
  ];

  for (const route of snapshot.routes) {
    const normalizedRoute = route.route.replace(/"/g, '\\"');
    lines.push(`beeyes_route_requests_total{route="${normalizedRoute}"} ${route.count}`);
    lines.push(`beeyes_route_avg_duration_ms{route="${normalizedRoute}"} ${route.avgDurationMs}`);
  }

  return `${lines.join("\n")}\n`;
}
