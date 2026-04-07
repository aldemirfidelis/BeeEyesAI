import { motion, AnimatePresence } from "framer-motion";
import { Camera, LogOut, Moon, Settings, Sun } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ThemeMode } from "@/lib/theme";
import type { User } from "@/features/home/types";

interface SettingsScreenProps {
  show: boolean;
  user: User | null;
  profilePhotoUrl: string;
  themeMode: ThemeMode;
  settingsMessage: string;
  anonymousProfileVisitsEnabled: boolean;
  anonymousProfileVisitsUnlocked: boolean;
  anonymousProfileVisitsUnlockHint: string;
  onClose: () => void;
  onSelectProfilePhoto: () => void;
  onRemoveProfilePhoto: () => void;
  onThemeSelect: (theme: ThemeMode) => void;
  onAnonymousProfileVisitsToggle: (next: boolean) => void;
  onLogout: () => void;
}

export function SettingsScreen(props: SettingsScreenProps) {
  const {
    show,
    user,
    profilePhotoUrl,
    themeMode,
    settingsMessage,
    anonymousProfileVisitsEnabled,
    anonymousProfileVisitsUnlocked,
    anonymousProfileVisitsUnlockHint,
    onClose,
    onSelectProfilePhoto,
    onRemoveProfilePhoto,
    onThemeSelect,
    onAnonymousProfileVisitsToggle,
    onLogout,
  } = props;

  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background">
          <div className="h-full overflow-y-auto">
            <div className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur-sm">
              <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  <h2 className="font-display text-lg font-semibold">Configurações</h2>
                </div>
                <Button variant="outline" onClick={onClose}>Fechar</Button>
              </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Foto de perfil</p>
                </div>
                <div className="flex items-center gap-3">
                  {profilePhotoUrl ? (
                    <img src={profilePhotoUrl} alt="Foto de perfil" className="w-16 h-16 rounded-full object-cover border" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-lg font-black text-primary-foreground">
                      {(user?.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">Selecione uma imagem com recorte central e visual limpo para reforçar identidade de perfil.</div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={onSelectProfilePhoto}>Escolher do computador</Button>
                  <Button className="flex-1" variant="outline" onClick={onRemoveProfilePhoto}>Remover</Button>
                </div>
              </Card>

              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {themeMode === "dark" ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
                  <p className="text-sm font-semibold">Aparência</p>
                </div>
                <p className="text-xs text-muted-foreground">Escolha entre modo claro e escuro com contraste consistente.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={themeMode === "light" ? "default" : "outline"} onClick={() => onThemeSelect("light")}>Modo claro</Button>
                  <Button variant={themeMode === "dark" ? "default" : "outline"} onClick={() => onThemeSelect("dark")}>Modo escuro</Button>
                </div>
              </Card>

              <Card className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Navegação anônima</p>
                    <p className="text-xs text-muted-foreground">Suas visitas em perfis deixam de mostrar seu nome para a outra pessoa.</p>
                  </div>
                  <Switch
                    checked={anonymousProfileVisitsEnabled}
                    disabled={!anonymousProfileVisitsUnlocked}
                    onCheckedChange={onAnonymousProfileVisitsToggle}
                    aria-label="Ativar navegação anônima"
                  />
                </div>
                <div className={`rounded-xl border px-3 py-2 text-xs ${anonymousProfileVisitsUnlocked ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-secondary/40 text-muted-foreground"}`}>
                  {anonymousProfileVisitsUnlocked
                    ? "Recurso liberado. Você pode ativar ou desativar quando quiser."
                    : anonymousProfileVisitsUnlockHint}
                </div>
                {user && (
                  <p className="text-[11px] text-muted-foreground">
                    Progresso atual: nível {user.level}. Complete missões para destravar opções premium do produto.
                  </p>
                )}
              </Card>

              <Card className="p-4 space-y-2">
                <p className="text-sm font-semibold">Qualidade do produto</p>
                <p className="text-xs text-muted-foreground">Notificações personalizadas, privacidade e acessibilidade continuam preparadas para a próxima rodada.</p>
              </Card>

              {settingsMessage && <p className="text-xs rounded-lg border border-primary/40 bg-primary/10 p-2 text-primary">{settingsMessage}</p>}

              <Button
                variant="outline"
                className="w-full flex items-center gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/60"
                onClick={onLogout}
              >
                <LogOut className="w-4 h-4" />
                Sair da conta
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
