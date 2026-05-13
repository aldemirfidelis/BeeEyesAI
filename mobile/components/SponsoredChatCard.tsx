import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";
import { WhyThisAdModal } from "./WhyThisAdModal";
import type { SponsoredMessageMeta } from "@mobile/lib/ads";

interface SponsoredChatCardProps {
  meta: SponsoredMessageMeta;
  onHide: (adId: string) => void;
  onNotRelevant: (adId: string) => void;
  onReport: (adId: string) => void;
}

export function SponsoredChatCard({
  meta,
  onHide,
  onNotRelevant,
  onReport,
}: SponsoredChatCardProps) {
  const themeMode = useUIStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);

  const [showMenu, setShowMenu] = useState(false);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [hidden, setHidden] = useState(false);

  const { ad, beeIntroMessage, isPersonalized, adId } = meta;

  if (hidden) return null;

  function handleCtaPress() {
    if (!ad.targetUrl) return;
    Linking.openURL(ad.targetUrl).catch(() =>
      Alert.alert("Não foi possível abrir o link."),
    );
  }

  function handleHide() {
    setShowMenu(false);
    setHidden(true);
    onHide(adId);
  }

  function handleNotRelevant() {
    setShowMenu(false);
    setHidden(true);
    onNotRelevant(adId);
  }

  function handleReport() {
    setShowMenu(false);
    Alert.alert(
      "Denunciar anúncio",
      "Obrigado por nos avisar. Vamos revisar esse anúncio.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Denunciar", style: "destructive", onPress: () => { setHidden(true); onReport(adId); } },
      ],
    );
  }

  function handleAdjustPreferences() {
    setShowWhyModal(false);
    router.push("/ad-settings" as never);
  }

  return (
    <Animated.View entering={FadeInDown.duration(260)} style={styles.wrapper}>
      {/* Bee intro message */}
      <View style={styles.beeRow}>
        <Image
          source={require("../assets/beeyes-design/bee-icon.png")}
          style={styles.beeAvatar}
        />
        <View style={styles.beeBubble}>
          <Text style={styles.beeText}>{beeIntroMessage}</Text>
        </View>
      </View>

      {/* Ad card */}
      <View style={styles.card}>
        {/* Card header: badge + menu */}
        <View style={styles.cardHeader}>
          <View style={styles.sponsoredBadge}>
            <Feather name="star" size={10} color={colors.primaryDark} />
            <Text style={styles.sponsoredText}>Patrocinado</Text>
          </View>
          <TouchableOpacity onPress={() => setShowMenu((v) => !v)} style={styles.menuBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="more-horizontal" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Dropdown menu */}
        {showMenu && (
          <View style={styles.menuSheet}>
            {[
              { icon: "eye-off", label: "Ocultar anúncio", action: handleHide },
              { icon: "thumbs-down", label: "Não é relevante", action: handleNotRelevant },
              { icon: "flag", label: "Denunciar anúncio", action: handleReport },
              { icon: "info", label: "Por que estou vendo isso?", action: () => { setShowMenu(false); setShowWhyModal(true); } },
              { icon: "sliders", label: "Ajustar preferências", action: () => { setShowMenu(false); router.push("/ad-settings" as never); } },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={item.action}
                activeOpacity={0.7}
              >
                <Feather name={item.icon as any} size={14} color={item.label.startsWith("Denunciar") ? colors.destructive : colors.foreground} />
                <Text style={[styles.menuItemText, item.label.startsWith("Denunciar") && { color: colors.destructive }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Ad image */}
        {ad.imageUrl ? (
          <Image source={{ uri: ad.imageUrl }} style={styles.adImage} resizeMode="cover" />
        ) : null}

        {/* Ad body */}
        <Text style={styles.adTitle}>{ad.title}</Text>
        <Text style={styles.adDescription}>{ad.description}</Text>
        <Text style={styles.advertiserName}>{ad.advertiserName}</Text>

        {/* Action row */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.ctaBtn} onPress={handleCtaPress} activeOpacity={0.8}>
            <Text style={styles.ctaBtnText}>{ad.callToActionText}</Text>
            <Feather name="external-link" size={13} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.hideBtn} onPress={handleHide} activeOpacity={0.7}>
            <Text style={styles.hideBtnText}>Não quero ver isso</Text>
          </TouchableOpacity>
        </View>

        {/* Why this ad link */}
        <TouchableOpacity onPress={() => setShowWhyModal(true)} style={styles.whyLink}>
          <Feather name="help-circle" size={11} color={colors.muted} />
          <Text style={styles.whyLinkText}>Por que estou vendo isso?</Text>
        </TouchableOpacity>
      </View>

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
    wrapper: { marginVertical: 8, gap: 6 },

    // Bee intro bubble (assistant-side layout)
    beeRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, maxWidth: "88%" },
    beeAvatar: { width: 28, height: 28, borderRadius: 14 },
    beeBubble: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flex: 1,
    },
    beeText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, lineHeight: 19 },

    // Ad card
    card: {
      marginHorizontal: 16,
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.primary + "55",
      padding: 14,
      gap: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sponsoredBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.primary + "22",
      borderRadius: 99,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.primary + "44",
    },
    sponsoredText: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "800", color: colors.primaryDark, textTransform: "uppercase", letterSpacing: 0.5 },
    menuBtn: { padding: 4 },

    // Dropdown menu
    menuSheet: {
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 6,
      gap: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 14,
      elevation: 8,
    },
    menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
    menuItemText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground },

    // Ad content
    adImage: { width: "100%", height: 140, borderRadius: 12 },
    adTitle: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: colors.foreground },
    adDescription: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted, lineHeight: 19 },
    advertiserName: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted },

    // Actions
    actionRow: { flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" },
    ctaBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    ctaBtnText: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "800", color: "#000" },
    hideBtn: {
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    hideBtnText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },

    // Why this ad
    whyLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
    whyLinkText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted },
  });
}
