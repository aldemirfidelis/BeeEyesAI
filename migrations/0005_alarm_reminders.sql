CREATE TABLE IF NOT EXISTS "alarm_reminders" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "message" text,
  "kind" varchar(20) NOT NULL DEFAULT 'alarm',
  "scheduled_at" timestamp NOT NULL,
  "next_trigger_at" timestamp NOT NULL,
  "last_triggered_at" timestamp,
  "repeat_type" varchar(20) NOT NULL DEFAULT 'once',
  "interval_minutes" integer,
  "repeat_days" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "active" boolean NOT NULL DEFAULT true,
  "local_notification_id" text,
  "paused_at" timestamp,
  "reactivation_reminder_at" timestamp,
  "reactivation_prompted_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "alarm_reminders" ADD COLUMN IF NOT EXISTS "repeat_days" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "alarm_reminders" ADD COLUMN IF NOT EXISTS "paused_at" timestamp;
ALTER TABLE "alarm_reminders" ADD COLUMN IF NOT EXISTS "reactivation_reminder_at" timestamp;
ALTER TABLE "alarm_reminders" ADD COLUMN IF NOT EXISTS "reactivation_prompted_at" timestamp;
CREATE INDEX IF NOT EXISTS "alarm_reminders_user_next_idx" ON "alarm_reminders" ("user_id", "next_trigger_at");
CREATE INDEX IF NOT EXISTS "alarm_reminders_active_next_idx" ON "alarm_reminders" ("active", "next_trigger_at");
CREATE INDEX IF NOT EXISTS "alarm_reminders_reactivation_idx" ON "alarm_reminders" ("active", "reactivation_reminder_at");
