import { eq, desc, and, gte, sql, ne, notInArray, inArray, ilike, or, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  users, userPersonality, userMemories, userPreferences, beeConversationContexts, messages, messageFeedback, feedDrafts,
  notificationReads, moodEntries, achievements, testimonials,
  posts, postLikes, userConnections, directMessages,
  communities, communityMembers, communityPosts,
  communityPostLikes, communityPostComments, communityPostCommentLikes,
  postComments, commentLikes,
  type User, type InsertUser,
  type UserPersonality, type InsertUserPersonality,
  type UserMemory, type InsertUserMemory,
  type UserPreference, type InsertUserPreference,
  type BeeConversationContext,
  type Message, type InsertMessage,
  type MessageFeedback, type FeedDraft,
  type NotificationRead, type InsertNotificationRead,
  type MoodEntry, type InsertMoodEntry,
  type Achievement, type InsertAchievement,
  type Post, type InsertPost,
  type UserConnection, type InsertConnection,
  type Testimonial, type InsertTestimonial,
  type DirectMessage, type InsertDirectMessage,
  type Community, type InsertCommunity,
  type CommunityPost, type InsertCommunityPost,
  type CommunityPostComment, type InsertCommunityPostComment,
  type PostComment, type InsertPostComment,
  xpForLevel,
} from "../shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser & { googleId?: string; displayName?: string; gender?: string; avatarUrl?: string | null }): Promise<User>;
  updateUserPreferences(userId: string, preferences: { anonymousProfileVisitsEnabled?: boolean; allowMessagesFromStrangers?: boolean; displayName?: string | null; bio?: string | null; language?: string; onboardingCompleted?: boolean; city?: string | null }): Promise<User>;
  updateLastDailyBriefingDate(userId: string, date: string): Promise<void>;
  updateUserAvatar(userId: string, avatarUrl: string | null): Promise<void>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  updateUserPushToken(userId: string, token: string | null): Promise<void>;
  updateLastActive(userId: string): Promise<void>;
  updateUserXP(userId: string, xpToAdd: number): Promise<User>;
  updateUserStreak(userId: string): Promise<User>;
  incrementMessageCount(userId: string): Promise<void>;
  getAllUsersExcept(userId: string): Promise<User[]>;

  // Personality
  getPersonality(userId: string): Promise<UserPersonality | undefined>;
  upsertPersonality(data: InsertUserPersonality): Promise<UserPersonality>;
  getActiveUserMemories(userId: string, limit?: number): Promise<UserMemory[]>;
  upsertUserMemory(data: InsertUserMemory): Promise<UserMemory>;
  setUserMemoryActive(userId: string, memoryId: string, active: boolean): Promise<UserMemory | undefined>;
  deleteUserMemory(userId: string, memoryId: string): Promise<boolean>;
  getUserPreferences(userId: string, activeOnly?: boolean): Promise<UserPreference[]>;
  upsertUserPreference(data: InsertUserPreference): Promise<UserPreference>;
  deleteUserPreference(userId: string, preferenceId: string): Promise<boolean>;
  getBeeConversationContext(userId: string): Promise<BeeConversationContext | undefined>;
  upsertBeeConversationContext(data: BeeConversationContextInput): Promise<BeeConversationContext>;

  // Messages
  getMessagesByUser(userId: string, limit?: number): Promise<Message[]>;
  createMessage(msg: InsertMessage): Promise<Message>;
  updateMessageMetadata(id: string, userId: string, data: { content: string; metadata: string }): Promise<Message | undefined>;
  getNotificationReadsByUser(userId: string): Promise<NotificationRead[]>;
  markNotificationsAsRead(data: InsertNotificationRead[]): Promise<void>;
  getRecentAssistantMessages(userId: string, sinceMinutes: number): Promise<Message[]>;

  // Mood
  getMoodEntriesByUser(userId: string, days?: number): Promise<MoodEntry[]>;
  createMoodEntry(entry: InsertMoodEntry): Promise<MoodEntry>;

  // Achievements
  getAchievementsByUser(userId: string): Promise<Achievement[]>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  hasAchievement(userId: string, type: string): Promise<boolean>;
  ensureAchievement(userId: string, achievement: Omit<InsertAchievement, "userId">): Promise<Achievement | null>;

  // Posts
  createPost(post: InsertPost & { sentiment?: string; sentimentLabel?: string; aiComment?: string }): Promise<Post>;
  getPostsByUser(userId: string, limit?: number): Promise<Post[]>;
  getPostById(id: string): Promise<Post | undefined>;
  updatePostAIComment(postId: string, aiComment: string, sentiment: string, sentimentLabel: string): Promise<void>;
  updatePost(postId: string, userId: string, content: string): Promise<Post | null>;
  deletePost(postId: string, userId: string): Promise<boolean>;
  getFeedForUser(userId: string, limit?: number, before?: Date): Promise<(Post & { author: Pick<User, "id" | "username" | "displayName" | "level" | "avatarUrl"> })[]>;
  getForYouFeed(userId: string, limit?: number, before?: Date): Promise<(Post & { author: Pick<User, "id" | "username" | "displayName" | "level" | "avatarUrl"> })[]>;
  likePost(postId: string, userId: string): Promise<void>;
  unlikePost(postId: string, userId: string): Promise<void>;
  hasLikedPost(postId: string, userId: string): Promise<boolean>;
  getPostLikesCount(postId: string): Promise<number>;
  getPostEnrichmentBatch(postIds: string[], userId: string): Promise<{ likeCounts: Map<string, number>; likedSet: Set<string>; commentCounts: Map<string, number> }>;

  // Connections
  getConnectionStatus(userId: string, targetUserId: string): Promise<UserConnection | undefined>;
  createConnection(data: InsertConnection): Promise<UserConnection>;
  acceptConnection(id: string, userId: string): Promise<UserConnection | undefined>;
  rejectConnection(id: string, userId: string): Promise<boolean>;
  cancelConnectionRequest(userId: string, targetUserId: string): Promise<boolean>;
  removeConnection(userId: string, targetUserId: string): Promise<boolean>;
  getConnectionsByUser(userId: string): Promise<UserConnection[]>;
  getIncomingPendingConnections(userId: string): Promise<{ connectionId: string; user: { id: string; username: string; displayName: string | null; level: number; avatarUrl: string | null } }[]>;
  getSentPendingConnections(userId: string): Promise<{ connectionId: string; user: { id: string; username: string; displayName: string | null; level: number; avatarUrl: string | null } }[]>;
  getAcceptedConnectionIds(userId: string): Promise<string[]>;
  getSuggestedConnections(userId: string, limit?: number): Promise<(User & { personality?: UserPersonality | null; commonInterests: string[] })[]>;

  // Friends
  getFriends(userId: string): Promise<(Omit<User, "password"> & { personality: UserPersonality | null })[]>;
  searchUsers(query: string, requesterId: string): Promise<(Omit<User, "password"> & { connectionStatus: "none" | "pending" | "accepted" })[]>;
  getUserPublicProfile(userId: string): Promise<{
    user: Omit<User, "password">;
    recentPosts: Post[];
    interests: string[];
  } | null>;

  // Direct messages
  sendDirectMessage(data: InsertDirectMessage): Promise<DirectMessage>;
  getDirectMessagesBetweenUsers(userId: string, otherUserId: string, limit?: number): Promise<DirectMessage[]>;
  markDirectMessagesAsRead(userId: string, fromUserId: string): Promise<void>;
  deleteConversation(userId: string, otherUserId: string): Promise<void>;
  getDirectConversations(userId: string): Promise<Array<{
    user: Pick<User, "id" | "username" | "displayName" | "level" | "avatarUrl">;
    lastMessage: string;
    lastMessageAt: Date;
    lastMessageFromMe: boolean;
    unreadCount: number;
  }>>;

  // Testimonials
  getTestimonialsForProfile(profileUserId: string): Promise<(Testimonial & { authorUsername: string; authorDisplayName: string | null; authorAvatarUrl: string | null })[]>;
  upsertTestimonial(data: InsertTestimonial): Promise<Testimonial>;

  // Comments
  getCommentsForPost(postId: string, userId: string): Promise<(PostComment & { username: string; displayName: string | null; avatarUrl: string | null; likesCount: number; liked: boolean })[]>;
  createPostComment(data: InsertPostComment): Promise<PostComment>;
  getCommentCount(postId: string): Promise<number>;
  toggleCommentLike(commentId: string, userId: string): Promise<{ liked: boolean; likesCount: number }>;

  // Communities
  getCommunities(userId: string, search?: string): Promise<(Community & { isMember: boolean })[]>;
  createCommunity(data: InsertCommunity): Promise<Community>;
  deleteCommunity(communityId: string): Promise<void>;
  updateCommunity(id: string, ownerId: string, data: { name?: string; description?: string | null; imageUrl?: string | null }): Promise<Community | null>;
  getCommunityById(id: string, userId: string): Promise<(Community & { isMember: boolean; memberRole?: string; memberStatus?: string }) | null>;
  getCommunityMembers(communityId: string): Promise<{ id: string; username: string; displayName: string | null; avatarUrl: string | null; role: string; joinedAt: Date }[]>;
  getCommunityMemberPushTokens(communityId: string, excludeUserId: string): Promise<string[]>;
  joinCommunity(communityId: string, userId: string): Promise<"joined" | "pending">;
  leaveCommunity(communityId: string, userId: string): Promise<void>;
  getPendingJoinRequests(communityId: string): Promise<{ id: string; username: string; displayName: string | null; avatarUrl: string | null; requestedAt: Date }[]>;
  approveJoinRequest(communityId: string, userId: string, ownerId: string): Promise<boolean>;
  rejectJoinRequest(communityId: string, userId: string, ownerId: string): Promise<boolean>;
  getCommunityPosts(communityId: string, userId: string, limit?: number, offset?: number): Promise<(CommunityPost & { username: string; displayName: string | null; avatarUrl: string | null; likesCount: number; liked: boolean; commentsCount: number })[]>;
  createCommunityPost(data: InsertCommunityPost): Promise<CommunityPost>;
  deleteCommunityPost(postId: string, userId: string): Promise<boolean>;
  getUserCommunities(userId: string): Promise<Community[]>;
  toggleCommunityPostLike(postId: string, userId: string): Promise<{ liked: boolean; likesCount: number }>;
  getCommunityPostComments(postId: string, userId: string): Promise<(CommunityPostComment & { username: string; displayName: string | null; avatarUrl: string | null; likesCount: number; liked: boolean })[]>;
  createCommunityPostComment(data: InsertCommunityPostComment): Promise<CommunityPostComment>;
  toggleCommunityCommentLike(commentId: string, userId: string): Promise<{ liked: boolean; likesCount: number }>;

  // Message feedback (Curtir / Não curti em mensagens da Bee)
  upsertMessageFeedback(data: { userId: string; messageId: string; feedbackType: "like" | "dislike"; feedbackReason?: string | null; messageCategory?: string | null }): Promise<MessageFeedback>;
  deleteMessageFeedback(userId: string, messageId: string): Promise<boolean>;
  getMessageFeedbackByIds(userId: string, messageIds: string[]): Promise<MessageFeedback[]>;
  getMessageFeedbackSummary(userId: string): Promise<{ category: string; likes: number; dislikes: number }[]>;

  // Feed drafts ("Enviar para o Feed")
  createFeedDraft(data: { userId: string; sourceMessageId?: string | null; title?: string | null; content: string; category?: string | null; hashtags?: string | null; privacy?: string }): Promise<FeedDraft>;
  getFeedDraft(id: string, userId: string): Promise<FeedDraft | undefined>;
  markFeedDraftPublished(id: string, userId: string, publishedPostId: string): Promise<FeedDraft | undefined>;
  cancelFeedDraft(id: string, userId: string): Promise<boolean>;
}

