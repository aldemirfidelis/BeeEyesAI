import { Router } from "express";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { asyncHandler } from "../api/async-handler";
import { badRequest, notFound } from "../api/errors";
import { sendError, sendOk } from "../api/response";
import { createDueAlarmReactivationPrompts, getAlarmReactivationReviewAt } from "../alarm-reactivation";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { sendPushToUser } from "../push";
import {
  alarmReminders,
  calendarEvents,
  financeTransactions,
  notes,
  userIntegrations,
} from "../../shared/schema";

const ALARM_KINDS = new Set(["alarm", "reminder", "medicine", "appointment"]);
const ALARM_REPEAT_TYPES = new Set(["once", "daily", "weekly", "interval"]);

function normalizeAlarmKind(value: unknown) {
  return typeof value === "string" && ALARM_KINDS.has(value) ? value : "alarm";
}

function normalizeRepeatType(value: unknown) {
  return typeof value === "string" && ALARM_REPEAT_TYPES.has(value) ? value : "once";
}

function normalizeRepeatDays(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    .sort((a, b) => a - b);
}

function computeWeekdayTrigger(base: Date, repeatDays: number[], includeBase: boolean) {
  const now = new Date();
  const next = new Date(base);
  if (!includeBase) next.setDate(next.getDate() + 1);

  for (let i = 0; i < 14; i += 1) {
    if (repeatDays.includes(next.getDay()) && next > now) return next;
    next.setDate(next.getDate() + 1);
  }

  return null;
}

function computeInitialAlarmTrigger(start: Date, repeatDays: number[]) {
  if (repeatDays.length === 0) return start;
  return computeWeekdayTrigger(start, repeatDays, true) ?? start;
}

function computeNextAlarmTrigger(current: Date, repeatType: string, intervalMinutes?: number | null, repeatDays: number[] = []): Date | null {
  if (repeatType === "once") return null;
  if (repeatDays.length > 0) return computeWeekdayTrigger(current, repeatDays, false);

  const next = new Date(current);
  if (repeatType === "daily") next.setDate(next.getDate() + 1);
  else if (repeatType === "weekly") next.setDate(next.getDate() + 7);
  else if (repeatType === "interval") next.setMinutes(next.getMinutes() + Math.max(1, intervalMinutes ?? 60));
  else return null;

  const now = new Date();
  while (next <= now) {
    if (repeatType === "daily") next.setDate(next.getDate() + 1);
    else if (repeatType === "weekly") next.setDate(next.getDate() + 7);
    else next.setMinutes(next.getMinutes() + Math.max(1, intervalMinutes ?? 60));
  }
  return next;
}

function buildAlarmBody(row: { kind: string; title: string; message: string | null }) {
  if (row.message?.trim()) return row.message.trim();
  if (row.kind === "medicine") return `Hora de tomar: ${row.title}`;
  if (row.kind === "appointment") return `Compromisso agora: ${row.title}`;
  return row.title;
}

// ── Google Calendar OAuth ─────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

function getRedirectUri(req: any): string {
  const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
  const host = req.headers["x-forwarded-host"] ?? req.get("host");
  return `${proto}://${host}/api/colmeia/google/callback`;
}

async function refreshGoogleToken(integration: { refreshToken: string | null }): Promise<{ accessToken: string; expiresAt: Date } | null> {
  if (!integration.refreshToken) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: integration.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    };
  } catch {
    return null;
  }
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const [integration] = await db
    .select()
    .from(userIntegrations)
    .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "google_calendar")))
    .limit(1);

  if (!integration?.accessToken) return null;

  const now = new Date();
  if (integration.tokenExpiresAt && integration.tokenExpiresAt > now) {
    return integration.accessToken;
  }

  const refreshed = await refreshGoogleToken(integration);
  if (!refreshed) return null;

  await db
    .update(userIntegrations)
    .set({ accessToken: refreshed.accessToken, tokenExpiresAt: refreshed.expiresAt, updatedAt: new Date() })
    .where(eq(userIntegrations.id, integration.id));

  return refreshed.accessToken;
}

