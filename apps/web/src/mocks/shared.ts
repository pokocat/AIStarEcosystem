import type { Lang } from "@/types/app";

export interface LocalizedText {
  zh: string;
  en: string;
}

export function localized(zh: string, en: string): LocalizedText {
  return { zh, en };
}

export function pickLocalizedText(lang: Lang, text: LocalizedText) {
  return text[lang];
}

export function formatCurrencyCny(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0
  }).format(value);
}
