import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { PRIVACY_POLICY, TERMS_OF_USE } from "@mobile/lib/legalTexts";
import { api, getApiErrorMessage } from "@mobile/lib/api";
import { applyAppLanguage } from "@mobile/lib/i18n";
import { FONTS, getThemeColors, type ThemePreference } from "@mobile/lib/theme";
import { useAuthStore } from "@mobile/stores/authStore";
import { useUIStore } from "@mobile/stores/uiStore";

type MeResponse = {
  id: string;
  username: string;
  email?: string | null;
  displayName?: string | null;
  gender?: string | null;
  bio?: string | null;
  language?: string;
  anonymousProfileVisitsEnabled?: boolean;
  level?: number;
  xp?: number;
  currentStreak?: number;
};

const BIO_MAX = 300;
const NAME_MAX = 60;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const themeMode = useUIStore((state) => state.themeMode);
  const themePreference = useUIStore((state) => state.themePreference);
  const profileImageUri = useUIStore((state) => state.profileImageUri);
  const setThemePreference = useUIStore((state) => state.setThemePreference);
  const setProfileImageUri = useUIStore((state) => state.setProfileImageUri);
  const authUser = useAuthStore((state) => state.user);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [language, setLanguage] = useState("pt-BR");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; bio?: string }>({});
  const [savingField, setSavingField] = useState<"name" | "bio" | "language" | null>(null);

  const { data: me, isLoading: meLoading } = useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me").then((response) => response.data),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.displayName ?? "");
    setBio(me.bio ?? "");
    setLanguage(me.language ?? "pt-BR");
  }, [me?.id, me?.displayName, me?.bio, me?.language]);

  // Auto-clear feedback after 3s
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(id);
  }, [feedback]);

  const anonymousEnabled = Boolean(me?.anonymousProfileVisitsEnabled ?? authUser?.anonymousProfileVisitsEnabled);
  const nameChanged = (me?.displayName ?? "") !== displayName;
  const bioChanged = (me?.bio ?? "") !== bio;
  const nameLen = displayName.length;
  const bioLen = bio.length;
  const bioOver = bioLen > BIO_MAX;
  const bioWarn = !bioOver && bioLen > BIO_MAX - 30;
  const passwordValid = newPassword.length >= 8 && /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword);

  const updatePreferences = useMutation({
    mutationFn: (payload: Partial<Pick<MeResponse, "anonymousProfileVisitsEnabled" | "displayName" | "bio" | "language">>) =>
      api.patch("/api/me/preferences", payload).then((response) => response.data as MeResponse),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["me"], updatedUser);
      if (authUser) {
        setAuthUser({
          ...authUser,
          ...updatedUser,
          level: updatedUser.level ?? authUser.level,
          xp: updatedUser.xp ?? authUser.xp,
          currentStreak: updatedUser.currentStreak ?? authUser.currentStreak,
        });
      }
      applyAppLanguage(updatedUser.language);
      setFeedback({ tone: "success", text: t("settings_preferences_updated") });
      setSavingField(null);
    },
    onError: (error: unknown) => {
      setFeedback({ tone: "error", text: getApiErrorMessage(error, t("settings_update_error")) });
      setSavingField(null);
    },
  });

  const updatePassword = useMutation({
    mutationFn: () => api.patch("/api/me/password", { currentPassword, newPassword }).then((r) => r.data),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setFeedback({ tone: "success", text: t("settings_password_changed_msg") });
    },
    onError: (error: unknown) => {
      setFeedback({ tone: "error", text: getApiErrorMessage(error, t("settings_password_error")) });
    },
  });

  async function handlePickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("settings_gallery_permission"), t("settings_gallery_permission_msg"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const processed = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 512, height: 512 } }],
      { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    const base64Uri = `data:image/jpeg;base64,${processed.base64}`;
    await setProfileImageUri(base64Uri);
    try {
      await api.patch("/api/me/avatar", { avatarUrl: base64Uri });
    } catch {
      // local cache saved even if server fails
    }
    setFeedback({ tone: "success", text: t("settings_photo_updated_msg") });
  }

  async function handleRemovePhoto() {
    await setProfileImageUri(null);
    api.patch("/api/me/avatar", { avatarUrl: null }).catch(() => {});
    setFeedback({ tone: "info", text: "Foto removida." });
  }

  function handleSaveName() {
    if (displayName.trim().length === 0) {
      setFieldErrors((p) => ({ ...p, name: "O nome não pode ficar vazio." }));
      return;
    }
    setFieldErrors((p) => ({ ...p, name: undefined }));
    setSavingField("name");
    updatePreferences.mutate({ displayName: displayName.trim() });
  }

  function handleSaveBio() {
    if (bioOver) {
      setFieldErrors((p) => ({ ...p, bio: "Bio acima do limite." }));
      return;
    }
    setFieldErrors((p) => ({ ...p, bio: undefined }));
    setSavingField("bio");
    updatePreferences.mutate({ bio });
  }

  function handleToggleAnonymous(value: boolean) {
    updatePreferences.mutate({ anonymousProfileVisitsEnabled: value });
  }

  function handleLanguageSelect(nextLanguage: string) {
    setLanguage(nextLanguage);
    setSavingField("language");
    updatePreferences.mutate({ language: nextLanguage });
  }

  function handleThemeSelect(pref: ThemePreference) {
    setThemePreference(pref);
    setFeedback({
      tone: "info",
      text: pref === "system" ? "Aparência segue o sistema." : `Modo ${pref === "dark" ? "escuro" : "claro"} aplicado.`,
    });
  }

  // Perfil completeness
  const completeness = useMemo(() => {
    const checks = [
      Boolean(me?.displayName?.trim()),
      Boolean(profileImageUri),
      Boolean(me?.bio?.trim() && me.bio.trim().length >= 12),
      Boolean(me?.language),
      Boolean(me?.email),
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [me, profileImageUri]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Voltar">
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("settings_title")}</Text>
            <Text style={styles.subtitle}>Conta, aparência e privacidade</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header card (avatar + completeness) */}
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} style={styles.heroAvatar} />
              ) : (
                <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
                  <Text style={styles.heroAvatarText}>
                    {(me?.displayName || me?.username || "?")[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroName} numberOfLines={1}>
                  {me?.displayName || me?.username || "Sua conta"}
                </Text>
                <Text style={styles.heroUsername} numberOfLines={1}>@{me?.username}</Text>
                <View style={styles.heroChips}>
                  <View style={styles.heroChip}>
                    <Feather name="zap" size={10} color={colors.primaryDark} />
                    <Text style={styles.heroChipText}>Nv {me?.level ?? 1}</Text>
                  </View>
                  <View style={styles.heroChip}>
                    <Feather name="star" size={10} color={colors.primaryDark} />
                    <Text style={styles.heroChipText}>{me?.xp ?? 0} XP</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.progressWrap}>
              <View style={styles.progressLabel}>
                <Text style={styles.progressLabelText}>Perfil {completeness}% completo</Text>
                {completeness === 100 ? (
                  <Text style={styles.progressDone}>Tudo certo! 🐝</Text>
                ) : null}
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${completeness}%` as any }]} />
              </View>
            </View>
          </View>

          {/* Foto */}
          <SettingsCard icon="camera" title="Foto de perfil" subtitle="JPG ou PNG, até 5MB" styles={styles}>
            <View style={styles.previewRow}>
              <View style={styles.avatar}>
                {profileImageUri ? (
                  <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarPlaceholder}>?</Text>
                )}
              </View>
              <View style={styles.rowButtons}>
                <TouchableOpacity style={styles.primaryButton} onPress={handlePickFromGallery}>
                  <Feather name="camera" size={13} color="#1A1A1A" />
                  <Text style={styles.primaryButtonText}>Trocar</Text>
                </TouchableOpacity>
                {profileImageUri ? (
                  <TouchableOpacity style={styles.iconButton} onPress={handleRemovePhoto} accessibilityLabel="Remover foto">
                    <Feather name="trash-2" size={14} color={colors.foreground} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </SettingsCard>

          {/* Nome */}
          <SettingsCard icon="user" title="Nome de exibição" styles={styles}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldHelp}>Como você aparece para os outros</Text>
              <Text style={[styles.charCounter, nameLen > NAME_MAX && { color: colors.destructive }]}>
                {nameLen}/{NAME_MAX}
              </Text>
            </View>
            <TextInput
              style={[styles.input, fieldErrors.name && styles.inputError]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t("settings_display_name_placeholder")}
              placeholderTextColor={colors.muted}
              maxLength={NAME_MAX + 10}
              accessibilityLabel="Nome de exibição"
            />
            {fieldErrors.name ? <Text style={styles.errorText}>{fieldErrors.name}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryButton, (!nameChanged || updatePreferences.isPending) && styles.btnDisabled]}
              onPress={handleSaveName}
              disabled={!nameChanged || updatePreferences.isPending}
            >
              {savingField === "name" ? (
                <ActivityIndicator size="small" color="#1A1A1A" />
              ) : (
                <Text style={styles.primaryButtonText}>Salvar nome</Text>
              )}
            </TouchableOpacity>
          </SettingsCard>

          {/* Bio */}
          <SettingsCard icon="edit-2" title="Bio" styles={styles}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldHelp}>Conte um pouco sobre você</Text>
              <Text style={[
                styles.charCounter,
                bioOver && { color: colors.destructive },
                bioWarn && { color: colors.primaryDark },
              ]}>
                {bioLen}/{BIO_MAX}
              </Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea, bioOver && styles.inputError]}
              value={bio}
              onChangeText={setBio}
              placeholder={t("settings_bio_placeholder")}
              placeholderTextColor={colors.muted}
              multiline
              maxLength={BIO_MAX + 50}
              accessibilityLabel="Bio"
            />
            {fieldErrors.bio ? <Text style={styles.errorText}>{fieldErrors.bio}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryButton, (!bioChanged || bioOver || updatePreferences.isPending) && styles.btnDisabled]}
              onPress={handleSaveBio}
              disabled={!bioChanged || bioOver || updatePreferences.isPending}
            >
              {savingField === "bio" ? (
                <ActivityIndicator size="small" color="#1A1A1A" />
              ) : (
                <Text style={styles.primaryButtonText}>Salvar bio</Text>
              )}
            </TouchableOpacity>
          </SettingsCard>

          {/* Aparência */}
          <SettingsCard icon="sun" title="Aparência" subtitle="Escolha como a Bee aparece" styles={styles}>
            <View style={styles.themeGrid}>
              <ThemeOption
                styles={styles}
                colors={colors}
                icon="sun"
                label="Claro"
                desc="Mais luminoso"
                active={themePreference === "light"}
                onPress={() => handleThemeSelect("light")}
              />
              <ThemeOption
                styles={styles}
                colors={colors}
                icon="moon"
                label="Escuro"
                desc="Confortável à noite"
                active={themePreference === "dark"}
                onPress={() => handleThemeSelect("dark")}
              />
              <ThemeOption
                styles={styles}
                colors={colors}
                icon="smartphone"
                label="Automático"
                desc="Segue o sistema"
                active={themePreference === "system"}
                onPress={() => handleThemeSelect("system")}
              />
            </View>
          </SettingsCard>

          {/* Idioma */}
          <SettingsCard icon="globe" title="Idioma" styles={styles}>
            <View style={styles.segmentRow}>
              <Segment styles={styles} label="🇧🇷 PT-BR" active={language === "pt-BR"} onPress={() => handleLanguageSelect("pt-BR")} />
              <Segment styles={styles} label="🇪🇸 ES" active={language === "es"} onPress={() => handleLanguageSelect("es")} />
              <Segment styles={styles} label="🇺🇸 EN" active={language === "en"} onPress={() => handleLanguageSelect("en")} />
            </View>
          </SettingsCard>

          {/* Privacidade */}
          <SettingsCard icon="shield" title="Privacidade" subtitle="Controle quem vê sua atividade" styles={styles}>
            <View style={styles.settingHeader}>
              <View style={styles.settingHeaderCopy}>
                <Text style={styles.rowTitle}>{t("settings_anonymous_nav")}</Text>
                <Text style={styles.smallText}>{t("settings_anonymous_nav_desc")}</Text>
              </View>
              {meLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Switch
                  value={anonymousEnabled}
                  onValueChange={handleToggleAnonymous}
                  disabled={updatePreferences.isPending}
                  thumbColor={anonymousEnabled ? "#111827" : "#f4f4f5"}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  accessibilityLabel="Navegação anônima"
                />
              )}
            </View>
            <View style={styles.separator} />
            <FutureRow styles={styles} title="Conta privada" desc="Em breve · só amigos verão seu perfil" />
            <FutureRow styles={styles} title="Mostrar status online" desc="Em breve · amigos veem quando você está ativo" />
            <FutureRow styles={styles} title="Mensagens de desconhecidos" desc="Em breve · DMs de pessoas fora da sua rede" />
          </SettingsCard>

          {/* Segurança */}
          <SettingsCard icon="lock" title="Segurança da conta" subtitle="Mantenha seu acesso protegido" styles={styles}>
            <Text style={styles.fieldLabel}>Senha atual</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Digite sua senha atual"
              placeholderTextColor={colors.muted}
              secureTextEntry
              accessibilityLabel="Senha atual"
            />
            <Text style={styles.fieldLabel}>Nova senha</Text>
            <TextInput
              style={[
                styles.input,
                newPassword.length > 0 && !passwordValid && styles.inputWarn,
              ]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Mínimo 8 caracteres, letra e número"
              placeholderTextColor={colors.muted}
              secureTextEntry
              accessibilityLabel="Nova senha"
            />
            {newPassword.length > 0 && !passwordValid ? (
              <Text style={styles.warnText}>A senha precisa ter ≥8 caracteres, contendo letra e número.</Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                (!currentPassword || !passwordValid || updatePassword.isPending) && styles.btnDisabled,
              ]}
              onPress={() => updatePassword.mutate()}
              disabled={!currentPassword || !passwordValid || updatePassword.isPending}
            >
              {updatePassword.isPending ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <>
                  <Feather name="lock" size={14} color={colors.foreground} />
                  <Text style={styles.secondaryButtonText}>Alterar senha</Text>
                </>
              )}
            </TouchableOpacity>
          </SettingsCard>

          {/* Anúncios */}
          <SettingsCard icon="shield" title="Anúncios" subtitle="Personalização e privacidade" styles={styles}>
            <Text style={styles.smallText}>
              Anúncios discretos ajudam a manter a Bee gratuita. Você decide frequência, interesses e nível de
              personalização — sem rastreamento fora do app.
            </Text>
            <TouchableOpacity style={styles.linkButton} onPress={() => router.push("/ad-settings" as never)}>
              <Text style={styles.linkButtonText}>Preferências de anúncios</Text>
              <Feather name="chevron-right" size={16} color={colors.muted} />
            </TouchableOpacity>
          </SettingsCard>

          {/* Legal */}
          <SettingsCard icon="file-text" title="Termos legais" styles={styles}>
            <TouchableOpacity style={styles.linkButton} onPress={() => setLegalModal("privacy")}>
              <Text style={styles.linkButtonText}>{t("settings_privacy_policy")}</Text>
              <Feather name="chevron-right" size={16} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkButton} onPress={() => setLegalModal("terms")}>
              <Text style={styles.linkButtonText}>{t("settings_terms_of_use")}</Text>
              <Feather name="chevron-right" size={16} color={colors.muted} />
            </TouchableOpacity>
          </SettingsCard>

          <Text style={styles.footerHint}>BeeEyes 🐝 · feito com carinho</Text>
        </ScrollView>

        {/* Toast de feedback */}
        {feedback ? (
          <View style={[
            styles.toast,
            feedback.tone === "success" && styles.toastSuccess,
            feedback.tone === "error" && styles.toastError,
            feedback.tone === "info" && styles.toastInfo,
          ]}>
            <Feather
              name={feedback.tone === "success" ? "check-circle" : feedback.tone === "error" ? "alert-circle" : "info"}
              size={14}
              color="#fff"
            />
            <Text style={styles.toastText}>{feedback.text}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {/* Legal modal */}
      <Modal visible={legalModal !== null} animationType="slide" transparent onRequestClose={() => setLegalModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {legalModal === "privacy" ? t("settings_privacy_policy") : t("settings_terms_of_use")}
            </Text>
            <ScrollView>
              <Text style={styles.legalText}>{legalModal === "privacy" ? PRIVACY_POLICY : TERMS_OF_USE}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setLegalModal(null)}>
              <Text style={styles.primaryButtonText}>{t("close")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function SettingsCard({
  icon, title, subtitle, children, styles, iconColor,
}: { icon: keyof typeof Feather.glyphMap; title: string; subtitle?: string; children: ReactNode; styles: ReturnType<typeof makeStyles>; iconColor?: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>
          <Feather name={icon} size={14} color={iconColor ?? "#A88800"} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubTitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function Segment({ label, active, onPress, styles }: { label: string; active: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <TouchableOpacity
      style={[styles.segment, active && styles.segmentActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ThemeOption({
  icon, label, desc, active, onPress, styles, colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  desc: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof getThemeColors>;
}) {
  return (
    <TouchableOpacity
      style={[styles.themeOption, active && styles.themeOptionActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <View style={styles.themeOptionHeader}>
        <Feather name={icon} size={14} color={active ? colors.primaryDark : colors.foreground} />
        {active ? <Feather name="check-circle" size={14} color={colors.primaryDark} /> : null}
      </View>
      <Text style={[styles.themeOptionLabel, active && { color: colors.primaryDark }]}>{label}</Text>
      <Text style={styles.themeOptionDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

function FutureRow({ title, desc, styles }: { title: string; desc: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={[styles.settingHeader, { opacity: 0.55 }]}>
      <View style={styles.settingHeaderCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.smallText}>{desc}</Text>
      </View>
      <Switch value={false} disabled />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 12, paddingBottom: 36 },
    headerRow: {
      flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10, backgroundColor: colors.card,
    },
    backButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    title: { fontFamily: FONTS.display, fontWeight: "800", fontSize: 18, color: colors.foreground },
    subtitle: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 1 },

    // Hero card
    heroCard: {
      backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.primary + "33",
      padding: 16, gap: 14,
      shadowColor: colors.primary, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
    },
    heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    heroAvatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: colors.primary + "55" },
    heroAvatarFallback: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    heroAvatarText: { fontFamily: FONTS.display, fontSize: 28, fontWeight: "900", color: "#1A1A1A" },
    heroName: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "800", color: colors.foreground },
    heroUsername: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 1 },
    heroChips: { flexDirection: "row", gap: 6, marginTop: 6 },
    heroChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: colors.primary + "1F" },
    heroChipText: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "800", color: colors.primaryDark },

    progressWrap: { gap: 6 },
    progressLabel: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    progressLabelText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.foreground, fontWeight: "700" },
    progressDone: { fontFamily: FONTS.sans, fontSize: 10, color: colors.success, fontWeight: "800" },
    progressBar: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 3 },

    // Generic card
    card: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    cardIconWrap: {
      width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
      backgroundColor: colors.primary + "1F",
    },
    cardTitle: { fontFamily: FONTS.sans, color: colors.foreground, fontWeight: "800", fontSize: 14 },
    cardSubTitle: { fontFamily: FONTS.sans, color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 1 },

    // Foto
    previewRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 2, borderColor: colors.primary + "33" },
    avatarImage: { width: "100%", height: "100%" },
    avatarPlaceholder: { fontFamily: FONTS.sans, color: colors.muted, fontSize: 22, fontWeight: "800" },
    rowButtons: { flex: 1, flexDirection: "row", gap: 8 },
    primaryButton: { flex: 1, borderRadius: 12, backgroundColor: colors.primary, paddingVertical: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
    primaryButtonText: { fontFamily: FONTS.sans, fontWeight: "800", color: "#1A1A1A", fontSize: 13 },
    secondaryButton: {
      borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 10,
      alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: colors.background,
    },
    secondaryButtonText: { fontFamily: FONTS.sans, fontWeight: "700", color: colors.foreground, fontSize: 13 },
    iconButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    btnDisabled: { opacity: 0.4 },

    // Fields
    fieldHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    fieldHelp: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted },
    fieldLabel: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, fontWeight: "700" },
    charCounter: { fontFamily: FONTS.mono, fontSize: 10, color: colors.muted },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, color: colors.foreground, paddingHorizontal: 12, paddingVertical: 11, fontFamily: FONTS.sans, fontSize: 14 },
    inputError: { borderColor: colors.destructive },
    inputWarn: { borderColor: colors.primaryDark },
    textArea: { minHeight: 80, textAlignVertical: "top" },
    errorText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.destructive },
    warnText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.primaryDark },

    // Theme grid
    themeGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    themeOption: {
      flexGrow: 1, minWidth: "30%", borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
      padding: 10, backgroundColor: colors.background, gap: 4,
    },
    themeOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary + "16" },
    themeOptionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    themeOptionLabel: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "800", color: colors.foreground },
    themeOptionDesc: { fontFamily: FONTS.sans, fontSize: 10, color: colors.muted },

    // Segments (idioma)
    segmentRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    segment: { flexGrow: 1, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 10, alignItems: "center", backgroundColor: colors.background },
    segmentActive: { borderColor: colors.primary, backgroundColor: colors.primary + "26" },
    segmentText: { fontFamily: FONTS.sans, color: colors.foreground, fontWeight: "700", fontSize: 12 },
    segmentTextActive: { color: colors.primaryDark },

    // Toggle rows
    settingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 2 },
    settingHeaderCopy: { flex: 1, gap: 2 },
    rowTitle: { fontFamily: FONTS.sans, color: colors.foreground, fontWeight: "700", fontSize: 13 },
    smallText: { fontFamily: FONTS.sans, color: colors.muted, fontSize: 11, lineHeight: 16 },
    separator: { height: 1, backgroundColor: colors.border, marginVertical: 2 },

    // Link button
    linkButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingVertical: 12, paddingHorizontal: 12 },
    linkButtonText: { fontFamily: FONTS.sans, fontWeight: "700", color: colors.foreground, fontSize: 13 },

    footerHint: { fontFamily: FONTS.sans, fontSize: 10, color: colors.muted, textAlign: "center", marginTop: 8 },

    // Toast
    toast: {
      position: "absolute", bottom: 24, left: 16, right: 16,
      borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8,
      shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    toastSuccess: { backgroundColor: colors.success },
    toastError: { backgroundColor: colors.destructive },
    toastInfo: { backgroundColor: colors.primary },
    toastText: { flex: 1, fontFamily: FONTS.sans, fontSize: 13, color: "#fff", fontWeight: "700" },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    modalCard: { maxHeight: "84%", backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 12 },
    modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 4 },
    modalTitle: { fontFamily: FONTS.display, fontSize: 17, fontWeight: "800", color: colors.foreground },
    legalText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 20, color: colors.foreground },
  });
}
