ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "replied_to_message_id" varchar;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "replied_to_message_content" text;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "replied_to_message_role" text;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "replied_to_message_created_at" timestamp;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_reply_idx" ON "messages" ("replied_to_message_id");
