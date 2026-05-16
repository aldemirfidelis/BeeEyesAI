CREATE TABLE IF NOT EXISTS "bee_profiles" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "display_name" text DEFAULT 'Bee' NOT NULL,
  "current_state" varchar(30) DEFAULT 'idle' NOT NULL,
  "active_room_id" varchar,
  "equipped_outfit_id" varchar DEFAULT 'casual_honey' NOT NULL,
  "pollen" integer DEFAULT 250 NOT NULL,
  "premium_honey" integer DEFAULT 0 NOT NULL,
  "xp" integer DEFAULT 0 NOT NULL,
  "level" integer DEFAULT 1 NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "bee_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_profiles" ADD CONSTRAINT "bee_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_profiles_user_idx" ON "bee_profiles" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_profiles_active_room_idx" ON "bee_profiles" ("active_room_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bee_rooms" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "room_key" varchar(60) DEFAULT 'main_room' NOT NULL,
  "name" text DEFAULT 'Sala principal' NOT NULL,
  "room_kind" varchar(30) DEFAULT 'main' NOT NULL,
  "width" integer DEFAULT 8 NOT NULL,
  "height" integer DEFAULT 8 NOT NULL,
  "wallpaper_item_id" varchar DEFAULT 'honeycomb_wallpaper',
  "floor_item_id" varchar DEFAULT 'warm_wood_floor',
  "is_unlocked" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_rooms" ADD CONSTRAINT "bee_rooms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_rooms_user_idx" ON "bee_rooms" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bee_rooms_user_room_key_uidx" ON "bee_rooms" ("user_id","room_key");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bee_items" (
  "id" varchar(80) PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "item_type" varchar(30) NOT NULL,
  "rarity" varchar(30) DEFAULT 'common' NOT NULL,
  "price_pollen" integer DEFAULT 0 NOT NULL,
  "price_honey" integer DEFAULT 0 NOT NULL,
  "asset_key" text NOT NULL,
  "grid_width" integer DEFAULT 1 NOT NULL,
  "grid_height" integer DEFAULT 1 NOT NULL,
  "allowed_rooms" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "interactive" boolean DEFAULT false NOT NULL,
  "interaction_target" varchar(60),
  "active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_items_type_idx" ON "bee_items" ("item_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_items_active_idx" ON "bee_items" ("active");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bee_user_inventory" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "item_id" varchar(80) NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "source" varchar(40) DEFAULT 'starter' NOT NULL,
  "acquired_at" timestamp DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_user_inventory" ADD CONSTRAINT "bee_user_inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_user_inventory" ADD CONSTRAINT "bee_user_inventory_item_id_bee_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."bee_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_user_inventory_user_idx" ON "bee_user_inventory" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_user_inventory_item_idx" ON "bee_user_inventory" ("item_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bee_user_inventory_user_item_uidx" ON "bee_user_inventory" ("user_id","item_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bee_room_layouts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "room_id" varchar NOT NULL,
  "inventory_id" varchar,
  "item_id" varchar(80) NOT NULL,
  "grid_x" integer NOT NULL,
  "grid_y" integer NOT NULL,
  "rotation" integer DEFAULT 0 NOT NULL,
  "layer" integer DEFAULT 0 NOT NULL,
  "state" varchar(30) DEFAULT 'placed' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_room_layouts" ADD CONSTRAINT "bee_room_layouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_room_layouts" ADD CONSTRAINT "bee_room_layouts_room_id_bee_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."bee_rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_room_layouts" ADD CONSTRAINT "bee_room_layouts_inventory_id_bee_user_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."bee_user_inventory"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_room_layouts" ADD CONSTRAINT "bee_room_layouts_item_id_bee_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."bee_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_room_layouts_user_room_idx" ON "bee_room_layouts" ("user_id","room_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_room_layouts_item_idx" ON "bee_room_layouts" ("item_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bee_outfits" (
  "id" varchar(80) PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "category" varchar(30) NOT NULL,
  "rarity" varchar(30) DEFAULT 'common' NOT NULL,
  "price_pollen" integer DEFAULT 0 NOT NULL,
  "price_honey" integer DEFAULT 0 NOT NULL,
  "asset_key" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_outfits_category_idx" ON "bee_outfits" ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_outfits_active_idx" ON "bee_outfits" ("active");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bee_user_outfits" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "outfit_id" varchar(80) NOT NULL,
  "equipped" boolean DEFAULT false NOT NULL,
  "source" varchar(40) DEFAULT 'starter' NOT NULL,
  "acquired_at" timestamp DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_user_outfits" ADD CONSTRAINT "bee_user_outfits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_user_outfits" ADD CONSTRAINT "bee_user_outfits_outfit_id_bee_outfits_id_fk" FOREIGN KEY ("outfit_id") REFERENCES "public"."bee_outfits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_user_outfits_user_idx" ON "bee_user_outfits" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bee_user_outfits_user_outfit_uidx" ON "bee_user_outfits" ("user_id","outfit_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bee_currency_transactions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "currency" varchar(30) NOT NULL,
  "amount" integer NOT NULL,
  "reason" varchar(80) NOT NULL,
  "reference_type" varchar(60),
  "reference_id" varchar(120),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_currency_transactions" ADD CONSTRAINT "bee_currency_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_currency_transactions_user_created_idx" ON "bee_currency_transactions" ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_currency_transactions_reference_idx" ON "bee_currency_transactions" ("reference_type","reference_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bee_missions" (
  "id" varchar(80) PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "mission_type" varchar(40) DEFAULT 'daily' NOT NULL,
  "reward_pollen" integer DEFAULT 0 NOT NULL,
  "reward_xp" integer DEFAULT 0 NOT NULL,
  "target" integer DEFAULT 1 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_missions_active_idx" ON "bee_missions" ("active");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bee_user_missions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "mission_id" varchar(80) NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "completed" boolean DEFAULT false NOT NULL,
  "claimed_at" timestamp,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_user_missions" ADD CONSTRAINT "bee_user_missions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_user_missions" ADD CONSTRAINT "bee_user_missions_mission_id_bee_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."bee_missions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_user_missions_user_idx" ON "bee_user_missions" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bee_user_missions_user_mission_uidx" ON "bee_user_missions" ("user_id","mission_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bee_ai_tasks" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "source_message_id" varchar,
  "task_type" varchar(40) DEFAULT 'general' NOT NULL,
  "status" varchar(30) DEFAULT 'processing' NOT NULL,
  "bee_state" varchar(30) DEFAULT 'thinking' NOT NULL,
  "target_station" varchar(60) DEFAULT 'desk' NOT NULL,
  "speech_text" text,
  "progress" integer DEFAULT 0 NOT NULL,
  "prompt_snippet" text,
  "result_summary" text,
  "error_message" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_ai_tasks" ADD CONSTRAINT "bee_ai_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_ai_tasks_user_status_idx" ON "bee_ai_tasks" ("user_id","status","updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_ai_tasks_source_message_idx" ON "bee_ai_tasks" ("source_message_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bee_house_visits" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "house_owner_user_id" varchar NOT NULL,
  "visitor_user_id" varchar,
  "liked" boolean DEFAULT false NOT NULL,
  "gift_item_id" varchar(80),
  "snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_house_visits" ADD CONSTRAINT "bee_house_visits_house_owner_user_id_users_id_fk" FOREIGN KEY ("house_owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_house_visits" ADD CONSTRAINT "bee_house_visits_visitor_user_id_users_id_fk" FOREIGN KEY ("visitor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bee_house_visits" ADD CONSTRAINT "bee_house_visits_gift_item_id_bee_items_id_fk" FOREIGN KEY ("gift_item_id") REFERENCES "public"."bee_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_house_visits_owner_created_idx" ON "bee_house_visits" ("house_owner_user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bee_house_visits_visitor_idx" ON "bee_house_visits" ("visitor_user_id");
