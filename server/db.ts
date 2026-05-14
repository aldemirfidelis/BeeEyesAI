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
}
