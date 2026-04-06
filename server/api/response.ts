import type { Response } from "express";
function buildMeta(res: Response, extra?: Record<string, unknown>) {
  return {
    requestId: res.getHeader("x-request-id")?.toString() || "unknown",
    ...extra,
  };
}

export function sendOk<T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200) {
  if (meta) {
    res.setHeader("x-response-meta", JSON.stringify(buildMeta(res, meta)));
  }
  return res.status(status).json(data);
}

export function sendCreated<T>(res: Response, data: T, meta?: Record<string, unknown>) {
  return sendOk(res, data, meta, 201);
}

export function sendNoContent(res: Response, meta?: Record<string, unknown>) {
  return sendOk(res, { ok: true }, meta, 200);
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const requestId = res.getHeader("x-request-id")?.toString() || "unknown";
  return res.status(status).json({
    ok: false,
    code,
    message,
    requestId,
    error: {
      code,
      message,
      details,
      requestId,
    },
  });
}
