"use client";

import { appDictionary } from "@/mocks/i18n/dictionary";
import { useAppPreferences } from "@/providers/app-preferences-provider";

export function useDictionary() {
  const { lang, toggleLang, setLang } = useAppPreferences();

  return {
    lang,
    copy: appDictionary[lang],
    toggleLang,
    setLang
  };
}
