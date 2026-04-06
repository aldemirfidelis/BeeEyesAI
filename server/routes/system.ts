import { Router } from "express";
import { sendOk } from "../api/response";
import { exportMetricsAsPrometheus, getMetricsSnapshot } from "../observability/metrics";
import { readRecentTraces } from "../observability/tracing";

export function createSystemRouter() {
  const router = Router();

  router.get("/api/system/health", (_req, res) => {
    return sendOk(res, {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      now: new Date().toISOString(),
    });
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
