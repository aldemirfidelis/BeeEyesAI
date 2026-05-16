import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert, Modal, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { api } from "@mobile/lib/api";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";
import { hideAd, loadAdPreferences } from "@mobile/lib/adService";
import { WhyThisAdModal } from "./WhyThisAdModal";
import type { AdCampaign } from "@mobile/lib/ads";

interface SponsoredFeedCardProps {
  ad: AdCampaign;
  onDismiss?: (adId: string) => void;
}

export function SponsoredFeedCard({ ad, onDismiss }: SponsoredFeedCardProps) {
  const themeMode = useUIStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);

  const [showMenu, setShowMenu] = useState(false);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [wishlistSaving, setWishlistSaving] = useState(false);
  const [wishlistFeedback, setWishlistFeedback] = useState("");
  const [savedToWishlist, setSavedToWishlist] = useState(false);
  const [isPersonalized, setIsPersonalized] = useState(false);

  if (hidden) return null;

  function handleCtaPress() {
    if (!ad.targetUrl) return;
    Linking.openURL(ad.targetUrl).catch(() => Alert.alert("Não foi possível abrir o link."));
  }

  async function handleHide() {
    setShowMenu(false);
    await hideAd(ad.id);
    setHidden(true);
    onDismiss?.(ad.id);
  }

  async function handleNotRelevant() {
    setShowMenu(false);
    await hideAd(ad.id);
    setHidden(true);
    onDismiss?.(ad.id);
  }

  function handleReport() {
    setShowMenu(false);
    Alert.alert(
      "Denunciar anúncio",
      "Obrigado por nos avisar. Vamos revisar esse anúncio.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Denunciar",
          style: "destructive",
          onPress: () => {
            setHidden(true);
            onDismiss?.(ad.id);
          },
        },
      ],
    );
  }

  async function openWhyModal() {
    const prefs = await loadAdPreferences();
    setIsPersonalized(prefs.allowPersonalizedAds);
    setShowWhyModal(true);
  }

  function handleAdjustPreferences() {
    setShowWhyModal(false);
    router.push("/ad-settings" as never);
  }

  async function handleAddToWishlist() {
    if (wishlistSaving) return;
    if (savedToWishlist) {
      setWishlistFeedback("Esse produto já está na sua Lista de Desejos.");
      return;
    }
    setWishlistSaving(true);
    setWishlistFeedback("");
    try {
      const response = await api.post("/api/wishlist/items", {
        sourceAdId: ad.id,
        sourceMessageId: null,
        sourceConversationId: null,
        title: ad.title,
        description: ad.description,
        imageUrl: ad.imageUrl,
        originalUrl: ad.targetUrl,
        category: ad.category,
        brand: ad.advertiserName,
        storeName: ad.advertiserName,
        sourceType: "sponsored_ad",
        metadata: {
          tags: ad.tags ?? [],
          callToActionText: ad.callToActionText,
          surface: "feed",
        },
      });
      const data = response.data;
      setSavedToWishlist(true);
      setWishlistFeedback(
        data?.message ??
          (data?.alreadyExists
            ? "Esse item já está na sua Lista de Desejos."
            : "Prontinho! Salvei isso na sua Lista de Desejos."),
      );
    } catch {
      setWishlistFeedback("Não consegui salvar agora. Tente de novo em instantes.");
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
    <Animated.View entering={FadeIn.duration(220)} style={styles.card}>
      {/* Header: advertiser + sponsored badge + menu */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || "AD"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.authorRow}>
              <Text style={styles.advertiserName} numberOfLines={1}>{ad.advertiserName}</Text>
              <View style={styles.sponsoredBadge}>
                <Feather name="star" size={9} color={colors.primaryDark} />
                <Text style={styles.sponsoredText}>Patrocinado</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>Promovido</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowMenu(true)}
          style={styles.menuBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="more-horizontal" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Title + description */}
      <Text style={styles.title}>{ad.title}</Text>
      <Text style={styles.description}>{ad.description}</Text>

      {/* Hero image (taps CTA) */}
      {ad.imageUrl ? (
        <TouchableOpacity activeOpacity={0.9} onPress={handleCtaPress}>
          <Image source={{ uri: ad.imageUrl }} style={styles.heroImage} resizeMode="cover" />
        </TouchableOpacity>
      ) : null}

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.ctaBtn} onPress={handleCtaPress} activeOpacity={0.85}>
          <Text style={styles.ctaBtnText}>{ad.callToActionText}</Text>
          <Feather name="external-link" size={14} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.wishlistBtn, savedToWishlist && styles.wishlistBtnSaved]}
          onPress={handleAddToWishlist}
          activeOpacity={0.75}
          disabled={wishlistSaving || savedToWishlist}
        >
          <Feather
            name="heart"
            size={14}
            color={savedToWishlist ? colors.destructive : colors.primaryDark}
          />
          <Text style={styles.wishlistBtnText}>
            {savedToWishlist ? "Salvo" : wishlistSaving ? "..." : "Salvar"}
          </Text>
        </TouchableOpacity>
      </View>

      {wishlistFeedback ? (
        <Text style={styles.wishlistFeedback}>{wishlistFeedback}</Text>
      ) : null}

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={openWhyModal}>
          <Text style={styles.footerLink}>Por que estou vendo isso?</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleHide}>
          <Text style={styles.footerLink}>Ocultar</Text>
        </TouchableOpacity>
      </View>

      {/* Menu modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            {[
              { icon: "eye-off" as const, label: "Não quero ver este anúncio", action: handleHide },
              { icon: "thumbs-down" as const, label: "Não é relevante para mim", action: handleNotRelevant },
              { icon: "info" as const, label: "Por que estou vendo isso?", action: () => { setShowMenu(false); openWhyModal(); } },
              { icon: "sliders" as const, label: "Ajustar preferências", action: () => { setShowMenu(false); router.push("/ad-settings" as never); } },
              { icon: "flag" as const, label: "Denunciar anúncio", action: handleReport, destructive: true },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={item.action}
                activeOpacity={0.7}
              >
                <Feather
                  name={item.icon}
                  size={16}
                  color={item.destructive ? colors.destructive : colors.foreground}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    item.destructive && { color: colors.destructive },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <WhyThisAdModal
        visible={showWhyModal}
        isPersonalized={isPersonalized}
        advertiserName={ad.advertiserName}
        onClose={() => setShowWhyModal(false)}
        onAdjustPreferences={handleAdjustPreferences}
      />
    </Animated.View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      gap: 10,
      borderWidth: 1.5,
      borderColor: colors.primary + "40",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },

    header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary + "22",
      borderWidth: 1,
      borderColor: colors.primary + "55",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontFamily: FONTS.display,
      fontSize: 14,
      fontWeight: "800",
      color: colors.primaryDark,
    },
    authorRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    advertiserName: {
      fontFamily: FONTS.sans,
      fontWeight: "700",
      fontSize: 14,
      color: colors.foreground,
      maxWidth: 160,
    },
    sponsoredBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.primary + "22",
      borderRadius: 99,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.primary + "44",
    },
    sponsoredText: {
      fontFamily: FONTS.sans,
      fontSize: 9,
      fontWeight: "800",
      color: colors.primaryDark,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    subtitle: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 2 },
    menuBtn: { padding: 4 },

    title: {
      fontFamily: FONTS.sans,
      fontSize: 15,
      fontWeight: "800",
      color: colors.foreground,
      lineHeight: 21,
    },
    description: {
      fontFamily: FONTS.sans,
      fontSize: 14,
      color: colors.foreground,
      lineHeight: 21,
      opacity: 0.9,
    },
    heroImage: {
      width: "100%",
      height: 220,
      maxHeight: 320,
      borderRadius: 14,
      backgroundColor: colors.background,
    },

    actionRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    ctaBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    ctaBtnText: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "800", color: "#000" },
    wishlistBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary + "18",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary + "44",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    wishlistBtnSaved: {
      backgroundColor: colors.destructive + "12",
      borderColor: colors.destructive + "55",
    },
    wishlistBtnText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "800", color: colors.primaryDark },
    wishlistFeedback: {
      fontFamily: FONTS.sans,
      fontSize: 12,
      color: colors.primaryDark,
      backgroundColor: colors.primary + "12",
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },

    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    footerLink: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, textDecorationLine: "underline" },

    // Menu modal
    menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    menuSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingVertical: 8,
      paddingBottom: 32,
    },
    menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
    menuItemText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "600", color: colors.foreground },
  });
}
