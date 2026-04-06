import crypto from "node:crypto";
import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { badRequest, conflict, notFound, unauthorized, validationError } from "../api/errors";
import { sendCreated, sendOk } from "../api/response";
import { hashPassword, signToken, verifyPassword } from "../auth";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";
import { insertUserSchema } from "../../shared/schema";

function sanitizeUser(user: NonNullable<Awaited<ReturnType<typeof storage.getUser>>>) {
  if (!user) return null;
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export function createAuthRouter() {
  const router = Router();

  router.post("/api/auth/register", asyncHandler(async (req, res) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError("Dados inválidos", parsed.error.issues);
    }

    const existing = await storage.getUserByUsername(parsed.data.username);
    if (existing) {
      throw conflict("Nome de usuário já existe");
    }

    const { displayName, gender } = req.body as { displayName?: string; gender?: string };
    const user = await storage.createUser({
      ...parsed.data,
      password: await hashPassword(parsed.data.password),
      displayName: displayName?.trim() || undefined,
      gender: gender || undefined,
    });

    req.logger.info("auth.register.success", { userId: user.id, username: user.username });

    return sendCreated(res, {
      token: signToken(user.id),
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        gender: user.gender,
        level: user.level,
        xp: user.xp,
        currentStreak: user.currentStreak,
      },
    });
  }));

  router.post("/api/auth/social", asyncHandler(async (req, res) => {
    const { provider, accessToken } = req.body ?? {};
    if (provider !== "google" || !accessToken) {
      throw badRequest("Provider não suportado");
    }

    let googleUser: { sub: string; name?: string } | null = null;
    try {
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      googleUser = await response.json();
    } catch {
      throw unauthorized("Token do Google inválido");
    }

    if (!googleUser?.sub) {
      throw unauthorized("Token do Google inválido");
    }

    let user = await storage.getUserByGoogleId(googleUser.sub);
    if (!user) {
      const base = (googleUser.name || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 15) || "user";

      let username = base;
      let attempt = 0;
      while (await storage.getUserByUsername(username)) {
        username = `${base}${++attempt}`;
      }

      user = await storage.createUser({
        username,
        password: await hashPassword(crypto.randomUUID()),
        googleId: googleUser.sub,
        displayName: googleUser.name,
      });
    }

    req.logger.info("auth.social.success", { provider, userId: user.id });

    return sendOk(res, {
      token: signToken(user.id),
      user: {
        id: user.id,
        username: user.username,
        level: user.level,
        xp: user.xp,
        currentStreak: user.currentStreak,
      },
    });
  }));

  router.post("/api/auth/login", asyncHandler(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      throw badRequest("Usuário e senha são obrigatórios");
    }

    const user = await storage.getUserByUsername(username);
    if (!user || !(await verifyPassword(password, user.password))) {
      req.logger.warn("auth.login.failed", { username });
      throw unauthorized("Usuário ou senha incorretos");
    }

    req.logger.info("auth.login.success", { userId: user.id, username: user.username });

    return sendOk(res, {
      token: signToken(user.id),
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        gender: user.gender,
        level: user.level,
        xp: user.xp,
        currentStreak: user.currentStreak,
      },
    });
  }));

  router.get("/api/me", requireAuth, asyncHandler(async (req, res) => {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      throw notFound("Usuário não encontrado");
    }

    return sendOk(res, sanitizeUser(user));
  }));

  return router;
}
