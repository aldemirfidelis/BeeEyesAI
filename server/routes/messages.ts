import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { badRequest, notFound } from "../api/errors";
import { sendError, sendOk } from "../api/response";
import {
  generateProactiveMessage,
  parseAIActions,
  streamChat,
  summarizeNewsArticle,
  updatePersonalityFromMessage,
} from "../ai";
import { parseBoundedInt } from "../http";
import { requireAuth } from "../middleware/requireAuth";
import { checkRateLimit } from "../rateLimit";
import { storage } from "../storage";

export function createMessagesRouter(triggerMissionAction: (userId: string, actionType: string) => Promise<void>) {
  const router = Router();

  router.get("/api/messages", requireAuth, asyncHandler(async (req, res) => {
    const limit = parseBoundedInt(req.query.limit, { fallback: 50, min: 1, max: 100 });
    return sendOk(res, await storage.getMessagesByUser(req.userId!, limit));
  }));

  router.post("/api/chat", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { content, isSystem = false } = req.body ?? {};

    if (!content?.trim()) {
      return sendError(res, 400, "VALIDATION_ERROR", "Mensagem não pode ser vazia");
    }

    if (!isSystem) {
      const rate = checkRateLimit(userId);
      if (!rate.allowed) {
        const minutes = Math.ceil(rate.resetInMs / 60000);
        return sendError(
          res,
          429,
          "RATE_LIMITED",
          `Você enviou muitas mensagens. Aguarde ${minutes} minuto${minutes > 1 ? "s" : ""} para continuar. 🐝`,
        );
      }
    }

    const [user, personality, history] = await Promise.all([
      storage.getUser(userId),
      storage.getPersonality(userId),
      storage.getMessagesByUser(userId, 20),
    ]);

    if (!user || !personality) {
      return sendError(res, 404, "NOT_FOUND", "Usuário não encontrado");
    }

    if (!isSystem) {
      await storage.createMessage({ userId, role: "user", content });
      await storage.incrementMessageCount(userId);
      triggerMissionAction(userId, "send_message").catch(() => {});
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const chatHistory = history.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
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

    const { cleanText, suggestedMission, achievement, fetchNews } = parseAIActions(fullResponse);
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

    storage.hasAchievement(userId, "first_message")
      .then(async (hasAchievement) => {
        if (hasAchievement) return;
        const unlocked = await storage.createAchievement({
          userId,
          type: "first_message",
          title: "Primeira Conversa!",
          description: "Você começou sua jornada com o BeeEyes 🐝",
        });
        res.write(`data: ${JSON.stringify({ type: "achievement_unlocked", achievement: unlocked })}\n\n`);
      })
      .catch(() => {});

    if (fetchNews?.query) {
      try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(fetchNews.query)}&hl=pt-BR&gl=BR&ceid=BR:pt-BR`;
        const rssRes = await fetch(rssUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(8000),
        });

        if (rssRes.ok) {
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

          res.write(`data: ${JSON.stringify({ type: "news_fetched", query: fetchNews.query, items })}\n\n`);
        }
      } catch {
        // ignore
      }
    }

    storage.updateUserStreak(userId).catch(() => {});
    updatePersonalityFromMessage(userId, content, cleanText).catch(() => {});

    res.write(`data: ${JSON.stringify({ type: "done", cleanText })}\n\n`);
    res.end();
  }));

  router.get("/api/proactive", requireAuth, asyncHandler(async (req, res) => {
    const recentMessages = await storage.getMessagesByUser(req.userId!, 10);

    if (recentMessages.length > 0) {
      const lastMsg = recentMessages[recentMessages.length - 1];
      const minutesSinceLast = (Date.now() - new Date(lastMsg.createdAt).getTime()) / 60000;
      if (minutesSinceLast < 15) return sendOk(res, { message: null });

      const lastProactive = [...recentMessages].reverse().find((message) => {
        try {
          return JSON.parse(message.metadata || "{}").proactive === true;
        } catch {
          return false;
        }
      });

      if (lastProactive) {
        const minutesSince = (Date.now() - new Date(lastProactive.createdAt).getTime()) / 60000;
        if (minutesSince < 90) return sendOk(res, { message: null });
      }
    }

    if (Math.random() > 0.4) {
      return sendOk(res, { message: null });
    }

    const [user, personality, missions] = await Promise.all([
      storage.getUser(req.userId!),
      storage.getPersonality(req.userId!),
      storage.getMissionsByUser(req.userId!, false),
    ]);

    if (!user || !personality) {
      return sendOk(res, { message: null });
    }

    const content = await generateProactiveMessage(user, personality, missions);
    if (!content) {
      return sendOk(res, { message: null });
    }

    await storage.createMessage({
      userId: req.userId!,
      role: "assistant",
      content,
      metadata: JSON.stringify({ proactive: true }),
    });

    return sendOk(res, { message: content });
  }));

  router.patch("/api/messages/:id", requireAuth, asyncHandler(async (req, res) => {
    const { content, metadata } = req.body ?? {};
    if (typeof content !== "string" || typeof metadata !== "string") {
      throw badRequest("content e metadata são obrigatórios");
    }

    const updated = await storage.updateMessageMetadata(req.params.id, req.userId!, { content, metadata });
    if (!updated) {
      throw notFound("Mensagem não encontrada");
    }

    return sendOk(res, updated);
  }));

  router.post("/api/news/summarize", requireAuth, asyncHandler(async (req, res) => {
    const { url, title } = req.body ?? {};
    if (!url || !title) {
      throw badRequest("url e title obrigatórios");
    }

    const summary = await summarizeNewsArticle(url, title);
    if (!summary) {
      return sendError(res, 502, "UPSTREAM_ERROR", "Não foi possível gerar o resumo");
    }

    return sendOk(res, { summary });
  }));

  return router;
}
