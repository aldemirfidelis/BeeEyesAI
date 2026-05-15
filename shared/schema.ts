import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  gender: text("gender"),
  bio: text("bio"),
  language: varchar("language", { length: 10 }).notNull().default("pt-BR"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  avatarUrl: text("avatar_url"),
  googleId: text("google_id").unique(),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  anonymousProfileVisitsEnabled: boolean("anonymous_profile_visits_enabled").notNull().default(false),
  allowMessagesFromStrangers: boolean("allow_messages_from_strangers").notNull().default(true),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  totalMessagesCount: integer("total_messages_count").notNull().default(0),
  personalityProfile: text("personality_profile"),
  expoPushToken: text("expo_push_token"),
  city: text("city"),
  lastDailyBriefingDate: text("last_daily_briefing_date"),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("password_reset_tokens_user_idx").on(table.userId),
  index("password_reset_tokens_hash_idx").on(table.tokenHash),
]);

export const userPersonality = pgTable("user_personality", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  traits: text("traits").notNull().default("{}"),
  communicationStyle: text("communication_style").notNull().default("friendly"),
  interests: text("interests").notNull().default("[]"),
  recentTopics: text("recent_topics").notNull().default("[]"),
  lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
}, (table) => [
  index("user_personality_user_id_idx").on(table.userId),
]);

export const userMemories = pgTable("user_memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  memoryType: varchar("memory_type", { length: 40 }).notNull().default("fact"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 40 }).notNull().default("chat"),
  importance: integer("importance").notNull().default(3),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("user_memories_user_active_idx").on(table.userId, table.active, table.importance),
  uniqueIndex("user_memories_user_content_uidx").on(table.userId, table.content),
]);

export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 60 }).notNull(),
  preference: text("preference").notNull(),
  weight: integer("weight").notNull().default(1),
  source: varchar("source", { length: 40 }).notNull().default("inferred"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("user_preferences_user_active_idx").on(table.userId, table.active, table.category),
  uniqueIndex("user_preferences_user_category_preference_uidx").on(table.userId, table.category, table.preference),
]);

export const beeConversationContexts = pgTable("bee_conversation_contexts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  contextSummary: text("context_summary").notNull().default(""),
  recentTopics: jsonb("recent_topics").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  emotionalTone: varchar("emotional_tone", { length: 40 }).notNull().default("neutral"),
  activeGoals: jsonb("active_goals").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  personalizationEnabled: boolean("personalization_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("bee_conversation_contexts_user_idx").on(table.userId),
]);

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),
  repliedToMessageId: varchar("replied_to_message_id"),
  repliedToMessageContent: text("replied_to_message_content"),
  repliedToMessageRole: text("replied_to_message_role"),
  repliedToMessageCreatedAt: timestamp("replied_to_message_created_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("messages_user_created_idx").on(table.userId, table.createdAt),
  index("messages_reply_idx").on(table.repliedToMessageId),
]);

export const adImpressions = pgTable("ad_impressions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }),
  anchorMessageId: varchar("anchor_message_id"),
  adGroupId: varchar("ad_group_id"),
  adId: text("ad_id").notNull(),
  adMobAdUnitId: text("ad_mob_ad_unit_id"),
  adFormat: varchar("ad_format", { length: 40 }).notNull().default("native"),
  adType: varchar("ad_type", { length: 40 }).notNull().default("product_ad"),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  mediaContent: jsonb("media_content").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  productUrl: text("product_url"),
  advertiserName: text("advertiser_name"),
  callToAction: text("call_to_action"),
  price: text("price"),
  category: varchar("category", { length: 80 }),
  source: varchar("source", { length: 40 }).notNull().default("chat"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  addedToWishlist: boolean("added_to_wishlist").notNull().default(false),
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
  clickedAt: timestamp("clicked_at"),
  expiresAt: timestamp("expires_at").notNull(),
  adData: jsonb("ad_data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("ad_impressions_user_expires_idx").on(table.userId, table.expiresAt),
  index("ad_impressions_message_idx").on(table.messageId),
  index("ad_impressions_anchor_idx").on(table.userId, table.anchorMessageId),
  index("ad_impressions_group_idx").on(table.adGroupId),
  uniqueIndex("ad_impressions_user_anchor_ad_uidx").on(table.userId, table.anchorMessageId, table.adId),
]);

export const adGroups = pgTable("ad_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }),
  anchorMessageId: varchar("anchor_message_id"),
  title: text("title").notNull().default("Anúncios que podem te interessar"),
  layoutType: varchar("layout_type", { length: 30 }).notNull().default("carousel"),
  maxItems: integer("max_items").notNull().default(3),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("ad_groups_user_expires_idx").on(table.userId, table.expiresAt),
  index("ad_groups_message_idx").on(table.messageId),
]);

