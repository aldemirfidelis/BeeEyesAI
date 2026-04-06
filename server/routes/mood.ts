import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { validationError } from "../api/errors";
import { sendCreated, sendOk } from "../api/response";
import { parseBoundedInt } from "../http";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";
import { insertMoodEntrySchema } from "../../shared/schema";

export function createMoodRouter(triggerMissionAction: (userId: string, actionType: string) => Promise<void>) {
  const router = Router();

  router.get("/api/mood", requireAuth, asyncHandler(async (req, res) => {
    const days = parseBoundedInt(req.query.days, { fallback: 30, min: 1, max: 90 });
    return sendOk(res, await storage.getMoodEntriesByUser(req.userId!, days));
  }));

  router.post("/api/mood", requireAuth, asyncHandler(async (req, res) => {
    const parsed = insertMoodEntrySchema.safeParse({ ...req.body, userId: req.userId! });
    if (!parsed.success) {
      throw validationError("Dados inválidos", parsed.error.issues);
    }

    const entry = await storage.createMoodEntry(parsed.data);
    storage.updateUserStreak(req.userId!).catch(() => {});
    triggerMissionAction(req.userId!, "set_mood").catch(() => {});

    return sendCreated(res, entry);
  }));

  return router;
}
