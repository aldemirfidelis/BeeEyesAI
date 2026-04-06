import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { createLogger } from "./logger";
import { trackRequestEnd, trackRequestStart } from "./metrics";
import { recordRequestTrace } from "./tracing";

function getRouteKey(req: Request) {
  const routePath = req.route?.path;
  if (typeof routePath === "string") {
    return `${req.method} ${routePath}`;
  }

  return `${req.method} ${req.path}`;
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header("x-request-id")?.trim() || crypto.randomUUID();
  const startedAt = Date.now();

  req.requestId = requestId;
  req.logger = createLogger({ requestId });
  res.setHeader("x-request-id", requestId);

  trackRequestStart();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const routeKey = getRouteKey(req);
    trackRequestEnd(`${routeKey} ${res.statusCode}`, durationMs);

    req.logger.info("http.request.completed", {
      method: req.method,
      path: req.path,
      route: req.route?.path,
      statusCode: res.statusCode,
      durationMs,
      userId: req.userId ?? null,
    });

    recordRequestTrace({
      traceId: requestId,
      requestId,
      method: req.method,
      path: req.path,
      route: typeof req.route?.path === "string" ? req.route.path : undefined,
      statusCode: res.statusCode,
      durationMs,
      userId: req.userId ?? null,
      timestamp: new Date().toISOString(),
    });
  });

  next();
}