export const adGroupItems = pgTable("ad_group_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adGroupId: varchar("ad_group_id").notNull().references(() => adGroups.id, { onDelete: "cascade" }),
  adImpressionId: varchar("ad_impression_id").notNull().references(() => adImpressions.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("ad_group_items_group_order_idx").on(table.adGroupId, table.order),
]);

export const messageFeedback = pgTable("message_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  feedbackType: text("feedback_type").notNull(), // "like" | "dislike"
  feedbackReason: text("feedback_reason"),       // free-form ou chave de motivo
  messageCategory: text("message_category"),     // inferida (saude, produtividade, ...)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("message_feedback_user_idx").on(table.userId, table.createdAt),
  uniqueIndex("message_feedback_user_message_uidx").on(table.userId, table.messageId),
]);

export const feedDrafts = pgTable("feed_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceMessageId: varchar("source_message_id").references(() => messages.id, { onDelete: "set null" }),
  title: text("title"),
  content: text("content").notNull(),
  category: text("category"),
  hashtags: text("hashtags"),               // CSV "produtividade,foco"
  privacy: text("privacy").notNull().default("public"), // "public" | "friends" | "private"
  status: text("status").notNull().default("draft"),     // "draft" | "published" | "canceled"
  publishedPostId: varchar("published_post_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("feed_drafts_user_status_idx").on(table.userId, table.status, table.createdAt),
]);

export const notificationReads = pgTable("notification_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  notificationId: text("notification_id").notNull(),
  readAt: timestamp("read_at").notNull().defaultNow(),
}, (table) => [
  index("notification_reads_user_read_idx").on(table.userId, table.readAt),
  uniqueIndex("notification_reads_user_notification_uidx").on(table.userId, table.notificationId),
]);

export const moodEntries = pgTable("mood_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mood: integer("mood").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("mood_entries_user_created_idx").on(table.userId, table.createdAt),
]);

export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
}, (table) => [
  index("achievements_user_unlocked_idx").on(table.userId, table.unlockedAt),
  uniqueIndex("achievements_user_type_uidx").on(table.userId, table.type),
]);

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  sentiment: text("sentiment"),
  sentimentLabel: text("sentiment_label"),
  aiComment: text("ai_comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("posts_user_created_idx").on(table.userId, table.createdAt),
]);

export const postLikes = pgTable("post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("post_likes_post_idx").on(table.postId),
  uniqueIndex("post_likes_post_user_uidx").on(table.postId, table.userId),
]);

export const postComments = pgTable("post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("post_comments_post_created_idx").on(table.postId, table.createdAt),
  index("post_comments_user_idx").on(table.userId),
]);

export const commentLikes = pgTable("comment_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").notNull().references(() => postComments.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("comment_likes_comment_idx").on(table.commentId),
  uniqueIndex("comment_likes_comment_user_uidx").on(table.commentId, table.userId),
]);

export const userConnections = pgTable("user_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("user_connections_user_target_idx").on(table.userId, table.targetUserId),
  index("user_connections_target_user_idx").on(table.targetUserId, table.userId),
  uniqueIndex("user_connections_user_target_uidx").on(table.userId, table.targetUserId),
]);

export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientId: varchar("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("direct_messages_sender_recipient_created_idx").on(table.senderId, table.recipientId, table.createdAt),
  index("direct_messages_recipient_read_idx").on(table.recipientId, table.readAt),
]);

export const testimonials = pgTable("testimonials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileUserId: varchar("profile_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  authorUserId: varchar("author_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("testimonials_profile_created_idx").on(table.profileUserId, table.createdAt),
  uniqueIndex("testimonials_profile_author_uidx").on(table.profileUserId, table.authorUserId),
]);

