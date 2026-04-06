import type { NextFunction, Request, Response } from "express";

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: wss:; font-src 'self' data: https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
  }

  next();
}
