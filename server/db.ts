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
}
