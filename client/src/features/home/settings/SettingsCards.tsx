import { useMemo, useState, type ReactNode } from "react";
import {
  Award, Camera, Check, ChevronRight, Filter, Globe2, Lock, LogOut,
  MessageSquare, Moon, Quote, Shield, Sparkles, Sun, Trash2, UserRound, Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { MedalGrid, MedalDetail } from "@/components/MedalBadge";
import { MEDAL_BY_TYPE, MEDAL_CATALOG, TIER_COLORS, type MedalSpec, type MedalTier } from "@/lib/medals";
import type { ThemePreference } from "@/lib/theme";
import type { Achievement, Friend, Testimonial, User } from "@/features/home/types";

// ── Generic shells ────────────────────────────────────────────────────────────

interface SettingsCardProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  tone?: "default" | "highlight" | "destructive";
}

export function SettingsCard({ icon, title, description, action, children, tone = "default" }: SettingsCardProps) {
  const toneClasses =
    tone === "highlight"
      ? "border-primary/30 bg-gradient-to-br from-primary/8 via-card to-card"
      : tone === "destructive"
      ? "border-destructive/20 bg-card"
      : "border-border/70 bg-card";
  return (
    <Card className={`overflow-hidden shadow-sm ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {icon ? (
            <span className="bee-hex flex h-9 w-9 shrink-0 items-center justify-center bg-primary/12 text-primary">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="font-display text-sm font-bold leading-tight">{title}</p>
            {description ? (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className="px-4 pb-4 space-y-3">{children}</div>
    </Card>
  );
}

interface SettingsRowProps {
  title: string;
  description?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}

export function SettingsRow({ title, description, trailing, onClick }: SettingsRowProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`w-full text-left flex items-center justify-between gap-3 py-2.5 ${
        onClick ? "hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description ? <p className="text-xs text-muted-foreground mt-0.5">{description}</p> : null}
      </div>
      {trailing}
    </Comp>
  );
}

// ── Profile completeness ──────────────────────────────────────────────────────

export function profileCompleteness(user: User | null, avatarUrl: string): { percent: number; missing: string[] } {
  if (!user) return { percent: 0, missing: [] };
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: "Nome", ok: Boolean(user.displayName && user.displayName.trim().length > 0) },
    { label: "Foto", ok: Boolean(avatarUrl) },
    { label: "Bio", ok: Boolean(user.bio && user.bio.trim().length >= 12) },
    { label: "Idioma", ok: Boolean(user.language) },
    { label: "E-mail", ok: Boolean(user.email && user.email.length > 0) },
  ];
  const done = checks.filter((c) => c.ok).length;
  const percent = Math.round((done / checks.length) * 100);
  return { percent, missing: checks.filter((c) => !c.ok).map((c) => c.label) };
}

// ── Profile header ────────────────────────────────────────────────────────────

interface ProfileHeaderCardProps {
  user: User | null;
  avatarUrl: string;
  totalAchievements: number;
  totalFriends?: number;
  totalActiveDays?: number;
}