export const communities = pgTable("communities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 60 }).notNull().default("geral"),
  emoji: varchar("emoji", { length: 10 }).notNull().default("🐝"),
  imageUrl: text("image_url"),
  isPrivate: boolean("is_private").notNull().default(false),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  membersCount: integer("members_count").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("communities_owner_idx").on(table.ownerId),
  index("communities_members_count_idx").on(table.membersCount),
]);

export const communityMembers = pgTable("community_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"), // "active" | "pending"
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => [
  index("community_members_user_idx").on(table.userId),
  uniqueIndex("community_members_community_user_uidx").on(table.communityId, table.userId),
]);

export const communityPosts = pgTable("community_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("community_posts_community_created_idx").on(table.communityId, table.createdAt),
  index("community_posts_user_idx").on(table.userId),
]);

export const communityPostLikes = pgTable("community_post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("community_post_likes_post_idx").on(table.postId),
  uniqueIndex("community_post_likes_post_user_uidx").on(table.postId, table.userId),
]);

export const communityPostComments = pgTable("community_post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("community_post_comments_post_created_idx").on(table.postId, table.createdAt),
]);

export const communityPostCommentLikes = pgTable("community_post_comment_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").notNull().references(() => communityPostComments.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("community_comment_likes_comment_idx").on(table.commentId),
  uniqueIndex("community_comment_likes_comment_user_uidx").on(table.commentId, table.userId),
]);

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
}).extend({
  username: z
    .string()
    .trim()
    .min(3, "Nome de usuário deve ter ao menos 3 caracteres")
    .max(30, "Nome de usuário deve ter no máximo 30 caracteres")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Use apenas letras, números, ponto, traço e underscore"),
  password: z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .max(72, "Senha deve ter no máximo 72 caracteres")
    .regex(/[A-Za-z]/, "Senha deve conter ao menos uma letra")
    .regex(/[0-9]/, "Senha deve conter ao menos um número"),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail valido")
    .max(254, "E-mail muito longo")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertAdImpressionSchema = createInsertSchema(adImpressions).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertAdGroupSchema = createInsertSchema(adGroups).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertAdGroupItemSchema = createInsertSchema(adGroupItems).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationReadSchema = createInsertSchema(notificationReads).omit({
  id: true,
  readAt: true,
});

export const insertMoodEntrySchema = createInsertSchema(moodEntries).omit({
  id: true,
  createdAt: true,
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  unlockedAt: true,
});

export const insertUserPersonalitySchema = createInsertSchema(userPersonality).omit({
  id: true,
  lastUpdatedAt: true,
});

export const insertUserMemorySchema = createInsertSchema(userMemories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserPreferenceSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBeeConversationContextSchema = createInsertSchema(beeConversationContexts).omit({
  id: true,
  updatedAt: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
  sentiment: true,
  sentimentLabel: true,
  aiComment: true,
});

export const insertConnectionSchema = createInsertSchema(userConnections).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({
  id: true,
  readAt: true,
  createdAt: true,
});

export const insertTestimonialSchema = createInsertSchema(testimonials).omit({
  id: true,
  createdAt: true,
});

export const insertCommunitySchema = createInsertSchema(communities).omit({
  id: true,
  createdAt: true,
  membersCount: true,
});

export const insertCommunityPostSchema = createInsertSchema(communityPosts).omit({
  id: true,
  createdAt: true,
});

export const insertCommunityPostCommentSchema = createInsertSchema(communityPostComments).omit({
  id: true,
  createdAt: true,
});

export const insertPostCommentSchema = createInsertSchema(postComments).omit({
  id: true,
  createdAt: true,
});

// ── Colmeia ───────────────────────────────────────────────────────────────────

export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at"),
  allDay: boolean("all_day").notNull().default(false),
  location: text("location"),
  googleEventId: text("google_event_id"),
  color: varchar("color", { length: 20 }).default("primary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("calendar_events_user_start_idx").on(table.userId, table.startAt),
]);

export const financeTransactions = pgTable("finance_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 10 }).notNull(), // "income" | "expense"
  amountCents: integer("amount_cents").notNull(), // value in cents
  category: text("category").notNull(),
  description: text("description"),
  date: timestamp("date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("finance_transactions_user_date_idx").on(table.userId, table.date),
]);

export const userIntegrations = pgTable("user_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_integrations_user_provider_uidx").on(table.userId, table.provider),
]);

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  content: text("content").notNull(),
  color: varchar("color", { length: 20 }).default("default"),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("notes_user_created_idx").on(table.userId, table.createdAt),
]);

