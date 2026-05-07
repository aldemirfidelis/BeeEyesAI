import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from "react";
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
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { getAnonymousProfileVisitsUnlockMessage, hasAnonymousProfileVisitsUnlocked } from "@shared/unlocks";
import { PRIVACY_POLICY, TERMS_OF_USE } from "@mobile/lib/legalTexts";
import { api, getApiErrorMessage } from "@mobile/lib/api";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useAuthStore } from "@mobile/stores/authStore";
import { useUIStore } from "@mobile/stores/uiStore";

type MeResponse = {
  id: string;
  username: string;
  displayName?: string | null;
  gender?: string | null;
  bio?: string | null;
  language?: string;
  anonymousProfileVisitsEnabled?: boolean;
};


export default function SettingsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const themeMode = useUIStore((state) => state.themeMode);
  const profileImageUri = useUIStore((state) => state.profileImageUri);
  const setThemeMode = useUIStore((state) => state.setThemeMode);
  const setProfileImageUri = useUIStore((state) => state.setProfileImageUri);
  const authUser = useAuthStore((state) => state.user);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);

  const { data: me, isLoading: meLoading } = useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me").then((response) => response.data),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.displayName ?? "");
    setBio(me.bio ?? "");
  }, [me?.id]);

  const anonymousUnlocked = hasAnonymousProfileVisitsUnlocked(me ?? authUser);
  const anonymousEnabled = Boolean(me?.anonymousProfileVisitsEnabled ?? authUser?.anonymousProfileVisitsEnabled);

  const updatePreferences = useMutation({
    mutationFn: (payload: Partial<Pick<MeResponse, "anonymousProfileVisitsEnabled" | "displayName" | "bio">>) =>
      api.patch("/api/me/preferences", payload).then((response) => response.data as MeResponse),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["me"], updatedUser);
      setAuthUser(updatedUser);
      setFeedback(t("settings_preferences_updated"));
    },
    onError: (error: unknown) => setFeedback(getApiErrorMessage(error, t("settings_update_error"))),
  });

  const updatePassword = useMutation({
    mutationFn: () => api.patch("/api/me/password", { currentPassword, newPassword }).then((response) => response.data),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      Alert.alert(t("settings_password_changed"), t("settings_password_changed_msg"));
    },
    onError: (error: unknown) => Alert.alert(t("error"), getApiErrorMessage(error, t("settings_password_error"))),
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
    Alert.alert(t("settings_photo_updated"), t("settings_photo_updated_msg"));
  }

  function handleToggleAnonymous(value: boolean) {
    if (value && !anonymousUnlocked) {
      setFeedback(getAnonymousProfileVisitsUnlockMessage());
      return;
    }
    updatePreferences.mutate({ anonymousProfileVisitsEnabled: value });
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>{t("back")}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t("settings_title")}</Text>
          <View style={{ width: 68 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("settings_profile_photo")}</Text>
          <View style={styles.previewRow}>
            <View style={styles.avatar}>
              {profileImageUri ? <Image source={{ uri: profileImageUri }} style={styles.avatarImage} /> : <Text style={styles.avatarPlaceholder}>{t("settings_no_photo")}</Text>}
            </View>
            <Text style={styles.previewHelp}>{t("settings_photo_help")}</Text>
          </View>
          <View style={styles.rowButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={handlePickFromGallery}>
              <Text style={styles.primaryButtonText}>{t("settings_choose_photo")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={async () => { await setProfileImageUri(null); api.patch("/api/me/avatar", { avatarUrl: null }).catch(() => {}); }}>
              <Text style={styles.secondaryButtonText}>{t("settings_remove_photo")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("settings_display_name")}</Text>
          <Text style={styles.cardSubTitle}>{t("settings_display_name_sub")}</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder={t("settings_display_name_placeholder")} placeholderTextColor={colors.muted} />
          <TouchableOpacity style={styles.primaryButton} onPress={() => updatePreferences.mutate({ displayName })}>
            <Text style={styles.primaryButtonText}>{t("settings_save_name")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("settings_bio")}</Text>
          <Text style={styles.cardSubTitle}>{t("settings_bio_sub")}</Text>
          <TextInput style={[styles.input, styles.textArea]} value={bio} onChangeText={setBio} placeholder={t("settings_bio_placeholder")} placeholderTextColor={colors.muted} multiline maxLength={300} />
          <View style={styles.bioFooterRow}>
            <Text style={[styles.smallText, bio.length >= 280 && { color: colors.primaryDark }]}>{bio.length}/300</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => updatePreferences.mutate({ bio })}>
              <Text style={styles.primaryButtonText}>{t("settings_save_bio")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("settings_appearance")}</Text>
          <View style={styles.segmentRow}>
            <Segment label={t("settings_theme_light")} active={themeMode === "light"} onPress={() => setThemeMode("light")} styles={styles} />
            <Segment label={t("settings_theme_dark")} active={themeMode === "dark"} onPress={() => setThemeMode("dark")} styles={styles} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("settings_language")}</Text>
          <Text style={styles.cardSubTitle}>{t("settings_language_info")}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("settings_privacy")}</Text>

          <Text style={styles.sectionLabel}>{t("settings_anonymous_nav")}</Text>
          <View style={styles.settingHeader}>
            <View style={styles.settingHeaderCopy}>
              <Text style={styles.smallText}>{t("settings_anonymous_nav_desc")}</Text>
            </View>
            {meLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={anonymousEnabled}
                onValueChange={handleToggleAnonymous}
                disabled={!anonymousUnlocked || updatePreferences.isPending}
                thumbColor={anonymousEnabled ? "#111827" : "#f4f4f5"}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            )}
          </View>
          <Text style={styles.smallText}>{anonymousUnlocked ? t("settings_anonymous_unlocked") : getAnonymousProfileVisitsUnlockMessage()}</Text>

          <View style={styles.separator} />

          <Text style={styles.sectionLabel}>{t("settings_change_password_label")}</Text>
          <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} placeholder={t("settings_current_password")} placeholderTextColor={colors.muted} secureTextEntry />
          <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder={t("settings_new_password")} placeholderTextColor={colors.muted} secureTextEntry />
          <TouchableOpacity style={styles.secondaryButton} onPress={() => updatePassword.mutate()} disabled={!currentPassword || !newPassword || updatePassword.isPending}>
            <Text style={styles.secondaryButtonText}>{updatePassword.isPending ? t("settings_changing_password") : t("settings_change_password_btn")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("settings_legal")}</Text>
          <TouchableOpacity style={styles.linkButton} onPress={() => setLegalModal("privacy")}>
            <Text style={styles.linkButtonText}>{t("settings_privacy_policy")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={() => setLegalModal("terms")}>
            <Text style={styles.linkButtonText}>{t("settings_terms_of_use")}</Text>
          </TouchableOpacity>
        </View>

        {feedback ? <Text style={styles.feedbackMessage}>{feedback}</Text> : null}
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={legalModal !== null} animationType="slide" transparent onRequestClose={() => setLegalModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>{legalModal === "privacy" ? t("settings_privacy_policy") : t("settings_terms_of_use")}</Text>
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

function Segment({ label, active, onPress, styles }: { label: string; active: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <TouchableOpacity style={[styles.segment, active && styles.segmentActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 14, paddingBottom: 36 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    backButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    backButtonText: { fontFamily: FONTS.sans, color: colors.foreground, fontWeight: "700", fontSize: 12 },
    title: { fontFamily: FONTS.display, fontWeight: "700", fontSize: 22, color: colors.foreground },
    card: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
    cardTitle: { fontFamily: FONTS.sans, color: colors.foreground, fontWeight: "700", fontSize: 16 },
    cardSubTitle: { fontFamily: FONTS.sans, color: colors.muted, fontSize: 13, lineHeight: 19 },
    previewRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    avatarImage: { width: "100%", height: "100%" },
    avatarPlaceholder: { fontFamily: FONTS.sans, color: colors.muted, fontSize: 11 },
    previewHelp: { flex: 1, fontFamily: FONTS.sans, color: colors.muted, fontSize: 12, lineHeight: 18 },
    rowButtons: { flexDirection: "row", gap: 10 },
    primaryButton: { borderRadius: 12, backgroundColor: colors.primary, paddingVertical: 11, alignItems: "center", paddingHorizontal: 12 },
    primaryButtonText: { fontFamily: FONTS.sans, fontWeight: "700", color: "#1A1A1A", fontSize: 13 },
    secondaryButton: { borderRadius: 12, backgroundColor: colors.secondary, paddingVertical: 11, alignItems: "center", paddingHorizontal: 12 },
    secondaryButtonText: { fontFamily: FONTS.sans, fontWeight: "700", color: colors.foreground, fontSize: 13 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, color: colors.foreground, paddingHorizontal: 12, paddingVertical: 11, fontFamily: FONTS.sans, fontSize: 14 },
    textArea: { minHeight: 82, textAlignVertical: "top" },
    segmentRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    segment: { flexGrow: 1, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 10, alignItems: "center", backgroundColor: colors.background },
    segmentActive: { borderColor: colors.primary, backgroundColor: colors.primary + "26" },
    segmentText: { fontFamily: FONTS.sans, color: colors.foreground, fontWeight: "700", fontSize: 12 },
    segmentTextActive: { color: colors.primaryDark },
    settingHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    settingHeaderCopy: { flex: 1, gap: 4 },
    smallText: { fontFamily: FONTS.sans, color: colors.muted, fontSize: 12, lineHeight: 18 },
    separator: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
    sectionLabel: { fontFamily: FONTS.sans, color: colors.foreground, fontWeight: "700", fontSize: 13, marginBottom: 2 },
    bioFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    linkButton: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingVertical: 11, alignItems: "center" },
    linkButtonText: { fontFamily: FONTS.sans, fontWeight: "700", color: colors.foreground, fontSize: 13 },
    feedbackMessage: { fontFamily: FONTS.sans, color: colors.primaryDark, fontSize: 12, lineHeight: 18, textAlign: "center" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    modalCard: { maxHeight: "78%", backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 12 },
    legalText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 20, color: colors.foreground },
  });
}
