import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  gender: text("gender"),   // "masculino" | "feminino" | "nao-binario" | "outro" | null
  googleId: text("google_id").unique(),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  totalMessagesCount: integer("total_messages_count").notNull().default(0),
  personalityProfile: text("personality_profile"),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userPersonality = pgTable("user_personality", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  traits: text("traits").notNull().default("{}"),
  communicationStyle: text("communication_style").notNull().default("friendly"),
  interests: text("interests").notNull().default("[]"),
  recentTopics: text("recent_topics").notNull().default("[]"),
  lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const missions = pgTable("missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  completed: boolean("completed").notNull().default(false),
  xpReward: integer("xp_reward").notNull().default(10),
  // "system" = predefined app-exploration mission; "user" = user-created
  type: varchar("type", { length: 50 }).notNull().default("user"),
  // key that routes use to auto-complete this mission
  actionType: varchar("action_type", { length: 100 }),
  // visual grouping: 1 = Boas-vindas, 2 = Social, 3 = Conectado, 4 = Criador
  tier: integer("tier").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const moodEntries = pgTable("mood_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  mood: integer("mood").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
});

// ── Social Features ───────────────────────────────────────────────────────────

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  sentiment: text("sentiment"),          // "happy" | "motivated" | "tired" | "sad" | "neutral"
  sentimentLabel: text("sentiment_label"), // label legível em pt-BR
  aiComment: text("ai_comment"),         // comentário automático da BeeEyes
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const postLikes = pgTable("post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const postComments = pgTable("post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const commentLikes = pgTable("comment_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userConnections = pgTable("user_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  targetUserId: varchar("target_user_id").notNull(),
  status: text("status").notNull().default("pending"), // "pending" | "accepted"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull(),
  recipientId: varchar("recipient_id").notNull(),
  content: text("content").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communities = pgTable("communities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 60 }).notNull().default("geral"),
  emoji: varchar("emoji", { length: 10 }).notNull().default("🐝"),
  ownerId: varchar("owner_id").notNull(),
  membersCount: integer("members_count").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communityMembers = pgTable("community_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("member"), // "owner" | "member"
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const communityPosts = pgTable("community_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communityPostLikes = pgTable("community_post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communityPostComments = pgTable("community_post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communityPostCommentLikes = pgTable("community_post_comment_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertMissionSchema = createInsertSchema(missions).omit({
  id: true,
  completed: true,
  createdAt: true,
  completedAt: true,
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

export const insertCommunitySchema = createInsertSchema(communities).omit({ id: true, createdAt: true, membersCount: true });
export const insertCommunityPostSchema = createInsertSchema(communityPosts).omit({ id: true, createdAt: true });
export const insertCommunityPostCommentSchema = createInsertSchema(communityPostComments).omit({ id: true, createdAt: true });
export const insertPostCommentSchema = createInsertSchema(postComments).omit({ id: true, createdAt: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserPersonality = typeof userPersonality.$inferSelect;
export type InsertUserPersonality = z.infer<typeof insertUserPersonalitySchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Mission = typeof missions.$inferSelect;
export type InsertMission = z.infer<typeof insertMissionSchema>;
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

// Level calculation helper
export function xpForLevel(level: number): number {
  return level * 100 + (level - 1) * 50;
}

// Predefined app-exploration missions (seeded per user on first access)
export const PREDEFINED_MISSIONS: Array<{
  actionType: string;
  title: string;
  description: string;
  xpReward: number;
  tier: number;
}> = [
  // Tier 1 — Boas-vindas
  { actionType: "send_message",     title: "Diga olá para a Bee",         description: "Envie sua primeira mensagem no chat",                xpReward: 10, tier: 1 },
  { actionType: "set_mood",         title: "Como você está hoje?",         description: "Registre seu humor pela primeira vez",               xpReward: 15, tier: 1 },
  { actionType: "like_post",        title: "Mostre carinho",               description: "Curta uma publicação no feed",                       xpReward: 15, tier: 1 },
  // Tier 2 — Social
  { actionType: "create_post",      title: "Compartilhe algo",             description: "Faça sua primeira publicação no feed",               xpReward: 20, tier: 2 },
  { actionType: "add_friend",       title: "Faça uma conexão",             description: "Envie um pedido de amizade para alguém",             xpReward: 20, tier: 2 },
  { actionType: "accept_friend",    title: "Aceite um amigo",              description: "Aceite um pedido de conexão",                        xpReward: 20, tier: 2 },
  // Tier 3 — Conectado
  { actionType: "comment_post",     title: "Participe da conversa",        description: "Comente em uma publicação do feed",                  xpReward: 25, tier: 3 },
  { actionType: "send_dm",          title: "Conversa privada",             description: "Mande uma mensagem direta para um amigo",            xpReward: 40, tier: 3 },
  { actionType: "join_community",   title: "Entre em uma comunidade",      description: "Participe de uma comunidade",                        xpReward: 40, tier: 3 },
  // Tier 4 — Criador
  { actionType: "post_in_community",title: "Voz na comunidade",            description: "Publique algo em uma comunidade que você participa", xpReward: 30, tier: 4 },
  { actionType: "create_community", title: "Funde sua comunidade",         description: "Crie sua própria comunidade",                        xpReward: 50, tier: 4 },
];

// Features unlocked at each level
export const LEVEL_UNLOCKS: Record<number, string> = {
  2: "Mensagens Diretas (DM) desbloqueadas 📨",
  3: "Visita anônima de perfil desbloqueada 👻",
  4: "Badge exclusiva no perfil desbloqueada 🏅",
  5: "Modo IA Avançado desbloqueado 🤖",
};
