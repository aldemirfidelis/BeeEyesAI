export interface PostAuthor {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
}

export interface FeedPost {
  id: string;
  userId: string;
  content: string;
  sentiment: string | null;
  sentimentLabel: string | null;
  aiComment: string | null;
  createdAt: string;
  author: PostAuthor;
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
  suggestionMessage?: string;
}

export interface DMConversation {
  user: PostAuthor;
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

export interface Community {
  id: string;
  name: string;
  description: string | null;
  category: string;
  emoji: string;
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
  author: PostAuthor;
}

export interface ConnectionRequestMeta {
  type: "connection_request";
  connectionId: string;
  fromUserId?: string;
  fromName?: string;
}

export interface ConnectionRequestResolvedMeta {
  type: "connection_request_resolved";
  decision: "accept" | "reject";
}

export interface NetworkDigestMeta {
  type: "network_digest";
  query: string;
  newsItems: NewsItem[];
  feedPosts: ChatFeedSummaryPost[];
  suggestions: ConnectionSuggestion[];
}

export interface NewsDigestMeta {
  type: "news_digest";
  query: string;
  items: NewsItem[];
}

export type MessageMeta =
  | ConnectionRequestMeta
  | ConnectionRequestResolvedMeta
  | NetworkDigestMeta
  | NewsDigestMeta
  | { proactive?: boolean; visitFrom?: string };

export function parseMessageMeta(metadata?: string | null): MessageMeta | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as MessageMeta;
  } catch {
    return null;
  }
}

export function isConnectionRequestMeta(meta: MessageMeta | null): meta is ConnectionRequestMeta {
  return Boolean(meta && "type" in meta && meta.type === "connection_request");
}

export function isNetworkDigestMeta(meta: MessageMeta | null): meta is NetworkDigestMeta {
  return Boolean(meta && "type" in meta && meta.type === "network_digest");
}

export function isNewsDigestMeta(meta: MessageMeta | null): meta is NewsDigestMeta {
  return Boolean(meta && "type" in meta && meta.type === "news_digest");
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function displayNameOf(user: { username: string; displayName: string | null }) {
  return user.displayName || user.username;
}
