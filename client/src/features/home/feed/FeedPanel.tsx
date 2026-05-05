import { Camera, Heart, Image, MessageCircle, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, UserPlus, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ConnectionSuggestion, FeedPost, User } from "@/features/home/types";

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
  postImageUrl: string;
  pickingPostImage: boolean;
  isPosting: boolean;
  showPostInput: boolean;
  suggestions: ConnectionSuggestion[];
  connectingIds: Set<string>;
  currentUser: User | null;
  onLoadFeed: () => void;
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
  timeAgo: (value: string | Date) => string;
}

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
      <div className="space-y-2 mt-1">
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
    <div className="relative" ref={menuRef}>
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

export function FeedPanel(props: FeedPanelProps) {
  const {
    feed,
    feedLoading,
    postText,
    postImageUrl,
    pickingPostImage,
    isPosting,
    showPostInput,
    suggestions,
    connectingIds,
    currentUser,
    onLoadFeed,
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
        <div className="border-b bg-card">
          <Textarea
            value={postText}
            onChange={(event) => onPostTextChange(event.target.value)}
            placeholder="O que você está pensando?"
            className="resize-none text-sm min-h-[90px] border-0 rounded-none focus-visible:ring-0 px-4 pt-4 pb-2"
            maxLength={500}
            data-testid="feed-post-input"
          />

          {postImageUrl && (
            <div className="relative mx-4 mb-2 overflow-hidden rounded-xl border border-border">
              <img src={postImageUrl} alt="Prévia da foto" className="w-full max-h-80 object-contain bg-black/5" />
              <button type="button" onClick={onRemovePostImage}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors">
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 rounded-lg px-2 py-1">
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
                disabled={(!postText.trim() && !postImageUrl) || isPosting}
                onClick={onCreatePost}
                className="bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold"
                data-testid="feed-submit-post">
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
          const isOwner = currentUser?.id === post.author.id;
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
                {isOwner && (
                  <PostMenu
                    postId={post.id}
                    content={post.content}
                    onEdit={onEditPost}
                    onDelete={onDeletePost}
                  />
                )}
              </div>
              <p className="text-sm leading-relaxed">{post.content}</p>
              {post.imageUrl && <img src={post.imageUrl} alt="Imagem da publicacao" className="w-full max-h-[480px] rounded-xl object-contain bg-black/5 border border-border/40" loading="lazy" />}
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
