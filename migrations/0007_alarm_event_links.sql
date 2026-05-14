ALTER TABLE "alarm_reminders"
  ADD COLUMN IF NOT EXISTS "linked_event_id" varchar REFERENCES "calendar_events"("id") ON DELETE cascade;

ALTER TABLE "alarm_reminders"
  ADD COLUMN IF NOT EXISTS "reminder_offset_minutes" integer;

CREATE INDEX IF NOT EXISTS "alarm_reminders_linked_event_idx"
  ON "alarm_reminders" ("linked_event_id");
