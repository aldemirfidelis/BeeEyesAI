import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import pt from "@mobile/locales/pt";
import en from "@mobile/locales/en";
import es from "@mobile/locales/es";

function detectLanguage(): string {
  const locales = Localization.getLocales();
  const tag = locales[0]?.languageTag ?? "pt-BR";
  const lang = tag.split("-")[0].toLowerCase();
  if (lang === "es") return "es";
  if (lang === "en") return "en";
  return "pt";
}

export function normalizeAppLanguage(value?: string | null): "pt" | "en" | "es" {
  const lang = (value ?? "").split("-")[0].toLowerCase();
  if (lang === "es") return "es";
  if (lang === "en") return "en";
  return "pt";
}

export function applyAppLanguage(value?: string | null) {
  return i18n.changeLanguage(normalizeAppLanguage(value));
}

i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  lng: detectLanguage(),
  fallbackLng: "pt",
  resources: {
    pt: { translation: pt },
    en: { translation: en },
    es: { translation: es },
  },
  interpolation: { escapeValue: false },
});

export default i18n;
