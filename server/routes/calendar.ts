import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../api/async-handler";
import { sendOk } from "../api/response";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { calendarPreferences, calendarNotificationLog, users } from "../../shared/schema";
import {
  getPublicCalendarEntries,
  getPublicEntriesForMonth,
  getEntriesToNotifyTomorrow,
  getEntriesToNotifyToday,
  type PublicCalendarEntry,
} from "../services/calendarInfoService";
import { sendPushToUser } from "../push";
import { storage } from "../storage";
import { STATE_NAMES, SUPPORTED_STATES } from "../data/stateHolidays";

// ── Validation ────────────────────────────────────────────────────────────────

const prefsSchema = z.object({
  state: z.string().trim().length(2).toUpperCase().nullable().optional(),
  notifyNationalHolidays: z.boolean().optional(),
  notifyStateHolidays: z.boolean().optional(),
  notifySpecialDates: z.boolean().optional(),
  notifyOneDayBefore: z.boolean().optional(),
  notifyOnDay: z.boolean().optional(),
  enabledCategories: z.array(z.string()).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensureCalendarPreferences(userId: string) {
  const [existing] = await db
    .select()
    .from(calendarPreferences)
    .where(eq(calendarPreferences.userId, userId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(calendarPreferences).values({ userId }).returning();
  return created;
}

function parseEnabledCategories(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

// ── Router ────────────────────────────────────────────────────────────────────

export function createCalendarRouter() {
  const router = Router();

  /**
   * GET /api/calendar/public
   * Returns national holidays + state holidays + special dates for a date range.
   * Query: from (ISO), to (ISO), state (optional, 2-char UF)
   */
  router.get("/api/calendar/public", requireAuth, asyncHandler(async (req, res) => {
    const { from, to, state } = req.query as Record<string, string>;

    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    // If no state in query, check user preferences
    let resolvedState = state?.toUpperCase() || null;
    if (!resolvedState) {
      const prefs = await ensureCalendarPreferences(req.userId!).catch(() => null);
      resolvedState = prefs?.state ?? null;
    }

    const entries = getPublicCalendarEntries(fromDate, toDate, resolvedState);
    return sendOk(res, entries);
  }));

  /**
   * GET /api/calendar/month-summary
   * Returns combined view: user events + public calendar entries for a month.
   * Query: year (number), month (1-12)
   */
  router.get("/api/calendar/month-summary", requireAuth, asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    const prefs = await ensureCalendarPreferences(req.userId!).catch(() => null);
    const userState = prefs?.state ?? null;
    const enabledCats = prefs ? parseEnabledCategories(prefs.enabledCategories) as any[] : null;

    const publicEntries = getPublicEntriesForMonth(year, month, userState, enabledCats);

    return sendOk(res, {
      year,
      month,
      publicEntries,
      state: userState,
      stateNames: STATE_NAMES,
      supportedStates: SUPPORTED_STATES,
    });
  }));

  /**
   * GET /api/calendar/upcoming-public
   * Returns next N days of public entries.
   * Query: days (default 30), state (optional)
   */
  router.get("/api/calendar/upcoming-public", requireAuth, asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const prefs = await ensureCalendarPreferences(req.userId!).catch(() => null);
    const state = (req.query.state as string | undefined)?.toUpperCase() ?? prefs?.state ?? null;

    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
    const entries = getPublicCalendarEntries(from, to, state);

    return sendOk(res, { entries, state, days });
  }));

  /**
   * GET /api/calendar/preferences
   * Returns user's calendar preferences.
   */
  router.get("/api/calendar/preferences", requireAuth, asyncHandler(async (req, res) => {
    const prefs = await ensureCalendarPreferences(req.userId!);
    return sendOk(res, {
      ...prefs,
      enabledCategories: parseEnabledCategories(prefs.enabledCategories),
      stateNames: STATE_NAMES,
      supportedStates: SUPPORTED_STATES,
    });
  }));

  /**
   * PATCH /api/calendar/preferences
   * Creates or updates user's calendar preferences.
   */
  router.patch("/api/calendar/preferences", requireAuth, asyncHandler(async (req, res) => {
    const body = prefsSchema.parse(req.body);
    const existing = await ensureCalendarPreferences(req.userId!);

    const updates: Partial<typeof calendarPreferences.$inferInsert> = { updatedAt: new Date() };
    if (body.state !== undefined) updates.state = body.state ?? null;
    if (body.notifyNationalHolidays !== undefined) updates.notifyNationalHolidays = body.notifyNationalHolidays;
    if (body.notifyStateHolidays !== undefined) updates.notifyStateHolidays = body.notifyStateHolidays;
    if (body.notifySpecialDates !== undefined) updates.notifySpecialDates = body.notifySpecialDates;
    if (body.notifyOneDayBefore !== undefined) updates.notifyOneDayBefore = body.notifyOneDayBefore;
    if (body.notifyOnDay !== undefined) updates.notifyOnDay = body.notifyOnDay;
    if (body.enabledCategories !== undefined) updates.enabledCategories = JSON.stringify(body.enabledCategories);

    const [updated] = await db
      .update(calendarPreferences)
      .set(updates)
      .where(eq(calendarPreferences.id, existing.id))
      .returning();

    return sendOk(res, {
      ...updated,
      enabledCategories: parseEnabledCategories(updated.enabledCategories),
    });
  }));

  return router;
}

// ── Calendar Notification Scheduler ──────────────────────────────────────────

let calendarNotifSchedulerStarted = false;

export function startCalendarNotificationScheduler() {
  if (calendarNotifSchedulerStarted) return;
  calendarNotifSchedulerStarted = true;

  const tick = async () => {
    const now = new Date();
    // Only run between 07:55 and 08:10 (send morning notifications once per day)
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour < 7 || hour > 8 || (hour === 8 && minute > 10)) return;

    try {
      // Fetch all users with calendar preferences that have notifications enabled
      const allPrefs = await db
        .select()
        .from(calendarPreferences)
        .limit(500);

      for (const prefs of allPrefs) {
        const userId = prefs.userId;

        // Determine which entries to notify
        const entriesToCheck: Array<{ entry: PublicCalendarEntry; notifType: "one_day_before" | "on_day" }> = [];

        if (prefs.notifyOneDayBefore) {
          const tomorrowEntries = getEntriesToNotifyTomorrow(prefs.state);
          const filtered = tomorrowEntries.filter((e) => {
            if (e.type === "national_holiday" && !prefs.notifyNationalHolidays) return false;
            if (e.type === "state_holiday" && !prefs.notifyStateHolidays) return false;
            if (e.type === "special_date" && !prefs.notifySpecialDates) return false;
            return true;
          });
          filtered.forEach((entry) => entriesToCheck.push({ entry, notifType: "one_day_before" }));
        }

        if (prefs.notifyOnDay) {
          const todayEntries = getEntriesToNotifyToday(prefs.state);
          const filtered = todayEntries.filter((e) => {
            if (e.type === "national_holiday" && !prefs.notifyNationalHolidays) return false;
            if (e.type === "state_holiday" && !prefs.notifyStateHolidays) return false;
            if (e.type === "special_date" && !prefs.notifySpecialDates) return false;
            return true;
          });
          filtered.forEach((entry) => entriesToCheck.push({ entry, notifType: "on_day" }));
        }

        if (entriesToCheck.length === 0) continue;

        // Check which were already sent (deduplication)
        const toSend: typeof entriesToCheck = [];
        for (const { entry, notifType } of entriesToCheck) {
          const existing = await db
            .select()
            .from(calendarNotificationLog)
            .where(and(
              eq(calendarNotificationLog.userId, userId),
              eq(calendarNotificationLog.eventId, entry.id),
              eq(calendarNotificationLog.notificationType, notifType),
            ))
            .limit(1);

          if (existing.length === 0) {
            toSend.push({ entry, notifType });
          }
        }

        if (toSend.length === 0) continue;

        // Group and send
        const oneDayBefore = toSend.filter((x) => x.notifType === "one_day_before").map((x) => x.entry);
        const onDay = toSend.filter((x) => x.notifType === "on_day").map((x) => x.entry);

        if (oneDayBefore.length > 0) {
          await sendCalendarNotification(userId, "one_day_before", oneDayBefore);
        }
        if (onDay.length > 0) {
          await sendCalendarNotification(userId, "on_day", onDay);
        }

        // Log sent notifications
        for (const { entry, notifType } of toSend) {
          await db.insert(calendarNotificationLog).values({
            userId,
            eventId: entry.id,
            notificationType: notifType,
          }).onConflictDoNothing().catch(() => {});
        }
      }
    } catch (err) {
      console.error("[CalendarNotifScheduler] Error:", err);
    }
  };

  // Run every 10 minutes
  setInterval(tick, 10 * 60 * 1000).unref?.();
  tick();
}

