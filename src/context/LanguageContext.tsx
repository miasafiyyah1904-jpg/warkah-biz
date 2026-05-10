import { createContext, useContext, type ReactNode } from "react";
import ms from "@/translations/ms.js";

interface Ctx {
  t: (key: string) => string;
}

const translations: Record<string, string> = ms;

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const t = (key: string) => translations[key] ?? key;
  if (typeof document !== "undefined") document.documentElement.lang = "ms";
  return <LanguageContext.Provider value={{ t }}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used inside LanguageProvider");
  return ctx;
}
