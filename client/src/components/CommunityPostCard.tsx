import { useState } from "react";
import { Heart, MessageCircle, Share2, Send, ChevronUp, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { motion, AnimatePresence } from "framer-motion";

interface CommunityComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  likesCount: number;
  liked: boolean;
}

interface CommunityPostCardProps {
  post: {
    id: string;
    communityId: string;
    content: string;
    createdAt: string;
    username: string;
    displayName: string | null;
    avatarUrl?: string | null;
    likesCount: number;
    liked: boolean;
    commentsCount: number;
    imageUrl?: string | null;
    userId?: string;
  };
  communityName: string;
  communityEmoji: string;
  authHeaders: () => Record<string, string>;
  timeAgo: (date: string | Date) => string;
  isOwner?: boolean;
  onDelete?: (postId: string) => Promise<void>;
  onOpenProfile?: (userId: string) => void;
}

export default function CommunityPostCard({ post: initialPost, communityName, communityEmoji, authHeaders, timeAgo, isOwner = false, onDelete, onOpenProfile }: CommunityPostCardProps) {
  const [liked, setLiked] = useState(initialPost.liked);
  const [likesCount, setLikesCount] = useState(initialPost.likesCount);
  const [commentsCount, setCommentsCount] = useState(initialPost.commentsCount);
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [recommended, setRecommended] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const authorName = initialPost.displayName || initialPost.username || "Usuário";

  const handleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount((c) => c + (newLiked ? 1 : -1));
    try {
      const res = await fetch(`/api/communities/posts/${initialPost.id}/like`, { method: "POST", headers: authHeaders() });
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
        const res = await fetch(`/api/communities/posts/${initialPost.id}/comments`, { headers: authHeaders() });
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
      prev.map((c) => c.id === commentId ? { ...c, liked: !c.liked, likesCount: c.likesCount + (c.liked ? -1 : 1) } : c)
    );
    try {
      const res = await fetch(`/api/communities/comments/${commentId}/like`, { method: "POST", headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, liked: data.liked, likesCount: data.likesCount } : c));
      }
    } catch { /* ignore */ }
  };

  const handleSendComment = async () => {
    if (!commentInput.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/communities/posts/${initialPost.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: commentInput.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setCommentsCount((c) => c + 1);
        setCommentInput("");
      }
    } finally {
      setSending(false);
    }
  };

  const handleRecommend = async () => {
    if (recommending || recommended) return;
    setRecommending(true);
    try {
      const res = await fetch(`/api/communities/posts/${initialPost.id}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          communityId: initialPost.communityId,
          communityName,
          communityEmoji,
          content: initialPost.content,
        }),
      });
      if (res.ok) setRecommended(true);
    } finally {
      setRecommending(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || deleting) return;
    if (!window.confirm("Apagar esta mensagem da comunidade?")) return;
    setDeleting(true);
    try {
      await onDelete(initialPost.id);
    } finally {
      setDeleting(false);
      setMenuOpen(false);
    }
  };

  return (
    <div className="bg-secondary/30 rounded-xl overflow-hidden" data-testid={`community-post-card-${initialPost.id}`}>
      {/* Header + Content */}
      <div className="p-4 space-y-2">
        <div className="flex items-start gap-2">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => initialPost.userId && onOpenProfile?.(initialPost.userId)}>
            <UserAvatar name={authorName} avatarUrl={initialPost.avatarUrl} className="w-7 h-7" fallbackClassName="bg-primary text-primary-foreground" />
            <div className="min-w-0">
              <p className="text-xs font-semibold hover:underline truncate">{authorName}</p>
              <p className="text-xs text-muted-foreground">{timeAgo(initialPost.createdAt)}</p>
            </div>
          </button>
          {isOwner && onDelete ? (
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((value) => !value)} className="rounded-full p-1.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Opções do post">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-border bg-card p-1 shadow-xl">
                  <button type="button" onClick={handleDelete} disabled={deleting} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" />
                    {deleting ? "Apagando..." : "Apagar"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="text-sm leading-relaxed">{initialPost.content}</p>
        {initialPost.imageUrl && (
          <img
            src={initialPost.imageUrl}
            alt="Imagem da publicação na comunidade"
            className="w-full max-h-[480px] rounded-xl object-contain bg-black/5 border border-border/40"
          />
        )}
      </div>

      {/* Actions bar */}
      <div className="px-4 py-2 border-t border-border/20 flex items-center gap-4">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${liked ? "text-red-500" : "text-muted-foreground hover:text-red-400"}`}
          aria-label={liked ? "Descurtir publicação" : "Curtir publicação"}
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
          {likesCount > 0 && likesCount}
        </button>

        <button
          onClick={handleToggleComments}
          className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${expanded ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          data-testid={`community-comments-toggle-${initialPost.id}`}
          aria-label={expanded ? "Ocultar comentários" : "Comentar"}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
          {commentsCount > 0 ? commentsCount : "Comentar"}
        </button>

        <button
          onClick={handleRecommend}
          disabled={recommending || recommended}
          className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ml-auto ${recommended ? "text-green-500" : "text-muted-foreground hover:text-primary"}`}
          aria-label={recommended ? "Recomendado" : "Recomendar publicação"}
        >
          <Share2 className="w-4 h-4" />
          {recommended ? "Recomendado!" : recommending ? "..." : "Recomendar"}
        </button>
      </div>

      {/* Comments accordion */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 border-t border-border/20 space-y-3">
              {commentsLoading && (
                <p className="text-xs text-muted-foreground text-center py-1">Carregando comentários...</p>
              )}
              {!commentsLoading && comments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-1">Nenhum comentário ainda.</p>
              )}
              {comments.map((comment) => {
                const cName = comment.displayName || comment.username;
                return (
                  <div key={comment.id} className="flex gap-2">
                    <button type="button" onClick={() => onOpenProfile?.(comment.userId)} className="mt-0.5">
                      <UserAvatar name={cName} avatarUrl={comment.avatarUrl} className="w-6 h-6" fallbackClassName="bg-secondary text-foreground" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="bg-background/60 rounded-2xl px-3 py-2">
                        <button type="button" onClick={() => onOpenProfile?.(comment.userId)} className="text-xs font-semibold mb-0.5 hover:underline">{cName}</button>
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

              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Escreva um comentário..." data-testid={`community-comment-input-${initialPost.id}`}
                  className="flex-1 h-8 text-xs"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendComment(); }}
                />
                <Button size="icon" className="h-8 w-8 shrink-0" disabled={!commentInput.trim() || sending} onClick={handleSendComment} data-testid={`community-comment-submit-${initialPost.id}`}>
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
