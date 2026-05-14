import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, FileText, Info, Settings, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MedalSpec } from "@/lib/medals";
import { PRIVACY_POLICY, TERMS_OF_USE } from "@/lib/legalTexts";
import { apiFetch, getApiErrorMessage } from "@/features/home/shared/api";
import { readPreference, setPreference, type ThemeMode, type ThemePreference } from "@/lib/theme";
import type { Achievement, Friend, Testimonial, User } from "@/features/home/types";
import {
  defaultAdPreferences,
  loadAdPreferences,
  saveAdPreferences,
} from "@/lib/adService";
import type { UserAdPreferences } from "@/lib/ads";
import { ProfileHeaderCard } from "./ProfileHeaderCard";
import { ProfileFormCard } from "./ProfileFormCard";
import { AppearanceCard } from "./AppearanceCard";
import { PrivacySecurityCard } from "./PrivacySecurityCard";
import { AchievementsCard } from "./AchievementsCard";
import { TestimonialsCard } from "./TestimonialsCard";
import { AdsCard, AdSettingsModal } from "./AdsCard";
import { LegalCard } from "./LegalCard";
import { AccountActionsCard } from "./AccountActionsCard";

interface SettingsScreenProps {
  show: boolean;
  user: User | null;
  profilePhotoUrl: string;
  themeMode: ThemeMode;
  settingsMessage: string;
  anonymousProfileVisitsEnabled: boolean;
  authHeaders: () => Record<string, string>;
  onClose: () => void;
  onUserUpdate: (user: User) => void;
  onSelectProfilePhoto: () => void;
  onRemoveProfilePhoto: () => void;
  onThemeSelect: (theme: ThemeMode) => void;
  onAnonymousProfileVisitsToggle: (next: boolean) => void;
  onLogout: () => void;
}

type Toast = { id: number; tone: "success" | "error" | "info"; text: string };

