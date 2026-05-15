CREATE TABLE IF NOT EXISTS "user_memories" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "memory_type" varchar(40) DEFAULT 'fact' NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "source" varchar(40) DEFAULT 'chat' NOT NULL,
  "importance" integer DEFAULT 3 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "category" varchar(60) NOT NULL,
  "preference" text NOT NULL,
  "weight" integer DEFAULT 1 NOT NULL,
  "source" varchar(40) DEFAULT 'inferred' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bee_conversation_contexts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "context_summary" text DEFAULT '' NOT NULL,
  "recent_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "emotional_tone" varchar(40) DEFAULT 'neutral' NOT NULL,
  "active_goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "personalization_enabled" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "bee_conversation_contexts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_memories" ADD CONSTRAINT "user_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_conversation_contexts" ADD CONSTRAINT "bee_conversation_contexts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_user_active_idx" ON "user_memories" ("user_id","active","importance");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_memories_user_content_uidx" ON "user_memories" ("user_id","content");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_preferences_user_active_idx" ON "user_preferences" ("user_id","active","category");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_user_category_preference_uidx" ON "user_preferences" ("user_id","category","preference");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_conversation_contexts_user_idx" ON "bee_conversation_contexts" ("user_id");
