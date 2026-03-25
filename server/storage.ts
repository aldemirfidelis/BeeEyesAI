import { eq, desc, and, gte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, userPersonality, messages, missions, moodEntries, achievements,
  type User, type InsertUser,
  type UserPersonality, type InsertUserPersonality,
  type Message, type InsertMessage,
  type Mission, type InsertMission,
  type MoodEntry, type InsertMoodEntry,
  type Achievement, type InsertAchievement,
  xpForLevel,
} from "../shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserXP(userId: string, xpToAdd: number): Promise<User>;
  updateUserStreak(userId: string): Promise<User>;
  incrementMessageCount(userId: string): Promise<void>;

  // Personality
  getPersonality(userId: string): Promise<UserPersonality | undefined>;
  upsertPersonality(data: InsertUserPersonality): Promise<UserPersonality>;

  // Messages
  getMessagesByUser(userId: string, limit?: number): Promise<Message[]>;
  createMessage(msg: InsertMessage): Promise<Message>;

  // Missions
  getMissionsByUser(userId: string, completed?: boolean): Promise<Mission[]>;
  createMission(mission: InsertMission): Promise<Mission>;
  completeMission(id: string, userId: string): Promise<Mission | undefined>;
  deleteMission(id: string, userId: string): Promise<void>;

  // Mood
  getMoodEntriesByUser(userId: string, days?: number): Promise<MoodEntry[]>;
  createMoodEntry(entry: InsertMoodEntry): Promise<MoodEntry>;

  // Achievements
  getAchievementsByUser(userId: string): Promise<Achievement[]>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  hasAchievement(userId: string, type: string): Promise<boolean>;
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    // Create default personality profile
    await db.insert(userPersonality).values({ userId: user.id });
    return user;
  }

  async updateUserXP(userId: string, xpToAdd: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    let newXP = user.xp + xpToAdd;
    let newLevel = user.level;

    // Check for level up
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
        // Consecutive day — increment
        newStreak = user.currentStreak + 1;
      } else {
        // Streak broken
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
}

export const storage = new DrizzleStorage();
