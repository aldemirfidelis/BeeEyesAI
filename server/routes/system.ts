import { Router } from "express";
import { sendOk } from "../api/response";
import { getMetricsSnapshot } from "../observability/metrics";

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

  return router;
}
