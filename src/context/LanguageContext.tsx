import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import ms from "@/translations/ms.js";
import en from "@/translations/en.js";
import zh from "@/translations/zh.js";
import ta from "@/translations/ta.js";
import { useAuth } from "@/context/AuthContext";

type Lang = "ms" | "en" | "zh" | "ta";
const translations: Record<Lang, Record<string, string>> = { ms, en, zh, ta };
const LANGUAGE_KEY_BASE = "warkahbiz_language";

interface Ctx {
  language: Lang;
  setLanguage: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const languageKey = userId ? `${LANGUAGE_KEY_BASE}_${userId}` : null;
  const [language, setLangState] = useState<Lang>("ms");

  useEffect(() => {
    if (!languageKey) {
      setLangState("ms");
      return;
    }
    try { setLangState((localStorage.getItem(languageKey) as Lang) || "ms"); } catch { setLangState("ms"); }
  }, [languageKey]);

  const setLanguage = useCallback((lang: Lang) => {
    setLangState(lang);
    if (languageKey) {
      try { localStorage.setItem(languageKey, lang); } catch {}
    }
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [languageKey]);

  const t = useCallback((key: string) => {
    return translations[language]?.[key] ?? translations.en?.[key] ?? key;
  }, [language]);

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used inside LanguageProvider");
  return ctx;
}