async function syncFromGoogleCalendar(userId: string, accessToken: string, from: Date, to: Date): Promise<void> {
  const items: any[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      ...(pageToken ? { pageToken } : {}),
    });

    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;

    const data = await res.json() as any;
    items.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  if (items.length === 0) return;

  const googleIds = items.map((i: any) => i.id as string).filter(Boolean);
  const existing = await db
    .select({ id: calendarEvents.id, googleEventId: calendarEvents.googleEventId })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.userId, userId), inArray(calendarEvents.googleEventId, googleIds)));

  const existingMap = new Map(existing.map((e) => [e.googleEventId!, e.id]));

  for (const item of items) {
    if (!item.id) continue;

    if (item.status === "cancelled") {
      if (existingMap.has(item.id)) {
        await db.delete(calendarEvents).where(eq(calendarEvents.id, existingMap.get(item.id)!)).catch(() => {});
      }
      continue;
    }

    const allDay = !!item.start?.date && !item.start?.dateTime;
    const startAt = item.start?.dateTime ? new Date(item.start.dateTime) : new Date(item.start?.date ?? Date.now());
    const endAt = item.end?.dateTime ? new Date(item.end.dateTime) : item.end?.date ? new Date(item.end.date) : null;

    const eventData = {
      title: (item.summary as string | undefined) ?? "(sem título)",
      description: (item.description as string | undefined) ?? null,
      startAt,
      endAt,
      allDay,
      location: (item.location as string | undefined) ?? null,
      googleEventId: item.id as string,
    };

    if (existingMap.has(item.id)) {
      await db.update(calendarEvents).set(eventData).where(eq(calendarEvents.id, existingMap.get(item.id)!)).catch(() => {});
    } else {
      await db.insert(calendarEvents).values({ userId, color: "primary", ...eventData }).catch(() => {});
    }
  }
}

async function syncInitialGoogleCalendarImport(userId: string, accessToken: string) {
  const now = new Date();
  const from = new Date(now);
  from.setFullYear(now.getFullYear() - 10);
  const to = new Date(now);
  to.setFullYear(now.getFullYear() + 10);
  await syncFromGoogleCalendar(userId, accessToken, from, to);
}

// ── Router ────────────────────────────────────────────────────────────────────