async function sendCalendarNotification(
  userId: string,
  type: "one_day_before" | "on_day",
  entries: PublicCalendarEntry[],
) {
  const holidays = entries.filter((e) => e.type === "national_holiday" || e.type === "state_holiday");
  const specials = entries.filter((e) => e.type === "special_date");

  let title: string;
  let body: string;

  if (type === "one_day_before") {
    if (entries.length === 1) {
      const e = entries[0];
      title = `BeeEyes 🐝 Amanhã é especial`;
      body = `${e.emoji} Amanhã é ${e.title}. ${e.description.slice(0, 80)}`;
    } else {
      title = `BeeEyes 🐝 ${entries.length} datas amanhã`;
      const names = entries.slice(0, 3).map((e) => `${e.emoji} ${e.title}`).join(", ");
      body = `Amanhã: ${names}${entries.length > 3 ? ` e mais ${entries.length - 3}` : ""}`;
    }
  } else {
    if (entries.length === 1) {
      const e = entries[0];
      title = `BeeEyes 🐝 Hoje é ${e.title}`;
      body = `${e.emoji} ${e.description.slice(0, 100)}`;
    } else {
      title = `BeeEyes 🐝 ${entries.length} datas hoje`;
      const names = entries.slice(0, 3).map((e) => `${e.emoji} ${e.title}`).join(", ");
      body = `Hoje: ${names}${entries.length > 3 ? ` e mais ${entries.length - 3}` : ""}`;
    }
  }

  await sendPushToUser(userId, title, body, {
    source: "bee-calendar",
    screen: "/(tabs)/colmeia",
    notifType: type,
  }, "bee-alerts").catch(() => {});
}
