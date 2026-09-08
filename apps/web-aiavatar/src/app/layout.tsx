import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/globals.css";
// AI IP 工作台（桌面面）的样式。放在 globals 之后：它的令牌挂在 .ip-surface 作用域内，
// 不含 Tailwind preflight，因此对移动端外壳零影响（见该文件头注释）。
import "../styles/ip-desktop.css";
import { AppChrome } from "@/shell/app-chrome";

export const metadata: Metadata = {
  title: "数字人资产平台 · AiAvatar",
  description: "真人授权复刻 / 纯 AI 原创，形象 · 声音 · 衍生物一站式沉淀的数字人资产平台。",
  icons: {
    icon: "/brand/logo.jpg",
    shortcut: "/brand/logo.jpg",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "数字人" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F7F9FB",
};

// 字体：Manrope（UI/标题）+ Newsreader（资产身份衬线）+ JetBrains Mono（登记号）
// + Noto Sans SC（中文）。经 React 19 自动提升到 <head>；浏览器无法访问 Google
// Fonts 时优雅回退到系统字体（globals.css 的 --font-* 已带 system 回退）。
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700;900&display=swap";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_HREF} />
        {/* 桌面顶栏（≥1024 才显示；公开名片页与登录页不挂）—— 见 shell/app-chrome.tsx */}
        <AppChrome />
        {children}
      </body>
    </html>
  );
}
