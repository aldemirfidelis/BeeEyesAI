import { Router } from "express";
import { and, between, desc, eq, gte, lte } from "drizzle-orm";
import { asyncHandler } from "../api/async-handler";
import { badRequest, notFound } from "../api/errors";
import { sendError, sendOk } from "../api/response";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import {
  calendarEvents,
  financeTransactions,
  notes,
  userIntegrations,
} from "../../shared/schema";

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
      .select({ id: userIntegrations.id })
      .from(userIntegrations)
      .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "google_calendar")))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userIntegrations)
        .set({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token ?? null,
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
