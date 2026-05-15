import { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert, ScrollView } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { router } from "expo-router";
import { api } from "@mobile/lib/api";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";
import { WhyThisAdModal } from "./WhyThisAdModal";
import type { AdItem, AdMobAdFormat, SponsoredMessageMeta } from "@mobile/lib/ads";

interface AdMobSmartAdCardProps {
  messageId: string;
  meta: SponsoredMessageMeta;
  onHide: (adId: string) => void;
  onNotRelevant: (adId: string) => void;
  onReport: (adId: string) => void;
}

const CHAT_FORMATS: AdMobAdFormat[] = ["banner", "adaptive_banner", "native", "native_image", "native_video"];

function getAdFormat(ad: AdItem): AdMobAdFormat {
  if (ad.adFormat) return ad.adFormat;
  if (ad.videoUrl || ad.isVideo) return "native_video";
  if (ad.imageUrl) return "native_image";
  return "native";
}

function getDescription(ad: AdItem) {
  return ad.description ?? ad.body ?? "";
}

function getCta(ad: AdItem) {
  return ad.callToActionText ?? ad.ctaLabel ?? "Ver anúncio";
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
  const themeMode = useUIStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [showMenu, setShowMenu] = useState(false);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const ad of meta.ads?.length ? meta.ads : [meta.ad]) initial[ad.id] = ad.addedToWishlist === true || meta.addedToWishlist === true;
    return initial;
  });

  const ads = (meta.type === "sponsored_group" && meta.ads?.length ? meta.ads : [meta.ad])
    .filter((ad) => CHAT_FORMATS.includes(getAdFormat(ad)))
    .filter((ad) => ad.addedToWishlist === true || (ad.status !== "expired" && ad.status !== "unavailable"))
    .slice(0, 3);
  const primaryAd = ads[0];
  const isGroup = ads.length > 1;

  if (hidden || !primaryAd) return null;

  function handleCtaPress(ad: AdItem) {
    const impressionId = ad.adImpressionId ?? meta.adImpressionId;
    if (impressionId) api.post(`/api/ad-impressions/${impressionId}/click`).catch(() => {});
    const url = getTargetUrl(ad);
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert("Não foi possível abrir o link."));
  }

  function handleHide() {
    const impressionId = primaryAd.adImpressionId ?? meta.adImpressionId;
    if (impressionId) api.post(`/api/ad-impressions/${impressionId}/hide`).catch(() => {});
    setShowMenu(false);
    setHidden(true);
    onHide(primaryAd.id);
  }

  async function handleAddToWishlist(ad: AdItem) {
    if (saving[ad.id]) return;
    if (saved[ad.id]) {
      setFeedback((prev) => ({ ...prev, [ad.id]: "Esse item já está na sua Lista de Desejos." }));
      return;
    }
    setSaving((prev) => ({ ...prev, [ad.id]: true }));
    setFeedback((prev) => ({ ...prev, [ad.id]: "" }));
    try {
      const response = await api.post("/api/wishlist/items", {
        sourceAdId: ad.id,
        sourceMessageId: messageId,
        sourceConversationId: meta.adGroupId ?? null,
        title: ad.title,
        description: getDescription(ad),
        imageUrl: ad.imageUrl,
        originalUrl: getTargetUrl(ad),
        category: ad.category,
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
      });
      setSaved((prev) => ({ ...prev, [ad.id]: true }));
      setFeedback((prev) => ({ ...prev, [ad.id]: response.data?.message ?? "Prontinho! A Bee salvou esse anúncio na sua Lista de Desejos." }));
    } catch {
      setFeedback((prev) => ({ ...prev, [ad.id]: "Não consegui salvar agora. Tente de novo em instantes." }));
    } finally {
      setSaving((prev) => ({ ...prev, [ad.id]: false }));
    }
  }

  function renderMedia(ad: AdItem, compact = false) {
    const format = getAdFormat(ad);
    if (format === "native_video" && ad.videoUrl) {
      return (
        <Video
          source={{ uri: ad.videoUrl }}
          style={[styles.media, compact && styles.mediaCompact]}
          resizeMode={ResizeMode.COVER}
          useNativeControls
          shouldPlay={false}
          isMuted
        />
      );
    }
    if (ad.imageUrl) return <Image source={{ uri: ad.imageUrl }} style={[styles.media, compact && styles.mediaCompact]} resizeMode="cover" />;
    if (format === "banner" || format === "adaptive_banner") {
      return (
        <View style={[styles.bannerMedia, compact && styles.mediaCompact]}>
          <Text style={styles.bannerMediaText}>Banner adaptativo</Text>
        </View>
      );
    }
    return (
      <View style={[styles.bannerMedia, compact && styles.mediaCompact]}>
        <Feather name="star" size={22} color={colors.primaryDark} />
      </View>
    );
  }

  function renderAd(ad: AdItem, compact = false) {
    const isSaved = saved[ad.id] === true;
    return (
      <View key={ad.id} style={[styles.card, compact && styles.compactCard]}>
        {renderMedia(ad, compact)}
        <Text style={styles.advertiserName}>{ad.advertiserName || "Anunciante"}</Text>
        <Text style={styles.adTitle} numberOfLines={2}>{ad.title}</Text>
        {ad.price ? <Text style={styles.price}>{String(ad.price)}</Text> : null}
        {!compact && getDescription(ad) ? <Text style={styles.adDescription}>{getDescription(ad)}</Text> : null}
        <Text style={styles.availabilityText}>{getAvailability(ad, isSaved, meta.expiresAt)}</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => handleCtaPress(ad)} activeOpacity={0.8}>
            <Text style={styles.ctaBtnText}>{compact ? "Ver" : getCta(ad)}</Text>
            <Feather name="external-link" size={13} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.wishlistBtn} onPress={() => handleAddToWishlist(ad)} disabled={saving[ad.id] || isSaved} activeOpacity={0.75}>
            <Feather name="heart" size={13} color={colors.primaryDark} />
            <Text style={styles.wishlistBtnText}>{isSaved ? "Salvo" : saving[ad.id] ? "..." : compact ? "Salvar" : "Adicionar à Lista"}</Text>
          </TouchableOpacity>
        </View>
        {feedback[ad.id] ? <Text style={styles.wishlistFeedback}>{feedback[ad.id]}</Text> : null}
      </View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(260)} style={styles.wrapper}>
      <View style={styles.beeRow}>
        <Image source={require("../assets/beeyes-design/bee-icon.png")} style={styles.beeAvatar} />
        <View style={styles.beeBubble}>
          <Text style={styles.beeText}>{meta.beeIntroMessage}</Text>
        </View>
      </View>

      <View style={styles.headerRow}>
        <View style={styles.sponsoredBadge}>
          <Feather name="star" size={10} color={colors.primaryDark} />
          <Text style={styles.sponsoredText}>Patrocinado</Text>
        </View>
        {isGroup ? <Text style={styles.groupTitle}>{meta.groupTitle || "Anúncios que podem te interessar"}</Text> : null}
        <TouchableOpacity onPress={() => setShowMenu((v) => !v)} style={styles.menuBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="more-horizontal" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {showMenu && (
        <View style={styles.menuSheet}>
          {[
            { icon: "eye-off", label: "Ocultar anúncio", action: handleHide },
            { icon: "thumbs-down", label: "Não é relevante", action: () => { setHidden(true); onNotRelevant(primaryAd.id); } },
            { icon: "flag", label: "Denunciar anúncio", action: () => onReport(primaryAd.id) },
            { icon: "info", label: "Por que estou vendo isso?", action: () => { setShowMenu(false); setShowWhyModal(true); } },
            { icon: "sliders", label: "Ajustar preferências", action: () => { setShowMenu(false); router.push("/ad-settings" as never); } },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.action} activeOpacity={0.7}>
              <Feather name={item.icon as any} size={14} color={item.label.startsWith("Denunciar") ? colors.destructive : colors.foreground} />
              <Text style={[styles.menuItemText, item.label.startsWith("Denunciar") && { color: colors.destructive }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isGroup ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupScroller}>
          {ads.map((ad) => renderAd(ad, true))}
        </ScrollView>
      ) : renderAd(primaryAd)}

      <WhyThisAdModal visible={showWhyModal} isPersonalized={meta.isPersonalized} advertiserName={primaryAd.advertiserName} onClose={() => setShowWhyModal(false)} onAdjustPreferences={() => setShowWhyModal(false)} />
    </Animated.View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    wrapper: { marginVertical: 8, gap: 6 },
    beeRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, maxWidth: "88%" },
    beeAvatar: { width: 28, height: 28, borderRadius: 14 },
    beeBubble: { backgroundColor: colors.card, borderRadius: 18, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, flex: 1 },
    beeText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, lineHeight: 19 },
    headerRow: { marginHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
    sponsoredBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary + "22", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.primary + "44" },
    sponsoredText: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "800", color: colors.primaryDark, textTransform: "uppercase" },
    groupTitle: { flex: 1, fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.muted },
    menuBtn: { marginLeft: "auto", padding: 4 },
    menuSheet: { marginHorizontal: 16, backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 6, gap: 2, elevation: 8 },
    menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
    menuItemText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground },
    groupScroller: { gap: 10, paddingHorizontal: 16, paddingVertical: 2 },
    card: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1.5, borderColor: colors.primary + "55", padding: 14, gap: 8, elevation: 3 },
    compactCard: { width: 238, marginHorizontal: 0 },
    media: { width: "100%", height: 150, borderRadius: 12, backgroundColor: colors.background },
    mediaCompact: { height: 120 },
    bannerMedia: { width: "100%", height: 88, borderRadius: 12, borderWidth: 1, borderColor: colors.primary + "33", backgroundColor: colors.primary + "12", alignItems: "center", justifyContent: "center" },
    bannerMediaText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "800", color: colors.primaryDark },
    advertiserName: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted },
    adTitle: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: colors.foreground },
    price: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "800", color: colors.primaryDark },
    adDescription: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted, lineHeight: 19 },
    availabilityText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, backgroundColor: colors.primary + "12", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, lineHeight: 16 },
    actionRow: { flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" },
    ctaBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
    ctaBtnText: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "800", color: "#000" },
    wishlistBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary + "18", borderRadius: 12, borderWidth: 1, borderColor: colors.primary + "44", paddingHorizontal: 12, paddingVertical: 10 },
    wishlistBtnText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "800", color: colors.primaryDark },
    wishlistFeedback: { fontFamily: FONTS.sans, fontSize: 12, color: colors.primaryDark, backgroundColor: colors.primary + "12", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  });
}
