import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, EyeOff, Flag, Heart, Info, MoreHorizontal, X } from "lucide-react";
import { WhyThisAdModal } from "./WhyThisAdModal";
import type { SponsoredMessageMeta } from "@/lib/ads";

interface SponsoredChatCardProps {
  messageId: string;
  meta: SponsoredMessageMeta;
  onHide: (adId: string) => void;
  onNotRelevant: (adId: string) => void;
  onReport: (adId: string) => void;
}

export function SponsoredChatCard({
  messageId,
  meta,
  onHide,
  onNotRelevant,
  onReport,
}: SponsoredChatCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [wishlistSaving, setWishlistSaving] = useState(false);
  const [wishlistFeedback, setWishlistFeedback] = useState("");
  const [savedToWishlist, setSavedToWishlist] = useState(meta.addedToWishlist === true);
  const { ad, beeIntroMessage, isPersonalized, adId } = meta;
  const expiresAt = meta.expiresAt ? new Date(meta.expiresAt) : null;
  const availabilityLabel = savedToWishlist
    ? "Salvo na Lista de Desejos."
    : expiresAt && !Number.isNaN(expiresAt.getTime())
      ? `Disponível até ${expiresAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${expiresAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Salve para não perder.`
      : "Disponível por até 2 dias. Salve na Lista de Desejos para não perder.";

  if (dismissed) return null;

  function handleHide() {
    if (meta.adImpressionId) {
      fetch(`/api/ad-impressions/${meta.adImpressionId}/hide`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
    setDismissed(true);
    setShowMenu(false);
    onHide(adId);
  }

  function handleNotRelevant() {
    setDismissed(true);
    setShowMenu(false);
    onNotRelevant(adId);
  }

  function handleReport() {
    setDismissed(true);
    setShowMenu(false);
    onReport(adId);
  }

  function handleCta() {
    if (meta.adImpressionId) {
      fetch(`/api/ad-impressions/${meta.adImpressionId}/click`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
    window.open(ad.targetUrl, "_blank", "noopener,noreferrer");
  }

  async function handleAddToWishlist() {
    if (savedToWishlist) {
      setWishlistFeedback("Esse produto já está na sua Lista de Desejos.");
      return;
    }
    setWishlistSaving(true);
    setWishlistFeedback("");
    try {
      const res = await fetch("/api/wishlist/items", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAdId: ad.id,
          sourceMessageId: messageId,
          sourceConversationId: null,
          title: ad.title,
          description: ad.body,
          originalUrl: ad.targetUrl,
          category: ad.category,
          brand: ad.advertiserName,
          storeName: ad.advertiserName,
          sourceType: "sponsored_ad",
          metadata: {
            topicKeywords: ad.topicKeywords,
            ctaLabel: ad.ctaLabel,
            adImpressionId: meta.adImpressionId,
            expiresAt: meta.expiresAt,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) setSavedToWishlist(true);
      setWishlistFeedback(data?.message ?? "Prontinho! Salvei isso na sua Lista de Desejos 🐝");
    } catch {
      setWishlistFeedback("Não consegui salvar agora. Tente novamente em instantes.");
    } finally {
      setWishlistSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="mb-3 flex flex-col gap-2"
    >
      {/* Bee intro bubble */}
      <div className="flex items-end gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary shadow-sm ring-1 ring-primary/20 beeyes-glow">
          <img src="/beeyes-design/images/bee-icon.png" alt="Bee" className="h-full w-full object-cover" />
        </div>
        <div className="max-w-[82%] md:max-w-[70%]">
          <div className="rounded-2xl rounded-tl-md bg-white px-4 py-2.5 shadow-lg ring-1 ring-[#E8DDC8] dark:bg-[#2D2D2D] dark:ring-white/10">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1A1A1A] dark:text-white">
              {beeIntroMessage}
            </p>
          </div>
        </div>
      </div>

      {/* Sponsored card */}
      <div className="ml-10 max-w-[82%] md:max-w-[70%] rounded-2xl border border-border bg-card shadow-sm overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-1 gap-2">
          <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary tracking-wide uppercase">
            Patrocinado
          </span>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-lg hover:bg-muted transition-colors"
              aria-label="Opções do anúncio"
            >
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
            {showMenu && (
              <>
                {/* Backdrop to close menu */}
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-7 z-50 min-w-[200px] rounded-xl border border-border bg-card shadow-lg py-1">
                  <button
                    onClick={handleHide}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left transition-colors"
                  >
                    <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    Não quero ver este anúncio
                  </button>
                  <button
                    onClick={handleNotRelevant}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left transition-colors"
                  >
                    <X className="w-3.5 h-3.5 shrink-0" />
                    Não é relevante para mim
                  </button>
                  <button
                    onClick={() => { setShowWhyModal(true); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left transition-colors"
                  >
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    Por que estou vendo isso?
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button
                    onClick={handleReport}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left text-destructive transition-colors"
                  >
                    <Flag className="w-3.5 h-3.5 shrink-0" />
                    Reportar anúncio
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Ad content */}
        <div className="px-3 pb-2 space-y-1">
          <p className="text-[11px] text-muted-foreground">{ad.advertiserName}</p>
          <p className="text-sm font-bold text-foreground leading-snug">{ad.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{ad.body}</p>
          <p className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {availabilityLabel}
          </p>
        </div>

        {/* CTA button */}
        <div className="px-3 pb-3 space-y-2">
          <button
            onClick={handleCta}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {ad.ctaLabel}
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleAddToWishlist}
            disabled={wishlistSaving || savedToWishlist}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-2.5 text-xs font-bold text-primary hover:bg-primary/15 transition-colors disabled:opacity-60"
          >
            <Heart className="w-3.5 h-3.5" fill={savedToWishlist ? "currentColor" : "none"} />
            {wishlistSaving ? "Salvando..." : "Adicionar à Lista de Desejos"}
          </button>
          {wishlistFeedback ? (
            <p className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] text-foreground">
              {wishlistFeedback}
            </p>
          ) : null}
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-between px-3 pb-3">
          <button
            onClick={handleHide}
            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Não quero ver isso
          </button>
          <button
            onClick={() => setShowWhyModal(true)}
            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Por que estou vendo?
          </button>
        </div>
      </div>

      {showWhyModal && (
        <WhyThisAdModal
          isPersonalized={isPersonalized}
          advertiserName={ad.advertiserName}
          onClose={() => setShowWhyModal(false)}
          onAdjustPreferences={() => setShowWhyModal(false)}
        />
      )}
    </motion.div>
  );
}
