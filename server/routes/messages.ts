import { Router, type Response } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { asyncHandler } from "../api/async-handler";
import { badRequest, notFound } from "../api/errors";
import { sendError, sendOk } from "../api/response";
import { createDueAlarmReactivationPrompts, findOpenAlarmReactivationPrompt } from "../alarm-reactivation";
import { inferExplicitToolActions } from "../ai-actions";
import { parseBeeCommand, type BeeCommandAction } from "../bee-command-parser";
import { db } from "../db";
import { getBrazilNationalHoliday } from "../holidays";
import { alarmReminders, calendarEvents, financeTransactions, notes } from "../../shared/schema";
import {
  buildIntelligentNotifications,
  buildScoreSnapshot,
  generateProactiveMessage,
  parseAIActions,
  streamChat,
  summarizeNewsArticle,
  transcribeAudio,
  updatePersonalityFromMessage,
} from "../ai";
import { parseBoundedInt } from "../http";
import { requireAuth } from "../middleware/requireAuth";
import { checkRateLimit } from "../rateLimit";
import { storage } from "../storage";
import { runResearch, formatResultsForContext, type ResearchResult } from "../services/beeResearchService";
import { classifyIntent, type SearchIntent } from "../services/searchIntentService";
import { buildCalendarContextForAI } from "../services/calendarInfoService";
import { calendarPreferences, healthProfiles, workoutPlans, moodEntries, userInterests } from "../../shared/schema";
import {
  parseHealthIntent,
  buildFollowUpQuestion,
  buildHealthContextForAI,
  type HealthIntentResult,
} from "../services/healthIntentService";
import { buildBeePersonalizationContext, buildConversationContextUpdate } from "../services/beeContextService";
import { filterVisibleSponsoredMessages } from "../services/adImpressionService";
import {
  buildWorkoutPlan,
  type HealthGoal,
  type WeekDay,
  type SplitType,
} from "../services/workoutPlanService";
import type { ExerciseLevel, EquipmentType } from "../data/exerciseLibrary";

const APP_TIPS: { id: number; text: string }[] = [
  // ── Chat & IA ──────────────────────────────────────────────────────────────
  { id: 1,  text: "💡 Dica: sente que está travado? Me manda uma frase sobre o que está bloqueando. Eu não deixo você ficar parado — te ajudo a encontrar o próximo passo agora." },
  { id: 2,  text: "💡 Dica: o painel Insight mostra seu foco, constância e disciplina da semana. Toque no ícone de insight no chat para ver sua pontuação atual e o que ela significa." },
  { id: 4,  text: "💡 Dica: eu lembro de tudo que você me conta. Quanto mais você compartilha seus objetivos e desafios, mais personalizadas ficam minhas sugestões para você." },
  { id: 5,  text: "💡 Dica: se quiser notícias relevantes, mande /noticias no chat. Eu busco e organizo os resultados para você." },
  { id: 6,  text: "💡 Dica: você pode conversar comigo sobre qualquer coisa — produtividade, reflexões, ideias, planos. Quanto mais natural a conversa, melhores minhas análises sobre você." },
  { id: 8,  text: "💡 Dica: mantenha sua sequência (streak) ativa todos os dias. Sequências de 3, 7 e 30 dias mostram que você é constante de verdade." },

  // ── Comunidades ────────────────────────────────────────────────────────────
  { id: 17, text: "💡 Dica: Comunidades são grupos temáticos. Entre em comunidades alinhadas com seus objetivos — você encontra pessoas com os mesmos focos e objetivos que você." },

  // ── Amigos & Conexões ──────────────────────────────────────────────────────
  { id: 20, text: "💡 Dica: use a busca em Amigos para encontrar pessoas pelo nome de usuário. Quando você conecta com alguém, você pode acompanhar o progresso dela no app." },
  { id: 21, text: "💡 Dica: a aba Matches da Bee em Amigos mostra sugestões inteligentes baseadas nos seus interesses e comportamento. Pessoas que pensam parecido com você." },
  { id: 22, text: "💡 Dica: escreva um depoimento para um amigo! Vá ao perfil dele e toque em 'Depoimento'. É uma forma autêntica de reconhecer o crescimento de alguém." },

  // ── Mensagens Diretas ──────────────────────────────────────────────────────
  { id: 24, text: "💡 Dica: Mensagens Diretas estão liberadas desde o início. Chame seus amigos quando quiser e continue a conversa em privado." },
  { id: 25, text: "💡 Dica: na sua inbox, você pode responder em tempo real aos seus amigos. As conversas ficam organizadas por pessoa para você acompanhar facilmente." },

  // ── Humor & Bem-estar ──────────────────────────────────────────────────────
  { id: 26, text: "💡 Dica: registre seu humor todo dia no módulo Humor. Eu uso esses dados para ajustar o tom das minhas mensagens e minhas análises sobre você." },
  { id: 27, text: "💡 Dica: o calendário de humor mostra os últimos 30 dias em cores. Padrões de humor ruim repetido podem ser um sinal que vale levar ao insight da semana." },

  // ── Alertas & Notificações ────────────────────────────────────────────────
  { id: 28, text: "💡 Dica: os Alertas da Bee mostram sinais que precisam da sua atenção: riscos de streak, progresso social, novas conexões. Passe lá antes de fechar o app." },
  { id: 29, text: "💡 Dica: alertas com borda vermelha são urgentes — risco real de perder progresso. Amarelo é atenção. Verde é celebração. Fique de olho nas cores." },

  // ── Medalhas & Conquistas ──────────────────────────────────────────────────

  // ── Configurações & Privacidade ────────────────────────────────────────────
  { id: 33, text: "💡 Dica: você pode alterar nome de exibição e bio a qualquer momento nas Configurações. Manter seu perfil atualizado ajuda a IA a entender melhor quem você é hoje." },
  { id: 34, text: "💡 Dica: o tema escuro está disponível nas Configurações em Aparência. O app detecta automaticamente o idioma do seu dispositivo — português, inglês ou espanhol." },

  // ── Estratégia de uso ──────────────────────────────────────────────────────
  { id: 35, text: "💡 Dica: o melhor jeito de usar o BeeEyes é abrir o chat uma vez por dia e me contar o que está na cabeça. Não precisa ser longo — uma frase já ativa o sistema." },
  { id: 37, text: "💡 Dica: invista uns 5 minutos por semana lendo o Resumo Semanal. Ele mostra onde você está evoluindo e o que está travado antes que vire um problema maior." },
  { id: 38, text: "💡 Dica: o BeeEyes foi feito para ser parte da sua rotina diária, não uma tarefa pesada. Pequenos check-ins frequentes valem muito mais do que sessões longas e raras." },
];

