import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, FileText, Lock, Settings, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { AD_INTEREST_OPTIONS, type AdFrequency, type UserAdPreferences } from "@/lib/ads";
import {
  ProfileHeaderCard,
  ProfileFormCard,
  AppearanceCard,
  PrivacySecurityCard,
  AchievementsCard,
  TestimonialsCard,
  AdsCard,
  LegalCard,
  AccountActionsCard,
} from "./SettingsCards";

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
    show, user, profilePhotoUrl, themeMode, settingsMessage,
    anonymousProfileVisitsEnabled,
    authHeaders, onClose, onUserUpdate, onSelectProfilePhoto, onRemoveProfilePhoto,
    onThemeSelect, onAnonymousProfileVisitsToggle, onLogout,
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
      pushToast("success", field === "language" ? "Idioma atualizado." : `${field === "name" ? "Nome" : "Bio"} atualizada.`);
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
    // Mantém compatibilidade com o handler do Home (light/dark)
    if (pref !== "system") {
      onThemeSelect(pref);
    } else {
      const resolved: ThemeMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      onThemeSelect(resolved);
    }
    pushToast("info", pref === "system" ? "Aparência segue o sistema." : `Modo ${pref === "dark" ? "escuro" : "claro"} aplicado.`);
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
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="bee-app-shell fixed inset-0 z-50 bg-background"
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
                    <h2 className="font-display text-base sm:text-lg font-bold leading-tight">Perfil e configurações</h2>
                    <p className="text-[11px] text-muted-foreground hidden sm:block">Gerencie sua conta, aparência e privacidade</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={onClose} aria-label="Fechar configurações">
                  <X className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Fechar</span>
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-3">
              {/* Mensagem global (legacy) */}
              {settingsMessage ? (
                <div className="rounded-xl border border-primary/30 bg-primary/8 px-3 py-2 text-xs text-primary font-medium">
                  {settingsMessage}
                </div>
              ) : null}

              <ProfileHeaderCard
                user={user}
                avatarUrl={profilePhotoUrl}
                totalAchievements={achievements.length}
                totalFriends={friends.length}
                totalActiveDays={user?.currentStreak ?? 0}
              />

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

              <AdsCard onOpenAdSettings={() => { setAdPrefs(loadAdPreferences()); setShowAdSettings(true); }} />

              <LegalCard
                onOpenPrivacy={() => setLegalModal("privacy")}
                onOpenTerms={() => setLegalModal("terms")}
              />

              <AccountActionsCard user={user} onLogout={onLogout} />

              <p className="text-center text-[10px] text-muted-foreground py-4">
                BeeEyes 🐝 · feito com carinho
              </p>
            </div>
          </div>

          {/* Legal modal */}
          {legalModal && (
            <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
              <div className="w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl border border-border bg-card p-4 sm:p-5 max-h-[88vh] flex flex-col gap-3">
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
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] space-y-2 px-4 w-full max-w-sm pointer-events-none">
            <AnimatePresence>
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className={`pointer-events-auto rounded-xl border shadow-lg px-3 py-2.5 text-xs font-medium backdrop-blur-md ${
                    t.tone === "success"
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : t.tone === "error"
                      ? "border-destructive/40 bg-destructive/15 text-destructive"
                      : "border-primary/40 bg-primary/15 text-primary"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {t.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Ad Settings Modal ─────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS: { value: AdFrequency; label: string; desc: string }[] = [
  { value: "low",    label: "Baixa",   desc: "Máx. 1/dia" },
  { value: "normal", label: "Normal",  desc: "Máx. 3/dia" },
  { value: "high",   label: "Alta",    desc: "Máx. 5/dia" },
];

interface AdSettingsModalProps {
  prefs: UserAdPreferences;
  saved: boolean;
  onPrefsChange: (prefs: UserAdPreferences) => void;
  onSave: () => void;
  onClose: () => void;
}

function AdSettingsModal({ prefs, saved, onPrefsChange, onSave, onClose }: AdSettingsModalProps) {
  function toggleInterest(interest: string) {
    onPrefsChange({
      ...prefs,
      selectedInterests: prefs.selectedInterests.includes(interest)
        ? prefs.selectedInterests.filter((i) => i !== interest)
        : [...prefs.selectedInterests, interest],
    });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl border border-border bg-card max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-display font-bold text-base">Preferências de anúncios</h3>
            <p className="text-xs text-muted-foreground">Controle como os anúncios aparecem</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} aria-label="Fechar">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/8 p-3">
            <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground leading-relaxed">
              Os anúncios ajudam a manter a Bee funcionando. Você controla quais tipos quer ver. Nunca usamos dados
              sensíveis, localização ou conversas para publicidade.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">Anúncios personalizados</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  A Bee usa seus interesses escolhidos abaixo para anúncios mais relevantes. Sem rastreamento fora do app.
                </p>
              </div>
              <Switch
                checked={prefs.allowPersonalizedAds}
                onCheckedChange={(v) => onPrefsChange({ ...prefs, allowPersonalizedAds: v })}
                aria-label="Anúncios personalizados"
              />
            </div>
          </div>

          {prefs.allowPersonalizedAds && (
            <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
              <p className="text-sm font-bold">Meus interesses</p>
              <p className="text-[11px] text-muted-foreground">Selecione os temas relevantes para você.</p>
              <div className="flex flex-wrap gap-2">
                {AD_INTEREST_OPTIONS.map((interest) => {
                  const selected = prefs.selectedInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      aria-pressed={selected}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" />}
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
            <p className="text-sm font-bold">Frequência</p>
            <p className="text-[11px] text-muted-foreground">Com que frequência você quer ver anúncios?</p>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCY_OPTIONS.map((opt) => {
                const active = prefs.preferredAdFrequency === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onPrefsChange({ ...prefs, preferredAdFrequency: opt.value })}
                    aria-pressed={active}
                    className={`rounded-xl border p-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <p className={`text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}>{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {prefs.hiddenAdvertisers.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-1.5">
              <p className="text-sm font-bold">Anunciantes ocultados</p>
              {prefs.hiddenAdvertisers.map((adv) => (
                <div key={adv} className="flex items-center justify-between py-1">
                  <span className="text-sm">{adv}</span>
                  <button
                    onClick={() =>
                      onPrefsChange({
                        ...prefs,
                        hiddenAdvertisers: prefs.hiddenAdvertisers.filter((a) => a !== adv),
                      })
                    }
                    className="p-1 rounded-lg hover:bg-muted transition-colors"
                    aria-label={`Remover ${adv} da lista de ocultos`}
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/40 p-3">
            <Lock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Suas preferências ficam neste dispositivo. A Bee não compartilha informações de anúncios com terceiros sem
              sua autorização. Assinantes premium não veem anúncios.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <Button className="w-full flex items-center gap-2" onClick={onSave}>
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Preferências salvas!
              </>
            ) : (
              "Salvar preferências"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Re-export for backward compatibility with any direct imports
export { defaultAdPreferences };
