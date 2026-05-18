import type { NextFunction, Request, Response } from "express";

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  // PWA usa camera (compositor de posts), geolocation (clima), haptics
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)");

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "img-src 'self' data: blob: https:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        // 'wasm-unsafe-eval' eh requerido pro canvaskit.wasm (Skia) carregar.
        // 'unsafe-eval' tambem necessario pra Reanimated/Hermes em alguns paths.
        "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' https://accounts.google.com/gsi/client",
        // worker-src + child-src pro service worker funcionar
        "worker-src 'self' blob:",
        "connect-src 'self' https: wss: blob:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "media-src 'self' blob: data:",
        "frame-src https://accounts.google.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "manifest-src 'self'",
      ].join("; "),
    );
  }

  next();
}
