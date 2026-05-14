import { Router } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../api/async-handler";
import { notFound } from "../api/errors";
import { sendOk } from "../api/response";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import {
  healthProfiles,
  workoutPlans,
  workoutSessions,
  calendarEvents,
  alarmReminders,
  type WorkoutDayPlan,
} from "../../shared/schema";
import {
  EXERCISE_LIBRARY,
  MUSCLE_GROUP_LABELS,
  EQUIPMENT_LABELS,
  findAlternatives,
} from "../data/exerciseLibrary";
import {
  buildWorkoutPlan,
  buildWeeklySummary,
  GOAL_LABELS,
  LEVEL_LABELS,
  SPLIT_LABELS,
  WEEKDAY_LABELS_PT,
  WEEK_DAYS,
  type HealthGoal,
  type WeekDay,
  type SplitType,
  type BuildPlanInput,
} from "../services/workoutPlanService";
import type { ExerciseLevel, EquipmentType } from "../data/exerciseLibrary";

// ── Validation ────────────────────────────────────────────────────────────────

const weekDayEnum = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
const goalEnum = z.enum([
  "saude_geral", "condicionamento", "ganho_forca", "resistencia",
  "mobilidade", "perda_gordura", "hipertrofia", "retorno_treinos", "outro",
]);
const levelEnum = z.enum(["iniciante", "intermediario", "avancado"]);
const equipmentEnum = z.enum([
  "aparelho", "halter", "barra", "peso_corporal", "cabo",
  "esteira", "bicicleta", "eliptico", "outro", "misto",
]);
const splitEnum = z.enum([
  "full_body", "upper_lower", "push_pull_legs", "abc",
  "muscle_group", "cardio_musculacao", "custom",
]);

const profileSchema = z.object({
  healthGoal: goalEnum.optional(),
  level: levelEnum.optional(),
  trainingDays: z.array(weekDayEnum).optional(),
  restDays: z.array(weekDayEnum).optional(),
  preferredWorkoutTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  equipmentPreference: equipmentEnum.optional(),
  reminderEnabled: z.boolean().optional(),
  reminderMinutesBefore: z.number().int().min(0).max(180).optional(),
  avoidExercises: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const exerciseSchema = z.object({
  name: z.string().min(1).max(120),
  machine: z.string().max(120).optional(),
  muscleGroup: z.string().max(40).optional(),
  equipment: z.string().max(40).optional(),
  sets: z.number().int().min(1).max(20).optional(),
  reps: z.string().max(40).optional(),
  durationMin: z.number().int().min(1).max(180).optional(),
  restSeconds: z.number().int().min(0).max(600).optional(),
  notes: z.string().max(600).optional(),
  alternatives: z.array(z.string()).optional(),
});

const dayPlanSchema = z.object({
  day: weekDayEnum,
  title: z.string().min(1).max(120),
  focus: z.string().max(120).optional(),
  type: z.enum(["training", "rest"]),
  exercises: z.array(exerciseSchema),
});

const createPlanSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  goal: goalEnum.optional(),
  level: levelEnum.optional(),
  splitType: splitEnum.optional(),
  trainingDays: z.array(weekDayEnum).min(1).max(7),
  restDays: z.array(weekDayEnum).optional(),
  equipmentPreference: equipmentEnum.optional(),
  avoidExercises: z.array(z.string()).optional(),
  createdBy: z.enum(["user", "bee"]).optional(),
  days: z.array(dayPlanSchema).optional(),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  goal: goalEnum.optional(),
  level: levelEnum.optional(),
  splitType: splitEnum.optional(),
  trainingDays: z.array(weekDayEnum).optional(),
  restDays: z.array(weekDayEnum).optional(),
  days: z.array(dayPlanSchema).optional(),
  active: z.boolean().optional(),
});

