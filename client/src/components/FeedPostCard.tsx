import { useState, useRef, useEffect } from "react";
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/UserAvatar";
import { motion, AnimatePresence } from "framer-motion";

interface Author {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
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
  avatarUrl?: string | null;
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
    imageUrl?: string | null;
    aiComment?: string | null;
    sentimentLabel?: string | null;
    sentiment?: string | null;
  };
  authHeaders: () => Record<string, string>;
  timeAgo: (date: string) => string;
  isOwner?: boolean;
  onEdit?: (postId: string, content: string) => Promise<void>;
  onDelete?: (postId: string) => Promise<void>;
  onOpenProfile?: (userId: string) => void;
}

const SENTIMENT_COLOR: Record<string, string> = {
  happy: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  motivated: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  tired: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  sad: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  excited: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  proud: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  neutral: "bg-secondary text-muted-foreground",
};

function PostMenu({ postId, content, onEdit, onDelete }: {
  postId: string;
  content: string;
  onEdit: (postId: string, content: string) => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSaveEdit() {
    if (!editText.trim() || editText.trim() === content) { setEditing(false); return; }
    setSaving(true);
    try {
      await onEdit(postId, editText.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Apagar este post?")) return;
    setDeleting(true);
    try {
      await onDelete(postId);
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-2 mt-1 absolute inset-0 z-10 bg-card p-4 rounded-xl border border-border">
        <Textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="text-sm min-h-[80px] resize-none"
          maxLength={500}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSaveEdit} disabled={saving || !editText.trim()}
            className="bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[140px]">
          <button
            onClick={() => { setOpen(false); setEditText(content); setEditing(true); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-secondary transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar post
          </button>
          <button
            onClick={() => { setOpen(false); handleDelete(); }}
            disabled={deleting}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? "Apagando..." : "Apagar post"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function FeedPostCard({ post: initialPost, authHeaders, timeAgo, isOwner, onEdit, onDelete, onOpenProfile }: FeedPostCardProps) {
  const [liked, setLiked] = useState(initialPost.liked);
  const [likesCount, setLikesCount] = useState(initialPost.likesCount);
  const [commentsCount, setCommentsCount] = useState(initialPost.commentsCount);
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [sending, setSending] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);

  const handleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount((c) => c + (newLiked ? 1 : -1));
    if (newLiked) {
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 400);
    }
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
        setCommentsLoaded(false);
      }
    } finally {
      setSending(false);
    }
  };

  const authorName = initialPost.author.displayName || initialPost.author.username;
  const sentimentClass = SENTIMENT_COLOR[initialPost.sentiment ?? "neutral"] ?? SENTIMENT_COLOR.neutral;

  return (
    <div className="bee-lift relative rounded-xl border border-border/70 bg-card/88 overflow-hidden shadow-sm backdrop-blur-sm">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={() => onOpenProfile?.(initialPost.author.id)} className="flex items-center gap-3 min-w-0 text-left">
            <UserAvatar name={authorName} avatarUrl={initialPost.author.avatarUrl} className="w-9 h-9 shadow-sm shrink-0" fallbackClassName="bg-primary text-primary-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate hover:underline">{authorName}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{timeAgo(initialPost.createdAt)}</p>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            {initialPost.sentimentLabel && (
              <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${sentimentClass}`}>
                {initialPost.sentimentLabel}
              </span>
            )}
            {isOwner && onEdit && onDelete && (
              <PostMenu
                postId={initialPost.id}
                content={initialPost.content}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}
          </div>
        </div>

        {/* Content */}
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
          {initialPost.content}
        </p>

        {initialPost.imageUrl && (
          <img
            src={initialPost.imageUrl}
            alt="Imagem da publicacao"
            className="mt-3 w-full max-h-[480px] rounded-lg object-contain bg-black/5 border border-border/50"
            loading="lazy"
          />
        )}

        {/* AI comment */}
        {initialPost.aiComment && (
          <div className="mt-3 rounded-lg bg-primary/10 border border-primary/25 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base leading-none">🐝</span>
              <p className="text-xs font-bold text-primary">BeeEyes</p>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">{initialPost.aiComment}</p>
          </div>
        )}
      </div>

      {/* Actions bar */}
      <div className="px-4 py-2.5 border-t border-border/50 flex items-center gap-1">
        {/* Like */}
        <motion.button
          onClick={handleLike}
          whileTap={{ scale: 0.85 }}
          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors ${
            liked
              ? "text-red-500 bg-red-50 dark:bg-red-950/40"
              : "text-muted-foreground hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
          }`}
        >
          <motion.div
            animate={likeAnim ? { scale: [1, 1.5, 0.9, 1.1, 1] } : {}}
            transition={{ duration: 0.35 }}
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
          </motion.div>
          <span>{likesCount > 0 ? likesCount : ""}</span>
        </motion.button>

        {/* Comment */}
        <button
          onClick={handleToggleComments}
          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors ${
            expanded
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-primary hover:bg-primary/8"
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{commentsCount > 0 ? commentsCount : ""}</span>
        </button>

        {/* Share */}
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ text: initialPost.content }).catch(() => {});
            }
          }}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Spacer + Bookmark */}
        <div className="flex-1" />
        <button
          onClick={() => setBookmarked((v) => !v)}
          className={`flex items-center px-2.5 py-1.5 rounded-full transition-colors ${
            bookmarked
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-primary hover:bg-primary/8"
          }`}
        >
          <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Comments section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3 bg-secondary/20">
              {commentsLoading && (
                <div className="space-y-2 py-1">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-2 animate-pulse">
                      <div className="w-6 h-6 rounded-full bg-secondary shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-secondary rounded-full w-24" />
                        <div className="h-2.5 bg-secondary rounded-full w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!commentsLoading && comments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Sem comentários ainda. Seja o primeiro! ✨
                </p>
              )}

              {comments.map((comment) => {
                const cName = comment.displayName || comment.username;
                return (
                  <div key={comment.id} className="flex gap-2">
                    <button type="button" onClick={() => onOpenProfile?.(comment.userId)} className="mt-0.5">
                      <UserAvatar name={cName} avatarUrl={comment.avatarUrl} className="w-6 h-6" fallbackClassName="bg-secondary text-foreground" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="bg-card rounded-2xl px-3 py-2 shadow-sm border border-border/40">
                        <button type="button" onClick={() => onOpenProfile?.(comment.userId)} className="text-xs font-semibold mb-0.5 hover:underline">{cName}</button>
                        <p className="text-xs leading-relaxed text-foreground/85">{comment.content}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 pl-1">
                        <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                        <button
                          onClick={() => handleCommentLike(comment.id)}
                          className={`flex items-center gap-1 text-xs font-semibold transition-colors ${
                            comment.liked ? "text-red-500" : "text-muted-foreground hover:text-red-400"
                          }`}
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
                  className="flex-1 h-9 text-xs rounded-full"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendComment(); }}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full shrink-0"
                  disabled={!commentInput.trim() || sending}
                  onClick={handleSendComment}
                >
                  <Share2 className="w-3.5 h-3.5 rotate-45" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
