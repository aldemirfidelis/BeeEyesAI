import { eq, desc, and, gte, sql, ne, notInArray, inArray, ilike, or, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  users, userPersonality, messages, missions, moodEntries, achievements,
  posts, postLikes, userConnections, directMessages,
  communities, communityMembers, communityPosts,
  communityPostLikes, communityPostComments, communityPostCommentLikes,
  postComments, commentLikes,
  type User, type InsertUser,
  type UserPersonality, type InsertUserPersonality,
  type Message, type InsertMessage,
  type Mission, type InsertMission,
  type MoodEntry, type InsertMoodEntry,
  type Achievement, type InsertAchievement,
  type Post, type InsertPost,
  type UserConnection, type InsertConnection,
  type DirectMessage, type InsertDirectMessage,
  type Community, type InsertCommunity,
  type CommunityPost, type InsertCommunityPost,
  type CommunityPostComment, type InsertCommunityPostComment,
  type PostComment, type InsertPostComment,
  xpForLevel,
  PREDEFINED_MISSIONS,
} from "../shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser & { googleId?: string; displayName?: string; gender?: string }): Promise<User>;
  updateUserPreferences(userId: string, preferences: { anonymousProfileVisitsEnabled?: boolean }): Promise<User>;
  updateUserXP(userId: string, xpToAdd: number): Promise<User>;
  updateUserStreak(userId: string): Promise<User>;
  incrementMessageCount(userId: string): Promise<void>;
  getAllUsersExcept(userId: string): Promise<User[]>;

  // Personality
  getPersonality(userId: string): Promise<UserPersonality | undefined>;
  upsertPersonality(data: InsertUserPersonality): Promise<UserPersonality>;

  // Messages
  getMessagesByUser(userId: string, limit?: number): Promise<Message[]>;
  createMessage(msg: InsertMessage): Promise<Message>;
  updateMessageMetadata(id: string, userId: string, data: { content: string; metadata: string }): Promise<Message | undefined>;

  // Missions
  getMissionsByUser(userId: string, completed?: boolean): Promise<Mission[]>;
  createMission(mission: InsertMission): Promise<Mission>;
  completeMission(id: string, userId: string): Promise<Mission | undefined>;
  completeMissionByAction(userId: string, actionType: string): Promise<Mission | undefined>;
  seedPredefinedMissions(userId: string): Promise<void>;
  deleteMission(id: string, userId: string): Promise<void>;

  // Mood
  getMoodEntriesByUser(userId: string, days?: number): Promise<MoodEntry[]>;
  createMoodEntry(entry: InsertMoodEntry): Promise<MoodEntry>;

  // Achievements
  getAchievementsByUser(userId: string): Promise<Achievement[]>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  hasAchievement(userId: string, type: string): Promise<boolean>;

  // Posts
  createPost(post: InsertPost & { sentiment?: string; sentimentLabel?: string; aiComment?: string }): Promise<Post>;
  getPostsByUser(userId: string, limit?: number): Promise<Post[]>;
  getPostById(id: string): Promise<Post | undefined>;
  updatePostAIComment(postId: string, aiComment: string, sentiment: string, sentimentLabel: string): Promise<void>;
  getFeedForUser(userId: string, limit?: number): Promise<(Post & { author: Pick<User, "id" | "username" | "displayName" | "level"> })[]>;
  likePost(postId: string, userId: string): Promise<void>;
  unlikePost(postId: string, userId: string): Promise<void>;
  hasLikedPost(postId: string, userId: string): Promise<boolean>;
  getPostLikesCount(postId: string): Promise<number>;

  // Connections
  getConnectionStatus(userId: string, targetUserId: string): Promise<UserConnection | undefined>;
  createConnection(data: InsertConnection): Promise<UserConnection>;
  acceptConnection(id: string, userId: string): Promise<UserConnection | undefined>;
  rejectConnection(id: string, userId: string): Promise<boolean>;
  getConnectionsByUser(userId: string): Promise<UserConnection[]>;
  getAcceptedConnectionIds(userId: string): Promise<string[]>;
  getSuggestedConnections(userId: string, limit?: number): Promise<(User & { personality?: UserPersonality | null; commonInterests: string[] })[]>;

  // Friends
  getFriends(userId: string): Promise<(Omit<User, "password"> & { personality: UserPersonality | null })[]>;
  searchUsers(query: string, requesterId: string): Promise<(Omit<User, "password"> & { connectionStatus: "none" | "pending" | "accepted" })[]>;
  getUserPublicProfile(userId: string): Promise<{
    user: Omit<User, "password">;
    recentPosts: Post[];
    interests: string[];
    activeMissionsCount: number;
  } | null>;

  // Direct messages
  sendDirectMessage(data: InsertDirectMessage): Promise<DirectMessage>;
  getDirectMessagesBetweenUsers(userId: string, otherUserId: string, limit?: number): Promise<DirectMessage[]>;
  markDirectMessagesAsRead(userId: string, fromUserId: string): Promise<void>;
  getDirectConversations(userId: string): Promise<Array<{
    user: Pick<User, "id" | "username" | "displayName" | "level">;
    lastMessage: string;
    lastMessageAt: Date;
    lastMessageFromMe: boolean;
    unreadCount: number;
  }>>;

  // Comments
  getCommentsForPost(postId: string, userId: string): Promise<(PostComment & { username: string; displayName: string | null; likesCount: number; liked: boolean })[]>;
  createPostComment(data: InsertPostComment): Promise<PostComment>;
  getCommentCount(postId: string): Promise<number>;
  toggleCommentLike(commentId: string, userId: string): Promise<{ liked: boolean; likesCount: number }>;

  // Communities
  getCommunities(userId: string, search?: string): Promise<(Community & { isMember: boolean })[]>;
  createCommunity(data: InsertCommunity): Promise<Community>;
  updateCommunity(id: string, ownerId: string, data: { name?: string; description?: string | null; imageUrl?: string | null }): Promise<Community | null>;
  getCommunityById(id: string, userId: string): Promise<(Community & { isMember: boolean; memberRole?: string }) | null>;
  joinCommunity(communityId: string, userId: string): Promise<void>;
  leaveCommunity(communityId: string, userId: string): Promise<void>;
  getCommunityPosts(communityId: string, userId: string): Promise<(CommunityPost & { username: string; displayName: string | null; likesCount: number; liked: boolean; commentsCount: number })[]>;
  createCommunityPost(data: InsertCommunityPost): Promise<CommunityPost>;
  getUserCommunities(userId: string): Promise<Community[]>;
  toggleCommunityPostLike(postId: string, userId: string): Promise<{ liked: boolean; likesCount: number }>;
  getCommunityPostComments(postId: string, userId: string): Promise<(CommunityPostComment & { username: string; displayName: string | null; likesCount: number; liked: boolean })[]>;
  createCommunityPostComment(data: InsertCommunityPostComment): Promise<CommunityPostComment>;
  toggleCommunityCommentLike(commentId: string, userId: string): Promise<{ liked: boolean; likesCount: number }>;
}

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

  async createUser(insertUser: InsertUser & { googleId?: string; displayName?: string; gender?: string }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    await db.insert(userPersonality).values({ userId: user.id });
    return user;
  }

  async updateUserPreferences(userId: string, preferences: { anonymousProfileVisitsEnabled?: boolean }): Promise<User> {
    const updates: Partial<typeof users.$inferInsert> = {};
    if (preferences.anonymousProfileVisitsEnabled !== undefined) {
      updates.anonymousProfileVisitsEnabled = preferences.anonymousProfileVisitsEnabled;
    }

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

  async getMissionsByUser(userId: string, completed?: boolean): Promise<Mission[]> {
    const conditions = [eq(missions.userId, userId)];
    if (completed !== undefined) {
      conditions.push(eq(missions.completed, completed));
    }
    return db
      .select()
      .from(missions)
      .where(and(...conditions))
      .orderBy(desc(missions.createdAt));
  }

  async createMission(mission: InsertMission): Promise<Mission> {
    const [created] = await db.insert(missions).values(mission).returning();
    return created;
  }

  async completeMission(id: string, userId: string): Promise<Mission | undefined> {
    const [mission] = await db
      .update(missions)
      .set({ completed: true, completedAt: new Date() })
      .where(and(eq(missions.id, id), eq(missions.userId, userId)))
      .returning();
    return mission;
  }

  async completeMissionByAction(userId: string, actionType: string): Promise<Mission | undefined> {
    // Find the first pending system mission with this actionType for the user
    const [pending] = await db
      .select()
      .from(missions)
      .where(
        and(
          eq(missions.userId, userId),
          eq(missions.actionType, actionType),
          eq(missions.type, "system"),
          eq(missions.completed, false),
        )
      )
      .limit(1);
    if (!pending) return undefined;
    const [completed] = await db
      .update(missions)
      .set({ completed: true, completedAt: new Date() })
      .where(eq(missions.id, pending.id))
      .returning();
    return completed;
  }

  async seedPredefinedMissions(userId: string): Promise<void> {
    const validActionTypes = new Set(PREDEFINED_MISSIONS.map((pm) => pm.actionType));

    // Get existing system missions for this user
    const existing = await db
      .select()
      .from(missions)
      .where(and(eq(missions.userId, userId), eq(missions.type, "system")));

    // Remove any system missions whose actionType is no longer in the predefined list (cleanup obsolete)
    const toDelete = existing.filter((m) => m.actionType && !validActionTypes.has(m.actionType));
    if (toDelete.length > 0) {
      await db.delete(missions).where(
        and(
          eq(missions.userId, userId),
          inArray(missions.id, toDelete.map((m) => m.id))
        )
      );
    }

    // Insert missing predefined missions
    const existingTypes = new Set(existing.map((m) => m.actionType));
    const toInsert = PREDEFINED_MISSIONS
      .filter((pm) => !existingTypes.has(pm.actionType))
      .map((pm) => ({
        userId,
        title: pm.title,
        description: pm.description,
        xpReward: pm.xpReward,
        type: "system" as const,
        actionType: pm.actionType,
        tier: pm.tier,
      }));
    if (toInsert.length > 0) {
      await db.insert(missions).values(toInsert);
    }
  }

  async deleteMission(id: string, userId: string): Promise<void> {
    await db.delete(missions).where(and(eq(missions.id, id), eq(missions.userId, userId)));
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

  async getFeedForUser(userId: string, limit = 30): Promise<(Post & { author: Pick<User, "id" | "username" | "displayName" | "level"> })[]> {
    const connectedIds = await this.getAcceptedConnectionIds(userId);
    const feedUserIds = [userId, ...connectedIds];

    const rows = await db
      .select({
        id: posts.id,
        userId: posts.userId,
        content: posts.content,
        sentiment: posts.sentiment,
        sentimentLabel: posts.sentimentLabel,
        aiComment: posts.aiComment,
        createdAt: posts.createdAt,
        authorId: users.id,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
        authorLevel: users.level,
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .where(inArray(posts.userId, feedUserIds))
      .orderBy(desc(posts.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      content: r.content,
      sentiment: r.sentiment,
      sentimentLabel: r.sentimentLabel,
      aiComment: r.aiComment,
      createdAt: r.createdAt,
      author: {
        id: r.authorId,
        username: r.authorUsername,
        displayName: r.authorDisplayName,
        level: r.authorLevel,
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
      .select()
      .from(userConnections)
      .where(
        and(eq(userConnections.status, "accepted"))
      );

    return rows
      .filter((r) => r.userId === userId || r.targetUserId === userId)
      .map((r) => (r.userId === userId ? r.targetUserId : r.userId));
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
    activeMissionsCount: number;
  } | null> {
    const user = await this.getUser(userId);
    if (!user) return null;

    const [recentPosts, personality, activeMissions] = await Promise.all([
      this.getPostsByUser(userId, 5),
      this.getPersonality(userId),
      this.getMissionsByUser(userId, false),
    ]);

    const { password: _pw, ...safeUser } = user;

    return {
      user: safeUser,
      recentPosts,
      interests: JSON.parse(personality?.interests || "[]"),
      activeMissionsCount: activeMissions.length,
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

  async getDirectConversations(userId: string): Promise<Array<{
    user: Pick<User, "id" | "username" | "displayName" | "level">;
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

  async getCommunityById(id: string, userId: string): Promise<(Community & { isMember: boolean; memberRole?: string }) | null> {
    const [community] = await db.select().from(communities).where(eq(communities.id, id));
    if (!community) return null;
    const [membership] = await db.select().from(communityMembers).where(and(eq(communityMembers.communityId, id), eq(communityMembers.userId, userId)));
    return { ...community, isMember: !!membership, memberRole: membership?.role };
  }

  async joinCommunity(communityId: string, userId: string): Promise<void> {
    const [existing] = await db.select().from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)));
    if (existing) return;
    await db.insert(communityMembers).values({ communityId, userId, role: "member" });
    await db.update(communities).set({ membersCount: sql`${communities.membersCount} + 1` }).where(eq(communities.id, communityId));
  }

  async leaveCommunity(communityId: string, userId: string): Promise<void> {
    const deleted = await db.delete(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId), ne(communityMembers.role, "owner"))).returning({ id: communityMembers.id });
    if (deleted.length > 0) {
      await db.update(communities).set({ membersCount: sql`GREATEST(${communities.membersCount} - 1, 1)` }).where(eq(communities.id, communityId));
    }
  }

  async getCommunityPosts(communityId: string, userId: string): Promise<(CommunityPost & { username: string; displayName: string | null; likesCount: number; liked: boolean; commentsCount: number })[]> {
    const rows = await db
      .select({
        id: communityPosts.id,
        communityId: communityPosts.communityId,
        userId: communityPosts.userId,
        content: communityPosts.content,
        createdAt: communityPosts.createdAt,
        username: users.username,
        displayName: users.displayName,
      })
      .from(communityPosts)
      .innerJoin(users, eq(communityPosts.userId, users.id))
      .where(eq(communityPosts.communityId, communityId))
      .orderBy(desc(communityPosts.createdAt))
      .limit(50);

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

  async getCommunityPostComments(postId: string, userId: string): Promise<(CommunityPostComment & { username: string; displayName: string | null; likesCount: number; liked: boolean })[]> {
    const rows = await db
      .select({ id: communityPostComments.id, postId: communityPostComments.postId, userId: communityPostComments.userId, content: communityPostComments.content, createdAt: communityPostComments.createdAt, username: users.username, displayName: users.displayName })
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

  async getCommentsForPost(postId: string, userId: string): Promise<(PostComment & { username: string; displayName: string | null; likesCount: number; liked: boolean })[]> {
    const rows = await db
      .select({
        id: postComments.id,
        postId: postComments.postId,
        userId: postComments.userId,
        content: postComments.content,
        createdAt: postComments.createdAt,
        username: users.username,
        displayName: users.displayName,
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
}

export const storage = new DrizzleStorage();
