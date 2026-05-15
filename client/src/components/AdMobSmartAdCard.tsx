import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, EyeOff, Flag, Heart, Info, Megaphone, MoreHorizontal, X } from "lucide-react";
import { WhyThisAdModal } from "./WhyThisAdModal";
import type { AdItem, AdMobAdFormat, SponsoredMessageMeta } from "@/lib/ads";

interface AdMobSmartAdCardProps {
  messageId: string;
  meta: SponsoredMessageMeta;
  onHide: (adId: string) => void;
  onNotRelevant: (adId: string) => void;
  onReport: (adId: string) => void;
}

const CHAT_FORMATS: AdMobAdFormat[] = ["banner", "adaptive_banner", "native", "native_image", "native_video"];
const FULLSCREEN_FORMATS: AdMobAdFormat[] = ["interstitial", "rewarded", "rewarded_interstitial", "app_open"];

function getAdFormat(ad: AdItem): AdMobAdFormat {
  if (ad.adFormat) return ad.adFormat;
  if (ad.videoUrl || ad.isVideo) return "native_video";
  if (ad.imageUrl) return "native_image";
  return "native";
}

function getDescription(ad: AdItem) {
  return ad.body ?? ad.description ?? "";
}

function getCta(ad: AdItem) {
  return ad.ctaLabel ?? ad.callToAction ?? "Ver anúncio";
}

function getTargetUrl(ad: AdItem) {
  return ad.targetUrl ?? ad.productUrl ?? "";
}

function getAvailability(ad: AdItem, saved: boolean, fallbackExpiresAt?: string) {
  if (saved) return "Salvo na Lista de Desejos.";
  const expiresAt = ad.expiresAt ?? fallbackExpiresAt;
  if (!expiresAt) return "Disponível por até 2 dias. Salve na Lista de Desejos para não perder.";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "Disponível por até 2 dias. Salve na Lista de Desejos para não perder.";
  return `Disponível até ${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Salve para não perder.`;
}

