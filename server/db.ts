import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

// Required for Node.js environments (not edge/serverless)
neonConfig.webSocketConstructor = ws;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function ensureDatabaseCompatibility() {
  await pool.query(`
    ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "anonymous_profile_visits_enabled" boolean NOT NULL DEFAULT false;
  `);
  await pool.query(`
    ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "allow_messages_from_strangers" boolean NOT NULL DEFAULT true;
  `);
  await pool.query(`
    ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "expo_push_token" text;
  `);
  await pool.query(`
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "image_url" text;
    ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "image_url" text;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;
  `);
  await pool.query(`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "language" varchar(10) NOT NULL DEFAULT 'pt-BR';
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean NOT NULL DEFAULT false;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "notification_reads" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "notification_id" varchar NOT NULL,
      "read_at" timestamp NOT NULL DEFAULT now(),
      UNIQUE("user_id", "notification_id")
    );
    CREATE INDEX IF NOT EXISTS "notification_reads_user_idx" ON "notification_reads" ("user_id");
  `);
  await pool.query(`
    ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "is_private" boolean NOT NULL DEFAULT false;
    ALTER TABLE "community_members" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "testimonials" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "profile_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "author_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "content" text NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "testimonials_profile_created_idx" ON "testimonials" ("profile_user_id", "created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "testimonials_profile_author_uidx" ON "testimonials" ("profile_user_id", "author_user_id");
  `);
  await pool.query(`
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
      "linked_event_id" varchar REFERENCES "calendar_events"("id") ON DELETE cascade,
      "reminder_offset_minutes" integer,
      "paused_at" timestamp,
      "reactivation_reminder_at" timestamp,
      "reactivation_prompted_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE "alarm_reminders" ADD COLUMN IF NOT EXISTS "repeat_days" jsonb NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE "alarm_reminders" ADD COLUMN IF NOT EXISTS "linked_event_id" varchar REFERENCES "calendar_events"("id") ON DELETE cascade;
    ALTER TABLE "alarm_reminders" ADD COLUMN IF NOT EXISTS "reminder_offset_minutes" integer;
    ALTER TABLE "alarm_reminders" ADD COLUMN IF NOT EXISTS "paused_at" timestamp;
    ALTER TABLE "alarm_reminders" ADD COLUMN IF NOT EXISTS "reactivation_reminder_at" timestamp;
    ALTER TABLE "alarm_reminders" ADD COLUMN IF NOT EXISTS "reactivation_prompted_at" timestamp;
    CREATE INDEX IF NOT EXISTS "alarm_reminders_user_next_idx" ON "alarm_reminders" ("user_id", "next_trigger_at");
    CREATE INDEX IF NOT EXISTS "alarm_reminders_active_next_idx" ON "alarm_reminders" ("active", "next_trigger_at");
    CREATE INDEX IF NOT EXISTS "alarm_reminders_reactivation_idx" ON "alarm_reminders" ("active", "reactivation_reminder_at");
    CREATE INDEX IF NOT EXISTS "alarm_reminders_linked_event_idx" ON "alarm_reminders" ("linked_event_id");
  `);
  await pool.query(`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" text;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_daily_briefing_date" text;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "wishlist_items" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "source_ad_id" text,
      "product_id" text,
      "title" text NOT NULL,
      "description" text,
      "image_url" text,
      "original_url" text,
      "category" varchar(80) NOT NULL DEFAULT 'Outros',
      "price_cents" integer,
      "currency" varchar(10) NOT NULL DEFAULT 'BRL',
      "brand" text,
      "store_name" text,
      "status" varchar(32) NOT NULL DEFAULT 'saved',
      "personal_note" text,
      "interest_score" integer NOT NULL DEFAULT 1,
      "priority" varchar(32) NOT NULL DEFAULT 'medium',
      "source_type" varchar(40) NOT NULL DEFAULT 'manual',
      "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      "purchased_at" timestamp,
      "removed_at" timestamp
    );
    CREATE INDEX IF NOT EXISTS "wishlist_items_user_created_idx" ON "wishlist_items" ("user_id", "created_at");
    CREATE INDEX IF NOT EXISTS "wishlist_items_user_category_idx" ON "wishlist_items" ("user_id", "category");
    CREATE INDEX IF NOT EXISTS "wishlist_items_user_status_idx" ON "wishlist_items" ("user_id", "status");
    CREATE INDEX IF NOT EXISTS "wishlist_items_user_removed_idx" ON "wishlist_items" ("user_id", "removed_at");
    CREATE INDEX IF NOT EXISTS "wishlist_items_source_ad_idx" ON "wishlist_items" ("user_id", "source_ad_id");
    CREATE INDEX IF NOT EXISTS "wishlist_items_product_idx" ON "wishlist_items" ("user_id", "product_id");
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "user_interests" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "interest_name" text NOT NULL,
      "category" varchar(80) NOT NULL DEFAULT 'Outros',
      "score" integer NOT NULL DEFAULT 1,
      "source" varchar(40) NOT NULL DEFAULT 'wishlist',
      "active" boolean NOT NULL DEFAULT true,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "user_interests_user_active_idx" ON "user_interests" ("user_id", "active");
    CREATE UNIQUE INDEX IF NOT EXISTS "user_interests_user_name_uidx" ON "user_interests" ("user_id", "interest_name");
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "wishlist_events" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "wishlist_item_id" varchar REFERENCES "wishlist_items"("id") ON DELETE set null,
      "event_type" varchar(80) NOT NULL,
      "event_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "created_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "wishlist_events_user_created_idx" ON "wishlist_events" ("user_id", "created_at");
    CREATE INDEX IF NOT EXISTS "wishlist_events_item_idx" ON "wishlist_events" ("wishlist_item_id");
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "wishlist_preferences" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE cascade,
      "allow_personalized_recommendations" boolean NOT NULL DEFAULT true,
      "allow_price_alerts" boolean NOT NULL DEFAULT false,
      "allow_bee_notifications" boolean NOT NULL DEFAULT true,
      "show_recommendation_reasons" boolean NOT NULL DEFAULT true,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "wishlist_preferences_user_idx" ON "wishlist_preferences" ("user_id");
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "calendar_preferences" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE cascade,
      "state" varchar(2),
      "notify_national_holidays" boolean NOT NULL DEFAULT true,
      "notify_state_holidays" boolean NOT NULL DEFAULT true,
      "notify_special_dates" boolean NOT NULL DEFAULT true,
      "notify_one_day_before" boolean NOT NULL DEFAULT true,
      "notify_on_day" boolean NOT NULL DEFAULT false,
      "enabled_categories" text NOT NULL DEFAULT '[]',
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "calendar_preferences_user_idx" ON "calendar_preferences" ("user_id");
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "calendar_notification_log" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "event_id" text NOT NULL,
      "notification_type" varchar(20) NOT NULL,
      "sent_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "cal_notif_log_user_idx" ON "calendar_notification_log" ("user_id", "sent_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "cal_notif_log_unique_idx" ON "calendar_notification_log" ("user_id", "event_id", "notification_type");
  `);
  await pool.query(`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;
    CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uidx" ON "users" ("email") WHERE "email" IS NOT NULL;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "health_profiles" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE cascade,
      "health_goal" varchar(40) NOT NULL DEFAULT 'saude_geral',
      "level" varchar(20) NOT NULL DEFAULT 'iniciante',
      "training_days" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "rest_days" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "preferred_workout_time" varchar(8),
      "equipment_preference" varchar(30) NOT NULL DEFAULT 'misto',
      "reminder_enabled" boolean NOT NULL DEFAULT false,
      "reminder_minutes_before" integer NOT NULL DEFAULT 30,
      "avoid_exercises" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "health_profiles_user_idx" ON "health_profiles" ("user_id");
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "workout_plans" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "name" text NOT NULL,
      "goal" varchar(40) NOT NULL DEFAULT 'saude_geral',
      "level" varchar(20) NOT NULL DEFAULT 'iniciante',
      "split_type" varchar(30) NOT NULL DEFAULT 'full_body',
      "training_days" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "rest_days" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "days" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "active" boolean NOT NULL DEFAULT true,
      "created_by" varchar(20) NOT NULL DEFAULT 'user',
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "workout_plans_user_active_idx" ON "workout_plans" ("user_id", "active");
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "workout_sessions" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "workout_plan_id" varchar REFERENCES "workout_plans"("id") ON DELETE set null,
      "day_key" varchar(12) NOT NULL,
      "date" timestamp NOT NULL DEFAULT now(),
      "completed" boolean NOT NULL DEFAULT false,
      "duration_minutes" integer,
      "exercises_completed" integer NOT NULL DEFAULT 0,
      "exercises_skipped" integer NOT NULL DEFAULT 0,
      "effort_level" varchar(20),
      "mood" varchar(20),
      "notes" text,
      "exercise_log" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "created_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "workout_sessions_user_date_idx" ON "workout_sessions" ("user_id", "date");
    CREATE INDEX IF NOT EXISTS "workout_sessions_plan_idx" ON "workout_sessions" ("workout_plan_id");
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "token_hash" text NOT NULL UNIQUE,
      "expires_at" timestamp NOT NULL,
      "used_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_idx" ON "password_reset_tokens" ("user_id");
    CREATE INDEX IF NOT EXISTS "password_reset_tokens_hash_idx" ON "password_reset_tokens" ("token_hash");
  `);
  await pool.query(`
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "replied_to_message_id" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "replied_to_message_content" text;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "replied_to_message_role" text;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "replied_to_message_created_at" timestamp;
    CREATE INDEX IF NOT EXISTS "messages_reply_idx" ON "messages" ("replied_to_message_id");
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "user_memories" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "memory_type" varchar(40) NOT NULL DEFAULT 'fact',
      "title" text NOT NULL,
      "content" text NOT NULL,
      "source" varchar(40) NOT NULL DEFAULT 'chat',
      "importance" integer NOT NULL DEFAULT 3,
      "active" boolean NOT NULL DEFAULT true,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "user_memories_user_active_idx" ON "user_memories" ("user_id", "active", "importance");
    CREATE UNIQUE INDEX IF NOT EXISTS "user_memories_user_content_uidx" ON "user_memories" ("user_id", "content");

    CREATE TABLE IF NOT EXISTS "user_preferences" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "category" varchar(60) NOT NULL,
      "preference" text NOT NULL,
      "weight" integer NOT NULL DEFAULT 1,
      "source" varchar(40) NOT NULL DEFAULT 'inferred',
      "active" boolean NOT NULL DEFAULT true,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "user_preferences_user_active_idx" ON "user_preferences" ("user_id", "active", "category");
    CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_user_category_preference_uidx" ON "user_preferences" ("user_id", "category", "preference");

    CREATE TABLE IF NOT EXISTS "bee_conversation_contexts" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE cascade,
      "context_summary" text NOT NULL DEFAULT '',
      "recent_topics" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "emotional_tone" varchar(40) NOT NULL DEFAULT 'neutral',
      "active_goals" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "personalization_enabled" boolean NOT NULL DEFAULT true,
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "bee_conversation_contexts_user_idx" ON "bee_conversation_contexts" ("user_id");
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "message_feedback" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "message_id" varchar NOT NULL REFERENCES "messages"("id") ON DELETE cascade,
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
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "source_message_id" varchar REFERENCES "messages"("id") ON DELETE set null,
      "title" text,
      "content" text NOT NULL,
      "category" text,
      "hashtags" text,
      "privacy" text NOT NULL DEFAULT 'public',
      "status" text NOT NULL DEFAULT 'draft',
      "published_post_id" varchar REFERENCES "posts"("id") ON DELETE set null,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "feed_drafts_user_status_idx" ON "feed_drafts" ("user_id", "status", "created_at");
  `);
  await pool.query(`
    ALTER TABLE "wishlist_items" ADD COLUMN IF NOT EXISTS "source_message_id" varchar;
    ALTER TABLE "wishlist_items" ADD COLUMN IF NOT EXISTS "source_conversation_id" varchar;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ad_groups" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "message_id" varchar REFERENCES "messages"("id") ON DELETE cascade,
      "anchor_message_id" varchar,
      "title" text NOT NULL DEFAULT 'Anúncios que podem te interessar',
      "layout_type" varchar(30) NOT NULL DEFAULT 'carousel',
      "max_items" integer NOT NULL DEFAULT 3,
      "status" varchar(20) NOT NULL DEFAULT 'active',
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "ad_groups_user_expires_idx" ON "ad_groups" ("user_id", "expires_at");
    CREATE INDEX IF NOT EXISTS "ad_groups_message_idx" ON "ad_groups" ("message_id");

    CREATE TABLE IF NOT EXISTS "ad_impressions" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "message_id" varchar REFERENCES "messages"("id") ON DELETE cascade,
      "anchor_message_id" varchar,
      "ad_group_id" varchar,
      "ad_id" text NOT NULL,
      "ad_mob_ad_unit_id" text,
      "ad_format" varchar(40) NOT NULL DEFAULT 'native',
      "ad_type" varchar(40) NOT NULL DEFAULT 'product_ad',
      "title" text NOT NULL,
      "description" text,
      "image_url" text,
      "video_url" text,
      "media_content" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "product_url" text,
      "advertiser_name" text,
      "call_to_action" text,
      "price" text,
      "category" varchar(80),
      "source" varchar(40) NOT NULL DEFAULT 'chat',
      "status" varchar(20) NOT NULL DEFAULT 'active',
      "added_to_wishlist" boolean NOT NULL DEFAULT false,
      "viewed_at" timestamp NOT NULL DEFAULT now(),
      "clicked_at" timestamp,
      "expires_at" timestamp NOT NULL,
      "ad_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "ad_group_id" varchar;
    ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "ad_mob_ad_unit_id" text;
    ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "ad_format" varchar(40) NOT NULL DEFAULT 'native';
    ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "ad_type" varchar(40) NOT NULL DEFAULT 'product_ad';
    ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "video_url" text;
    ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "media_content" jsonb NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "call_to_action" text;
    CREATE INDEX IF NOT EXISTS "ad_impressions_user_expires_idx" ON "ad_impressions" ("user_id", "expires_at");
    CREATE INDEX IF NOT EXISTS "ad_impressions_message_idx" ON "ad_impressions" ("message_id");
    CREATE INDEX IF NOT EXISTS "ad_impressions_anchor_idx" ON "ad_impressions" ("user_id", "anchor_message_id");
    CREATE INDEX IF NOT EXISTS "ad_impressions_group_idx" ON "ad_impressions" ("ad_group_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "ad_impressions_user_anchor_ad_uidx" ON "ad_impressions" ("user_id", "anchor_message_id", "ad_id");

    CREATE TABLE IF NOT EXISTS "ad_group_items" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "ad_group_id" varchar NOT NULL REFERENCES "ad_groups"("id") ON DELETE cascade,
      "ad_impression_id" varchar NOT NULL REFERENCES "ad_impressions"("id") ON DELETE cascade,
      "order" integer NOT NULL DEFAULT 0,
      "created_at" timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "ad_group_items_group_order_idx" ON "ad_group_items" ("ad_group_id", "order");
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "posts_created_at_idx" ON "posts" ("created_at");
  `);

  // Índices adicionais detectados em auditoria pré-Play Store (migration 0014).
  // Replicados aqui para Neon serverless aplicar mesmo sem rodar drizzle-kit push.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "community_members_community_status_idx"
      ON "community_members" ("community_id", "status");
    CREATE INDEX IF NOT EXISTS "direct_messages_recipient_created_idx"
      ON "direct_messages" ("recipient_id", "created_at" DESC);
    CREATE INDEX IF NOT EXISTS "community_post_comments_user_idx"
      ON "community_post_comments" ("user_id");
    CREATE INDEX IF NOT EXISTS "ad_impressions_expires_idx"
      ON "ad_impressions" ("expires_at");
    CREATE INDEX IF NOT EXISTS "notification_reads_notification_idx"
      ON "notification_reads" ("notification_id");
  `);

  // FK ausente em messages.replied_to_message_id (apontava para messages.id sem references).
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'messages_replied_to_message_id_fk'
          AND table_name = 'messages'
      ) THEN
        ALTER TABLE "messages"
          ADD CONSTRAINT "messages_replied_to_message_id_fk"
          FOREIGN KEY ("replied_to_message_id") REFERENCES "messages"("id")
          ON DELETE SET NULL;
      END IF;
    END $$;
  `);
}
