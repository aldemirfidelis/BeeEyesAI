import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { join } from "path";
import { ApiError } from "./api/errors";
import { sendError } from "./api/response";
import { ensureDatabaseCompatibility } from "./db";
import { requestContextMiddleware } from "./observability/request-context";
import { registerRoutes } from "./routes/index";
import { applySecurityHeaders } from "./security";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.disable("x-powered-by");

// CORS — permite requisições do app mobile (React Native não aplica CORS,
// mas browsers e WebViews sim; header explícito evita bloqueios)
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

app.use(applySecurityHeaders);
app.use(requestContextMiddleware);
app.use("/uploads", express.static(join(process.cwd(), "uploads"), { maxAge: "30d" }));
// Suporta imagens base64 de perfil, feed e comunidades, incluindo fallback sem compressão.
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: false, limit: "25mb" }));

(async () => {
  await ensureDatabaseCompatibility();
  const server = await registerRoutes(app);

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiError) {
      req.logger.warn("http.request.failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return sendError(res, error.status, error.code, error.message, error.details);
    }

    req.logger.error("http.request.crashed", {
      message: error instanceof Error ? error.message : "Erro interno do servidor",
      stack: app.get("env") === "development" && error instanceof Error ? error.stack : undefined,
    });

    return sendError(res, 500, "INTERNAL_ERROR", "Erro interno do servidor");
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const listenOptions: { port: number; host: string; reusePort?: boolean } = {
    port,
    host: "0.0.0.0",
  };

  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})();