const sessionSchema = z.object({
  workoutPlanId: z.string().optional().nullable(),
  dayKey: weekDayEnum,
  date: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(0).max(600).optional(),
  exercisesCompleted: z.number().int().min(0).max(50).optional(),
  exercisesSkipped: z.number().int().min(0).max(50).optional(),
  effortLevel: z.enum(["leve", "moderado", "intenso"]).optional(),
  mood: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
  exerciseLog: z.array(z.object({
    name: z.string(),
    done: z.boolean(),
    skipped: z.boolean().optional(),
  })).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensureHealthProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(healthProfiles)
    .where(eq(healthProfiles.userId, userId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(healthProfiles).values({ userId }).returning();
  return created;
}

// ── Router ────────────────────────────────────────────────────────────────────

export function createHealthRouter() {
  const router = Router();

  /**
   * GET /api/health/exercises
   * Returns the exercise library with optional muscle/equipment filters.
   */
  router.get("/api/health/exercises", requireAuth, asyncHandler(async (req, res) => {
    const { muscle, equipment } = req.query as Record<string, string>;
    let list = EXERCISE_LIBRARY;
    if (muscle) list = list.filter((e) => e.muscleGroup === muscle);
    if (equipment) list = list.filter((e) => e.equipment === equipment);
    return sendOk(res, {
      exercises: list,
      muscleGroups: MUSCLE_GROUP_LABELS,
      equipmentTypes: EQUIPMENT_LABELS,
      goals: GOAL_LABELS,
      levels: LEVEL_LABELS,
      splits: SPLIT_LABELS,
      weekDays: WEEKDAY_LABELS_PT,
    });
  }));

  /**
   * GET /api/health/exercises/:id/alternatives
   * Returns alternative exercises for substitution.
   */
  router.get("/api/health/exercises/:id/alternatives", requireAuth, asyncHandler(async (req, res) => {
    const equipmentPref = req.query.equipment as EquipmentType | undefined;
    const alts = findAlternatives(req.params.id, equipmentPref);
    return sendOk(res, { alternatives: alts });
  }));

  /**
   * GET /api/health/profile
   * Returns user's health profile.
   */
  router.get("/api/health/profile", requireAuth, asyncHandler(async (req, res) => {
    const profile = await ensureHealthProfile(req.userId!);
    return sendOk(res, profile);
  }));

  /**
   * PATCH /api/health/profile
   * Creates or updates user's health profile.
   */
  router.patch("/api/health/profile", requireAuth, asyncHandler(async (req, res) => {
    const body = profileSchema.parse(req.body);
    const existing = await ensureHealthProfile(req.userId!);
    const updates: Partial<typeof healthProfiles.$inferInsert> = { updatedAt: new Date() };
    if (body.healthGoal !== undefined) updates.healthGoal = body.healthGoal;
    if (body.level !== undefined) updates.level = body.level;
    if (body.trainingDays !== undefined) updates.trainingDays = body.trainingDays;
    if (body.restDays !== undefined) updates.restDays = body.restDays;
    if (body.preferredWorkoutTime !== undefined) updates.preferredWorkoutTime = body.preferredWorkoutTime ?? null;
    if (body.equipmentPreference !== undefined) updates.equipmentPreference = body.equipmentPreference;
    if (body.reminderEnabled !== undefined) updates.reminderEnabled = body.reminderEnabled;
    if (body.reminderMinutesBefore !== undefined) updates.reminderMinutesBefore = body.reminderMinutesBefore;
    if (body.avoidExercises !== undefined) updates.avoidExercises = body.avoidExercises;
    if (body.notes !== undefined) updates.notes = body.notes ?? null;
    const [updated] = await db
      .update(healthProfiles)
      .set(updates)
      .where(eq(healthProfiles.id, existing.id))
      .returning();
    return sendOk(res, updated);
  }));

  /**
   * GET /api/health/workout-plans
   * Returns all workout plans for the user.
   */
  router.get("/api/health/workout-plans", requireAuth, asyncHandler(async (req, res) => {
    const list = await db
      .select()
      .from(workoutPlans)
      .where(eq(workoutPlans.userId, req.userId!))
      .orderBy(desc(workoutPlans.createdAt));
    return sendOk(res, { plans: list });
  }));

  /**
   * GET /api/health/workout-plans/active
   * Returns active workout plan.
   */
  router.get("/api/health/workout-plans/active", requireAuth, asyncHandler(async (req, res) => {
    const [active] = await db
      .select()
      .from(workoutPlans)
      .where(and(eq(workoutPlans.userId, req.userId!), eq(workoutPlans.active, true)))
      .orderBy(desc(workoutPlans.createdAt))
      .limit(1);
    return sendOk(res, { plan: active ?? null });
  }));

  /**
   * POST /api/health/workout-plans
   * Creates a workout plan. If `days` is not provided, generates one.
   */
  router.post("/api/health/workout-plans", requireAuth, asyncHandler(async (req, res) => {
    const body = createPlanSchema.parse(req.body);

    let days: WorkoutDayPlan[];
    let splitType: SplitType;
    let goal: HealthGoal = body.goal ?? "saude_geral";
    let level: ExerciseLevel = body.level ?? "iniciante";
    let trainingDays = body.trainingDays as WeekDay[];
    let restDays = (body.restDays ?? WEEK_DAYS.filter((d) => !body.trainingDays.includes(d))) as WeekDay[];

    if (body.days && body.days.length) {
      days = body.days as WorkoutDayPlan[];
      splitType = body.splitType ?? "custom";
    } else {
      const built = buildWorkoutPlan({
        trainingDays,
        restDays,
        goal,
        level,
        equipmentPreference: body.equipmentPreference,
        splitType: body.splitType,
        avoidExercises: body.avoidExercises,
        name: body.name,
      } as BuildPlanInput);
      days = built.days;
      splitType = built.splitType;
      trainingDays = built.trainingDays;
      restDays = built.restDays;
    }

    // Deactivate previous active plan
    await db
      .update(workoutPlans)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(workoutPlans.userId, req.userId!), eq(workoutPlans.active, true)));

    const [created] = await db.insert(workoutPlans).values({
      userId: req.userId!,
      name: body.name ?? `Treino ${trainingDays.length}x por semana`,
      goal,
      level,
      splitType,
      trainingDays,
      restDays,
      days,
      active: true,
      createdBy: body.createdBy ?? "user",
    }).returning();

    return sendOk(res, created);
  }));

  /**
   * PUT /api/health/workout-plans/:id
   * Updates a workout plan.
   */
  router.put("/api/health/workout-plans/:id", requireAuth, asyncHandler(async (req, res) => {
    const body = updatePlanSchema.parse(req.body);
    const [existing] = await db
      .select()
      .from(workoutPlans)
      .where(and(eq(workoutPlans.id, req.params.id), eq(workoutPlans.userId, req.userId!)))
      .limit(1);
    if (!existing) throw notFound("Plano de treino não encontrado");

    const updates: Partial<typeof workoutPlans.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.goal !== undefined) updates.goal = body.goal;
    if (body.level !== undefined) updates.level = body.level;
    if (body.splitType !== undefined) updates.splitType = body.splitType;
    if (body.trainingDays !== undefined) updates.trainingDays = body.trainingDays;
    if (body.restDays !== undefined) updates.restDays = body.restDays;
    if (body.days !== undefined) updates.days = body.days as WorkoutDayPlan[];
    if (body.active !== undefined) {
      updates.active = body.active;
      if (body.active) {
        // Deactivate others
        await db
          .update(workoutPlans)
          .set({ active: false, updatedAt: new Date() })
          .where(and(
            eq(workoutPlans.userId, req.userId!),
            eq(workoutPlans.active, true),
          ));
      }
    }
    const [updated] = await db
      .update(workoutPlans)
      .set(updates)
      .where(eq(workoutPlans.id, req.params.id))
      .returning();
    return sendOk(res, updated);
  }));

  /**
   * DELETE /api/health/workout-plans/:id
   */
  router.delete("/api/health/workout-plans/:id", requireAuth, asyncHandler(async (req, res) => {
    const [existing] = await db
      .select()
      .from(workoutPlans)
      .where(and(eq(workoutPlans.id, req.params.id), eq(workoutPlans.userId, req.userId!)))
      .limit(1);
    if (!existing) throw notFound("Plano de treino não encontrado");
    await db.delete(workoutPlans).where(eq(workoutPlans.id, req.params.id));
    return sendOk(res, { deleted: true });
  }));

  /**
   * POST /api/health/workout-plans/:id/complete
   * Marks a workout session as completed.
   */
  router.post("/api/health/workout-plans/:id/complete", requireAuth, asyncHandler(async (req, res) => {
    const body = sessionSchema.parse({ ...req.body, workoutPlanId: req.params.id });
    const [created] = await db.insert(workoutSessions).values({
      userId: req.userId!,
      workoutPlanId: req.params.id,
      dayKey: body.dayKey,
      date: body.date ? new Date(body.date) : new Date(),
      completed: true,
      durationMinutes: body.durationMinutes,
      exercisesCompleted: body.exercisesCompleted ?? 0,
      exercisesSkipped: body.exercisesSkipped ?? 0,
      effortLevel: body.effortLevel,
      mood: body.mood,
      notes: body.notes,
      exerciseLog: body.exerciseLog ?? [],
    }).returning();
    return sendOk(res, created);
  }));

  /**
   * POST /api/health/workout-plans/:id/sync-calendar
   * Cria eventos no calendário e (opcionalmente) alarmes de lembrete
   * para todos os dias de treino do plano nas próximas N semanas.
   * Body: { weeks?: number (default 4), time?: "HH:MM", reminderMinutesBefore?: number }
   */
  router.post("/api/health/workout-plans/:id/sync-calendar", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const weeks = Math.min(12, Math.max(1, parseInt(req.body?.weeks) || 4));
    const time = (typeof req.body?.time === "string" && /^\d{2}:\d{2}$/.test(req.body.time)) ? req.body.time : "18:30";
    const reminderMinutes = typeof req.body?.reminderMinutesBefore === "number" ? req.body.reminderMinutesBefore : null;

    const [plan] = await db
      .select()
      .from(workoutPlans)
      .where(and(eq(workoutPlans.id, req.params.id), eq(workoutPlans.userId, userId)))
      .limit(1);
    if (!plan) throw notFound("Plano de treino não encontrado");

    const [hour, minute] = time.split(":").map(Number);
    const trainingDays = plan.trainingDays as WeekDay[];
    const dayToJsDow: Record<WeekDay, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    };

    const eventsCreated: any[] = [];
    const alarmsCreated: any[] = [];
    const now = new Date();

    for (let w = 0; w < weeks; w++) {
      for (const day of trainingDays) {
        const targetDow = dayToJsDow[day];
        const eventDate = new Date(now);
        const diff = (targetDow - now.getDay() + 7) % 7 + w * 7;
        eventDate.setDate(now.getDate() + diff);
        eventDate.setHours(hour, minute, 0, 0);
        if (eventDate <= now) continue;

        const dayPlan = (plan.days as WorkoutDayPlan[]).find((d) => d.day === day);
        const title = `🏋️ ${dayPlan?.title ?? "Treino"}`;
        const description = dayPlan?.focus ?? "Sessão de treino";

        const [event] = await db.insert(calendarEvents).values({
          userId,
          title,
          description,
          startAt: eventDate,
          endAt: new Date(eventDate.getTime() + 60 * 60 * 1000),
          allDay: false,
          color: "primary",
        }).returning();
        eventsCreated.push(event);

        if (reminderMinutes !== null && reminderMinutes >= 0) {
          const alarmAt = new Date(eventDate.getTime() - reminderMinutes * 60 * 1000);
          if (alarmAt > now) {
            const [alarm] = await db.insert(alarmReminders).values({
              userId,
              title: `Lembrete: ${title}`,
              message: `Seu treino começa em ${reminderMinutes} minutos 🐝💪`,
              kind: "appointment",
              scheduledAt: eventDate,
              nextTriggerAt: alarmAt,
              repeatType: "once",
              active: true,
              linkedEventId: event.id,
              reminderOffsetMinutes: reminderMinutes,
            }).returning();
            alarmsCreated.push(alarm);
          }
        }
      }
    }

    return sendOk(res, {
      eventsCreated: eventsCreated.length,
      alarmsCreated: alarmsCreated.length,
      weeks,
    });
  }));

  /**
   * GET /api/health/sessions
   * Returns recent workout sessions.
   */
  router.get("/api/health/sessions", requireAuth, asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sessions = await db
      .select()
      .from(workoutSessions)
      .where(and(eq(workoutSessions.userId, req.userId!), gte(workoutSessions.date, since)))
      .orderBy(desc(workoutSessions.date))
      .limit(100);
    return sendOk(res, { sessions });
  }));

  /**
   * GET /api/health/summary
   * Returns a friendly weekly summary.
   */
  router.get("/api/health/summary", requireAuth, asyncHandler(async (req, res) => {
    const [active] = await db
      .select()
      .from(workoutPlans)
      .where(and(eq(workoutPlans.userId, req.userId!), eq(workoutPlans.active, true)))
      .limit(1);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sessions = await db
      .select()
      .from(workoutSessions)
      .where(and(eq(workoutSessions.userId, req.userId!), gte(workoutSessions.date, weekAgo)));

    if (!active) {
      return sendOk(res, {
        plan: null,
        summary: {
          plannedThisWeek: 0,
          completedThisWeek: sessions.filter((s) => s.completed).length,
          consistencyRatio: 0,
          nextWorkoutDay: null,
        },
        recentSessions: sessions,
      });
    }

    const summary = buildWeeklySummary({
      name: active.name,
      goal: active.goal as HealthGoal,
      level: active.level as ExerciseLevel,
      splitType: active.splitType as SplitType,
      trainingDays: (active.trainingDays as string[]) as WeekDay[],
      restDays: (active.restDays as string[]) as WeekDay[],
      days: active.days as WorkoutDayPlan[],
    }, sessions.map((s) => ({ dayKey: s.dayKey, date: s.date, completed: s.completed })));

    return sendOk(res, { plan: active, summary, recentSessions: sessions });
  }));

  return router;
}
