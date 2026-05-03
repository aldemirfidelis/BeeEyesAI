ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "language" varchar(10) NOT NULL DEFAULT 'pt-BR';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "testimonials" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "author_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "testimonials_profile_created_idx" ON "testimonials" ("profile_user_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "testimonials_profile_author_uidx" ON "testimonials" ("profile_user_id", "author_user_id");
