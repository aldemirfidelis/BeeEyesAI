import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { badRequest, conflict, notFound } from "../api/errors";
import { sendCreated, sendOk } from "../api/response";
import {
  analyzePost,
  buildConnectionSuggestionMessage,
  generateVisitNotification,
  summarizeInterestsForProfile,
} from "../ai";
import { parseBoundedInt } from "../http";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";
import { hasAnonymousProfileVisitsUnlocked } from "../../shared/unlocks";

export function createSocialRouter(triggerMissionAction: (userId: string, actionType: string) => Promise<void>) {
  const router = Router();

  router.get("/api/achievements", requireAuth, asyncHandler(async (req, res) => {
    return sendOk(res, await storage.getAchievementsByUser(req.userId!));
  }));

  router.get("/api/feed", requireAuth, asyncHandler(async (req, res) => {
    const limit = parseBoundedInt(req.query.limit, { fallback: 30, min: 1, max: 100 });
    const feed = await storage.getFeedForUser(req.userId!, limit);

    const enriched = await Promise.all(feed.map(async (post) => {
      const [likesCount, liked, commentsCount] = await Promise.all([
        storage.getPostLikesCount(post.id),
        storage.hasLikedPost(post.id, req.userId!),
        storage.getCommentCount(post.id),
      ]);
      return { ...post, likesCount, liked, commentsCount };
    }));

    return sendOk(res, enriched);
  }));

  router.get("/api/posts", requireAuth, asyncHandler(async (req, res) => {
    const limit = parseBoundedInt(req.query.limit, { fallback: 20, min: 1, max: 100 });
    const myPosts = await storage.getPostsByUser(req.userId!, limit);
    const enriched = await Promise.all(myPosts.map(async (post) => {
      const [likesCount, liked] = await Promise.all([
        storage.getPostLikesCount(post.id),
        storage.hasLikedPost(post.id, req.userId!),
      ]);
      return { ...post, likesCount, liked };
    }));

    return sendOk(res, enriched);
  }));

  router.post("/api/posts", requireAuth, asyncHandler(async (req, res) => {
    const content = String(req.body?.content || "").trim();
    if (!content) {
      throw badRequest("Conteúdo não pode ser vazio");
    }
    if (content.length > 500) {
      throw badRequest("Post muito longo (máximo 500 caracteres)");
    }

    const user = await storage.getUser(req.userId!);
    if (!user) {
      throw notFound("Usuário não encontrado");
    }

    const post = await storage.createPost({ userId: req.userId!, content });

    analyzePost(content, user.displayName || user.username)
      .then(({ sentiment, sentimentLabel, comment }) =>
        storage.updatePostAIComment(post.id, comment, sentiment, sentimentLabel),
      )
      .catch(() => {});

    storage.hasAchievement(req.userId!, "first_post")
      .then(async (hasAchievement) => {
        if (hasAchievement) return;
        await storage.createAchievement({
          userId: req.userId!,
          type: "first_post",
          title: "Primeira Publicação!",
          description: "Você compartilhou seu primeiro momento na comunidade 🌟",
        });
        await storage.updateUserXP(req.userId!, 15);
      })
      .catch(() => {});

    triggerMissionAction(req.userId!, "create_post").catch(() => {});

    return sendCreated(res, post);
  }));

  router.post("/api/posts/:id/like", requireAuth, asyncHandler(async (req, res) => {
    const post = await storage.getPostById(req.params.id);
    if (!post) {
      throw notFound("Post não encontrado");
    }

    const alreadyLiked = await storage.hasLikedPost(req.params.id, req.userId!);
    if (alreadyLiked) {
      await storage.unlikePost(req.params.id, req.userId!);
      return sendOk(res, { liked: false, likesCount: await storage.getPostLikesCount(req.params.id) });
    }

    await storage.likePost(req.params.id, req.userId!);
    triggerMissionAction(req.userId!, "like_post").catch(() => {});
    return sendOk(res, { liked: true, likesCount: await storage.getPostLikesCount(req.params.id) });
  }));

  router.get("/api/news", requireAuth, asyncHandler(async (req, res) => {
    const personality = await storage.getPersonality(req.userId!);
    const rawInterests: string[] = JSON.parse(personality?.interests || "[]");
    const query = rawInterests.slice(0, 2).join(" ") || "tecnologia Brasil";

    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-BR`;
      const rssRes = await fetch(rssUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!rssRes.ok) throw new Error("rss failed");

      const xml = await rssRes.text();
      const items: Array<{ title: string; link: string; source: string }> = [];
      const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

      for (const match of matches) {
        const block = match[1];
        const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? block.match(/<title>(.*?)<\/title>/)?.[1] ?? "").trim();
        const link = (block.match(/<link>(.*?)<\/link>/)?.[1] ?? "").trim();
        const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "").trim();
        if (title && link) items.push({ title, link, source });
        if (items.length >= 5) break;
      }

      return sendOk(res, { items, query });
    } catch {
      return sendOk(res, { items: [], query });
    }
  }));

  router.get("/api/posts/:id/comments", requireAuth, asyncHandler(async (req, res) => {
    return sendOk(res, await storage.getCommentsForPost(req.params.id, req.userId!));
  }));

  router.post("/api/posts/:id/comments", requireAuth, asyncHandler(async (req, res) => {
    const content = String(req.body?.content || "").trim();
    if (!content) {
      throw badRequest("Comentário vazio");
    }

    const comment = await storage.createPostComment({ postId: req.params.id, userId: req.userId!, content });
    triggerMissionAction(req.userId!, "comment_post").catch(() => {});
    return sendCreated(res, comment);
  }));

  router.post("/api/comments/:id/like", requireAuth, asyncHandler(async (req, res) => {
    return sendOk(res, await storage.toggleCommentLike(req.params.id, req.userId!));
  }));

  router.get("/api/connections/suggestions", requireAuth, asyncHandler(async (req, res) => {
    try {
      const limit = parseBoundedInt(req.query.limit, { fallback: 5, min: 1, max: 20 });
      const suggestions = await storage.getSuggestedConnections(req.userId!, limit);
      return sendOk(res, suggestions.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        level: user.level,
        commonInterests: user.commonInterests,
        suggestionMessage: buildConnectionSuggestionMessage("", user.displayName || user.username, user.commonInterests),
      })));
    } catch (error) {
      req.logger.warn("connections.suggestions.failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return sendOk(res, []);
    }
  }));

  router.get("/api/connections", requireAuth, asyncHandler(async (req, res) => {
    return sendOk(res, await storage.getConnectionsByUser(req.userId!));
  }));

  router.post("/api/connections", requireAuth, asyncHandler(async (req, res) => {
    const { targetUserId } = req.body ?? {};
    if (!targetUserId || targetUserId === req.userId) {
      throw badRequest("Usuário inválido");
    }

    const target = await storage.getUser(targetUserId);
    if (!target) {
      throw notFound("Usuário não encontrado");
    }

    const existing = await storage.getConnectionStatus(req.userId!, targetUserId);
    if (existing) {
      if (existing.status === "pending" && existing.targetUserId === req.userId) {
        const accepted = await storage.acceptConnection(existing.id, req.userId!);
        if (!accepted) {
          throw conflict("Solicitação já processada");
        }

        const accepter = await storage.getUser(req.userId!);
        if (accepter) {
          const accepterName = accepter.displayName || accepter.username;
          await storage.createMessage({
            userId: accepted.userId,
            role: "assistant",
            content: `${accepterName} aceitou sua solicitação de amizade. Agora vocês podem conversar!`,
            metadata: JSON.stringify({ type: "connection_accepted", byUserId: req.userId }),
          });
        }

        return sendOk(res, accepted);
      }

      throw conflict("Solicitação já enviada");
    }

    const connection = await storage.createConnection({ userId: req.userId!, targetUserId });
    const requester = await storage.getUser(req.userId!);
    if (requester) {
      const requesterName = requester.displayName || requester.username;
      await storage.createMessage({
        userId: targetUserId,
        role: "assistant",
        content: `${requesterName} quer se conectar com você. Deseja aceitar a solicitação de amizade?`,
        metadata: JSON.stringify({
          type: "connection_request",
          connectionId: connection.id,
          fromUserId: requester.id,
          fromName: requesterName,
        }),
      });
    }

    triggerMissionAction(req.userId!, "add_friend").catch(() => {});
    return sendCreated(res, connection);
  }));

  router.put("/api/connections/:id/accept", requireAuth, asyncHandler(async (req, res) => {
    const connection = await storage.acceptConnection(req.params.id, req.userId!);
    if (!connection) {
      throw notFound("Solicitação não encontrada");
    }

    const accepter = await storage.getUser(req.userId!);
    if (accepter) {
      const accepterName = accepter.displayName || accepter.username;
      await storage.createMessage({
        userId: connection.userId,
        role: "assistant",
        content: `${accepterName} aceitou sua solicitação de amizade. Agora vocês podem conversar!`,
        metadata: JSON.stringify({ type: "connection_accepted", byUserId: req.userId }),
      });
    }

    triggerMissionAction(req.userId!, "accept_friend").catch(() => {});
    return sendOk(res, connection);
  }));

  router.put("/api/connections/:id/reject", requireAuth, asyncHandler(async (req, res) => {
    const rejected = await storage.rejectConnection(req.params.id, req.userId!);
    if (!rejected) {
      throw notFound("Solicitação não encontrada");
    }

    return sendOk(res, { ok: true });
  }));

  router.get("/api/friends", requireAuth, asyncHandler(async (req, res) => {
    try {
      return sendOk(res, await storage.getFriends(req.userId!));
    } catch (error) {
      req.logger.warn("friends.fetch.failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return sendOk(res, []);
    }
  }));

  router.get("/api/dm/conversations", requireAuth, asyncHandler(async (req, res) => {
    try {
      return sendOk(res, await storage.getDirectConversations(req.userId!));
    } catch (error) {
      req.logger.warn("dm.conversations.failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return sendOk(res, []);
    }
  }));

  router.get("/api/dm/:userId", requireAuth, asyncHandler(async (req, res) => {
    if (!req.params.userId || req.params.userId === req.userId) {
      throw badRequest("Usuário inválido");
    }

    const otherUser = await storage.getUser(req.params.userId);
    if (!otherUser) {
      throw notFound("Usuário não encontrado");
    }

    const conversation = await storage.getDirectMessagesBetweenUsers(req.userId!, req.params.userId, 200);
    await storage.markDirectMessagesAsRead(req.userId!, req.params.userId);
    return sendOk(res, conversation);
  }));

  router.post("/api/dm/:userId", requireAuth, asyncHandler(async (req, res) => {
    const recipientId = req.params.userId;
    const content = String(req.body?.content || "").trim();

    if (!recipientId || recipientId === req.userId) {
      throw badRequest("Usuário inválido");
    }
    if (!content) {
      throw badRequest("Mensagem não pode ser vazia");
    }
    if (content.length > 1500) {
      throw badRequest("Mensagem muito longa (máximo 1500 caracteres)");
    }

    const recipient = await storage.getUser(recipientId);
    if (!recipient) {
      throw notFound("Usuário não encontrado");
    }

    const created = await storage.sendDirectMessage({ senderId: req.userId!, recipientId, content });
    triggerMissionAction(req.userId!, "send_dm").catch(() => {});
    return sendCreated(res, created);
  }));

  router.get("/api/users/search", requireAuth, asyncHandler(async (req, res) => {
    const query = String(req.query.q || "");
    if (!query.trim()) {
      return sendOk(res, []);
    }
    return sendOk(res, await storage.searchUsers(query, req.userId!));
  }));

  router.get("/api/users/:userId/profile", requireAuth, asyncHandler(async (req, res) => {
    const profile = await storage.getUserPublicProfile(req.params.userId);
    if (!profile) {
      throw notFound("Usuário não encontrado");
    }

    let interests = profile.interests;
    try {
      interests = await summarizeInterestsForProfile(profile.interests);
    } catch {
      // use raw interests
    }

    return sendOk(res, { ...profile, interests });
  }));

  router.post("/api/users/:userId/visit", requireAuth, asyncHandler(async (req, res) => {
    const visitedId = req.params.userId;
    if (req.userId === visitedId) {
      return sendOk(res, { ok: true });
    }

    const [visitor, visited, visitedPersonality] = await Promise.all([
      storage.getUser(req.userId!),
      storage.getUser(visitedId),
      storage.getPersonality(visitedId),
    ]);

    if (!visitor || !visited || !visitedPersonality) {
      return sendOk(res, { ok: true });
    }

    const anonymousVisit = visitor.anonymousProfileVisitsEnabled && hasAnonymousProfileVisitsUnlocked(visitor);

    if (anonymousVisit) {
      storage.createMessage({
        userId: visitedId,
        role: "assistant",
        content: "👻 Alguém visitou seu perfil anonimamente. Continue evoluindo nas missões para liberar novas formas de interação.",
        metadata: JSON.stringify({ proactive: true, visitFrom: req.userId, anonymous: true }),
      }).catch(() => {});
    } else {
      const visitorName = visitor.displayName || visitor.username;
      generateVisitNotification(visitorName, visited, visitedPersonality)
        .then((content) => storage.createMessage({
          userId: visitedId,
          role: "assistant",
          content,
          metadata: JSON.stringify({ proactive: true, visitFrom: req.userId, anonymous: false }),
        }))
        .catch(() => {});
    }

    return sendOk(res, { ok: true });
  }));

  return router;
}
