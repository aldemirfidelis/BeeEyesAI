import { useState } from "react";
import { Heart, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

interface Author {
  id: string;
  username: string;
  displayName: string | null;
  level: number;
}

interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  username: string;
  displayName: string | null;
  likesCount: number;
  liked: boolean;
}

interface FeedPostCardProps {
  post: {
    id: string;
    content: string;
    createdAt: string;
    author: Author;
    likesCount: number;
    liked: boolean;
    commentsCount: number;
    aiComment?: string | null;
    sentimentLabel?: string | null;
    sentiment?: string | null;
  };
  authHeaders: () => Record<string, string>;
  timeAgo: (date: string) => string;
}

export default function FeedPostCard({ post: initialPost, authHeaders, timeAgo }: FeedPostCardProps) {
  const [liked, setLiked] = useState(initialPost.liked);
  const [likesCount, setLikesCount] = useState(initialPost.likesCount);
  const [commentsCount, setCommentsCount] = useState(initialPost.commentsCount);
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [sending, setSending] = useState(false);

  const handleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount((c) => c + (newLiked ? 1 : -1));
    try {
      const res = await fetch(`/api/posts/${initialPost.id}/like`, { method: "POST", headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikesCount(data.likesCount);
      } else {
        setLiked(!newLiked);
        setLikesCount((c) => c + (newLiked ? -1 : 1));
      }
    } catch {
      setLiked(!newLiked);
      setLikesCount((c) => c + (newLiked ? -1 : 1));
    }
  };

  const handleToggleComments = async () => {
    if (!expanded && !commentsLoaded) {
      setCommentsLoading(true);
      try {
        const res = await fetch(`/api/posts/${initialPost.id}/comments`, { headers: authHeaders() });
        if (res.ok) {
          setComments(await res.json());
          setCommentsLoaded(true);
        }
      } finally {
        setCommentsLoading(false);
      }
    }
    setExpanded((v) => !v);
  };

  const handleCommentLike = async (commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, liked: !c.liked, likesCount: c.likesCount + (c.liked ? -1 : 1) }
          : c
      )
    );
    try {
      const res = await fetch(`/api/comments/${commentId}/like`, { method: "POST", headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, liked: data.liked, likesCount: data.likesCount } : c))
        );
      }
    } catch { /* ignore */ }
  };

  const handleSendComment = async () => {
    if (!commentInput.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/posts/${initialPost.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: commentInput.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, { ...newComment, username: "Você", displayName: null, likesCount: 0, liked: false }]);
        setCommentsCount((c) => c + 1);
        setCommentInput("");
        setCommentsLoaded(false); // force reload next time for accurate data
      }
    } finally {
      setSending(false);
    }
  };

  const authorName = initialPost.author.displayName || initialPost.author.username;

  return (
    <div className="rounded-2xl border border-border bg-card/70 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
              {authorName[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">{authorName}</p>
              <p className="text-xs text-muted-foreground">Nv {initialPost.author.level} · {timeAgo(initialPost.createdAt)}</p>
            </div>
          </div>
          {initialPost.sentimentLabel && (
            <span className="text-xs text-muted-foreground bg-secondary/50 rounded-full px-2 py-0.5">{initialPost.sentimentLabel}</span>
          )}
        </div>

        {/* Content */}
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{initialPost.content}</p>

        {/* AI comment */}
        {initialPost.aiComment && (
          <div className="mt-2 bg-primary/10 border-l-2 border-primary rounded-r px-3 py-2">
            <p className="text-xs font-semibold text-primary mb-0.5">🐝 BeeEyes</p>
            <p className="text-xs">{initialPost.aiComment}</p>
          </div>
        )}
      </div>

      {/* Actions bar */}
      <div className="px-4 py-2 border-t border-border/40 flex items-center gap-4">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${liked ? "text-red-500" : "text-muted-foreground hover:text-red-400"}`}
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
          {likesCount}
        </button>
        <button
          onClick={handleToggleComments}
          className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${expanded ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
        >
          <MessageCircle className="w-4 h-4" />
          {commentsCount}
        </button>
      </div>

      {/* Comments section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3 border-t border-border/40 pt-3">
              {commentsLoading && (
                <p className="text-xs text-muted-foreground text-center py-2">Carregando comentários...</p>
              )}

              {!commentsLoading && comments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-1">Sem comentários ainda. Seja o primeiro!</p>
              )}

              {comments.map((comment) => {
                const cName = comment.displayName || comment.username;
                return (
                  <div key={comment.id} className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {cName[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-secondary/50 rounded-2xl px-3 py-2">
                        <p className="text-xs font-semibold mb-0.5">{cName}</p>
                        <p className="text-xs leading-relaxed">{comment.content}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 pl-1">
                        <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                        <button
                          onClick={() => handleCommentLike(comment.id)}
                          className={`flex items-center gap-1 text-xs font-semibold transition-colors ${comment.liked ? "text-red-500" : "text-muted-foreground hover:text-red-400"}`}
                        >
                          <Heart className={`w-3 h-3 ${comment.liked ? "fill-current" : ""}`} />
                          {comment.likesCount > 0 && comment.likesCount}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Comment input */}
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Escreva um comentário..."
                  className="flex-1 h-8 text-xs"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendComment(); }}
                />
                <Button size="icon" className="h-8 w-8 shrink-0" disabled={!commentInput.trim() || sending} onClick={handleSendComment}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
