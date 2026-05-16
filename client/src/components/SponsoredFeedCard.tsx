import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, EyeOff, Flag, Heart, Info, MoreHorizontal, X } from "lucide-react";
import { WhyThisAdModal } from "./WhyThisAdModal";
import type { AdCampaign } from "@/lib/ads";
import { hideAd, loadAdPreferences } from "@/lib/adService";

interface SponsoredFeedCardProps {
  ad: AdCampaign;
  onDismiss?: (adId: string) => void;
}

export function SponsoredFeedCard({ ad, onDismiss }: SponsoredFeedCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [wishlistSaving, setWishlistSaving] = useState(false);
  const [wishlistFeedback, setWishlistFeedback] = useState("");
  const [savedToWishlist, setSavedToWishlist] = useState(false);

  if (dismissed) return null;

  const prefs = loadAdPreferences();
  const isPersonalized = prefs.allowPersonalizedAds;

  function dismiss(adId: string) {
    setDismissed(true);
    setShowMenu(false);
    onDismiss?.(adId);
  }

  function handleHide() {
    hideAd(ad.id);
    dismiss(ad.id);
  }

  function handleNotRelevant() {
    hideAd(ad.id);
    dismiss(ad.id);
  }

  function handleReport() {
    dismiss(ad.id);
  }

  function handleCta() {
    window.open(ad.targetUrl, "_blank", "noopener,noreferrer");
  }

  async function handleAddToWishlist() {
    if (savedToWishlist || wishlistSaving) return;
    setWishlistSaving(true);
    setWishlistFeedback("");
    try {
      const res = await fetch("/api/wishlist/items", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAdId: ad.id,
          sourceMessageId: null,
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
            surface: "feed",
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) setSavedToWishlist(true);
      setWishlistFeedback(data?.message ?? "Salvei na sua Lista de Desejos 🐝");
    } catch {
      setWishlistFeedback("Não consegui salvar agora. Tente novamente em instantes.");
    } finally {
      setWishlistSaving(false);
    }
  }

  const initials = ad.advertiserName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="bee-lift relative rounded-xl border border-primary/30 bg-card/88 overflow-hidden shadow-sm backdrop-blur-sm ring-1 ring-primary/10"
      data-testid="feed-sponsored-card"
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              {ad.advertiserLogo ? (
                <img
                  src={ad.advertiserLogo}
                  alt={ad.advertiserName}
                  className="w-10 h-10 rounded-full object-cover bg-muted"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold">
                  {initials || "AD"}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold leading-tight truncate">{ad.advertiserName}</p>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary tracking-wide uppercase">
                  Patrocinado
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Promovido</p>
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Opções do anúncio"
            >
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-9 z-50 min-w-[220px] rounded-xl border border-border bg-card shadow-lg py-1"
                  >
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
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <p className="text-sm font-bold text-foreground leading-snug">{ad.title}</p>
          <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">{ad.body}</p>
        </div>

        {ad.imageUrl ? (
          <button
            type="button"
            onClick={handleCta}
            className="mt-3 block w-full rounded-lg overflow-hidden border border-border/60 bg-black/5"
          >
            <img
              src={ad.imageUrl}
              alt={ad.title}
              className="w-full max-h-[420px] object-cover"
              loading="lazy"
            />
          </button>
        ) : null}
      </div>

      <div className="px-4 pb-3 pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <button
          onClick={handleCta}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          data-testid="feed-sponsored-cta"
        >
          {ad.ctaLabel}
          <ExternalLink className="w-4 h-4" />
        </button>
        <button
          onClick={handleAddToWishlist}
          disabled={wishlistSaving || savedToWishlist}
          className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-2.5 px-3 text-xs font-bold text-primary hover:bg-primary/15 transition-colors disabled:opacity-60"
          aria-label={savedToWishlist ? "Salvo na Lista de Desejos" : "Salvar na Lista de Desejos"}
        >
          <Heart className="w-4 h-4" fill={savedToWishlist ? "currentColor" : "none"} />
          <span className="hidden sm:inline">
            {savedToWishlist ? "Salvo" : wishlistSaving ? "Salvando..." : "Salvar"}
          </span>
        </button>
      </div>

      {wishlistFeedback ? (
        <div className="px-4 pb-3">
          <p className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] text-foreground">
            {wishlistFeedback}
          </p>
        </div>
      ) : null}

      <div className="px-4 pb-3 flex items-center justify-between border-t border-border/40 pt-2">
        <button
          onClick={() => setShowWhyModal(true)}
          className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          Por que estou vendo este anúncio?
        </button>
        <button
          onClick={handleHide}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Ocultar
        </button>
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
