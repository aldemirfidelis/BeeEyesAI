import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
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
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  totalMessagesCount: integer("total_messages_count").notNull().default(0),
  personalityProfile: text("personality_profile"),
  expoPushToken: text("expo_push_token"),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

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

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("messages_user_created_idx").on(table.userId, table.createdAt),
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
});

export const insertMessageSchema = createInsertSchema(messages).omit({
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

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({ id: true, createdAt: true });
export const insertFinanceTransactionSchema = createInsertSchema(financeTransactions).omit({ id: true, createdAt: true });
export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true, updatedAt: true });

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type FinanceTransaction = typeof financeTransactions.$inferSelect;
export type InsertFinanceTransaction = z.infer<typeof insertFinanceTransactionSchema>;
export type UserIntegration = typeof userIntegrations.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;

// ── Legacy types ──────────────────────────────────────────────────────────────

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserPersonality = typeof userPersonality.$inferSelect;
export type InsertUserPersonality = z.infer<typeof insertUserPersonalitySchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
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

export const LEVEL_UNLOCKS: Record<number, string> = {
  2: "Conexões sociais em destaque",
  3: "Visita anônima de perfil desbloqueada",
  4: "Badge exclusiva no perfil desbloqueada",
  5: "Modo IA Avançado desbloqueado",
};
