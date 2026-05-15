import { useState, useRef, useEffect } from "react";
import { ThumbsDown, ThumbsUp, Share2, Loader2, Check } from "lucide-react";

export type FeedbackType = "like" | "dislike";

export const DISLIKE_REASONS: Array<{ value: string; label: string }> = [
  { value: "too_long", label: "Resposta muito longa" },
  { value: "confusing", label: "Resposta confusa" },
  { value: "not_what_i_wanted", label: "Não era o que eu queria" },
  { value: "inappropriate_tone", label: "Tom inadequado" },
  { value: "incomplete", label: "Informação incompleta" },
  { value: "other", label: "Outro motivo" },
];

interface MessageFeedbackProps {
  current: FeedbackType | null;
  busy?: boolean;
  onLike: () => void;
  onDislike: (reason?: string) => void;
  onUndo: () => void;
  onSendToFeed: () => void;
}

export function MessageFeedback({
  current,
  busy,
  onLike,
  onDislike,
  onUndo,
  onSendToFeed,
}: MessageFeedbackProps) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!reasonOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setReasonOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [reasonOpen]);

  const liked = current === "like";
  const disliked = current === "dislike";

  function handleLikeClick() {
    if (busy) return;
    if (liked) {
      onUndo();
    } else {
      onLike();
    }
  }

  function handleDislikeClick() {
    if (busy) return;
    if (disliked) {
      onUndo();
      setReasonOpen(false);
    } else {
      setReasonOpen((v) => !v);
    }
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={handleLikeClick}
        disabled={busy}
        aria-pressed={liked}
        aria-label={liked ? "Desfazer curtida" : "Curtir resposta"}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
          liked
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : "border-border bg-card/80 text-muted-foreground hover:text-foreground"
        }`}
      >
        {busy && !disliked ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : liked ? (
          <Check className="h-3 w-3" />
        ) : (
          <ThumbsUp className="h-3 w-3" />
        )}
        {liked ? "Curtido" : "Curtir"}
      </button>

      <button
        type="button"
        onClick={handleDislikeClick}
        disabled={busy}
        aria-pressed={disliked}
        aria-haspopup="menu"
        aria-expanded={reasonOpen}
        aria-label={disliked ? "Desfazer não curti" : "Não curti resposta"}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
          disliked
            ? "border-destructive/40 bg-destructive/15 text-destructive"
            : "border-border bg-card/80 text-muted-foreground hover:text-foreground"
        }`}
      >
        {busy && disliked ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ThumbsDown className="h-3 w-3" />
        )}
        {disliked ? "Não curti" : "Não curti"}
      </button>

      <button
        type="button"
        onClick={onSendToFeed}
        disabled={busy}
        aria-label="Enviar para o Feed"
        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/15 transition-colors"
      >
        <Share2 className="h-3 w-3" />
        Enviar para o Feed
      </button>

      {reasonOpen && !disliked ? (
        <div
          ref={popRef}
          role="menu"
          aria-label="Motivos para não curtir"
          className="absolute left-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-border bg-card p-2 shadow-lg"
        >
          <p className="px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            O que faltou?
          </p>
          {DISLIKE_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                onDislike(r.value);
                setReasonOpen(false);
              }}
              className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted/60 transition-colors"
              role="menuitem"
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
