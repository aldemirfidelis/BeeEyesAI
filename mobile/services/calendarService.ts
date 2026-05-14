import { api } from "../lib/api";

export interface CreateCalendarEventInput {
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  location?: string | null;
}

export async function createCalendarEvent(input: CreateCalendarEventInput) {
  const response = await api.post("/api/colmeia/events", input);
  return response.data;
}