export const alarmReminders = pgTable("alarm_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message"),
  kind: varchar("kind", { length: 20 }).notNull().default("alarm"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  nextTriggerAt: timestamp("next_trigger_at").notNull(),
  lastTriggeredAt: timestamp("last_triggered_at"),
  repeatType: varchar("repeat_type", { length: 20 }).notNull().default("once"),
  intervalMinutes: integer("interval_minutes"),
  repeatDays: jsonb("repeat_days").$type<number[]>().notNull().default(sql`'[]'::jsonb`),
  active: boolean("active").notNull().default(true),
  localNotificationId: text("local_notification_id"),
  linkedEventId: varchar("linked_event_id").references(() => calendarEvents.id, { onDelete: "cascade" }),
  reminderOffsetMinutes: integer("reminder_offset_minutes"),
  pausedAt: timestamp("paused_at"),
  reactivationReminderAt: timestamp("reactivation_reminder_at"),
  reactivationPromptedAt: timestamp("reactivation_prompted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("alarm_reminders_user_next_idx").on(table.userId, table.nextTriggerAt),
  index("alarm_reminders_active_next_idx").on(table.active, table.nextTriggerAt),
  index("alarm_reminders_reactivation_idx").on(table.active, table.reactivationReminderAt),
  index("alarm_reminders_linked_event_idx").on(table.linkedEventId),
]);

export const wishlistItems = pgTable("wishlist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceAdId: text("source_ad_id"),
  sourceMessageId: varchar("source_message_id"),
  sourceConversationId: varchar("source_conversation_id"),
  productId: text("product_id"),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  originalUrl: text("original_url"),
  category: varchar("category", { length: 80 }).notNull().default("Outros"),
  priceCents: integer("price_cents"),
  currency: varchar("currency", { length: 10 }).notNull().default("BRL"),
  brand: text("brand"),
  storeName: text("store_name"),
  status: varchar("status", { length: 32 }).notNull().default("saved"),
  personalNote: text("personal_note"),
  interestScore: integer("interest_score").notNull().default(1),
  priority: varchar("priority", { length: 32 }).notNull().default("medium"),
  sourceType: varchar("source_type", { length: 40 }).notNull().default("manual"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  purchasedAt: timestamp("purchased_at"),
  removedAt: timestamp("removed_at"),
}, (table) => [
  index("wishlist_items_user_created_idx").on(table.userId, table.createdAt),
  index("wishlist_items_user_category_idx").on(table.userId, table.category),
  index("wishlist_items_user_status_idx").on(table.userId, table.status),
  index("wishlist_items_user_removed_idx").on(table.userId, table.removedAt),
  index("wishlist_items_source_ad_idx").on(table.userId, table.sourceAdId),
  index("wishlist_items_product_idx").on(table.userId, table.productId),
]);

export const userInterests = pgTable("user_interests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  interestName: text("interest_name").notNull(),
  category: varchar("category", { length: 80 }).notNull().default("Outros"),
  score: integer("score").notNull().default(1),
  source: varchar("source", { length: 40 }).notNull().default("wishlist"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("user_interests_user_active_idx").on(table.userId, table.active),
  uniqueIndex("user_interests_user_name_uidx").on(table.userId, table.interestName),
]);

export const wishlistEvents = pgTable("wishlist_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  wishlistItemId: varchar("wishlist_item_id").references(() => wishlistItems.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  eventMetadata: jsonb("event_metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("wishlist_events_user_created_idx").on(table.userId, table.createdAt),
  index("wishlist_events_item_idx").on(table.wishlistItemId),
]);

export const wishlistPreferences = pgTable("wishlist_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  allowPersonalizedRecommendations: boolean("allow_personalized_recommendations").notNull().default(true),
  allowPriceAlerts: boolean("allow_price_alerts").notNull().default(false),
  allowBeeNotifications: boolean("allow_bee_notifications").notNull().default(true),
  showRecommendationReasons: boolean("show_recommendation_reasons").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("wishlist_preferences_user_idx").on(table.userId),
]);

