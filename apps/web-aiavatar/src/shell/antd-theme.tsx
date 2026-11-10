"use client";
// 全站 antd 的默认主题（2026-10-31 用户要求）。以前没单独配主题的页面（AI 视频 / AI 图片的资产选择框）用的是 antd 自带的蓝底主按钮，
// 现在默认就是画布那套深墨色主按钮（--ink #202c42，见 ip-desktop.css）、白字；两个汉字的按钮不再被 antd 加空格（「取 消」）。
// 新页面不用再自己包 ConfigProvider 才能对上颜色；页面里已有的 ConfigProvider 照旧生效（嵌套的覆盖这里）。
import type { ReactNode } from "react";
import { ConfigProvider, type ThemeConfig } from "antd";

export const STUDIO_PRIMARY = "#202c42";
/**
 * 危险色（2026-11-10 用户反馈资产页删除确认键颜色不对）：antd 默认 #ff4d4f 是偏粉的亮红，和站内删除按钮、失败标签的深红（--ip-error #ad3449）不是一个颜色。
 * 统一用站内这个色，确认弹窗里 danger 的主按钮、错误提示都跟着变；页面里嵌套的 ConfigProvider 会继承这个值。
 */
export const STUDIO_DANGER = "#ad3449";

export const STUDIO_ANTD_THEME: ThemeConfig = {
  token: { colorPrimary: STUDIO_PRIMARY, colorError: STUDIO_DANGER, colorLink: STUDIO_PRIMARY, colorLinkHover: "#3a4660", colorLinkActive: "#141c2c", fontFamily: "var(--ip-ui, var(--font-sans, sans-serif))" },
  // 不能点的按钮：浅灰底、灰字，看得出是什么按钮（antd 默认 25% 透明的字太淡）。
  components: { Button: { primaryShadow: "none", primaryColor: "#fff", colorTextDisabled: "#8a929c", colorBgContainerDisabled: "#eef0f2", borderColorDisabled: "#e3e6ea" } },
};

export function AntdTheme({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={STUDIO_ANTD_THEME} button={{ autoInsertSpace: false }}>{children}</ConfigProvider>;
}
