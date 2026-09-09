import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/globals.css";
// AI IP 工作台（桌面面）的样式。放在 globals 之后：它的令牌挂在 .ip-surface 作用域内，
// 不含 Tailwind preflight，因此对移动端外壳零影响（见该文件头注释）。
import "../styles/ip-desktop.css";
import { AppChrome } from "@/shell/app-chrome";
import Script from "next/script";
import { LAYOUT_BOOT_SCRIPT } from "@/shell/layout-mode";

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
        {/* 桌面版 / 手机版的形态必须在**首帧之前**定下来（见 shell/layout-mode.ts）：
            放进 React effect 里就晚了 —— 第一帧已经按手机版画完，用户会看到闪一下。

            必须走 next/script 的 beforeInteractive，不能自己写 <script>：
            React 19 会把裸 <script> 从组件树里**提出去**（实测报
            「Cannot render a sync or defer <script> outside the main document」
            与「Encountered a script tag while rendering React component」），
            落点和执行时机都不由我们说了算。加 async 能消掉报错，但那就不保证
            在首帧之前跑了 —— 正好把这段的意义抹掉。
            beforeInteractive 由 Next 注入初始 HTML 的 <head>，同步执行。 */}
        <Script id="layout-mode-boot" strategy="beforeInteractive">
          {LAYOUT_BOOT_SCRIPT}
        </Script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_HREF} />
        {/* 桌面顶栏（桌面形态才显示；公开名片页与登录页不挂）—— 见 shell/app-chrome.tsx */}
        <AppChrome />
        {children}
      </body>
    </html>
  );
}
