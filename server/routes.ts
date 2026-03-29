import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { signToken, hashPassword, verifyPassword } from "./auth";
import { requireAuth, type AuthRequest } from "./middleware/requireAuth";
import {
  streamChat, parseAIActions, updatePersonalityFromMessage,
  generateProactiveMessage, generateMissionCelebration,
  analyzePost, buildConnectionSuggestionMessage, generateVisitNotification,
} from "./ai";
import { checkRateLimit } from "./rateLimit";
import { insertUserSchema, insertMissionSchema, insertMoodEntrySchema } from "../shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // ── AUTH ──────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
    }

    const existing = await storage.getUserByUsername(parsed.data.username);
    if (existing) {
      return res.status(409).json({ message: "Nome de usuário já existe" });
    }

    const { displayName, gender } = req.body as { displayName?: string; gender?: string };
    const hashedPassword = await hashPassword(parsed.data.password);
    const user = await storage.createUser({
      ...parsed.data,
      password: hashedPassword,
      displayName: displayName?.trim() || undefined,
      gender: gender || undefined,
    });
    const token = signToken(user.id);

    return res.status(201).json({
      token,
      user: { id: user.id, username: user.username, displayName: user.displayName, gender: user.gender, level: user.level, xp: user.xp, currentStreak: user.currentStreak },
    });
  });

  app.post("/api/auth/social", async (req: Request, res: Response) => {
    const { provider, accessToken } = req.body;

    if (provider === "google") {
      let googleUser: { sub: string; name: string; email: string; picture: string } | null = null;
      try {
        const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        googleUser = await r.json();
      } catch {
        return res.status(401).json({ message: "Token do Google inválido" });
      }

      if (!googleUser?.sub) return res.status(401).json({ message: "Token do Google inválido" });

      let user = await storage.getUserByGoogleId(googleUser.sub);

      if (!user) {
        const base = (googleUser.name || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15) || "user";
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

      const token = signToken(user.id);
      return res.json({ token, user: { id: user.id, username: user.username, level: user.level, xp: user.xp, currentStreak: user.currentStreak } });
    }

    return res.status(400).json({ message: "Provider não suportado" });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Usuário e senha são obrigatórios" });
    }

    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Usuário ou senha incorretos" });
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Usuário ou senha incorretos" });
    }

    const token = signToken(user.id);
    return res.json({
      token,
      user: { id: user.id, username: user.username, level: user.level, xp: user.xp, currentStreak: user.currentStreak },
    });
  });

  // ── ME ────────────────────────────────────────────────────────────────────

  app.get("/api/me", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
    const { password, ...safeUser } = user;
    return res.json(safeUser);
  });

  // ── MESSAGES ──────────────────────────────────────────────────────────────

  app.get("/api/messages", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const msgs = await storage.getMessagesByUser(userId, limit);
    return res.json(msgs);
  });

  // ── CHAT (AI + SSE streaming) ─────────────────────────────────────────────

  app.post("/api/chat", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { content, isSystem = false } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ message: "Mensagem não pode ser vazia" });
    }

    if (!isSystem) {
      const rate = checkRateLimit(userId);
      if (!rate.allowed) {
        const minutes = Math.ceil(rate.resetInMs / 60000);
        return res.status(429).json({
          message: `Você enviou muitas mensagens. Aguarde ${minutes} minuto${minutes > 1 ? "s" : ""} para continuar. 🐝`,
        });
      }
    }

    const [user, personality, history] = await Promise.all([
      storage.getUser(userId),
      storage.getPersonality(userId),
      storage.getMessagesByUser(userId, 20),
    ]);

    if (!user || !personality) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    if (!isSystem) {
      await storage.createMessage({ userId, role: "user", content });
      await storage.incrementMessageCount(userId);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const chatHistory = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    let fullResponse = "";
    try {
      fullResponse = await streamChat(user, personality, chatHistory, content, (chunk) => {
        res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
      });
    } catch {
      res.write(`data: ${JSON.stringify({ type: "error", message: "Erro ao gerar resposta" })}\n\n`);
      res.end();
      return;
    }

    const { cleanText, suggestedMission, achievement } = parseAIActions(fullResponse);

    await storage.createMessage({ userId, role: "assistant", content: cleanText });

    if (suggestedMission) {
      const mission = await storage.createMission({
        userId,
        title: suggestedMission.title,
        description: suggestedMission.description,
        xpReward: suggestedMission.xp_reward || 20,
      });
      res.write(`data: ${JSON.stringify({ type: "mission_created", mission })}\n\n`);
    }

    if (achievement) {
      const alreadyHas = await storage.hasAchievement(userId, achievement.type);
      if (!alreadyHas) {
        const unlocked = await storage.createAchievement({ userId, ...achievement });
        res.write(`data: ${JSON.stringify({ type: "achievement_unlocked", achievement: unlocked })}\n\n`);
      }
    }

    storage.hasAchievement(userId, "first_message").then(async (has) => {
      if (!has) {
        const unlocked = await storage.createAchievement({
          userId, type: "first_message",
          title: "Primeira Conversa!",
          description: "Você começou sua jornada com o BeeEyes 🐝",
        });
        res.write(`data: ${JSON.stringify({ type: "achievement_unlocked", achievement: unlocked })}\n\n`);
      }
    }).catch(() => {});

    storage.updateUserStreak(userId).catch(() => {});
    updatePersonalityFromMessage(userId, content, cleanText).catch(() => {});

    res.write(`data: ${JSON.stringify({ type: "done", cleanText })}\n\n`);
    res.end();
  });

  // ── PROACTIVE MESSAGES ────────────────────────────────────────────────────

  app.get("/api/proactive", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;

    const recentMessages = await storage.getMessagesByUser(userId, 10);

    if (recentMessages.length > 0) {
      const lastMsg = recentMessages[recentMessages.length - 1];
      const minutesSinceLast = (Date.now() - new Date(lastMsg.createdAt).getTime()) / 60000;

      if (minutesSinceLast < 15) return res.json({ message: null });

      const lastProactive = [...recentMessages].reverse().find((m) => {
        try { return JSON.parse(m.metadata || "{}").proactive === true; } catch { return false; }
      });
      if (lastProactive) {
        const minutesSince = (Date.now() - new Date(lastProactive.createdAt).getTime()) / 60000;
        if (minutesSince < 90) return res.json({ message: null });
      }
    }

    if (Math.random() > 0.4) return res.json({ message: null });

    const [user, personality, missions] = await Promise.all([
      storage.getUser(userId),
      storage.getPersonality(userId),
      storage.getMissionsByUser(userId, false),
    ]);

    if (!user || !personality) return res.json({ message: null });

    const content = await generateProactiveMessage(user, personality, missions);
    if (!content) return res.json({ message: null });

    await storage.createMessage({
      userId,
      role: "assistant",
      content,
      metadata: JSON.stringify({ proactive: true }),
    });

    return res.json({ message: content });
  });

  // ── MISSIONS ──────────────────────────────────────────────────────────────

  app.get("/api/missions", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const completedQuery = req.query.completed;
    const completed = completedQuery === "true" ? true : completedQuery === "false" ? false : undefined;
    const list = await storage.getMissionsByUser(userId, completed);
    return res.json(list);
  });

  app.post("/api/missions", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const parsed = insertMissionSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
    }
    const mission = await storage.createMission(parsed.data);
    return res.status(201).json(mission);
  });

  app.put("/api/missions/:id/complete", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const mission = await storage.completeMission(req.params.id, userId);
    if (!mission) return res.status(404).json({ message: "Missão não encontrada" });

    const [updatedUser, personality] = await Promise.all([
      storage.updateUserXP(userId, mission.xpReward),
      storage.getPersonality(userId),
    ]);

    if (!updatedUser || !personality) return res.status(404).json({ message: "Usuário não encontrado" });

    let achievement = null;
    const completedMissions = await storage.getMissionsByUser(userId, true);
    if (completedMissions.length === 1) {
      const has = await storage.hasAchievement(userId, "first_mission");
      if (!has) {
        achievement = await storage.createAchievement({
          userId, type: "first_mission",
          title: "Primeira Missão!",
          description: "Você completou sua primeira missão. Continue assim! 🎯",
        });
      }
    }

    let celebrationMessage: string | null = null;
    try {
      celebrationMessage = await generateMissionCelebration(updatedUser, personality, mission.title, mission.xpReward);
      await storage.createMessage({ userId, role: "assistant", content: celebrationMessage });
    } catch {
      // celebration is optional
    }

    return res.json({ mission, user: updatedUser, achievement, celebrationMessage });
  });

  app.delete("/api/missions/:id", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    await storage.deleteMission(req.params.id, userId);
    return res.status(204).send();
  });

  // ── MOOD ──────────────────────────────────────────────────────────────────

  app.get("/api/mood", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const days = parseInt(req.query.days as string) || 30;
    const entries = await storage.getMoodEntriesByUser(userId, days);
    return res.json(entries);
  });

  app.post("/api/mood", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const parsed = insertMoodEntrySchema.safeParse({ ...req.body, userId });
    if (!parsed.success) {
      return res.status(400).json({ message: "Dados inválidos" });
    }
    const entry = await storage.createMoodEntry(parsed.data);
    storage.updateUserStreak(userId).catch(() => {});
    return res.status(201).json(entry);
  });

  // ── ACHIEVEMENTS ──────────────────────────────────────────────────────────

  app.get("/api/achievements", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const list = await storage.getAchievementsByUser(userId);
    return res.json(list);
  });

  // ── FEED (Social) ─────────────────────────────────────────────────────────

  app.get("/api/feed", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const limit = parseInt(req.query.limit as string) || 30;
    const feed = await storage.getFeedForUser(userId, limit);

    // Enrich each post with likes count and whether the current user liked it
    const enriched = await Promise.all(
      feed.map(async (post) => {
        const [likesCount, liked] = await Promise.all([
          storage.getPostLikesCount(post.id),
          storage.hasLikedPost(post.id, userId),
        ]);
        return { ...post, likesCount, liked };
      })
    );

    return res.json(enriched);
  });

  // ── POSTS ─────────────────────────────────────────────────────────────────

  app.get("/api/posts", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const myPosts = await storage.getPostsByUser(userId, limit);

    const enriched = await Promise.all(
      myPosts.map(async (post) => {
        const [likesCount, liked] = await Promise.all([
          storage.getPostLikesCount(post.id),
          storage.hasLikedPost(post.id, userId),
        ]);
        return { ...post, likesCount, liked };
      })
    );

    return res.json(enriched);
  });

  app.post("/api/posts", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ message: "Conteúdo não pode ser vazio" });
    }

    if (content.trim().length > 500) {
      return res.status(400).json({ message: "Post muito longo (máximo 500 caracteres)" });
    }

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

    const post = await storage.createPost({ userId, content: content.trim() });

    // Analyze post sentiment and generate AI comment asynchronously
    analyzePost(content.trim(), user.displayName || user.username)
      .then(({ sentiment, sentimentLabel, comment }) =>
        storage.updatePostAIComment(post.id, comment, sentiment, sentimentLabel)
      )
      .catch(() => {});

    // Award XP for first post
    storage.hasAchievement(userId, "first_post").then(async (has) => {
      if (!has) {
        await storage.createAchievement({
          userId, type: "first_post",
          title: "Primeira Publicação!",
          description: "Você compartilhou seu primeiro momento na comunidade 🌟",
        });
        await storage.updateUserXP(userId, 15);
      }
    }).catch(() => {});

    return res.status(201).json(post);
  });

  app.post("/api/posts/:id/like", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const postId = req.params.id;

    const post = await storage.getPostById(postId);
    if (!post) return res.status(404).json({ message: "Post não encontrado" });

    const alreadyLiked = await storage.hasLikedPost(postId, userId);
    if (alreadyLiked) {
      await storage.unlikePost(postId, userId);
      const likesCount = await storage.getPostLikesCount(postId);
      return res.json({ liked: false, likesCount });
    } else {
      await storage.likePost(postId, userId);
      const likesCount = await storage.getPostLikesCount(postId);
      return res.json({ liked: true, likesCount });
    }
  });

  // ── CONNECTIONS ───────────────────────────────────────────────────────────

  app.get("/api/connections/suggestions", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const limit = parseInt(req.query.limit as string) || 5;

    const suggestions = await storage.getSuggestedConnections(userId, limit);

    const result = suggestions.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      level: u.level,
      commonInterests: u.commonInterests,
      suggestionMessage: buildConnectionSuggestionMessage(
        "",
        u.displayName || u.username,
        u.commonInterests
      ),
    }));

    return res.json(result);
  });

  app.get("/api/connections", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const pending = await storage.getConnectionsByUser(userId);
    return res.json(pending);
  });

  app.post("/api/connections", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { targetUserId } = req.body;

    if (!targetUserId || targetUserId === userId) {
      return res.status(400).json({ message: "Usuário inválido" });
    }

    const target = await storage.getUser(targetUserId);
    if (!target) return res.status(404).json({ message: "Usuário não encontrado" });

    const existing = await storage.getConnectionStatus(userId, targetUserId);
    if (existing) return res.status(409).json({ message: "Solicitação já enviada" });

    const connection = await storage.createConnection({ userId, targetUserId });

    const requester = await storage.getUser(userId);
    if (requester) {
      const requesterName = requester.displayName || requester.username;
      await storage.createMessage({
        userId: targetUserId,
        role: "assistant",
        content: `${requesterName} quer se conectar com voce. Deseja aceitar a solicitacao de amizade?`,
        metadata: JSON.stringify({
          type: "connection_request",
          connectionId: connection.id,
          fromUserId: requester.id,
          fromName: requesterName,
        }),
      });
    }

    return res.status(201).json(connection);
  });

  app.put("/api/connections/:id/accept", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const connection = await storage.acceptConnection(req.params.id, userId);
    if (!connection) return res.status(404).json({ message: "Solicitacao nao encontrada" });

    const accepter = await storage.getUser(userId);
    if (accepter) {
      const accepterName = accepter.displayName || accepter.username;
      await storage.createMessage({
        userId: connection.userId,
        role: "assistant",
        content: `${accepterName} aceitou sua solicitacao de amizade. Agora voces podem conversar!`,
        metadata: JSON.stringify({ type: "connection_accepted", byUserId: userId }),
      });
    }

    return res.json(connection);
  });

  app.put("/api/connections/:id/reject", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const rejected = await storage.rejectConnection(req.params.id, userId);
    if (!rejected) return res.status(404).json({ message: "Solicitacao nao encontrada" });
    return res.json({ ok: true });
  });


  // ── FRIENDS ───────────────────────────────────────────────────────────────

  app.get("/api/friends", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const friends = await storage.getFriends(userId);
    return res.json(friends);
  });

  // ── USER SEARCH ──────────────────────────────────────────────────────────

  app.get("/api/dm/conversations", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const conversations = await storage.getDirectConversations(userId);
    return res.json(conversations);
  });

  app.get("/api/dm/:userId", requireAuth, async (req: Request, res: Response) => {
    const myUserId = (req as AuthRequest).userId;
    const otherUserId = req.params.userId;

    if (!otherUserId || otherUserId === myUserId) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    const otherUser = await storage.getUser(otherUserId);
    if (!otherUser) return res.status(404).json({ message: "Usuario nao encontrado" });

    const conversation = await storage.getDirectMessagesBetweenUsers(myUserId, otherUserId, 200);
    await storage.markDirectMessagesAsRead(myUserId, otherUserId);

    return res.json(conversation);
  });

  app.post("/api/dm/:userId", requireAuth, async (req: Request, res: Response) => {
    const senderId = (req as AuthRequest).userId;
    const recipientId = req.params.userId;
    const content = String(req.body?.content || "").trim();

    if (!recipientId || recipientId === senderId) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    if (!content) {
      return res.status(400).json({ message: "Mensagem nao pode ser vazia" });
    }

    if (content.length > 1500) {
      return res.status(400).json({ message: "Mensagem muito longa (maximo 1500 caracteres)" });
    }

    const recipient = await storage.getUser(recipientId);
    if (!recipient) return res.status(404).json({ message: "Usuario nao encontrado" });

    const created = await storage.sendDirectMessage({ senderId, recipientId, content });
    return res.status(201).json(created);
  });
  app.get("/api/users/search", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const q = (req.query.q as string) || "";
    if (!q.trim()) return res.json([]);
    const results = await storage.searchUsers(q, userId);
    return res.json(results);
  });

  // ── USER PUBLIC PROFILE ───────────────────────────────────────────────────

  app.get("/api/users/:userId/profile", requireAuth, async (req: Request, res: Response) => {
    const profile = await storage.getUserPublicProfile(req.params.userId);
    if (!profile) return res.status(404).json({ message: "Usuário não encontrado" });
    return res.json(profile);
  });

  app.post("/api/users/:userId/visit", requireAuth, async (req: Request, res: Response) => {
    const visitorId = (req as AuthRequest).userId;
    const visitedId = req.params.userId;

    if (visitorId === visitedId) return res.json({ ok: true });

    const [visitor, visited, visitedPersonality] = await Promise.all([
      storage.getUser(visitorId),
      storage.getUser(visitedId),
      storage.getPersonality(visitedId),
    ]);

    if (!visitor || !visited || !visitedPersonality) return res.json({ ok: true });

    const visitorName = visitor.displayName || visitor.username;

    // Generate and save notification to the visited user's chat (non-blocking)
    generateVisitNotification(visitorName, visited, visitedPersonality)
      .then((content) => storage.createMessage({
        userId: visitedId,
        role: "assistant",
        content,
        metadata: JSON.stringify({ proactive: true, visitFrom: visitorId }),
      }))
      .catch(() => {});

    return res.json({ ok: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}

