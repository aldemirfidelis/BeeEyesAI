import { useState, useEffect, useMemo } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";
import {
  loadAdPreferences,
  saveAdPreferences,
  defaultAdPreferences,
} from "@mobile/lib/adService";
import { api } from "@mobile/lib/api";
import { AD_INTEREST_OPTIONS, type AdFrequency, type UserAdPreferences } from "@mobile/lib/ads";

const FREQUENCY_OPTIONS: { value: AdFrequency; label: string; desc: string }[] = [
  { value: "low",    label: "Baixa",   desc: "Máximo 1 anúncio por dia" },
  { value: "normal", label: "Normal",  desc: "Máximo 3 anúncios por dia" },
  { value: "high",   label: "Alta",    desc: "Máximo 5 anúncios por dia" },
];

interface RecentAdImpression {
  id: string;
  title: string;
  description?: string | null;
  productUrl?: string | null;
  advertiserName?: string | null;
  expiresAt: string;
}

export default function AdSettingsScreen() {
  const insets = useSafeAreaInsets();
  const themeMode = useUIStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [prefs, setPrefs]     = useState<UserAdPreferences>(defaultAdPreferences());
  const [recentAds, setRecentAds] = useState<RecentAdImpression[]>([]);

  useEffect(() => {
    loadAdPreferences().then((p) => { setPrefs(p); setLoading(false); });
    api.get("/api/ad-impressions/recent")
      .then((response) => setRecentAds(Array.isArray(response.data) ? response.data : []))
      .catch(() => setRecentAds([]));
  }, []);

  function toggleInterest(interest: string) {
    setPrefs((p) => ({
      ...p,
      selectedInterests: p.selectedInterests.includes(interest)
        ? p.selectedInterests.filter((i) => i !== interest)
        : [...p.selectedInterests, interest],
    }));
  }

  async function handleSave() {
    setSaving(true);
    await saveAdPreferences({
      ...prefs,
      // If personalized ads are on, mark consent as given now
      consentGiven: prefs.allowPersonalizedAds ? true : prefs.consentGiven,
      consentGivenAt: prefs.allowPersonalizedAds && !prefs.consentGiven
        ? new Date().toISOString()
        : prefs.consentGivenAt,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Preferências de Anúncios</Text>
          <Text style={styles.headerSub}>Controle como os anúncios aparecem</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro card */}
        <View style={styles.infoCard}>
          <Feather name="shield" size={16} color={colors.primary} />
          <Text style={styles.infoText}>
            Os anúncios ajudam a manter a Bee funcionando. Você controla quais tipos de anúncios quer ver.
            Nunca usamos dados sensíveis, localização ou histórico de conversas para publicidade.
          </Text>
        </View>

        {/* Personalised ads toggle */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Anúncios personalizados</Text>
          <Text style={styles.cardSub}>
            Permite que a Bee use seus interesses escolhidos abaixo para mostrar anúncios mais relevantes.
            Sem rastreamento fora do app.
          </Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>
              {prefs.allowPersonalizedAds ? "Ativado" : "Desativado (apenas genéricos)"}
            </Text>
            <Switch
              value={prefs.allowPersonalizedAds}
              onValueChange={(v) => setPrefs((p) => ({ ...p, allowPersonalizedAds: v }))}
              thumbColor={prefs.allowPersonalizedAds ? "#111827" : "#f4f4f5"}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        {/* Interests */}
        {prefs.allowPersonalizedAds && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Meus interesses</Text>
            <Text style={styles.cardSub}>Selecione os temas que fazem sentido para você.</Text>
            <View style={styles.chipGrid}>
              {AD_INTEREST_OPTIONS.map((interest) => {
                const selected = prefs.selectedInterests.includes(interest);
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleInterest(interest)}
                    activeOpacity={0.75}
                  >
                    {selected && <Feather name="check" size={11} color={colors.primaryDark} />}
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {interest}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Frequency */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Frequência de anúncios</Text>
          <Text style={styles.cardSub}>Com que frequência você quer ver anúncios?</Text>
          <View style={styles.freqOptions}>
            {FREQUENCY_OPTIONS.map((opt) => {
              const active = prefs.preferredAdFrequency === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.freqCard, active && styles.freqCardActive]}
                  onPress={() => setPrefs((p) => ({ ...p, preferredAdFrequency: opt.value }))}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.freqLabel, active && styles.freqLabelActive]}>{opt.label}</Text>
                  <Text style={[styles.freqDesc, active && { color: colors.primary + "BB" }]}>{opt.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Hidden advertisers */}
        {prefs.hiddenAdvertisers.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Anunciantes ocultados</Text>
            {prefs.hiddenAdvertisers.map((adv) => (
              <View key={adv} style={styles.hiddenAdvRow}>
                <Text style={styles.hiddenAdvName}>{adv}</Text>
                <TouchableOpacity
                  onPress={() =>
                    setPrefs((p) => ({
                      ...p,
                      hiddenAdvertisers: p.hiddenAdvertisers.filter((a) => a !== adv),
                    }))
                  }
                >
                  <Feather name="x" size={14} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {recentAds.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Anúncios vistos</Text>
            <Text style={styles.cardSub}>Disponíveis por até 2 dias, caso você não salve na Lista de Desejos.</Text>
            {recentAds.slice(0, 5).map((ad) => {
              const expiresAt = new Date(ad.expiresAt);
              return (
                <View key={ad.id} style={styles.recentAdRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentAdTitle} numberOfLines={1}>{ad.title}</Text>
                    <Text style={styles.recentAdMeta} numberOfLines={1}>{ad.advertiserName || "Anunciante"}</Text>
                    <Text style={styles.recentAdMeta}>
                      Até {expiresAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às {expiresAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  {ad.productUrl ? (
                    <TouchableOpacity style={styles.openAdButton} onPress={() => Linking.openURL(ad.productUrl!).catch(() => {})}>
                      <Feather name="external-link" size={14} color={colors.foreground} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <Feather name="lock" size={12} color={colors.muted} />
          <Text style={styles.privacyText}>
            Suas preferências ficam armazenadas somente neste dispositivo.
            A Bee não compartilha informações de anúncios com terceiros sem sua autorização.
            Usuários assinantes premium não veem anúncios.
          </Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Feather name={saved ? "check" : "save"} size={15} color="#000" />
              <Text style={styles.saveBtnText}>{saved ? "Preferências salvas!" : "Salvar preferências"}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 16, paddingBottom: 12,
    },
    backBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },
    headerTitle: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "800", color: colors.foreground },
    headerSub: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
    content: { padding: 16, gap: 14 },

    infoCard: {
      flexDirection: "row", gap: 10, alignItems: "flex-start",
      backgroundColor: colors.primary + "14", borderRadius: 16,
      borderWidth: 1, borderColor: colors.primary + "33", padding: 14,
    },
    infoText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, flex: 1, lineHeight: 19 },

    card: {
      backgroundColor: colors.card, borderRadius: 18, borderWidth: 1,
      borderColor: colors.border, padding: 14, gap: 10,
    },
    cardTitle: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: colors.foreground },
    cardSub: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted, lineHeight: 19 },

    toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    toggleLabel: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground },

    chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
    },
    chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    chipText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    chipTextSelected: { color: colors.primaryDark, fontWeight: "700" },

    freqOptions: { flexDirection: "row", gap: 10 },
    freqCard: {
      flex: 1, padding: 12, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.background, gap: 4,
    },
    freqCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + "14" },
    freqLabel: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.foreground },
    freqLabelActive: { color: colors.primaryDark },
    freqDesc: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted },

    hiddenAdvRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: 6,
    },
    hiddenAdvName: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground },
    recentAdRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 10,
      marginTop: 8,
      backgroundColor: colors.background,
    },
    recentAdTitle: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "800", color: colors.foreground },
    recentAdMeta: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 2 },
    openAdButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    privacyNote: {
      flexDirection: "row", gap: 8, alignItems: "flex-start",
      backgroundColor: colors.card, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, padding: 12,
    },
    privacyText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, flex: 1, lineHeight: 16 },

    saveBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
    },
    saveBtnText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: "800", color: "#000" },
  });
}