export const calendarPreferences = pgTable("calendar_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  state: varchar("state", { length: 2 }),
  notifyNationalHolidays: boolean("notify_national_holidays").notNull().default(true),
  notifyStateHolidays: boolean("notify_state_holidays").notNull().default(true),
  notifySpecialDates: boolean("notify_special_dates").notNull().default(true),
  notifyOneDayBefore: boolean("notify_one_day_before").notNull().default(true),
  notifyOnDay: boolean("notify_on_day").notNull().default(false),
  enabledCategories: text("enabled_categories").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("calendar_preferences_user_idx").on(table.userId),
]);

// ── Health / Workout ──────────────────────────────────────────────────────────

export type WorkoutDayPlan = {
  day: string; // "monday".."sunday"
  title: string;
  focus?: string;
  type: "training" | "rest";
  exercises: Array<{
    name: string;
    machine?: string;
    muscleGroup?: string;
    equipment?: string;
    sets?: number;
    reps?: string;
    durationMin?: number;
    restSeconds?: number;
    notes?: string;
    alternatives?: string[];
  }>;
};

export const healthProfiles = pgTable("health_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  healthGoal: varchar("health_goal", { length: 40 }).notNull().default("saude_geral"),
  level: varchar("level", { length: 20 }).notNull().default("iniciante"),
  trainingDays: jsonb("training_days").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  restDays: jsonb("rest_days").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  preferredWorkoutTime: varchar("preferred_workout_time", { length: 8 }),
  equipmentPreference: varchar("equipment_preference", { length: 30 }).notNull().default("misto"),
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  reminderMinutesBefore: integer("reminder_minutes_before").notNull().default(30),
  avoidExercises: jsonb("avoid_exercises").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("health_profiles_user_idx").on(table.userId),
]);

export const workoutPlans = pgTable("workout_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  goal: varchar("goal", { length: 40 }).notNull().default("saude_geral"),
  level: varchar("level", { length: 20 }).notNull().default("iniciante"),
  splitType: varchar("split_type", { length: 30 }).notNull().default("full_body"),
  trainingDays: jsonb("training_days").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  restDays: jsonb("rest_days").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  days: jsonb("days").$type<WorkoutDayPlan[]>().notNull().default(sql`'[]'::jsonb`),
  active: boolean("active").notNull().default(true),
  createdBy: varchar("created_by", { length: 20 }).notNull().default("user"), // "user" | "bee"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("workout_plans_user_active_idx").on(table.userId, table.active),
]);

export const workoutSessions = pgTable("workout_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workoutPlanId: varchar("workout_plan_id").references(() => workoutPlans.id, { onDelete: "set null" }),
  dayKey: varchar("day_key", { length: 12 }).notNull(), // "monday".."sunday"
  date: timestamp("date").notNull().defaultNow(),
  completed: boolean("completed").notNull().default(false),
  durationMinutes: integer("duration_minutes"),
  exercisesCompleted: integer("exercises_completed").notNull().default(0),
  exercisesSkipped: integer("exercises_skipped").notNull().default(0),
  effortLevel: varchar("effort_level", { length: 20 }), // "leve" | "moderado" | "intenso"
  mood: varchar("mood", { length: 20 }),
  notes: text("notes"),
  exerciseLog: jsonb("exercise_log").$type<Array<{ name: string; done: boolean; skipped?: boolean }>>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("workout_sessions_user_date_idx").on(table.userId, table.date),
  index("workout_sessions_plan_idx").on(table.workoutPlanId),
]);

