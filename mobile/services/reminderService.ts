import { api } from "../lib/api";

export interface CreateReminderInput {
  title: string;
  message?: string | null;
  kind: "alarm" | "reminder" | "medicine" | "appointment";
  scheduledAt: string;
  repeatType?: "once" | "daily" | "weekly" | "interval";
  intervalMinutes?: number | null;
  repeatDays?: number[];
  linkedEventId?: string | null;
  reminderOffsetMinutes?: number | null;
}

export async function createReminder(input: CreateReminderInput) {
  const response = await api.post("/api/colmeia/alarms", input);
  return response.data;
}
