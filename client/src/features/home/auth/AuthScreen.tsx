import { useState } from "react";
import { motion } from "framer-motion";
import BeeEyes from "@/components/BeeEyes";
import { Input } from "@/components/ui/input";
import { PRIVACY_POLICY, TERMS_OF_USE } from "@/lib/legalTexts";

interface PasswordStrength {
  w: string;
  color: string;
  label: string;
}

interface AuthScreenProps {
  authMode: "login" | "register";
  authUsername: string;
  authPassword: string;
  authDisplayName: string;
  authGender: string;
  authError: string;
  authShowPassword: boolean;
  authLoading: boolean;
  googleLoading: boolean;
  strength: PasswordStrength | null;
  onAuthModeChange: (mode: "login" | "register") => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: () => void;
  onGoogleLogin: () => void;
  onClearError: () => void;
}

export function AuthScreen(props: AuthScreenProps) {
  const {
    authMode,
    authUsername,
    authPassword,
    authDisplayName,
    authGender,
    authError,
    authShowPassword,
    authLoading,
    googleLoading,
    strength,
    onAuthModeChange,
    onUsernameChange,
    onPasswordChange,
    onDisplayNameChange,
    onGenderChange,
    onTogglePassword,
    onSubmit,
    onGoogleLogin,
    onClearError,
  } = props;
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);

  return (
    <div className="bee-app-shell flex h-[100dvh] overflow-hidden bg-background">
      {/* Left panel — decorative, always amber */}
      <div
        className="bee-honeycomb hidden md:flex md:w-[44%] flex-col items-center justify-center relative overflow-hidden border-r border-amber-900/10"
        style={{ backgroundColor: "#FFE8A3" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,0.58),transparent_34%),linear-gradient(160deg,rgba(255,248,231,0.92)_0%,rgba(255,229,102,0.76)_52%,rgba(245,200,66,0.92)_100%)]" />
        <svg className="absolute top-0 right-0 opacity-10" width={200} height={200} viewBox="0 0 200 200">
          <path d="M50 10 L90 10 L110 45 L90 80 L50 80 L30 45 Z" fill="#D4A017" />
          <path d="M110 60 L150 60 L170 95 L150 130 L110 130 L90 95 Z" fill="#D4A017" />
          <path d="M20 110 L60 110 L80 145 L60 180 L20 180 L0 145 Z" fill="#D4A017" />
        </svg>
        <svg className="absolute bottom-0 left-0 opacity-10" width={160} height={160} viewBox="0 0 160 160">
          <path d="M60 10 L100 10 L120 45 L100 80 L60 80 L40 45 Z" fill="#D4A017" />
          <path d="M10 70 L50 70 L70 105 L50 140 L10 140 L-10 105 Z" fill="#D4A017" />
        </svg>

        <motion.div className="relative z-10 rounded-[2rem] border border-white/55 bg-white/30 p-8 shadow-2xl shadow-amber-900/10 backdrop-blur-xl" animate={{ y: [-12, 0, -12] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}>
          <BeeEyes expression={authMode === "register" ? "excited" : "happy"} />
        </motion.div>

        <motion.div className="relative z-10 text-center mt-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">bee-eyes</h1>
          <p className="text-sm mt-2 font-medium" style={{ color: "#7A5500" }}>
            {authMode === "register" ? "Comece sua jornada hoje" : "Sua melhor amiga com IA"}
          </p>
        </motion.div>

        <motion.div className="relative z-10 flex flex-wrap justify-center gap-2 mt-10 px-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {["Chat inteligente", "Feed social", "Missões diárias"].map((feature) => (
            <span key={feature} className="text-xs px-3 py-1.5 rounded-full border border-amber-950/10 bg-white/45 text-gray-900 font-bold shadow-sm backdrop-blur">
              {feature}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 overflow-y-auto">
        <motion.div className="md:hidden mb-6" animate={{ y: [-8, 0, -8] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
          <BeeEyes expression={authMode === "register" ? "excited" : "happy"} />
          <p className="text-center text-lg font-black text-foreground mt-3">bee-eyes</p>
        </motion.div>

        <motion.div key={authMode} className="bee-surface w-full max-w-[420px] rounded-2xl p-5 md:p-7" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          <div className="mb-7">
            <h2 className="text-2xl font-black text-foreground">{authMode === "login" ? "Olá de novo!" : "Criar conta"}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {authMode === "login" ? "Entre para continuar sua jornada" : "É rápido, grátis e a BeeEyes te espera."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 mb-6">
            <button
              disabled={googleLoading}
              className="flex items-center justify-center gap-2 py-3 rounded-lg border border-border bg-card/80 text-sm font-bold text-foreground shadow-xs hover:bg-secondary active:scale-[0.98] transition-all disabled:opacity-60"
              onClick={onGoogleLogin}
            >
              {googleLoading ? (
                <svg className="animate-spin w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span>{googleLoading ? "Aguarde..." : "Google"}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">ou com e-mail</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="space-y-4 mb-6">
            {authMode === "register" && (
              <>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Nome de exibição (opcional)</label>
                  <Input
                    placeholder="Como você quer ser chamado?"
                    value={authDisplayName}
                    onChange={(event) => onDisplayNameChange(event.target.value)}
                    className="h-12 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Gênero (opcional)</label>
                  <select
                    value={authGender}
                    onChange={(event) => onGenderChange(event.target.value)}
                    className="w-full h-12 px-3 rounded-lg border border-input bg-card/75 text-foreground text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Prefiro não informar</option>
                    <option value="masculino">Masculino</option>
                    <option value="feminino">Feminino</option>
                    <option value="nao-binario">Não-binário</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Usuário</label>
              <Input
                placeholder="seu_usuario"
                value={authUsername}
                onChange={(event) => onUsernameChange(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && onSubmit()}
                className="h-12 rounded-lg"
                autoCapitalize="none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Senha</label>
              <div className="relative">
                <Input
                  type={authShowPassword ? "text" : "password"}
                  placeholder={authMode === "register" ? "mínimo 6 caracteres" : "••••••••"}
                  value={authPassword}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && onSubmit()}
                  className="h-12 rounded-lg pr-20"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
                  onClick={onTogglePassword}
                >
                  {authShowPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {strength && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                    <div className="h-1 rounded-full transition-all duration-300" style={{ width: strength.w, backgroundColor: strength.color }} />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>
          </div>

          {authError && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-destructive mb-4 text-center bg-destructive/10 py-2 px-3 rounded-lg border border-destructive/20">
              {authError}
            </motion.p>
          )}

          <button
            onClick={onSubmit}
            disabled={authLoading}
            className="w-full py-4 rounded-lg font-black text-gray-900 text-base transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-yellow-200/50"
            style={{ background: "linear-gradient(90deg, #FFD700, #F5C842, #E8B800)" }}
            data-testid={authMode === "login" ? "auth-login-submit" : "auth-register-submit"}
          >
            {authLoading ? "Aguarde..." : authMode === "login" ? "Entrar" : "Criar conta"}
          </button>

          {authMode === "register" && (
            <p className="text-center text-xs text-muted-foreground mt-3">
              Ao criar uma conta voce concorda com os{" "}
              <button type="button" className="text-yellow-600 font-semibold hover:underline" onClick={() => setLegalModal("terms")}>Termos de Uso</button>
              {" "}e a{" "}
              <button type="button" className="text-yellow-600 font-semibold hover:underline" onClick={() => setLegalModal("privacy")}>Politica de Privacidade</button>
            </p>
          )}

          <button
            className="w-full mt-5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              onAuthModeChange(authMode === "login" ? "register" : "login");
              onClearError();
            }}
          >
            {authMode === "login" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </button>
        </motion.div>
      </div>

      {legalModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-card border border-border w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl max-h-[82vh] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-foreground">{legalModal === "privacy" ? "Politica de Privacidade" : "Termos de Uso"}</h3>
              <button type="button" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors" onClick={() => setLegalModal(null)}>Fechar</button>
            </div>
            <pre className="whitespace-pre-wrap overflow-y-auto text-xs leading-relaxed text-muted-foreground font-sans">{legalModal === "privacy" ? PRIVACY_POLICY : TERMS_OF_USE}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
