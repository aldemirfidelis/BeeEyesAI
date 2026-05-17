import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

/**
 * Inicialização de Sentry (crash reporting + tracing).
 *
 * Gate por env: só ativa quando EXPO_PUBLIC_SENTRY_DSN está configurado.
 * Em dev local sem DSN, Sentry permanece desligado (fail-silently) e a app
 * continua funcionando normalmente.
 *
 * Configuração:
 *   1. Criar projeto em https://sentry.io
 *   2. Adicionar em mobile/.env (e eas.json production):
 *        EXPO_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/yyy
 *   3. (Opcional) EXPO_PUBLIC_SENTRY_ENV=production|staging|preview
 *
 * Em produção, configurar também `release` via `expo-build-properties`
 * ou via EAS source maps upload — fora do escopo deste arquivo.
 */

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

let initialized = false;

export function initSentry(): boolean {
  if (initialized) return true;
  if (!DSN) {
    if (__DEV__) {
      console.info("[sentry] EXPO_PUBLIC_SENTRY_DSN não configurado — Sentry desligado.");
    }
    return false;
  }

  try {
    Sentry.init({
      dsn: DSN,
      // Captura erros não tratados de JS, native crashes e ANRs (Android)
      enableAutoSessionTracking: true,
      enableNativeCrashHandling: true,
      // Em dev, debug=true ajuda; em prod, mantém silencioso
      debug: __DEV__,
      environment: process.env.EXPO_PUBLIC_SENTRY_ENV?.trim() ?? (__DEV__ ? "development" : "production"),
      // Versão do app — Sentry agrupa releases por essa string
      release: `bee-eyes-ai@${Constants.expoConfig?.version ?? "0.0.0"}`,
      // Performance tracing (10% das transações em prod, 100% em dev)
      tracesSampleRate: __DEV__ ? 1.0 : 0.1,
      // Não captura dados sensíveis automaticamente
      sendDefaultPii: false,
      beforeSend(event) {
        // Hard-strip de PII potencial em logs estruturados
        if (event.extra) {
          for (const key of Object.keys(event.extra)) {
            if (/email|token|password|cpf|cep/i.test(key)) {
              event.extra[key] = "[REDACTED]";
            }
          }
        }
        return event;
      },
    });
    initialized = true;
    return true;
  } catch (err) {
    if (__DEV__) {
      console.warn("[sentry] falha ao inicializar:", err);
    }
    return false;
  }
}

/** Identifica o usuário no Sentry após login. Usa apenas userId — não envia PII. */
export function identifySentryUser(userId: string | null): void {
  if (!initialized) return;
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

/** Captura erros não-fatais manualmente (ex: catch blocks que queremos visibilidade). */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) {
    if (__DEV__) console.error("[sentry off]", error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Adiciona breadcrumb para rastrear eventos importantes antes de um crash. */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.addBreadcrumb({ category, message, data, level: "info" });
}