export function ProfileHeaderCard({ user, avatarUrl, totalAchievements, totalFriends, totalActiveDays }: ProfileHeaderCardProps) {
  const initials = (user?.displayName || user?.username || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const completeness = useMemo(() => profileCompleteness(user, avatarUrl), [user, avatarUrl]);

  return (
    <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.displayName || user?.username || "Foto de perfil"}
                className="h-24 w-24 rounded-full object-cover ring-4 ring-primary/30 ring-offset-2 ring-offset-background shadow-md"
              />
            ) : (
              <div className="bee-hex h-24 w-24 bg-primary flex items-center justify-center text-2xl font-black text-primary-foreground shadow-md">
                {initials || "🐝"}
              </div>
            )}
            <span
              aria-hidden
              className="absolute -bottom-1 -right-1 rounded-full border-2 border-background bg-primary text-primary-foreground text-[10px] font-black px-2 py-0.5"
              title={`Nível ${user?.level ?? 1}`}
            >
              Nv {user?.level ?? 1}
            </span>
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h2 className="font-display text-xl font-black truncate">
                {user?.displayName || user?.username || "Sua conta"}
              </h2>
              <span className="rounded-full bg-primary/12 text-primary text-[10px] font-bold px-2 py-0.5">
                {user?.xp ?? 0} XP
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
            {user?.bio ? (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{user.bio}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground/70 mt-2">
                Conte um pouco sobre você ✨
              </p>
            )}
          </div>
        </div>

        {/* Progresso do perfil */}
        <div className="rounded-xl border border-border/60 bg-background/40 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-bold text-foreground">Perfil {completeness.percent}% completo</p>
            {completeness.missing.length > 0 ? (
              <p className="text-[10px] text-muted-foreground truncate max-w-[55%]" title={`Faltando: ${completeness.missing.join(", ")}`}>
                Faltando: {completeness.missing.slice(0, 2).join(", ")}{completeness.missing.length > 2 ? "…" : ""}
              </p>
            ) : (
              <span className="text-[10px] text-emerald-600 font-bold">Tudo certo! 🐝</span>
            )}
          </div>
          <Progress value={completeness.percent} className="h-2" />
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile icon={<Award className="w-3.5 h-3.5" />} label="Medalhas" value={`${totalAchievements}/${Object.keys(MEDAL_BY_TYPE).length}`} />
          <StatTile icon={<Users className="w-3.5 h-3.5" />} label="Amigos" value={totalFriends ?? 0} />
          <StatTile icon={<Sparkles className="w-3.5 h-3.5" />} label="Dias ativos" value={totalActiveDays ?? user?.currentStreak ?? 0} />
        </div>
      </div>
    </Card>
  );
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-2 py-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-primary">
        {icon}
      </div>
      <p className="text-base font-black mt-0.5">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Profile photo + form ──────────────────────────────────────────────────────

interface ProfileFormCardProps {
  user: User | null;
  avatarUrl: string;
  displayName: string;
  bio: string;
  language: string;
  saving: boolean;
  fieldSaving: { name?: boolean; bio?: boolean; language?: boolean };
  fieldErrors: { name?: string; bio?: string };
  onDisplayNameChange: (v: string) => void;
  onBioChange: (v: string) => void;
  onLanguageChange: (v: string) => void;
  onSaveName: () => void;
  onSaveBio: () => void;
  onSelectPhoto: () => void;
  onRemovePhoto: () => void;
}

const BIO_MAX = 300;
const NAME_MAX = 60;

