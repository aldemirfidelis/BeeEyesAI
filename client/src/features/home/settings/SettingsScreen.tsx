import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, FileText, Globe2, Lock, LogOut, Moon, Settings, Shield, Sun, UserRound } from "lucide-react";
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

interface SettingsScreenProps {
  show: boolean;
  user: User | null;
  profilePhotoUrl: string;
  themeMode: ThemeMode;
  settingsMessage: string;
  anonymousProfileVisitsEnabled: boolean;
  anonymousProfileVisitsUnlocked: boolean;
  anonymousProfileVisitsUnlockHint: string;
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
    anonymousProfileVisitsEnabled, anonymousProfileVisitsUnlocked, anonymousProfileVisitsUnlockHint,
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background">
          <div className="h-full overflow-y-auto">
            <div className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur-sm">
              <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  <h2 className="font-display text-lg font-semibold">Perfil e configuracoes</h2>
                </div>
                <Button variant="outline" onClick={onClose}>Fechar</Button>
              </div>
            </div>

            <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
              <Card className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <UserRound className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Perfil</p>
                </div>
                <div className="flex items-center gap-3">
                  {profilePhotoUrl ? <img src={profilePhotoUrl} alt="Foto de perfil" className="w-16 h-16 rounded-full object-cover border" /> : <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-lg font-black text-primary-foreground">{(user?.username || "?")[0].toUpperCase()}</div>}
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
                <div className="grid grid-cols-2 gap-2">
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
                  <Switch checked={anonymousProfileVisitsEnabled} disabled={!anonymousProfileVisitsUnlocked} onCheckedChange={onAnonymousProfileVisitsToggle} />
                </div>
                <p className="rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">{anonymousProfileVisitsUnlocked ? "Recurso liberado." : anonymousProfileVisitsUnlockHint}</p>
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
