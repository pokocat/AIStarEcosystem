"use client";

// 画布文案 —— 只装中文一种语言。
//
// 保留 i18next 而不是把 40 个 useTranslation 调用点改成内联中文：改了就再也没法跟上游
// 合并了（画布是搬来的，见 src/canvas/README.md）。§4.6 禁的是「维护 { zh, en } 双语字典」，
// 这里只有 zh-CN 一份资源、界面全中文，符合那条的意图。
//
// 上游在模块顶层读 localStorage —— Next 的服务端渲染里没有 window，会直接崩，所以去掉。

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zhCN from "@/canvas/locales/zh-CN";

export type AppLocale = "zh-CN";

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { "zh-CN": { translation: zhCN } },
    lng: "zh-CN",
    fallbackLng: "zh-CN",
    supportedLngs: ["zh-CN"],
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

/** 上游留下的切换语言入口。本仓中文单语，保留签名让调用点不用改，实际不切。 */
export function changeAppLocale(_locale: AppLocale) {
  return Promise.resolve();
}

export { i18n };
export default i18n;
