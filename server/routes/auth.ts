import crypto from "node:crypto";
import { Router } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { asyncHandler } from "../api/async-handler";
import { badRequest, conflict, notFound, unauthorized, validationError } from "../api/errors";
import { sendCreated, sendOk } from "../api/response";
import { hashPassword, signToken, verifyPassword } from "../auth";
import { clearAuthCookie, setAuthCookie } from "../authCookie";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import {
  loginRateLimit,
  registerRateLimit,
  passwordResetIpRateLimit,
  socialRateLimit,
  checkEmailLimit,
} from "../middleware/rateLimitAuth";
import { storage } from "../storage";
import { insertUserSchema, passwordResetTokens, users } from "../../shared/schema";

// Hash dummy fixo para mitigar timing attack em /login quando username não existe.
// Computado uma vez no startup: bcrypt de string aleatória qualquer.
const DUMMY_PASSWORD_HASH = "$2a$12$0123456789012345678901uPlaceholderHashForTiming.0000000000";

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

async function sendPasswordResetEmail(to: string, link: string, logger: any) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM ?? "BeeEyes <no-reply@beeeyes.net>";

  if (!resendKey) {
    // Em dev, log do link é útil. Em produção, não logamos o link (PII + segurança).
    if (process.env.NODE_ENV === "production") {
      logger?.warn?.("password_reset.email_skipped_no_resend_key", { to });
    } else {
      console.info("password_reset.link (dev only)", { to, link });
    }
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: "Recuperação de senha BeeEyes",
      html: `<p>Recebemos uma solicitação para redefinir sua senha.</p><p><a href="${link}">Clique aqui para criar uma nova senha</a>.</p><p>O link expira em 1 hora.</p>`,
      text: `Use este link para redefinir sua senha BeeEyes: ${link}\n\nO link expira em 1 hora.`,
    }),
  }).catch((err) => {
    // Falha silenciosa: nunca logar o link em produção, apenas o erro
    logger?.error?.("password_reset.email_send_failed", {
      to,
      message: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * Verifica o token do Google contra o endpoint público tokeninfo, validando audience.
 * Aceita id_token (preferível) ou access_token (compatibilidade).
 *
 * Por que tokeninfo e não a userinfo? userinfo só prova que o token é válido em ALGUM
 * app Google. tokeninfo retorna `aud` (audience/client_id) — assim podemos garantir
 * que o token foi emitido para o NOSSO app.
 */
async function verifyGoogleToken(payload: {
  accessToken?: string;
  idToken?: string;
}): Promise<{ sub: string; name?: string; email?: string; picture?: string }> {
  const allowedAudiences = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ].filter(Boolean) as string[];

  // 1) Preferir id_token quando disponível (mais seguro: assinado pela Google)
  if (payload.idToken) {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(payload.idToken)}`;
    const res = await fetch(url);
    if (!res.ok) throw unauthorized("Token do Google inválido");
    const info: any = await res.json();
    if (!info?.sub) throw unauthorized("Token do Google inválido");
    if (allowedAudiences.length > 0 && !allowedAudiences.includes(info.aud)) {
      throw unauthorized("Token do Google emitido para outro aplicativo");
    }
    return { sub: info.sub, name: info.name, email: info.email, picture: info.picture };
  }

  // 2) Fallback para access_token (compat com clientes legados)
  if (payload.accessToken) {
    // Valida que o access_token foi emitido para o nosso app
    const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(payload.accessToken)}`;
    const ti = await fetch(tokenInfoUrl);
    if (!ti.ok) throw unauthorized("Token do Google inválido");
    const tokenInfo: any = await ti.json();
    if (allowedAudiences.length > 0 && tokenInfo.aud && !allowedAudiences.includes(tokenInfo.aud)) {
      throw unauthorized("Token do Google emitido para outro aplicativo");
    }
    // Busca userinfo para obter dados de perfil
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${payload.accessToken}` },
    });
    if (!userInfoRes.ok) throw unauthorized("Token do Google inválido");
    const userInfo: any = await userInfoRes.json();
    if (!userInfo?.sub) throw unauthorized("Token do Google inválido");
    return { sub: userInfo.sub, name: userInfo.name, email: userInfo.email, picture: userInfo.picture };
  }

  throw unauthorized("Token do Google inválido");
}

export function createAuthRouter() {
  const router = Router();

  router.post("/api/auth/register", registerRateLimit, asyncHandler(async (req, res) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError("Dados inválidos", parsed.error.issues);
    }

    const email = normalizeEmail(parsed.data.email);
    const existing = await storage.getUserByUsername(parsed.data.username);
    if (!email) throw badRequest("E-mail é obrigatório para cadastro com senha");
    if (existing) {
      throw conflict("Nome de usuário já existe");
    }
    if (email) {
      const [existingEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existingEmail) throw conflict("E-mail já cadastrado");
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

    // Medalha early_adopter para todo novo usuário
    storage.ensureAchievement(user.id, {
      type: "early_adopter",
      title: "Pioneiro BeeEyes",
      description: "Faz parte da geração fundadora do app. Obrigado por estar aqui desde o início.",
    }).catch(() => {});

    const jwt = signToken(user.id);
    setAuthCookie(res, jwt);
    return sendCreated(res, {
      token: jwt,
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
        allowMessagesFromStrangers: user.allowMessagesFromStrangers,
        currentStreak: user.currentStreak,
      },
    });
  }));

  router.post("/api/auth/social", socialRateLimit, asyncHandler(async (req, res) => {
    const { provider, accessToken, idToken } = req.body ?? {};
    if (provider !== "google" || (!accessToken && !idToken)) {
      throw badRequest("Provider não suportado");
    }

    const googleUser = await verifyGoogleToken({ accessToken, idToken });

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

    const jwt = signToken(user.id);
    setAuthCookie(res, jwt);
    return sendOk(res, {
      token: jwt,
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
        allowMessagesFromStrangers: user.allowMessagesFromStrangers,
        currentStreak: user.currentStreak,
      },
    });
  }));

  router.post("/api/auth/login", loginRateLimit, asyncHandler(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      throw badRequest("Usuário e senha são obrigatórios");
    }

    const login = String(username).trim();
    const user = login.includes("@")
      ? (await db.select().from(users).where(eq(users.email, login.toLowerCase())).limit(1))[0]
      : await storage.getUserByUsername(login);

    // Timing attack mitigation: sempre executar verifyPassword, mesmo quando user não existe.
    // bcrypt.compare em hash dummy mantém o tempo de resposta similar ao caso "user existe + senha errada".
    if (!user) {
      await verifyPassword(String(password), DUMMY_PASSWORD_HASH).catch(() => false);
      req.logger.warn("auth.login.failed", { reason: "no_user" });
      throw unauthorized("Usuário ou senha incorretos");
    }
    if (!(await verifyPassword(password, user.password))) {
      req.logger.warn("auth.login.failed", { userId: user.id, reason: "bad_password" });
      throw unauthorized("Usuário ou senha incorretos");
    }

    req.logger.info("auth.login.success", { userId: user.id, username: user.username });

    const jwt = signToken(user.id);
    setAuthCookie(res, jwt);
    return sendOk(res, {
      token: jwt,
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
        allowMessagesFromStrangers: user.allowMessagesFromStrangers,
        currentStreak: user.currentStreak,
      },
    });
  }));

  router.post("/api/auth/password-reset/request", passwordResetIpRateLimit, asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) throw badRequest("Informe o e-mail cadastrado");

    // Rate limit por e-mail também (não só por IP). Não revelar se o e-mail existe.
    const allowedByEmail = checkEmailLimit(email);

    if (allowedByEmail) {
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        await db.insert(passwordResetTokens).values({
          userId: user.id,
          tokenHash: hashResetToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });
        await sendPasswordResetEmail(email, resetPasswordUrl(req, token), req.logger);
      } else {
        // Dummy work para tempo de resposta consistente
        await new Promise((resolve) => setTimeout(resolve, 50 + Math.floor(Math.random() * 30)));
      }
    }

    // Sempre retorna a mesma mensagem, qualquer que seja o caso
    return sendOk(res, { ok: true, message: "Se o e-mail existir, enviaremos um link de recuperação." });
  }));

  /**
   * POST /api/auth/logout — limpa o cookie httpOnly de sessão.
   * Não requer auth (logout deve funcionar mesmo com token expirado).
   * Mobile com Bearer continua descartando o token localmente.
   */
  router.post("/api/auth/logout", asyncHandler(async (_req, res) => {
    clearAuthCookie(res);
    return sendOk(res, { ok: true });
  }));

  router.post("/api/auth/password-reset/confirm", asyncHandler(async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!token || !password) throw badRequest("Token e nova senha sao obrigatorios");
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      throw badRequest("A nova senha precisa ter ao menos 8 caracteres, uma letra e um número");
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

    if (!row) throw badRequest("Link inválido ou expirado");

    await storage.updateUserPassword(row.userId, await hashPassword(password));
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
    return sendOk(res, { ok: true });
  }));

  router.get("/api/me", requireAuth, asyncHandler(async (req, res) => {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      throw notFound("Usuário não encontrado");
    }

    return sendOk(res, sanitizeUser(user));
  }));

  /**
   * DELETE /api/me — exclusão de conta (LGPD direito ao esquecimento).
   * Exige senha atual no body para evitar exclusão acidental ou por roubo de token.
   * Cascade no schema apaga: posts, comments, DMs, communities (que ele é dono), conexões,
   * memórias, preferências, alarmes, eventos, finanças, notas, wishlist, achievements, etc.
   */
  router.delete("/api/me", requireAuth, asyncHandler(async (req, res) => {
    const { password } = req.body ?? {};
    const user = await storage.getUser(req.userId!);
    if (!user) throw notFound("Usuário não encontrado");

    // Confirma senha somente se conta tem senha (contas Google-only podem não ter senha real)
    if (user.password && typeof password === "string" && password.length > 0) {
      if (!(await verifyPassword(password, user.password))) {
        throw unauthorized("Senha incorreta");
      }
    } else if (user.password) {
      throw badRequest("Confirme sua senha para excluir a conta");
    }

    req.logger.warn("user.account.deletion_requested", { userId: user.id });
    await storage.hardDeleteUser(req.userId!);
    return sendOk(res, { deleted: true });
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
    const { anonymousProfileVisitsEnabled, allowMessagesFromStrangers, displayName, bio, language, onboardingCompleted } = req.body ?? {};

    if (anonymousProfileVisitsEnabled !== undefined && typeof anonymousProfileVisitsEnabled !== "boolean") {
      throw validationError("Preferências inválidas", [
        {
          path: ["anonymousProfileVisitsEnabled"],
          message: "Envie um valor booleano",
          code: "invalid_type",
        },
      ]);
    }

    if (allowMessagesFromStrangers !== undefined && typeof allowMessagesFromStrangers !== "boolean") {
      throw validationError("Preferências inválidas", [
        {
          path: ["allowMessagesFromStrangers"],
          message: "Envie um valor booleano",
          code: "invalid_type",
        },
      ]);
    }

    const user = await storage.getUser(req.userId!);
    if (!user) {
      throw notFound("Usuário não encontrado");
    }

    if (language !== undefined && !["pt-BR", "en", "es"].includes(String(language))) {
      throw badRequest("Idioma não suportado");
    }

    const updatedUser = await storage.updateUserPreferences(req.userId!, {
      anonymousProfileVisitsEnabled,
      allowMessagesFromStrangers,
      displayName: displayName !== undefined ? String(displayName).trim().slice(0, 80) || null : undefined,
      bio: bio !== undefined ? String(bio).trim().slice(0, 300) || null : undefined,
      language: language !== undefined ? String(language) : undefined,
      onboardingCompleted: onboardingCompleted !== undefined ? Boolean(onboardingCompleted) : undefined,
    });

    req.logger.info("user.preferences.updated", {
      userId: updatedUser.id,
      anonymousProfileVisitsEnabled: updatedUser.anonymousProfileVisitsEnabled,
      allowMessagesFromStrangers: updatedUser.allowMessagesFromStrangers,
    });

    return sendOk(res, sanitizeUser(updatedUser));
  }));

  router.patch("/api/me/password", requireAuth, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      throw badRequest("Senha atual e nova senha sao obrigatorias");
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw badRequest("A nova senha precisa ter ao menos 8 caracteres, uma letra e um número");
    }

    const user = await storage.getUser(req.userId!);
    if (!user) throw notFound("Usuário não encontrado");
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

    await Promise.allSettled([
      ...onboardingFacts.map((fact) =>
        storage.upsertUserMemory({
          userId: req.userId!,
          memoryType: fact.startsWith("Objetivos") ? "goal" : "profile",
          title: fact.split(":")[0].slice(0, 80),
          content: fact,
          source: "onboarding",
          importance: fact.startsWith("Objetivos") || fact.startsWith("Rotina") ? 5 : 4,
          active: true,
        }),
      ),
      ...interests.map((interest) =>
        storage.upsertUserPreference({
          userId: req.userId!,
          category: "interesse",
          preference: interest,
          weight: 4,
          source: "onboarding",
          active: true,
        }),
      ),
      storage.upsertBeeConversationContext({
        userId: req.userId!,
        contextSummary: `Onboarding concluido. Objetivos: ${rawObjectives.join(", ")}. Rotina: ${routine}`,
        recentTopics: interests.slice(0, 8),
        emotionalTone: "neutral",
        activeGoals: rawObjectives,
        personalizationEnabled: true,
      }),
    ]);

    const updated = await storage.updateUserPreferences(req.userId!, { onboardingCompleted: true });
    return sendOk(res, sanitizeUser(updated));
  }));

  return router;
}
