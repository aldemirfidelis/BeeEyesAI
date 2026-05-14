/**
 * alarmService.ts
 *
 * Centralizes all alarm/notification scheduling logic for the Bee app.
 * Fixes:
 *  - repeatType "daily" now uses the DAILY trigger (was falling through to one-shot DATE)
 *  - repeatType "weekly" / repeatDays uses WEEKLY trigger correctly
 *  - On app start, validates stored localNotificationId against the OS queue
 *    and reschedules any alarms whose notifications no longer exist
 *  - Snooze creates a new one-shot notification 5 minutes from now
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { CHANNEL, requestNotificationPermission } from "../lib/notifications";

// ── Types (mirrors server schema) ─────────────────────────────────────────────

export interface AlarmRecord {
  id: string;
  title: string;
  message?: string | null;
  kind: "alarm" | "reminder" | "medicine" | "appointment";
  scheduledAt: string;
  nextTriggerAt: string;
  repeatType: "once" | "daily" | "weekly" | "interval";
  repeatDays?: number[] | null;
  intervalMinutes?: number | null;
  active: boolean;
  localNotificationId?: string | null;
  pausedAt?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function alarmKindLabel(kind: AlarmRecord["kind"]): string {
  if (kind === "medicine") return "Remédio";
  if (kind === "appointment") return "Compromisso";
  if (kind === "reminder") return "Lembrete";
  return "Despertador";
}

export function alarmBodyText(alarm: Pick<AlarmRecord, "kind" | "title" | "message">): string {
  if (alarm.message?.trim()) return alarm.message.trim();
  if (alarm.kind === "medicine") return `Hora de tomar: ${alarm.title}`;
  if (alarm.kind === "appointment") return `Compromisso: ${alarm.title}`;
  if (alarm.kind === "reminder") return `Lembrete: ${alarm.title}`;
  return alarm.title;
}

export function alarmRepeatLabel(alarm: Pick<AlarmRecord, "repeatType" | "repeatDays" | "intervalMinutes">): string {
  if (alarm.repeatDays && alarm.repeatDays.length > 0) {
    if (alarm.repeatDays.length === 7) return "Todo dia";
    const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return alarm.repeatDays.map((d) => names[d] ?? d).join(", ");
  }
  if (alarm.repeatType === "daily") return "Todo dia";
  if (alarm.repeatType === "weekly") return "Semanalmente";
  if (alarm.repeatType === "interval") {
    const mins = alarm.intervalMinutes ?? 60;
    return mins < 60 ? `A cada ${mins}min` : `A cada ${Math.round(mins / 60)}h`;
  }
  return "Uma vez";
}

// ── Notification ID helpers ───────────────────────────────────────────────────

/** Parse stored localNotificationId — may be a JSON array for multi-day weekly alarms. */
function parseNotificationIds(stored: string | null | undefined): string[] {
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    // single string id
  }
  return [stored];
}

/**
 * Returns true when ALL parsed notification IDs exist in the given scheduled-IDs set.
 * An alarm with zero IDs is considered invalid (not scheduled).
 */
export function hasValidScheduledNotifications(
  localNotificationId: string | null | undefined,
  scheduledIds: Set<string>,
): boolean {
  const ids = parseNotificationIds(localNotificationId);
  return ids.length > 0 && ids.every((id) => scheduledIds.has(id));
}

// ── Cancel ────────────────────────────────────────────────────────────────────

