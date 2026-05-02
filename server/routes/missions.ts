import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { notFound, validationError } from "../api/errors";
import { sendCreated, sendNoContent, sendOk } from "../api/response";
import { buildDailyContext, buildWeeklyReport, generateAdaptiveDailyMissionPlan, generateBonusMissions, generateMissionCelebration } from "../ai";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";
import { insertMissionSchema } from "../../shared/schema";

export function createMissionsRouter(triggerMissionAction: (userId: string, actionType: string) => Promise<void>) {
  const router = Router();

  async function ensureDailyMissions(userId: string) {
    const [user, personality, history, allMissions, recentMoods] = await Promise.all([
      storage.getUser(userId),
      storage.getPersonality(userId),
      storage.getMessagesByUser(userId, 30),
      storage.getMissionsByUser(userId),
      storage.getMoodEntriesByUser(userId, 3),
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

    const drafts = generateAdaptiveDailyMissionPlan(user, personality, chatHistory, pendingSystemMissions, recentMoods);
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

  // Cria 3 missões bônus aleatórias quando o usuário concluiu tudo.
  // Limita a 6 bônus pendentes para não inflar a lista.
  async function ensureBonusMissions(userId: string) {
    const allMissions = await storage.getMissionsByUser(userId);
    const pendingBonus = allMissions.filter((m) => m.type === "ai_bonus" && !m.completed);
    if (pendingBonus.length >= 3) return; // já tem bônus suficientes
    const existingTitles = new Set(allMissions.map((m) => m.title));
    const drafts = generateBonusMissions(existingTitles);
    for (const draft of drafts) {
      await storage.createMission({
        userId,
        title: draft.title,
        description: draft.description,
        xpReward: draft.xpReward,
        type: draft.type,
        tier: draft.tier,
      });
    }
  }

  router.get("/api/missions/daily-context", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const [user, personality, history, allMissions, recentMoods] = await Promise.all([
      storage.getUser(userId),
      storage.getPersonality(userId),
      storage.getMessagesByUser(userId, 30),
      storage.getMissionsByUser(userId),
      storage.getMoodEntriesByUser(userId, 3),
    ]);

    if (!user || !personality) throw notFound("Usuário não encontrado");

    const pendingSystemMissions = allMissions.filter((m) => m.type === "system" && !m.completed);
    const chatHistory = history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    return sendOk(res, buildDailyContext(user, personality, chatHistory, pendingSystemMissions, recentMoods));
  }));

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
    if (completed === undefined) {
      const all = await storage.getMissionsByUser(req.userId!);
      const allDone = all.length > 0 && all.every((m) => m.completed);
      if (allDone) {
        await ensureDailyMissions(req.userId!);
        await ensureBonusMissions(req.userId!);
      }
    }
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
    const totalDone = completedMissions.length;

    // Missão milestones
    const missionMilestones: Array<[number, string, string, string]> = [
      [1,  "first_mission",   "Primeira Missão",     "Completou a primeira missão. A jornada começa com uma ação."],
      [5,  "five_missions",   "Em Ritmo",            "5 missões concluídas. A Bee já reconhece seu ritmo."],
      [10, "ten_missions",    "Disciplinado",        "10 missões concluídas. Seu perfil está mais forte."],
      [20, "twenty_missions", "Força Total",         "20 missões concluídas. Consistência real e provada."],
      [50, "fifty_missions",  "Imparável",           "50 missões. Você redefiniu seus próprios limites."],
    ];
    for (const [count, type, title, description] of missionMilestones) {
      if (totalDone === count) {
        achievement = await storage.ensureAchievement(req.userId!, { type, title, description });
        break;
      }
    }

    // Dia perfeito — todas as missões diárias de hoje concluídas
    const now = new Date();
    const todayDaily = (await storage.getMissionsByUser(req.userId!)).filter((m) => {
      const d = new Date(m.createdAt);
      return m.type === "ai_daily"
        && d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
    });
    if (todayDaily.length >= 3 && todayDaily.every((m) => m.completed)) {
      storage.ensureAchievement(req.userId!, {
        type: "daily_complete",
        title: "Dia Perfeito",
        description: "Completou todas as missões diárias em um único dia. Foco total.",
      }).catch(() => {});
    }

    // Streak milestones
    const streak = updatedUser.currentStreak;
    const streakMilestones: Array<[number, string, string, string]> = [
      [3,  "streak_3",  "3 Dias Seguidos", "Presença por 3 dias consecutivos. O hábito começa a se formar."],
      [7,  "streak_7",  "Semana Sólida",   "7 dias de sequência. Hábito em formação acelerada."],
      [30, "streak_30", "Mês Imparável",   "30 dias consecutivos. Você é uma lenda no app."],
    ];
    for (const [days, type, title, description] of streakMilestones) {
      if (streak >= days) {
        storage.ensureAchievement(req.userId!, { type, title, description }).catch(() => {});
      }
    }

    // Level-up milestones
    const levelMilestones: Array<[number, string, string, string]> = [
      [2,  "level_2",  "Nível 2",   "Subiu ao nível 2. A verdadeira jornada começa."],
      [5,  "level_5",  "Nível 5",   "Nível 5 conquistado. Presença real e reconhecida."],
      [10, "level_10", "Veterano",  "Nível 10. Entre os mais evoluídos do BeeEyes."],
    ];
    for (const [level, type, title, description] of levelMilestones) {
      if (updatedUser.level >= level) {
        storage.ensureAchievement(req.userId!, { type, title, description }).catch(() => {});
      }
    }

    const allMissions = await storage.getMissionsByUser(req.userId!);
    const allDone = allMissions.length > 0 && allMissions.every((item) => item.completed);
    if (allDone) {
      await ensureDailyMissions(req.userId!);
      await ensureBonusMissions(req.userId!);
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

