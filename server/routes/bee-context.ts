import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../api/async-handler";
import { badRequest, notFound } from "../api/errors";
import { sendOk } from "../api/response";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";

const memorySchema = z.object({
  memoryType: z.string().trim().min(1).max(40).default("fact"),
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(1200),
  source: z.string().trim().min(1).max(40).default("user"),
  importance: z.number().int().min(1).max(5).default(3),
  active: z.boolean().default(true),
});

const preferenceSchema = z.object({
  category: z.string().trim().min(1).max(60),
  preference: z.string().trim().min(1).max(600),
  weight: z.number().int().min(1).max(5).default(1),
  source: z.string().trim().min(1).max(40).default("user"),
  active: z.boolean().default(true),
});

export function createBeeContextRouter() {
  const router = Router();

  router.get("/api/bee/context", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const [context, memories, preferences, feedbackSummary] = await Promise.all([
      storage.getBeeConversationContext(userId),
      storage.getActiveUserMemories(userId, 50),
      storage.getUserPreferences(userId, false),
      storage.getMessageFeedbackSummary(userId),
    ]);

    return sendOk(res, {
      context: context ?? {
        contextSummary: "",
        recentTopics: [],
        emotionalTone: "neutral",
        activeGoals: [],
        personalizationEnabled: true,
      },
      memories,
      preferences,
      feedbackSummary,
    });
  }));

  router.patch("/api/bee/context", requireAuth, asyncHandler(async (req, res) => {
    const parsed = z.object({
      personalizationEnabled: z.boolean().optional(),
      contextSummary: z.string().max(2000).optional(),
      recentTopics: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
      emotionalTone: z.string().trim().min(1).max(40).optional(),
      activeGoals: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    }).safeParse(req.body ?? {});

    if (!parsed.success) throw badRequest("Dados de contexto inválidos", parsed.error.issues);

    const previous = await storage.getBeeConversationContext(req.userId!);
    const context = await storage.upsertBeeConversationContext({
      userId: req.userId!,
      contextSummary: parsed.data.contextSummary ?? previous?.contextSummary ?? "",
      recentTopics: parsed.data.recentTopics ?? previous?.recentTopics ?? [],
      emotionalTone: parsed.data.emotionalTone ?? previous?.emotionalTone ?? "neutral",
      activeGoals: parsed.data.activeGoals ?? previous?.activeGoals ?? [],
      personalizationEnabled: parsed.data.personalizationEnabled ?? previous?.personalizationEnabled ?? true,
    });

    return sendOk(res, context);
  }));

  router.post("/api/bee/memories", requireAuth, asyncHandler(async (req, res) => {
    const parsed = memorySchema.safeParse(req.body ?? {});
    if (!parsed.success) throw badRequest("Memória inválida", parsed.error.issues);
    const memory = await storage.upsertUserMemory({ userId: req.userId!, ...parsed.data });
    return sendOk(res, memory);
  }));

  router.patch("/api/bee/memories/:id", requireAuth, asyncHandler(async (req, res) => {
    const parsed = z.object({ active: z.boolean() }).safeParse(req.body ?? {});
    if (!parsed.success) throw badRequest("Atualização de memória inválida", parsed.error.issues);
    const memory = await storage.setUserMemoryActive(req.userId!, req.params.id, parsed.data.active);
    if (!memory) throw notFound("Memória não encontrada");
    return sendOk(res, memory);
  }));

  router.delete("/api/bee/memories/:id", requireAuth, asyncHandler(async (req, res) => {
    const deleted = await storage.deleteUserMemory(req.userId!, req.params.id);
    if (!deleted) throw notFound("Memória não encontrada");
    return sendOk(res, { deleted: true });
  }));

  router.post("/api/bee/preferences", requireAuth, asyncHandler(async (req, res) => {
    const parsed = preferenceSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw badRequest("Preferência inválida", parsed.error.issues);
    const preference = await storage.upsertUserPreference({ userId: req.userId!, ...parsed.data });
    return sendOk(res, preference);
  }));

  router.delete("/api/bee/preferences/:id", requireAuth, asyncHandler(async (req, res) => {
    const deleted = await storage.deleteUserPreference(req.userId!, req.params.id);
    if (!deleted) throw notFound("Preferência não encontrada");
    return sendOk(res, { deleted: true });
  }));

  return router;
}
