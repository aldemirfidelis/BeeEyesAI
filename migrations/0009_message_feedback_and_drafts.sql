CREATE TABLE IF NOT EXISTS "message_feedback" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "message_id" varchar NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "feedback_type" text NOT NULL,
  "feedback_reason" text,
  "message_category" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "message_feedback_user_idx" ON "message_feedback" ("user_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "message_feedback_user_message_uidx" ON "message_feedback" ("user_id", "message_id");

CREATE TABLE IF NOT EXISTS "feed_drafts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source_message_id" varchar REFERENCES "messages"("id") ON DELETE SET NULL,
  "title" text,
  "content" text NOT NULL,
  "category" text,
  "hashtags" text,
  "privacy" text NOT NULL DEFAULT 'public',
  "status" text NOT NULL DEFAULT 'draft',
  "published_post_id" varchar REFERENCES "posts"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "feed_drafts_user_status_idx" ON "feed_drafts" ("user_id", "status", "created_at");
