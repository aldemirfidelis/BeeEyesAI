ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "allow_messages_from_strangers" boolean NOT NULL DEFAULT true;
