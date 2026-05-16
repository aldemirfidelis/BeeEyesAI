import { Router } from "express";
import { sendOk } from "../api/response";
import { exportMetricsAsPrometheus, getMetricsSnapshot } from "../observability/metrics";
import { readRecentTraces } from "../observability/tracing";
import { pool } from "../db";

export function createSystemRouter() {
  const router = Router();

  router.get("/api/system/health", (_req, res) => {
    return sendOk(res, {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      now: new Date().toISOString(),
    });
  });

  // Endpoint público para warmup. Faz SELECT 1 para acordar o compute do Neon
  // quando ele estiver auto-suspenso. Use com UptimeRobot (intervalo 4 min)
  // para eliminar o cold start visível ao primeiro request real do dia.
  router.get("/api/healthz", async (_req, res) => {
    const startedAt = Date.now();
    try {
      await pool.query("SELECT 1");
      return res.status(200).json({
        status: "ok",
        db: "ok",
        dbLatencyMs: Date.now() - startedAt,
        now: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(503).json({
        status: "degraded",
        db: "fail",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.get("/api/system/metrics", (_req, res) => {
    return sendOk(res, getMetricsSnapshot());
  });

  router.get("/api/system/metrics/export", (_req, res) => {
    res.setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
    return res.status(200).send(exportMetricsAsPrometheus());
  });

  router.get("/api/system/traces", async (req, res) => {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    return sendOk(res, await readRecentTraces(limit));
  });

  return router;
}
