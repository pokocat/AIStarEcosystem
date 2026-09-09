import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/globals.css";
// AI IP 工作台（桌面面）的样式。放在 globals 之后：它的令牌挂在 .ip-surface 作用域内，
// 不含 Tailwind preflight，因此对移动端外壳零影响（见该文件头注释）。
import "../styles/ip-desktop.css";
import { AppChrome } from "@/shell/app-chrome";
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

            位置：<body> 的第一个子节点，裸 <script>（解析阻塞、同步执行）。
            这里**试过 next/script 的 beforeInteractive，实测不行**：它先把脚本推进
            `self.__next_s` 队列，等 app bootstrap 起来才真正插进 head ——
            插桩量到那时 `document.readyState` 已经是 `interactive`、body 有 13 个子节点、
            应用标记全都解析完了，也就是很可能已经按手机版画过一帧。
            裸 script 量到的是 `readyState: "loading"` / body 2 个子节点 / 应用标记还没有 ——
            这才是「首帧之前」。（Codex 复核提出这一点，实测确认它是对的。）

            放在 <html> 直下会报 hydration error（<script> 不能是 <html> 的子节点）；
            放 <body> 里则干净无报错 —— 我一度被**上一次改动残留在控制台里的旧报错**
            误导，以为放 body 也不行。§8.0.1 ②：先确认信号本身成立，再据它改代码。 */}
        <script dangerouslySetInnerHTML={{ __html: LAYOUT_BOOT_SCRIPT }} />
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
