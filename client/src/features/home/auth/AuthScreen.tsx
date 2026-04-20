import { motion } from "framer-motion";
import BeeEyes from "@/components/BeeEyes";
import { Input } from "@/components/ui/input";

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

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <div
        className="hidden md:flex md:w-[42%] flex-col items-center justify-center relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #FFF8E7 0%, #FFE566 50%, #F5C842 100%)" }}
      >
        <svg className="absolute top-0 right-0 opacity-10" width={200} height={200} viewBox="0 0 200 200">
          <path d="M50 10 L90 10 L110 45 L90 80 L50 80 L30 45 Z" fill="#D4A017" />
          <path d="M110 60 L150 60 L170 95 L150 130 L110 130 L90 95 Z" fill="#D4A017" />
          <path d="M20 110 L60 110 L80 145 L60 180 L20 180 L0 145 Z" fill="#D4A017" />
        </svg>
        <svg className="absolute bottom-0 left-0 opacity-10" width={160} height={160} viewBox="0 0 160 160">
          <path d="M60 10 L100 10 L120 45 L100 80 L60 80 L40 45 Z" fill="#D4A017" />
          <path d="M10 70 L50 70 L70 105 L50 140 L10 140 L-10 105 Z" fill="#D4A017" />
        </svg>

        <motion.div animate={{ y: [-12, 0, -12] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}>
          <BeeEyes expression={authMode === "register" ? "excited" : "happy"} />
        </motion.div>

        <motion.div className="text-center mt-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">bee-eyes</h1>
          <p className="text-sm mt-2 font-medium" style={{ color: "#7A5500" }}>
            {authMode === "register" ? "Comece sua jornada hoje" : "Sua melhor amiga com IA"}
          </p>
        </motion.div>

        <motion.div className="flex gap-2 mt-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {["Chat inteligente", "Feed social", "Missões diárias"].map((feature) => (
            <span key={feature} className="text-xs px-3 py-1 rounded-full bg-black/10 text-gray-800 font-medium">
              {feature}
            </span>
          ))}
        </motion.div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-y-auto bg-white">
        <motion.div className="md:hidden mb-6" animate={{ y: [-8, 0, -8] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
          <BeeEyes expression={authMode === "register" ? "excited" : "happy"} />
          <p className="text-center text-lg font-black text-gray-900 mt-3">bee-eyes</p>
        </motion.div>

        <motion.div key={authMode} className="w-full max-w-sm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          <div className="mb-7">
            <h2 className="text-2xl font-black text-gray-900">{authMode === "login" ? "Olá de novo!" : "Criar conta"}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {authMode === "login" ? "Entre para continuar sua jornada" : "É rápido, grátis e a BeeEyes te espera."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              disabled={googleLoading}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-60"
              onClick={onGoogleLogin}
            >
              {googleLoading ? (
                <svg className="animate-spin w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none">
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
            <button
              disabled
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-400 cursor-not-allowed opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Apple
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">ou com e-mail</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="space-y-4 mb-6">
            {authMode === "register" && (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nome de exibição (opcional)</label>
                  <Input
                    placeholder="Como você quer ser chamado?"
                    value={authDisplayName}
                    onChange={(event) => onDisplayNameChange(event.target.value)}
                    className="h-12 rounded-xl border-2 border-gray-200 focus:border-yellow-400 bg-gray-50 text-base"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Gênero (opcional)</label>
                  <select
                    value={authGender}
                    onChange={(event) => onGenderChange(event.target.value)}
                    className="w-full h-12 px-3 rounded-xl border-2 border-gray-200 focus:border-yellow-400 bg-gray-50 text-base text-gray-800 outline-none"
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
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Usuário</label>
              <Input
                placeholder="seu_usuario"
                value={authUsername}
                onChange={(event) => onUsernameChange(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && onSubmit()}
                className="h-12 rounded-xl border-2 border-gray-200 focus:border-yellow-400 bg-gray-50 text-base"
                autoCapitalize="none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Senha</label>
              <div className="relative">
                <Input
                  type={authShowPassword ? "text" : "password"}
                  placeholder={authMode === "register" ? "mínimo 6 caracteres" : "••••••••"}
                  value={authPassword}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && onSubmit()}
                  className="h-12 rounded-xl border-2 border-gray-200 focus:border-yellow-400 bg-gray-50 text-base pr-12"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={onTogglePassword}
                >
                  {authShowPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {strength && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-1 rounded-full transition-all duration-300" style={{ width: strength.w, backgroundColor: strength.color }} />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>
          </div>

          {authError && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-destructive mb-4 text-center bg-red-50 py-2 px-3 rounded-lg">
              {authError}
            </motion.p>
          )}

          <button
            onClick={onSubmit}
            disabled={authLoading}
            className="w-full h-13 py-4 rounded-xl font-black text-gray-900 text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-yellow-200"
            style={{ background: "linear-gradient(90deg, #FFD700, #F5C842, #E8B800)" }}
            data-testid={authMode === "login" ? "auth-login-submit" : "auth-register-submit"}
          >
            {authLoading ? "Aguarde..." : authMode === "login" ? "Entrar" : "Criar conta"}
          </button>

          {authMode === "register" && (
            <p className="text-center text-xs text-muted-foreground mt-3">
              Ao criar uma conta você concorda com os <span className="text-yellow-600 font-semibold">Termos de Uso</span>
            </p>
          )}

          <button
            className="w-full mt-5 text-sm text-muted-foreground hover:text-gray-800 transition-colors"
            onClick={() => {
              onAuthModeChange(authMode === "login" ? "register" : "login");
              onClearError();
            }}
          >
            {authMode === "login" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
