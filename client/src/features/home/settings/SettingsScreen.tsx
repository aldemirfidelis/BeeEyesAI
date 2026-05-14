import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, ChevronRight, FileText, Globe2, Lock, LogOut, Moon, Settings, Shield, Sun, UserRound, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MedalDetail, MedalGrid } from "@/components/MedalBadge";
import { MEDAL_BY_TYPE, type MedalSpec } from "@/lib/medals";
import { PRIVACY_POLICY, TERMS_OF_USE } from "@/lib/legalTexts";
import { apiFetch, getApiErrorMessage } from "@/features/home/shared/api";
import type { ThemeMode } from "@/lib/theme";
import type { Achievement, Friend, Testimonial, User } from "@/features/home/types";
import {
  defaultAdPreferences,
  loadAdPreferences,
  saveAdPreferences,
} from "@/lib/adService";
import { AD_INTEREST_OPTIONS, type AdFrequency, type UserAdPreferences } from "@/lib/ads";

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
  const [localMessage, setLocalMessage] = useState("");
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedMedal, setSelectedMedal] = useState<MedalSpec | null>(null);
  const [testimonialTarget, setTestimonialTarget] = useState("");
  const [testimonialText, setTestimonialText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAdSettings, setShowAdSettings] = useState(false);
  const [adPrefs, setAdPrefs] = useState<UserAdPreferences>(() => loadAdPreferences());
  const [adSaved, setAdSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? "");
    setBio(user.bio ?? "");
    setLanguage(user.language ?? "pt-BR");
  }, [user?.id, user?.displayName, user?.bio, user?.language]);

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

  const earnedTypes = useMemo(() => achievements.map((achievement) => achievement.type), [achievements]);
  const selectedAchievement = selectedMedal ? achievements.find((achievement) => achievement.type === selectedMedal.type) : null;

  async function savePreferences(payload: Partial<Pick<User, "displayName" | "bio" | "language">>) {
    setSaving(true);
    setLocalMessage("");
    try {
      const updated = await apiFetch<User>("/api/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      onUserUpdate(updated);
      setLocalMessage("Preferencias atualizadas.");
    } catch (error) {
      setLocalMessage(getApiErrorMessage(error, "Nao foi possivel atualizar agora."));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) return;
    setSaving(true);
    setLocalMessage("");
    try {
      await apiFetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setLocalMessage("Senha alterada com sucesso.");
    } catch (error) {
      setLocalMessage(getApiErrorMessage(error, "Nao foi possivel alterar a senha."));
    } finally {
      setSaving(false);
    }
  }

  async function sendTestimonial() {
    if (!testimonialTarget || !testimonialText.trim()) return;
    setSaving(true);
    setLocalMessage("");
    try {
      await apiFetch(`/api/users/${testimonialTarget}/testimonials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: testimonialText.trim() }),
      });
      setTestimonialText("");
      setTestimonialTarget("");
      setLocalMessage("Depoimento publicado.");
    } catch (error) {
      setLocalMessage(getApiErrorMessage(error, "Nao foi possivel publicar o depoimento."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bee-app-shell fixed inset-0 z-50 bg-background">
          <div className="h-full overflow-y-auto">
            <div className="sticky top-0 z-10 border-b border-border/60 bg-card/82 backdrop-blur-xl">
              <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="bee-hex flex h-9 w-9 items-center justify-center bg-primary/18 text-primary">
                    <Settings className="w-5 h-5" />
                  </span>
                  <h2 className="font-display text-lg font-semibold">Perfil e configuracoes</h2>
                </div>
                <Button variant="outline" onClick={onClose}>Fechar</Button>
              </div>
            </div>

            <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
              <Card className="bee-honeycomb p-4 space-y-4 overflow-hidden">
                <div className="flex items-center gap-2">
                  <UserRound className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Perfil</p>
                </div>
                <div className="flex items-center gap-3">
                  {profilePhotoUrl ? <img src={profilePhotoUrl} alt="Foto de perfil" className="w-16 h-16 rounded-full object-cover border-2 border-primary/30 shadow-md" /> : <div className="bee-hex w-16 h-16 bg-primary flex items-center justify-center text-lg font-black text-primary-foreground shadow-md">{(user?.username || "?")[0].toUpperCase()}</div>}
                  <div className="flex-1 min-w-0">
                    <p className="font-black truncate">{user?.displayName || user?.username}</p>
                    <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
                    {user?.bio && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{user.bio}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={onSelectProfilePhoto}><Camera className="w-4 h-4 mr-2" />Escolher foto</Button>
                  <Button className="flex-1" variant="outline" onClick={onRemoveProfilePhoto}>Remover</Button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Nome</label>
                    <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Seu nome de exibicao" />
                    <Button size="sm" disabled={saving} onClick={() => savePreferences({ displayName })}>Salvar nome</Button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Idioma</label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={language} onChange={(event) => { setLanguage(event.target.value); savePreferences({ language: event.target.value }); }}>
                      <option value="pt-BR">Portugues Brasil</option>
                      <option value="es">Espanhol</option>
                      <option value="en">Ingles</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Bio</label>
                  <Textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={300} className="min-h-[90px]" placeholder="Conte um pouco sobre voce" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{bio.length}/300</span>
                    <Button size="sm" disabled={saving} onClick={() => savePreferences({ bio })}>Salvar bio</Button>
                  </div>
                </div>
              </Card>

              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {themeMode === "dark" ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
                  <p className="text-sm font-semibold">Aparencia</p>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/45 p-1">
                  <Button variant={themeMode === "light" ? "default" : "outline"} onClick={() => onThemeSelect("light")}>Modo claro</Button>
                  <Button variant={themeMode === "dark" ? "default" : "outline"} onClick={() => onThemeSelect("dark")}>Modo escuro</Button>
                </div>
              </Card>

              <Card className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Privacidade e seguranca</p>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Navegacao anonima</p>
                    <p className="text-xs text-muted-foreground">Suas visitas em perfis deixam de mostrar seu nome.</p>
                  </div>
                  <Switch checked={anonymousProfileVisitsEnabled} onCheckedChange={onAnonymousProfileVisitsToggle} />
                </div>
                <div className="grid md:grid-cols-3 gap-2">
                  <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Senha atual" />
                  <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nova senha" />
                  <Button variant="outline" disabled={saving || !currentPassword || !newPassword} onClick={changePassword}><Lock className="w-4 h-4 mr-2" />Alterar senha</Button>
                </div>
              </Card>

              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Medalhas</p>
                    <p className="text-xs text-muted-foreground">{achievements.length} / {Object.keys(MEDAL_BY_TYPE).length} conquistadas</p>
                  </div>
                  <Globe2 className="w-4 h-4 text-primary" />
                </div>
                <MedalGrid earnedTypes={earnedTypes} onSelect={setSelectedMedal} />
              </Card>

              <Card className="p-4 space-y-3">
                <p className="text-sm font-semibold">Depoimentos</p>
                {testimonials.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum depoimento ainda.</p> : testimonials.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-background p-3">
                    <p className="text-xs font-semibold">{item.authorDisplayName || item.authorUsername || "Amigo"}</p>
                    <p className="mt-1 text-sm italic">{item.content}</p>
                  </div>
                ))}
                <div className="grid md:grid-cols-[220px_1fr_auto] gap-2">
                  <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={testimonialTarget} onChange={(event) => setTestimonialTarget(event.target.value)}>
                    <option value="">Escolher amigo</option>
                    {friends.map((friend) => <option key={friend.id} value={friend.id}>{friend.displayName || friend.username}</option>)}
                  </select>
                  <Input value={testimonialText} onChange={(event) => setTestimonialText(event.target.value)} maxLength={500} placeholder="Escreva um depoimento estilo Orkut" />
                  <Button disabled={saving || !testimonialTarget || !testimonialText.trim()} onClick={sendTestimonial}>Publicar</Button>
                </div>
              </Card>

              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Anúncios</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Anúncios discretos ajudam a manter a Bee funcionando. Você controla frequência,
                  interesses e privacidade. Assinantes premium não veem anúncios.
                </p>
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-between"
                  onClick={() => { setAdPrefs(loadAdPreferences()); setShowAdSettings(true); }}
                >
                  <span>Preferências de anúncios</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Card>

              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Legal</p>
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setLegalModal("privacy")}>Politica de Privacidade</Button>
                  <Button variant="outline" onClick={() => setLegalModal("terms")}>Termos de Uso</Button>
                </div>
              </Card>

              {(settingsMessage || localMessage) && <p className="text-xs rounded-lg border border-primary/40 bg-primary/10 p-2 text-primary">{localMessage || settingsMessage}</p>}

              <Button variant="outline" className="w-full flex items-center gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/60" onClick={onLogout}>
                <LogOut className="w-4 h-4" />
                Sair da conta
              </Button>
            </div>
          </div>

          {selectedMedal && (
            <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
                <MedalDetail spec={selectedMedal} earned={earnedTypes.includes(selectedMedal.type)} unlockedAt={selectedAchievement?.unlockedAt} />
                <Button className="mt-5 w-full" onClick={() => setSelectedMedal(null)}>Fechar</Button>
              </div>
            </div>
          )}

          {legalModal && (
            <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
              <div className="w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl border border-border bg-card p-5 max-h-[82vh] flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black">{legalModal === "privacy" ? "Politica de Privacidade" : "Termos de Uso"}</h3>
                  <Button variant="outline" size="sm" onClick={() => setLegalModal(null)}>Fechar</Button>
                </div>
                <pre className="whitespace-pre-wrap overflow-y-auto text-xs leading-relaxed text-foreground font-sans">{legalModal === "privacy" ? PRIVACY_POLICY : TERMS_OF_USE}</pre>
              </div>
            </div>
          )}

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
                setTimeout(() => setAdSaved(false), 2500);
              }}
              onClose={() => setShowAdSettings(false)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Ad Settings Modal ─────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS: { value: AdFrequency; label: string; desc: string }[] = [
  { value: "low",    label: "Baixa",   desc: "Máximo 1 anúncio por dia" },
  { value: "normal", label: "Normal",  desc: "Máximo 3 anúncios por dia" },
  { value: "high",   label: "Alta",    desc: "Máximo 5 anúncios por dia" },
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
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-bold text-base">Preferências de Anúncios</h3>
            <p className="text-xs text-muted-foreground">Controle como os anúncios aparecem</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Info */}
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground leading-relaxed">
              Os anúncios ajudam a manter a Bee funcionando. Você controla quais tipos de anúncios quer ver.
              Nunca usamos dados sensíveis, localização ou histórico de conversas para publicidade.
            </p>
          </div>

          {/* Personalized toggle */}
          <div className="rounded-xl border border-border bg-background p-4 space-y-3">
            <p className="text-sm font-semibold">Anúncios personalizados</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Permite que a Bee use seus interesses escolhidos abaixo para mostrar anúncios mais relevantes.
              Sem rastreamento fora do app.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {prefs.allowPersonalizedAds ? "Ativado" : "Desativado (apenas genéricos)"}
              </span>
              <Switch
                checked={prefs.allowPersonalizedAds}
                onCheckedChange={(v) => onPrefsChange({ ...prefs, allowPersonalizedAds: v })}
              />
            </div>
          </div>

          {/* Interests */}
          {prefs.allowPersonalizedAds && (
            <div className="rounded-xl border border-border bg-background p-4 space-y-3">
              <p className="text-sm font-semibold">Meus interesses</p>
              <p className="text-xs text-muted-foreground">Selecione os temas que fazem sentido para você.</p>
              <div className="flex flex-wrap gap-2">
                {AD_INTEREST_OPTIONS.map((interest) => {
                  const selected = prefs.selectedInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
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

          {/* Frequency */}
          <div className="rounded-xl border border-border bg-background p-4 space-y-3">
            <p className="text-sm font-semibold">Frequência de anúncios</p>
            <p className="text-xs text-muted-foreground">Com que frequência você quer ver anúncios?</p>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCY_OPTIONS.map((opt) => {
                const active = prefs.preferredAdFrequency === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onPrefsChange({ ...prefs, preferredAdFrequency: opt.value })}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}>
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hidden advertisers */}
          {prefs.hiddenAdvertisers.length > 0 && (
            <div className="rounded-xl border border-border bg-background p-4 space-y-2">
              <p className="text-sm font-semibold">Anunciantes ocultados</p>
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
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Privacy note */}
          <div className="flex items-start gap-2 rounded-xl border border-border bg-background p-3">
            <Lock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Suas preferências ficam armazenadas somente neste dispositivo.
              A Bee não compartilha informações de anúncios com terceiros sem sua autorização.
              Usuários assinantes premium não veem anúncios.
            </p>
          </div>
        </div>

        {/* Footer */}
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
