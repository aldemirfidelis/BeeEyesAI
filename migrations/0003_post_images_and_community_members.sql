ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "image_url" text;
