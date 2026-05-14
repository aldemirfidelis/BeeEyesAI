export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: string | null;
}

export interface User {
  id: string;
  username: string;
  email?: string | null;
  displayName?: string | null;
  gender?: string | null;
  bio?: string | null;
  language?: string | null;
  onboardingCompleted?: boolean;
  avatarUrl?: string | null;
  level: number;
  xp: number;
  anonymousProfileVisitsEnabled?: boolean;
  currentStreak: number;
  totalMessagesCount?: number;
  city?: string | null;
  lastDailyBriefingDate?: string | null;
}

export interface DailyBriefing {
  text: string;
  weather: {
    temp: number;
    tempMin: number;
    tempMax: number;
    description: string;
    precipitationChance: number;
  } | null;
  city: string | null;
  date: string;
  dayOfWeek: string;
}

export interface FeedPost {
  id: string;
  userId: string;
  content: string;
  sentiment: string | null;
  sentimentLabel: string | null;
  aiComment: string | null;
  imageUrl?: string | null;
  createdAt: string;
  author: { id: string; username: string; displayName: string | null; level: number; avatarUrl?: string | null };
  likesCount: number;
  liked: boolean;
  commentsCount?: number;
}

export interface ConnectionSuggestion {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  level: number;
  commonInterests: string[];
}

export interface Friend {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  level: number;
  currentStreak: number;
  lastActiveAt: string | null;
  personality: { interests: string } | null;
}

export interface SearchUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  level: number;
  currentStreak: number;
  connectionStatus: "none" | "pending" | "accepted";
}

export interface FriendProfile {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl?: string | null;
    level: number;
    xp: number;
    currentStreak: number;
    lastActiveAt: string | null;
  };
  recentPosts: FeedPost[];
  interests: string[];
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  category: string;
  emoji: string;
  imageUrl?: string | null;
  isPrivate: boolean;
  ownerId: string;
  membersCount: number;
  createdAt: string;
  isMember?: boolean;
  memberRole?: string;
  memberStatus?: string; // "active" | "pending"
}

export interface CommunityPost {
  id: string;
  communityId: string;
  userId: string;
  content: string;
  createdAt: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  likesCount: number;
  liked: boolean;
  commentsCount: number;
  imageUrl?: string | null;
}

export interface CommunityMember {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  role: "owner" | "member" | string;
  joinedAt?: string | null;
}

export interface Achievement {
  id: string;
  userId: string;
  type: string;
  title?: string | null;
  description?: string | null;
  unlockedAt?: string | null;
}

export interface Testimonial {
  id: string;
  profileUserId: string;
  authorUserId: string;
  content: string;
  createdAt?: string | null;
  authorUsername?: string | null;
  authorDisplayName?: string | null;
  authorAvatarUrl?: string | null;
}

export interface DMConversation {
  user: { id: string; username: string; displayName: string | null; level: number; avatarUrl?: string | null };
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
  imageUrl?: string | null;
  createdAt: string;
  likesCount: number;
  liked: boolean;
  commentsCount: number;
  aiComment?: string | null;
  sentimentLabel?: string | null;
  sentiment?: string | null;
  author: { id: string; username: string; displayName: string | null; level: number; avatarUrl?: string | null };
}

export interface NetworkDigestMeta {
  type: "network_digest";
  query: string;
  newsItems: NewsItem[];
  feedPosts: ChatFeedSummaryPost[];
  suggestions: ConnectionSuggestion[];
}

export interface ResearchResult {
  id: string;
  type: "news" | "weather" | "local_place" | "product" | "finance" | "general";
  title: string;
  description: string;
  source: string;
  url?: string;
  imageUrl?: string;
  temperature?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  feelsLike?: number;
  weatherIcon?: string;
  precipitationChance?: number;
  rating?: number;
  distance?: string;
  isOpen?: boolean;
  price?: string;
  publishedAt?: string;
  category?: string;
  address?: string;
}

export interface ResearchMeta {
  type: "research";
  intent: string;
  results: ResearchResult[];
}
