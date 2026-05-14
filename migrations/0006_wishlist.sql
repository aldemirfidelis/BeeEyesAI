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
