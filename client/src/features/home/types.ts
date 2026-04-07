export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: string | null;
}

export interface Mission {
  id: string;
  title: string;
  description: string | null;
  xpReward: number;
  completed: boolean;
  type: "system" | "user";
  actionType: string | null;
  tier: number;
}

export interface User {
  id: string;
  username: string;
  level: number;
  xp: number;
  currentStreak: number;
}

export interface FeedPost {
  id: string;
  userId: string;
  content: string;
  sentiment: string | null;
  sentimentLabel: string | null;
  aiComment: string | null;
  createdAt: string;
  author: { id: string; username: string; displayName: string | null; level: number };
  likesCount: number;
  liked: boolean;
  commentsCount?: number;
}

export interface ConnectionSuggestion {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
  commonInterests: string[];
}

export interface Friend {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
  currentStreak: number;
  lastActiveAt: string | null;
  personality: { interests: string } | null;
}

export interface SearchUser {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
  currentStreak: number;
  connectionStatus: "none" | "pending" | "accepted";
}

export interface FriendProfile {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    level: number;
    xp: number;
    currentStreak: number;
    lastActiveAt: string | null;
  };
  recentPosts: FeedPost[];
  interests: string[];
  activeMissionsCount: number;
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  category: string;
  emoji: string;
  imageUrl?: string | null;
  ownerId: string;
  membersCount: number;
  createdAt: string;
  isMember?: boolean;
  memberRole?: string;
}

export interface CommunityPost {
  id: string;
  communityId: string;
  userId: string;
  content: string;
  createdAt: string;
  username: string;
  displayName: string | null;
  likesCount: number;
  liked: boolean;
  commentsCount: number;
}

export interface DMConversation {
  user: { id: string; username: string; displayName: string | null; level: number };
  lastMessage: string;
  lastMessageAt: string;
  lastMessageFromMe: boolean;
  unreadCount: number;
}

export interface DMMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
}

export interface ChatFeedSummaryPost {
  id: string;
  content: string;
  createdAt: string;
  likesCount: number;
  liked: boolean;
  commentsCount: number;
  aiComment?: string | null;
  sentimentLabel?: string | null;
  sentiment?: string | null;
  author: { id: string; username: string; displayName: string | null; level: number };
}

export interface NetworkDigestMeta {
  type: "network_digest";
  query: string;
  newsItems: NewsItem[];
  feedPosts: ChatFeedSummaryPost[];
  suggestions: ConnectionSuggestion[];
}
