import crypto from "node:crypto";
import { Router } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { asyncHandler } from "../api/async-handler";
import { badRequest, conflict, notFound, unauthorized, validationError } from "../api/errors";
import { sendCreated, sendOk } from "../api/response";
import { hashPassword, signToken, verifyPassword } from "../auth";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";
import { insertUserSchema, passwordResetTokens, users } from "../../shared/schema";

function sanitizeUser(user: NonNullable<Awaited<ReturnType<typeof storage.getUser>>>) {
  if (!user) return null;
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function resetPasswordUrl(req: any, token: string) {
  const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
  const host = req.headers["x-forwarded-host"] ?? req.get("host");
  return `${proto}://${host}/reset-password?token=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail(to: string, link: string) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM ?? "BeeEyes <no-reply@beeeyes.net>";

  if (!resendKey) {
    console.info("password_reset.link", { to, link });
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: "Recuperacao de senha BeeEyes",
      html: `<p>Recebemos uma solicitacao para redefinir sua senha.</p><p><a href="${link}">Clique aqui para criar uma nova senha</a>.</p><p>O link expira em 1 hora.</p>`,
      text: `Use este link para redefinir sua senha BeeEyes: ${link}\n\nO link expira em 1 hora.`,
    }),
  }).catch(() => {
    console.info("password_reset.link", { to, link });
  });
}

export function createAuthRouter() {
  const router = Router();

  router.post("/api/auth/register", asyncHandler(async (req, res) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError("Dados invÃ¡lidos", parsed.error.issues);
    }

    const email = normalizeEmail(parsed.data.email);
    const existing = await storage.getUserByUsername(parsed.data.username);
    if (!email) throw badRequest("E-mail e obrigatorio para cadastro com senha");
    if (existing) {
      throw conflict("Nome de usuÃ¡rio jÃ¡ existe");
    }
    if (email) {
      const [existingEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existingEmail) throw conflict("E-mail ja cadastrado");
    }

    const { displayName, gender } = req.body as { displayName?: string; gender?: string };
    const user = await storage.createUser({
      ...parsed.data,
      email: email || undefined,
      password: await hashPassword(parsed.data.password),
      displayName: displayName?.trim() || undefined,
      gender: gender || undefined,
    });

    req.logger.info("auth.register.success", { userId: user.id, username: user.username });

    // Medalha early_adopter para todo novo usuÃ¡rio
    storage.ensureAchievement(user.id, {
      type: "early_adopter",
      title: "Pioneiro BeeEyes",
      description: "Faz parte da geraÃ§Ã£o fundadora do app. Obrigado por estar aqui desde o inÃ­cio.",
    }).catch(() => {});

    return sendCreated(res, {
      token: signToken(user.id),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        displayName: user.displayName,
        gender: user.gender,
        level: user.level,
        xp: user.xp,
        bio: user.bio,
        language: user.language,
        onboardingCompleted: user.onboardingCompleted,
        anonymousProfileVisitsEnabled: user.anonymousProfileVisitsEnabled,
        currentStreak: user.currentStreak,
      },
    });
  }));

  router.post("/api/auth/social", asyncHandler(async (req, res) => {
    const { provider, accessToken } = req.body ?? {};
    if (provider !== "google" || !accessToken) {
      throw badRequest("Provider nÃ£o suportado");
    }

    let googleUser: { sub: string; name?: string; email?: string; picture?: string } | null = null;
    try {
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      googleUser = await response.json();
    } catch {
      throw unauthorized("Token do Google invÃ¡lido");
    }

    if (!googleUser?.sub) {
      throw unauthorized("Token do Google invÃ¡lido");
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
        email: normalizeEmail(googleUser.email) || undefined,
        password: await hashPassword(crypto.randomUUID()),
        googleId: googleUser.sub,
        displayName: googleUser.name,
        avatarUrl: googleUser.picture ?? null,
      });
    }

    req.logger.info("auth.social.success", { provider, userId: user.id });

    return sendOk(res, {
      token: signToken(user.id),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        displayName: user.displayName,
        gender: user.gender,
        level: user.level,
        xp: user.xp,
        bio: user.bio,
        language: user.language,
        onboardingCompleted: user.onboardingCompleted,
        anonymousProfileVisitsEnabled: user.anonymousProfileVisitsEnabled,
        currentStreak: user.currentStreak,
      },
    });
  }));

  router.post("/api/auth/login", asyncHandler(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      throw badRequest("UsuÃ¡rio e senha sÃ£o obrigatÃ³rios");
    }

    const login = String(username).trim();
    const user = login.includes("@")
      ? (await db.select().from(users).where(eq(users.email, login.toLowerCase())).limit(1))[0]
      : await storage.getUserByUsername(login);
    if (!user || !(await verifyPassword(password, user.password))) {
      req.logger.warn("auth.login.failed", { username });
      throw unauthorized("UsuÃ¡rio ou senha incorretos");
    }

    req.logger.info("auth.login.success", { userId: user.id, username: user.username });

    return sendOk(res, {
      token: signToken(user.id),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        displayName: user.displayName,
        gender: user.gender,
        level: user.level,
        xp: user.xp,
        bio: user.bio,
        language: user.language,
        onboardingCompleted: user.onboardingCompleted,
        anonymousProfileVisitsEnabled: user.anonymousProfileVisitsEnabled,
        currentStreak: user.currentStreak,
      },
    });
  }));

  router.post("/api/auth/password-reset/request", asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) throw badRequest("Informe o e-mail cadastrado");

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      await sendPasswordResetEmail(email, resetPasswordUrl(req, token));
    }

    return sendOk(res, { ok: true, message: "Se o e-mail existir, enviaremos um link de recuperacao." });
  }));

  router.post("/api/auth/password-reset/confirm", asyncHandler(async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!token || !password) throw badRequest("Token e nova senha sao obrigatorios");
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      throw badRequest("A nova senha precisa ter ao menos 8 caracteres, uma letra e um numero");
    }

    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.tokenHash, hashResetToken(token)),
        gt(passwordResetTokens.expiresAt, new Date()),
        isNull(passwordResetTokens.usedAt),
      ))
      .limit(1);

    if (!row) throw badRequest("Link invalido ou expirado");

    await storage.updateUserPassword(row.userId, await hashPassword(password));
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
    return sendOk(res, { ok: true });
  }));

  router.get("/api/me", requireAuth, asyncHandler(async (req, res) => {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      throw notFound("UsuÃ¡rio nÃ£o encontrado");
    }

    return sendOk(res, sanitizeUser(user));
  }));

  router.patch("/api/me/avatar", requireAuth, asyncHandler(async (req, res) => {
    const { avatarUrl } = req.body ?? {};
    const value = typeof avatarUrl === "string" && avatarUrl.startsWith("data:image/") ? avatarUrl : null;
    const user = await storage.getUser(req.userId!);
    if (!user) throw notFound("UsuÃ¡rio nÃ£o encontrado");
    await storage.updateUserAvatar(req.userId!, value);
    return sendOk(res, { avatarUrl: value });
  }));

  router.patch("/api/me/preferences", requireAuth, asyncHandler(async (req, res) => {
    const { anonymousProfileVisitsEnabled, displayName, bio, language, onboardingCompleted } = req.body ?? {};

    if (anonymousProfileVisitsEnabled !== undefined && typeof anonymousProfileVisitsEnabled !== "boolean") {
      throw validationError("PreferÃƒÂªncias invÃƒÂ¡lidas", [
        {
          path: ["anonymousProfileVisitsEnabled"],
          message: "Envie um valor booleano",
          code: "invalid_type",
        },
      ]);
    }

    const user = await storage.getUser(req.userId!);
    if (!user) {
      throw notFound("UsuÃƒÂ¡rio nÃƒÂ£o encontrado");
    }

    if (language !== undefined && !["pt-BR", "en", "es"].includes(String(language))) {
      throw badRequest("Idioma nao suportado");
    }

    const updatedUser = await storage.updateUserPreferences(req.userId!, {
      anonymousProfileVisitsEnabled,
      displayName: displayName !== undefined ? String(displayName).trim().slice(0, 80) || null : undefined,
      bio: bio !== undefined ? String(bio).trim().slice(0, 300) || null : undefined,
      language: language !== undefined ? String(language) : undefined,
      onboardingCompleted: onboardingCompleted !== undefined ? Boolean(onboardingCompleted) : undefined,
    });

    req.logger.info("user.preferences.updated", {
      userId: updatedUser.id,
      anonymousProfileVisitsEnabled: updatedUser.anonymousProfileVisitsEnabled,
    });

    return sendOk(res, sanitizeUser(updatedUser));
  }));

  router.patch("/api/me/password", requireAuth, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      throw badRequest("Senha atual e nova senha sao obrigatorias");
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw badRequest("A nova senha precisa ter ao menos 8 caracteres, uma letra e um numero");
    }

    const user = await storage.getUser(req.userId!);
    if (!user) throw notFound("Usuario nao encontrado");
    if (!(await verifyPassword(currentPassword, user.password))) {
      throw unauthorized("Senha atual incorreta");
    }

    await storage.updateUserPassword(req.userId!, await hashPassword(newPassword));
    return sendOk(res, { ok: true });
  }));

  router.post("/api/me/onboarding", requireAuth, asyncHandler(async (req, res) => {
    // Accept objectives as array (new) or single string (compat)
    const rawObjectives: string[] = Array.isArray(req.body?.objectives)
      ? req.body.objectives.map((o: unknown) => String(o).trim()).filter(Boolean).slice(0, 5)
      : req.body?.objective
      ? [String(req.body.objective).trim()]
      : [];

    const routine     = String(req.body?.routine     || "").trim().slice(0, 400);
    const workProfile = String(req.body?.workProfile || "").trim().slice(0, 60);
    const activePeriod: string[] = Array.isArray(req.body?.activePeriod)
      ? req.body.activePeriod.map((p: unknown) => String(p).trim()).filter(Boolean)
      : [];

    const interests: string[] = Array.isArray(req.body?.interests)
      ? req.body.interests.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 12)
      : [];

    if (rawObjectives.length === 0 || !routine || interests.length === 0) {
      throw badRequest("Objetivos, rotina e interesses sao obrigatorios");
    }

    // Build fact strings so parseFacts() injects them into the AI system prompt
    const onboardingFacts: string[] = [
      `Objetivos principais do usuÃ¡rio: ${rawObjectives.join(", ")}`,
      ...(workProfile ? [`Perfil profissional: ${workProfile}`] : []),
      ...(activePeriod.length > 0 ? [`PerÃ­odo mais ativo do dia: ${activePeriod.join(", ")}`] : []),
      `Rotina: ${routine}`,
    ];

    const personality = await storage.getPersonality(req.userId!);

    // Preserve existing AI-generated facts, removing old onboarding entries
    let existingFacts: string[] = [];
    try {
      const parsed = JSON.parse(personality?.traits || "[]");
      if (Array.isArray(parsed)) {
        existingFacts = parsed.filter(
          (f: unknown) =>
            typeof f === "string" &&
            !f.startsWith("Objetivos principais") &&
            !f.startsWith("Perfil profissional") &&
            !f.startsWith("PerÃ­odo mais ativo") &&
            !f.startsWith("Rotina:"),
        );
      }
    } catch { /* start fresh */ }

    await storage.upsertPersonality({
      userId: req.userId!,
      traits: JSON.stringify([...onboardingFacts, ...existingFacts]),
      communicationStyle: personality?.communicationStyle ?? "friendly",
      interests: JSON.stringify(interests),
      recentTopics: personality?.recentTopics ?? "[]",
    });

    const updated = await storage.updateUserPreferences(req.userId!, { onboardingCompleted: true });
    return sendOk(res, sanitizeUser(updated));
  }));

  return router;
}