export function createColmeiaRouter(): Router {
  const router = Router();

  // ── Google Calendar OAuth ─────────────────────────────────────────────────

  router.get("/api/colmeia/google/auth-url", requireAuth, asyncHandler(async (req, res) => {
    if (!GOOGLE_CLIENT_ID) return sendError(res, 503, "CONFIG_ERROR", "Google Calendar não configurado");
    const redirectUri = getRedirectUri(req);
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: `openid email ${CALENDAR_SCOPE}`,
      access_type: "offline",
      prompt: "consent",
      state: req.userId!,
    });
    return sendOk(res, { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  }));

  router.get("/api/colmeia/google/callback", asyncHandler(async (req, res) => {
    const { code, state: userId, error } = req.query as Record<string, string>;
    if (error || !code || !userId) {
      return res.redirect("/?colmeia=google_error");
    }

    const redirectUri = getRedirectUri(req);
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) return res.redirect("/?colmeia=google_error");
    const tokenData = await tokenRes.json() as any;

    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000);
    const existing = await db
      .select({ id: userIntegrations.id, refreshToken: userIntegrations.refreshToken })
      .from(userIntegrations)
      .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "google_calendar")))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userIntegrations)
        .set({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token ?? existing[0].refreshToken ?? null,
          tokenExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(userIntegrations.id, existing[0].id));
    } else {
      await db.insert(userIntegrations).values({
        userId,
        provider: "google_calendar",
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt: expiresAt,
      });
    }

    await syncInitialGoogleCalendarImport(userId, tokenData.access_token).catch(() => {});

    return res.redirect("/?colmeia=google_ok");
  }));

  router.delete("/api/colmeia/google/disconnect", requireAuth, asyncHandler(async (req, res) => {
    await db
      .delete(userIntegrations)
      .where(and(eq(userIntegrations.userId, req.userId!), eq(userIntegrations.provider, "google_calendar")));
    return sendOk(res, { disconnected: true });
  }));

  router.get("/api/colmeia/google/status", requireAuth, asyncHandler(async (req, res) => {
    const [row] = await db
      .select({ id: userIntegrations.id, updatedAt: userIntegrations.updatedAt })
      .from(userIntegrations)
      .where(and(eq(userIntegrations.userId, req.userId!), eq(userIntegrations.provider, "google_calendar")))
      .limit(1);
    return sendOk(res, { connected: !!row, connectedAt: row?.updatedAt ?? null });
  }));

  // ── Calendar Events ───────────────────────────────────────────────────────

  router.get("/api/colmeia/events", requireAuth, asyncHandler(async (req, res) => {
    const { from, to } = req.query as Record<string, string>;
    const userId = req.userId!;

    if (from && to) {
      const accessToken = await getValidAccessToken(userId);
      if (accessToken) {
        await syncFromGoogleCalendar(userId, accessToken, new Date(from), new Date(to)).catch(() => {});
      }
    }

    let rows;
    if (from && to) {
      rows = await db
        .select()
        .from(calendarEvents)
        .where(and(
          eq(calendarEvents.userId, userId),
          gte(calendarEvents.startAt, new Date(from)),
          lte(calendarEvents.startAt, new Date(to)),
        ))
        .orderBy(calendarEvents.startAt);
    } else {
      rows = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.userId, userId))
        .orderBy(desc(calendarEvents.startAt))
        .limit(50);
    }

    return sendOk(res, rows);
  }));

  router.post("/api/colmeia/events", requireAuth, asyncHandler(async (req, res) => {
    const { title, description, startAt, endAt, allDay, location, color } = req.body ?? {};
    if (!title?.trim() || !startAt) throw badRequest("title e startAt são obrigatórios");

    const [event] = await db
      .insert(calendarEvents)
      .values({
        userId: req.userId!,
        title: title.trim(),
        description: description?.trim() ?? null,
        startAt: new Date(startAt),
        endAt: endAt ? new Date(endAt) : null,
        allDay: !!allDay,
        location: location?.trim() ?? null,
        color: color ?? "primary",
      })
      .returning();

    // Sync to Google Calendar if connected
    const accessToken = await getValidAccessToken(req.userId!);
    if (accessToken && event) {
      try {
        const gcalBody: any = {
          summary: event.title,
          description: event.description ?? undefined,
          location: event.location ?? undefined,
        };
        if (event.allDay) {
          const d = event.startAt.toISOString().split("T")[0];
          gcalBody.start = { date: d };
          gcalBody.end = { date: event.endAt ? event.endAt.toISOString().split("T")[0] : d };
        } else {
          gcalBody.start = { dateTime: event.startAt.toISOString(), timeZone: "America/Sao_Paulo" };
          gcalBody.end = { dateTime: event.endAt ? event.endAt.toISOString() : new Date(event.startAt.getTime() + 3600000).toISOString(), timeZone: "America/Sao_Paulo" };
        }
        const gcalRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(gcalBody),
        });
        if (gcalRes.ok) {
          const gcalEvent = await gcalRes.json() as any;
          await db.update(calendarEvents).set({ googleEventId: gcalEvent.id }).where(eq(calendarEvents.id, event.id));
          event.googleEventId = gcalEvent.id;
        }
      } catch { /* sync failure is non-fatal */ }
    }

    return sendOk(res, event);
  }));

  router.put("/api/colmeia/events/:id", requireAuth, asyncHandler(async (req, res) => {
    const { title, description, startAt, endAt, allDay, location, color } = req.body ?? {};
    const [existing] = await db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, req.params.id), eq(calendarEvents.userId, req.userId!)))
      .limit(1);
    if (!existing) throw notFound("Evento não encontrado");

    const [updated] = await db
      .update(calendarEvents)
      .set({
        title: title?.trim() ?? existing.title,
        description: description !== undefined ? description?.trim() ?? null : existing.description,
        startAt: startAt ? new Date(startAt) : existing.startAt,
        endAt: endAt ? new Date(endAt) : existing.endAt,
        allDay: allDay !== undefined ? !!allDay : existing.allDay,
        location: location !== undefined ? location?.trim() ?? null : existing.location,
        color: color ?? existing.color,
      })
      .where(eq(calendarEvents.id, req.params.id))
      .returning();

    if (updated?.googleEventId) {
      const accessToken = await getValidAccessToken(req.userId!);
      if (accessToken) {
        try {
          const gcalBody: any = {
            summary: updated.title,
            description: updated.description ?? undefined,
            location: updated.location ?? undefined,
          };
          if (updated.allDay) {
            const d = updated.startAt.toISOString().split("T")[0];
            gcalBody.start = { date: d };
            gcalBody.end = { date: updated.endAt ? updated.endAt.toISOString().split("T")[0] : d };
          } else {
            gcalBody.start = { dateTime: updated.startAt.toISOString(), timeZone: "America/Sao_Paulo" };
            gcalBody.end = { dateTime: updated.endAt ? updated.endAt.toISOString() : new Date(updated.startAt.getTime() + 3600000).toISOString(), timeZone: "America/Sao_Paulo" };
          }
          await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${updated.googleEventId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(gcalBody),
          });
        } catch { /* non-fatal */ }
      }
    }

    return sendOk(res, updated);
  }));

  router.delete("/api/colmeia/events/:id", requireAuth, asyncHandler(async (req, res) => {
    const [existing] = await db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, req.params.id), eq(calendarEvents.userId, req.userId!)))
      .limit(1);
    if (!existing) throw notFound("Evento não encontrado");

    // Remove from Google Calendar if synced
    if (existing.googleEventId) {
      const accessToken = await getValidAccessToken(req.userId!);
      if (accessToken) {
        fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${existing.googleEventId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => {});
      }
    }

    await db.delete(calendarEvents).where(eq(calendarEvents.id, req.params.id));
    return sendOk(res, { deleted: true });
  }));

  // ── Finance ───────────────────────────────────────────────────────────────

  router.get("/api/colmeia/finance", requireAuth, asyncHandler(async (req, res) => {
    const { month, year } = req.query as Record<string, string>;
    const userId = req.userId!;
    const now = new Date();
    const y = parseInt(year ?? String(now.getFullYear()));
    const m = parseInt(month ?? String(now.getMonth() + 1));
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0, 23, 59, 59);

    const rows = await db
      .select()
      .from(financeTransactions)
      .where(and(
        eq(financeTransactions.userId, userId),
        gte(financeTransactions.date, from),
        lte(financeTransactions.date, to),
      ))
      .orderBy(desc(financeTransactions.date));

    const totalIncome = rows.filter(r => r.type === "income").reduce((s, r) => s + r.amountCents, 0);
    const totalExpense = rows.filter(r => r.type === "expense").reduce((s, r) => s + r.amountCents, 0);

    const byCategory: Record<string, number> = {};
    for (const r of rows.filter(r => r.type === "expense")) {
      byCategory[r.category] = (byCategory[r.category] ?? 0) + r.amountCents;
    }

    return sendOk(res, {
      transactions: rows,
      summary: { totalIncome, totalExpense, balance: totalIncome - totalExpense, byCategory },
    });
  }));

  router.post("/api/colmeia/finance", requireAuth, asyncHandler(async (req, res) => {
    const { type, amount, category, description, date } = req.body ?? {};
    if (!type || !amount || !category) throw badRequest("type, amount e category são obrigatórios");
    if (!["income", "expense"].includes(type)) throw badRequest("type deve ser income ou expense");

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) throw badRequest("amount inválido");

    const [row] = await db
      .insert(financeTransactions)
      .values({
        userId: req.userId!,
        type,
        amountCents,
        category,
        description: description?.trim() ?? null,
        date: date ? new Date(date) : new Date(),
      })
      .returning();

    return sendOk(res, row);
  }));

  router.delete("/api/colmeia/finance/:id", requireAuth, asyncHandler(async (req, res) => {
    const [existing] = await db
      .select({ id: financeTransactions.id })
      .from(financeTransactions)
      .where(and(eq(financeTransactions.id, req.params.id), eq(financeTransactions.userId, req.userId!)))
      .limit(1);
    if (!existing) throw notFound("Transação não encontrada");

    await db.delete(financeTransactions).where(eq(financeTransactions.id, req.params.id));
    return sendOk(res, { deleted: true });
  }));

  // ── Clock / Alarm Reminders ───────────────────────────────────────────────

  router.get("/api/colmeia/alarms", requireAuth, asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(alarmReminders)
      .where(eq(alarmReminders.userId, req.userId!))
      .orderBy(desc(alarmReminders.active), alarmReminders.nextTriggerAt);
    return sendOk(res, rows);
  }));

  router.post("/api/colmeia/alarms", requireAuth, asyncHandler(async (req, res) => {
    const {
      title,
      message,
      kind,
      scheduledAt,
      repeatType,
      intervalMinutes,
      repeatDays,
      localNotificationId,
      linkedEventId,
      reminderOffsetMinutes,
    } = req.body ?? {};
    if (!title?.trim() || !scheduledAt) throw badRequest("title e scheduledAt são obrigatórios");

    const start = new Date(scheduledAt);
    if (Number.isNaN(start.getTime())) throw badRequest("scheduledAt inválido");

    const normalizedRepeatDays = normalizeRepeatDays(repeatDays);
    const normalizedRepeat = normalizedRepeatDays.length > 0 ? "weekly" : normalizeRepeatType(repeatType);
    const normalizedInterval = normalizedRepeat === "interval"
      ? Math.max(1, Math.min(24 * 60, parseInt(String(intervalMinutes ?? 60))))
      : null;
    const parsedReminderOffset = parseInt(String(reminderOffsetMinutes ?? ""));
    const normalizedReminderOffset = Number.isFinite(parsedReminderOffset) ? Math.max(0, parsedReminderOffset) : null;
    const firstTrigger = computeInitialAlarmTrigger(start, normalizedRepeatDays);

    const [row] = await db
      .insert(alarmReminders)
      .values({
        userId: req.userId!,
        title: title.trim(),
        message: message?.trim() ?? null,
        kind: normalizeAlarmKind(kind),
        scheduledAt: start,
        nextTriggerAt: firstTrigger,
        repeatType: normalizedRepeat,
        intervalMinutes: normalizedInterval,
        repeatDays: normalizedRepeatDays,
        localNotificationId: localNotificationId?.trim() ?? null,
        linkedEventId: typeof linkedEventId === "string" && linkedEventId.trim() ? linkedEventId.trim() : null,
        reminderOffsetMinutes: normalizedReminderOffset,
        active: true,
      })
      .returning();

    return sendOk(res, row);
  }));

  router.patch("/api/colmeia/alarms/:id", requireAuth, asyncHandler(async (req, res) => {
    const [existing] = await db
      .select()
      .from(alarmReminders)
      .where(and(eq(alarmReminders.id, req.params.id), eq(alarmReminders.userId, req.userId!)))
      .limit(1);
    if (!existing) throw notFound("Alarme não encontrado");

    const now = new Date();
    const updates: Partial<typeof alarmReminders.$inferInsert> = { updatedAt: now };
    if (typeof req.body?.active === "boolean") updates.active = req.body.active;
    if (typeof req.body?.localNotificationId === "string") updates.localNotificationId = req.body.localNotificationId.trim() || null;
    const nextRepeatDays = Array.isArray(req.body?.repeatDays)
      ? normalizeRepeatDays(req.body.repeatDays)
      : existing.repeatDays ?? [];

    if (req.body?.scheduledAt) {
      const start = new Date(req.body.scheduledAt);
      if (Number.isNaN(start.getTime())) throw badRequest("scheduledAt inválido");
      updates.scheduledAt = start;
      updates.nextTriggerAt = computeInitialAlarmTrigger(start, nextRepeatDays);
    }
    if (typeof req.body?.title === "string" && req.body.title.trim()) updates.title = req.body.title.trim();
    if (typeof req.body?.message === "string") updates.message = req.body.message.trim() || null;
    if (req.body?.kind) updates.kind = normalizeAlarmKind(req.body.kind);
    if (Array.isArray(req.body?.repeatDays)) {
      updates.repeatDays = nextRepeatDays;
      updates.repeatType = nextRepeatDays.length > 0 ? "weekly" : "once";
      updates.intervalMinutes = null;
      if (!req.body?.scheduledAt) updates.nextTriggerAt = computeInitialAlarmTrigger(existing.scheduledAt, nextRepeatDays);
    }
    if (req.body?.repeatType) updates.repeatType = normalizeRepeatType(req.body.repeatType);
    if (updates.repeatType === "interval" || existing.repeatType === "interval") {
      const rawInterval = req.body?.intervalMinutes ?? existing.intervalMinutes ?? 60;
      updates.intervalMinutes = Math.max(1, Math.min(24 * 60, parseInt(String(rawInterval))));
    }
      const nextRepeatType = updates.repeatType ?? existing.repeatType;
      const hasRecurringDays = (updates.repeatDays ?? existing.repeatDays ?? []).length > 0;
      if (typeof updates.active === "boolean") {
      if (!updates.active && existing.active && (nextRepeatType !== "once" || hasRecurringDays)) {
        updates.pausedAt = now;
        updates.reactivationReminderAt = getAlarmReactivationReviewAt(now);
        updates.reactivationPromptedAt = null;
      } else if (updates.active) {
        updates.pausedAt = null;
        updates.reactivationReminderAt = null;
        updates.reactivationPromptedAt = null;
        if (existing.nextTriggerAt <= now && nextRepeatType !== "once") {
          const nextTrigger = computeNextAlarmTrigger(existing.nextTriggerAt, nextRepeatType, updates.intervalMinutes ?? existing.intervalMinutes, updates.repeatDays ?? existing.repeatDays ?? []);
          if (nextTrigger) updates.nextTriggerAt = nextTrigger;
        }
      }
    }

    const [updated] = await db
      .update(alarmReminders)
      .set(updates)
      .where(eq(alarmReminders.id, req.params.id))
      .returning();

    return sendOk(res, updated);
  }));

  router.delete("/api/colmeia/alarms/:id", requireAuth, asyncHandler(async (req, res) => {
    const [existing] = await db
      .select({ id: alarmReminders.id })
      .from(alarmReminders)
      .where(and(eq(alarmReminders.id, req.params.id), eq(alarmReminders.userId, req.userId!)))
      .limit(1);
    if (!existing) throw notFound("Alarme não encontrado");

    await db.delete(alarmReminders).where(eq(alarmReminders.id, req.params.id));
    return sendOk(res, { deleted: true });
  }));

  router.post("/api/colmeia/alarms/due", requireAuth, asyncHandler(async (req, res) => {
    const now = new Date();
    const due = await db
      .select()
      .from(alarmReminders)
      .where(and(
        eq(alarmReminders.userId, req.userId!),
        eq(alarmReminders.active, true),
        lte(alarmReminders.nextTriggerAt, now),
      ))
      .orderBy(alarmReminders.nextTriggerAt)
      .limit(10);

    const triggered = [];
    for (const row of due) {
      const next = computeNextAlarmTrigger(row.nextTriggerAt, row.repeatType, row.intervalMinutes, row.repeatDays ?? []);
      const [updated] = await db
        .update(alarmReminders)
        .set({
          lastTriggeredAt: now,
          nextTriggerAt: next ?? row.nextTriggerAt,
          active: next ? row.active : false,
          updatedAt: now,
        })
        .where(eq(alarmReminders.id, row.id))
        .returning();
      triggered.push({ ...updated, body: buildAlarmBody(row) });
    }

    return sendOk(res, triggered);
  }));

  // ── Notes ─────────────────────────────────────────────────────────────────

  router.get("/api/colmeia/notes", requireAuth, asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(notes)
      .where(eq(notes.userId, req.userId!))
      .orderBy(desc(notes.pinned), desc(notes.updatedAt));
    return sendOk(res, rows);
  }));

  router.post("/api/colmeia/notes", requireAuth, asyncHandler(async (req, res) => {
    const { title, content, color, pinned } = req.body ?? {};
    if (!content?.trim()) throw badRequest("content é obrigatório");

    const [note] = await db.insert(notes).values({
      userId: req.userId!,
      title: title?.trim() ?? null,
      content: content.trim(),
      color: color ?? "default",
      pinned: !!pinned,
    }).returning();

    return sendOk(res, note);
  }));

  router.put("/api/colmeia/notes/:id", requireAuth, asyncHandler(async (req, res) => {
    const { title, content, color, pinned } = req.body ?? {};
    const [existing] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, req.params.id), eq(notes.userId, req.userId!)))
      .limit(1);
    if (!existing) throw notFound("Nota não encontrada");

    const [updated] = await db.update(notes).set({
      title: title !== undefined ? title?.trim() ?? null : existing.title,
      content: content?.trim() ?? existing.content,
      color: color ?? existing.color,
      pinned: pinned !== undefined ? !!pinned : existing.pinned,
      updatedAt: new Date(),
    }).where(eq(notes.id, req.params.id)).returning();

    return sendOk(res, updated);
  }));

  router.delete("/api/colmeia/notes/:id", requireAuth, asyncHandler(async (req, res) => {
    const [existing] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, req.params.id), eq(notes.userId, req.userId!)))
      .limit(1);
    if (!existing) throw notFound("Nota não encontrada");

    await db.delete(notes).where(eq(notes.id, req.params.id));
    return sendOk(res, { deleted: true });
  }));

  return router;
}

