CREATE TABLE IF NOT EXISTS "notification_reads" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "notification_id" text NOT NULL,
  "read_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notification_reads_user_read_idx"
  ON "notification_reads" ("user_id", "read_at");

CREATE UNIQUE INDEX IF NOT EXISTS "notification_reads_user_notification_uidx"
  ON "notification_reads" ("user_id", "notification_id");