export function SettingsScreen(props: SettingsScreenProps) {
  const {
    show,
    user,
    profilePhotoUrl,
    settingsMessage,
    anonymousProfileVisitsEnabled,
    authHeaders,
    onClose,
    onUserUpdate,
    onSelectProfilePhoto,
    onRemoveProfilePhoto,
    onThemeSelect,
    onAnonymousProfileVisitsToggle,
    onLogout,
  } = props;

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [language, setLanguage] = useState("pt-BR");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedMedal, setSelectedMedal] = useState<MedalSpec | null>(null);
  const [testimonialTarget, setTestimonialTarget] = useState("");
  const [testimonialText, setTestimonialText] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldSaving, setFieldSaving] = useState<{ name?: boolean; bio?: boolean; language?: boolean }>({});
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; bio?: string }>({});
  const [showAdSettings, setShowAdSettings] = useState(false);
  const [adPrefs, setAdPrefs] = useState<UserAdPreferences>(() => loadAdPreferences());
  const [adSaved, setAdSaved] = useState(false);
  const [themePref, setThemePref] = useState<ThemePreference>(() => readPreference());
  const [toasts, setToasts] = useState<Toast[]>([]);

  function pushToast(tone: Toast["tone"], text: string) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tone, text }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? "");
    setBio(user.bio ?? "");
    setLanguage(user.language ?? "pt-BR");
  }, [user?.id, user?.displayName, user?.bio, user?.language]);

  useEffect(() => {
    if (show) setThemePref(readPreference());
  }, [show]);

  useEffect(() => {
    if (!show || !user) return;
    Promise.all([
      apiFetch<Achievement[]>("/api/achievements", { headers: authHeaders() }).catch(() => []),
      apiFetch<Testimonial[]>(`/api/users/${user.id}/testimonials`, { headers: authHeaders() }).catch(() => []),
      apiFetch<Friend[]>("/api/friends", { headers: authHeaders() }).catch(() => []),
    ]).then(([achievementData, testimonialData, friendData]) => {
      setAchievements(Array.isArray(achievementData) ? achievementData : []);
      setTestimonials(Array.isArray(testimonialData) ? testimonialData : []);
      setFriends(Array.isArray(friendData) ? friendData : []);
    });
  }, [show, user?.id]);

  const earnedTypes = useMemo(() => achievements.map((a) => a.type), [achievements]);

  async function savePreferences(
    payload: Partial<Pick<User, "displayName" | "bio" | "language">>,
    field: "name" | "bio" | "language",
  ) {
    setSaving(true);
    setFieldSaving((s) => ({ ...s, [field]: true }));
    try {
      const updated = await apiFetch<User>("/api/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      onUserUpdate(updated);
      pushToast(
        "success",
        field === "language" ? "Idioma atualizado." : `${field === "name" ? "Nome" : "Bio"} atualizada.`,
      );
    } catch (error) {
      pushToast("error", getApiErrorMessage(error, "Não foi possível atualizar agora."));
    } finally {
      setSaving(false);
      setFieldSaving((s) => ({ ...s, [field]: false }));
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) return;
    setPasswordError(undefined);
    setSaving(true);
    try {
      await apiFetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      pushToast("success", "Senha alterada com sucesso. 🐝");
    } catch (error) {
      const msg = getApiErrorMessage(error, "Não foi possível alterar a senha.");
      setPasswordError(msg);
      pushToast("error", msg);
    } finally {
      setSaving(false);
    }
  }

  async function sendTestimonial() {
    if (!testimonialTarget || !testimonialText.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/users/${testimonialTarget}/testimonials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: testimonialText.trim() }),
      });
      setTestimonialText("");
      setTestimonialTarget("");
      pushToast("success", "Depoimento publicado. 💛");
    } catch (error) {
      pushToast("error", getApiErrorMessage(error, "Não foi possível publicar o depoimento."));
    } finally {
      setSaving(false);
    }
  }

  function handleThemePref(pref: ThemePreference) {
    setPreference(pref);
    setThemePref(pref);
    if (pref !== "system") {
      onThemeSelect(pref);
    } else {
      const resolved: ThemeMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      onThemeSelect(resolved);
    }
    pushToast(
      "info",
      pref === "system" ? "Aparência segue o sistema." : `Modo ${pref === "dark" ? "escuro" : "claro"} aplicado.`,
    );
  }

  function handleSaveName() {
    if (displayName.trim().length === 0) {
      setFieldErrors((p) => ({ ...p, name: "O nome não pode ficar vazio." }));
      return;
    }
    setFieldErrors((p) => ({ ...p, name: undefined }));
    savePreferences({ displayName: displayName.trim() }, "name");
  }

  function handleSaveBio() {
    if (bio.length > 300) {
      setFieldErrors((p) => ({ ...p, bio: "Bio acima do limite de 300 caracteres." }));
      return;
    }
    setFieldErrors((p) => ({ ...p, bio: undefined }));
    savePreferences({ bio }, "bio");
  }

  function handleLanguageChange(v: string) {
    setLanguage(v);
    savePreferences({ language: v }, "language");
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="bee-app-shell fixed inset-0 z-50 bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Perfil e configurações"
        >
          <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-border/60 bg-card/85 backdrop-blur-xl">
              <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="bee-hex flex h-9 w-9 items-center justify-center bg-primary/18 text-primary shrink-0">
                    <Settings className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-base sm:text-lg font-bold leading-tight">
                      Perfil e configurações
                    </h2>
                    <p className="text-[11px] text-muted-foreground hidden sm:block">
                      Gerencie sua conta, aparência e privacidade
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={onClose} aria-label="Fechar configurações">
                  <X className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Fechar</span>
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-3 pb-24">
              {/* Mensagem global (legacy) */}
              {settingsMessage ? (
                <div className="rounded-xl border border-primary/30 bg-primary/8 px-3 py-2 text-xs text-primary font-medium flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  {settingsMessage}
                </div>
              ) : null}

              <ProfileHeaderCard
                user={user}
                avatarUrl={profilePhotoUrl}
                totalAchievements={achievements.length}
                totalFriends={friends.length}
                totalActiveDays={user?.currentStreak ?? 0}
                onSelectPhoto={onSelectProfilePhoto}
              />

              <SectionDivider label="Seu perfil" />

              <ProfileFormCard
                user={user}
                avatarUrl={profilePhotoUrl}
                displayName={displayName}
                bio={bio}
                language={language}
                saving={saving}
                fieldSaving={fieldSaving}
                fieldErrors={fieldErrors}
                onDisplayNameChange={setDisplayName}
                onBioChange={setBio}
                onLanguageChange={handleLanguageChange}
                onSaveName={handleSaveName}
                onSaveBio={handleSaveBio}
                onSelectPhoto={onSelectProfilePhoto}
                onRemovePhoto={onRemoveProfilePhoto}
              />

              <SectionDivider label="Aparência e privacidade" />

              <AppearanceCard preference={themePref} onSelect={handleThemePref} />

              <PrivacySecurityCard
                anonymousProfileVisitsEnabled={anonymousProfileVisitsEnabled}
                onAnonymousToggle={onAnonymousProfileVisitsToggle}
                currentPassword={currentPassword}
                newPassword={newPassword}
                setCurrentPassword={setCurrentPassword}
                setNewPassword={setNewPassword}
                onChangePassword={changePassword}
                saving={saving}
                passwordError={passwordError}
              />

              <SectionDivider label="Reconhecimento" />

              <AchievementsCard
                earnedTypes={earnedTypes}
                achievements={achievements}
                selectedMedal={selectedMedal}
                onSelect={setSelectedMedal}
              />

              <TestimonialsCard
                testimonials={testimonials}
                friends={friends}
                testimonialTarget={testimonialTarget}
                testimonialText={testimonialText}
                setTestimonialTarget={setTestimonialTarget}
                setTestimonialText={setTestimonialText}
                onSubmit={sendTestimonial}
                saving={saving}
              />

              <SectionDivider label="Anúncios e legal" />

              <AdsCard
                onOpenAdSettings={() => {
                  setAdPrefs(loadAdPreferences());
                  setShowAdSettings(true);
                }}
              />

              <LegalCard onOpenPrivacy={() => setLegalModal("privacy")} onOpenTerms={() => setLegalModal("terms")} />

              <SectionDivider label="Conta" />

              <AccountActionsCard user={user} onLogout={onLogout} />

              <p className="text-center text-[10px] text-muted-foreground py-4">BeeEyes 🐝 · feito com carinho</p>
            </div>
          </div>

          {/* Legal modal */}
          {legalModal && (
            <div
              className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
              role="dialog"
              aria-modal="true"
              aria-label={legalModal === "privacy" ? "Política de Privacidade" : "Termos de Uso"}
              onClick={(e) => {
                if (e.target === e.currentTarget) setLegalModal(null);
              }}
            >
              <div className="w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl border border-border bg-card p-4 sm:p-5 max-h-[88vh] flex flex-col gap-3 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <h3 className="font-display font-bold">
                      {legalModal === "privacy" ? "Política de Privacidade" : "Termos de Uso"}
                    </h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setLegalModal(null)} aria-label="Fechar modal">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <pre className="whitespace-pre-wrap overflow-y-auto text-xs leading-relaxed text-foreground font-sans px-1">
                  {legalModal === "privacy" ? PRIVACY_POLICY : TERMS_OF_USE}
                </pre>
              </div>
            </div>
          )}

          {/* Ad settings modal */}
          {showAdSettings && (
            <AdSettingsModal
              prefs={adPrefs}
              saved={adSaved}
              onPrefsChange={setAdPrefs}
              onSave={() => {
                saveAdPreferences({
                  ...adPrefs,
                  consentGiven: adPrefs.allowPersonalizedAds ? true : adPrefs.consentGiven,
                  consentGivenAt:
                    adPrefs.allowPersonalizedAds && !adPrefs.consentGiven
                      ? new Date().toISOString()
                      : adPrefs.consentGivenAt,
                  lastUpdatedAt: new Date().toISOString(),
                });
                setAdSaved(true);
                pushToast("success", "Preferências de anúncios salvas.");
                setTimeout(() => setAdSaved(false), 2500);
              }}
              onClose={() => setShowAdSettings(false)}
            />
          )}

          {/* Toasts */}
          <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] space-y-2 px-4 w-full max-w-sm pointer-events-none"
            aria-live="polite"
          >
            <AnimatePresence>
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className={`pointer-events-auto rounded-xl border shadow-lg px-3 py-2.5 text-xs font-medium backdrop-blur-md flex items-center gap-2 ${
                    t.tone === "success"
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : t.tone === "error"
                      ? "border-destructive/40 bg-destructive/15 text-destructive"
                      : "border-primary/40 bg-primary/15 text-primary"
                  }`}
                  role="status"
                >
                  {t.tone === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : t.tone === "error" ? (
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Info className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{t.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2" aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}

// Re-export for backward compatibility with any direct imports
export { defaultAdPreferences };
