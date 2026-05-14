import { createCalendarEvent } from "./calendarService";
import { createReminder } from "./reminderService";
import type { BeeMobileCommandAction } from "./beeCommandParser";

export interface BeeActionRouterResult {
  events: unknown[];
  reminders: unknown[];
}

export async function routeBeeActions(actions: BeeMobileCommandAction[]): Promise<BeeActionRouterResult> {
  const events: unknown[] = [];
  const reminders: unknown[] = [];
  let firstEventId: string | null = null;

  for (const action of actions) {
    if (action.type !== "calendar_event" || !action.startAt) continue;
    const event = await createCalendarEvent({
      title: action.title,
      description: action.description ?? null,
      startAt: action.startAt,
      endAt: action.endAt ?? null,
      allDay: !!action.allDay,
    });
    firstEventId = readId(event) ?? firstEventId;
    events.push(event);
  }

  for (const action of actions) {
    if (action.type !== "alarm_reminder" || !action.scheduledAt) continue;
    const reminder = await createReminder({
      title: action.title,
      message: action.message ?? null,
      kind: action.kind,
      scheduledAt: action.scheduledAt,
      repeatType: action.repeatType,
      intervalMinutes: action.intervalMinutes ?? null,
      repeatDays: action.repeatDays ?? [],
      linkedEventId: action.linkedEvent ? firstEventId : null,
      reminderOffsetMinutes: action.reminderOffsetMinutes ?? null,
    });
    reminders.push(reminder);
  }

  return { events, reminders };
}

function readId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const maybeRecord = value as { id?: unknown; event?: { id?: unknown }; data?: { id?: unknown } };
  if (typeof maybeRecord.id === "string") return maybeRecord.id;
  if (typeof maybeRecord.event?.id === "string") return maybeRecord.event.id;
  if (typeof maybeRecord.data?.id === "string") return maybeRecord.data.id;
  return null;
}