const lastActiveCache = new Map<string, number>();

type BeeConversationContextInput = {
  userId: string;
  contextSummary?: string;
  recentTopics?: string[];
  emotionalTone?: string;
  activeGoals?: string[];
  personalizationEnabled?: boolean;
};

export class DrizzleStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async createUser(insertUser: InsertUser & { googleId?: string; displayName?: string; gender?: string; avatarUrl?: string | null }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    await db.insert(userPersonality).values({ userId: user.id });
    return user;
  }

  async updateUserPreferences(userId: string, preferences: { anonymousProfileVisitsEnabled?: boolean; allowMessagesFromStrangers?: boolean; displayName?: string | null; bio?: string | null; language?: string; onboardingCompleted?: boolean; city?: string | null }): Promise<User> {
    const updates: Partial<typeof users.$inferInsert> = {};
    if (preferences.anonymousProfileVisitsEnabled !== undefined) {
      updates.anonymousProfileVisitsEnabled = preferences.anonymousProfileVisitsEnabled;
    }
    if (preferences.allowMessagesFromStrangers !== undefined) {
      updates.allowMessagesFromStrangers = preferences.allowMessagesFromStrangers;
    }
    if (preferences.displayName !== undefined) updates.displayName = preferences.displayName;
    if (preferences.bio !== undefined) updates.bio = preferences.bio;
    if (preferences.language !== undefined) updates.language = preferences.language;
    if (preferences.onboardingCompleted !== undefined) updates.onboardingCompleted = preferences.onboardingCompleted;
    if (preferences.city !== undefined) updates.city = preferences.city;

    if (Object.keys(updates).length === 0) {
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error("User not found");
      }
      return user;
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw new Error("User not found");
    }

    return updated;
  }

  async updateLastDailyBriefingDate(userId: string, date: string): Promise<void> {
    await db.update(users).set({ lastDailyBriefingDate: date }).where(eq(users.id, userId));
  }

  async updateUserAvatar(userId: string, avatarUrl: string | null): Promise<void> {
    await db.update(users).set({ avatarUrl }).where(eq(users.id, userId));
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ password: passwordHash }).where(eq(users.id, userId));
  }

  async updateUserPushToken(userId: string, token: string | null): Promise<void> {
    await db.update(users).set({ expoPushToken: token }).where(eq(users.id, userId));
  }

  async updateLastActive(userId: string): Promise<void> {
    const now = Date.now();
    const lastUpdate = lastActiveCache.get(userId) || 0;
    if (now - lastUpdate > 2 * 60 * 1000) { // update at most every 2 minutes
      lastActiveCache.set(userId, now);
      await db.update(users).set({ lastActiveAt: new Date(now) }).where(eq(users.id, userId)).execute().catch(() => {});
    }
  }

  async getAllUsersExcept(userId: string): Promise<User[]> {
    return db.select().from(users).where(ne(users.id, userId));
  }

  async updateUserXP(userId: string, xpToAdd: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    let newXP = user.xp + xpToAdd;
    let newLevel = user.level;

    while (newXP >= xpForLevel(newLevel)) {
      newXP -= xpForLevel(newLevel);
      newLevel++;
    }

    const [updated] = await db
      .update(users)
      .set({ xp: newXP, level: newLevel })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserStreak(userId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const now = new Date();
    const lastActive = user.lastActiveAt;
    let newStreak = user.currentStreak;

    if (lastActive) {
      const hoursSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
      if (hoursSinceActive < 24) {
        // Same day, keep streak
      } else if (hoursSinceActive < 48) {
        newStreak = user.currentStreak + 1;
      } else {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    const newLongest = Math.max(newStreak, user.longestStreak);
    const [updated] = await db
      .update(users)
      .set({ currentStreak: newStreak, longestStreak: newLongest, lastActiveAt: now })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async incrementMessageCount(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ totalMessagesCount: sql`${users.totalMessagesCount} + 1` })
      .where(eq(users.id, userId));
  }

  async getPersonality(userId: string): Promise<UserPersonality | undefined> {
    const [personality] = await db
      .select()
      .from(userPersonality)
      .where(eq(userPersonality.userId, userId));
    return personality;
  }

  async upsertPersonality(data: InsertUserPersonality): Promise<UserPersonality> {
    const existing = await this.getPersonality(data.userId);
    if (existing) {
      const [updated] = await db
        .update(userPersonality)
        .set({ ...data, lastUpdatedAt: new Date() })
        .where(eq(userPersonality.userId, data.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(userPersonality).values(data).returning();
    return created;
  }

  async getActiveUserMemories(userId: string, limit = 20): Promise<UserMemory[]> {
    return db
      .select()
      .from(userMemories)
      .where(and(eq(userMemories.userId, userId), eq(userMemories.active, true)))
      .orderBy(desc(userMemories.importance), desc(userMemories.updatedAt))
      .limit(limit);
  }

  async upsertUserMemory(data: InsertUserMemory): Promise<UserMemory> {
    const [memory] = await db
      .insert(userMemories)
      .values(data)
      .onConflictDoUpdate({
        target: [userMemories.userId, userMemories.content],
        set: {
          memoryType: data.memoryType,
          title: data.title,
          source: data.source,
          importance: data.importance,
          active: data.active ?? true,
          updatedAt: new Date(),
        },
      })
      .returning();
    return memory;
  }

  async setUserMemoryActive(userId: string, memoryId: string, active: boolean): Promise<UserMemory | undefined> {
    const [updated] = await db
      .update(userMemories)
      .set({ active, updatedAt: new Date() })
      .where(and(eq(userMemories.id, memoryId), eq(userMemories.userId, userId)))
      .returning();
    return updated;
  }

  async deleteUserMemory(userId: string, memoryId: string): Promise<boolean> {
    const deleted = await db
      .delete(userMemories)
      .where(and(eq(userMemories.id, memoryId), eq(userMemories.userId, userId)))
      .returning({ id: userMemories.id });
    return deleted.length > 0;
  }

  async getUserPreferences(userId: string, activeOnly = true): Promise<UserPreference[]> {
    const filters = activeOnly
      ? and(eq(userPreferences.userId, userId), eq(userPreferences.active, true))
      : eq(userPreferences.userId, userId);
    return db
      .select()
      .from(userPreferences)
      .where(filters)
      .orderBy(desc(userPreferences.weight), desc(userPreferences.updatedAt));
  }

  async upsertUserPreference(data: InsertUserPreference): Promise<UserPreference> {
    const [preference] = await db
      .insert(userPreferences)
      .values(data)
      .onConflictDoUpdate({
        target: [userPreferences.userId, userPreferences.category, userPreferences.preference],
        set: {
          weight: data.weight,
          source: data.source,
          active: data.active ?? true,
          updatedAt: new Date(),
        },
      })
      .returning();
    return preference;
  }

  async deleteUserPreference(userId: string, preferenceId: string): Promise<boolean> {
    const deleted = await db
      .delete(userPreferences)
      .where(and(eq(userPreferences.id, preferenceId), eq(userPreferences.userId, userId)))
      .returning({ id: userPreferences.id });
    return deleted.length > 0;
  }

  async getBeeConversationContext(userId: string): Promise<BeeConversationContext | undefined> {
    const [context] = await db
      .select()
      .from(beeConversationContexts)
      .where(eq(beeConversationContexts.userId, userId));
    return context;
  }

  async upsertBeeConversationContext(data: BeeConversationContextInput): Promise<BeeConversationContext> {
    const [context] = await db
      .insert(beeConversationContexts)
      .values(data)
      .onConflictDoUpdate({
        target: beeConversationContexts.userId,
        set: {
          contextSummary: data.contextSummary ?? "",
          recentTopics: data.recentTopics ?? [],
          emotionalTone: data.emotionalTone ?? "neutral",
          activeGoals: data.activeGoals ?? [],
          personalizationEnabled: data.personalizationEnabled ?? true,
          updatedAt: new Date(),
        },
      })
      .returning();
    return context;
  }

  async getMessagesByUser(userId: string, limit = 50): Promise<Message[]> {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.userId, userId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    return rows.reverse();
  }

  async createMessage(msg: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(msg).returning();
    return message;
  }

  async updateMessageMetadata(id: string, userId: string, data: { content: string; metadata: string }): Promise<Message | undefined> {
    const [updated] = await db
      .update(messages)
      .set({ content: data.content, metadata: data.metadata })
      .where(and(eq(messages.id, id), eq(messages.userId, userId)))
      .returning();
    return updated;
  }

  async getNotificationReadsByUser(userId: string): Promise<NotificationRead[]> {
    return db
      .select()
      .from(notificationReads)
      .where(eq(notificationReads.userId, userId))
      .orderBy(desc(notificationReads.readAt));
  }

  async markNotificationsAsRead(data: InsertNotificationRead[]): Promise<void> {
    if (data.length === 0) return;

    await db
      .insert(notificationReads)
      .values(data)
      .onConflictDoNothing({
        target: [notificationReads.userId, notificationReads.notificationId],
      });
  }

  async getRecentAssistantMessages(userId: string, sinceMinutes: number): Promise<Message[]> {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    return db
      .select()
      .from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.role, "assistant"), gte(messages.createdAt, since)))
      .orderBy(desc(messages.createdAt))
      .limit(30);
  }

  async getMoodEntriesByUser(userId: string, days = 30): Promise<MoodEntry[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return db
      .select()
      .from(moodEntries)
      .where(and(eq(moodEntries.userId, userId), gte(moodEntries.createdAt, since)))
      .orderBy(desc(moodEntries.createdAt));
  }

  async createMoodEntry(entry: InsertMoodEntry): Promise<MoodEntry> {
    const [created] = await db.insert(moodEntries).values(entry).returning();
    return created;
  }

  async getAchievementsByUser(userId: string): Promise<Achievement[]> {
    return db
      .select()
      .from(achievements)
      .where(eq(achievements.userId, userId))
      .orderBy(desc(achievements.unlockedAt));
  }

  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const [created] = await db.insert(achievements).values(achievement).returning();
    return created;
  }

  async hasAchievement(userId: string, type: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(achievements)
      .where(and(eq(achievements.userId, userId), eq(achievements.type, type)));
    return !!existing;
  }

  async ensureAchievement(userId: string, achievement: Omit<InsertAchievement, "userId">): Promise<Achievement | null> {
    if (await this.hasAchievement(userId, achievement.type)) return null;
    return this.createAchievement({ userId, ...achievement });
  }

  // ── Posts ─────────────────────────────────────────────────────────────────

  async createPost(post: InsertPost & { sentiment?: string; sentimentLabel?: string; aiComment?: string }): Promise<Post> {
    const [created] = await db.insert(posts).values(post).returning();
    return created;
  }

  async getPostsByUser(userId: string, limit = 20): Promise<Post[]> {
    return db
      .select()
      .from(posts)
      .where(eq(posts.userId, userId))
      .orderBy(desc(posts.createdAt))
      .limit(limit);
  }

  async getPostById(id: string): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post;
  }

  async updatePostAIComment(postId: string, aiComment: string, sentiment: string, sentimentLabel: string): Promise<void> {
    await db
      .update(posts)
      .set({ aiComment, sentiment, sentimentLabel })
      .where(eq(posts.id, postId));
  }

  async updatePost(postId: string, userId: string, content: string): Promise<Post | null> {
    const [updated] = await db
      .update(posts)
      .set({ content })
      .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async deletePost(postId: string, userId: string): Promise<boolean> {
    const [deleted] = await db
      .delete(posts)
      .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
      .returning({ id: posts.id });
    return !!deleted;
  }

  async getFeedForUser(userId: string, limit = 30, before?: Date): Promise<(Post & { author: Pick<User, "id" | "username" | "displayName" | "level" | "avatarUrl"> })[]> {
    const connectedIds = await this.getAcceptedConnectionIds(userId);
    const feedUserIds = [userId, ...connectedIds];

    const whereClause = before
      ? and(inArray(posts.userId, feedUserIds), sql`${posts.createdAt} < ${before}`)
      : inArray(posts.userId, feedUserIds);

    const rows = await db
      .select({
        id: posts.id,
        userId: posts.userId,
        content: posts.content,
        imageUrl: posts.imageUrl,
        sentiment: posts.sentiment,
        sentimentLabel: posts.sentimentLabel,
        aiComment: posts.aiComment,
        createdAt: posts.createdAt,
        authorId: users.id,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
        authorLevel: users.level,
        authorAvatarUrl: users.avatarUrl,
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .where(whereClause)
      .orderBy(desc(posts.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      content: r.content,
      imageUrl: r.imageUrl,
      sentiment: r.sentiment,
      sentimentLabel: r.sentimentLabel,
      aiComment: r.aiComment,
      createdAt: r.createdAt,
      author: {
        id: r.authorId,
        username: r.authorUsername,
        displayName: r.authorDisplayName,
        level: r.authorLevel,
        avatarUrl: r.authorAvatarUrl,
      },
    }));
  }

  async getForYouFeed(userId: string, limit = 30, before?: Date): Promise<(Post & { author: Pick<User, "id" | "username" | "displayName" | "level" | "avatarUrl"> })[]> {
    const query = db
      .select({
        id: posts.id,
        userId: posts.userId,
        content: posts.content,
        imageUrl: posts.imageUrl,
        sentiment: posts.sentiment,
        sentimentLabel: posts.sentimentLabel,
        aiComment: posts.aiComment,
        createdAt: posts.createdAt,
        authorId: users.id,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
        authorLevel: users.level,
        authorAvatarUrl: users.avatarUrl,
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id));

    const rows = await (before
      ? query.where(sql`${posts.createdAt} < ${before}`)
      : query
    )
      .orderBy(desc(posts.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      content: r.content,
      imageUrl: r.imageUrl,
      sentiment: r.sentiment,
      sentimentLabel: r.sentimentLabel,
      aiComment: r.aiComment,
      createdAt: r.createdAt,
      author: {
        id: r.authorId,
        username: r.authorUsername,
        displayName: r.authorDisplayName,
        level: r.authorLevel,
        avatarUrl: r.authorAvatarUrl,
      },
    }));
  }

  async likePost(postId: string, userId: string): Promise<void> {
    const already = await this.hasLikedPost(postId, userId);
    if (!already) {
      await db.insert(postLikes).values({ postId, userId });
    }
  }

  async unlikePost(postId: string, userId: string): Promise<void> {
    await db.delete(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));
  }

  async hasLikedPost(postId: string, userId: string): Promise<boolean> {
    const [row] = await db
      .select()
      .from(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));
    return !!row;
  }

  async getPostLikesCount(postId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(postLikes)
      .where(eq(postLikes.postId, postId));
    return Number(result[0]?.count ?? 0);
  }

  // ── Connections ───────────────────────────────────────────────────────────

  async getConnectionStatus(userId: string, targetUserId: string): Promise<UserConnection | undefined> {
    const [row] = await db
      .select()
      .from(userConnections)
      .where(
        or(
          and(eq(userConnections.userId, userId), eq(userConnections.targetUserId, targetUserId)),
          and(eq(userConnections.userId, targetUserId), eq(userConnections.targetUserId, userId))
        )
      );
    return row;
  }

  async createConnection(data: InsertConnection): Promise<UserConnection> {
    const [created] = await db.insert(userConnections).values(data).returning();
    return created;
  }

  async acceptConnection(id: string, userId: string): Promise<UserConnection | undefined> {
    const [updated] = await db
      .update(userConnections)
      .set({ status: "accepted" })
      .where(and(eq(userConnections.id, id), eq(userConnections.targetUserId, userId)))
      .returning();
    return updated;
  }

  async rejectConnection(id: string, userId: string): Promise<boolean> {
    const deleted = await db
      .delete(userConnections)
      .where(and(eq(userConnections.id, id), eq(userConnections.targetUserId, userId), eq(userConnections.status, "pending")))
      .returning({ id: userConnections.id });
    return deleted.length > 0;
  }

  async getIncomingPendingConnections(userId: string): Promise<{ connectionId: string; user: { id: string; username: string; displayName: string | null; level: number; avatarUrl: string | null } }[]> {
    const rows = await db
      .select({
        connectionId: userConnections.id,
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        level: users.level,
        avatarUrl: users.avatarUrl,
      })
      .from(userConnections)
      .innerJoin(users, eq(userConnections.userId, users.id))
      .where(and(eq(userConnections.targetUserId, userId), eq(userConnections.status, "pending")))
      .orderBy(desc(userConnections.createdAt));
    return rows.map((r) => ({ connectionId: r.connectionId, user: { id: r.id, username: r.username, displayName: r.displayName, level: r.level, avatarUrl: r.avatarUrl } }));
  }

  async getSentPendingConnections(userId: string): Promise<{ connectionId: string; user: { id: string; username: string; displayName: string | null; level: number; avatarUrl: string | null } }[]> {
    const rows = await db
      .select({
        connectionId: userConnections.id,
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        level: users.level,
        avatarUrl: users.avatarUrl,
      })
      .from(userConnections)
      .innerJoin(users, eq(userConnections.targetUserId, users.id))
      .where(and(eq(userConnections.userId, userId), eq(userConnections.status, "pending")))
      .orderBy(desc(userConnections.createdAt));
    return rows.map((r) => ({ connectionId: r.connectionId, user: { id: r.id, username: r.username, displayName: r.displayName, level: r.level, avatarUrl: r.avatarUrl } }));
  }

  async cancelConnectionRequest(userId: string, targetUserId: string): Promise<boolean> {
    const deleted = await db
      .delete(userConnections)
      .where(and(eq(userConnections.userId, userId), eq(userConnections.targetUserId, targetUserId), eq(userConnections.status, "pending")))
      .returning({ id: userConnections.id });
    return deleted.length > 0;
  }

  async removeConnection(userId: string, targetUserId: string): Promise<boolean> {
    const deleted = await db
      .delete(userConnections)
      .where(
        and(
          eq(userConnections.status, "accepted"),
          or(
            and(eq(userConnections.userId, userId), eq(userConnections.targetUserId, targetUserId)),
            and(eq(userConnections.userId, targetUserId), eq(userConnections.targetUserId, userId)),
          )
        )
      )
      .returning({ id: userConnections.id });
    return deleted.length > 0;
  }

  async getConnectionsByUser(userId: string): Promise<UserConnection[]> {
    return db
      .select()
      .from(userConnections)
      .where(
        and(
          eq(userConnections.targetUserId, userId),
          eq(userConnections.status, "pending")
        )
      )
      .orderBy(desc(userConnections.createdAt));
  }

  async getAcceptedConnectionIds(userId: string): Promise<string[]> {
    const rows = await db
      .select({ userId: userConnections.userId, targetUserId: userConnections.targetUserId })
      .from(userConnections)
      .where(
        and(
          eq(userConnections.status, "accepted"),
          or(eq(userConnections.userId, userId), eq(userConnections.targetUserId, userId)),
        )
      );
    return rows.map((r) => (r.userId === userId ? r.targetUserId : r.userId));
  }

  async getSuggestedConnections(userId: string, limit = 5): Promise<(User & { personality?: UserPersonality | null; commonInterests: string[] })[]> {
    const connectedIds = await this.getAcceptedConnectionIds(userId);
    const myPersonality = await this.getPersonality(userId);
    const myInterests: string[] = JSON.parse(myPersonality?.interests || "[]");

    const excludeIds = [userId, ...connectedIds];

    // Fetch candidate users and their personalities in 2 queries (no N+1)
    const allUsers = await db
      .select()
      .from(users)
      .where(notInArray(users.id, excludeIds.length > 0 ? excludeIds : [userId]))
      .limit(50);

    if (allUsers.length === 0) return [];

    const candidateIds = allUsers.map((u) => u.id);
    const personalities = await db
      .select()
      .from(userPersonality)
      .where(inArray(userPersonality.userId, candidateIds));

    const personalityMap = new Map(personalities.map((p) => [p.userId, p]));

    const withPersonality = allUsers.map((u) => {
      const personality = personalityMap.get(u.id) ?? null;
      const theirInterests: string[] = JSON.parse(personality?.interests || "[]");
      const commonInterests = myInterests.filter((i) =>
        theirInterests.some((t) => t.toLowerCase().includes(i.toLowerCase()) || i.toLowerCase().includes(t.toLowerCase()))
      );
      return { ...u, personality, commonInterests };
    });

    return withPersonality
      .sort((a, b) => b.commonInterests.length - a.commonInterests.length)
      .slice(0, limit);
  }

  // ── Friends ───────────────────────────────────────────────────────────────

  async getFriends(userId: string): Promise<(Omit<User, "password"> & { personality: UserPersonality | null })[]> {
    const connectedIds = await this.getAcceptedConnectionIds(userId);
    if (connectedIds.length === 0) return [];

    const friendUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, connectedIds));

    const personalities = await db
      .select()
      .from(userPersonality)
      .where(inArray(userPersonality.userId, connectedIds));

    const personalityMap = new Map(personalities.map((p) => [p.userId, p]));

    return friendUsers.map(({ password: _pw, ...u }) => ({
      ...u,
      personality: personalityMap.get(u.id) ?? null,
    }));
  }

  async searchUsers(query: string, requesterId: string): Promise<(Omit<User, "password"> & { connectionStatus: "none" | "pending" | "accepted" })[]> {
    if (!query.trim()) return [];

    const results = await db
      .select()
      .from(users)
      .where(
        and(
          ne(users.id, requesterId),
          or(
            ilike(users.username, `%${query.trim()}%`),
            ilike(users.displayName, `%${query.trim()}%`)
          )
        )
      )
      .limit(20);

    if (results.length === 0) return [];

    // Fetch all connections involving the requester in one query
    const allConnections = await db
      .select()
      .from(userConnections)
      .where(
        or(
          eq(userConnections.userId, requesterId),
          eq(userConnections.targetUserId, requesterId)
        )
      );

    return results.map(({ password: _pw, ...u }) => {
      const conn = allConnections.find(
        (c) => (c.userId === requesterId && c.targetUserId === u.id) ||
               (c.targetUserId === requesterId && c.userId === u.id)
      );
      const connectionStatus: "none" | "pending" | "accepted" =
        !conn ? "none" : conn.status === "accepted" ? "accepted" : "pending";
      return { ...u, connectionStatus };
    });
  }

  async getUserPublicProfile(userId: string): Promise<{
    user: Omit<User, "password">;
    recentPosts: Post[];
    interests: string[];
  } | null> {
    const user = await this.getUser(userId);
    if (!user) return null;

    const [recentPosts, personality] = await Promise.all([
      this.getPostsByUser(userId, 5),
      this.getPersonality(userId),
    ]);

    const { password: _pw, ...safeUser } = user;

    return {
      user: safeUser,
      recentPosts,
      interests: JSON.parse(personality?.interests || "[]"),
    };
  }

  async sendDirectMessage(data: InsertDirectMessage): Promise<DirectMessage> {
    const [created] = await db.insert(directMessages).values(data).returning();
    return created;
  }

  async getDirectMessagesBetweenUsers(userId: string, otherUserId: string, limit = 80): Promise<DirectMessage[]> {
    const rows = await db
      .select()
      .from(directMessages)
      .where(
        or(
          and(eq(directMessages.senderId, userId), eq(directMessages.recipientId, otherUserId)),
          and(eq(directMessages.senderId, otherUserId), eq(directMessages.recipientId, userId)),
        ),
      )
      .orderBy(desc(directMessages.createdAt))
      .limit(limit);

    return rows.reverse();
  }

  async markDirectMessagesAsRead(userId: string, fromUserId: string): Promise<void> {
    await db
      .update(directMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(directMessages.recipientId, userId),
          eq(directMessages.senderId, fromUserId),
          isNull(directMessages.readAt),
        ),
      );
  }

  async deleteConversation(userId: string, otherUserId: string): Promise<void> {
    await db
      .delete(directMessages)
      .where(
        or(
          and(eq(directMessages.senderId, userId), eq(directMessages.recipientId, otherUserId)),
          and(eq(directMessages.senderId, otherUserId), eq(directMessages.recipientId, userId)),
        ),
      );
  }

  async getDirectConversations(userId: string): Promise<Array<{
    user: Pick<User, "id" | "username" | "displayName" | "level" | "avatarUrl">;
    lastMessage: string;
    lastMessageAt: Date;
    lastMessageFromMe: boolean;
    unreadCount: number;
  }>> {
    const all = await db
      .select()
      .from(directMessages)
      .where(or(eq(directMessages.senderId, userId), eq(directMessages.recipientId, userId)))
      .orderBy(desc(directMessages.createdAt));

    if (all.length === 0) return [];

    const latestByPartner = new Map<string, DirectMessage>();
    const unreadByPartner = new Map<string, number>();

    for (const msg of all) {
      const partnerId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (!latestByPartner.has(partnerId)) latestByPartner.set(partnerId, msg);
      if (msg.recipientId === userId && msg.senderId === partnerId && !msg.readAt) {
        unreadByPartner.set(partnerId, (unreadByPartner.get(partnerId) ?? 0) + 1);
      }
    }

    const partnerIds: string[] = [];
    latestByPartner.forEach((_value, key) => {
      partnerIds.push(key);
    });
    const partnerUsers = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        level: users.level,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(inArray(users.id, partnerIds));

    const partnerMap = new Map(partnerUsers.map((u) => [u.id, u]));

    return partnerIds
      .map((partnerId) => {
        const user = partnerMap.get(partnerId);
        const latest = latestByPartner.get(partnerId);
        if (!user || !latest) return null;
        return {
          user,
          lastMessage: latest.content,
          lastMessageAt: latest.createdAt,
          lastMessageFromMe: latest.senderId === userId,
          unreadCount: unreadByPartner.get(partnerId) ?? 0,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
  }
  // ── Communities ───────────────────────────────────────────────────────────

  async getTestimonialsForProfile(profileUserId: string): Promise<(Testimonial & { authorUsername: string; authorDisplayName: string | null; authorAvatarUrl: string | null })[]> {
    return db
      .select({
        id: testimonials.id,
        profileUserId: testimonials.profileUserId,
        authorUserId: testimonials.authorUserId,
        content: testimonials.content,
        createdAt: testimonials.createdAt,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
        authorAvatarUrl: users.avatarUrl,
      })
      .from(testimonials)
      .innerJoin(users, eq(testimonials.authorUserId, users.id))
      .where(eq(testimonials.profileUserId, profileUserId))
      .orderBy(desc(testimonials.createdAt));
  }

  async upsertTestimonial(data: InsertTestimonial): Promise<Testimonial> {
    const [existing] = await db
      .select()
      .from(testimonials)
      .where(and(eq(testimonials.profileUserId, data.profileUserId), eq(testimonials.authorUserId, data.authorUserId)));

    if (existing) {
      const [updated] = await db
        .update(testimonials)
        .set({ content: data.content, createdAt: new Date() })
        .where(eq(testimonials.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(testimonials).values(data).returning();
    return created;
  }

  async getCommunities(userId: string, search?: string): Promise<(Community & { isMember: boolean })[]> {
    const rows = search?.trim()
      ? await db.select().from(communities).where(
          or(ilike(communities.name, `%${search}%`), ilike(communities.description, `%${search}%`))
        ).orderBy(desc(communities.membersCount))
      : await db.select().from(communities).orderBy(desc(communities.membersCount));

    if (rows.length === 0) return [];

    const memberships = await db
      .select({ communityId: communityMembers.communityId })
      .from(communityMembers)
      .where(eq(communityMembers.userId, userId));

    const memberSet = new Set(memberships.map((m) => m.communityId));
    return rows.map((c) => ({ ...c, isMember: memberSet.has(c.id) }));
  }

  async createCommunity(data: InsertCommunity): Promise<Community> {
    const [community] = await db.insert(communities).values(data).returning();
    await db.insert(communityMembers).values({ communityId: community.id, userId: data.ownerId, role: "owner" });
    return community;
  }

  async deleteCommunity(communityId: string): Promise<void> {
    await db.delete(communities).where(eq(communities.id, communityId));
  }

  async updateCommunity(id: string, ownerId: string, data: { name?: string; description?: string | null; imageUrl?: string | null }): Promise<Community | null> {
    const [existing] = await db.select().from(communities).where(eq(communities.id, id));
    if (!existing || existing.ownerId !== ownerId) return null;
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl;
    if (Object.keys(updates).length === 0) return existing;
    const [updated] = await db.update(communities).set(updates).where(eq(communities.id, id)).returning();
    return updated ?? null;
  }

  async getCommunityById(id: string, userId: string): Promise<(Community & { isMember: boolean; memberRole?: string; memberStatus?: string }) | null> {
    const [community] = await db.select().from(communities).where(eq(communities.id, id));
    if (!community) return null;
    const [membership] = await db.select().from(communityMembers).where(and(eq(communityMembers.communityId, id), eq(communityMembers.userId, userId)));
    return { ...community, isMember: membership?.status === "active", memberRole: membership?.role, memberStatus: membership?.status };
  }

  async getCommunityMembers(communityId: string): Promise<{ id: string; username: string; displayName: string | null; avatarUrl: string | null; role: string; joinedAt: Date }[]> {
    return db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: communityMembers.role,
        joinedAt: communityMembers.joinedAt,
      })
      .from(communityMembers)
      .innerJoin(users, eq(communityMembers.userId, users.id))
      .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.status, "active")))
      .orderBy(communityMembers.joinedAt);
  }

  async getCommunityMemberPushTokens(communityId: string, excludeUserId: string): Promise<string[]> {
    const rows = await db
      .select({ token: users.expoPushToken })
      .from(communityMembers)
      .innerJoin(users, eq(communityMembers.userId, users.id))
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.status, "active"),
          ne(communityMembers.userId, excludeUserId),
        ),
      );
    return rows.map((r) => r.token).filter((t): t is string => !!t);
  }

  async joinCommunity(communityId: string, userId: string): Promise<"joined" | "pending"> {
    const [community] = await db.select().from(communities).where(eq(communities.id, communityId));
    if (!community) return "joined";
    const [existing] = await db.select().from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)));
    if (existing) return existing.status === "pending" ? "pending" : "joined";

    if (community.isPrivate) {
      await db.insert(communityMembers).values({ communityId, userId, role: "member", status: "pending" });
      return "pending";
    }

    await db.insert(communityMembers).values({ communityId, userId, role: "member", status: "active" });
    await db.update(communities).set({ membersCount: sql`${communities.membersCount} + 1` }).where(eq(communities.id, communityId));
    return "joined";
  }

  async getPendingJoinRequests(communityId: string): Promise<{ id: string; username: string; displayName: string | null; avatarUrl: string | null; requestedAt: Date }[]> {
    return db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        requestedAt: communityMembers.joinedAt,
      })
      .from(communityMembers)
      .innerJoin(users, eq(communityMembers.userId, users.id))
      .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.status, "pending")))
      .orderBy(communityMembers.joinedAt);
  }

  async approveJoinRequest(communityId: string, userId: string, ownerId: string): Promise<boolean> {
    const [community] = await db.select().from(communities).where(and(eq(communities.id, communityId), eq(communities.ownerId, ownerId)));
    if (!community) return false;
    const updated = await db
      .update(communityMembers)
      .set({ status: "active" })
      .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId), eq(communityMembers.status, "pending")))
      .returning({ id: communityMembers.id });
    if (updated.length > 0) {
      await db.update(communities).set({ membersCount: sql`${communities.membersCount} + 1` }).where(eq(communities.id, communityId));
    }
    return updated.length > 0;
  }

  async rejectJoinRequest(communityId: string, userId: string, ownerId: string): Promise<boolean> {
    const [community] = await db.select().from(communities).where(and(eq(communities.id, communityId), eq(communities.ownerId, ownerId)));
    if (!community) return false;
    const deleted = await db
      .delete(communityMembers)
      .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId), eq(communityMembers.status, "pending")))
      .returning({ id: communityMembers.id });
    return deleted.length > 0;
  }

  async leaveCommunity(communityId: string, userId: string): Promise<void> {
    const deleted = await db.delete(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId), ne(communityMembers.role, "owner"))).returning({ id: communityMembers.id });
    if (deleted.length > 0) {
      await db.update(communities).set({ membersCount: sql`GREATEST(${communities.membersCount} - 1, 1)` }).where(eq(communities.id, communityId));
    }
  }

  async getCommunityPosts(communityId: string, userId: string, limit = 20, offset = 0): Promise<(CommunityPost & { username: string; displayName: string | null; avatarUrl: string | null; likesCount: number; liked: boolean; commentsCount: number })[]> {
    const rows = await db
      .select({
        id: communityPosts.id,
        communityId: communityPosts.communityId,
        userId: communityPosts.userId,
        content: communityPosts.content,
        imageUrl: communityPosts.imageUrl,
        createdAt: communityPosts.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(communityPosts)
      .innerJoin(users, eq(communityPosts.userId, users.id))
      .where(eq(communityPosts.communityId, communityId))
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit)
      .offset(offset);

    if (rows.length === 0) return [];
    const postIds = rows.map((r) => r.id);

    const allLikes = await db.select({ postId: communityPostLikes.postId, userId: communityPostLikes.userId }).from(communityPostLikes).where(inArray(communityPostLikes.postId, postIds));
    const likeCountMap = new Map<string, number>();
    const userLikedSet = new Set<string>();
    for (const l of allLikes) {
      likeCountMap.set(l.postId, (likeCountMap.get(l.postId) ?? 0) + 1);
      if (l.userId === userId) userLikedSet.add(l.postId);
    }

    const allComments = await db.select({ postId: communityPostComments.postId }).from(communityPostComments).where(inArray(communityPostComments.postId, postIds));
    const commentCountMap = new Map<string, number>();
    for (const c of allComments) commentCountMap.set(c.postId, (commentCountMap.get(c.postId) ?? 0) + 1);

    return rows.map((r) => ({ ...r, likesCount: likeCountMap.get(r.id) ?? 0, liked: userLikedSet.has(r.id), commentsCount: commentCountMap.get(r.id) ?? 0 }));
  }

  async createCommunityPost(data: InsertCommunityPost): Promise<CommunityPost> {
    const [post] = await db.insert(communityPosts).values(data).returning();
    return post;
  }

  async deleteCommunityPost(postId: string, userId: string): Promise<boolean> {
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, postId));
    if (!post) return false;

    const [membership] = await db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(and(eq(communityMembers.communityId, post.communityId), eq(communityMembers.userId, userId)));

    if (post.userId !== userId && membership?.role !== "owner") return false;

    const deleted = await db.delete(communityPosts).where(eq(communityPosts.id, postId)).returning({ id: communityPosts.id });
    return deleted.length > 0;
  }

  async getUserCommunities(userId: string): Promise<Community[]> {
    const memberships = await db.select({ communityId: communityMembers.communityId }).from(communityMembers).where(eq(communityMembers.userId, userId));
    if (memberships.length === 0) return [];
    return db.select().from(communities).where(inArray(communities.id, memberships.map((m) => m.communityId))).orderBy(desc(communities.membersCount));
  }

  async toggleCommunityPostLike(postId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    const [existing] = await db.select().from(communityPostLikes).where(and(eq(communityPostLikes.postId, postId), eq(communityPostLikes.userId, userId)));
    if (existing) {
      await db.delete(communityPostLikes).where(and(eq(communityPostLikes.postId, postId), eq(communityPostLikes.userId, userId)));
    } else {
      await db.insert(communityPostLikes).values({ postId, userId });
    }
    const result = await db.select({ count: sql<number>`count(*)` }).from(communityPostLikes).where(eq(communityPostLikes.postId, postId));
    return { liked: !existing, likesCount: Number(result[0]?.count ?? 0) };
  }

  async getCommunityPostComments(postId: string, userId: string): Promise<(CommunityPostComment & { username: string; displayName: string | null; avatarUrl: string | null; likesCount: number; liked: boolean })[]> {
    const rows = await db
      .select({ id: communityPostComments.id, postId: communityPostComments.postId, userId: communityPostComments.userId, content: communityPostComments.content, createdAt: communityPostComments.createdAt, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(communityPostComments)
      .innerJoin(users, eq(communityPostComments.userId, users.id))
      .where(eq(communityPostComments.postId, postId))
      .orderBy(communityPostComments.createdAt);

    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const allLikes = await db.select({ commentId: communityPostCommentLikes.commentId, userId: communityPostCommentLikes.userId }).from(communityPostCommentLikes).where(inArray(communityPostCommentLikes.commentId, ids));
    const likeCountMap = new Map<string, number>();
    const userLikedSet = new Set<string>();
    for (const l of allLikes) {
      likeCountMap.set(l.commentId, (likeCountMap.get(l.commentId) ?? 0) + 1);
      if (l.userId === userId) userLikedSet.add(l.commentId);
    }
    return rows.map((r) => ({ ...r, likesCount: likeCountMap.get(r.id) ?? 0, liked: userLikedSet.has(r.id) }));
  }

  async createCommunityPostComment(data: InsertCommunityPostComment): Promise<CommunityPostComment> {
    const [comment] = await db.insert(communityPostComments).values(data).returning();
    return comment;
  }

  async toggleCommunityCommentLike(commentId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    const [existing] = await db.select().from(communityPostCommentLikes).where(and(eq(communityPostCommentLikes.commentId, commentId), eq(communityPostCommentLikes.userId, userId)));
    if (existing) {
      await db.delete(communityPostCommentLikes).where(and(eq(communityPostCommentLikes.commentId, commentId), eq(communityPostCommentLikes.userId, userId)));
    } else {
      await db.insert(communityPostCommentLikes).values({ commentId, userId });
    }
    const result = await db.select({ count: sql<number>`count(*)` }).from(communityPostCommentLikes).where(eq(communityPostCommentLikes.commentId, commentId));
    return { liked: !existing, likesCount: Number(result[0]?.count ?? 0) };
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  async getCommentsForPost(postId: string, userId: string): Promise<(PostComment & { username: string; displayName: string | null; avatarUrl: string | null; likesCount: number; liked: boolean })[]> {
    const rows = await db
      .select({
        id: postComments.id,
        postId: postComments.postId,
        userId: postComments.userId,
        content: postComments.content,
        createdAt: postComments.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(postComments)
      .innerJoin(users, eq(postComments.userId, users.id))
      .where(eq(postComments.postId, postId))
      .orderBy(postComments.createdAt);

    if (rows.length === 0) return [];

    const commentIds = rows.map((r) => r.id);
    const allLikes = await db
      .select({ commentId: commentLikes.commentId, userId: commentLikes.userId })
      .from(commentLikes)
      .where(inArray(commentLikes.commentId, commentIds));

    const likeCountMap = new Map<string, number>();
    const userLikedSet = new Set<string>();
    for (const l of allLikes) {
      likeCountMap.set(l.commentId, (likeCountMap.get(l.commentId) ?? 0) + 1);
      if (l.userId === userId) userLikedSet.add(l.commentId);
    }

    return rows.map((r) => ({
      ...r,
      likesCount: likeCountMap.get(r.id) ?? 0,
      liked: userLikedSet.has(r.id),
    }));
  }

  async createPostComment(data: InsertPostComment): Promise<PostComment> {
    const [comment] = await db.insert(postComments).values(data).returning();
    return comment;
  }

  async getCommentCount(postId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(postComments)
      .where(eq(postComments.postId, postId));
    return Number(result[0]?.count ?? 0);
  }

  async getPostEnrichmentBatch(postIds: string[], userId: string): Promise<{ likeCounts: Map<string, number>; likedSet: Set<string>; commentCounts: Map<string, number> }> {
    if (postIds.length === 0) return { likeCounts: new Map(), likedSet: new Set(), commentCounts: new Map() };
    const [likeCountRows, commentCountRows, userLikedRows] = await Promise.all([
      db
        .select({ postId: postLikes.postId, count: sql<number>`count(*)::int` })
        .from(postLikes)
        .where(inArray(postLikes.postId, postIds))
        .groupBy(postLikes.postId),
      db
        .select({ postId: postComments.postId, count: sql<number>`count(*)::int` })
        .from(postComments)
        .where(inArray(postComments.postId, postIds))
        .groupBy(postComments.postId),
      db
        .select({ postId: postLikes.postId })
        .from(postLikes)
        .where(and(inArray(postLikes.postId, postIds), eq(postLikes.userId, userId))),
    ]);
    const likeCounts = new Map<string, number>(likeCountRows.map((r) => [r.postId, Number(r.count)]));
    const commentCounts = new Map<string, number>(commentCountRows.map((r) => [r.postId, Number(r.count)]));
    const likedSet = new Set<string>(userLikedRows.map((r) => r.postId));
    return { likeCounts, likedSet, commentCounts };
  }

  async toggleCommentLike(commentId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    const [existing] = await db
      .select()
      .from(commentLikes)
      .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)));

    if (existing) {
      await db.delete(commentLikes).where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)));
    } else {
      await db.insert(commentLikes).values({ commentId, userId });
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(commentLikes)
      .where(eq(commentLikes.commentId, commentId));

    return { liked: !existing, likesCount: Number(result[0]?.count ?? 0) };
  }

  // ── Message feedback ──────────────────────────────────────────────────────

  async upsertMessageFeedback(data: { userId: string; messageId: string; feedbackType: "like" | "dislike"; feedbackReason?: string | null; messageCategory?: string | null }): Promise<MessageFeedback> {
    const [existing] = await db
      .select()
      .from(messageFeedback)
      .where(and(eq(messageFeedback.userId, data.userId), eq(messageFeedback.messageId, data.messageId)));

    if (existing) {
      const [updated] = await db
        .update(messageFeedback)
        .set({
          feedbackType: data.feedbackType,
          feedbackReason: data.feedbackReason ?? null,
          messageCategory: data.messageCategory ?? existing.messageCategory,
          updatedAt: new Date(),
        })
        .where(eq(messageFeedback.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(messageFeedback)
      .values({
        userId: data.userId,
        messageId: data.messageId,
        feedbackType: data.feedbackType,
        feedbackReason: data.feedbackReason ?? null,
        messageCategory: data.messageCategory ?? null,
      })
      .returning();
    return created;
  }

  async deleteMessageFeedback(userId: string, messageId: string): Promise<boolean> {
    const deleted = await db
      .delete(messageFeedback)
      .where(and(eq(messageFeedback.userId, userId), eq(messageFeedback.messageId, messageId)))
      .returning();
    return deleted.length > 0;
  }

  async getMessageFeedbackByIds(userId: string, messageIds: string[]): Promise<MessageFeedback[]> {
    if (messageIds.length === 0) return [];
    return db
      .select()
      .from(messageFeedback)
      .where(and(eq(messageFeedback.userId, userId), inArray(messageFeedback.messageId, messageIds)));
  }

  async getMessageFeedbackSummary(userId: string): Promise<{ category: string; likes: number; dislikes: number }[]> {
    const rows = await db
      .select({
        category: messageFeedback.messageCategory,
        likes: sql<number>`sum(case when ${messageFeedback.feedbackType} = 'like' then 1 else 0 end)`,
        dislikes: sql<number>`sum(case when ${messageFeedback.feedbackType} = 'dislike' then 1 else 0 end)`,
      })
      .from(messageFeedback)
      .where(eq(messageFeedback.userId, userId))
      .groupBy(messageFeedback.messageCategory);
    return rows
      .filter((r) => r.category)
      .map((r) => ({ category: r.category as string, likes: Number(r.likes ?? 0), dislikes: Number(r.dislikes ?? 0) }));
  }

  // ── Feed drafts ──────────────────────────────────────────────────────────

  async createFeedDraft(data: { userId: string; sourceMessageId?: string | null; title?: string | null; content: string; category?: string | null; hashtags?: string | null; privacy?: string }): Promise<FeedDraft> {
    const [created] = await db
      .insert(feedDrafts)
      .values({
        userId: data.userId,
        sourceMessageId: data.sourceMessageId ?? null,
        title: data.title ?? null,
        content: data.content,
        category: data.category ?? null,
        hashtags: data.hashtags ?? null,
        privacy: data.privacy ?? "public",
        status: "draft",
      })
      .returning();
    return created;
  }

  async getFeedDraft(id: string, userId: string): Promise<FeedDraft | undefined> {
    const [draft] = await db
      .select()
      .from(feedDrafts)
      .where(and(eq(feedDrafts.id, id), eq(feedDrafts.userId, userId)));
    return draft;
  }

  async markFeedDraftPublished(id: string, userId: string, publishedPostId: string): Promise<FeedDraft | undefined> {
    const [updated] = await db
      .update(feedDrafts)
      .set({ status: "published", publishedPostId, updatedAt: new Date() })
      .where(and(eq(feedDrafts.id, id), eq(feedDrafts.userId, userId)))
      .returning();
    return updated;
  }

  async cancelFeedDraft(id: string, userId: string): Promise<boolean> {
    const updated = await db
      .update(feedDrafts)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(and(eq(feedDrafts.id, id), eq(feedDrafts.userId, userId)))
      .returning();
    return updated.length > 0;
  }
}

export const storage = new DrizzleStorage();
