import { Router } from "express";
import { and, count, gte, lt, sql, desc, eq, ne } from "drizzle-orm";
import { asyncHandler } from "../api/async-handler";
import { sendOk } from "../api/response";
import { db } from "../db";
import {
  users, messages, posts, communities, communityMembers,
  achievements, notes, calendarEvents, financeTransactions,
  userConnections, moodEntries,
} from "../../shared/schema";
import { requireAdmin } from "../middleware/requireAdmin";

export function createAdminRouter() {
  const router = Router();

  // ── Dashboard summary ──────────────────────────────────────────────────────
  router.get("/api/admin/dashboard", requireAdmin, asyncHandler(async (_req, res) => {
    const now = new Date();
    const today      = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday  = new Date(today.getTime() - 86400_000);
    const week       = new Date(today.getTime() - 7  * 86400_000);
    const month      = new Date(today.getTime() - 30 * 86400_000);
    const active24h  = new Date(now.getTime() - 24  * 3600_000);
    const active7d   = new Date(now.getTime() - 7   * 86400_000);
    const active30d  = new Date(now.getTime() - 30  * 86400_000);

    const [
      [totalUsers],
      [newToday],
      [newThisWeek],
      [newThisMonth],
      [active24hCount],
      [active7dCount],
      [active30dCount],
      [totalMessages],
      [msgsToday],
      [msgsThisWeek],
      [totalPosts],
      [totalCommunities],
      [totalNotes],
      [totalEvents],
      [totalTransactions],
      [totalAchievements],
      [totalConnections],
      [totalMoods],
      [onboardedUsers],
    ] = await Promise.all([
      db.select({ v: count() }).from(users),
      db.select({ v: count() }).from(users).where(gte(users.createdAt, today)),
      db.select({ v: count() }).from(users).where(gte(users.createdAt, week)),
      db.select({ v: count() }).from(users).where(gte(users.createdAt, month)),
      db.select({ v: count() }).from(users).where(gte(users.lastActiveAt, active24h)),
      db.select({ v: count() }).from(users).where(gte(users.lastActiveAt, active7d)),
      db.select({ v: count() }).from(users).where(gte(users.lastActiveAt, active30d)),
      db.select({ v: count() }).from(messages).where(eq(messages.role, "user")),
      db.select({ v: count() }).from(messages).where(and(eq(messages.role, "user"), gte(messages.createdAt, today))),
      db.select({ v: count() }).from(messages).where(and(eq(messages.role, "user"), gte(messages.createdAt, week))),
      db.select({ v: count() }).from(posts),
      db.select({ v: count() }).from(communities),
      db.select({ v: count() }).from(notes),
      db.select({ v: count() }).from(calendarEvents),
      db.select({ v: count() }).from(financeTransactions),
      db.select({ v: count() }).from(achievements),
      db.select({ v: count() }).from(userConnections).where(eq(userConnections.status, "accepted")),
      db.select({ v: count() }).from(moodEntries),
      db.select({ v: count() }).from(users).where(eq(users.onboardingCompleted, true)),
    ]);

    // Avg messages per user
    const avgMsgsPerUser = totalUsers.v > 0
      ? Math.round((totalMessages.v / totalUsers.v) * 10) / 10
      : 0;

    // Onboarding completion rate
    const onboardingRate = totalUsers.v > 0
      ? Math.round((onboardedUsers.v / totalUsers.v) * 100)
      : 0;

    // Retention: active last 7d / registered in last 30d
    const retentionRate = newThisMonth.v > 0
      ? Math.round((active7dCount.v / Math.max(totalUsers.v, 1)) * 100)
      : 0;

    return sendOk(res, {
      users: {
        total: totalUsers.v,
        newToday: newToday.v,
        newThisWeek: newThisWeek.v,
        newThisMonth: newThisMonth.v,
        active24h: active24hCount.v,
        active7d: active7dCount.v,
        active30d: active30dCount.v,
        onboarded: onboardedUsers.v,
        onboardingRate,
        retentionRate,
      },
      messages: {
        total: totalMessages.v,
        today: msgsToday.v,
        thisWeek: msgsThisWeek.v,
        avgPerUser: avgMsgsPerUser,
      },
      content: {
        posts: totalPosts.v,
        communities: totalCommunities.v,
        connections: totalConnections.v,
        achievements: totalAchievements.v,
        moods: totalMoods.v,
      },
      colmeia: {
        notes: totalNotes.v,
        events: totalEvents.v,
        transactions: totalTransactions.v,
      },
    });
  }));

  // ── User growth — last 30 days ─────────────────────────────────────────────
  router.get("/api/admin/growth", requireAdmin, asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        day: sql<string>`DATE(created_at)`.as("day"),
        count: count(),
      })
      .from(users)
      .where(gte(users.createdAt, new Date(Date.now() - 30 * 86400_000)))
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    return sendOk(res, rows);
  }));

  // ── Daily active users — last 30 days ─────────────────────────────────────
  router.get("/api/admin/dau", requireAdmin, asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        day: sql<string>`DATE(created_at)`.as("day"),
        count: count(),
      })
      .from(messages)
      .where(and(
        eq(messages.role, "user"),
        gte(messages.createdAt, new Date(Date.now() - 30 * 86400_000)),
      ))
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    return sendOk(res, rows);
  }));

  // ── Top users by activity ──────────────────────────────────────────────────
  router.get("/api/admin/top-users", requireAdmin, asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        totalMessages: users.totalMessagesCount,
        currentStreak: users.currentStreak,
        longestStreak: users.longestStreak,
        lastActiveAt: users.lastActiveAt,
        createdAt: users.createdAt,
        onboardingCompleted: users.onboardingCompleted,
      })
      .from(users)
      .orderBy(desc(users.totalMessagesCount))
      .limit(20);

    return sendOk(res, rows);
  }));

  // ── Recent registrations ───────────────────────────────────────────────────
  router.get("/api/admin/recent-users", requireAdmin, asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        createdAt: users.createdAt,
        lastActiveAt: users.lastActiveAt,
        onboardingCompleted: users.onboardingCompleted,
        totalMessagesCount: users.totalMessagesCount,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(15);

    return sendOk(res, rows);
  }));

  // ── Streak distribution ────────────────────────────────────────────────────
  router.get("/api/admin/streaks", requireAdmin, asyncHandler(async (_req, res) => {
    const [[zero], [low], [mid], [high], [top]] = await Promise.all([
      db.select({ v: count() }).from(users).where(eq(users.currentStreak, 0)),
      db.select({ v: count() }).from(users).where(and(gte(users.currentStreak, 1),  lt(users.currentStreak, 7))),
      db.select({ v: count() }).from(users).where(and(gte(users.currentStreak, 7),  lt(users.currentStreak, 30))),
      db.select({ v: count() }).from(users).where(and(gte(users.currentStreak, 30), lt(users.currentStreak, 100))),
      db.select({ v: count() }).from(users).where(gte(users.currentStreak, 100)),
    ]);

    return sendOk(res, [
      { label: "Sem streak", value: zero.v },
      { label: "1–6 dias", value: low.v },
      { label: "7–29 dias", value: mid.v },
      { label: "30–99 dias", value: high.v },
      { label: "100+ dias", value: top.v },
    ]);
  }));

  // ── Hourly message heatmap (last 7 days) ─────────────────────────────────
  router.get("/api/admin/heatmap", requireAdmin, asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM created_at)::int`.as("hour"),
        count: count(),
      })
      .from(messages)
      .where(and(
        eq(messages.role, "user"),
        gte(messages.createdAt, new Date(Date.now() - 7 * 86400_000)),
      ))
      .groupBy(sql`EXTRACT(HOUR FROM created_at)`)
      .orderBy(sql`EXTRACT(HOUR FROM created_at)`);

    return sendOk(res, rows);
  }));

  // ── Manage users (list + toggle admin) ────────────────────────────────────
  router.get("/api/admin/users", requireAdmin, asyncHandler(async (req, res) => {
    const page = Math.max(0, parseInt(req.query.page as string) || 0);
    const limit = 50;

    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        createdAt: users.createdAt,
        lastActiveAt: users.lastActiveAt,
        totalMessagesCount: users.totalMessagesCount,
        currentStreak: users.currentStreak,
        onboardingCompleted: users.onboardingCompleted,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(page * limit);

    const [{ v: total }] = await db.select({ v: count() }).from(users);

    return sendOk(res, { users: rows, total, page, limit });
  }));

  router.patch("/api/admin/users/:id/toggle-admin", requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, id));
    if (!user) return sendOk(res, { error: "User not found" });

    await db.update(users).set({ isAdmin: !user.isAdmin }).where(eq(users.id, id));
    return sendOk(res, { isAdmin: !user.isAdmin });
  }));

  return router;
}