export function AdMobSmartAdCard({ messageId, meta, onHide, onNotRelevant, onReport }: AdMobSmartAdCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [wishlistSaving, setWishlistSaving] = useState<Record<string, boolean>>({});
  const [wishlistFeedback, setWishlistFeedback] = useState<Record<string, string>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const ad of meta.ads?.length ? meta.ads : [meta.ad]) {
      initial[ad.id] = ad.addedToWishlist === true || meta.addedToWishlist === true;
    }
    return initial;
  });

  const allAds = (meta.type === "sponsored_group" && meta.ads?.length ? meta.ads : [meta.ad])
    .filter((ad) => CHAT_FORMATS.includes(getAdFormat(ad)) && !FULLSCREEN_FORMATS.includes(getAdFormat(ad)))
    .filter((ad) => ad.addedToWishlist === true || (ad.status !== "expired" && ad.status !== "unavailable"))
    .slice(0, 3);
  const isGroup = allAds.length > 1;
  const primaryAd = allAds[0];

  if (dismissed || !primaryAd) return null;

  function authHeader(): Record<string, string> {
    const token = localStorage.getItem("bee_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function handleHide() {
    const impressionId = primaryAd.adImpressionId ?? meta.adImpressionId;
    if (impressionId) {
      fetch(`/api/ad-impressions/${impressionId}/hide`, { method: "POST", headers: authHeader() }).catch(() => {});
    }
    setDismissed(true);
    setShowMenu(false);
    onHide(primaryAd.id);
  }

  function handleCta(ad: AdItem) {
    const impressionId = ad.adImpressionId ?? meta.adImpressionId;
    if (impressionId) {
      fetch(`/api/ad-impressions/${impressionId}/click`, { method: "POST", headers: authHeader() }).catch(() => {});
    }
    const url = getTargetUrl(ad);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleAddToWishlist(ad: AdItem) {
    if (savedMap[ad.id]) {
      setWishlistFeedback((prev) => ({ ...prev, [ad.id]: "Esse item já está na sua Lista de Desejos." }));
      return;
    }
    setWishlistSaving((prev) => ({ ...prev, [ad.id]: true }));
    setWishlistFeedback((prev) => ({ ...prev, [ad.id]: "" }));
    try {
      const res = await fetch("/api/wishlist/items", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          sourceAdId: ad.id,
          sourceMessageId: messageId,
          sourceConversationId: meta.adGroupId ?? null,
          title: ad.title,
          description: getDescription(ad),
          imageUrl: ad.imageUrl,
          originalUrl: getTargetUrl(ad),
          category: ad.category,
          price: typeof ad.price === "number" ? ad.price : undefined,
          brand: ad.advertiserName,
          storeName: ad.advertiserName,
          sourceType: meta.adGroupId ? "sponsored_ad_group" : "sponsored_ad",
          metadata: {
            adFormat: getAdFormat(ad),
            adMobAdUnitId: ad.adMobAdUnitId,
            adImpressionId: ad.adImpressionId ?? meta.adImpressionId,
            adGroupId: meta.adGroupId,
            expiresAt: ad.expiresAt ?? meta.expiresAt,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) setSavedMap((prev) => ({ ...prev, [ad.id]: true }));
      setWishlistFeedback((prev) => ({ ...prev, [ad.id]: data?.message ?? "Prontinho! A Bee salvou esse anúncio na sua Lista de Desejos." }));
    } catch {
      setWishlistFeedback((prev) => ({ ...prev, [ad.id]: "Não consegui salvar agora. Tente novamente em instantes." }));
    } finally {
      setWishlistSaving((prev) => ({ ...prev, [ad.id]: false }));
    }
  }

  function renderMedia(ad: AdItem, compact = false) {
    const format = getAdFormat(ad);
    if (format === "native_video" && ad.videoUrl) {
      return (
        <video
          className={`w-full rounded-xl bg-muted object-cover ${compact ? "h-28" : "max-h-64"}`}
          src={ad.videoUrl}
          controls
          muted
          playsInline
          preload="metadata"
        />
      );
    }
    if (ad.imageUrl) {
      return <img src={ad.imageUrl} alt="" className={`w-full rounded-xl bg-muted object-cover ${compact ? "h-28" : "max-h-64"}`} loading="lazy" />;
    }
    if (format === "banner" || format === "adaptive_banner") {
      return (
        <div className="flex min-h-[72px] items-center justify-center rounded-xl border border-dashed border-primary/30 bg-primary/8 px-3 text-center text-xs font-semibold text-primary">
          Banner adaptativo
        </div>
      );
    }
    return (
      <div className="flex min-h-[96px] items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Megaphone className="h-6 w-6" />
      </div>
    );
  }

  function renderAd(ad: AdItem, compact = false) {
    const saved = savedMap[ad.id] === true;
    const saving = wishlistSaving[ad.id] === true;
    return (
      <div key={ad.id} className={`${compact ? "w-[220px] shrink-0" : "w-full"} rounded-2xl border border-border bg-card shadow-sm`}>
        <div className="space-y-2 p-3">
          {renderMedia(ad, compact)}
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">{ad.advertiserName || "Anunciante"}</p>
            <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">{ad.title}</p>
            {ad.price ? <p className="text-xs font-bold text-primary">{String(ad.price)}</p> : null}
            {!compact && getDescription(ad) ? <p className="text-xs leading-relaxed text-muted-foreground">{getDescription(ad)}</p> : null}
            <p className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {getAvailability(ad, saved, meta.expiresAt)}
            </p>
          </div>
          <div className={compact ? "grid grid-cols-2 gap-2" : "space-y-2"}>
            <button
              onClick={() => handleCta(ad)}
              className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
            >
              {compact ? "Ver" : getCta(ad)}
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleAddToWishlist(ad)}
              disabled={saving || saved}
              className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/15 disabled:opacity-60"
            >
              <Heart className="h-3.5 w-3.5" fill={saved ? "currentColor" : "none"} />
              {saved ? "Salvo" : saving ? "..." : compact ? "Salvar" : "Adicionar à Lista de Desejos"}
            </button>
          </div>
          {wishlistFeedback[ad.id] ? (
            <p className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] text-foreground">
              {wishlistFeedback[ad.id]}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.18, ease: "easeOut" }} className="mb-3 flex flex-col gap-2">
      <div className="flex items-end gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary shadow-sm ring-1 ring-primary/20 beeyes-glow">
          <img src="/beeyes-design/images/bee-icon.png" alt="Bee" className="h-full w-full object-cover" />
        </div>
        <div className="max-w-[82%] md:max-w-[70%] rounded-2xl rounded-tl-md bg-white px-4 py-2.5 shadow-lg ring-1 ring-[#E8DDC8] dark:bg-[#2D2D2D] dark:ring-white/10">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1A1A1A] dark:text-white">{meta.beeIntroMessage}</p>
        </div>
      </div>

      <div className="ml-10 max-w-[86%] md:max-w-[74%] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Patrocinado
          </span>
          {isGroup ? <span className="text-[11px] font-semibold text-muted-foreground">{meta.groupTitle || "Anúncios que podem te interessar"}</span> : null}
          <div className="relative ml-auto">
            <button onClick={() => setShowMenu(!showMenu)} className="rounded-lg p-1 hover:bg-muted" aria-label="Opções do anúncio">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-7 z-50 min-w-[210px] rounded-xl border border-border bg-card py-1 shadow-lg">
                  <button onClick={handleHide} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted">
                    <EyeOff className="h-3.5 w-3.5" /> Não quero ver este anúncio
                  </button>
                  <button onClick={() => { setDismissed(true); onNotRelevant(primaryAd.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted">
                    <X className="h-3.5 w-3.5" /> Não é relevante para mim
                  </button>
                  <button onClick={() => { setShowWhyModal(true); setShowMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted">
                    <Info className="h-3.5 w-3.5" /> Por que estou vendo isso?
                  </button>
                  <button onClick={() => { setDismissed(true); onReport(primaryAd.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive hover:bg-muted">
                    <Flag className="h-3.5 w-3.5" /> Reportar anúncio
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {isGroup ? (
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-3">{allAds.map((ad) => renderAd(ad, true))}</div>
          </div>
        ) : renderAd(primaryAd)}
      </div>

      {showWhyModal && (
        <WhyThisAdModal
          isPersonalized={meta.isPersonalized}
          advertiserName={primaryAd.advertiserName}
          onClose={() => setShowWhyModal(false)}
          onAdjustPreferences={() => setShowWhyModal(false)}
        />
      )}
    </motion.div>
  );
}
