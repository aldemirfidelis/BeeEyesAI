import crypto from "node:crypto";
import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { badRequest, conflict, forbidden, notFound, unauthorized, validationError } from "../api/errors";
import { sendCreated, sendOk } from "../api/response";
import { hashPassword, signToken, verifyPassword } from "../auth";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";
import { insertUserSchema } from "../../shared/schema";
import { hasAnonymousProfileVisitsUnlocked } from "../../shared/unlocks";

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

    // Medalha early_adopter para todo novo usuário
    storage.ensureAchievement(user.id, {
      type: "early_adopter",
      title: "Pioneiro BeeEyes",
      description: "Faz parte da geração fundadora do app. Obrigado por estar aqui desde o início.",
    }).catch(() => {});

    return sendCreated(res, {
      token: signToken(user.id),
      user: {
        id: user.id,
        username: user.username,
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
        bio: user.bio,
        language: user.language,
        onboardingCompleted: user.onboardingCompleted,
        anonymousProfileVisitsEnabled: user.anonymousProfileVisitsEnabled,
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

  router.patch("/api/me/avatar", requireAuth, asyncHandler(async (req, res) => {
    const { avatarUrl } = req.body ?? {};
    const value = typeof avatarUrl === "string" && avatarUrl.startsWith("data:image/") ? avatarUrl : null;
    const user = await storage.getUser(req.userId!);
    if (!user) throw notFound("Usuário não encontrado");
    await storage.updateUserAvatar(req.userId!, value);
    return sendOk(res, { avatarUrl: value });
  }));

  router.patch("/api/me/preferences", requireAuth, asyncHandler(async (req, res) => {
    const { anonymousProfileVisitsEnabled, displayName, bio, language, onboardingCompleted } = req.body ?? {};

    if (anonymousProfileVisitsEnabled !== undefined && typeof anonymousProfileVisitsEnabled !== "boolean") {
      throw validationError("PreferÃªncias invÃ¡lidas", [
        {
          path: ["anonymousProfileVisitsEnabled"],
          message: "Envie um valor booleano",
          code: "invalid_type",
        },
      ]);
    }

    const user = await storage.getUser(req.userId!);
    if (!user) {
      throw notFound("UsuÃ¡rio nÃ£o encontrado");
    }

    if (anonymousProfileVisitsEnabled === true && !hasAnonymousProfileVisitsUnlocked(user)) {
      throw forbidden("NavegaÃ§Ã£o anÃ´nima desbloqueia no nÃ­vel 3 com XP de missÃµes");
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
      `Objetivos principais do usuário: ${rawObjectives.join(", ")}`,
      ...(workProfile ? [`Perfil profissional: ${workProfile}`] : []),
      ...(activePeriod.length > 0 ? [`Período mais ativo do dia: ${activePeriod.join(", ")}`] : []),
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
            !f.startsWith("Período mais ativo") &&
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