export async function cancelAlarmNotifications(localNotificationId: string | null | undefined): Promise<void> {
  const ids = parseNotificationIds(localNotificationId);
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

// ── Build notification content ────────────────────────────────────────────────

function buildNotificationContent(alarm: AlarmRecord): Notifications.NotificationContentInput {
  return {
    title: `🐝 BeeEyes · ${alarmKindLabel(alarm.kind)}`,
    body: alarmBodyText(alarm),
    data: {
      source: "bee-alarm",
      screen: "/bee-alarm",
      alarmId: alarm.id,
      alarmTitle: alarm.title,
      alarmBody: alarmBodyText(alarm),
    },
    sound: true,
    categoryIdentifier: "bee-alarm-actions",
    ...(Platform.OS === "android" && { channelId: CHANNEL.ALARMS }),
  };
}

// ── Schedule ──────────────────────────────────────────────────────────────────

/**
 * Schedules a local notification for the given alarm.
 * Returns the stored localNotificationId string (may be a JSON array for multi-day weekly).
 * Returns null if permission was denied or the trigger date is in the past.
 */
export async function scheduleAlarm(alarm: AlarmRecord): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    if (__DEV__) console.log("[AlarmService] Permission denied, cannot schedule", alarm.id);
    return null;
  }

  const triggerDate = new Date(alarm.nextTriggerAt);
  const content = buildNotificationContent(alarm);

  // ── Multi-day weekly (specific weekdays) ─────────────────────────────────
  if (alarm.repeatDays && alarm.repeatDays.length > 0 && alarm.repeatDays.length < 7) {
    const ids = await Promise.all(
      alarm.repeatDays.map((day) =>
        Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: (day + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7, // expo: 1=Sun … 7=Sat
            hour: triggerDate.getHours(),
            minute: triggerDate.getMinutes(),
          },
        }).catch((err) => {
          if (__DEV__) console.warn("[AlarmService] WEEKLY schedule failed:", err);
          return null;
        }),
      ),
    );
    const validIds = ids.filter((id): id is string => id !== null);
    if (validIds.length === 0) return null;
    const stored = validIds.length === 1 ? validIds[0] : JSON.stringify(validIds);
    if (__DEV__) console.log("[AlarmService] Scheduled WEEKLY alarm", alarm.id, stored);
    return stored;
  }

  // ── Daily (every day or all 7 days selected) ──────────────────────────────
  if (alarm.repeatType === "daily" || (alarm.repeatDays && alarm.repeatDays.length === 7)) {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: triggerDate.getHours(),
        minute: triggerDate.getMinutes(),
      },
    }).catch((err) => {
      if (__DEV__) console.warn("[AlarmService] DAILY schedule failed:", err);
      return null;
    });
    if (__DEV__) console.log("[AlarmService] Scheduled DAILY alarm", alarm.id, id);
    return id;
  }

  // ── Interval (every N minutes) ────────────────────────────────────────────
  if (alarm.repeatType === "interval") {
    const seconds = Math.max(60, (alarm.intervalMinutes ?? 60) * 60);
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: true,
      },
    }).catch((err) => {
      if (__DEV__) console.warn("[AlarmService] INTERVAL schedule failed:", err);
      return null;
    });
    if (__DEV__) console.log("[AlarmService] Scheduled INTERVAL alarm", alarm.id, id);
    return id;
  }

  // ── Once (DATE trigger) ───────────────────────────────────────────────────
  // Only schedule if trigger is in the future
  if (triggerDate.getTime() <= Date.now()) {
    if (__DEV__) console.log("[AlarmService] Skipping past alarm", alarm.id, alarm.nextTriggerAt);
    return null;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  }).catch((err) => {
    if (__DEV__) console.warn("[AlarmService] DATE schedule failed:", err);
    return null;
  });
  if (__DEV__) console.log("[AlarmService] Scheduled DATE alarm", alarm.id, id);
  return id;
}

// ── Snooze (one-shot 5 minutes from now) ─────────────────────────────────────

export async function snoozeAlarm(alarm: Pick<AlarmRecord, "id" | "title" | "message" | "kind">, minutes = 5): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  const snoozeDate = new Date(Date.now() + minutes * 60 * 1000);
  const content: Notifications.NotificationContentInput = {
    title: `🐝 BeeEyes · ${alarmKindLabel(alarm.kind)} (adiado)`,
    body: alarmBodyText(alarm),
    data: {
      source: "bee-alarm",
      screen: "/bee-alarm",
      alarmId: alarm.id,
      alarmTitle: alarm.title,
      alarmBody: alarmBodyText(alarm),
      snoozed: true,
    },
    sound: true,
    categoryIdentifier: "bee-alarm-actions",
    ...(Platform.OS === "android" && { channelId: CHANNEL.ALARMS }),
  };

  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: snoozeDate,
    },
  }).catch(() => null);

  if (__DEV__) console.log("[AlarmService] Snoozed alarm", alarm.id, `for ${minutes}min → ${snoozeDate.toLocaleTimeString()}`);
  return id;
}

// ── On App Start: validate + reschedule ───────────────────────────────────────

/**
 * Validates stored notification IDs against the OS schedule.
 * Re-schedules any active alarms whose notifications no longer exist.
 * Call this in ClockSection.load() after fetching alarms from server.
 *
 * @param alarms  - Array of alarms from server
 * @param onReschedule - Callback to persist the new localNotificationId
 */
export async function validateAndRescheduleAlarms(
  alarms: AlarmRecord[],
  onReschedule: (alarm: AlarmRecord, newLocalId: string) => Promise<void>,
): Promise<void> {
  let scheduledNotifications: Notifications.ScheduledNotificationTrigger[] = [];
  const scheduledIds = new Set<string>();

  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) scheduledIds.add(n.identifier);
    scheduledNotifications = all as any;
    if (__DEV__) console.log("[AlarmService] OS has", scheduledIds.size, "scheduled notifications");
  } catch (err) {
    if (__DEV__) console.warn("[AlarmService] Could not read scheduled notifications:", err);
    return;
  }

  for (const alarm of alarms) {
    if (!alarm.active) continue;

    const stillValid = hasValidScheduledNotifications(alarm.localNotificationId, scheduledIds);

    if (!stillValid) {
      // For "once" alarms that have already passed, skip — server will deactivate them
      const triggerDate = new Date(alarm.nextTriggerAt);
      const isRecurring = alarm.repeatType !== "once" || (alarm.repeatDays && alarm.repeatDays.length > 0);
      if (!isRecurring && triggerDate.getTime() <= Date.now()) {
        if (__DEV__) console.log("[AlarmService] Skipping past once alarm", alarm.id);
        continue;
      }

      if (__DEV__) console.log("[AlarmService] Rescheduling alarm", alarm.id, "(not found in OS queue)");
      const newLocalId = await scheduleAlarm(alarm);
      if (newLocalId) {
        await onReschedule(alarm, newLocalId);
      }
    }
  }
}
