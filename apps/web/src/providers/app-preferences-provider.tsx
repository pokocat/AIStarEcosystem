"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Lang } from "@/types/app";

interface AppPreferencesContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | undefined>(undefined);
const STORAGE_KEY = "ai-star-eco-lang";

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const storedLang = window.localStorage.getItem(STORAGE_KEY);
    if (storedLang === "zh" || storedLang === "en") {
      setLang(storedLang);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      lang,
      setLang,
      toggleLang: () => setLang((current) => (current === "zh" ? "en" : "zh"))
    }),
    [lang]
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error("useAppPreferences must be used within AppPreferencesProvider");
  }

  return context;
}