export function ProfileFormCard(props: ProfileFormCardProps) {
  const { user, avatarUrl, displayName, bio, language, saving, fieldSaving, fieldErrors,
    onDisplayNameChange, onBioChange, onLanguageChange, onSaveName, onSaveBio,
    onSelectPhoto, onRemovePhoto } = props;

  const nameLen = displayName?.length ?? 0;
  const bioLen = bio?.length ?? 0;
  const bioWarn = bioLen > BIO_MAX - 30;
  const bioOver = bioLen > BIO_MAX;
  const nameChanged = (user?.displayName ?? "") !== displayName;
  const bioChanged = (user?.bio ?? "") !== bio;

  return (
    <SettingsCard
      icon={<UserRound className="w-4 h-4" />}
      title="Informações pessoais"
      description="Como você aparece para os outros"
    >
      {/* Foto */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
        <div className="flex items-center gap-3 flex-1">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-primary/30" />
          ) : (
            <div className="bee-hex h-14 w-14 bg-primary flex items-center justify-center text-base font-black text-primary-foreground">
              {(user?.username || "?")[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">Foto de perfil</p>
            <p className="text-xs text-muted-foreground">JPG ou PNG, até 5MB</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSelectPhoto} aria-label="Escolher foto de perfil">
            <Camera className="w-3.5 h-3.5 mr-1.5" /> Trocar
          </Button>
          {avatarUrl ? (
            <Button size="sm" variant="outline" onClick={onRemovePhoto} aria-label="Remover foto de perfil">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Nome */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="settings-name" className="text-xs font-bold text-muted-foreground">Nome</label>
          <span className={`text-[10px] font-mono ${nameLen > NAME_MAX ? "text-destructive" : "text-muted-foreground"}`}>
            {nameLen}/{NAME_MAX}
          </span>
        </div>
        <Input
          id="settings-name"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="Seu nome de exibição"
          maxLength={NAME_MAX + 10}
          aria-invalid={fieldErrors.name ? true : undefined}
          className={fieldErrors.name ? "border-destructive focus-visible:ring-destructive/50" : undefined}
        />
        {fieldErrors.name ? (
          <p className="text-[11px] text-destructive">{fieldErrors.name}</p>
        ) : null}
        <div className="flex justify-end">
          <Button size="sm" disabled={saving || !nameChanged || nameLen === 0} onClick={onSaveName}>
            {fieldSaving.name ? "Salvando..." : "Salvar nome"}
          </Button>
        </div>
      </div>

      {/* Idioma */}
      <div className="space-y-1.5">
        <label htmlFor="settings-language" className="text-xs font-bold text-muted-foreground">Idioma</label>
        <div className="relative">
          <Globe2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <select
            id="settings-language"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-busy={fieldSaving.language || undefined}
          >
            <option value="pt-BR">🇧🇷 Português (Brasil)</option>
            <option value="es">🇪🇸 Español</option>
            <option value="en">🇺🇸 English</option>
          </select>
        </div>
      </div>

      {/* Bio */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="settings-bio" className="text-xs font-bold text-muted-foreground">Bio</label>
          <span className={`text-[10px] font-mono ${bioOver ? "text-destructive" : bioWarn ? "text-amber-600" : "text-muted-foreground"}`}>
            {bioLen}/{BIO_MAX}
          </span>
        </div>
        <Textarea
          id="settings-bio"
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          maxLength={BIO_MAX + 50}
          rows={3}
          placeholder="Conte um pouco sobre você"
          aria-invalid={fieldErrors.bio ? true : undefined}
          className={`min-h-[80px] resize-none ${bioOver ? "border-destructive focus-visible:ring-destructive/50" : ""}`}
        />
        {fieldErrors.bio ? (
          <p className="text-[11px] text-destructive">{fieldErrors.bio}</p>
        ) : null}
        <div className="flex justify-end">
          <Button size="sm" disabled={saving || !bioChanged || bioOver} onClick={onSaveBio}>
            {fieldSaving.bio ? "Salvando..." : "Salvar bio"}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

// ── Appearance (theme) ────────────────────────────────────────────────────────

interface AppearanceCardProps {
  preference: ThemePreference;
  onSelect: (pref: ThemePreference) => void;
}

export function AppearanceCard({ preference, onSelect }: AppearanceCardProps) {
  const options: Array<{ value: ThemePreference; label: string; icon: ReactNode; desc: string }> = [
    { value: "light",  label: "Claro",      icon: <Sun className="w-4 h-4" />,    desc: "Mais luminoso" },
    { value: "dark",   label: "Escuro",     icon: <Moon className="w-4 h-4" />,   desc: "Mais confortável à noite" },
    { value: "system", label: "Automático", icon: <Sparkles className="w-4 h-4" />, desc: "Segue o sistema" },
  ];

  return (
    <SettingsCard
      icon={preference === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      title="Aparência"
      description="Escolha como a Bee aparece para você"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = preference === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              aria-pressed={active}
              className={`group rounded-xl border p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                active
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-background/40 hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-1.5 text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}>
                  {opt.icon}
                  {opt.label}
                </span>
                {active ? <Check className="w-4 h-4 text-primary" /> : null}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{opt.desc}</p>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}

// ── Privacy & Security ────────────────────────────────────────────────────────

interface PrivacySecurityCardProps {
  anonymousProfileVisitsEnabled: boolean;
  onAnonymousToggle: (next: boolean) => void;
  currentPassword: string;
  newPassword: string;
  setCurrentPassword: (v: string) => void;
  setNewPassword: (v: string) => void;
  onChangePassword: () => void;
  saving: boolean;
  passwordError?: string;
}

export function PrivacySecurityCard(props: PrivacySecurityCardProps) {
  const {
    anonymousProfileVisitsEnabled, onAnonymousToggle,
    currentPassword, newPassword, setCurrentPassword, setNewPassword,
    onChangePassword, saving, passwordError,
  } = props;

  const passwordValid = newPassword.length >= 8 && /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword);

  return (
    <>
      <SettingsCard
        icon={<Shield className="w-4 h-4" />}
        title="Privacidade"
        description="Controle quem vê sua atividade"
      >
        <SettingsRow
          title="Navegação anônima"
          description="Suas visitas em perfis deixam de mostrar seu nome."
          trailing={<Switch checked={anonymousProfileVisitsEnabled} onCheckedChange={onAnonymousToggle} aria-label="Navegação anônima" />}
        />
        <SettingsRow
          title="Conta privada"
          description="Em breve · Só amigos verão seu perfil"
          trailing={<Switch checked={false} disabled aria-label="Conta privada (em breve)" />}
        />
        <SettingsRow
          title="Mostrar status online"
          description="Em breve · Amigos veem quando você está ativo"
          trailing={<Switch checked={true} disabled aria-label="Status online (em breve)" />}
        />
        <SettingsRow
          title="Mensagens de desconhecidos"
          description="Em breve · Receber DMs de pessoas fora da sua rede"
          trailing={<Switch checked={false} disabled aria-label="Mensagens de desconhecidos (em breve)" />}
        />
      </SettingsCard>

      <SettingsCard
        icon={<Lock className="w-4 h-4" />}
        title="Segurança da conta"
        description="Mantenha seu acesso protegido"
      >
        <div className="space-y-2">
          <label htmlFor="current-pw" className="text-xs font-bold text-muted-foreground">Senha atual</label>
          <Input
            id="current-pw"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Digite sua senha atual"
            autoComplete="current-password"
          />
          <label htmlFor="new-pw" className="text-xs font-bold text-muted-foreground">Nova senha</label>
          <Input
            id="new-pw"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres, com letra e número"
            autoComplete="new-password"
            aria-invalid={newPassword.length > 0 && !passwordValid ? true : undefined}
          />
          {newPassword.length > 0 && !passwordValid ? (
            <p className="text-[11px] text-amber-600">
              A senha precisa ter ao menos 8 caracteres, contendo letra e número.
            </p>
          ) : null}
          {passwordError ? (
            <p className="text-[11px] text-destructive">{passwordError}</p>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={saving || !currentPassword || !passwordValid}
            onClick={onChangePassword}
            className="w-full sm:w-auto"
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Alterando..." : "Alterar senha"}
          </Button>
        </div>
      </SettingsCard>
    </>
  );
}

// ── Achievements with filters ─────────────────────────────────────────────────

type MedalFilter = "all" | "earned" | "locked" | MedalTier;

interface AchievementsCardProps {
  earnedTypes: string[];
  achievements: Achievement[];
  onSelect: (spec: MedalSpec | null) => void;
  selectedMedal: MedalSpec | null;
}

export function AchievementsCard({ earnedTypes, achievements, onSelect, selectedMedal }: AchievementsCardProps) {
  const [filter, setFilter] = useState<MedalFilter>("all");

  const filtered = useMemo(() => {
    return MEDAL_CATALOG.filter((m) => {
      const earned = earnedTypes.includes(m.type);
      switch (filter) {
        case "all":     return true;
        case "earned":  return earned;
        case "locked":  return !earned;
        default:        return m.tier === filter;
      }
    });
  }, [filter, earnedTypes]);

  const filteredTypes = filtered.map((m) => m.type);
  const selectedAchievement = selectedMedal
    ? achievements.find((a) => a.type === selectedMedal.type)
    : null;

  const filterButtons: Array<{ value: MedalFilter; label: string; color?: string }> = [
    { value: "all",     label: `Todas (${MEDAL_CATALOG.length})` },
    { value: "earned",  label: `Conquistadas (${earnedTypes.length})` },
    { value: "locked",  label: `Bloqueadas (${MEDAL_CATALOG.length - earnedTypes.length})` },
    { value: "bronze",  label: "Bronze",  color: TIER_COLORS.bronze.body },
    { value: "silver",  label: "Prata",   color: TIER_COLORS.silver.body },
    { value: "gold",    label: "Ouro",    color: TIER_COLORS.gold.body },
    { value: "diamond", label: "Diamante", color: TIER_COLORS.diamond.body },
  ];

  return (
    <>
      <SettingsCard
        icon={<Award className="w-4 h-4" />}
        title="Medalhas"
        description={`${earnedTypes.length} de ${MEDAL_CATALOG.length} conquistas desbloqueadas`}
      >
        {/* Progresso */}
        <div className="rounded-xl border border-border/60 bg-background/40 p-3">
          <Progress
            value={Math.round((earnedTypes.length / MEDAL_CATALOG.length) * 100)}
            className="h-2"
          />
          <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
            {Math.round((earnedTypes.length / MEDAL_CATALOG.length) * 100)}% completo
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground self-center" aria-hidden />
          {filterButtons.map((b) => {
            const active = filter === b.value;
            return (
              <button
                key={b.value}
                onClick={() => setFilter(b.value)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  active
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {b.color ? <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} /> : null}
                {b.label}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">
            Nenhuma medalha nesta categoria por enquanto 🐝
          </p>
        ) : (
          <div className="overflow-hidden -mx-1">
            <MedalGrid
              earnedTypes={earnedTypes}
              onSelect={(spec) => onSelect(spec)}
              filterTypes={filteredTypes}
            />
          </div>
        )}
      </SettingsCard>

      {selectedMedal ? (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <MedalDetail
              spec={selectedMedal}
              earned={earnedTypes.includes(selectedMedal.type)}
              unlockedAt={selectedAchievement?.unlockedAt}
            />
            <Button className="mt-5 w-full" onClick={() => onSelect(null)}>Fechar</Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────────────

interface TestimonialsCardProps {
  testimonials: Testimonial[];
  friends: Friend[];
  testimonialTarget: string;
  testimonialText: string;
  setTestimonialTarget: (v: string) => void;
  setTestimonialText: (v: string) => void;
  onSubmit: () => void;
  saving: boolean;
}

const TESTIMONIAL_MAX = 500;

export function TestimonialsCard(props: TestimonialsCardProps) {
  const {
    testimonials, friends, testimonialTarget, testimonialText,
    setTestimonialTarget, setTestimonialText, onSubmit, saving,
  } = props;

  const canSubmit = testimonialTarget && testimonialText.trim().length > 0 && testimonialText.length <= TESTIMONIAL_MAX;

  return (
    <SettingsCard
      icon={<Quote className="w-4 h-4" />}
      title="Depoimentos"
      description={`${testimonials.length} ${testimonials.length === 1 ? "depoimento recebido" : "depoimentos recebidos"}`}
    >
      {testimonials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-background/30 p-6 text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <p className="text-sm font-bold">Nenhum depoimento ainda</p>
          <p className="text-xs text-muted-foreground">
            Seus amigos podem deixar mensagens carinhosas por aqui. Você também pode escrever para outros 🐝💛
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {testimonials.map((t) => (
            <div key={t.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                {t.authorAvatarUrl ? (
                  <img src={t.authorAvatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="bee-hex w-6 h-6 bg-primary/40 flex items-center justify-center text-[10px] font-black text-primary-foreground">
                    {(t.authorDisplayName || t.authorUsername || "?")[0].toUpperCase()}
                  </div>
                )}
                <p className="text-xs font-bold flex-1 min-w-0 truncate">{t.authorDisplayName || t.authorUsername || "Amigo"}</p>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  {t.createdAt ? new Date(t.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : ""}
                </span>
              </div>
              <p className="text-sm italic text-foreground leading-relaxed">"{t.content}"</p>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
        <p className="text-xs font-bold text-muted-foreground">Escrever para um amigo</p>
        <div className="grid sm:grid-cols-[200px_1fr] gap-2">
          <select
            value={testimonialTarget}
            onChange={(e) => setTestimonialTarget(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Escolher amigo"
          >
            <option value="">Escolher amigo...</option>
            {friends.map((f) => (
              <option key={f.id} value={f.id}>{f.displayName || f.username}</option>
            ))}
          </select>
          <Textarea
            value={testimonialText}
            onChange={(e) => setTestimonialText(e.target.value)}
            maxLength={TESTIMONIAL_MAX + 50}
            rows={2}
            placeholder="Escreva uma mensagem carinhosa estilo Orkut 💛"
            className="min-h-[60px] resize-none"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-mono ${testimonialText.length > TESTIMONIAL_MAX ? "text-destructive" : "text-muted-foreground"}`}>
            {testimonialText.length}/{TESTIMONIAL_MAX}
          </span>
          <Button size="sm" disabled={saving || !canSubmit} onClick={onSubmit}>
            {saving ? "Publicando..." : "Publicar depoimento"}
          </Button>
        </div>
        {friends.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Conecte-se com amigos primeiro para poder escrever depoimentos.
          </p>
        ) : null}
      </div>
    </SettingsCard>
  );
}

// ── Ads card ──────────────────────────────────────────────────────────────────

interface AdsCardProps {
  onOpenAdSettings: () => void;
  isPremium?: boolean;
}

export function AdsCard({ onOpenAdSettings, isPremium = false }: AdsCardProps) {
  return (
    <SettingsCard
      icon={<Shield className="w-4 h-4" />}
      title="Anúncios"
      description="Controle de privacidade e personalização"
    >
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs leading-relaxed text-foreground">
          {isPremium
            ? "✨ Como assinante premium, você não vê anúncios na Bee."
            : "Anúncios discretos ajudam a manter a Bee gratuita. Você decide a frequência, interesses e nível de personalização — sem rastreamento fora do app."}
        </p>
      </div>
      <Button
        variant="outline"
        className="w-full flex items-center justify-between"
        onClick={onOpenAdSettings}
        aria-label="Abrir preferências de anúncios"
        disabled={isPremium}
      >
        <span>Preferências de anúncios</span>
        <ChevronRight className="w-4 h-4" />
      </Button>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
        <FeatureTag>Frequência</FeatureTag>
        <FeatureTag>Interesses</FeatureTag>
        <FeatureTag>Ocultar anunciantes</FeatureTag>
      </div>
    </SettingsCard>
  );
}

function FeatureTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-center text-muted-foreground">
      {children}
    </span>
  );
}

// ── Legal card ────────────────────────────────────────────────────────────────

interface LegalCardProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export function LegalCard({ onOpenPrivacy, onOpenTerms }: LegalCardProps) {
  return (
    <SettingsCard
      icon={<Shield className="w-4 h-4" />}
      title="Termos legais"
      description="Como tratamos seus dados"
    >
      <div className="grid sm:grid-cols-2 gap-2">
        <Button variant="outline" className="justify-between" onClick={onOpenPrivacy} aria-label="Abrir Política de Privacidade">
          Política de Privacidade
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="outline" className="justify-between" onClick={onOpenTerms} aria-label="Abrir Termos de Uso">
          Termos de Uso
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </SettingsCard>
  );
}

// ── Account actions ───────────────────────────────────────────────────────────

interface AccountActionsCardProps {
  user: User | null;
  onLogout: () => void;
}

export function AccountActionsCard({ user, onLogout }: AccountActionsCardProps) {
  return (
    <SettingsCard
      icon={<UserRound className="w-4 h-4" />}
      title="Conta"
      description={user?.email ? `Conectado como ${user.email}` : `Conectado como @${user?.username}`}
      tone="destructive"
    >
      <Button
        variant="outline"
        className="w-full flex items-center gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/60"
        onClick={onLogout}
        aria-label="Sair da conta"
      >
        <LogOut className="w-4 h-4" />
        Sair da conta
      </Button>
    </SettingsCard>
  );
}
