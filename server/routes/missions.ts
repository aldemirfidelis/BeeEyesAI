import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { notFound, validationError } from "../api/errors";
import { sendCreated, sendNoContent, sendOk } from "../api/response";
import { generateMissionCelebration } from "../ai";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";
import { insertMissionSchema } from "../../shared/schema";

export function createMissionsRouter(triggerMissionAction: (userId: string, actionType: string) => Promise<void>) {
  const router = Router();

  router.post("/api/missions/seed", requireAuth, asyncHandler(async (req, res) => {
    await storage.seedPredefinedMissions(req.userId!);
    return sendOk(res, await storage.getMissionsByUser(req.userId!));
  }));

  router.get("/api/missions", requireAuth, asyncHandler(async (req, res) => {
    const completedQuery = req.query.completed;
    const completed = completedQuery === "true" ? true : completedQuery === "false" ? false : undefined;
    return sendOk(res, await storage.getMissionsByUser(req.userId!, completed));
  }));

  router.post("/api/missions", requireAuth, asyncHandler(async (req, res) => {
    const parsed = insertMissionSchema.safeParse({ ...req.body, userId: req.userId! });
    if (!parsed.success) {
      throw validationError("Dados inválidos", parsed.error.issues);
    }

    return sendCreated(res, await storage.createMission(parsed.data));
  }));

  router.put("/api/missions/:id/complete", requireAuth, asyncHandler(async (req, res) => {
    const mission = await storage.completeMission(req.params.id, req.userId!);
    if (!mission) {
      throw notFound("Missão não encontrada");
    }

    const [updatedUser, personality] = await Promise.all([
      storage.updateUserXP(req.userId!, mission.xpReward),
      storage.getPersonality(req.userId!),
    ]);

    if (!updatedUser || !personality) {
      throw notFound("Usuário não encontrado");
    }

    let achievement = null;
    const completedMissions = await storage.getMissionsByUser(req.userId!, true);
    if (completedMissions.length === 1) {
      const has = await storage.hasAchievement(req.userId!, "first_mission");
      if (!has) {
        achievement = await storage.createAchievement({
          userId: req.userId!,
          type: "first_mission",
          title: "Primeira Missão!",
          description: "Você completou sua primeira missão. Continue assim! 🎯",
        });
      }
    }

    let celebrationMessage: string | null = null;
    try {
      celebrationMessage = await generateMissionCelebration(updatedUser, personality, mission.title, mission.xpReward);
      await storage.createMessage({ userId: req.userId!, role: "assistant", content: celebrationMessage });
    } catch {
      // optional
    }

    return sendOk(res, { mission, user: updatedUser, achievement, celebrationMessage });
  }));

  router.delete("/api/missions/:id", requireAuth, asyncHandler(async (req, res) => {
    await storage.deleteMission(req.params.id, req.userId!);
    return sendNoContent(res);
  }));

  router.post("/api/missions/:id/actions/:actionType", requireAuth, asyncHandler(async (req, res) => {
    await triggerMissionAction(req.userId!, req.params.actionType);
    return sendOk(res, { acknowledged: true });
  }));

  return router;
}
