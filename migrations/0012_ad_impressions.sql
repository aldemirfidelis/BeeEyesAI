CREATE TABLE IF NOT EXISTS "ad_impressions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "message_id" varchar,
  "anchor_message_id" varchar,
  "ad_group_id" varchar,
  "ad_id" text NOT NULL,
  "ad_mob_ad_unit_id" text,
  "ad_format" varchar(40) DEFAULT 'native' NOT NULL,
  "ad_type" varchar(40) DEFAULT 'product_ad' NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "image_url" text,
  "video_url" text,
  "media_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "product_url" text,
  "advertiser_name" text,
  "call_to_action" text,
  "price" text,
  "category" varchar(80),
  "source" varchar(40) DEFAULT 'chat' NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "added_to_wishlist" boolean DEFAULT false NOT NULL,
  "viewed_at" timestamp DEFAULT now() NOT NULL,
  "clicked_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "ad_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_impressions_user_expires_idx" ON "ad_impressions" ("user_id","expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_impressions_message_idx" ON "ad_impressions" ("message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_impressions_anchor_idx" ON "ad_impressions" ("user_id","anchor_message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_impressions_group_idx" ON "ad_impressions" ("ad_group_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ad_impressions_user_anchor_ad_uidx" ON "ad_impressions" ("user_id","anchor_message_id","ad_id");
--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "ad_group_id" varchar;
--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "ad_mob_ad_unit_id" text;
--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "ad_format" varchar(40) DEFAULT 'native' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "ad_type" varchar(40) DEFAULT 'product_ad' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "video_url" text;
--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "media_content" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "call_to_action" text;
--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD COLUMN IF NOT EXISTS "source_message_id" varchar;
--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD COLUMN IF NOT EXISTS "source_conversation_id" varchar;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_groups" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "message_id" varchar,
  "anchor_message_id" varchar,
  "title" text DEFAULT 'Anúncios que podem te interessar' NOT NULL,
  "layout_type" varchar(30) DEFAULT 'carousel' NOT NULL,
  "max_items" integer DEFAULT 3 NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ad_groups" ADD CONSTRAINT "ad_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ad_groups" ADD CONSTRAINT "ad_groups_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_groups_user_expires_idx" ON "ad_groups" ("user_id","expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_groups_message_idx" ON "ad_groups" ("message_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_group_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ad_group_id" varchar NOT NULL,
  "ad_impression_id" varchar NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ad_group_items" ADD CONSTRAINT "ad_group_items_ad_group_id_ad_groups_id_fk" FOREIGN KEY ("ad_group_id") REFERENCES "public"."ad_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ad_group_items" ADD CONSTRAINT "ad_group_items_ad_impression_id_ad_impressions_id_fk" FOREIGN KEY ("ad_impression_id") REFERENCES "public"."ad_impressions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_group_items_group_order_idx" ON "ad_group_items" ("ad_group_id","order");
