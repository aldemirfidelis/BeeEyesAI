import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { notFound, validationError } from "../api/errors";
import { sendCreated, sendNoContent, sendOk } from "../api/response";
import { buildWeeklyReport, generateDailyMissionPlan, generateMissionCelebration } from "../ai";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";
import { insertMissionSchema } from "../../shared/schema";

export function createMissionsRouter(triggerMissionAction: (userId: string, actionType: string) => Promise<void>) {
  const router = Router();

  async function ensureDailyMissions(userId: string) {
    const [user, personality, history, allMissions] = await Promise.all([
      storage.getUser(userId),
      storage.getPersonality(userId),
      storage.getMessagesByUser(userId, 30),
      storage.getMissionsByUser(userId),
    ]);

    if (!user || !personality) {
      throw notFound("Usuário não encontrado");
    }

    const now = new Date();
    const todaysDaily = allMissions.filter((mission) => {
      const createdAt = new Date(mission.createdAt);
      return (
        mission.type === "ai_daily" &&
        createdAt.getFullYear() === now.getFullYear() &&
        createdAt.getMonth() === now.getMonth() &&
        createdAt.getDate() === now.getDate()
      );
    });

    if (todaysDaily.length >= 3) {
      return todaysDaily;
    }

    const pendingSystemMissions = allMissions.filter((mission) => mission.type === "system" && !mission.completed);
    const chatHistory = history.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

    const drafts = generateDailyMissionPlan(user, personality, chatHistory, pendingSystemMissions);
    const titles = new Set(todaysDaily.map((mission) => mission.title));

    for (const draft of drafts) {
      if (titles.has(draft.title)) continue;
      const created = await storage.createMission({
        userId,
        title: draft.title,
        description: draft.description,
        xpReward: draft.xpReward,
        type: draft.type,
        tier: draft.tier,
      });
      todaysDaily.push(created);
      titles.add(created.title);
      if (todaysDaily.length >= 3) break;
    }

    return todaysDaily;
  }

  router.post("/api/missions/seed", requireAuth, asyncHandler(async (req, res) => {
    await storage.seedPredefinedMissions(req.userId!);
    return sendOk(res, await storage.getMissionsByUser(req.userId!));
  }));

  router.post("/api/missions/daily-refresh", requireAuth, asyncHandler(async (req, res) => {
    const missions = await ensureDailyMissions(req.userId!);
    return sendOk(res, missions);
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

  router.get("/api/reports/weekly", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const [user, missions, messages, posts] = await Promise.all([
      storage.getUser(userId),
      storage.getMissionsByUser(userId),
      storage.getMessagesByUser(userId, 200),
      storage.getPostsByUser(userId, 50),
    ]);

    if (!user) {
      throw notFound("Usuário não encontrado");
    }

    const now = new Date();
    const since = new Date(now);
    since.setDate(now.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
    const dailyActivity = new Map<string, number>();

    for (let i = 0; i < 7; i += 1) {
      const day = new Date(since);
      day.setDate(since.getDate() + i);
      dailyActivity.set(weekday.format(day), 0);
    }

    const touch = (dateValue: Date | string | null | undefined) => {
      if (!dateValue) return;
      const date = new Date(dateValue);
      if (date < since) return;
      const key = weekday.format(date);
      dailyActivity.set(key, (dailyActivity.get(key) ?? 0) + 1);
    };

    const weeklyMissions = missions.filter((mission) => new Date(mission.createdAt) >= since);
    weeklyMissions.forEach((mission) => {
      touch(mission.createdAt);
      if (mission.completedAt) touch(mission.completedAt);
    });
    messages.forEach((message) => touch(message.createdAt));
    posts.forEach((post) => touch(post.createdAt));

    const rankedDays = [...dailyActivity.entries()].sort((a, b) => b[1] - a[1]);
    const strongestDay = rankedDays[0]?.[0] ?? "sem dados";
    const weakestDay = [...rankedDays].reverse()[0]?.[0] ?? "sem dados";
    const activeDays = [...dailyActivity.values()].filter((count) => count > 0).length;
    const completedMissions = weeklyMissions.filter((mission) => mission.completed).length;

    return sendOk(res, buildWeeklyReport({
      activeDays,
      completedMissions,
      totalMissionsTouched: weeklyMissions.length,
      strongestDay,
      weakestDay,
      streak: user.currentStreak,
    }));
  }));

  return router;
}
