import { Camera, Globe2, Loader2, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@/features/home/types";
import { SettingsCard, SectionLabel, DirtyDot } from "./SettingsShell";

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
  const {
    user,
    avatarUrl,
    displayName,
    bio,
    language,
    saving,
    fieldSaving,
    fieldErrors,
    onDisplayNameChange,
    onBioChange,
    onLanguageChange,
    onSaveName,
    onSaveBio,
    onSelectPhoto,
    onRemovePhoto,
  } = props;

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
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover border-2 border-primary/30"
            />
          ) : (
            <div className="bee-hex h-14 w-14 bg-primary flex items-center justify-center text-base font-black text-primary-foreground shrink-0">
              {(user?.username || "?")[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Foto de perfil</p>
            <p className="text-xs text-muted-foreground leading-snug">JPG ou PNG, até 5MB</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" onClick={onSelectPhoto} aria-label="Escolher foto de perfil" className="flex-1 sm:flex-none">
            <Camera className="w-3.5 h-3.5 mr-1.5" /> Trocar
          </Button>
          {avatarUrl ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onRemovePhoto}
              aria-label="Remover foto de perfil"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Nome */}
      <div className="space-y-1.5">
        <SectionLabel
          htmlFor="settings-name"
          rightSlot={
            <span
              className={`text-[10px] font-mono ${
                nameLen > NAME_MAX ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {nameLen}/{NAME_MAX}
            </span>
          }
        >
          Nome <DirtyDot visible={nameChanged && nameLen > 0} />
        </SectionLabel>
        <Input
          id="settings-name"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="Seu nome de exibição"
          maxLength={NAME_MAX + 10}
          autoComplete="name"
          aria-invalid={fieldErrors.name ? true : undefined}
          className={fieldErrors.name ? "border-destructive focus-visible:ring-destructive/50" : undefined}
        />
        {fieldErrors.name ? (
          <p role="alert" className="text-[11px] text-destructive">
            {fieldErrors.name}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={saving || !nameChanged || nameLen === 0}
            onClick={onSaveName}
            aria-label="Salvar nome"
          >
            {fieldSaving.name ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar nome"
            )}
          </Button>
        </div>
      </div>

      {/* Idioma */}
      <div className="space-y-1.5">
        <SectionLabel htmlFor="settings-language">Idioma</SectionLabel>
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
          {fieldSaving.language ? (
            <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      </div>

      {/* Bio */}
      <div className="space-y-1.5">
        <SectionLabel
          htmlFor="settings-bio"
          rightSlot={
            <span
              className={`text-[10px] font-mono ${
                bioOver ? "text-destructive" : bioWarn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              }`}
            >
              {bioLen}/{BIO_MAX}
            </span>
          }
        >
          Bio <DirtyDot visible={bioChanged} />
        </SectionLabel>
        <Textarea
          id="settings-bio"
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          maxLength={BIO_MAX + 50}
          rows={3}
          placeholder="Conte um pouco sobre você"
          aria-invalid={fieldErrors.bio ? true : undefined}
          className={`min-h-[80px] resize-none ${
            bioOver ? "border-destructive focus-visible:ring-destructive/50" : ""
          }`}
        />
        {fieldErrors.bio ? (
          <p role="alert" className="text-[11px] text-destructive">
            {fieldErrors.bio}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={saving || !bioChanged || bioOver}
            onClick={onSaveBio}
            aria-label="Salvar bio"
          >
            {fieldSaving.bio ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar bio"
            )}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
