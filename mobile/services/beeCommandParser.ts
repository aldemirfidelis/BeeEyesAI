export type BeeMobileCommandActionType = "calendar_event" | "alarm_reminder";

export type BeeMobileMissingField = "title" | "date" | "time";

export interface BeeMobileCalendarAction {
  type: "calendar_event";
  title: string;
  startAt?: string;
  endAt?: string | null;
  allDay?: boolean;
  description?: string | null;
  missingFields?: BeeMobileMissingField[];
}

export interface BeeMobileAlarmAction {
  type: "alarm_reminder";
  title: string;
  message?: string | null;
  kind: "alarm" | "reminder" | "medicine" | "appointment";
  scheduledAt?: string;
  repeatType: "once" | "daily" | "weekly" | "interval";
  intervalMinutes?: number | null;
  repeatDays?: number[];
  linkedEvent?: boolean;
  reminderOffsetMinutes?: number | null;
  missingFields?: BeeMobileMissingField[];
}

export type BeeMobileCommandAction = BeeMobileCalendarAction | BeeMobileAlarmAction;

export interface BeeMobileCommandParseResult {
  originalMessage: string;
  actions: BeeMobileCommandAction[];
  missingFields: BeeMobileMissingField[];
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export const BEE_DEFAULT_REMINDER_TIME = "08:00";
export const BEE_DEFAULT_EVENT_REMINDER_OFFSET_MINUTES = 30;

export function hasMissingBeeCommandFields(action: BeeMobileCommandAction) {
  return (action.missingFields?.length ?? 0) > 0;
}