let alarmSchedulerStarted = false;

export function startAlarmReminderScheduler() {
  if (alarmSchedulerStarted) return;
  alarmSchedulerStarted = true;

  const tick = async () => {
    const now = new Date();
    try {
      const due = await db
        .select()
        .from(alarmReminders)
        .where(and(eq(alarmReminders.active, true), lte(alarmReminders.nextTriggerAt, now)))
        .orderBy(alarmReminders.nextTriggerAt)
        .limit(25);

        for (const row of due) {
          const next = computeNextAlarmTrigger(row.nextTriggerAt, row.repeatType, row.intervalMinutes, row.repeatDays ?? []);
        await db
          .update(alarmReminders)
          .set({
            lastTriggeredAt: now,
            nextTriggerAt: next ?? row.nextTriggerAt,
            active: next ? row.active : false,
            updatedAt: now,
          })
          .where(eq(alarmReminders.id, row.id));

        await sendPushToUser(
          row.userId,
          row.kind === "medicine" ? "BeeEyes · Hora do remédio" : row.kind === "appointment" ? "BeeEyes · Compromisso" : "BeeEyes · Despertador",
          buildAlarmBody(row),
          { source: "bee-alarm", screen: "/(tabs)/colmeia", alarmId: row.id },
          "bee-alarms",
        );
      }

      await createDueAlarmReactivationPrompts(undefined, true);
    } catch {
      // Scheduler failures are non-blocking; the next tick tries again.
    }
  };

  setInterval(tick, 30_000).unref?.();
  tick();
}
