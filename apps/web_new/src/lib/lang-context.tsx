"use client";

/**
 * 历史遗留：Figma 原型按 zh/en 双语设计。web_new 已收敛为中文单语。
 * 此文件保留 `useLang()` API 是为了渐进式清理 —— 组件在被重构到领域包时，
 * 会陆续去掉 `lang` prop 与三元分支。最终此模块可删除。
 */

import { createContext, useContext, type ReactNode } from "react";
import type { Lang } from "@/translations";

type LangContextValue = {
  lang: Lang;
  /** @deprecated 已无切换能力，仅为兼容调用保留 */
  setLang: (l: Lang) => void;
};

const LangContext = createContext<LangContextValue | undefined>(undefined);

export function LangProvider({ children }: { children: ReactNode }) {
  const value: LangContextValue = { lang: "zh", setLang: () => {} };
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) return { lang: "zh", setLang: () => {} };
  return ctx;
}
