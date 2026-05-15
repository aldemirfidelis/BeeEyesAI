import { Camera, Image, Plus, RefreshCw, UserPlus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/UserAvatar";
import type { ConnectionSuggestion, FeedPost, User } from "@/features/home/types";
import FeedPostCard from "@/components/FeedPostCard";

export const SENTIMENT_EMOJI: Record<string, string> = {
  happy: "😊",
  motivated: "💪",
  tired: "😴",
  sad: "💙",
  neutral: "😐",
  excited: "🎉",
  proud: "🏆",
};

interface FeedPanelProps {
  feed: FeedPost[];
  feedLoading: boolean;
  feedLoadingMore: boolean;
  feedHasMore: boolean;
  feedError: string | null;
  feedMode: "for-you" | "friends";
  postText: string;
  postImagePreviewUrl: string;
  postImageUrl: string;
  pickingPostImage: boolean;
  isPosting: boolean;
  showPostInput: boolean;
  suggestions: ConnectionSuggestion[];
  connectingIds: Set<string>;
  currentUser: User | null;
  onLoadFeed: () => void;
  onLoadMore: () => void;
  onFeedModeChange: (mode: "for-you" | "friends") => void;
  onTogglePostInput: () => void;
  onPostTextChange: (value: string) => void;
  onPickPostImage: (capture?: boolean) => void;
  onRemovePostImage: () => void;
  onCancelPost: () => void;
  onCreatePost: () => void;
  onConnect: (targetUserId: string) => void;
  onLikePost: (postId: string) => void;
  onEditPost: (postId: string, content: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onOpenFriendProfile: (friendId: string) => void;
  timeAgo: (value: string | Date) => string;
  authHeaders: () => Record<string, string>;
}

function FeedPostSkeleton() {
  return (
    <div className="bee-surface rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted/60" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 rounded bg-muted/60" />
          <div className="h-2.5 w-20 rounded bg-muted/40" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-[90%] rounded bg-muted/50" />
        <div className="h-3 w-[70%] rounded bg-muted/50" />
      </div>
      <div className="h-40 rounded-lg bg-muted/40" />
      <div className="flex gap-3 pt-2">
        <div className="h-6 w-16 rounded bg-muted/50" />
        <div className="h-6 w-16 rounded bg-muted/50" />
        <div className="h-6 w-16 rounded bg-muted/50" />
      </div>
    </div>
  );
}

export function FeedPanel(props: FeedPanelProps) {
  const {
    feed,
    feedLoading,
    feedLoadingMore,
    feedHasMore,
    feedError,
    feedMode,
    postText,
    postImagePreviewUrl,
    postImageUrl,
    pickingPostImage,
    isPosting,
    showPostInput,
    suggestions,
    connectingIds,
    currentUser,
    onLoadFeed,
    onLoadMore,
    onFeedModeChange,
    onTogglePostInput,
    onPostTextChange,
    onPickPostImage,
    onRemovePostImage,
    onCancelPost,
    onCreatePost,
    onConnect,
    onLikePost,
    onEditPost,
    onDeletePost,
    onOpenFriendProfile,
    timeAgo,
  } = props;

  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = loadMoreSentinelRef.current;
    if (!node || !feedHasMore || feedLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feedHasMore, feedLoadingMore, onLoadMore]);

  return (
    <>
      <div className="sticky top-0 z-20 bee-honeycomb p-4 border-b border-border/60 flex items-center justify-between gap-3 bg-card/95 backdrop-blur">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold">Feed</h2>
            <div className="flex rounded-lg border border-border/60 bg-secondary/70 p-0.5 shadow-xs">
              {([
                ["friends", "Amigos"],
                ["for-you", "Para Você"],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onFeedModeChange(mode)}
                  className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                    feedMode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Atualizações da sua rede e gatilhos sociais importantes.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onLoadFeed} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Atualizar" aria-label="Atualizar feed">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button size="sm" variant="outline" onClick={onTogglePostInput} data-testid="feed-open-create-post">
            <Plus className="w-4 h-4 mr-1" />
            Publicar
          </Button>
        </div>
      </div>

      {showPostInput && (
        <div className="sticky top-[73px] z-20 border-b border-border/60 bg-card/95 backdrop-blur">
          <Textarea
            value={postText}
            onChange={(event) => onPostTextChange(event.target.value)}
            placeholder="O que você está pensando?"
            className="resize-none text-sm min-h-[90px] border-0 rounded-none focus-visible:ring-0 px-4 pt-4 pb-2"
            maxLength={500}
            data-testid="feed-post-input"
          />

          {(postImagePreviewUrl || postImageUrl) && (
            <div className="relative mx-4 mb-2 overflow-hidden rounded-lg border border-border shadow-sm">
              <img src={postImagePreviewUrl || postImageUrl} alt="Prévia da foto" className="w-full max-h-80 object-contain bg-black/5" />
              <button type="button" onClick={onRemovePostImage}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors">
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/55 rounded-lg px-2 py-1 backdrop-blur">
                <Image className="w-3 h-3 text-white" />
                <span className="text-white text-[10px] font-semibold">Foto anexada</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => onPickPostImage(true)} disabled={pickingPostImage}
                className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                <Camera className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Câmera</span>
              </button>
              <button type="button" onClick={() => onPickPostImage(false)} disabled={pickingPostImage}
                className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                <Image className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{postImageUrl ? "Trocar" : "Galeria"}</span>
              </button>
              <span className="text-xs text-muted-foreground ml-1">{postText.length}/500</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={onCancelPost} className="text-muted-foreground">Cancelar</Button>
              <Button size="sm"
                disabled={(!postText.trim() && !postImageUrl) || isPosting || pickingPostImage}
                onClick={onCreatePost}
                className="bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold"
                data-testid="feed-submit-post">
                {isPosting ? "Publicando..." : pickingPostImage ? "Preparando..." : "Publicar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="px-4 pt-4 pb-3 border-b border-border/60 bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">REDE EM EXPANSÃO</p>
            <span className="text-[11px] text-muted-foreground">Sugestões relevantes</span>
          </div>
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((suggestion) => {
              const name = suggestion.displayName || suggestion.username;
              return (
                <div key={suggestion.id} className="bee-lift flex items-center gap-3 rounded-lg border border-border/60 bg-card/82 px-3 py-2 shadow-xs">
                  <button type="button" onClick={() => onOpenFriendProfile(suggestion.id)} className="shrink-0">
                    <UserAvatar name={name} avatarUrl={suggestion.avatarUrl} className="w-9 h-9" />
                  </button>
                  <button type="button" onClick={() => onOpenFriendProfile(suggestion.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold truncate hover:underline">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {suggestion.commonInterests.slice(0, 2).join(" · ") || `Nível ${suggestion.level}`}
                    </p>
                  </button>
                  <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" disabled={connectingIds.has(suggestion.id)} onClick={() => onConnect(suggestion.id)}>
                    <UserPlus className="w-3 h-3 mr-1" />
                    Conectar
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-4 space-y-3">
        {feedLoading && feed.length === 0 && (
          <>
            <FeedPostSkeleton />
            <FeedPostSkeleton />
            <FeedPostSkeleton />
          </>
        )}

        {!feedLoading && feed.length === 0 && feedError && (
          <div className="bee-surface mx-auto max-w-sm rounded-2xl px-5 py-10 text-center space-y-3">
            <p className="text-3xl">📡</p>
            <p className="text-sm font-semibold">Não consegui carregar o feed</p>
            <p className="text-xs text-muted-foreground">{feedError}</p>
            <Button size="sm" variant="outline" onClick={onLoadFeed}>
              Tentar de novo
            </Button>
          </div>
        )}

        {!feedLoading && feed.length === 0 && !feedError && (
          <div className="bee-surface mx-auto max-w-sm rounded-2xl px-5 py-10 text-center space-y-2">
            <p className="text-3xl">📰</p>
            <p className="text-sm font-semibold">Seu feed ainda está silencioso</p>
            <p className="text-xs text-muted-foreground">Conecte-se com pessoas ou publique algo para começar o movimento.</p>
          </div>
        )}

        {feed.map((post) => {
          const isOwner = currentUser?.id === post.author.id;
          return (
            <FeedPostCard
              key={post.id}
              post={{ ...post, commentsCount: post.commentsCount ?? 0 }}
              authHeaders={props.authHeaders}
              timeAgo={(d) => timeAgo(d)}
              isOwner={isOwner}
              onEdit={onEditPost}
              onDelete={onDeletePost}
              onOpenProfile={onOpenFriendProfile}
            />
          );
        })}

        {feed.length > 0 && feedHasMore && (
          <div ref={loadMoreSentinelRef} className="py-2">
            {feedLoadingMore && <FeedPostSkeleton />}
          </div>
        )}
      </div>
    </>
  );
}
