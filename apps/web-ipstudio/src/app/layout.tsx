import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/app.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "AI IP 工作台 — AI Star Eco",
  description: "一张照片起步，在画布上稳定产出同一人物、同一风格的一组 AI IP 形象，发布为可授权的数字资产。",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
  openGraph: {
    title: "AI IP 工作台 — AI Star Eco",
    description: "一张照片起步，稳定产出同一人物、同一风格的一组 AI IP 形象。",
    siteName: "AI Star Eco",
    locale: "zh_CN",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f9fb",
};

// Atelier Ledger 字体三件套：Manrope（界面）/ Newsreader（资产名）/ JetBrains Mono（编号）。
// 中文由系统字体回退承担（见 tokens.css 的 --font-sans）。
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=JetBrains+Mono:wght@400;500;600&display=swap";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_HREF} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