function formatRoutineContext(
  events: Array<{ title: string; startAt: Date; endAt: Date | null; allDay: boolean | null }>,
  alarms: Array<{ title: string; nextTriggerAt: Date; repeatType: string; repeatDays: number[]; kind: string; active: boolean }>,
) {
  const eventLines = events.slice(0, 8).map((event) =>
    `- Calendario: ${event.title} em ${event.startAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: event.allDay ? undefined : "short" })}${event.allDay ? " (dia inteiro)" : ""}`
  );
  const alarmLines = alarms.slice(0, 8).map((alarm) => {
    const repeat = alarm.repeatDays.length > 0 ? `dias ${alarm.repeatDays.join(",")}` : alarm.repeatType;
    return `- Relógio: ${alarm.title} em ${alarm.nextTriggerAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })} (${alarm.kind}, ${repeat})`;
  });
  const lines = [...eventLines, ...alarmLines];
  return lines.length > 0 ? `Horários marcados do usuário:\n${lines.join("\n")}` : "";
}

function normalizeComparableTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function formatBeeTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  });
}

function formatBeeDateTime(date: Date) {
  return `${date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  })} às ${formatBeeTime(date)}`;
}

function formatOffset(minutes: number | null | undefined) {
  if (!minutes) return "antes";
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hora${hours > 1 ? "s" : ""}`;
  }
  return `${minutes} minutos`;
}

async function findDuplicateCalendarEvent(userId: string, title: string, startAt: Date) {
  const from = new Date(startAt.getTime() - 60_000);
  const to = new Date(startAt.getTime() + 60_000);
  const candidates = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.userId, userId), gte(calendarEvents.startAt, from), lte(calendarEvents.startAt, to)))
    .limit(10);
  const normalizedTitle = normalizeComparableTitle(title);
  return candidates.find((event) => normalizeComparableTitle(event.title) === normalizedTitle) ?? null;
}

async function findDuplicateAlarmReminder(userId: string, title: string, scheduledAt: Date) {
  const from = new Date(scheduledAt.getTime() - 60_000);
  const to = new Date(scheduledAt.getTime() + 60_000);
  const candidates = await db
    .select()
    .from(alarmReminders)
    .where(and(eq(alarmReminders.userId, userId), gte(alarmReminders.nextTriggerAt, from), lte(alarmReminders.nextTriggerAt, to)))
    .limit(10);
  const normalizedTitle = normalizeComparableTitle(title);
  return candidates.find((alarm) => normalizeComparableTitle(alarm.title) === normalizedTitle) ?? null;
}

async function findBeeCommandDuplicate(userId: string, actions: BeeCommandAction[]) {
  for (const action of actions) {
    if (action.type === "calendar_event" && action.startAt) {
      const startAt = new Date(action.startAt);
      if (!isNaN(startAt.getTime()) && await findDuplicateCalendarEvent(userId, action.title, startAt)) {
        return "Já existe um compromisso parecido nesse horário 🐝 Deseja criar outro mesmo assim?";
      }
    }
    if (action.type === "alarm_reminder" && action.scheduledAt) {
      const scheduledAt = new Date(action.scheduledAt);
      if (!isNaN(scheduledAt.getTime()) && await findDuplicateAlarmReminder(userId, action.title, scheduledAt)) {
        return "Já existe um lembrete parecido nesse horário 🐝 Deseja criar outro mesmo assim?";
      }
    }
  }
  return null;
}

async function executeBeeCommandActions(userId: string, actions: BeeCommandAction[], res: Response) {
  const createdEvents: Array<typeof calendarEvents.$inferSelect> = [];
  const createdAlarms: Array<typeof alarmReminders.$inferSelect> = [];
  const firstEventByTitle = new Map<string, typeof calendarEvents.$inferSelect>();

  for (const action of actions) {
    if (action.type !== "calendar_event" || !action.startAt) continue;
    const startAt = new Date(action.startAt);
    if (isNaN(startAt.getTime())) continue;

    const [event] = await db.insert(calendarEvents).values({
      userId,
      title: action.title,
      description: action.description ?? null,
      startAt,
      endAt: action.endAt ? new Date(action.endAt) : null,
      allDay: !!action.allDay,
      location: null,
    }).returning();

    if (event) {
      createdEvents.push(event);
      firstEventByTitle.set(normalizeComparableTitle(action.title), event);
      res.write(`data: ${JSON.stringify({ type: "event_created", event })}\n\n`);
    }
  }

  for (const action of actions) {
    if (action.type !== "alarm_reminder" || !action.scheduledAt) continue;
    const scheduledAt = new Date(action.scheduledAt);
    if (isNaN(scheduledAt.getTime())) continue;

    const linkedEvent = action.linkedEvent
      ? firstEventByTitle.get(normalizeComparableTitle(action.title.replace(/^Lembrete:\s*/i, ""))) ?? createdEvents[0] ?? null
      : null;

    const [alarm] = await db.insert(alarmReminders).values({
      userId,
      title: action.title,
      message: action.message ?? null,
      kind: action.kind,
      scheduledAt,
      nextTriggerAt: scheduledAt,
      repeatType: action.repeatType,
      intervalMinutes: action.repeatType === "interval" ? action.intervalMinutes ?? 60 : null,
      repeatDays: action.repeatDays ?? [],
      active: true,
      linkedEventId: linkedEvent?.id ?? null,
      reminderOffsetMinutes: action.reminderOffsetMinutes ?? null,
    }).returning();

    if (alarm) {
      createdAlarms.push(alarm);
      res.write(`data: ${JSON.stringify({ type: "alarm_created", alarm })}\n\n`);
    }
  }

  return { createdEvents, createdAlarms };
}

function buildBeeCommandConfirmation(actions: BeeCommandAction[]) {
  const events = actions.filter((action) => action.type === "calendar_event");
  const alarms = actions.filter((action) => action.type === "alarm_reminder");
  const linkedAlarm = alarms.find((action) => action.linkedEvent);

  if (events.length === 1 && linkedAlarm && events[0].startAt) {
    return `Prontinho 🐝✨ Marquei ${events[0].title} no seu calendário para ${formatBeeDateTime(new Date(events[0].startAt))} e também vou te lembrar ${formatOffset(linkedAlarm.reminderOffsetMinutes)} antes.`;
  }

  if (events.length === 1 && alarms.length === 0 && events[0].startAt) {
    return `Prontinho 🐝✨ Marquei ${events[0].title} no seu calendário para ${formatBeeDateTime(new Date(events[0].startAt))}.`;
  }

  if (events.length === 0 && alarms.length === 1 && alarms[0].scheduledAt) {
    const verb = alarms[0].kind === "alarm" ? "Criei um alarme" : "Vou te lembrar";
    return `Prontinho 🐝✨ ${verb} de ${alarms[0].title.replace(/^Lembrete:\s*/i, "")} em ${formatBeeDateTime(new Date(alarms[0].scheduledAt))}.`;
  }

  const lines = ["Prontinho 🐝✨"];
  for (const event of events) {
    if (event.startAt) lines.push(`Agendei ${event.title} no seu calendário para ${formatBeeDateTime(new Date(event.startAt))}.`);
  }
  for (const alarm of alarms) {
    if (alarm.scheduledAt && alarm.linkedEvent) {
      lines.push(`Também vou te avisar ${formatOffset(alarm.reminderOffsetMinutes)} antes.`);
    } else if (alarm.scheduledAt) {
      lines.push(`Vou te lembrar de ${alarm.title.replace(/^Lembrete:\s*/i, "")} em ${formatBeeDateTime(new Date(alarm.scheduledAt))}.`);
    }
  }
  return lines.join("\n");
}

// ── Health helpers ────────────────────────────────────────────────────────────
function pickDefaultTrainingDays(count: number): WeekDay[] {
  // Distribui dias com pelo menos 1 dia de descanso entre treinos
  const presets: Record<number, WeekDay[]> = {
    1: ["monday"],
    2: ["monday", "thursday"],
    3: ["monday", "wednesday", "friday"],
    4: ["monday", "tuesday", "thursday", "friday"],
    5: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    6: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    7: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
  };
  return presets[Math.max(1, Math.min(7, count))] ?? presets[3];
}

export function createMessagesRouter() {
  const router = Router();

  type NotificationCenterItem = {
    id: string;
    category: "alert" | "activity" | "social";
    source: "intelligent" | "proactive" | "visit" | "connection" | "community" | "direct_message";
    title: string;
    body: string;
    tone: "danger" | "warning" | "positive" | "neutral";
    createdAt: string;
    read: boolean;
    fromUserId?: string;
    fromName?: string;
  };

  async function getUserActivitySnapshot(userId: string) {
    const [user, messages, posts] = await Promise.all([
      storage.getUser(userId),
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

    messages.forEach((message) => touch(message.createdAt));
    posts.forEach((post) => touch(post.createdAt));

    const activeDays = [...dailyActivity.values()].filter((count) => count > 0).length;
    const lastActiveHours = user.lastActiveAt
      ? Math.max(0, (Date.now() - new Date(user.lastActiveAt).getTime()) / 3600000)
      : null;

    return {
      user,
      activeDays,
      completedActions: 0,
      totalActionsTouched: 0,
      lastActiveHours,
    };
  }

  router.get("/api/messages", requireAuth, asyncHandler(async (req, res) => {
    const limit = parseBoundedInt(req.query.limit, { fallback: 50, min: 1, max: 100 });
    const existing = await storage.getMessagesByUser(req.userId!, limit);
    const visibleExisting = await filterVisibleSponsoredMessages(req.userId!, existing);

    if (visibleExisting.length === 0) {
      const user = await storage.getUser(req.userId!);
      const firstName = (() => {
        const name = user?.displayName || user?.username || "";
        return name.trim().split(/\s+/)[0] || "";
      })();
      const greeting = firstName ? `Oi, ${firstName}! 🐝✨` : "Oi! 🐝✨";

      const welcomeContent = `${greeting}

Eu sou a Bee, sua assistente pessoal. Estou muito feliz em te ver por aqui! 💛

A partir de agora posso te ajudar a organizar sua rotina, criar planos, lembrar tarefas, cuidar melhor dos seus hábitos, apoiar seus estudos, acompanhar sua produtividade e transformar suas ideias em ações.

📌 Dicas para aproveitar melhor nossa conversa:

• Me diga o que você quer fazer
  Ex: "Bee, monte um plano de estudos para essa semana."

• ⏰ Informe datas e horários quando precisar
  Ex: "Me lembre de beber água todo dia às 10h."

• 🎯 Conte seu objetivo
  Ex: "Quero criar uma rotina mais organizada para estudar e treinar."

• 💬 Fale comigo do seu jeito
  Quanto mais contexto você me der, mais precisa será minha ajuda.

Estou pronta para voar com você nessa jornada 🐝💛`;

      const welcome = await storage.createMessage({
        userId: req.userId!,
        role: "assistant",
        content: welcomeContent,
        metadata: JSON.stringify({ type: "welcome" }),
      });
      return sendOk(res, [welcome]);
    }

    return sendOk(res, visibleExisting);
  }));

  router.get("/api/score", requireAuth, asyncHandler(async (req, res) => {
    const snapshot = await getUserActivitySnapshot(req.userId!);
    return sendOk(res, buildScoreSnapshot({
      activeDays: snapshot.activeDays,
      completedActions: snapshot.completedActions,
      totalActionsTouched: snapshot.totalActionsTouched,
      streak: snapshot.user.currentStreak,
      level: snapshot.user.level,
      xp: snapshot.user.xp,
      lastActiveHours: snapshot.lastActiveHours,
    }));
  }));

  router.get("/api/notifications/intelligent", requireAuth, asyncHandler(async (req, res) => {
    const snapshot = await getUserActivitySnapshot(req.userId!);
    const score = buildScoreSnapshot({
      activeDays: snapshot.activeDays,
      completedActions: snapshot.completedActions,
      totalActionsTouched: snapshot.totalActionsTouched,
      streak: snapshot.user.currentStreak,
      level: snapshot.user.level,
      xp: snapshot.user.xp,
      lastActiveHours: snapshot.lastActiveHours,
    });

    return sendOk(res, buildIntelligentNotifications({
      focusScore: score.focusScore,
      consistencyScore: score.consistencyScore,
      disciplineScore: score.disciplineScore,
      streak: snapshot.user.currentStreak,
      lastActiveHours: snapshot.lastActiveHours,
    }));
  }));

  async function getNotificationCenterItems(userId: string, includeRead = false) {
    const [recentMessages, notificationReads] = await Promise.all([
      storage.getMessagesByUser(userId, 40),
      storage.getNotificationReadsByUser(userId),
    ]);
    const readIds = new Set(notificationReads.map((item) => item.notificationId));

    const messageItems = recentMessages.flatMap<NotificationCenterItem>((message) => {
      if (message.role !== "assistant") return [];

      let metadata: Record<string, unknown> = {};
      try {
        metadata = JSON.parse(message.metadata || "{}");
      } catch {
        metadata = {};
      }

      if (metadata.visitFrom) {
        const anonymous = metadata.anonymous === true;
        return [{
          id: `visit-${message.id}`,
          category: "social" as const,
          source: "visit" as const,
          title: "Alguem passou pelo seu perfil",
          body: message.content,
          tone: "positive" as const,
          createdAt: new Date(message.createdAt).toISOString(),
          read: false,
          fromUserId: anonymous ? undefined : String(metadata.visitFrom || ""),
          fromName: anonymous ? undefined : String(metadata.visitorName || ""),
        }];
      }

      if (metadata.proactive === true) {
        return [{
          id: `proactive-${message.id}`,
          category: "activity" as const,
          source: "proactive" as const,
          title: "A Bee chamou sua atenção",
          body: message.content,
          tone: "neutral" as const,
          createdAt: new Date(message.createdAt).toISOString(),
          read: false,
        }];
      }

      if (metadata.type === "connection_request") {
        return [{
          id: `connection-${message.id}`,
          category: "social" as const,
          source: "connection" as const,
          title: "Nova solicitação de conexão",
          body: message.content,
          tone: "positive" as const,
          createdAt: new Date(message.createdAt).toISOString(),
          read: false,
        }];
      }

      if (metadata.type === "community_invite") {
        return [{
          id: `community-invite-${message.id}`,
          category: "social" as const,
          source: "community" as const,
          title: "Convite para Comunidade",
          body: message.content,
          tone: "positive" as const,
          createdAt: new Date(message.createdAt).toISOString(),
          read: false,
        }];
      }

      if (metadata.type === "direct_message") {
        return [{
          id: `dm-${message.id}`,
          category: "social" as const,
          source: "direct_message" as const,
          title: "Nova mensagem direta",
          body: message.content,
          tone: "neutral" as const,
          createdAt: new Date(message.createdAt).toISOString(),
          read: false,
          fromUserId: String(metadata.fromUserId || ""),
          fromName: String(metadata.fromName || ""),
        }];
      }

      return [];
    });

    return [...messageItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
      .map((item) => ({ ...item, read: readIds.has(item.id) }))
      .filter((item) => includeRead || !item.read)
      .slice(0, 12);
  }

  router.get("/api/notifications/center", requireAuth, asyncHandler(async (req, res) => {
    return sendOk(res, await getNotificationCenterItems(req.userId!, req.query.includeRead === "true"));
  }));

  router.post("/api/notifications/clear", requireAuth, asyncHandler(async (req, res) => {
    const items = await getNotificationCenterItems(req.userId!, true);
    if (items.length > 0) {
      await storage.markNotificationsAsRead(items.map((item) => ({ userId: req.userId!, notificationId: item.id })));
    }
    return sendOk(res, { acknowledged: true, count: items.length });
  }));

  router.post("/api/notifications/push-token", requireAuth, asyncHandler(async (req, res) => {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || !token.trim()) {
      throw badRequest("token obrigatório");
    }
    await storage.updateUserPushToken(req.userId!, token.trim());
    return sendOk(res, { registered: true });
  }));

  router.delete("/api/notifications/push-token", requireAuth, asyncHandler(async (req, res) => {
    await storage.updateUserPushToken(req.userId!, null);
    return sendOk(res, { unregistered: true });
  }));

  router.post("/api/notifications/read", requireAuth, asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    if (ids.length === 0) {
      throw badRequest("ids obrigatorios");
    }

    await storage.markNotificationsAsRead(
      ids.map((notificationId: string) => ({
        userId: req.userId!,
        notificationId,
      }))
    );

    return sendOk(res, { acknowledged: true, count: ids.length });
  }));

  router.post("/api/chat", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const {
      content,
      isSystem = false,
      repliedToMessageId,
      repliedToMessageContent,
      repliedToMessageRole,
      repliedToMessageCreatedAt,
    } = req.body ?? {};

    if (!content?.trim()) {
      return sendError(res, 400, "VALIDATION_ERROR", "Mensagem não pode ser vazia");
    }

    if (!isSystem) {
      const rate = checkRateLimit(userId);
      if (!rate.allowed) {
        const minutes = Math.ceil(rate.resetInMs / 60000);
        return sendError(
          res,
          429,
          "RATE_LIMITED",
          `Você enviou muitas mensagens. Aguarde ${minutes} minuto${minutes > 1 ? "s" : ""} para continuar. 🐝`,
        );
      }
    }

    const now = new Date();
    const routineUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [
      user,
      personality,
      history,
      routineEvents,
      routineAlarms,
      beeMemories,
      beePreferences,
      beeConversationContext,
      messageFeedbackSummary,
      recentMoodEntries,
      wishlistInterests,
    ] = await Promise.all([
      storage.getUser(userId),
      storage.getPersonality(userId),
      storage.getMessagesByUser(userId, 20),
      db.select({
        title: calendarEvents.title,
        startAt: calendarEvents.startAt,
        endAt: calendarEvents.endAt,
        allDay: calendarEvents.allDay,
      })
        .from(calendarEvents)
        .where(and(eq(calendarEvents.userId, userId), gte(calendarEvents.startAt, now), lte(calendarEvents.startAt, routineUntil)))
        .orderBy(calendarEvents.startAt)
        .limit(10),
      db.select({
        title: alarmReminders.title,
        nextTriggerAt: alarmReminders.nextTriggerAt,
        repeatType: alarmReminders.repeatType,
        repeatDays: alarmReminders.repeatDays,
        kind: alarmReminders.kind,
        active: alarmReminders.active,
      })
        .from(alarmReminders)
        .where(and(eq(alarmReminders.userId, userId), eq(alarmReminders.active, true), gte(alarmReminders.nextTriggerAt, now), lte(alarmReminders.nextTriggerAt, routineUntil)))
        .orderBy(alarmReminders.nextTriggerAt)
        .limit(10),
      storage.getActiveUserMemories(userId, 18),
      storage.getUserPreferences(userId, true),
      storage.getBeeConversationContext(userId),
      storage.getMessageFeedbackSummary(userId),
      db.select()
        .from(moodEntries)
        .where(and(eq(moodEntries.userId, userId), gte(moodEntries.createdAt, new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000))))
        .orderBy(desc(moodEntries.createdAt))
        .limit(14)
        .catch(() => []),
      db.select({
        interestName: userInterests.interestName,
        category: userInterests.category,
        score: userInterests.score,
      })
        .from(userInterests)
        .where(and(eq(userInterests.userId, userId), eq(userInterests.active, true)))
        .orderBy(desc(userInterests.score))
        .limit(12)
        .catch(() => []),
    ]);

    if (!user || !personality) {
      return sendError(res, 404, "NOT_FOUND", "Usuário não encontrado");
    }

    const replyContext = typeof repliedToMessageContent === "string" && repliedToMessageContent.trim()
      ? {
          repliedToMessageId: typeof repliedToMessageId === "string" ? repliedToMessageId : null,
          repliedToMessageContent: repliedToMessageContent.trim().slice(0, 1000),
          repliedToMessageRole: repliedToMessageRole === "assistant" ? "assistant" : repliedToMessageRole === "user" ? "user" : null,
          repliedToMessageCreatedAt: typeof repliedToMessageCreatedAt === "string" && !isNaN(new Date(repliedToMessageCreatedAt).getTime())
            ? new Date(repliedToMessageCreatedAt)
            : null,
        }
      : null;

    if (!isSystem) {
      await storage.createMessage({
        userId,
        role: "user",
        content,
        repliedToMessageId: replyContext?.repliedToMessageId ?? null,
        repliedToMessageContent: replyContext?.repliedToMessageContent ?? null,
        repliedToMessageRole: replyContext?.repliedToMessageRole ?? null,
        repliedToMessageCreatedAt: replyContext?.repliedToMessageCreatedAt ?? null,
      });
      await storage.incrementMessageCount(userId);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const beeCommand = parseBeeCommand(content, {
      now: new Date(),
      defaultReminderTime: "08:00",
      defaultReminderOffsetMinutes: 30,
    });

    if (beeCommand.actions.length > 0) {
      let cleanText = beeCommand.clarificationQuestion ?? "";
      let assistantMetadata: string | undefined;

      if (!beeCommand.needsClarification) {
        const holidayAlarm = beeCommand.actions.length === 1 && beeCommand.actions[0].type === "alarm_reminder"
          ? beeCommand.actions[0]
          : null;
        const holiday = holidayAlarm?.scheduledAt ? getBrazilNationalHoliday(new Date(holidayAlarm.scheduledAt)) : null;

        if (holiday && holidayAlarm) {
          cleanText = `${holiday.date} é feriado nacional (${holiday.name}). Você quer manter esse despertador mesmo assim?`;
          assistantMetadata = JSON.stringify({
            type: "holiday_alarm_confirmation",
            holiday,
            alarmDraft: holidayAlarm,
          });
        } else {
          const duplicateMessage = await findBeeCommandDuplicate(userId, beeCommand.actions);
          if (duplicateMessage) {
          cleanText = duplicateMessage;
          assistantMetadata = JSON.stringify({
            type: "duplicate_schedule_confirmation",
            actions: beeCommand.actions,
          });
          } else {
            await executeBeeCommandActions(userId, beeCommand.actions, res);
            cleanText = buildBeeCommandConfirmation(beeCommand.actions);
          }
        }
      }

      const assistantMessage = await storage.createMessage({
        userId,
        role: "assistant",
        content: cleanText,
        metadata: assistantMetadata,
      });

      storage.updateUserStreak(userId).catch(() => {});
      updatePersonalityFromMessage(userId, content, cleanText).catch(() => {});
      storage.upsertBeeConversationContext({
        userId,
        ...buildConversationContextUpdate({
          previous: beeConversationContext,
          recentMessages: history,
          userMessage: content,
          assistantResponse: cleanText,
        }),
      }).catch(() => {});

      res.write(`data: ${JSON.stringify({ type: "done", cleanText, id: assistantMessage.id, metadata: assistantMessage.metadata ?? null })}\n\n`);
      res.end();
      return;
    }

    const chatHistory = history.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

    // Inject public calendar context (holidays + special dates) for the next 30 days.
    // Only include if the message seems calendar-related OR once per session (up to the AI to use).
    const [calPrefs] = await db
      .select()
      .from(calendarPreferences)
      .where(eq(calendarPreferences.userId, userId))
      .limit(1)
      .catch(() => [null]);
    const calendarContext = buildCalendarContextForAI(30, calPrefs?.state ?? user.city?.slice(0, 2) ?? null);

    const routineContext = formatRoutineContext(routineEvents, routineAlarms);
    const replyRuntimeContext = replyContext
      ? `\n## Mensagem especifica que o usuario esta respondendo\n- Autor original: ${replyContext.repliedToMessageRole === "assistant" ? "Bee" : "usuario"}\n- ID original: ${replyContext.repliedToMessageId ?? "nao informado"}\n- Criada em: ${replyContext.repliedToMessageCreatedAt ? replyContext.repliedToMessageCreatedAt.toISOString() : "nao informado"}\n- Trecho original: "${replyContext.repliedToMessageContent}"\n\nInterprete pronomes como "isso", "esse", "essa ideia", "faz assim" e "amanha" considerando essa mensagem respondida.`
      : "";
    const beePersonalizationContext = buildBeePersonalizationContext({
      user,
      personality,
      memories: beeMemories,
      preferences: beePreferences,
      conversationContext: beeConversationContext,
      feedbackSummary: messageFeedbackSummary,
      moodEntries: recentMoodEntries,
      wishlistInterests,
      recentMessages: history,
      userMessage: content,
    });

    // ── Research: classify intent, run search, inject context into AI ─────────
    let researchResults: ResearchResult[] = [];
    let researchIntent: SearchIntent = "none";
    let researchContext = "";

    const searchRequest = classifyIntent(content);
    if (searchRequest.intent !== "none") {
      researchIntent = searchRequest.intent;
      res.write(`data: ${JSON.stringify({ type: "research_start", intent: researchIntent })}\n\n`);
      try {
        const { results } = await Promise.race([
          runResearch(content, user.city ?? undefined, null),
          new Promise<{ request: typeof searchRequest; results: ResearchResult[] }>((resolve) =>
            setTimeout(() => resolve({ request: searchRequest, results: [] }), 7000),
          ),
        ]);
        researchResults = results;
        if (results.length > 0) {
          researchContext = formatResultsForContext(researchIntent, results);
        }
      } catch {
        // Non-fatal: continue without research context
      }
    }

    // ── Health intent: detect & generate workout suggestion ──────────────────
    let healthIntent: HealthIntentResult = { intent: "unknown", confidence: 0, missingFields: [] };
    let healthContext = "";
    let workoutSuggestion: any = null;
    try {
      healthIntent = parseHealthIntent(content);
      // Pull profile for richer AI context
      const [hp] = await db
        .select()
        .from(healthProfiles)
        .where(eq(healthProfiles.userId, userId))
        .limit(1)
        .catch(() => [null]);

      const profileForContext = hp
        ? { healthGoal: hp.healthGoal, level: hp.level, trainingDays: hp.trainingDays as string[] }
        : null;
      healthContext = buildHealthContextForAI(profileForContext);

      // If user explicitly asks to create a plan and we have enough info — build suggestion
      if (healthIntent.intent === "create_workout_plan" && healthIntent.missingFields.length === 0) {
        const days = healthIntent.trainingDays && healthIntent.trainingDays.length
          ? healthIntent.trainingDays
          : pickDefaultTrainingDays(healthIntent.daysPerWeek ?? 3);
        const equipPref: EquipmentType | "misto" =
          healthIntent.preference === "machines" ? "aparelho"
          : healthIntent.preference === "free_weights" ? "halter"
          : healthIntent.preference === "bodyweight" ? "peso_corporal"
          : "misto";
        const built = buildWorkoutPlan({
          trainingDays: days as WeekDay[],
          goal: (healthIntent.goal ?? hp?.healthGoal ?? "saude_geral") as HealthGoal,
          level: (healthIntent.level ?? (hp?.level as ExerciseLevel) ?? "iniciante"),
          equipmentPreference: equipPref,
          splitType: healthIntent.splitType,
          avoidExercises: (hp?.avoidExercises as string[]) ?? [],
        });
        workoutSuggestion = built;
        healthContext += `\n[Sugestão de plano gerada pela Bee — ${built.name}, ${built.trainingDays.length}x/semana, split ${built.splitType}]\n`;
      } else if (healthIntent.intent === "create_workout_plan" && healthIntent.missingFields.length > 0) {
        const firstMissing = healthIntent.missingFields[0];
        healthContext += `\n[A Bee deve perguntar ao usuário: ${buildFollowUpQuestion(firstMissing)}]\n`;
      } else if (healthIntent.intent === "ask_health_summary") {
        const [activePlan] = await db
          .select()
          .from(workoutPlans)
          .where(and(eq(workoutPlans.userId, userId), eq(workoutPlans.active, true)))
          .limit(1)
          .catch(() => [null]);
        if (activePlan) {
          healthContext += `\n[Plano ativo: ${activePlan.name} (${(activePlan.trainingDays as string[]).join(", ")})]\n`;
        }
      }
    } catch {
      // Non-fatal
    }

    // ── Stream AI response (with research + health context injected) ─────────
    let fullResponse = "";
    try {
      const combinedContext = [beePersonalizationContext, replyRuntimeContext, routineContext, calendarContext, researchContext, healthContext].filter(Boolean).join("\n\n");
      fullResponse = await streamChat(user, personality, chatHistory, content, (chunk) => {
        res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
      }, combinedContext);
    } catch {
      res.write(`data: ${JSON.stringify({ type: "error", message: "Erro ao gerar resposta" })}\n\n`);
      res.end();
      return;
    }

    let { cleanText, fetchNews, createEvent, logFinance, saveNote } = parseAIActions(fullResponse);
    const explicitActions = inferExplicitToolActions(content);
    createEvent ??= explicitActions.createEvent;
    logFinance ??= explicitActions.logFinance;
    saveNote ??= explicitActions.saveNote;
    const alarmReminder = explicitActions.alarmReminder;
    let assistantMetadata: string | undefined;

    if (alarmReminder?.scheduledAt) {
      const holiday = getBrazilNationalHoliday(new Date(alarmReminder.scheduledAt));
      if (holiday) {
        cleanText = `${holiday.date} é feriado nacional (${holiday.name}). Você quer manter esse despertador mesmo assim?`;
        assistantMetadata = JSON.stringify({
          type: "holiday_alarm_confirmation",
          holiday,
          alarmDraft: alarmReminder,
        });
      }
    }

    // Include research results in message metadata so cards persist in history
    const researchMeta = researchResults.length > 0
      ? JSON.stringify({ type: "research", intent: researchIntent, results: researchResults })
      : undefined;

    const assistantMessage = await storage.createMessage({
      userId,
      role: "assistant",
      content: cleanText,
      metadata: assistantMetadata ?? researchMeta,
    });

    // Send research results as a separate SSE event for UI card rendering
    if (researchResults.length > 0) {
      res.write(`data: ${JSON.stringify({ type: "research_results", intent: researchIntent, results: researchResults })}\n\n`);
    }

    // Send health workout suggestion as SSE event (rendered as actionable card)
    if (workoutSuggestion) {
      res.write(`data: ${JSON.stringify({ type: "workout_suggestion", plan: workoutSuggestion })}\n\n`);
    }

    if (fetchNews?.query) {
      try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(fetchNews.query)}&hl=pt-BR&gl=BR&ceid=BR:pt-BR`;
        const rssRes = await fetch(rssUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(8000),
        });

        if (rssRes.ok) {
          const xml = await rssRes.text();
          const items: Array<{ title: string; link: string; source: string }> = [];
          const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

          for (const match of matches) {
            const block = match[1];
            const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? block.match(/<title>(.*?)<\/title>/)?.[1] ?? "").trim();
            const link = (block.match(/<link>(.*?)<\/link>/)?.[1] ?? "").trim();
            const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "").trim();
            if (title && link) items.push({ title, link, source });
            if (items.length >= 5) break;
          }

          res.write(`data: ${JSON.stringify({ type: "news_fetched", query: fetchNews.query, items })}\n\n`);
        }
      } catch {
        // ignore
      }
    }

    if (createEvent?.title && createEvent.startAt) {
      try {
        const startDate = new Date(createEvent.startAt);
        if (!isNaN(startDate.getTime())) {
          const [event] = await db.insert(calendarEvents).values({
            userId,
            title: createEvent.title,
            description: createEvent.description ?? null,
            startAt: startDate,
            endAt: createEvent.endAt ? new Date(createEvent.endAt) : null,
            allDay: !!createEvent.allDay,
            location: createEvent.location ?? null,
          }).returning();
          if (event) res.write(`data: ${JSON.stringify({ type: "event_created", event })}\n\n`);
        }
      } catch (err) {
        console.error("[AI Action] event insert failed:", err);
      }
    }

    if (logFinance?.type && typeof logFinance.amount === "number" && logFinance.amount > 0 && logFinance.category) {
      try {
        const [transaction] = await db.insert(financeTransactions).values({
          userId,
          type: logFinance.type,
          amountCents: Math.round(logFinance.amount * 100),
          category: logFinance.category,
          description: logFinance.description ?? null,
          date: new Date(),
        }).returning();
        if (transaction) res.write(`data: ${JSON.stringify({ type: "finance_logged", transaction })}\n\n`);
      } catch (err) {
        console.error("[AI Action] finance insert failed:", err);
      }
    }

    if (saveNote?.content?.trim()) {
      try {
        const [note] = await db.insert(notes).values({
          userId,
          content: saveNote.content.trim(),
          title: saveNote.title?.trim() ?? null,
        }).returning();
        if (note) res.write(`data: ${JSON.stringify({ type: "note_saved", note })}\n\n`);
      } catch (err) {
        console.error("[AI Action] note insert failed:", err);
      }
    }

    if (alarmReminder?.scheduledAt && !assistantMetadata) {
      try {
        const scheduledAt = new Date(alarmReminder.scheduledAt);
        if (!isNaN(scheduledAt.getTime())) {
          const [alarm] = await db.insert(alarmReminders).values({
            userId,
            title: alarmReminder.title,
            message: alarmReminder.message ?? null,
            kind: alarmReminder.kind,
            scheduledAt,
            nextTriggerAt: scheduledAt,
            repeatType: alarmReminder.repeatType,
            intervalMinutes: alarmReminder.repeatType === "interval" ? alarmReminder.intervalMinutes ?? 60 : null,
            repeatDays: [],
            active: true,
          }).returning();
          if (alarm) res.write(`data: ${JSON.stringify({ type: "alarm_created", alarm })}\n\n`);
        }
      } catch (err) {
        console.error("[AI Action] alarm insert failed:", err);
      }
    }

    storage.updateUserStreak(userId).catch(() => {});
    updatePersonalityFromMessage(userId, content, cleanText).catch(() => {});
    storage.upsertBeeConversationContext({
      userId,
      ...buildConversationContextUpdate({
        previous: beeConversationContext,
        recentMessages: history,
        userMessage: content,
        assistantResponse: cleanText,
      }),
    }).catch(() => {});

    res.write(`data: ${JSON.stringify({ type: "done", cleanText, id: assistantMessage.id, metadata: assistantMessage.metadata ?? null })}\n\n`);
    res.end();
  }));

  router.get("/api/proactive", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const recentMessages = await storage.getMessagesByUser(userId, 50);
    const openAlarmPrompt = findOpenAlarmReactivationPrompt(recentMessages);
    if (openAlarmPrompt) {
      return sendOk(res, {
        message: openAlarmPrompt.content,
        id: openAlarmPrompt.id,
        metadata: openAlarmPrompt.metadata,
        createdAt: openAlarmPrompt.createdAt,
      });
    }

    const [alarmPrompt] = await createDueAlarmReactivationPrompts(userId, false);
    if (alarmPrompt) {
      return sendOk(res, {
        message: alarmPrompt.content,
        id: alarmPrompt.id,
        metadata: alarmPrompt.metadata,
        createdAt: alarmPrompt.createdAt,
      });
    }
    const recentForCooldown = recentMessages.slice(-10);

    if (recentForCooldown.length > 0) {
      const lastMsg = recentForCooldown[recentForCooldown.length - 1];
      const minutesSinceLast = (Date.now() - new Date(lastMsg.createdAt).getTime()) / 60000;
      if (minutesSinceLast < 15) return sendOk(res, { message: null });

      const lastProactive = [...recentForCooldown].reverse().find((message) => {
        try { return JSON.parse(message.metadata || "{}").proactive === true; } catch { return false; }
      });
      if (lastProactive) {
        const minutesSince = (Date.now() - new Date(lastProactive.createdAt).getTime()) / 60000;
        if (minutesSince < 90) return sendOk(res, { message: null });
      }
    }

    // Fetch colmeia context to detect urgent situations
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const next4h  = new Date(now.getTime() +  4 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [upcomingEvents, monthTxs] = await Promise.all([
      db.select({ title: calendarEvents.title, startAt: calendarEvents.startAt, location: calendarEvents.location })
        .from(calendarEvents)
        .where(and(eq(calendarEvents.userId, userId), gte(calendarEvents.startAt, now), lte(calendarEvents.startAt, next24h)))
        .orderBy(calendarEvents.startAt)
        .limit(5),
      db.select({ type: financeTransactions.type, amountCents: financeTransactions.amountCents, category: financeTransactions.category })
        .from(financeTransactions)
        .where(and(eq(financeTransactions.userId, userId), gte(financeTransactions.date, monthStart))),
    ]);

    const totalIncome  = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amountCents, 0);
    const totalExpense = monthTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amountCents, 0);
    const balance = totalIncome - totalExpense;
    const byCat = monthTxs.filter(t => t.type === "expense").reduce((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amountCents;
      return acc;
    }, {} as Record<string, number>);
    const topCatEntry = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

    const hasUrgentEvent = upcomingEvents.some(e => new Date(e.startAt) <= next4h);
    const hasBadFinance  = monthTxs.length >= 3 && balance < 0;
    const financeSummary = monthTxs.length > 0
      ? { balance, totalExpense, topCategory: topCatEntry?.[0], topCategoryAmount: topCatEntry?.[1] }
      : null;

    // Skip randomly unless there's an urgent context
    if (!hasUrgentEvent && !hasBadFinance && Math.random() > 0.4) {
      return sendOk(res, { message: null });
    }

    const [user, personality] = await Promise.all([
      storage.getUser(userId),
      storage.getPersonality(userId),
    ]);

    if (!user || !personality) return sendOk(res, { message: null });

    // Use app tip only when there's no colmeia context to highlight
    const hasColmeiaContext = upcomingEvents.length > 0 || financeSummary !== null;
    const content = (!hasColmeiaContext && Math.random() < 0.35)
      ? APP_TIPS[Math.floor(Math.random() * APP_TIPS.length)].text
      : await generateProactiveMessage(user, personality, [], upcomingEvents, financeSummary);
    if (!content) return sendOk(res, { message: null });

    await storage.createMessage({
      userId,
      role: "assistant",
      content,
      metadata: JSON.stringify({ proactive: true }),
    });

    return sendOk(res, { message: content });
  }));

  router.get("/api/app-tip", requireAuth, asyncHandler(async (req, res) => {
    const recentMessages = await storage.getMessagesByUser(req.userId!, 60);

    // Check 4-hour cooldown since last tip
    const lastTip = [...recentMessages].reverse().find((m) => {
      try { return JSON.parse(m.metadata || "{}").appTip === true; } catch { return false; }
    });
    if (lastTip) {
      const hoursSince = (Date.now() - new Date(lastTip.createdAt).getTime()) / 3600000;
      if (hoursSince < 4) return sendOk(res, { tip: null });
    }

    // Collect tip IDs shown in the last 60 messages to avoid recent repetition
    const recentTipIds = new Set<number>();
    for (const m of recentMessages) {
      try {
        const meta = JSON.parse(m.metadata || "{}");
        if (meta.appTip && typeof meta.tipId === "number") recentTipIds.add(meta.tipId);
      } catch { /* ignore */ }
    }

    // Pick a tip not recently shown; fall back to any if all were shown
    const available = APP_TIPS.filter((tip) => !recentTipIds.has(tip.id));
    const pool = available.length > 0 ? available : APP_TIPS;
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    await storage.createMessage({
      userId: req.userId!,
      role: "assistant",
      content: chosen.text,
      metadata: JSON.stringify({ appTip: true, tipId: chosen.id }),
    });

    return sendOk(res, { tip: chosen.text });
  }));

  router.patch("/api/messages/:id", requireAuth, asyncHandler(async (req, res) => {
    const { content, metadata } = req.body ?? {};
    if (typeof content !== "string" || typeof metadata !== "string") {
      throw badRequest("content e metadata são obrigatórios");
    }

    const updated = await storage.updateMessageMetadata(req.params.id, req.userId!, { content, metadata });
    if (!updated) {
      throw notFound("Mensagem não encontrada");
    }

    return sendOk(res, updated);
  }));

  router.post("/api/news/summarize", requireAuth, asyncHandler(async (req, res) => {
    const { url, title } = req.body ?? {};
    if (!url || !title) {
      throw badRequest("url e title obrigatórios");
    }

    const summary = await summarizeNewsArticle(url, title);
    if (!summary) {
      return sendError(res, 502, "UPSTREAM_ERROR", "Não foi possível gerar o resumo");
    }

    return sendOk(res, { summary });
  }));

  router.post("/api/transcribe", requireAuth, asyncHandler(async (req, res) => {
    const { audio, mimeType = "audio/webm" } = req.body ?? {};
    if (!audio || typeof audio !== "string") {
      throw badRequest("audio é obrigatório");
    }
    const text = await transcribeAudio(audio, mimeType);
    return sendOk(res, { text });
  }));

  return router;
}
