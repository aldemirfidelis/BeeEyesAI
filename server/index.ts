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
app.set("trust proxy", 1); // confiar no primeiro proxy (Nginx) para req.ip e req.protocol

// CORS — whitelist por env (CORS_ALLOWED_ORIGINS=comma,separated).
// React Native (mobile) não envia Origin nem aplica CORS, então requests sem Origin passam.
// Browsers e WebViews precisam de Origin permitido.
const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);
// Em desenvolvimento, libera localhost por padrão se nada configurado
if (ALLOWED_ORIGINS.size === 0 && process.env.NODE_ENV !== "production") {
  ALLOWED_ORIGINS.add("http://localhost:5000");
  ALLOWED_ORIGINS.add("http://localhost:5173");
  ALLOWED_ORIGINS.add("http://127.0.0.1:5000");
  ALLOWED_ORIGINS.add("http://127.0.0.1:5173");
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) {
    // Sem Origin (mobile React Native, server-to-server, curl) — não enviar header CORS.
    // Express ainda processa normalmente.
  } else if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    // Origin presente mas não permitido — bloqueia
    if (req.method === "OPTIONS") { res.sendStatus(403); return; }
    // GET/POST sem Origin permitido segue, mas sem header CORS o browser bloqueia a leitura.
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
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

  // Vite/client antigo serve a raiz (/) com banner de instalação da PWA.
  // PWA (Expo Web) fica em /pwa via createPwaRouter (montado em registerRoutes).
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
