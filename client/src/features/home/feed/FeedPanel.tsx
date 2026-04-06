import { Heart, MessageCircle, Plus, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ConnectionSuggestion, FeedPost } from "@/features/home/types";

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
  postText: string;
  isPosting: boolean;
  showPostInput: boolean;
  suggestions: ConnectionSuggestion[];
  connectingIds: Set<string>;
  onLoadFeed: () => void;
  onTogglePostInput: () => void;
  onPostTextChange: (value: string) => void;
  onCancelPost: () => void;
  onCreatePost: () => void;
  onConnect: (targetUserId: string) => void;
  onLikePost: (postId: string) => void;
  timeAgo: (value: string | Date) => string;
}

export function FeedPanel(props: FeedPanelProps) {
  const {
    feed,
    feedLoading,
    postText,
    isPosting,
    showPostInput,
    suggestions,
    connectingIds,
    onLoadFeed,
    onTogglePostInput,
    onPostTextChange,
    onCancelPost,
    onCreatePost,
    onConnect,
    onLikePost,
    timeAgo,
  } = props;

  return (
    <>
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Feed</h2>
          <p className="text-xs text-muted-foreground mt-1">Atualizações da sua rede e gatilhos sociais importantes.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onLoadFeed} className="text-muted-foreground hover:text-foreground transition-colors" title="Atualizar" aria-label="Atualizar feed">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button size="sm" variant="outline" onClick={onTogglePostInput} data-testid="feed-open-create-post">
            <Plus className="w-4 h-4 mr-1" />
            Publicar
          </Button>
        </div>
      </div>

      {showPostInput && (
        <div className="p-4 border-b space-y-2 bg-secondary/10">
          <Textarea
            value={postText}
            onChange={(event) => onPostTextChange(event.target.value)}
            placeholder="Compartilhe algo com seus amigos..."
            className="resize-none text-sm min-h-[80px]"
            maxLength={500}
            data-testid="feed-post-input"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{postText.length}/500</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={onCancelPost}>Cancelar</Button>
              <Button size="sm" disabled={!postText.trim() || isPosting} onClick={onCreatePost} data-testid="feed-submit-post">
                {isPosting ? "Publicando..." : "Publicar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="px-4 pt-4 pb-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">REDE EM EXPANSÃO</p>
            <span className="text-[11px] text-muted-foreground">Sugestões relevantes</span>
          </div>
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((suggestion) => {
              const name = suggestion.displayName || suggestion.username;
              return (
                <div key={suggestion.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 px-3 py-2">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold shrink-0">
                    {name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {suggestion.commonInterests.slice(0, 2).join(" · ") || `Nível ${suggestion.level}`}
                    </p>
                  </div>
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
        {feedLoading && <p className="text-sm text-muted-foreground text-center py-8">Carregando feed...</p>}
        {!feedLoading && feed.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <p className="text-3xl">📰</p>
            <p className="text-sm font-semibold">Seu feed ainda está silencioso</p>
            <p className="text-xs text-muted-foreground">Conecte-se com pessoas ou publique algo para começar o movimento.</p>
          </div>
        )}
        {feed.map((post) => {
          const name = post.author.displayName || post.author.username;
          return (
            <Card key={post.id} className="p-4 space-y-2 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold shrink-0">
                  {name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold">{name}</span>
                    <span className="text-xs text-muted-foreground bg-secondary rounded px-1 shrink-0">Nv {post.author.level}</span>
                    {post.sentiment && SENTIMENT_EMOJI[post.sentiment] && <span className="text-xs shrink-0">{SENTIMENT_EMOJI[post.sentiment]}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed">{post.content}</p>
              {post.aiComment && (
                <div className="border-l-2 border-primary/40 pl-3 py-1 bg-secondary/20 rounded-r-lg">
                  <p className="text-xs text-muted-foreground">🐝 {post.aiComment}</p>
                </div>
              )}
              <div className="flex items-center gap-4 pt-1">
                <button
                  onClick={() => onLikePost(post.id)}
                  className={`flex items-center gap-1 text-xs transition-colors ${post.liked ? "text-red-500" : "text-muted-foreground hover:text-red-400"}`}
                  data-testid={`feed-like-${post.id}`}
                >
                  <Heart className={`w-4 h-4 ${post.liked ? "fill-current" : ""}`} />
                  {post.likesCount}
                </button>
                {post.commentsCount !== undefined && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageCircle className="w-4 h-4" />
                    {post.commentsCount}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
