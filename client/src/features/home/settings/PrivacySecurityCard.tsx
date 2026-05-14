import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingsCard, SettingsRow, SectionLabel } from "./SettingsShell";

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
    anonymousProfileVisitsEnabled,
    onAnonymousToggle,
    currentPassword,
    newPassword,
    setCurrentPassword,
    setNewPassword,
    onChangePassword,
    saving,
    passwordError,
  } = props;

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const passwordValid =
    newPassword.length >= 8 && /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword);
  const passwordStrength = passwordStrengthScore(newPassword);

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
          trailing={
            <Switch
              checked={anonymousProfileVisitsEnabled}
              onCheckedChange={onAnonymousToggle}
              aria-label="Navegação anônima"
            />
          }
        />
        <div className="h-px bg-border/60 -mx-2" />
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
        <div className="space-y-3">
          <div className="space-y-1.5">
            <SectionLabel htmlFor="current-pw">Senha atual</SectionLabel>
            <PasswordField
              id="current-pw"
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrent}
              onToggle={() => setShowCurrent((v) => !v)}
              placeholder="Digite sua senha atual"
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-1.5">
            <SectionLabel htmlFor="new-pw">Nova senha</SectionLabel>
            <PasswordField
              id="new-pw"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew((v) => !v)}
              placeholder="Mínimo 8 caracteres, com letra e número"
              autoComplete="new-password"
              invalid={newPassword.length > 0 && !passwordValid}
            />
            {newPassword.length > 0 ? <StrengthMeter score={passwordStrength} /> : null}
            {newPassword.length > 0 && !passwordValid ? (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                A senha precisa ter ao menos 8 caracteres, contendo letra e número.
              </p>
            ) : null}
            {passwordError ? (
              <p role="alert" className="text-[11px] text-destructive">
                {passwordError}
              </p>
            ) : null}
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={saving || !currentPassword || !passwordValid}
            onClick={onChangePassword}
            className="w-full sm:w-auto"
            aria-label="Alterar senha"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Alterando...
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                Alterar senha
              </>
            )}
          </Button>
        </div>
      </SettingsCard>
    </>
  );
}

interface PasswordFieldProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
  autoComplete: string;
  invalid?: boolean;
}

function PasswordField({
  id,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  autoComplete,
  invalid,
}: PasswordFieldProps) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={invalid ? true : undefined}
        className={`pr-10 ${invalid ? "border-amber-500 focus-visible:ring-amber-500/40" : ""}`}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function passwordStrengthScore(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4) as 0 | 1 | 2 | 3 | 4;
}

function StrengthMeter({ score }: { score: 0 | 1 | 2 | 3 | 4 }) {
  const labels = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];
  const colors = [
    "bg-destructive",
    "bg-amber-500",
    "bg-amber-400",
    "bg-emerald-500",
    "bg-emerald-600",
  ];
  return (
    <div className="space-y-1" aria-label={`Força da senha: ${labels[score]}`}>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < score ? colors[score] : "bg-muted"}`}
          />
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">{labels[score]}</p>
    </div>
  );
}
