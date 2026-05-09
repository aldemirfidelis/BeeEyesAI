import { and, eq, isNotNull, isNull, lte, ne } from "drizzle-orm";
import { db } from "./db";
import { sendPushToUser } from "./push";
import { storage } from "./storage";
import { alarmReminders, type Message } from "../shared/schema";

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

function getSaoPauloDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function getAlarmReactivationReviewAt(now = new Date()) {
  const { year, month, day } = getSaoPauloDateParts(now);
  const reviewAt = new Date(Date.UTC(year, month - 1, day, 24, 0, 0, 0));
  if (reviewAt <= now) return new Date(now.getTime() + 5 * 60 * 1000);
  return reviewAt;
}

function buildAlarmReactivationContent(alarm: { title: string }) {
  return `O alarme recorrente "${alarm.title}" ficou pausado hoje. Quer reativar para os proximos lembretes?`;
}

function buildAlarmReactivationMetadata(alarm: { id: string; title: string; repeatType: string }) {
  return JSON.stringify({
    type: "reactivate_alarm_confirmation",
    alarmId: alarm.id,
    title: alarm.title,
    repeatType: alarm.repeatType,
  });
}

export function findOpenAlarmReactivationPrompt(messages: Message[]) {
  return [...messages].reverse().find((message) => {
    try {
      return JSON.parse(message.metadata || "{}")?.type === "reactivate_alarm_confirmation";
    } catch {
      return false;
    }
  });
}

export async function createDueAlarmReactivationPrompts(userId?: string, push = false) {
  const now = new Date();
  const rows = await db
    .select()
    .from(alarmReminders)
    .where(and(
      eq(alarmReminders.active, false),
      ne(alarmReminders.repeatType, "once"),
      isNotNull(alarmReminders.reactivationReminderAt),
      isNull(alarmReminders.reactivationPromptedAt),
      lte(alarmReminders.reactivationReminderAt, now),
      userId ? eq(alarmReminders.userId, userId) : undefined,
    ))
    .limit(25);

  const created: Message[] = [];
  for (const alarm of rows) {
    const message = await storage.createMessage({
      userId: alarm.userId,
      role: "assistant",
      content: buildAlarmReactivationContent(alarm),
      metadata: buildAlarmReactivationMetadata(alarm),
    });
    created.push(message);

    await db
      .update(alarmReminders)
      .set({ reactivationPromptedAt: now, updatedAt: now })
      .where(eq(alarmReminders.id, alarm.id));

    if (push) {
      await sendPushToUser(
        alarm.userId,
        "BeeEyes · Reativar alarme?",
        buildAlarmReactivationContent(alarm),
        { source: "bee-alarm-reactivation", screen: "/(tabs)/chat", alarmId: alarm.id },
        "bee-alarms",
      );
    }
  }

  return created;
}