export const insertHealthProfileSchema = createInsertSchema(healthProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkoutPlanSchema = createInsertSchema(workoutPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkoutSessionSchema = createInsertSchema(workoutSessions).omit({ id: true, createdAt: true });

export type HealthProfile = typeof healthProfiles.$inferSelect;
export type InsertHealthProfile = z.infer<typeof insertHealthProfileSchema>;
export type WorkoutPlan = typeof workoutPlans.$inferSelect;
export type InsertWorkoutPlan = z.infer<typeof insertWorkoutPlanSchema>;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = z.infer<typeof insertWorkoutSessionSchema>;

export const calendarNotificationLog = pgTable("calendar_notification_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull(),
  notificationType: varchar("notification_type", { length: 20 }).notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (table) => [
  index("cal_notif_log_user_idx").on(table.userId, table.sentAt),
  uniqueIndex("cal_notif_log_unique_idx").on(table.userId, table.eventId, table.notificationType),
]);

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({ id: true, createdAt: true });
export const insertFinanceTransactionSchema = createInsertSchema(financeTransactions).omit({ id: true, createdAt: true });
export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAlarmReminderSchema = createInsertSchema(alarmReminders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWishlistItemSchema = createInsertSchema(wishlistItems).omit({ id: true, createdAt: true, updatedAt: true, purchasedAt: true, removedAt: true });
export const insertUserInterestSchema = createInsertSchema(userInterests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWishlistEventSchema = createInsertSchema(wishlistEvents).omit({ id: true, createdAt: true });
export const insertWishlistPreferenceSchema = createInsertSchema(wishlistPreferences).omit({ id: true, createdAt: true, updatedAt: true });

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type FinanceTransaction = typeof financeTransactions.$inferSelect;
export type InsertFinanceTransaction = z.infer<typeof insertFinanceTransactionSchema>;
export type UserIntegration = typeof userIntegrations.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type AlarmReminder = typeof alarmReminders.$inferSelect;
export type InsertAlarmReminder = z.infer<typeof insertAlarmReminderSchema>;
export type WishlistItem = typeof wishlistItems.$inferSelect;
export type InsertWishlistItem = z.infer<typeof insertWishlistItemSchema>;
export type UserInterest = typeof userInterests.$inferSelect;
export type InsertUserInterest = z.infer<typeof insertUserInterestSchema>;
export type WishlistEvent = typeof wishlistEvents.$inferSelect;
export type InsertWishlistEvent = z.infer<typeof insertWishlistEventSchema>;
export type WishlistPreference = typeof wishlistPreferences.$inferSelect;
export type InsertWishlistPreference = z.infer<typeof insertWishlistPreferenceSchema>;
export type CalendarPreferences = typeof calendarPreferences.$inferSelect;
export type CalendarNotificationLog = typeof calendarNotificationLog.$inferSelect;

// ── Legacy types ──────────────────────────────────────────────────────────────

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserPersonality = typeof userPersonality.$inferSelect;
export type InsertUserPersonality = z.infer<typeof insertUserPersonalitySchema>;
export type UserMemory = typeof userMemories.$inferSelect;
export type InsertUserMemory = z.infer<typeof insertUserMemorySchema>;
export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = z.infer<typeof insertUserPreferenceSchema>;
export type BeeConversationContext = typeof beeConversationContexts.$inferSelect;
export type InsertBeeConversationContext = z.infer<typeof insertBeeConversationContextSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type AdImpression = typeof adImpressions.$inferSelect;
export type InsertAdImpression = z.infer<typeof insertAdImpressionSchema>;
export type AdGroup = typeof adGroups.$inferSelect;
export type InsertAdGroup = z.infer<typeof insertAdGroupSchema>;
export type AdGroupItem = typeof adGroupItems.$inferSelect;
export type InsertAdGroupItem = z.infer<typeof insertAdGroupItemSchema>;
export type MessageFeedback = typeof messageFeedback.$inferSelect;
export type FeedDraft = typeof feedDrafts.$inferSelect;
export type NotificationRead = typeof notificationReads.$inferSelect;
export type InsertNotificationRead = z.infer<typeof insertNotificationReadSchema>;
export type MoodEntry = typeof moodEntries.$inferSelect;
export type InsertMoodEntry = z.infer<typeof insertMoodEntrySchema>;
export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type UserConnection = typeof userConnections.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = z.infer<typeof insertTestimonialSchema>;
export type Community = typeof communities.$inferSelect;
export type InsertCommunity = typeof communities.$inferInsert;
export type CommunityMember = typeof communityMembers.$inferSelect;
export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityPost = typeof communityPosts.$inferInsert;
export type PostComment = typeof postComments.$inferSelect;
export type InsertPostComment = typeof postComments.$inferInsert;
export type CommentLike = typeof commentLikes.$inferSelect;
export type CommunityPostComment = typeof communityPostComments.$inferSelect;
export type InsertCommunityPostComment = typeof communityPostComments.$inferInsert;

export function xpForLevel(level: number): number {
  return level * 100 + (level - 1) * 50;
}

export const LEVEL_UNLOCKS: Record<number, string> = {};
